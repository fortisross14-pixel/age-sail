import { GOODS, GOOD_INFO, type GoodId } from '../data/goods';
import { SHIPS, SHIP_NAMES, type ShipType } from '../data/ships';
import { BUILDINGS, BUILDING_ORDER, CITY_SPACE, UNIT_SPECS, type BuildingId } from '../data/city';
import * as Land from './land';
import * as Col from './colony';
import { EUROPEAN_PORTS, KNOWN_SOUTH, ATLANTIC_ISLANDS } from '../data/europe';
import { TECHS, techById, type TechId } from '../data/tech';
import { T, isWater } from '../data/terrain';
import { GRIDS, type MapId } from './hex';
import { generateWorld } from './mapgen';
import { makeMarket, tickMarket, buyCost, sellValue, unitPrice as unitPriceOf, type MarketBook } from './market';
import { mulberry32, hashSeed, int, type Rng } from './rng';
import { maxMoves as baseMoves, crewNeeded, windwardOf as baseWindward, planRoute, stepCost, stormRisk, type RoutePlan } from './sailing';
import { initialCourt, newPetitioners, leaderOf, personById, skill, salary, deathChance, ageOf } from './court';
import { RANK_INFO, UNIT_INFO } from '../data/court';
import {
  Fog, dateLabel, seasonOf, yearOf,
  type Fleet, type GameState, type World, type PortDef, type ChronicleEntry, type MapData, type ProjectKind, type GameEvent,
  type Person, type UnitType, type TradeRoute, type Rank, type City,
} from './types';
export { leaderOf };

export { crewNeeded };

// ---------- research ----------

export const has = (s: GameState, t: TechId) => s.research.known.includes(t);
/** Research points the court produces each season, before discoveries. */
export const basePoints = (s: GameState) => 4 + (has(s, 'chancery') ? 2 : 0);
export const techAvailable = (s: GameState, t: TechId) => !has(s, t) && techById(t).requires.every((r) => has(s, r));

export function setResearch(s: GameState, t: TechId): CommandResult {
  if (!TECHS.some((x) => x.id === t)) return fail('No such subject.');
  if (has(s, t)) return fail('Already known.');
  if (!techAvailable(s, t)) return fail('Its foundations must be studied first.');
  if (s.research.current !== t) {
    s.research.current = t;
    s.research.progress = 0;
  }
  return { ok: true, message: `The court’s scholars turn to ${techById(t).name.toLowerCase()}.` };
}

function addResearch(s: GameState, pts: number) {
  s.research.pending += pts;
}

/** Movement points a fleet gets each season, with the Crown's knowledge and its leader's skill. */
export function maxMoves(f: Fleet, s?: GameState): number {
  if (!s) return baseMoves(f);
  const l = leaderOf(s, f);
  return baseMoves(f) + (has(s, 'astrolabe') ? 2 : 0) + Math.floor(skill(l, 'navigation') / 2) + (l?.trait === 'bold' ? 1 : 0);
}
export const windwardOf = (f: Fleet, s?: GameState) => Math.min(1, baseWindward(f) + (s && has(s, 'lateen') ? 0.15 : 0));
/** Without long-distance navigation the open ocean is a death trap. */
export const deepPeril = (s: GameState) => !has(s, 'volta');
/** European pilots know their own coasts by heart: sailing them costs half. */
export function waterScale(world: World, map: MapId, hex: number): number {
  return map === 'old' && !world.old.deep[hex] && GRIDS.old.lat(hex) >= KNOWN_SOUTH ? 0.5 : 1;
}

/** How much fiercer storms are in the open ocean: a skilled navigator reads the sky better. */
const deepStorms = (s: GameState, f: Fleet) => 3 - 0.3 * skill(leaderOf(s, f), 'navigation');
/** The haggling margin on each trade: the Crown's bookkeeping and the fleet leader's skills narrow it. */
export function spreadFor(s: GameState, f?: Fleet, native = false): number {
  const l = f ? leaderOf(s, f) : undefined;
  let sp = (has(s, 'bookkeeping') ? 0.06 : 0.1) - skill(l, 'commerce') * 0.01;
  const city = f?.at ? s.cities[f.at] : undefined;
  if (city) sp -= city.buildings.market * 0.02;
  if (native) sp -= skill(l, 'diplomacy') * 0.01;
  return Math.max(0.01, sp);
}
/** The Crown's charge for v0.1: a treasury target by a deadline. */
export const GOAL = { treasury: 20000, turn: 4 * 10 } as const;

// ---------- helpers ----------

export const mapData = (w: World, id: MapId): MapData => w[id];
export const allPorts = (w: World): PortDef[] => [...w.old.ports, ...w.new.ports];
/** A port by id: European, native, or (given the game state) one of your colonies. */
export function portById(w: World, id: string, s?: GameState): PortDef | undefined {
  if (id.startsWith('col-')) { const c = s ? Col.colonyById(s, id) : undefined; return c ? Col.colonyPort(c) : undefined; }
  return allPorts(w).find((p) => p.id === id);
}
export function portAt(w: World, map: MapId, hex: number, s?: GameState): PortDef | undefined {
  const c = s ? Col.colonyAt(s, map, hex) : undefined;
  return c ? Col.colonyPort(c) : w[map].ports.find((p) => p.hex === hex);
}
export const fleetById = (s: GameState, id: number) => s.fleets.find((f) => f.id === id);

export function cargoUsed(f: Fleet): number {
  return GOODS.reduce((t, g) => t + (f.cargo[g] ?? 0), 0);
}
export function cargoCapacity(f: Fleet): number {
  return f.ships.reduce((t, s) => t + SHIPS[s.type].cargo, 0);
}
export function provisionsMax(f: Fleet, s?: GameState): number {
  return Math.min(...f.ships.map((x) => SHIPS[x.type].provisions)) + (s && has(s, 'volta') ? 2 : 0);
}
/** Away from home, ships can only take on about half their full stores. */
export const provisionsAbroad = (f: Fleet, s?: GameState) => Math.floor(provisionsMax(f, s) / 2);
/** How full the stores can be filled where the fleet is docked. */
export function provisionCap(world: World, f: Fleet, s?: GameState): number {
  const port = f.at ? portById(world, f.at, s) : undefined;
  return port?.kind === 'home' ? provisionsMax(f, s) : provisionsAbroad(f, s);
}
export function fleetSight(f: Fleet, s?: GameState): number {
  const l = s ? leaderOf(s, f) : undefined;
  return Math.max(...f.ships.map((x) => SHIPS[x.type].sight)) + (l?.rank === 'explorer' ? 2 : 0) + (skill(l, 'navigation') >= 4 ? 1 : 0)
    + (s && has(s, 'portolan') ? 1 : 0);
}

/** People and units the fleet can carry, and how many it carries. */
export const slotsMax = (f: Fleet) => f.ships.reduce((t, x) => t + SHIPS[x.type].slots, 0);
export const unitsAboard = (s: GameState, f: Fleet) => s.units.filter((u) => u.fleet === f.id);
export const slotsUsed = (s: GameState, f: Fleet) => (f.leader != null ? 1 : 0) + unitsAboard(s, f).length;
export const isPortal = (w: World, f: Fleet) => w[f.map].portals.includes(f.hex);

/** May this fleet sail into uncharted water (and, before the New World is found, across the ocean)? */
export const canExplore = (s: GameState, f: Fleet) => leaderOf(s, f)?.rank === 'explorer';
export function canCross(s: GameState, f: Fleet) {
  return f.map === 'new' || s.newWorldFound || canExplore(s, f);
}

