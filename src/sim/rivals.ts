/**
 * Rival crowns. Each has a purse, a few ships and a temper. Every season it weighs what it could do (supply a
 * colony, settle, trade, build a ship, or, at war, send privateers and soldiers), does the thing it wants most if it
 * has the money and a ship, and otherwise saves for it. Ships sail out and home again on the map; colonies live on
 * what the ships bring. The crowns also quarrel among themselves, and the peoples judge each of them.
 * They still learn the ocean crossing on a schedule (`volta`).
 */
import { CROWNS, RIVAL_ECON, SHIP_NAMES_BY_CROWN, rivalSpec, rivalsOf, type CrownId, type RivalSpec } from '../data/rivals';
import { RIVAL_TRADE } from '../data/trade';
import type { GoodId } from '../data/goods';
import { sellValue } from './market';
import * as Nat from './natives';
import { difficultySpec } from '../data/difficulty';
import { SHIPS } from '../data/ships';
import { isWater } from '../data/terrain';
import { RESOURCE_IDS } from '../data/city';
import { GRIDS, type Grid } from './hex';
import { mulberry32, hashSeed, int, pick, type Rng } from './rng';
import { planRoute, stepCost } from './sailing';
import { planLand } from './land';
import { realmMods, tiedTo } from './dynasty';
import { LEVELS } from './colony';
import { personById, skill } from './court';
import { fight, casualties, recordLosses, blood, partyForce, assaultColony, rivalGarrison, type Force } from './battle';
import { isMilitary } from '../data/army';
import { Fog, seasonOf, yearOf, emptyAccount, type Stance, type Colony, type Fleet, type GameEvent, type GameState, type MapId, type Party, type RivalColony, type RivalShip, type RivalState, type RivalPlanKind, type NativeState, type NationDef, type PortDef, type World } from './types';

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
  return Object.fromEntries(CROWNS.map((r) => [r.id, {
    attitude: 10, relation: 'peace', next: r.start, revenue: 0, posts: [], warSince: null,
    treasury: RIVAL_ECON.startTreasury, hulls: RIVAL_ECON.startShips, built: RIVAL_ECON.startShips, plan: { kind: 'idle' }, toward: {}, wars: [], rivalWarSince: {}, learning: 0, volta: false,
  }])) as unknown as Record<CrownId, RivalState>;
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
    // word of what your surveyors found travels: rivals hurry to the same coasts
    if (s.finds.some((f) => f.map === map && g.distance(f.hex, h) <= 3)) score += 2 * difficultySpec(s.difficulty).aggression;
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

// ---------- ships: out with a purpose, and home again ----------

const E = RIVAL_ECON;
const aggression = (s: GameState) => difficultySpec(s.difficulty).aggression;
const Cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** What a rival colony grows for the ships home: by latitude, as the rival merchants always did. */
const colonyGood = (c: RivalColony): GoodId => { const lat = Math.abs(GRIDS[c.map].lat(c.hex)); return lat < 25 ? 'sugar' : lat < 40 ? 'tobacco' : 'furs'; };
const seen = (s: GameState, map: MapId, hex: number) => s.fog[map][hex] >= Fog.Charted;

function spawn(w: World, s: GameState, crown: CrownId, map: MapId, kind: RivalShip['kind'], target: number | null, strength = 0, from?: number) {
  const hex = from ?? (target != null && kind !== 'privateer' ? startHex(w, crown, map, target) : target ?? startHex(w, crown, map, 0));
  const names = SHIP_NAMES_BY_CROWN[crown];
  const ship: RivalShip = { id: s.nextId++, crown, map, hex, kind, target, path: null, trail: [hex], strength, name: names[s.nextId % names.length], homeward: false, cargo: null };
  if (target != null && kind !== 'privateer') ship.path = route(w, s, map, hex, target);
  if (kind !== 'privateer' && !ship.path) return null;
  s.rivalShips.push(ship);
  s.rivals[crown].hulls = Math.max(0, s.rivals[crown].hulls - 1);
  return ship;
}

/** The errand is done: turn for the home port, or for the ocean road back to Europe. */
function turnHome(w: World, s: GameState, ship: RivalShip) {
  const g = GRIDS[ship.map];
  ship.homeward = true;
  ship.target = ship.map === 'old'
    ? w.old.ports.find((p) => p.id === rivalSpec(ship.crown).home)!.hex
    : w.new.portals.reduce((b, h) => (g.distance(h, ship.hex) < g.distance(b, ship.hex) ? h : b));
  ship.path = route(w, s, ship.map, ship.hex, ship.target);
  if (!ship.path) reachHome(s, ship);
}

/** Home: the hull is free again, and whatever she carried is sold in the home port. */
function reachHome(s: GameState, ship: RivalShip) {
  const r = s.rivals[ship.crown];
  s.rivalShips = s.rivalShips.filter((x) => x !== ship);
  r.hulls++;
  if (!ship.cargo) return;
  const { good, qty } = ship.cargo;
  const m = s.markets[rivalSpec(ship.crown).home]?.[good];
  // they are merchants too: what the home market will not take at a fair price is sold on elsewhere
  const here = m ? Math.max(0, Math.min(qty, Math.round(m.ref * RIVAL_TRADE.fill - m.stock))) : 0;
  let value = m ? sellValue(m, here, 0.1) + (qty - here) * m.base * 0.6 : qty * 40;
  if (m) m.stock += here;
  value = Math.round(value * E.margin);
  r.treasury += value;
  r.revenue += value;
}

