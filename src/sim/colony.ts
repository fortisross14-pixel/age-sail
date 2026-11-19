/** Colonies: founding them, working the land around them, feeding and clothing the settlers, growing. */
import { GOODS, GOOD_INFO, NEEDS, LUXURIES, LUXURY_NEED, type GoodId } from '../data/goods';
import { EUROPEAN_PORTS } from '../data/europe';
import { RESOURCE_IDS } from '../data/city';
import { T, isWater } from '../data/terrain';
import { GRIDS } from './hex';
import { mulberry32, hashSeed, pick } from './rng';
import { personById, skill } from './court';
import type { Colony, ColonyLevel, Fleet, GameState, MapId, Party, PortDef, World } from './types';
import * as Nat from './natives';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const LEVELS: Record<ColonyLevel, { name: string; radius: number; cap: number; next: ColonyLevel | null; needs: Partial<Record<GoodId, number>>; pop: number }> = {
  outpost: { name: 'Outpost', radius: 1, cap: 4, next: 'town', needs: { timber: 60, tools: 30, stone: 20 }, pop: 4 },
  town: { name: 'Town', radius: 2, cap: 10, next: 'city', needs: { timber: 120, tools: 60, stone: 100 }, pop: 10 },
  city: { name: 'City', radius: 2, cap: 24, next: null, needs: {}, pop: 0 },
};
/** Materials to found an outpost (the founder's construction skill trims them). */
export const FOUNDING: Partial<Record<GoodId, number>> = { timber: 30, tools: 20 };
export const GROWTH_STEP = 8;

const NAMES = ['San Miguel', 'Santa Cruz', 'Nueva Sevilla', 'Villa Rica', 'San Juan', 'Santa Fe', 'Puerto Real', 'Nueva Cádiz', 'San Mateo',
  'Santiago', 'La Navidad', 'Villa Hermosa', 'San Lorenzo', 'Santa Elena', 'Nombre de Dios', 'San Felipe', 'La Concepción', 'Santa Marta'];

export const colonyById = (s: GameState, id: string | null | undefined) => (id ? s.colonies.find((c) => c.id === id) : undefined);
export const colonyAt = (s: GameState, map: MapId, hex: number) => s.colonies.find((c) => c.map === map && c.hex === hex);

/** A colony seen as a port, so fleets can dock there. */
export function colonyPort(c: Colony): PortDef {
  return { id: c.id, name: c.name, map: c.map, hex: c.hex, kind: 'colony', blurb: `Your ${LEVELS[c.level].name.toLowerCase()} of ${c.pop} colonist${c.pop > 1 ? 's' : ''}.` };
}

/** What a worker could produce on a hex, by terrain, latitude and resource. */
export function tileOptions(world: World, map: MapId, hex: number): { good: GoodId; amount: number }[] {
  const m = world[map];
  const g = GRIDS[map];
  const t = m.terrain[hex] as T;
  const lat = Math.abs(g.lat(hex));
  const res = m.resource[hex] ? RESOURCE_IDS[m.resource[hex] - 1] : null;
  const out: { good: GoodId; amount: number }[] = [];
  const add = (good: GoodId, amount: number) => {
    const o = out.find((x) => x.good === good);
    if (o) o.amount += amount; else out.push({ good, amount });
  };
  if (isWater(t)) { if (t === T.Shallows) add('food', 2); return out; }
  switch (t) {
    case T.Plains: add('food', 3); break;
    case T.Savanna: add('food', 2); break;
    case T.Forest: add('food', 1); add('timber', 2); break;
    case T.Jungle: add('food', 1); add(map === 'new' ? 'cacao' : 'spices', 1); break;
    case T.Taiga: add('food', 1); add('furs', 1); add('timber', 2); break;
    case T.Tundra: add('food', 1); break;
    case T.Marsh: add('food', 1); break;
    case T.Hills: add('food', 1); add('stone', 2); break;
    case T.Mountains: add('stone', 2); break;
    case T.Desert: break;
  }
  if (t === T.Plains || t === T.Savanna) add(lat < 25 ? 'sugar' : lat < 40 ? 'tobacco' : 'food', 2);
  if (res === 'fertile') { add('food', 2); if (lat < 40) add(lat < 25 ? 'sugar' : 'tobacco', 1); }
  if (res === 'timber') add('timber', 2);
  if (res === 'furs') add('furs', 2);
  if (res === 'dyes') add('dyes', 2);
  if (res === 'spices') add('spices', 2);
  if (res === 'gold') add('gold', 1);
  if (res === 'silver') add('silver', 2);
  return out;
}