/** Cost to fill supplies (and, in a home port, sign on missing crew). */
export function provisionCost(world: World, f: Fleet, s?: GameState): number {
  const port = f.at ? portById(world, f.at, s) : undefined;
  if (!port) return 0;
  const perSeason = Math.max(4, f.crew / 2) * (port.kind === 'native' ? 1.6 : 1);
  let cost = Math.ceil(Math.max(0, provisionCap(world, f, s) - f.supplies) * perSeason);
  if (port.kind === 'home') cost += Math.max(0, crewNeeded(f) - f.crew) * 10;
  return cost;
}

export function repairCost(world: World, f: Fleet, s?: GameState): number {
  const port = f.at ? portById(world, f.at, s) : undefined;
  if (!port || (port.kind !== 'home' && port.kind !== 'foreign')) return 0;
  return f.ships.reduce((t, s) => t + Math.ceil((100 - s.hull) * SHIPS[s.type].cost * 0.004), 0);
}

function log(s: GameState, kind: ChronicleEntry['kind'], text: string) {
  s.chronicle.push({ turn: s.turn, kind, text });
  if (s.chronicle.length > 400) s.chronicle.splice(0, s.chronicle.length - 400);
}

function event(s: GameState, e: GameEvent) {
  s.events.push(e);
}

function nativeMarket(world: World, port: PortDef, rng: Rng): MarketBook {
  const g = GRIDS[port.map];
  const lat = g.lat(port.hex);
  const book: MarketBook = { tools: makeMarket(55, 20, 6, 0, int(rng, 2, 8)), cloth: makeMarket(45, 20, 5, 0, int(rng, 2, 8)) };
  const add = (good: GoodId, base: number, prod: number) => {
    book[good] = makeMarket(base, prod * 2.5, prod * 0.6, prod, prod * 2.5);
  };
  const t = world[port.map].terrain;
  const nearHills = g.within(port.hex, 3).some((h) => t[h] === T.Hills || t[h] === T.Mountains);
  if (port.map === 'old') {
    // the coast of Guinea: gold from the interior, pepper, dyes
    if (lat >= 17) { add('dyes', 26, 7); if (rng() < 0.6) book.gold = makeMarket(80, 10, 1, 3, 8); }
    else if (lat >= 7) { add('spices', 28, 12); if (rng() < 0.5) add('dyes', 24, 8); }
    else { book.gold = makeMarket(65, 14, 1, 4, 12); add('spices', 30, 8); }
    if (nearHills && !book.gold) book.gold = makeMarket(75, 10, 1, 3, 8);
    return book;
  }
  if (lat >= 42) add('furs', 22, 14);
  else if (lat >= 30) { add('furs', 26, 6); add('tobacco', 14, 12); }
  else if (lat >= 18) { add('tobacco', 12, 14); add('dyes', 24, 8); }
  else { add('cacao', 16, 14); add('dyes', 22, 10); }
  if (nearHills || (lat < 25 && rng() < 0.3)) book.gold = makeMarket(70, 10, 1, 3, 8);
  return book;
}

function newShip(s: GameState, type: ShipType, rng: Rng) {
  const used = new Set(s.fleets.flatMap((f) => f.ships.map((x) => x.name)));
  const free = SHIP_NAMES.filter((n) => !used.has(n));
  const name = free.length ? free[int(rng, 0, free.length - 1)] : `${SHIPS[type].name} ${s.nextId}`;
  return { id: s.nextId++, type, name, hull: 100 };
}

function makeFleet(s: GameState, name: string, ships: Fleet['ships'], port: PortDef): Fleet {
  const f: Fleet = {
    id: s.nextId++, name, ships, map: port.map, hex: port.hex, at: port.id, cargo: {}, crew: 0, supplies: 0,
    moves: 0, order: null, leader: null, route: null, trail: [], movedThisTurn: false, deepThisTurn: false,
  };
  f.crew = crewNeeded(f);
  f.supplies = provisionsMax(f, s);
  f.moves = maxMoves(f, s);
  return f;
}

// ---------- new game ----------

/** In 1492 Iberian pilots know Europe, the Mediterranean and the African coast to about Cape Bojador. */
function initialOldFog(world: World): number[] {
  const g = GRIDS.old;
  const fog = new Array<number>(g.N).fill(Fog.Unknown);
  for (let i = 0; i < g.N; i++) {
    const lat = g.lat(i), lon = g.lon(i);
    // the known sea narrows toward the African coast: open to the west off Iberia, hugging the shore further south
    const west = -19 - 7 * Math.min(1, Math.max(0, (lat - KNOWN_SOUTH) / 13)) + 0.8 * Math.sin(lat * 0.9);
    const south = KNOWN_SOUTH + 0.6 * Math.sin(lon * 0.7);
    if (lat >= south && lon > west) fog[i] = Fog.Explored;
    else if (lat >= south - 2 && lon > west - 2) fog[i] = Fog.Charted;
  }
  for (const [, lat, lon] of ATLANTIC_ISLANDS) for (const h of g.within(g.hexAt(lat, lon), 2)) fog[h] = Fog.Explored;
  void world;
  return fog;
}

export function newGame(seed: number): { world: World; state: GameState } {
  const world = generateWorld(seed);
  const rng = mulberry32(hashSeed(seed, 99));
  const markets: GameState['markets'] = {};
  for (const p of EUROPEAN_PORTS) {
    const book: MarketBook = {};
    for (const g of GOODS) {
      const spec = p.market[g];
      if (!spec) continue;
      const [base, ref, cons, prod] = spec;
      // New World goods are almost unknown in Europe: tiny stocks, high prices
      // goods Europe makes itself are well stocked; known imports less so; New World novelties hardly at all
      const novelty = g === 'tobacco' || g === 'cacao';
      const imported = g === 'furs' || g === 'dyes' || g === 'gold' || g === 'silver' || g === 'sugar' || g === 'spices';
      const stock = novelty ? 1 : imported ? ref * 0.6 : ref;
      book[g] = makeMarket(base, ref, cons, prod, stock);
    }
    markets[p.id] = book;
  }
  for (const p of allPorts(world)) if (p.kind === 'native') markets[p.id] = nativeMarket(world, p, rng);
  const cities: GameState['cities'] = {};
  for (const p of EUROPEAN_PORTS) {
    if (p.kind !== 'home') continue;
    const start = CITY_SPACE[p.id]?.start ?? { docks: 1 };
    const buildings = Object.fromEntries(BUILDING_ORDER.map((b) => [b, start[b] ?? 0])) as Record<BuildingId, number>;
    cities[p.id] = { id: p.id, buildings, project: null, governor: null };
  }

  const state: GameState = {
    seed, turn: 0, treasury: 5000, prestige: 0,
    fog: { old: initialOldFog(world), new: new Array(GRIDS.new.N).fill(Fog.Unknown) },
    fleets: [], people: [], petitioners: [], units: [], parties: [], cities, markets, discovered: [],
    surveyed: { old: new Array(GRIDS.old.N).fill(0), new: new Array(GRIDS.new.N).fill(0) },
    rumoursDone: { old: [], new: [] }, finds: [], colonies: [], revenue: 0,
    adoption: { furs: 1, dyes: 1, gold: 1, silver: 1, tools: 1, spices: 1, sugar: 0.5, tobacco: 0.05, cacao: 0.1, timber: 1, stone: 1, food: 1, cloth: 1, wine: 1 },
    chronicle: [], events: [], nextId: 1, newWorldFound: false,
    research: { known: [], current: 'portolan', progress: 0, pending: 0 },
  };
  const seville = portById(world, 'seville')!;
  // two ships in Sevilla, nobody yet in command: merge them, choose a leader from court, and send them out
  for (const type of ['caravel', 'carrack'] as const) {
    const ship = newShip(state, type, rng);
    state.fleets.push(makeFleet(state, `The ${ship.name}`, [ship], seville));
  }
  state.people = initialCourt(rng, () => state.nextId++, yearOf(0));
  newPetitioners(state, rng, () => state.nextId++);
  log(state, 'court', 'The Crown of Castile gives you two ships in Sevilla and a charter: chart the coasts beyond Cape Bojador, open trade with the peoples there, and fill the treasury. Choose who will lead the expedition from your court.');
  log(state, 'court', 'Pilots say no ship that sails far into the open Mar Océano comes back.');
  log(state, 'court', `The Crown asks for ${GOAL.treasury.toLocaleString('en')} ducats in the treasury by ${dateLabel(GOAL.turn)}.`);
  return { world, state };
}