/** A rival ship is gone for good: wrecked, taken or sunk. */
function loseShip(s: GameState, ship: RivalShip) {
  s.rivalShips = s.rivalShips.filter((x) => x !== ship);
  const r = s.rivals[ship.crown];
  r.built = Math.max(0, r.built - 1);
}

// ---------- what a crown does next ----------

type Option = { kind: RivalPlanKind; u: number; cost: number; hull: boolean; run: () => boolean };

/** The ventures open to a crown this season, each with how much it wants it and what it costs. */
function options(w: World, s: GameState, spec: RivalSpec, r: RivalState, rng: Rng, log: Log): Option[] {
  const out: Option[] = [];
  const pace = spec.pace * difficultySpec(s.difficulty).rivalPace;
  const mine = s.rivalColonies.filter((c) => c.crown === spec.id);
  const atSea = s.rivalShips.filter((x) => x.crown === spec.id);
  const boards: MapId[] = r.volta ? ['old', 'new', 'new'] : ['old'];
  const home = w.old.ports.find((p) => p.id === spec.home)!;

  // a colony short of stores comes first
  const needy = mine.filter((c) => c.supply <= E.supplyLow && (c.map === 'old' || r.volta) && !atSea.some((x) => x.kind === 'supply' && x.target === c.hex && x.map === c.map));
  if (needy.length) {
    const c = [...needy].sort((a, b) => a.supply - b.supply)[0];
    out.push({ kind: 'supply', u: 3, cost: E.supply, hull: true, run: () => {
      if (!spawn(w, s, spec.id, c.map, 'supply', c.hex)) return false;
      // tools, cloth and wine for the colony are bought in the home market
      for (const [good, per] of Object.entries(RIVAL_TRADE.buys) as [GoodId, number][]) { const m = s.markets[spec.home]?.[good]; if (m) m.stock = Math.max(0, m.stock - c.pop * per * E.supplyFull); }
      return true;
    } });
  }

  // at war with you: privateers where your ships are, and soldiers for your colonies
  if (r.relation === 'war') {
    for (const map of boards.filter((m, i) => boards.indexOf(m) === i)) {
      if (!s.fleets.some((f) => f.map === map) || atSea.some((x) => x.kind === 'privateer' && x.map === map)) continue;
      out.push({ kind: 'privateer', u: 1.6 * spec.war, cost: E.privateer, hull: true, run: () => {
        const base = mine.find((c) => c.map === map);
        const at = base ? GRIDS[map].neighbors(base.hex).find((h) => isWater(w[map].terrain[h])) ?? base.hex : startHex(w, spec.id, map, s.fleets.find((f) => f.map === map)!.hex);
        return !!spawn(w, s, spec.id, map, 'privateer', at, 5 + Math.floor((s.turn - (r.warSince ?? s.turn)) / 4) + int(rng, 0, 3));
      } });
    }
    const prey = s.colonies.filter((c) => boards.includes(c.map) && mine.some((x) => x.map === c.map && GRIDS[c.map].distance(x.hex, c.hex) <= E.raidReach)
      && !atSea.some((x) => (x.kind === 'raid' || x.kind === 'army') && x.map === c.map && x.target === c.hex));
    if (prey.length) {
      out.push({ kind: 'raid', u: 1.3 * spec.war * aggression(s), cost: E.raid, hull: true, run: () => {
        const c = pick(rng, prey);
        const base = mine.filter((x) => x.map === c.map).sort((a, b) => GRIDS[c.map].distance(a.hex, c.hex) - GRIDS[c.map].distance(b.hex, c.hex))[0];
        const strength = Math.min(6, 2 + Math.floor((s.turn - (r.warSince ?? s.turn)) / 8));
        // close enough to walk: an army marches overland, where your own soldiers can meet it
        const road = base && GRIDS[c.map].distance(base.hex, c.hex) <= E.marchReach ? planLand(GRIDS[c.map], w[c.map], known(c.map), base.hex, c.hex, 99, 99) : null;
        if (base && road) {
          const names = SHIP_NAMES_BY_CROWN[spec.id];
          s.rivalShips.push({ id: s.nextId++, crown: spec.id, map: c.map, hex: base.hex, kind: 'army', target: c.hex, path: road.path, trail: [base.hex], strength, name: `the companies of ${names[s.nextId % names.length]}`, homeward: false, cargo: null });
          if (seen(s, c.map, base.hex)) log('peril', `Soldiers of ${spec.name} march out of ${base.name}, toward ${c.name}.`);
          return true;
        }
        const from = base ? GRIDS[c.map].neighbors(base.hex).find((h) => isWater(w[c.map].terrain[h])) : undefined;
        const ship = spawn(w, s, spec.id, c.map, 'raid', c.hex, strength, from);
        if (ship && seen(s, ship.map, ship.hex)) log('peril', `Soldiers of ${spec.name} have embarked${base ? ` at ${base.name}` : ''}. They are making for ${c.name}.`);
        return !!ship;
      } });
    }
  }

  // a new colony
  out.push({ kind: 'settle', u: 2 * (1 - spec.trade) * (mine.length < 3 ? 1.5 : 1), cost: Math.round(E.settlePerPace * pace), hull: true, run: () => {
    const map = pick(rng, boards);
    const site = pickSite(w, s, spec.id, map, rng);
    if (site == null || !spawn(w, s, spec.id, map, 'settlers', site)) return false;
    log('court', `Word from ${home.name}: ${spec.people} have sent settlers ${map === 'new' ? 'across the ocean' : 'down the African coast'}.`);
    return true;
  } });

  // a trading post, sooner where you already profit
  out.push({ kind: 'trade', u: 2 * spec.trade, cost: Math.round(E.tradePerPace * pace), hull: true, run: () => {
    const map = pick(rng, boards);
    const sites = w[map].ports.filter((p) => p.kind === 'native' && !r.posts.includes(p.id));
    if (!sites.length) return false;
    const weight = (p: PortDef) => 1 + (s.discovered.includes(p.id) ? aggression(s) : 0) + (s.natives[Nat.nationOfSite(w, p.id)?.id ?? '']?.post ? aggression(s) : 0);
    let roll = rng() * sites.reduce((t, p) => t + weight(p), 0);
    const site = sites.find((p) => (roll -= weight(p)) <= 0) ?? sites[0];
    return !!spawn(w, s, spec.id, map, 'trader', site.hex);
  } });

  // another hull, when every ship is out
  if (r.hulls === 0 && r.built < Math.min(E.maxShips, E.baseShips + Math.floor(mine.length / 2))) {
    out.push({ kind: 'build', u: 1.1, cost: E.shipCost, hull: false, run: () => { r.built++; r.hulls++; return true; } });
  }
  return out;
}