const VALUE: Partial<Record<GoodId, number>> = Object.fromEntries(
  GOODS.map((g) => [g, EUROPEAN_PORTS[0].market[g]?.[0] ?? 20]),
) as Partial<Record<GoodId, number>>;

export const colonyRadius = (c: Colony) => LEVELS[c.level].radius;
/** Hexes a colony claims: its territory for the score. */
export const territoryOf = (c: Colony) => GRIDS[c.map].within(c.hex, colonyRadius(c));

/**
 * Put the colonists to work: enough on food to feed everyone, the rest on whatever is worth most in Europe
 * (and timber or stone when the colony is short of them for its next level).
 */
export function workPlan(world: World, s: GameState, c: Colony) {
  const g = GRIDS[c.map];
  const taken = new Set<number>();
  for (const o of s.colonies) if (o !== c) for (const h of territoryOf(o)) taken.add(h);
  const tiles = territoryOf(c).filter((h) => h !== c.hex && !taken.has(h)).map((h) => ({ h, opts: tileOptions(world, c.map, h) })).filter((x) => x.opts.length);
  const worked: { hex: number; good: GoodId; amount: number }[] = [];
  let food = 2; // the colony's own fields
  const used = new Set<number>();
  // feed everyone first
  while (worked.length < c.pop && food < c.pop * NEEDS.food) {
    let best: { h: number; amount: number } | null = null;
    for (const t of tiles) {
      if (used.has(t.h)) continue;
      const f = t.opts.find((o) => o.good === 'food')?.amount ?? 0;
      if (f > 0 && (!best || f > best.amount)) best = { h: t.h, amount: f };
    }
    if (!best) break;
    used.add(best.h);
    worked.push({ hex: best.h, good: 'food', amount: best.amount });
    food += best.amount;
  }
  // then for the most valuable goods; building materials count double while the colony needs them
  const next = LEVELS[c.level].next ? LEVELS[c.level].needs : {};
  while (worked.length < c.pop) {
    let best: { h: number; good: GoodId; amount: number; v: number } | null = null;
    for (const t of tiles) {
      if (used.has(t.h)) continue;
      for (const o of t.opts) {
        const want = next[o.good] ? ((c.stock[o.good] ?? 0) < next[o.good]! ? 3 : 1) : 1;
        const v = o.amount * (VALUE[o.good] ?? 10) * want;
        if (!best || v > best.v) best = { h: t.h, good: o.good, amount: o.amount, v };
      }
    }
    if (!best) break;
    used.add(best.h);
    worked.push({ hex: best.h, good: best.good, amount: best.amount });
  }
  void g;
  return worked;
}

/** One season in a colony: work, eat, dress, drink, grow (or not). */
export function colonySeason(world: World, s: GameState, c: Colony, log: (text: string, kind?: 'trade' | 'peril' | 'court') => void) {
  const worked = workPlan(world, s, c);
  const discontentBefore = c.last.discontent;
  // the colony's own fields, plus whatever idle hands can forage
  const produced: Partial<Record<GoodId, number>> = { food: 2 + Math.max(0, c.pop - worked.length) * 0.5 };
  for (const w of worked) produced[w.good] = (produced[w.good] ?? 0) + w.amount * (discontentBefore ? 0.7 : 1);
  for (const g of GOODS) if (produced[g]) c.stock[g] = Math.round(((c.stock[g] ?? 0) + produced[g]!) * 10) / 10;
  const take = (g: GoodId, n: number) => {
    const have = c.stock[g] ?? 0;
    const got = Math.min(have, n);
    c.stock[g] = Math.round((have - got) * 10) / 10;
    if (!c.stock[g]) delete c.stock[g];
    return got >= n - 1e-6;
  };
  const fed = take('food', c.pop * NEEDS.food);
  const clothed = take('cloth', c.pop * NEEDS.cloth);
  const drink = take('wine', c.pop * NEEDS.wine);
  let lux = false;
  const luxNeed = c.pop * LUXURY_NEED;
  const luxHave = LUXURIES.reduce((t, g) => t + (c.stock[g] ?? 0), 0);
  if (luxHave >= luxNeed) {
    let left = luxNeed;
    for (const g of LUXURIES) { const k = Math.min(left, c.stock[g] ?? 0); take(g, k); left -= k; }
    lux = true;
  }
  const discontent = !clothed || !drink;
  if (!fed) {
    if (c.pop > 1) { c.pop--; log(`Hunger in ${c.name}: a colonist dies, and others leave for the woods.`, 'peril'); }
    else log(`${c.name} is starving. Send food, or the outpost will not last.`, 'peril');
    c.growth = 0;
  } else if (!discontent) {
    const surplus = Math.max(0, (produced.food ?? 0) - c.pop * NEEDS.food);
    c.growth += Math.max(1, surplus) * (lux ? 1.5 : 1);
    if (c.growth >= GROWTH_STEP && c.pop < LEVELS[c.level].cap) {
      c.growth = 0;
      c.pop++;
      log(`${c.name} grows: ${c.pop} colonists now.`, 'court');
    } else if (c.pop >= LEVELS[c.level].cap) c.growth = Math.min(c.growth, GROWTH_STEP);
  }
  if (discontent && !discontentBefore) log(`The settlers of ${c.name} grumble: they need ${[!clothed && 'cloth', !drink && 'wine'].filter(Boolean).join(' and ')}. Work slows.`, 'peril');
  c.last = { produced, worked, hungry: !fed, discontent, luxuries: lux };
}