// ---------- commands ----------

export type CommandResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): CommandResult => ({ ok: false, error });

function dockedMarket(world: World, s: GameState, f: Fleet, g: GoodId) {
  if (!f.at) return { error: 'The fleet must be in port to trade.' };
  if (f.at.startsWith('col-')) return { error: 'Colonies have no market: load and unload goods in the colony’s panel.' };
  const m = s.markets[f.at]?.[g];
  if (!m) return { error: `${portById(world, f.at, s)?.name} does not trade in ${GOOD_INFO[g].name.toLowerCase()}.` };
  return { m };
}

export function buy(world: World, s: GameState, fleetId: number, g: GoodId, qty: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  const r = dockedMarket(world, s, f, g);
  if ('error' in r) return fail(r.error!);
  const m = r.m!;
  qty = Math.min(qty, Math.floor(m.stock), cargoCapacity(f) - cargoUsed(f));
  const sp = spreadFor(s, f, portById(world, f.at!, s)?.kind === 'native');
  while (qty > 0 && buyCost(m, qty, sp) > s.treasury) qty--;
  if (qty <= 0) return fail('Nothing to buy: no stock, no hold space, or no money.');
  const cost = buyCost(m, qty, sp);
  s.treasury -= cost;
  m.stock -= qty;
  f.cargo[g] = (f.cargo[g] ?? 0) + qty;
  return { ok: true, message: `Bought ${qty} ${GOOD_INFO[g].name.toLowerCase()} for ${cost} ducats.` };
}

export function sell(world: World, s: GameState, fleetId: number, g: GoodId, qty: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  const r = dockedMarket(world, s, f, g);
  if ('error' in r) return fail(r.error!);
  const m = r.m!;
  qty = Math.min(qty, f.cargo[g] ?? 0);
  if (qty <= 0) return fail('Nothing to sell.');
  const value = sellValue(m, qty, spreadFor(s, f, portById(world, f.at!, s)?.kind === 'native'));
  s.treasury += value;
  s.revenue += value;
  m.stock += qty;
  f.cargo[g] = (f.cargo[g] ?? 0) - qty;
  if (!f.cargo[g]) delete f.cargo[g];
  if (f.map === 'old') {
    const before = s.adoption[g] ?? 1;
    s.adoption[g] = Math.min(1, before + qty / 400);
    if (before < 0.5 && s.adoption[g]! >= 0.5) log(s, 'trade', `${GOOD_INFO[g].name} is becoming fashionable in Europe. Demand will keep growing.`);
  }
  return { ok: true, message: `Sold ${qty} ${GOOD_INFO[g].name.toLowerCase()} for ${value} ducats.` };
}

export function provision(world: World, s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f || !f.at) return fail('The fleet must be in port.');
  const cost = provisionCost(world, f, s);
  if (cost <= 0) return { ok: true };
  if (cost > s.treasury) return fail(`Provisions cost ${cost} ducats. The treasury cannot pay.`);
  s.treasury -= cost;
  f.supplies = Math.max(f.supplies, provisionCap(world, f, s));
  if (portById(world, f.at, s)!.kind === 'home') f.crew = Math.max(f.crew, crewNeeded(f));
  return { ok: true, message: `Provisioned for ${cost} ducats.` };
}

export function repair(world: World, s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  const cost = repairCost(world, f, s);
  if (cost <= 0) return fail('Repairs need a European port.');
  if (cost > s.treasury) return fail(`Repairs cost ${cost} ducats. The treasury cannot pay.`);
  s.treasury -= cost;
  for (const sh of f.ships) sh.hull = 100;
  return { ok: true, message: `Repaired for ${cost} ducats.` };
}

/** Building places used in a city: one per level of every building. */
export const slotsUsedIn = (c: City) => BUILDING_ORDER.reduce((t, b) => t + c.buildings[b], 0);
export const citySlots = (c: City) => CITY_SPACE[c.id]?.slots ?? 4;

/** What a project costs in a city; a governor's construction skill makes it faster and cheaper. */
export function projectCost(p: ProjectKind, city: City, governor?: Person): { cost: number; build: number; allowed: boolean; why?: string } {
  const c = skill(governor, 'construction');
  const adj = (cost: number, build: number) => ({ cost: Math.round(cost * (1 - 0.05 * c)), build: Math.max(1, build - Math.floor(c / 2)) });
  if (p.kind === 'ship') {
    const spec = SHIPS[p.ship];
    const ok = city.buildings.docks >= spec.port;
    return { ...adj(spec.cost, spec.build), allowed: ok, why: ok ? undefined : `Needs docks level ${spec.port}.` };
  }
  if (p.kind === 'unit') {
    const spec = UNIT_SPECS[p.unit];
    if (spec.needs && city.buildings[spec.needs] < 1) return { cost: spec.cost, build: spec.build, allowed: false, why: `Needs ${BUILDINGS[spec.needs].name.toLowerCase()}.` };
    const drilled = p.unit === 'infantry' && city.buildings.barracks >= 2;
    return { cost: Math.round(spec.cost * (drilled ? 0.7 : 1)), build: Math.max(1, spec.build - (drilled ? 1 : 0)), allowed: true };
  }
  const b = BUILDINGS[p.building];
  const next = city.buildings[p.building] + 1;
  const lv = b.levels[next];
  if (!lv) return { cost: 0, build: 0, allowed: false, why: `${b.name} are as large as they can be.` };
  if (slotsUsedIn(city) >= citySlots(city)) return { ...adj(lv.cost, lv.build), allowed: false, why: 'No room left in the city.' };
  return { ...adj(lv.cost, lv.build), allowed: true };
}

export function startProject(s: GameState, cityId: string, p: ProjectKind): CommandResult {
  const city = s.cities[cityId];
  if (!city) return fail('Only your own cities can build.');
  if (city.project) return fail('This city is already busy with a project.');
  const c = projectCost(p, city, personById(s, city.governor));
  if (!c.allowed) return fail(c.why ?? 'Not possible.');
  if (c.cost > s.treasury) return fail(`That costs ${c.cost} ducats.`);
  s.treasury -= c.cost;
  city.project = { ...p, turnsLeft: c.build, total: c.build };
  return { ok: true, message: `Work begins. Ready in ${c.build} season${c.build > 1 ? 's' : ''}.` };
}

// ---------- the court ----------

function courtPerson(s: GameState, id: number) {
  const p = personById(s, id);
  return p && p.alive ? p : undefined;
}

