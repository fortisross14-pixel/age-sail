/** Parties ashore: landing, walking, surveying for resources, following rumours, and boarding again. */
import { T, isWater } from '../data/terrain';
import { UNIT_INFO } from '../data/court';
import { UNIT_SPECS, RESOURCES, RESOURCE_IDS } from '../data/city';
import { COMBAT, FORAGE, CARRY, RATIONS, LANDING_FOOD, STARVING, isMilitary } from '../data/army';
import { GRIDS, type Grid } from './hex';
import { mulberry32, hashSeed, int } from './rng';
import { leaderOf, personById, skill } from './court';
import { Fog, type GameState, type World, type Party, type MapData, type Fleet, type GameEvent } from './types';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

const COST: Partial<Record<T, number>> = {
  [T.Desert]: 1, [T.Plains]: 1, [T.Savanna]: 1, [T.Tundra]: 1.5, [T.Forest]: 2, [T.Taiga]: 2, [T.Jungle]: 2,
  [T.Hills]: 2, [T.Mountains]: 3, [T.Marsh]: 3,
};
/** Movement points to walk into a hex (unknown country is guessed at 2). */
export const landCost = (m: MapData, fog: ArrayLike<number>, i: number) => (fog[i] === Fog.Unknown ? 2 : COST[m.terrain[i] as T] ?? 1);

export const partyUnits = (s: GameState, p: Party) => s.units.filter((u) => u.party === p.id);
export const partyById = (s: GameState, id: number | null | undefined) => (id == null ? undefined : s.parties.find((p) => p.id === id));

export function partyMaxMoves(s: GameState, p: Party): number {
  const units = partyUnits(s, p);
  const base = units.length ? Math.min(...units.map((u) => UNIT_SPECS[u.type].moves)) : 3;
  const l = personById(s, p.leader);
  return base + (l?.rank === 'explorer' ? 1 : 0);
}

export const partySight = (s: GameState, p: Party) => 2 + (personById(s, p.leader)?.rank === 'explorer' ? 1 : 0);

export interface LandPlan { path: number[]; turns: number; turnEnds: number[] }

/** Cheapest way overland. Parties may walk into unknown country. */
export function planLand(g: Grid, m: MapData, fog: ArrayLike<number>, from: number, to: number, movesLeft: number, movesMax: number): LandPlan | null {
  if (from === to || isWater(m.terrain[to]) && fog[to] !== Fog.Unknown) return null;
  const passable = (i: number) => fog[i] === Fog.Unknown ? true : !isWater(m.terrain[i]);
  const gs = new Float64Array(g.N).fill(Infinity);
  const prev = new Int32Array(g.N).fill(-1);
  const open: [number, number][] = [[g.distance(from, to), from]];
  gs[from] = 0;
  const done = new Uint8Array(g.N);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i] = open.splice(bi, 1)[0];
    if (done[i]) continue;
    done[i] = 1;
    if (i === to) break;
    for (const j of g.neighbors(i)) {
      if (done[j] || !passable(j)) continue;
      const ng = gs[i] + landCost(m, fog, j);
      if (ng < gs[j]) { gs[j] = ng; prev[j] = i; open.push([ng + g.distance(j, to), j]); }
    }
    if (open.length > 4000) break;
  }
  if (!isFinite(gs[to])) return null;
  const path: number[] = [];
  for (let c = to; c !== -1; c = prev[c]) path.push(c);
  path.reverse();
  let turns = 1, left = movesLeft;
  const turnEnds: number[] = [];
  for (let k = 1; k < path.length; k++) {
    const c = landCost(m, fog, path[k]);
    if (left < c && left < movesMax) { turns++; left = movesMax; turnEnds.push(k - 1); }
    left = Math.max(0, left - c);
  }
  return { path, turns, turnEnds };
}