/** Choose by want, with a little chance in it: do it if the money and a ship are there, else save for it. */
function decide(w: World, s: GameState, spec: RivalSpec, r: RivalState, rng: Rng, log: Log) {
  if (s.turn < r.next) return;
  const opts = options(w, s, spec, r, rng, log).map((o) => ({ ...o, u: o.u * (0.8 + 0.4 * rng()) })).sort((a, b) => b.u - a.u);
  for (const o of opts) {
    if (o.hull && r.hulls === 0) {
      // nothing to sail in: a new hull if it can be afforded, otherwise wait for one to come home
      const build = opts.find((x) => x.kind === 'build');
      if (build && r.treasury >= build.cost) { r.treasury -= build.cost; build.run(); r.plan = { kind: 'build' }; r.next = s.turn + 1; }
      else r.plan = { kind: 'saving', for: build ? 'build' : o.kind };
      return;
    }
    if (r.treasury < o.cost) { r.plan = { kind: 'saving', for: o.kind }; return; }
    if (!o.run()) continue;
    r.treasury -= o.cost;
    r.plan = { kind: o.kind };
    r.next = s.turn + 1;
    return;
  }
  r.plan = { kind: 'idle' };
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
    // the purse: what the realm spares for the sea, the posts' trade, and the cost of keeping ships
    const posts = r.posts.length * E.perPost;
    r.revenue += posts;
    r.treasury += E.homeIncome + posts - r.built * E.shipUpkeep;
    // their pilots study the ocean road, while there is money to pay them
    if (!r.volta && r.treasury >= E.study) {
      r.treasury -= E.study;
      r.learning++;
      if (r.learning >= spec.volta * difficultySpec(s.difficulty).rivalPace) {
        r.volta = true;
        log('court', `Word from ${w.old.ports.find((p) => p.id === spec.home)?.name}: the pilots of ${spec.name} have learned to cross the Mar Océano and come home.`);
      }
    }

    const before = s.rivalShips.length;
    decide(w, s, spec, r, rng, log);
    // the first sail of any rival is news: the race has begun
    const first = s.rivalShips.length > before ? s.rivalShips[s.rivalShips.length - 1] : undefined;
    if (first && s.told.first_rival == null) {
      s.told.first_rival = s.turn;
      const home = w.old.ports.find((p) => p.id === spec.home);
      ev({ kind: 'people', title: 'Rival sails', map: first.map, hex: first.hex,
        text: `Word from ${home?.name ?? 'abroad'}: ${spec.people} have sent ${first.kind === 'trader' ? 'a ship to trade with the peoples of the coast' : 'a ship with settlers to plant a colony'}. You are not the only crown looking beyond the known world; the best coasts will go to whoever reaches them first.` });
    }

    // relations drift, and sour with neighbours too close
    const rest = 10 + realmMods(s).regard + (tiedTo(s, spec.id) ? 20 : 0);
    r.attitude += r.attitude > rest ? -0.5 : r.attitude < rest ? 0.5 : 0;
    for (const c of s.colonies) {
      if (s.rivalColonies.some((x) => x.crown === spec.id && x.map === c.map && GRIDS[c.map].distance(x.hex, c.hex) <= 6)) r.attitude -= 3;
      if (spec.id === 'portugal' && s.turn > 6 && c.map === 'old') r.attitude -= 2;
      if (spec.id === 'spain' && s.crown === 'portugal' && s.turn > 6 && c.map === 'new') r.attitude -= 1;
    }
    // the enemy of their enemy
    for (const foe of r.wars) if (s.rivals[foe].relation === 'war') r.attitude += 0.5;
    r.attitude = Math.max(-100, Math.min(100, r.attitude));
    if (r.relation === 'peace' && r.attitude < -50 && !tiedTo(s, spec.id) && rng() < 0.15 * spec.war * aggression(s)) {
      r.relation = 'war';
      r.warSince = s.turn;
      log('peril', `${spec.name} declares war on ${me(s)}.`);
      ev({ kind: 'lost', title: `War with ${spec.name}`, map: 'old', hex: w.old.ports.find((p) => p.id === spec.home)!.hex,
        text: `${spec.name} has declared war. Their privateers will hunt your ships, and their soldiers will sail against your colonies: watch for their ships. You can make peace at court, or carry the war to their colonies.` });
    }
  }

  crownsAmongThemselves(s, rng, log);

  // ships sail; arrivals found colonies, open trading posts, land soldiers, or come home
  for (const ship of [...s.rivalShips]) {
    const spec = rivalSpec(ship.crown);
    const r = s.rivals[ship.crown];
    const g = GRIDS[ship.map];
    if (ship.kind === 'privateer' && !ship.homeward) {
      if (r.relation !== 'war') { turnHome(w, s, ship); continue; }
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
    if (ship.kind === 'army') {
      // two hexes a season on foot; at the walls, they assault, and what is left goes home
      ship.trail = [ship.hex];
      for (let k = 0; k < E.marchPace && ship.path && ship.path.length > 1; k++) { ship.path.shift(); ship.hex = ship.path[0]; ship.trail.push(ship.hex); }
      if (ship.path && ship.path.length > 1 && r.relation === 'war') continue;
      s.rivalShips = s.rivalShips.filter((x) => x !== ship);
      const c = s.colonies.find((x) => x.map === ship.map && x.hex === ship.target);
      if (c && r.relation === 'war') landAt(w, s, ship, c, rng, log);
      continue;
    }
    sail(w, s, ship);
    // the sea takes its share of every crown's ships
    if (rng() < E.wreck * (ship.map === 'new' ? 2 : 1)) {
      if (seen(s, ship.map, ship.hex)) log('peril', `The ${ship.name}, a ship of ${spec.name}, is lost in a storm.`);
      loseShip(s, ship);
      continue;
    }
    if (ship.path && ship.path.length > 1) continue;
    if (ship.homeward) { reachHome(s, ship); continue; }
    if (ship.kind === 'trader') {
      const site = w[ship.map].ports.find((p) => p.hex === ship.target);
      if (site) {
        const book = s.markets[site.id];
        for (const m of Object.values(book ?? {})) if (m) m.stock *= 0.6;
        if (!r.posts.includes(site.id)) {
          r.posts.push(site.id);
          const n = Nat.nationOfSite(w, site.id), st = n ? s.natives[n.id] : undefined;
          if (st) st.crowns[ship.crown] = Math.min(100, (st.crowns[ship.crown] ?? 0) + 20);
          if (seen(s, ship.map, site.hex)) log('trade', `${Cap(spec.people)} open a trading post at ${site.name}. There will be less to buy there.`);
        }
      }
    } else if (ship.kind === 'settlers') {
      if (ship.target != null && !allColonyHexes(s, ship.map).some((h) => g.distance(h, ship.target!) <= 3)) {
        const used = s.rivalColonies.map((c) => c.name);
        const free = NAMES[ship.crown].filter((n) => !used.includes(n));
        s.rivalColonies.push({ id: `rcol-${s.nextId++}`, crown: ship.crown, name: free.length ? pick(rng, free) : `${spec.name} ${s.nextId}`, map: ship.map, hex: ship.target, pop: 2, level: 'outpost', founded: s.turn, garrison: 1, seen: false, supply: E.supplyFull, stock: 0, growth: 0 });
      }
    } else if (ship.kind === 'supply') {
      const c = s.rivalColonies.find((x) => x.crown === ship.crown && x.map === ship.map && x.hex === ship.target);
      if (c) {
        c.supply = E.supplyFull;
        if (c.pop < LEVELS[c.level].cap) c.pop++;
        // the colony's produce goes home in the same ship
        const qty = Math.round(c.stock);
        if (qty > 0) { ship.cargo = { good: colonyGood(c), qty }; c.stock -= qty; }
      }
    } else if (ship.kind === 'raid') {
      const c = s.colonies.find((x) => x.map === ship.map && x.hex === ship.target);
      if (c && r.relation === 'war') landAt(w, s, ship, c, rng, log);
    }
    turnHome(w, s, ship);
  }

  // their colonies live on what the ships bring, as yours do
  for (const c of [...s.rivalColonies]) {
    const spec = rivalSpec(c.crown);
    c.supply = Math.max(0, c.supply - 1);
    const supplied = c.supply > 0;
    c.stock += c.pop * RIVAL_TRADE.perSettler * (supplied ? 1 : E.wantWork);
    c.growth += supplied ? E.births : -E.want;
    if (c.growth >= 1) { c.growth = c.pop < LEVELS[c.level].cap ? c.growth - 1 : 1; if (c.pop < LEVELS[c.level].cap) c.pop++; }
    if (c.growth <= -1) { c.growth += 1; if (c.pop > 1) c.pop--; }
    if (!supplied && c.pop <= 1 && rng() < E.abandon) {
      s.rivalColonies = s.rivalColonies.filter((x) => x !== c);
      if (c.seen) log('discovery', `${c.name}, the colony of ${spec.name}, lies abandoned: no ship came, and the last settlers are gone.`);
      continue;
    }
    if (c.pop >= LEVELS[c.level].cap && LEVELS[c.level].next && supplied && rng() < 0.25) { c.level = LEVELS[c.level].next!; c.garrison++; }
    if (!c.seen && seen(s, c.map, c.hex)) {
      c.seen = true;
      log('discovery', `Your sailors sight ${c.name}, a colony of ${spec.name}${c.map === 'new' ? ' across the ocean' : ' on the African coast'}.`);
    }
  }

  crownsAndPeoples(w, s, rng, log);
}