export function hire(s: GameState, personId: number): CommandResult {
  const k = s.petitioners.findIndex((x) => x.person.id === personId);
  if (k < 0) return fail('That petitioner has gone.');
  const { person, cost } = s.petitioners[k];
  if (cost > s.treasury) return fail(`${person.name} asks ${cost} ducats to join the court.`);
  s.treasury -= cost;
  s.petitioners.splice(k, 1);
  s.people.push(person);
  return { ok: true, message: `${person.name} joins the court.` };
}

/** Commission a courtier. Explorers come with a free unit of the chosen type. */
export function promote(s: GameState, personId: number, rank: Rank, opts: { unit?: UnitType; city?: string } = {}): CommandResult {
  const p = courtPerson(s, personId);
  if (!p) return fail('No such person at court.');
  if (p.fleet != null) return fail(`${p.name} is at sea.`);
  if (p.rank !== 'courtier') return fail(`${p.name} already holds a rank.`);
  const info = RANK_INFO[rank];
  if (info.cost > s.treasury) return fail(`A commission as ${info.name.toLowerCase()} costs ${info.cost} ducats.`);
  if (rank === 'explorer' && !opts.unit) return fail('Choose the unit that sails with the explorer.');
  if (rank === 'governor') {
    const city = opts.city ? s.cities[opts.city] : undefined;
    if (!city) return fail('Choose a city to govern.');
    if (city.governor != null) return fail('That city already has a governor.');
    city.governor = p.id;
    p.city = city.id;
  }
  s.treasury -= info.cost;
  p.rank = rank;
  p.ready = info.ready;
  p.unitType = rank === 'explorer' ? opts.unit! : null;
  const when = info.ready ? ` Ready in ${info.ready} season${info.ready > 1 ? 's' : ''}.` : '';
  return { ok: true, message: `${p.name} is made ${info.name.toLowerCase()}.${when}` };
}

/** Back to plain courtier (only when not at sea). */
export function relieve(s: GameState, personId: number): CommandResult {
  const p = courtPerson(s, personId);
  if (!p) return fail('No such person at court.');
  if (p.fleet != null) return fail(`${p.name} is leading a fleet. Bring them home first.`);
  for (const c of Object.values(s.cities)) if (c.governor === p.id) c.governor = null;
  p.rank = 'courtier';
  p.ready = 0;
  p.unitType = null;
  return { ok: true, message: `${p.name} returns to court.` };
}

/** Put a ready explorer or merchant in command of a fleet in the same home port. Their unit boards if there is room. */
export function assignLeader(s: GameState, personId: number, fleetId: number): CommandResult {
  const p = courtPerson(s, personId);
  const f = fleetById(s, fleetId);
  if (!p || !f) return fail('No such person or fleet.');
  if (p.rank !== 'explorer' && p.rank !== 'merchant') return fail('Only explorers and merchants lead fleets.');
  if (p.ready > 0) return fail(`${p.name} is still preparing (${p.ready} season${p.ready > 1 ? 's' : ''}).`);
  if (p.fleet != null) return fail(`${p.name} already leads a fleet.`);
  if (f.leader != null) return fail(`${f.name} already has a leader.`);
  if (!f.at || f.at !== p.city) return fail(`The fleet must be in port at ${p.city ? portByIdName(p.city) : 'their city'}.`);
  if (slotsUsed(s, f) + 1 > slotsMax(f)) return fail('No room aboard for a leader.');
  f.leader = p.id;
  p.fleet = f.id;
  p.city = null;
  let msg = `${p.name} takes command of ${f.name}.`;
  for (const u of s.units.filter((x) => x.city === f.at && x.fleet == null && x.party == null)) {
    if (slotsUsed(s, f) >= slotsMax(f)) { msg += ' There is no room aboard for everyone waiting in port.'; break; }
    u.fleet = f.id;
    u.city = null;
    msg += ` ${UNIT_INFO[u.type].name} embark.`;
  }
  if (p.rank === 'explorer' && !f.name.startsWith('Expedition')) f.name = `Expedition of ${p.name.split(' ')[0]}`;
  if (p.rank === 'merchant' && !f.name.startsWith('Trade')) f.name = `Trade fleet of ${p.name.split(' ')[0]}`;
  return { ok: true, message: msg };
}

const portByIdName = (id: string) => EUROPEAN_PORTS.find((p) => p.id === id)?.name ?? id;

/** Bring a fleet's leader (and the units aboard) ashore in a home port. */
export function recall(world: World, s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f || f.leader == null) return fail('No leader to bring ashore.');
  const port = f.at ? portById(world, f.at, s) : undefined;
  if (!port || port.kind !== 'home') return fail('Leaders come ashore only in your own ports.');
  const p = personById(s, f.leader)!;
  p.fleet = null;
  p.city = port.id;
  f.leader = null;
  f.route = null;
  for (const u of unitsAboard(s, f)) { u.fleet = null; u.city = port.id; }
  return { ok: true, message: `${p.name} comes ashore in ${port.name}.` };
}

export function embark(world: World, s: GameState, unitId: number, fleetId: number): CommandResult {
  const u = s.units.find((x) => x.id === unitId);
  const f = fleetById(s, fleetId);
  if (!u || !f) return fail('No such unit or fleet.');
  if (u.city == null || f.at !== u.city) return fail('The fleet must be in the same port.');
  if (slotsUsed(s, f) >= slotsMax(f)) return fail('No room aboard. A caravel carries one, a carrack two, a galleon four (the leader takes one).');
  u.fleet = f.id;
  u.city = null;
  u.party = null;
  void world;
  return { ok: true, message: `${UNIT_INFO[u.type].name} board ${f.name}.` };
}

export function disembark(world: World, s: GameState, unitId: number): CommandResult {
  const u = s.units.find((x) => x.id === unitId);
  const f = u?.fleet != null ? fleetById(s, u.fleet) : undefined;
  if (!u || !f) return fail('No such unit aboard.');
  const port = f.at ? portById(world, f.at, s) : undefined;
  if (!port || port.kind !== 'home') return fail('For now units go ashore only in your own ports. Landing elsewhere comes later.');
  u.fleet = null;
  u.city = port.id;
  return { ok: true, message: `${UNIT_INFO[u.type].name} go ashore in ${port.name}.` };
}

export function mergeFleets(s: GameState, fromId: number, intoId: number): CommandResult {
  const a = fleetById(s, fromId), b = fleetById(s, intoId);
  if (!a || !b || a === b) return fail('No such fleets.');
  if (a.map !== b.map || a.hex !== b.hex) return fail('Fleets must be in the same place to join.');
  if (a.ships.length + b.ships.length > 8) return fail('A fleet can have at most 8 ships.');
  if (a.leader != null && b.leader != null) return fail('Both fleets have a leader. Bring one ashore first.');
  b.ships.push(...a.ships);
  b.crew += a.crew;
  b.supplies = Math.min(b.supplies, a.supplies);
  for (const g of GOODS) if (a.cargo[g]) b.cargo[g] = (b.cargo[g] ?? 0) + a.cargo[g]!;
  b.moves = Math.min(b.moves, a.moves);
  if (a.leader != null) {
    b.leader = a.leader;
    b.route = a.route;
    personById(s, a.leader)!.fleet = b.id;
  }
  for (const u of unitsAboard(s, a)) u.fleet = b.id;
  s.fleets = s.fleets.filter((f) => f !== a);
  return { ok: true, message: `${a.name} joins ${b.name}.` };
}

// ---------- parties ashore ----------

const landLog = (s: GameState) => (kind: 'discovery' | 'peril', text: string) => log(s, kind, text);
const landEvent = (s: GameState) => (e: GameEvent) => event(s, e);
const landResearch = (s: GameState) => (n: number) => addResearch(s, n);