/** What a party sees: the land around it, and what lies in it. */
export function surveyAround(world: World, s: GameState, p: Party, log: (kind: 'discovery' | 'peril', text: string) => void, event: (e: GameEvent) => void, addResearch: (n: number) => void) {
  const g = GRIDS[p.map];
  const m = world[p.map];
  const fog = s.fog[p.map];
  const surveyed = s.surveyed[p.map];
  const sight = partySight(s, p);
  const leader = personById(s, p.leader);
  const who = leader ? leader.name : p.name;
  const found: string[] = [];
  for (const h of g.within(p.hex, sight + 1)) if (fog[h] < Fog.Charted) fog[h] = Fog.Charted;
  for (const h of g.within(p.hex, sight)) {
    if (fog[h] < Fog.Explored) fog[h] = Fog.Explored;
    if (surveyed[h] || isWater(m.terrain[h])) continue;
    surveyed[h] = 1;
    const r = m.resource[h];
    if (!r) continue;
    const id = RESOURCE_IDS[r - 1];
    s.finds.push({ map: p.map, hex: h, resource: id, turn: s.turn, by: who });
    s.prestige += id === 'gold' || id === 'silver' ? 5 : 2;
    addResearch(1);
    if (leader) leader.discoveries += 3;
    found.push(RESOURCES[id].name.toLowerCase());
    const firstOfKind = s.finds.filter((f) => f.resource === id).length === 1;
    if (firstOfKind && (id === 'gold' || id === 'silver')) {
      event({ kind: 'people', title: id === 'gold' ? 'Gold!' : 'Silver!', map: p.map, hex: h,
        text: `${who} brings back a fistful of ${id === 'gold' ? 'gold dust and nuggets' : 'heavy silver ore'} from the hills. Where there is this much, there is surely more.` });
    }
  }
  if (found.length) log('discovery', `${who} surveys the country and finds ${[...new Set(found)].join(', ')}.`);
}

function rumour(world: World, s: GameState, p: Party, log: (kind: 'discovery' | 'peril', text: string) => void, event: (e: GameEvent) => void, addResearch: (n: number) => void) {
  const m = world[p.map];
  const r = m.rumours.find((x) => x.hex === p.hex);
  if (!r || s.rumoursDone[p.map].includes(p.hex)) return;
  s.rumoursDone[p.map].push(p.hex);
  const rng = mulberry32(hashSeed(s.seed, p.hex, s.turn, 31));
  const leader = personById(s, p.leader);
  const units = partyUnits(s, p);
  const who = leader?.name ?? p.name;
  const guarded = units.some((u) => isMilitary(u.type)) || skill(leader, 'military') >= 3;
  const welcome = skill(leader, 'diplomacy') * 0.06 + (units.some((u) => u.type === 'missionary') ? 0.1 : 0);
  const roll = rng();
  const g = GRIDS[p.map];
  const lose = (why: string) => {
    const victim = units[int(rng, 0, Math.max(0, units.length - 1))];
    if (victim) {
      s.units = s.units.filter((u) => u !== victim);
      log('peril', `${why} ${UNIT_INFO[victim.type].name} of ${who}’s party are lost.`);
    } else log('peril', `${why} ${who} barely escapes.`);
  };
  const reveal = (rad: number) => { for (const h of g.within(p.hex, rad)) if (s.fog[p.map][h] < Fog.Explored) s.fog[p.map][h] = Fog.Explored; };
  if (r.kind === 'ruins') {
    if (roll < 0.35) { const d = int(rng, 300, 1200); s.treasury += d; log('discovery', `${who} digs among overgrown ruins and finds old gold worth ${d} ducats.`); }
    else if (roll < 0.6) { reveal(6); log('discovery', `${who} finds a carved stone map among the ruins. The country around becomes clear.`); }
    else if (roll < 0.72) { addResearch(15); log('discovery', `${who} copies strange carvings from the ruins for the scholars at court.`); }
    else if (roll < (guarded ? 0.95 : 0.88)) log('discovery', `${who} finds only broken walls and vines.`);
    else lose('A fever rises from the swamps around the ruins.');
  } else if (r.kind === 'city') {
    if (roll < 0.25) {
      const d = int(rng, 1500, 4000);
      s.treasury += d;
      s.prestige += 20;
      log('discovery', `${who} reaches the lost city of the stories. Its storerooms hold treasure worth ${d} ducats.`);
      event({ kind: 'people', title: 'The lost city', map: p.map, hex: p.hex, text: `${who} has found the city the stories spoke of, half swallowed by the land. Its treasure, worth ${d} ducats, is on its way to your treasury.` });
    } else if (roll < 0.45) { reveal(9); log('discovery', `${who} meets guides at the edge of the lost city, who show the way through the whole region.`); }
    else if (roll < (guarded ? 0.9 : 0.78)) log('discovery', `${who} follows the stories of a golden city for weeks, and finds nothing.`);
    else lose('Hunger and an ambush on the trail to the lost city.');
  } else {
    if (roll < 0.45 + welcome) { addResearch(15); s.prestige += 5; log('discovery', `The keepers of a shrine welcome ${who}, and share what they know of the stars and the seasons.`); }
    else if (roll < 0.85) log('discovery', `${who} finds a shrine, long abandoned.`);
    else lose('The keepers of the shrine turn the party away; on the hard road back,');
  }
}