/** Soldiers from a ship or a march fall on one of your colonies. */
function landAt(w: World, s: GameState, ship: RivalShip, c: Colony, rng: Rng, log: Log) {
  const spec = rivalSpec(ship.crown);
  const out = assaultColony(s, c, { name: spec.name, units: rivalGarrison(ship.strength, 0, yearOf(s.turn)), crown: spec.id }, w[c.map].terrain[c.hex], rng);
  const how = ship.kind === 'army' ? 'march on' : 'land at';
  if (out.win) {
    if (c.pop > 1) c.pop--;
    for (const k of Object.keys(c.stock) as (keyof Colony['stock'])[]) c.stock[k] = Math.floor((c.stock[k] ?? 0) / 2);
    log('peril', `${Cap(spec.people)} ${how} ${c.name}: a colonist is killed and the warehouse plundered.`);
  } else log('peril', `${Cap(spec.people)} ${how} ${c.name}, and are beaten off.`);
}

/** The rival crown most likely to tempt one of your courtiers away: the one that likes you least. */
export function suitor(s: GameState, rng: Rng): CrownId | undefined {
  const rs = rivalsOf(s.crown);
  const worst = [...rs].sort((a, b) => s.rivals[a.id].attitude - s.rivals[b.id].attitude)[0];
  return rng() < 0.6 ? worst?.id : pick(rng, rs).id;
}