export function landParty(world: World, s: GameState, fleetId: number, hex: number, withLeader: boolean): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  return Land.landParty(world, s, f, hex, withLeader, landLog(s), landEvent(s), landResearch(s));
}

export function moveParty(world: World, s: GameState, partyId: number, hex: number): CommandResult {
  const p = Land.partyById(s, partyId);
  if (!p) return fail('No such party.');
  return Land.moveParty(world, s, p, hex, landLog(s), landEvent(s), landResearch(s));
}

export function boardParty(s: GameState, partyId: number, fleetId: number): CommandResult {
  const p = Land.partyById(s, partyId);
  const f = fleetById(s, fleetId);
  if (!p || !f) return fail('No such party or fleet.');
  return Land.boardParty(s, p, f);
}

export function stopParty(s: GameState, partyId: number): CommandResult {
  const p = Land.partyById(s, partyId);
  if (!p) return fail('No such party.');
  p.order = null;
  return { ok: true };
}

// ---------- colonies ----------

const colLog = (s: GameState) => (text: string, kind: 'trade' | 'peril' | 'court' = 'court') => log(s, kind, text);

export function foundColony(world: World, s: GameState, partyId: number): CommandResult {
  const p = Land.partyById(s, partyId);
  if (!p) return fail('No such party.');
  const r = Col.foundColony(world, s, p);
  if (!r.ok) return r;
  const c = r.colony!;
  log(s, 'discovery', `${c.name} is founded on the coast with ${c.pop} colonist${c.pop > 1 ? 's' : ''}. The Crown has a new outpost beyond the sea.`);
  if (s.colonies.length === 1) {
    event(s, { kind: 'people', title: c.name, map: c.map, hex: c.hex,
      text: `Your first colony stands on a far coast: a palisade, a few huts, fields cleared from the forest. ${c.name} must be fed, clothed and given wine until it can stand on its own.` });
  }
  return { ok: true, message: r.message };
}

export function upgradeColony(s: GameState, colonyId: string): CommandResult {
  const c = Col.colonyById(s, colonyId);
  if (!c) return fail('No such colony.');
  const r = Col.upgradeColony(s, c);
  if (r.ok) log(s, 'court', r.message!);
  return r;
}

export function colonyTransfer(s: GameState, fleetId: number, good: GoodId, qty: number): CommandResult {
  const f = fleetById(s, fleetId);
  const c = f?.at ? Col.colonyById(s, f.at) : undefined;
  if (!f || !c) return fail('The fleet must be docked at one of your colonies.');
  return Col.transfer(s, f, c, good, qty, cargoCapacity(f), cargoUsed(f));
}

export function settleColonists(s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  const c = f?.at ? Col.colonyById(s, f.at) : undefined;
  if (!f || !c) return fail('The fleet must be docked at one of your colonies.');
  return Col.settle(s, f, c);
}

// ---------- trade routes ----------

export function setTradeRoute(world: World, s: GameState, fleetId: number, route: TradeRoute | null): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  if (route) {
    if (leaderOf(s, f)?.rank !== 'merchant') return fail('Only a fleet led by a merchant can run a trade route.');
    if (route.stops.length < 2) return fail('A route needs at least two ports.');
    for (const st of route.stops) {
      const p = portById(world, st.port, s);
      if (!p || p.map !== f.map) return fail('All stops must be on the same map as the fleet.');
      if (p.kind === 'native' && !s.discovered.includes(p.id)) return fail(`${p.name} is not yet known.`);
    }
    route = { ...route, next: Math.min(route.next, route.stops.length - 1) };
  }
  f.route = route;
  if (route?.active) f.order = null;
  return { ok: true, message: route ? (route.active ? 'The route is running. The fleet sails at the start of next season.' : 'Route saved.') : 'Route cleared.' };
}

/** At a stop: sell what the route says to sell, buy what it says to buy. Returns a one-line account. */
function tradeAtStop(world: World, s: GameState, f: Fleet, st: TradeRoute['stops'][number]): string {
  const parts: string[] = [];
  const col = Col.colonyById(s, st.port);
  if (col) {
    for (const g of st.sell) {
      const n = f.cargo[g] ?? 0;
      if (n && Col.transfer(s, f, col, g, -n, cargoCapacity(f), cargoUsed(f)).ok) parts.push(`unloaded ${n} ${GOOD_INFO[g].name.toLowerCase()}`);
    }
    for (const b of st.buy) {
      const before = f.cargo[b.good] ?? 0;
      const want = Math.max(0, b.qty - before);
      if (want && Col.transfer(s, f, col, b.good, want, cargoCapacity(f), cargoUsed(f)).ok) parts.push(`loaded ${(f.cargo[b.good] ?? 0) - before} ${GOOD_INFO[b.good].name.toLowerCase()}`);
    }
    if (provisionCost(world, f, s) > 0 && provisionCost(world, f, s) < s.treasury) provision(world, s, f.id);
    return parts.length ? `${f.name} at ${col.name}: ${parts.join(', ')}.` : `${f.name} at ${col.name}: nothing to move.`;
  }
  let earned = 0, spent = 0;
  for (const g of st.sell) {
    const have = f.cargo[g] ?? 0;
    if (!have) continue;
    const before = s.treasury;
    if (sell(world, s, f.id, g, have).ok) { earned += s.treasury - before; parts.push(`sold ${have} ${GOOD_INFO[g].name.toLowerCase()}`); }
  }
  for (const b of st.buy) {
    const m = s.markets[st.port]?.[b.good];
    if (!m) continue;
    if (b.maxPrice != null && unitPriceOf(m) > b.maxPrice) { parts.push(`${GOOD_INFO[b.good].name.toLowerCase()} too dear`); continue; }
    const want = Math.max(0, b.qty - (f.cargo[b.good] ?? 0));
    if (!want) continue;
    const before = s.treasury, had = f.cargo[b.good] ?? 0;
    if (buy(world, s, f.id, b.good, want).ok) { spent += before - s.treasury; parts.push(`bought ${(f.cargo[b.good] ?? 0) - had} ${GOOD_INFO[b.good].name.toLowerCase()}`); }
  }
  if (provisionCost(world, f, s) > 0 && provisionCost(world, f, s) < s.treasury) provision(world, s, f.id);
  const port = portById(world, st.port, s)!;
  return parts.length ? `${f.name} at ${port.name}: ${parts.join(', ')} (+${earned}, −${spent} ducats).` : `${f.name} at ${port.name}: nothing to trade.`;
}

/** Run a fleet's trade route for this season: trade at the stop it is in, then sail for the next. */
function runRoute(world: World, s: GameState, f: Fleet, notes: string[]) {
  const r = f.route;
  if (!r || !r.active || f.order) return;
  for (let step = 0; step < 3 && s.fleets.includes(f); step++) {
    const target = r.stops[r.next];
    if (f.at === target.port) {
      notes.push(tradeAtStop(world, s, f, target));
      r.next = (r.next + 1) % r.stops.length;
      const dest = portById(world, r.stops[r.next].port, s)!;
      if (!moveFleet(world, s, f.id, dest.hex).ok) { r.active = false; notes.push(`${f.name} cannot find a way to ${dest.name}. The route is paused.`); return; }
    } else if (!f.order) {
      const dest = portById(world, target.port, s)!;
      if (!moveFleet(world, s, f.id, dest.hex).ok) { r.active = false; notes.push(`${f.name} cannot find a way to ${dest.name}. The route is paused.`); return; }
    }
    if (f.moves <= 0 || f.order) return;
  }
}

