/**
 * Rival crowns. They are not simulated in full: they research the crossing on a schedule, send ships to found
 * colonies at good sites and to trade with native peoples, grow their colonies, and go to war with you when
 * relations sour. Everything they do happens on the map, where the player can see it.
 */
import { CROWNS, rivalSpec, rivalsOf, type CrownId } from '../data/rivals';
import { SHIPS } from '../data/ships';
import { isWater } from '../data/terrain';
import { RESOURCE_IDS } from '../data/city';
import { GRIDS, type Grid } from './hex';
import { mulberry32, hashSeed, int, pick, type Rng } from './rng';
import { planRoute, stepCost } from './sailing';
import { LEVELS } from './colony';
import { personById, skill } from './court';
import { Fog, seasonOf, type Colony, type Fleet, type GameEvent, type GameState, type MapId, type Party, type RivalColony, type RivalShip, type RivalState, type World } from './types';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ev = (e: GameEvent) => void;

/** The player's crown, as the rivals' messages name it. */
const me = (s: GameState) => rivalSpec(s.crown).name;

const NAMES: Record<CrownId, string[]> = {
  spain: ['Santo Domingo', 'Villa Rica', 'San Cristóbal', 'Nueva Sevilla', 'Santiago', 'La Concepción', 'San Agustín', 'Puerto Real', 'Santa Fe'],
  france: ['Port-Royal', 'Fort Caroline', 'Charlesbourg', 'Nouvelle-Rochelle', 'Fort Saint-Louis', 'Sainte-Croix', 'Port-Dauphin', 'Fort Coligny'],
  portugal: ['São Jorge', 'Santa Maria', 'Nova Lisboa', 'São Tomé', 'Porto Seguro', 'Vila Nova', 'São Vicente', 'Santo Antão', 'Nossa Senhora'],
  england: ['New Hope', 'Kingsport', 'Fort George', 'Middleton', 'Port Charles', 'Newbury', 'Fort William', 'Southhaven', 'Fairhaven'],
  netherlands: ['Nieuw Antwerpen', 'Fort Nassau', 'Zeehaven', 'Nieuwpoort', 'Fort Oranje', 'Nieuw Middelburg', 'Goede Hoop', 'Fort Zeelandia'],
};

/** Every crown gets a record; the one you play is never used. */
export function initRivals(_me: CrownId = 'spain'): Record<CrownId, RivalState> {
  return Object.fromEntries(CROWNS.map((r) => [r.id, { attitude: 10, relation: 'peace', next: r.start, revenue: 0, posts: [], warSince: null }])) as unknown as Record<CrownId, RivalState>;
}

const MOVES = 15;
const allKnown = new Map<MapId, number[]>();
const known = (map: MapId) => {
  let k = allKnown.get(map);
  if (!k) { k = new Array(GRIDS[map].N).fill(Fog.Explored); allKnown.set(map, k); }
  return k;
};

const allColonyHexes = (s: GameState, map: MapId) => [...s.colonies.filter((c) => c.map === map).map((c) => c.hex), ...s.rivalColonies.filter((c) => c.map === map).map((c) => c.hex)];