/** How hard a rival ship is to take: privateers and troopships fight, the rest mostly run. */
export const shipStrength = (x: RivalShip) => (x.kind === 'privateer' ? x.strength : x.kind === 'raid' ? x.strength + 3 : 2);

/** One of your fleets falls on a rival ship beside it. Attacking a crown you are at peace with is war. */
export function intercept(w: World, s: GameState, f: Fleet, shipId: number, rng: Rng, log: Log, onFleetLost: (f: Fleet, why: string) => void): Result {
  const ship = s.rivalShips.find((x) => x.id === shipId);
  if (!ship || ship.kind === 'army') return fail('No such ship.');
  if (ship.map !== f.map || GRIDS[f.map].distance(f.hex, ship.hex) > 1) return fail('The fleet must be beside her.');
  const home = w.old.ports.find((p) => p.id === rivalSpec(ship.crown).home);
  if (ship.map === 'old' && home && ship.hex === home.hex) return fail('She lies under the guns of her home port.');
  const r = s.rivals[ship.crown], spec = rivalSpec(ship.crown);
  if (r.relation !== 'war') { r.relation = 'war'; r.warSince = s.turn; r.attitude = Math.min(r.attitude, -70); log('peril', `The attack on the ${ship.name} means war with ${spec.name}.`); }
  const a = fleetGuns(s, f), d = shipStrength(ship);
  if (rng() < a / (a + d)) {
    const prize = int(rng, 150, 500) + (ship.cargo ? ship.cargo.qty * 15 : 0) + (ship.kind === 'settlers' || ship.kind === 'supply' ? 200 : 0);
    loseShip(s, ship);
    s.treasury += prize;
    s.prestige += ship.kind === 'raid' ? 8 : 4;
    for (const x of f.ships) x.hull = Math.max(10, x.hull - int(rng, 3, 18));
    const what = ship.kind === 'raid' ? ', with the soldiers she carried' : ship.kind === 'settlers' ? ', with her settlers' : ship.kind === 'supply' ? ', with the stores for their colony' : '';
    log('peril', `${f.name} takes the ${ship.name} of ${spec.name}${what}. Prize money: ${prize} ducats.`);
    return { ok: true, message: `The ${ship.name} strikes her colours. +${prize} ducats.` };
  }
  const lost = f.ships[int(rng, 0, f.ships.length - 1)];
  f.ships = f.ships.filter((x) => x !== lost);
  if (!f.ships.length) { onFleetLost(f, `${f.name} attacks the ${ship.name} of ${spec.name} and is lost.`); return { ok: true, message: 'The fight goes against you. The fleet is lost.' }; }
  f.crew = Math.max(1, f.crew - SHIPS[lost.type].crew);
  log('peril', `${f.name} attacks the ${ship.name} of ${spec.name} and is beaten off, losing the ${lost.name}.`);
  return { ok: true, message: `Beaten off: the ${lost.name} is lost.` };
}