// ---------- commands ----------

const near = (a: number, b: number, map: MapId) => a === b || GRIDS[map].neighbors(a).includes(b);

/** What the founder needs, after their construction skill. */
export function foundingNeeds(s: GameState, p: Party): Partial<Record<GoodId, number>> {
  const c = skill(personById(s, p.leader), 'construction');
  return Object.fromEntries(Object.entries(FOUNDING).map(([g, n]) => [g, Math.ceil(n! * (1 - 0.1 * c))])) as Partial<Record<GoodId, number>>;
}

export function canFound(world: World, s: GameState, p: Party): { ok: boolean; why?: string; fleet?: Fleet } {
  const g = GRIDS[p.map];
  const m = world[p.map];
  if (!s.units.some((u) => u.party === p.id && u.type === 'colonist')) return { ok: false, why: 'A colony needs colonists in the party.' };
  if (!g.neighbors(p.hex).some((h) => isWater(m.terrain[h]))) return { ok: false, why: 'Found it on the coast, where ships can reach it.' };
  if (!s.surveyed[p.map][p.hex]) return { ok: false, why: 'Survey the land first.' };
  if (s.colonies.some((c) => c.map === p.map && g.distance(c.hex, p.hex) <= 3)) return { ok: false, why: 'Too close to another colony.' };
  if (m.ports.some((x) => g.distance(x.hex, p.hex) <= 2)) return { ok: false, why: 'Too close to a trading ground or port.' };
  if (p.map === 'old' && g.lat(p.hex) >= 30) return { ok: false, why: 'This land already belongs to European crowns.' };
  const needs = foundingNeeds(s, p);
  const fleet = s.fleets.find((f) => f.map === p.map && near(f.hex, p.hex, p.map) && Object.entries(needs).every(([gd, n]) => (f.cargo[gd as GoodId] ?? 0) >= n!));
  if (!fleet) return { ok: false, why: `A fleet beside the party must carry ${Object.entries(needs).map(([gd, n]) => `${n} ${GOOD_INFO[gd as GoodId].name.toLowerCase()}`).join(' and ')}.` };
  return { ok: true, fleet };
}

export function foundColony(world: World, s: GameState, p: Party): Result & { colony?: Colony } {
  const chk = canFound(world, s, p);
  if (!chk.ok) return fail(chk.why!);
  const f = chk.fleet!;
  for (const [g, n] of Object.entries(foundingNeeds(s, p))) {
    f.cargo[g as GoodId] = (f.cargo[g as GoodId] ?? 0) - n!;
    if (!f.cargo[g as GoodId]) delete f.cargo[g as GoodId];
  }
  const colonists = s.units.filter((u) => u.party === p.id && u.type === 'colonist');
  const rng = mulberry32(hashSeed(s.seed, p.hex, s.turn, 41));
  const free = NAMES.filter((n) => !s.colonies.some((c) => c.name === n));
  const c: Colony = {
    id: `col-${s.nextId++}`, name: free.length ? pick(rng, free) : `Colonia ${s.colonies.length + 1}`, map: p.map, hex: p.hex,
    founded: s.turn, pop: colonists.length, level: 'outpost', stock: { food: 4 }, growth: 0,
    last: { produced: {}, worked: [], hungry: false, discontent: false, luxuries: false },
  };
  s.units = s.units.filter((u) => !colonists.includes(u));
  for (const u of s.units) if (u.party === p.id) { u.party = null; u.colony = c.id; }
  // the settlers carry their supplies ashore: provisions, cloth, wine and what is left of the materials
  for (const g of ['food', 'cloth', 'wine', 'timber', 'tools', 'stone'] as GoodId[]) {
    const n = f.cargo[g] ?? 0;
    if (!n) continue;
    c.stock[g] = (c.stock[g] ?? 0) + n;
    delete f.cargo[g];
  }
  s.colonies.push(c);
  const leader = personById(s, p.leader);
  // the founder stays aboard the fleet if it has no leader; otherwise in the colony as its first governor (for the record)
  if (leader && f.leader == null) { f.leader = leader.id; leader.fleet = f.id; }
  s.parties = s.parties.filter((x) => x !== p);
  s.prestige += 15;
  return { ok: true, colony: c, message: `${c.name} is founded with ${c.pop} colonist${c.pop > 1 ? 's' : ''}.` };
}