/** Detach one ship into a new fleet in the same place. Cargo that no longer fits goes with it. */
export function splitShip(s: GameState, fleetId: number, shipId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  if (f.ships.length < 2) return fail('A fleet of one ship cannot be split.');
  const ship = f.ships.find((x) => x.id === shipId);
  if (!ship) return fail('No such ship.');
  f.ships = f.ships.filter((x) => x !== ship);
  const crew = Math.min(f.crew, Math.round((f.crew * SHIPS[ship.type].crew) / (crewNeeded(f) + SHIPS[ship.type].crew)));
  f.crew -= crew;
  const nf: Fleet = {
    id: s.nextId++, name: `The ${ship.name}`, ships: [ship], map: f.map, hex: f.hex, at: f.at, cargo: {}, crew,
    supplies: f.supplies, moves: f.moves, order: null, leader: null, route: null, trail: [], movedThisTurn: f.movedThisTurn, deepThisTurn: f.deepThisTurn,
  };
  // people and units that no longer fit go with the detached ship
  for (const u of unitsAboard(s, f)) if (slotsUsed(s, f) > slotsMax(f)) u.fleet = nf.id;
  let over = cargoUsed(f) - cargoCapacity(f);
  for (const g of GOODS) {
    if (over <= 0) break;
    const k = Math.min(over, f.cargo[g] ?? 0);
    if (!k) continue;
    f.cargo[g] = (f.cargo[g] ?? 0) - k;
    if (!f.cargo[g]) delete f.cargo[g];
    nf.cargo[g] = k;
    over -= k;
  }
  s.fleets.push(nf);
  return { ok: true, message: `The ${ship.name} sails as her own fleet.` };
}

export function renameFleet(s: GameState, fleetId: number, name: string): CommandResult {
  const f = fleetById(s, fleetId);
  const n = name.trim().slice(0, 40);
  if (!f || !n) return fail('A fleet needs a name.');
  f.name = n;
  return { ok: true };
}

function planFor(world: World, s: GameState, f: Fleet, dest: number) {
  const g = GRIDS[f.map];
  const m = world[f.map];
  return planRoute(g, m, seasonOf(s.turn), f.hex, dest, {
    explorer: canExplore(s, f), ports: new Set([...m.ports.map((p) => p.hex), ...s.colonies.filter((c) => c.map === f.map).map((c) => c.hex)]), fog: s.fog[f.map],
    movesLeft: f.moves, movesMax: maxMoves(f, s), windward: windwardOf(f, s), scale: (h) => waterScale(world, f.map, h),
  });
}

export interface MovePreview extends RoutePlan {
  provision: number;
  /** hexes of deep ocean on the way, while it is still deadly */
  deep: number;
  /** ends on a portal: the fleet will cross to the other board */
  cross: boolean;
  crossBlocked: boolean;
}

export function previewMove(world: World, s: GameState, fleetId: number, dest: number): MovePreview | null {
  const f = fleetById(s, fleetId);
  if (!f) return null;
  const plan = f.hex === dest ? { path: [f.hex], cost: 0, turns: 1, risk: 0, turnEnds: [] } : planFor(world, s, f, dest);
  if (!plan) return null;
  const cross = world[f.map].portals.includes(dest);
  const deep = deepPeril(s) ? plan.path.filter((h) => world[f.map].deep[h]).length + (cross ? 4 : 0) : 0;
  return { ...plan, provision: f.at ? provisionCost(world, f, s) : 0, cross, crossBlocked: cross && !canCross(s, f), deep };
}

export interface MoveResult { result: CommandResult; trail: number[] }

/** Give a fleet orders and start moving it now, as far as its movement points allow. */
export function moveFleet(world: World, s: GameState, fleetId: number, dest: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  const p = previewMove(world, s, fleetId, dest);
  if (!p) return fail(canExplore(s, f) ? 'No sea route there.' : 'No charted route there. Only a fleet led by an explorer may sail into unknown waters.');
  if (p.crossBlocked) return fail('No captain will sail into the unknown west without an explorer to lead the way.');
  if (f.at && provisionCost(world, f, s) > 0) provision(world, s, fleetId);
  f.order = { path: p.path, cross: p.cross };
  f.trail = [f.hex];
  advance(world, s, f);
  return { ok: true };
}

export function cancelOrder(s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  f.order = null;
  return { ok: true };
}

/** Sail off the edge of one board onto the other. Uses the rest of the season. */
export function crossOcean(world: World, s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  if (!isPortal(world, f)) return fail('Sail to the edge of the chart first.');
  if (!canCross(s, f)) return fail('No captain will sail into the unknown west without an explorer to lead the way.');
  if (f.moves <= 0) return fail('The fleet has no movement left this season.');
  const from = GRIDS[f.map], to: MapId = f.map === 'old' ? 'new' : 'old';
  const lat = from.lat(f.hex);
  const target = world[to].portals.reduce((best, h) => (Math.abs(GRIDS[to].lat(h) - lat) < Math.abs(GRIDS[to].lat(best) - lat) ? h : best));
  f.map = to;
  f.hex = target;
  f.at = null;
  f.order = null;
  f.moves = 0;
  f.trail = [];
  f.movedThisTurn = true;
  f.deepThisTurn = true;
  reveal(world, s, f);
  log(s, 'voyage', to === 'new'
    ? `${f.name} leaves the last known waters behind and sails west into the Mar Océano.`
    : `${f.name} sights the coasts of Europe again.`);
  return { ok: true, message: to === 'new' ? 'Into the Mar Océano.' : 'Back in European waters.' };
}

// ---------- moving, seeing, discovering ----------

function reveal(world: World, s: GameState, f: Fleet) {
  const g = GRIDS[f.map];
  const fog = s.fog[f.map];
  const m = world[f.map];
  const sight = fleetSight(f, s);
  for (const h of g.within(f.hex, sight + 2)) if (fog[h] < Fog.Charted) fog[h] = Fog.Charted;
  const leader = leaderOf(s, f);
  const explorer = leader?.rank === 'explorer' ? leader : undefined;
  let newLand = 0;
  let mainland = false;
  for (const h of g.within(f.hex, sight)) {
    if (fog[h] === Fog.Explored) continue;
    fog[h] = Fog.Explored;
    if (!isWater(m.terrain[h])) {
      newLand++;
      if (m.mainland[h]) mainland = true;
    }
  }
  if (newLand) {
    s.prestige += newLand * 0.25;
    addResearch(s, newLand * 0.1);
    if (explorer) explorer.discoveries += newLand;
  }
  const who = explorer ? `${explorer.name} and the crews of ${f.ships.map((x) => `the ${x.name}`).join(' and ')}` : `The crews of ${f.name}`;
  if (newLand && f.map === 'new') {
    if (!s.newWorldFound) {
      s.newWorldFound = true;
      s.prestige += 30;
      addResearch(s, 10);
      const where = mainland ? 'a long coast with no end in sight' : 'an island, unknown to any chart';
      log(s, 'discovery', `¡Tierra! ${who} sight ${where}, far to the west across the Mar Océano.`);
      event(s, {
        kind: 'landfall', title: '¡Tierra!', map: 'new', hex: f.hex,
        text: `${who} have sighted ${where}. No European chart shows it. A New World lies across the Mar Océano, and ${dateLabel(s.turn).toLowerCase()} will be remembered.`,
      });
    }
    if (mainland && !s.chronicle.some((c) => c.text.includes('coast that runs north and south'))) {
      if (s.chronicle.some((c) => c.text.startsWith('¡Tierra!') && c.text.includes('island'))) {
        s.prestige += 20;
        log(s, 'discovery', `${who} reach a coast that runs north and south beyond sight. This is no island: it is a continent.`);
      } else {
        log(s, 'discovery', 'The coast that runs north and south beyond sight is surely a continent.');
      }
    }
  }
  for (const p of m.ports) {
    if (p.kind !== 'native' || s.discovered.includes(p.id) || fog[p.hex] !== Fog.Explored) continue;
    s.discovered.push(p.id);
    s.prestige += 15;
    addResearch(s, 4);
    if (explorer) explorer.discoveries += 10;
    const goods = Object.keys(s.markets[p.id] ?? {}).filter((g) => g !== 'tools').map((g) => GOOD_INFO[g as GoodId].name.toLowerCase());
    const text = `${explorer ? explorer.name : f.name} meets the ${p.people} at ${p.name}. They offer ${goods.join(' and ')}, and ask for iron tools.`;
    log(s, 'discovery', text);
    if (s.discovered.length === 1) event(s, { kind: 'people', title: `The ${p.people}`, text, map: p.map, hex: p.hex });
  }
}