/** One of your parties meets a rival army in the field, before it reaches a colony. */
export function engage(w: World, s: GameState, p: Party, shipId: number, rng: Rng, log: Log, ev: Ev, stance: Stance = 'assault'): Result {
  const army = s.rivalShips.find((x) => x.id === shipId && x.kind === 'army');
  if (!army) return fail('No such army.');
  if (army.map !== p.map || GRIDS[p.map].distance(p.hex, army.hex) > 1) return fail('The party must stand beside them.');
  const mine = partyForce(s, p);
  if (!mine.units.length) return fail('The party has no one who can fight.');
  const spec = rivalSpec(army.crown);
  const theirs: Force = { name: `Soldiers of ${spec.name}`, units: rivalGarrison(army.strength, 0, yearOf(s.turn)), crown: army.crown };
  const out = fight(rng, mine, theirs, w[p.map].terrain[army.hex], stance);
  const units = s.units.filter((u) => u.party === p.id);
  const dead = casualties(rng, units, out.atkLoss);
  s.units = s.units.filter((u) => !dead.includes(u));
  recordLosses(out.report.attacker, dead);
  const theirDead = casualties(rng, theirs.units, out.defLoss);
  recordLosses(out.report.defender, theirDead);
  const who = personById(s, p.leader)?.name ?? p.name;
  let text: string;
  if (out.attackerWon) {
    s.rivalShips = s.rivalShips.filter((x) => x !== army);
    blood(s.units.filter((u) => u.party === p.id));
    s.prestige += 6;
    text = `${who} meets the soldiers of ${spec.name} on the march and breaks them. They will not reach the colony.`;
  } else {
    army.strength = Math.max(1, army.strength - theirDead.length);
    text = `${who} cannot stop the soldiers of ${spec.name}.${dead.length ? ` ${dead.length} compan${dead.length > 1 ? 'ies are' : 'y is'} lost.` : ''} They march on.`;
  }
  if (!s.units.some((u) => u.party === p.id)) s.parties = s.parties.filter((x) => x !== p);
  log('peril', text);
  ev({ kind: 'battle', title: out.attackerWon ? 'Victory in the field' : 'Beaten in the field', map: p.map, hex: army.hex, text, battle: out.report });
  return { ok: true };
}

// ---------- the crowns among themselves ----------

const pairs = (s: GameState) => { const rs = rivalsOf(s.crown); return rs.flatMap((a, i) => rs.slice(i + 1).map((b) => [a, b] as const)); };

/** The crowns you do not play quarrel over the same coasts, go to war and make peace without you. */
function crownsAmongThemselves(s: GameState, rng: Rng, log: Log) {
  for (const [a, b] of pairs(s)) {
    const ra = s.rivals[a.id], rb = s.rivals[b.id];
    const ca = s.rivalColonies.filter((c) => c.crown === a.id), cb = s.rivalColonies.filter((c) => c.crown === b.id);
    const close = ca.filter((x) => cb.some((y) => y.map === x.map && GRIDS[x.map].distance(x.hex, y.hex) <= 6)).length;
    let t = ra.toward[b.id] ?? 0;
    const war = ra.wars.includes(b.id);
    // old grudges come and go; neighbours overseas make them worse
    t += (rng() - 0.52) * 2 - Math.min(0.6, close * 0.2);
    if (!war && t < -40 && rng() < 0.04 * (a.war + b.war) / 2) {
      ra.wars.push(b.id); rb.wars.push(a.id);
      ra.toward[b.id] = rb.toward[a.id] = Math.min(t, -60);
      ra.rivalWarSince[b.id] = rb.rivalWarSince[a.id] = s.turn;
      log('court', `${Cap(a.name)} and ${b.name} are at war.`);
      continue;
    }
    if (war) {
      ra.treasury -= E.warCost; rb.treasury -= E.warCost;
      if (rng() < 0.15) {
        // one side falls on a colony of the other
        const [att, def, theirs] = rng() < 0.5 ? [a, b, cb] as const : [b, a, ca] as const;
        if (theirs.length && s.rivals[att.id].treasury >= 0) {
          const c = pick(rng, theirs);
          if (rng() < 0.45) {
            c.pop--;
            c.supply = Math.max(0, c.supply - 3);
            if (c.pop <= 0) {
              s.rivalColonies = s.rivalColonies.filter((x) => x !== c);
              if (c.seen) log('peril', `${Cap(att.people)} burn ${c.name}, the colony of ${def.name}.`);
            } else if (c.seen) log('peril', `${Cap(att.people)} raid ${c.name}, the colony of ${def.name}.`);
          }
        }
      }
      if (rng() < 0.04) { const loser = s.rivals[rng() < 0.5 ? a.id : b.id]; if (loser.built > 1 && loser.hulls > 0) { loser.built--; loser.hulls--; } }
      const since = s.turn - (ra.rivalWarSince[b.id] ?? s.turn);
      if ((since >= 8 && rng() < 0.12) || ra.treasury < -E.warCost * 10 || rb.treasury < -E.warCost * 10) {
        ra.wars = ra.wars.filter((x) => x !== b.id); rb.wars = rb.wars.filter((x) => x !== a.id);
        delete ra.rivalWarSince[b.id]; delete rb.rivalWarSince[a.id];
        // a peace is kept for a while
        t = 25;
        log('court', `${Cap(a.name)} and ${b.name} make peace.`);
      }
    }
    ra.toward[b.id] = rb.toward[a.id] = Math.max(-100, Math.min(60, t));
  }
}