/** Walk the party along its orders as far as its movement allows. */
export function advanceParty(world: World, s: GameState, p: Party, log: (kind: 'discovery' | 'peril', text: string) => void, event: (e: GameEvent) => void, addResearch: (n: number) => void) {
  const path = p.order;
  if (!path) return;
  const m = world[p.map];
  const full = partyMaxMoves(s, p);
  while (path.length > 1) {
    const next = path[1];
    if (isWater(m.terrain[next])) { p.order = null; log('discovery', `${p.name} reaches water and can go no further that way.`); return; }
    const c = landCost(m, s.fog[p.map], next);
    if (p.moves < c && p.moves < full) break;
    p.moves = Math.max(0, p.moves - c);
    p.hex = next;
    path.shift();
    p.trail.push(next);
    surveyAround(world, s, p, log, event, addResearch);
    rumour(world, s, p, log, event, addResearch);
  }
  if (path.length <= 1) p.order = null;
}

// ---------- commands ----------

/** Put a fleet's units (and, if asked, its explorer) ashore on a neighbouring land hex. */
export function landParty(world: World, s: GameState, f: Fleet, hex: number, withLeader: boolean, log: (kind: 'discovery' | 'peril', text: string) => void, event: (e: GameEvent) => void, addResearch: (n: number) => void): Result {
  const g = GRIDS[f.map];
  const m = world[f.map];
  if (isWater(m.terrain[hex])) return fail('Choose land to put ashore on.');
  if (hex !== f.hex && !g.neighbors(f.hex).includes(hex)) return fail('The fleet must lie next to that shore.');
  if (s.fog[f.map][hex] === Fog.Unknown) return fail('Nobody can see that shore yet.');
  const units = s.units.filter((u) => u.fleet === f.id);
  const leader = withLeader ? leaderOf(s, f) : undefined;
  if (!units.length && !leader) return fail('No one aboard to put ashore.');
  // they take the food in the hold, up to what they can carry, and a few days' biscuit from the ship's stores
  const carry = units.length * CARRY;
  const fromHold = Math.min(f.cargo.food ?? 0, carry);
  if (fromHold) { f.cargo.food = (f.cargo.food ?? 0) - fromHold; if (!f.cargo.food) delete f.cargo.food; }
  const p: Party = {
    id: s.nextId++, name: leader ? `${leader.name.split(' ')[0]}’s party` : 'Landing party', map: f.map, hex,
    leader: leader?.id ?? null, moves: 0, order: null, trail: [hex],
    food: fromHold + Math.max(1, units.length) * LANDING_FOOD * RATIONS,
  };
  for (const u of units) { u.fleet = null; u.party = p.id; }
  if (leader) { f.leader = null; f.route = null; leader.fleet = null; }
  s.parties.push(p);
  surveyAround(world, s, p, log, event, addResearch);
  rumour(world, s, p, log, event, addResearch);
  return { ok: true, message: `${p.name} goes ashore. They can march next season.` };
}