/** A good coastal site: near riches, inside the crown's preferred latitudes, clear of other settlements. */
function pickSite(w: World, s: GameState, crown: CrownId, map: MapId, rng: Rng): number | null {
  const g = GRIDS[map];
  const m = w[map];
  const pref = rivalSpec(crown).prefer[map];
  if (!pref) return null;
  const taken = allColonyHexes(s, map);
  let best: number | null = null, bestScore = -1;
  for (let k = 0; k < 500; k++) {
    const h = int(rng, 0, g.N - 1);
    const lat = g.lat(h);
    if (lat < pref[0] || lat > pref[1] || isWater(m.terrain[h])) continue;
    if (map === 'old' && lat >= 30) continue;
    if (!g.neighbors(h).some((j) => isWater(m.terrain[j]))) continue;
    if (taken.some((t) => g.distance(t, h) <= 4)) continue;
    if (m.ports.some((p) => g.distance(p.hex, h) <= 2)) continue;
    let score = rng() * 2;
    for (const j of g.within(h, 2)) {
      const r = m.resource[j] ? RESOURCE_IDS[m.resource[j] - 1] : null;
      if (r === 'gold' || r === 'silver') score += 5;
      else if (r === 'fertile') score += 3;
      else if (r) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best;
}

/** Where a rival ship appears for a voyage on this board: its home port in Europe, or out of the eastern ocean. */
function startHex(w: World, crown: CrownId, map: MapId, target: number): number {
  if (map === 'old') return w.old.ports.find((p) => p.id === rivalSpec(crown).home)!.hex;
  const g = GRIDS.new;
  return w.new.portals.reduce((b, h) => (Math.abs(g.lat(h) - g.lat(target)) < Math.abs(g.lat(b) - g.lat(target)) ? h : b));
}

function route(w: World, s: GameState, map: MapId, from: number, to: number) {
  const g = GRIDS[map];
  return planRoute(g, w[map], seasonOf(s.turn), from, to, {
    explorer: true, ports: new Set([to]), fog: known(map), movesLeft: MOVES, movesMax: MOVES, windward: 0.5,
  })?.path ?? null;
}

function spawn(w: World, s: GameState, crown: CrownId, map: MapId, kind: RivalShip['kind'], target: number | null, strength = 0) {
  const hex = target != null && kind !== 'privateer' ? startHex(w, crown, map, target) : target ?? startHex(w, crown, map, 0);
  const ship: RivalShip = { id: s.nextId++, crown, map, hex, kind, target, path: null, trail: [hex], strength };
  if (target != null && kind !== 'privateer') ship.path = route(w, s, map, hex, target);
  if (kind !== 'privateer' && !ship.path) return null;
  s.rivalShips.push(ship);
  return ship;
}

function sail(w: World, s: GameState, ship: RivalShip) {
  const g = GRIDS[ship.map];
  const m = w[ship.map];
  ship.trail = [ship.hex];
  let moves = MOVES;
  const path = ship.path;
  while (path && path.length > 1) {
    const next = path[1];
    const c = stepCost(g, m, seasonOf(s.turn), ship.hex, next, 0.5);
    if (moves < c && moves < MOVES) break;
    moves -= c;
    ship.hex = next;
    path.shift();
    ship.trail.push(next);
  }
}

// ---------- the season ----------

export function rivalsSeason(w: World, s: GameState, log: Log, ev: Ev, onFleetLost: (f: Fleet, why: string) => void) {
  const rng = mulberry32(hashSeed(s.seed, s.turn, 77));
  // a treaty divides the world: Africa to Portugal, the west to Castile
  if (s.turn === 6) {
    log('court', 'At Tordesillas, the Pope’s envoys draw a line down the Mar Océano: Africa and the East to Portugal, the lands to the west to Castile.');
    const text = s.crown === 'spain'
      ? 'Castile and Portugal divide the unknown world between them. Portugal will resent your colonies on the African coast; the lands across the ocean are yours to claim, if you can.'
      : s.crown === 'portugal'
        ? 'Castile and Portugal divide the unknown world between them. Africa and the route to the East are yours; Castile will resent your colonies across the ocean.'
        : `Castile and Portugal divide the unknown world between them, as if no one else sailed. ${me(s)} does not recognise the line, but Portugal will resent colonies on the African coast.`;
    ev({ kind: 'people', title: 'The Treaty of Tordesillas', map: 'old', hex: w.old.ports.find((p) => p.id === 'lisbon')!.hex, text });
  }
  for (const spec of rivalsOf(s.crown)) {
    const r = s.rivals[spec.id];
    // new expeditions
    if (s.turn >= r.next) {
      const boards: MapId[] = s.turn >= spec.volta ? ['old', 'new', 'new'] : ['old'];
      const map = pick(rng, boards);
      const busy = s.rivalShips.some((x) => x.crown === spec.id && x.kind === 'settlers');
      if (!busy) {
        if (rng() < spec.trade) {
          const sites = w[map].ports.filter((p) => p.kind === 'native' && !r.posts.includes(p.id));
          if (sites.length) spawn(w, s, spec.id, map, 'trader', pick(rng, sites).hex);
        } else {
          const site = pickSite(w, s, spec.id, map, rng);
          if (site != null) spawn(w, s, spec.id, map, 'settlers', site);
        }
      }
      r.next = s.turn + Math.max(8, spec.pace - Math.floor(s.turn / 40));
    }
    // earnings
    // what their trade earns, on the same scale as the player's sales
    r.revenue += s.rivalColonies.filter((c) => c.crown === spec.id).reduce((t, c) => t + c.pop * 6, 0) + r.posts.length * 25;
    // relations drift, and sour with neighbours too close
    r.attitude += r.attitude > 10 ? -0.5 : r.attitude < 10 ? 0.5 : 0;
    for (const c of s.colonies) {
      if (s.rivalColonies.some((x) => x.crown === spec.id && x.map === c.map && GRIDS[c.map].distance(x.hex, c.hex) <= 6)) r.attitude -= 3;
      if (spec.id === 'portugal' && s.turn > 6 && c.map === 'old') r.attitude -= 2;
      if (spec.id === 'spain' && s.crown === 'portugal' && s.turn > 6 && c.map === 'new') r.attitude -= 1;
    }
    r.attitude = Math.max(-100, Math.min(100, r.attitude));
    if (r.relation === 'peace' && r.attitude < -50 && rng() < 0.15) {
      r.relation = 'war';
      r.warSince = s.turn;
      log('peril', `${spec.name} declares war on ${me(s)}.`);
      ev({ kind: 'lost', title: `War with ${spec.name}`, map: 'old', hex: w.old.ports.find((p) => p.id === spec.home)!.hex,
        text: `${spec.name} has declared war. Their privateers will hunt your ships and their soldiers may fall on your colonies. You can make peace at court, or carry the war to their colonies.` });
    }
    if (r.relation === 'war') {
      // privateers where your ships are
      for (const map of ['old', 'new'] as MapId[]) {
        if (map === 'new' && s.turn < spec.volta) continue;
        if (!s.fleets.some((f) => f.map === map)) continue;
        if (s.rivalShips.some((x) => x.crown === spec.id && x.kind === 'privateer' && x.map === map)) continue;
        const base = s.rivalColonies.find((c) => c.crown === spec.id && c.map === map);
        const at = base ? GRIDS[map].neighbors(base.hex).find((h) => isWater(w[map].terrain[h])) ?? base.hex : startHex(w, spec.id, map, s.fleets.find((f) => f.map === map)!.hex);
        spawn(w, s, spec.id, map, 'privateer', at, 5 + Math.floor((s.turn - (r.warSince ?? s.turn)) / 4) + int(rng, 0, 3));
      }
      // raids on colonies near theirs
      for (const c of s.colonies) {
        if (!s.rivalColonies.some((x) => x.crown === spec.id && x.map === c.map && GRIDS[c.map].distance(x.hex, c.hex) <= 12) || rng() > 0.2) continue;
        const garrison = s.units.filter((u) => u.colony === c.id && u.type === 'infantry').length;
        const win = rng() < 7 / (7 + garrison * 4 + c.pop * 0.6 + 1);
        if (win) {
          if (c.pop > 1) c.pop--;
          for (const k of Object.keys(c.stock) as (keyof Colony['stock'])[]) c.stock[k] = Math.floor((c.stock[k] ?? 0) / 2);
          log('peril', `${spec.people[0].toUpperCase()}${spec.people.slice(1)} raid ${c.name}: a colonist is killed and the warehouse plundered.`);
        } else log('peril', `${spec.people[0].toUpperCase()}${spec.people.slice(1)} attack ${c.name}, and are beaten off.`);
      }
    }
  }

  // ships sail; arrivals found colonies, open trading posts, or fight
  for (const ship of [...s.rivalShips]) {
    const spec = rivalSpec(ship.crown);
    const r = s.rivals[ship.crown];
    const g = GRIDS[ship.map];
    if (ship.kind === 'privateer') {
      if (r.relation !== 'war') { s.rivalShips = s.rivalShips.filter((x) => x !== ship); continue; }
      const prey = s.fleets.filter((f) => f.map === ship.map).sort((a, b) => g.distance(a.hex, ship.hex) - g.distance(b.hex, ship.hex))[0];
      if (!prey) continue;
      if (g.distance(prey.hex, ship.hex) > 1) {
        const near = isWater(w[ship.map].terrain[prey.hex]) ? prey.hex : g.neighbors(prey.hex).find((h) => isWater(w[ship.map].terrain[h])) ?? prey.hex;
        ship.path = route(w, s, ship.map, ship.hex, near);
        sail(w, s, ship);
      }
      // ships in your own home ports are safe under the harbour guns
      const safe = prey.at != null && !!s.cities[prey.at];
      if (g.distance(prey.hex, ship.hex) <= 1 && !safe) seaBattle(s, prey, ship, rng, log, onFleetLost);
      continue;
    }
    sail(w, s, ship);
    if (ship.path && ship.path.length > 1) continue;
    s.rivalShips = s.rivalShips.filter((x) => x !== ship);
    if (ship.kind === 'trader') {
      const site = w[ship.map].ports.find((p) => p.hex === ship.target);
      if (!site) continue;
      const book = s.markets[site.id];
      for (const m of Object.values(book ?? {})) if (m) m.stock *= 0.6;
      if (!r.posts.includes(site.id)) {
        r.posts.push(site.id);
        if (s.fog[ship.map][site.hex] >= Fog.Charted) log('trade', `${spec.people[0].toUpperCase()}${spec.people.slice(1)} open a trading post at ${site.name}. There will be less to buy there.`);
      }
    } else if (ship.target != null && !allColonyHexes(s, ship.map).some((h) => g.distance(h, ship.target!) <= 3)) {
      const used = s.rivalColonies.map((c) => c.name);
      const free = NAMES[ship.crown].filter((n) => !used.includes(n));
      s.rivalColonies.push({ id: `rcol-${s.nextId++}`, crown: ship.crown, name: free.length ? pick(rng, free) : `${spec.name} ${s.nextId}`, map: ship.map, hex: ship.target, pop: 2, level: 'outpost', founded: s.turn, garrison: 1, seen: false });
    }
  }

  // their colonies grow, and the ones you can see are noted
  for (const c of s.rivalColonies) {
    if ((s.turn - c.founded) % 5 === 4 && c.pop < LEVELS[c.level].cap) c.pop++;
    if (c.pop >= LEVELS[c.level].cap && LEVELS[c.level].next && rng() < 0.25) { c.level = LEVELS[c.level].next!; c.garrison++; }
    if (!c.seen && s.fog[c.map][c.hex] >= Fog.Charted) {
      c.seen = true;
      const spec = rivalSpec(c.crown);
      log('discovery', `Your sailors sight ${c.name}, a colony of ${spec.name}${c.map === 'new' ? ' across the ocean' : ' on the African coast'}.`);
    }
  }
}

function fleetGuns(s: GameState, f: Fleet) {
  const guns = f.ships.reduce((t, x) => t + SHIPS[x.type].guns * (x.hull / 100), 0) * (rivalSpec(s.crown).edge.guns ?? 1);
  return guns + 1 + skill(personById(s, f.leader), 'military');
}

function seaBattle(s: GameState, f: Fleet, ship: RivalShip, rng: Rng, log: Log, onFleetLost: (f: Fleet, why: string) => void) {
  const spec = rivalSpec(ship.crown);
  const a = fleetGuns(s, f), d = ship.strength;
  if (rng() < a / (a + d)) {
    s.rivalShips = s.rivalShips.filter((x) => x !== ship);
    const prize = int(rng, 200, 700);
    s.treasury += prize;
    s.prestige += 5;
    for (const x of f.ships) x.hull = Math.max(10, x.hull - int(rng, 5, 25));
    log('peril', `A ${spec.name} privateer attacks ${f.name} and is taken. Prize money: ${prize} ducats.`);
    return;
  }
  const lost = f.ships[int(rng, 0, f.ships.length - 1)];
  f.ships = f.ships.filter((x) => x !== lost);
  for (const k of Object.keys(f.cargo) as (keyof Fleet['cargo'])[]) f.cargo[k] = Math.floor((f.cargo[k] ?? 0) / 2);
  if (!f.ships.length) { onFleetLost(f, `A ${spec.name} privateer takes the ${lost.name}, the last ship of ${f.name}.`); return; }
  f.crew = Math.max(1, f.crew - SHIPS[lost.type].crew);
  log('peril', `A ${spec.name} privateer falls on ${f.name}, takes the ${lost.name} and half the cargo.`);
}

// ---------- commands ----------

export function declareWar(s: GameState, crown: CrownId, log: Log): Result {
  const r = s.rivals[crown];
  if (!r || crown === s.crown) return fail('No such crown.');
  if (r.relation === 'war') return fail('You are already at war.');
  r.relation = 'war';
  r.warSince = s.turn;
  r.attitude = Math.min(r.attitude, -60);
  log('peril', `${me(s)} declares war on ${rivalSpec(crown).name}.`);
  return { ok: true, message: `War with ${rivalSpec(crown).name}.` };
}

export function makePeace(s: GameState, crown: CrownId): Result {
  const r = s.rivals[crown];
  if (!r || r.relation !== 'war') return fail('You are not at war with them.');
  const cost = 1000 + Math.max(0, -r.attitude) * 10;
  if (s.treasury < cost) return fail(`${rivalSpec(crown).name} asks ${cost} ducats for peace.`);
  if (s.turn - (r.warSince ?? s.turn) < 2) return fail(`${rivalSpec(crown).name} will not talk of peace so soon.`);
  s.treasury -= cost;
  r.relation = 'peace';
  r.warSince = null;
  r.attitude = Math.max(r.attitude, -30);
  s.rivalShips = s.rivalShips.filter((x) => !(x.crown === crown && x.kind === 'privateer'));
  return { ok: true, message: `Peace with ${rivalSpec(crown).name}, for ${cost} ducats.` };
}

export const rivalColonyDefence = (c: RivalColony) => c.garrison * 4 + c.pop + (c.level === 'town' ? 4 : c.level === 'city' ? 8 : 0);

/** Storm a rival colony beside the party. If it falls, it becomes yours. */
export function stormColony(_w: World, s: GameState, p: Party, colonyId: string, strength: number, rng: Rng, log: Log, ev: Ev): Result {
  const c = s.rivalColonies.find((x) => x.id === colonyId);
  if (!c) return fail('No such colony.');
  const g = GRIDS[p.map];
  if (c.map !== p.map || (c.hex !== p.hex && !g.neighbors(p.hex).includes(c.hex))) return fail('The party must stand beside the colony.');
  const r = s.rivals[c.crown];
  const spec = rivalSpec(c.crown);
  if (r.relation !== 'war') { r.relation = 'war'; r.warSince = s.turn; r.attitude = Math.min(r.attitude, -70); log('peril', `The attack on ${c.name} means war with ${spec.name}.`); }
  const d = rivalColonyDefence(c);
  const units = s.units.filter((u) => u.party === p.id);
  if (rng() < strength / (strength + d)) {
    s.rivalColonies = s.rivalColonies.filter((x) => x !== c);
    const col: Colony = {
      id: `col-${s.nextId++}`, name: c.name, map: c.map, hex: c.hex, founded: s.turn, pop: Math.max(1, Math.round(c.pop * 0.7)), level: c.level,
      stock: { food: 10 }, growth: 0, loyalty: 50, charter: false, unrest: false, last: { produced: {}, worked: [], hungry: false, discontent: false, luxuries: false },
    };
    s.colonies.push(col);
    for (const u of units) if (u.type === 'infantry') { u.party = null; u.colony = col.id; }
    s.prestige += 15;
    log('peril', `${c.name} falls to ${me(s)}. Its settlers stay on under a new flag.`);
    ev({ kind: 'people', title: `${c.name} taken`, map: c.map, hex: c.hex, text: `The colony of ${spec.name} at ${c.name} has fallen. It is yours now, with ${col.pop} of its settlers. ${spec.name} will want it back.` });
    if (!s.units.some((u) => u.party === p.id)) {
      const l = personById(s, p.leader);
      s.parties = s.parties.filter((x) => x !== p);
      if (l) { l.city = null; }
    }
    return { ok: true };
  }
  const dead = units.slice(0, Math.max(1, Math.round(units.length * 0.5)));
  s.units = s.units.filter((u) => !dead.includes(u));
  c.garrison = Math.max(1, c.garrison - (rng() < 0.5 ? 1 : 0));
  log('peril', `The assault on ${c.name} fails. ${dead.length} unit${dead.length > 1 ? 's are' : ' is'} lost.`);
  return { ok: true };
}

export function rivalScore(s: GameState, crown: CrownId) {
  const cols = s.rivalColonies.filter((c) => c.crown === crown);
  const pop = cols.reduce((t, c) => t + c.pop, 0);
  const territory = new Set(cols.flatMap((c) => GRIDS[c.map].within(c.hex, LEVELS[c.level].radius).map((h) => `${c.map}:${h}`))).size;
  const commerce = Math.floor(s.rivals[crown].revenue / 200);
  return { pop, territory, commerce, total: pop * 10 + territory * 2 + commerce, colonies: cols.length };
}

export { type Grid };