// ---------- the crowns and the peoples ----------

/** The crown a people counts as a friend, if any. */
export function friendOf(st: NativeState): CrownId | undefined {
  const best = (Object.entries(st.crowns) as [CrownId, number][]).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= E.peopleFriend ? best[0] : undefined;
}

const lands = new WeakMap<NationDef, Set<number>>();
/** A people's land never changes: work it out once. */
function landOf(n: NationDef) { let l = lands.get(n); if (!l) { l = new Set(Nat.territory(n)); lands.set(n, l); } return l; }

/** Peoples judge every crown, not only yours: posts win them, settlers on their land anger them, and they raid. */
function crownsAndPeoples(w: World, s: GameState, rng: Rng, log: Log) {
  for (const n of Nat.allNations(w)) {
    const st = s.natives[n.id];
    if (!st) continue;
    const on = s.rivalColonies.filter((c) => c.map === n.map);
    const land = on.length ? landOf(n) : null;
    for (const spec of rivalsOf(s.crown)) {
      const r = s.rivals[spec.id];
      let a = st.crowns[spec.id] ?? 0;
      const post = r.posts.includes(n.site);
      const cols = land ? on.filter((c) => c.crown === spec.id && GRIDS[c.map].within(c.hex, 2).some((h) => land.has(h))) : [];
      if (!post && !cols.length && a === 0) continue;
      a += a > 0 ? -0.3 : a < 0 ? 0.3 : 0;
      if (post) a += 1;
      a -= 1.5 * cols.length;
      // angry enough, and strong enough: they fall on the settlers
      if (a <= E.peopleAngry && cols.length && st.warriors >= 4 && !st.siege && st.relation !== 'subject' && rng() < 0.15) {
        const c = pick(rng, cols);
        const out = fight(rng, Nat.nativeForce(n, st, 0.5), rivalForce(s, c), w[c.map].terrain[c.hex], 'assault');
        st.warriors = Math.max(1, Math.round(st.warriors - st.warriors * 0.5 * out.atkLoss));
        a += 10;
        if (out.attackerWon) {
          c.pop--;
          c.supply = Math.max(0, c.supply - 3);
          if (c.pop <= 0) {
            s.rivalColonies = s.rivalColonies.filter((x) => x !== c);
            if (c.seen || st.met) log('peril', `The ${n.people} burn ${c.name}, the colony of ${spec.name} on their land.`);
          } else if (c.seen) log('peril', `The ${n.people} raid ${c.name}, the colony of ${spec.name}.`);
        }
      }
      st.crowns[spec.id] = Math.max(-100, Math.min(100, a));
    }
    // their friends' enemies are not welcome
    const friend = friendOf(st);
    if (friend && st.met && s.rivals[friend].relation === 'war' && st.relation !== 'subject') {
      Nat.remember(s, st, `Their friends ${rivalSpec(friend).people} speak against you`, -1);
      s.rivals[friend].revenue += 10;
    }
  }
}

/** What a crown is about, in a few words, for the court. */
export function rivalDoing(s: GameState, crown: CrownId): string {
  const r = s.rivals[crown];
  const WANT: Record<RivalPlanKind, string> = { idle: '', settle: 'a new colony', trade: 'a trading voyage', supply: 'a supply convoy', build: 'a new ship', saving: '', privateer: 'privateers', raid: 'a landing force' };
  const AT_SEA: Record<RivalShip['kind'], string> = { settlers: 'settlers at sea', trader: 'a trading voyage under way', supply: 'a convoy to its colonies', privateer: 'privateers hunting', raid: 'soldiers at sea', army: 'soldiers on the march' };
  const out = [...new Set(s.rivalShips.filter((x) => x.crown === crown && !x.homeward).map((x) => AT_SEA[x.kind]))];
  if (s.rivalShips.some((x) => x.crown === crown && x.homeward)) out.push('ships homeward bound');
  if (r.plan.kind === 'saving' && r.plan.for) out.push(`saving for ${WANT[r.plan.for]}`);
  return out.length ? Cap(out.join('; ')) : 'Ships in port';
}