function damageCargo(f: Fleet) {
  let over = cargoUsed(f) - cargoCapacity(f);
  for (const g of GOODS) {
    if (over <= 0) break;
    const lose = Math.min(over, f.cargo[g] ?? 0);
    f.cargo[g] = (f.cargo[g] ?? 0) - lose;
    if (!f.cargo[g]) delete f.cargo[g];
    over -= lose;
  }
}

function loseFleet(s: GameState, f: Fleet, why: string) {
  s.fleets = s.fleets.filter((x) => x !== f);
  const e = leaderOf(s, f);
  if (e) {
    e.alive = false;
    e.fleet = null;
    e.died = s.turn;
  }
  s.units = s.units.filter((u) => u.fleet !== f.id);
  log(s, 'peril', why);
  if (e) event(s, { kind: 'lost', title: 'Lost at sea', text: `${why} ${e.name} is never heard from again.`, map: f.map, hex: f.hex });
}

function storm(s: GameState, f: Fleet, rng: Rng) {
  const ship = f.ships[int(rng, 0, f.ships.length - 1)];
  ship.hull -= int(rng, 15, 45);
  if (ship.hull > 0) {
    log(s, 'peril', `A storm batters ${f.name}. The ${ship.name} is damaged (hull ${ship.hull}%).`);
    return;
  }
  f.ships = f.ships.filter((x) => x !== ship);
  f.crew = Math.max(0, f.crew - SHIPS[ship.type].crew);
  if (!f.ships.length) {
    loseFleet(s, f, `${f.name} is lost with all hands in a storm. The ${ship.name} went down far from any shore.`);
    return;
  }
  damageCargo(f);
  log(s, 'peril', `The ${ship.name} of ${f.name} founders in a storm and sinks with her cargo.`);
}

/** Follow the fleet's orders as far as its movement points allow this season. */
function advance(world: World, s: GameState, f: Fleet) {
  const o = f.order;
  if (!o) return;
  const g = GRIDS[f.map];
  const m = world[f.map];
  const season = seasonOf(s.turn);
  const full = maxMoves(f, s);
  const rng = mulberry32(hashSeed(s.seed, s.turn, f.id, f.hex, f.moves * 2));
  while (o.path.length > 1 && s.fleets.includes(f)) {
    const next = o.path[1];
    const isDest = o.path.length === 2;
    const port = portAt(world, f.map, next, s);
    if (!isWater(m.terrain[next]) && !(isDest && port)) {
      // newly sighted land in the way: steer around it if the charts allow
      const dest = o.path[o.path.length - 1];
      const again = planFor(world, s, f, dest);
      if (!again || again.path.length < 2 || !isWater(m.terrain[again.path[1]]) && again.path.length > 2) {
        log(s, 'voyage', `${f.name} finds land barring the way and waits for new orders.`);
        f.order = null;
        return;
      }
      o.path = again.path;
      continue;
    }
    const cost = stepCost(g, m, season, f.hex, next, windwardOf(f, s)) * waterScale(world, f.map, next);
    if (f.moves < cost && f.moves < full) break;
    f.moves = Math.max(0, f.moves - cost);
    if (f.at) f.at = null;
    f.hex = next;
    f.movedThisTurn = true;
    o.path.shift();
    f.trail.push(next);
    reveal(world, s, f);
    const deep = m.deep[next] && deepPeril(s);
    if (deep) f.deepThisTurn = true;
    if (rng() < stormRisk(g, m, season, next) * (deep ? deepStorms(s, f) : 1)) {
      storm(s, f, rng);
      if (!s.fleets.includes(f)) return;
    }
    if (port && isDest) {
      f.at = port.id;
      log(s, 'voyage', `${f.name} drops anchor at ${port.name}${port.kind === 'native' ? `, among the ${port.people}` : ''}.`);
    }
  }
  if (o.path.length <= 1) {
    f.order = null;
    if (o.cross && isPortal(world, f)) {
      if (f.moves > 0) crossOcean(world, s, f.id);
      else f.order = { path: [f.hex], cross: true }; // cross at the start of next season
    }
  }
}

// ---------- end of turn ----------