export function moveParty(world: World, s: GameState, p: Party, dest: number, log: (kind: 'discovery' | 'peril', text: string) => void, event: (e: GameEvent) => void, addResearch: (n: number) => void): Result {
  const plan = planLand(GRIDS[p.map], world[p.map], s.fog[p.map], p.hex, dest, p.moves, partyMaxMoves(s, p));
  if (!plan) return fail('No way there on foot.');
  p.order = plan.path;
  p.trail = [p.hex];
  advanceParty(world, s, p, log, event, addResearch);
  return { ok: true };
}

/** Back aboard a fleet lying next to the party (or in the same port). */
export function boardParty(s: GameState, p: Party, f: Fleet): Result {
  const g = GRIDS[p.map];
  if (f.map !== p.map || (f.hex !== p.hex && !g.neighbors(p.hex).includes(f.hex))) return fail('The fleet must lie next to the party.');
  const units = partyUnits(s, p);
  const leader = personById(s, p.leader);
  if (leader && f.leader != null) return fail(`${f.name} already has a leader.`);
  const room = f.ships.reduce((t, x) => t + (x.type === 'caravel' ? 1 : x.type === 'carrack' ? 2 : 4), 0)
    - (f.leader != null ? 1 : 0) - s.units.filter((u) => u.fleet === f.id).length;
  if (units.length + (leader ? 1 : 0) > room) return fail(`Not enough room aboard ${f.name}.`);
  for (const u of units) { u.party = null; u.fleet = f.id; }
  if (leader) { f.leader = leader.id; leader.fleet = f.id; }
  if (p.captives) f.captives = (f.captives ?? 0) + p.captives;
  const food = Math.floor(p.food ?? 0);
  if (food > 0) f.cargo.food = (f.cargo.food ?? 0) + food;
  s.parties = s.parties.filter((x) => x !== p);
  return { ok: true, message: `${p.name} is back aboard ${f.name}.` };
}

export function previewParty(world: World, s: GameState, p: Party, dest: number) {
  return planLand(GRIDS[p.map], world[p.map], s.fog[p.map], p.hex, dest, p.moves, partyMaxMoves(s, p));
}

/** What a party eats in a season: half its rations; the rest it finds on the way. */
export const partyNeed = (s: GameState, p: Party) => partyUnits(s, p).reduce((t, u) => t + COMBAT[u.type].food, 0) * RATIONS;
/** What it can forage where it stands. */
export const partyForage = (world: World, p: Party) => FORAGE[world[p.map].terrain[p.hex]] ?? 0;

/**
 * A season in the field: the party eats, forages, draws on a colony it stands beside, or starves.
 * A small band lives off the land; an army needs food sent after it.
 */
export function supplyParty(world: World, s: GameState, p: Party, log: (kind: 'discovery' | 'peril', text: string) => void) {
  const units = partyUnits(s, p);
  if (!units.length) return;
  const g = GRIDS[p.map];
  const home = s.colonies.find((c) => c.map === p.map && g.distance(c.hex, p.hex) <= 1);
  if (home) {
    const want = Math.max(0, units.length * CARRY - p.food);
    const take = Math.min(want, Math.floor(home.stock.food ?? 0));
    if (take > 0) { home.stock.food = (home.stock.food ?? 0) - take; p.food += take; }
  }
  const need = Math.max(0, partyNeed(s, p) - partyForage(world, p));
  if (p.food >= need) { p.food = Math.round((p.food - need) * 10) / 10; return; }
  p.food = 0;
  const rng = mulberry32(hashSeed(s.seed, s.turn, p.id, 61));
  const n = Math.max(1, Math.round(units.length * STARVING));
  const gone = [...units].sort(() => rng() - 0.5).slice(0, n);
  s.units = s.units.filter((u) => !gone.includes(u));
  log('peril', `${p.name} has run out of food. ${gone.map((u) => UNIT_INFO[u.type].name).join(', ')} desert or die of hunger. Send food, or bring them back to the ships.`);
}