function fleetGuns(s: GameState, f: Fleet) {
  const guns = f.ships.reduce((t, x) => t + SHIPS[x.type].guns * (x.hull / 100), 0) * (rivalSpec(s.crown).edge.guns ?? 1);
  return guns + 1 + skill(personById(s, f.leader), 'military');
}

function seaBattle(s: GameState, f: Fleet, ship: RivalShip, rng: Rng, log: Log, onFleetLost: (f: Fleet, why: string) => void) {
  const spec = rivalSpec(ship.crown);
  const a = fleetGuns(s, f), d = ship.strength;
  if (rng() < a / (a + d)) {
    loseShip(s, ship);
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
  // their privateers and soldiers are called home
  const recalled = s.rivalShips.filter((x) => x.crown === crown && (x.kind === 'privateer' || x.kind === 'raid') && !x.homeward);
  s.rivalShips = s.rivalShips.filter((x) => !recalled.includes(x));
  r.hulls += recalled.length;
  return { ok: true, message: `Peace with ${rivalSpec(crown).name}, for ${cost} ducats.` };
}

/** A rival colony's defenders: its garrison companies, its settlers, and walls for a town or city. */
export function rivalForce(s: GameState, c: RivalColony): Force {
  return { name: c.name, units: rivalGarrison(c.garrison, c.pop, yearOf(s.turn)), walls: c.level === 'town' ? 1 : c.level === 'city' ? 2 : 0, crown: c.crown };
}

/** Storm a rival colony beside the party. If it falls, it becomes yours. */
export function stormColony(w: World, s: GameState, p: Party, colonyId: string, rng: Rng, log: Log, ev: Ev, stance: Stance = 'assault'): Result {
  const c = s.rivalColonies.find((x) => x.id === colonyId);
  if (!c) return fail('No such colony.');
  const g = GRIDS[p.map];
  if (c.map !== p.map || (c.hex !== p.hex && !g.neighbors(p.hex).includes(c.hex))) return fail('The party must stand beside the colony.');
  const mine = partyForce(s, p);
  if (!mine.units.length) return fail('The party has no one who can fight.');
  const r = s.rivals[c.crown];
  const spec = rivalSpec(c.crown);
  if (r.relation !== 'war') { r.relation = 'war'; r.warSince = s.turn; r.attitude = Math.min(r.attitude, -70); log('peril', `The attack on ${c.name} means war with ${spec.name}.`); }
  const theirs = rivalForce(s, c);
  const out = fight(rng, mine, theirs, w[c.map].terrain[c.hex], stance);
  const units = s.units.filter((u) => u.party === p.id);
  const dead = casualties(rng, units, out.atkLoss);
  s.units = s.units.filter((u) => !dead.includes(u));
  recordLosses(out.report.attacker, dead);
  const theirDead = casualties(rng, theirs.units, out.defLoss);
  recordLosses(out.report.defender, theirDead);
  const who = personById(s, p.leader)?.name ?? p.name;
  if (out.attackerWon) {
    s.rivalColonies = s.rivalColonies.filter((x) => x !== c);
    const settlers = Math.max(1, c.pop - theirDead.filter((u) => u.type === 'colonist').length);
    const col: Colony = {
      id: `col-${s.nextId++}`, name: c.name, map: c.map, hex: c.hex, founded: s.turn, pop: Math.max(1, Math.round(settlers * 0.8)), level: c.level,
      stock: { food: 10 }, growth: 0, loyalty: 50, charter: false, unrest: false, newcomers: 0, walls: theirs.walls ?? 0, last: emptyAccount(),
    };
    s.colonies.push(col);
    const survivors = s.units.filter((u) => u.party === p.id);
    blood(survivors);
    for (const u of survivors) if (isMilitary(u.type)) { u.party = null; u.colony = col.id; }
    s.prestige += 15;
    const text = `${who} storms ${c.name}. The colony of ${spec.name} is yours now, with ${col.pop} of its settlers, and the soldiers stay on as its garrison. ${spec.name} will want it back.`;
    log('peril', text);
    ev({ kind: 'battle', title: `${c.name} taken`, map: c.map, hex: c.hex, text, battle: out.report });
    if (!s.units.some((u) => u.party === p.id)) {
      const l = personById(s, p.leader);
      s.parties = s.parties.filter((x) => x !== p);
      if (l) { l.city = null; }
    }
    return { ok: true };
  }
  c.garrison = Math.max(1, c.garrison - theirDead.filter((u) => u.type !== 'colonist').length);
  const text = `The assault on ${c.name} fails.${dead.length ? ` ${dead.length} compan${dead.length > 1 ? 'ies are' : 'y is'} lost.` : ''}`;
  log('peril', text);
  ev({ kind: 'battle', title: `Beaten back at ${c.name}`, map: c.map, hex: c.hex, text, battle: out.report });
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