/** Raise an outpost to a town, a town to a city, with materials from its own warehouse. */
export function upgradeColony(s: GameState, c: Colony): Result {
  const L = LEVELS[c.level];
  if (!L.next) return fail(`${c.name} is already a city.`);
  if (c.pop < L.pop) return fail(`${c.name} needs ${L.pop} colonists first.`);
  for (const [g, n] of Object.entries(L.needs)) if ((c.stock[g as GoodId] ?? 0) < n!) return fail(`${c.name} needs ${n} ${GOOD_INFO[g as GoodId].name.toLowerCase()} in its warehouse.`);
  for (const [g, n] of Object.entries(L.needs)) c.stock[g as GoodId] = (c.stock[g as GoodId] ?? 0) - n!;
  c.level = L.next;
  s.prestige += 10;
  return { ok: true, message: `${c.name} is now a ${LEVELS[c.level].name.toLowerCase()}.` };
}

/** Move goods between a docked fleet and a colony's warehouse. */
export function transfer(_s: GameState, f: Fleet, c: Colony, good: GoodId, qty: number, capacity: number, used: number): Result {
  if (f.at !== c.id) return fail('The fleet must be docked at the colony.');
  if (qty > 0) {
    const n = Math.min(qty, Math.floor(c.stock[good] ?? 0), capacity - used);
    if (n <= 0) return fail('Nothing to load, or no room in the hold.');
    c.stock[good] = (c.stock[good] ?? 0) - n;
    f.cargo[good] = (f.cargo[good] ?? 0) + n;
    return { ok: true, message: `Loaded ${n} ${GOOD_INFO[good].name.toLowerCase()}.` };
  }
  const n = Math.min(-qty, f.cargo[good] ?? 0);
  if (n <= 0) return fail('Nothing to unload.');
  f.cargo[good] = (f.cargo[good] ?? 0) - n;
  if (!f.cargo[good]) delete f.cargo[good];
  c.stock[good] = (c.stock[good] ?? 0) + n;
  return { ok: true, message: `Unloaded ${n} ${GOOD_INFO[good].name.toLowerCase()}.` };
}

/** Colonists aboard a docked fleet settle in the colony. */
export function settle(s: GameState, f: Fleet, c: Colony): Result {
  if (f.at !== c.id) return fail('The fleet must be docked at the colony.');
  const colonists = s.units.filter((u) => u.fleet === f.id && u.type === 'colonist');
  if (!colonists.length) return fail('No colonists aboard.');
  const room = LEVELS[c.level].cap - c.pop;
  if (room <= 0) return fail(`${c.name} has no room. Raise it to the next level first.`);
  const n = Math.min(room, colonists.length);
  s.units = s.units.filter((u) => !colonists.slice(0, n).includes(u));
  c.pop += n;
  return { ok: true, message: `${n} colonist${n > 1 ? 's' : ''} settle in ${c.name}.` };
}

export function score(s: GameState, w?: World) {
  const pop = s.colonies.reduce((t, c) => t + c.pop, 0);
  const hexes = new Set(s.colonies.flatMap((c) => territoryOf(c).map((h) => `${c.map}:${h}`)));
  // the lands of peoples who are subjects of the Crown count too
  if (w) for (const n of [...w.old.nations, ...w.new.nations]) if (s.natives[n.id]?.relation === 'subject') for (const h of Nat.territory(n)) hexes.add(`${n.map}:${h}`);
  const territory = hexes.size;
  const commerce = Math.floor(s.revenue / 200);
  return { pop, territory, commerce, total: pop * 10 + territory * 2 + commerce };
}