export function endTurn(world: World, s: GameState): void {
  const rng = mulberry32(hashSeed(s.seed, s.turn, 7));

  // life at sea: food and water, foraging along a shore, scurvy
  for (const f of [...s.fleets]) {
    if (f.at) continue;
    const g = GRIDS[f.map];
    const deep = deepPeril(s) && (f.deepThisTurn || world[f.map].deep[f.hex]);
    const leader = leaderOf(s, f);
    // a good navigator rations well and finds water: sometimes a season costs no stores at all
    const thrifty = !deep && rng() < skill(leader, 'navigation') * 0.08; // but nothing saves food in the open ocean
    f.supplies -= (deep ? 2 : 1) - (thrifty ? 1 : 0);
    if (deep && f.supplies <= 2 && f.supplies >= 0) log(s, 'peril', `Far out in the open ocean, the stores of ${f.name} rot and the water turns foul.`);
    const shore = g.neighbors(f.hex).some((j) => {
      const t = world[f.map].terrain[j];
      return !isWater(t) && t !== T.Desert && t !== T.Tundra;
    });
    if (!f.movedThisTurn && shore && f.supplies < provisionsAbroad(f, s)) {
      f.supplies = Math.min(provisionsAbroad(f, s), f.supplies + 2);
      log(s, 'voyage', `${f.name} lies at anchor off the coast. Boats go ashore for fresh water, fruit and game.`);
    }
    if (f.supplies < 0) {
      f.supplies = 0;
      // starving in the open ocean, far from any landmark, is usually the end
      if (deep && rng() < 0.3) {
        loseFleet(s, f, `${f.name} sailed into the open ocean with empty stores and was never seen again.`);
        continue;
      }
      const lost = Math.max(1, Math.ceil(f.crew * (deep ? 0.45 : 0.25) * (leader?.trait === 'hardy' ? 0.7 : 1)));
      f.crew -= lost;
      if (f.crew <= 0) {
        loseFleet(s, f, `Hunger and scurvy finish the last of the crew of ${f.name}. The ships drift on, empty.`);
        continue;
      }
      log(s, 'peril', `The food is gone aboard ${f.name}. Scurvy and thirst take ${lost} sailors.`);
    }
  }
  // repairs come free in no port; idle storms at sea
  for (const f of [...s.fleets]) {
    if (f.at || f.movedThisTurn) continue;
    const deep = deepPeril(s) && world[f.map].deep[f.hex] ? deepStorms(s, f) : 1;
    if (rng() < stormRisk(GRIDS[f.map], world[f.map], seasonOf(s.turn), f.hex) * 4 * deep) storm(s, f, rng);
  }

  // city projects
  for (const city of Object.values(s.cities)) {
    const p = city.project;
    if (!p) continue;
    p.turnsLeft--;
    if (p.turnsLeft > 0) continue;
    city.project = null;
    const port = portById(world, city.id, s)!;
    if (p.kind === 'ship') {
      const ship = newShip(s, p.ship, rng);
      const n = s.fleets.length + 1;
      const fleet = makeFleet(s, `${port.name} Fleet ${n}`, [ship], port);
      s.fleets.push(fleet);
      log(s, 'court', `The ${SHIPS[p.ship].name.toLowerCase()} ${ship.name} is launched in ${port.name}.`);
    } else if (p.kind === 'unit') {
      s.units.push({ id: s.nextId++, type: p.unit, fleet: null, city: city.id, party: null });
      log(s, 'court', `${UNIT_INFO[p.unit].name} are ready in ${port.name}, waiting for a ship.`);
    } else {
      city.buildings[p.building]++;
      const b = BUILDINGS[p.building];
      log(s, 'court', `${port.name}: the ${b.name.toLowerCase()} ${city.buildings[p.building] > 1 ? 'are enlarged' : 'are finished'}. ${b.effect[city.buildings[p.building]]}`);
    }
  }

  // the colonies: work, eat, grow; they pay a little tax
  for (const c of s.colonies) Col.colonySeason(world, s, c, colLog(s));
  // taxes and market dues; universities feed the scholars
  let taxes = s.colonies.reduce((t, c) => t + c.pop * 5, 0);
  for (const c of Object.values(s.cities)) {
    taxes += (CITY_SPACE[c.id]?.taxes ?? 30) + c.buildings.market * 60;
    addResearch(s, c.buildings.university * 2);
  }
  s.treasury += taxes;

  // the court: commissions take effect, salaries, a learned court helps the scholars
  for (const p of s.people) {
    if (!p.alive || p.ready <= 0) continue;
    p.ready--;
    if (p.ready > 0) continue;
    if (p.rank === 'explorer' && p.unitType) {
      const at = p.city ?? 'seville';
      s.units.push({ id: s.nextId++, type: p.unitType, fleet: null, city: at, party: null });
      log(s, 'court', `${p.name} is ready to lead an expedition. ${UNIT_INFO[p.unitType].name} wait with them in ${portById(world, at, s)?.name}.`);
    } else {
      log(s, 'court', `${p.name} is ready to serve as ${RANK_INFO[p.rank].name.toLowerCase()}.`);
    }
  }
  const wages = Math.round(s.people.filter((p) => p.alive).reduce((t, p) => t + salary(p), 0));
  for (const p of s.people) if (p.alive && p.trait === 'learned' && p.fleet == null) addResearch(s, 1);

  // markets
  for (const [id, book] of Object.entries(s.markets)) {
    const port = portById(world, id, s);
    const european = port?.kind !== 'native';
    const boost = !european && has(s, 'factors') && s.discovered.includes(id) ? 1.5 : 1;
    for (const g of GOODS) {
      const m = book[g];
      if (!m) continue;
      const prod = m.production;
      m.production = prod * boost;
      tickMarket(m, european ? s.adoption[g] ?? 1 : 1);
      m.production = prod;
    }
  }

  // research: the court's scholars, plus what explorers brought back
  const r = s.research;
  const pts = basePoints(s) + r.pending;
  r.pending = 0;
  if (r.current) {
    r.progress += pts;
    const t = techById(r.current);
    if (r.progress >= t.cost) {
      r.known.push(t.id);
      r.progress = 0;
      r.current = TECHS.find((x) => techAvailable(s, x.id))?.id ?? null;
      log(s, 'court', `The court’s scholars master ${t.name.toLowerCase()}. ${t.effect}`);
      if (t.id === 'volta') {
        event(s, { kind: 'tech', title: 'Volta do mar', map: 'old', hex: portById(world, 'seville', s)!.hex,
          text: 'Pilots have learned to sail wide into the open ocean and find the winds that bring them home. The Mar Océano is still dangerous, but it can be crossed.' });
      }
    }
  }

  // wages and upkeep
  const upkeep = s.fleets.reduce((t, f) => t + f.ships.reduce((u, sh) => u + SHIPS[sh.type].upkeep, 0), 0)
    + s.units.reduce((t, u) => t + UNIT_SPECS[u.type].upkeep, 0);
  s.treasury -= upkeep + wages;
  if (s.treasury < 0) {
    const interest = Math.ceil(-s.treasury * 0.05);
    s.treasury -= interest;
    log(s, 'court', `The treasury is in debt. Genoese bankers charge ${interest} ducats in interest.`);
  }

  // the Crown's charge
  const before = s.turn;
  s.turn++;
  if (s.treasury >= GOAL.treasury && before < GOAL.turn && !s.chronicle.some((c) => c.text.startsWith('The Crown is delighted'))) {
    s.prestige += 50;
    log(s, 'court', `The Crown is delighted: ${s.treasury.toLocaleString('en')} ducats in the treasury before ${yearOf(GOAL.turn)}. Your name is spoken at court.`);
  } else if (s.turn === GOAL.turn && s.treasury < GOAL.treasury) {
    log(s, 'court', 'The Crown’s deadline has passed. The King is displeased, but the voyages go on.');
  }

  // each spring the court grows a year older, and new faces ask to join it
  if (seasonOf(s.turn) === 0) {
    for (const p of s.people) {
      if (!p.alive || rng() >= deathChance(p, s.turn)) continue;
      p.alive = false;
      p.died = s.turn;
      const f = p.fleet != null ? fleetById(s, p.fleet) : undefined;
      if (f) { f.leader = null; f.route = null; }
      for (const c of Object.values(s.cities)) if (c.governor === p.id) c.governor = null;
      for (const pt of s.parties) if (pt.leader === p.id) pt.leader = null;
      p.fleet = null;
      const where = f ? ` aboard ${f.name}, far from home` : '';
      log(s, 'court', `${p.name} has died${where}, aged ${ageOf(p, s.turn)}.${f ? ' The fleet has no leader now.' : ''}`);
    }
    newPetitioners(s, rng, () => s.nextId++);
  }

  // a new season: fresh movement, standing orders carry on
  for (const f of s.fleets) {
    f.moves = maxMoves(f, s);
    f.movedThisTurn = false;
    f.deepThisTurn = false;
    f.trail = [f.hex];
  }
  for (const f of [...s.fleets]) {
    if (!f.order || !s.fleets.includes(f)) continue;
    if (f.order.path.length <= 1 && f.order.cross) {
      f.order = null;
      crossOcean(world, s, f.id);
    } else advance(world, s, f);
  }
  // parties ashore march on
  for (const p of s.parties) {
    p.moves = Land.partyMaxMoves(s, p);
    p.trail = [p.hex];
    Land.advanceParty(world, s, p, landLog(s), landEvent(s), landResearch(s));
  }
  // merchants sail their routes
  const notes: string[] = [];
  for (const f of [...s.fleets]) if (s.fleets.includes(f)) runRoute(world, s, f, notes);
  if (notes.length) log(s, 'trade', notes.join(' '));
  s.prestige = Math.round(s.prestige * 100) / 100;
}

export { dateLabel };
