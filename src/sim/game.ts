import { GOODS, GOOD_INFO, type GoodId } from '../data/goods';
import { SHIPS, SHIP_NAMES, PORT_UPGRADE, EXPLORER_COST, type ShipType } from '../data/ships';
import { EUROPEAN_PORTS, KNOWN_SOUTH, ATLANTIC_ISLANDS } from '../data/europe';
import { TECHS, techById, type TechId } from '../data/tech';
import { T, isWater } from '../data/terrain';
import { GRIDS, type MapId } from './hex';
import { generateWorld } from './mapgen';
import { makeMarket, tickMarket, buyCost, sellValue, type MarketBook } from './market';
import { mulberry32, hashSeed, int, type Rng } from './rng';
import { maxMoves as baseMoves, crewNeeded, windwardOf as baseWindward, planRoute, stepCost, stormRisk, type RoutePlan } from './sailing';
import { explorerName } from './names';
import {
  Fog, dateLabel, seasonOf, yearOf,
  type Fleet, type GameState, type World, type PortDef, type ChronicleEntry, type MapData, type ProjectKind, type GameEvent,
} from './types';

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

/** Movement points a fleet gets each season, with the Crown's knowledge. */
export const maxMoves = (f: Fleet, s?: GameState) => baseMoves(f) + (s && has(s, 'astrolabe') ? 2 : 0);
export const windwardOf = (f: Fleet, s?: GameState) => Math.min(1, baseWindward(f) + (s && has(s, 'lateen') ? 0.15 : 0));
/** Without long-distance navigation the open ocean is a death trap. */
export const deepPeril = (s: GameState) => !has(s, 'volta');
const spread = (s: GameState) => (has(s, 'bookkeeping') ? 0.04 : 0.08);
/** The Crown's charge for v0.1: a treasury target by a deadline. */
export const GOAL = { treasury: 20000, turn: 4 * 10 } as const;

// ---------- helpers ----------

export const mapData = (w: World, id: MapId): MapData => w[id];
export const allPorts = (w: World): PortDef[] => [...w.old.ports, ...w.new.ports];
export const portById = (w: World, id: string) => allPorts(w).find((p) => p.id === id);
export const portAt = (w: World, map: MapId, hex: number) => w[map].ports.find((p) => p.hex === hex);
export const fleetById = (s: GameState, id: number) => s.fleets.find((f) => f.id === id);
export const explorerOf = (s: GameState, f: Fleet) => (f.explorer != null ? s.explorers.find((e) => e.id === f.explorer) : undefined);

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
  const port = f.at ? portById(world, f.at) : undefined;
  return port?.kind === 'home' ? provisionsMax(f, s) : provisionsAbroad(f, s);
}
export function fleetSight(f: Fleet, s?: GameState): number {
  return Math.max(...f.ships.map((x) => SHIPS[x.type].sight)) + (f.explorer != null ? 2 : 0) + (s && has(s, 'portolan') ? 1 : 0);
}
export const isPortal = (w: World, f: Fleet) => w[f.map].portals.includes(f.hex);

/** May this fleet sail into uncharted water (and, before the New World is found, across the ocean)? */
export const canExplore = (f: Fleet) => f.explorer != null;
export function canCross(s: GameState, f: Fleet) {
  return f.map === 'new' || s.newWorldFound || canExplore(f);
}

/** Cost to fill supplies (and, in a home port, sign on missing crew). */
export function provisionCost(world: World, f: Fleet, s?: GameState): number {
  const port = f.at ? portById(world, f.at) : undefined;
  if (!port) return 0;
  const perSeason = Math.max(4, f.crew / 2) * (port.kind === 'native' ? 1.6 : 1);
  let cost = Math.ceil(Math.max(0, provisionCap(world, f, s) - f.supplies) * perSeason);
  if (port.kind === 'home') cost += Math.max(0, crewNeeded(f) - f.crew) * 10;
  return cost;
}

export function repairCost(world: World, f: Fleet): number {
  const port = f.at ? portById(world, f.at) : undefined;
  if (!port || port.kind === 'native') return 0;
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
  const book: MarketBook = { tools: makeMarket(55, 20, 6, 0, int(rng, 2, 8)) };
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
    moves: 0, order: null, explorer: null, trail: [], movedThisTurn: false, deepThisTurn: false,
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
      const stock = g === 'tools' ? ref : g === 'furs' || g === 'dyes' || g === 'gold' ? ref * 0.6 : 1;
      book[g] = makeMarket(base, ref, cons, prod, stock);
    }
    markets[p.id] = book;
  }
  for (const p of allPorts(world)) if (p.kind === 'native') markets[p.id] = nativeMarket(world, p, rng);
  const cities: GameState['cities'] = {};
  for (const p of EUROPEAN_PORTS) if (p.kind === 'home') cities[p.id] = { id: p.id, port: p.port ?? 1, project: null };

  const state: GameState = {
    seed, turn: 0, treasury: 5000, prestige: 0,
    fog: { old: initialOldFog(world), new: new Array(GRIDS.new.N).fill(Fog.Unknown) },
    fleets: [], explorers: [], cities, markets, discovered: [],
    adoption: { furs: 1, dyes: 1, gold: 1, tools: 1, spices: 1, sugar: 0.5, tobacco: 0.05, cacao: 0.1 },
    chronicle: [], events: [], nextId: 1, newWorldFound: false,
    research: { known: [], current: 'portolan', progress: 0, pending: 0 },
  };
  const seville = portById(world, 'seville')!;
  const fleet = makeFleet(state, 'First Expedition', [newShip(state, 'caravel', rng), newShip(state, 'carrack', rng)], seville);
  const explorer = { id: state.nextId++, name: explorerName(rng), fleet: fleet.id, waitingAt: null, alive: true, discoveries: 0 };
  fleet.explorer = explorer.id;
  state.explorers.push(explorer);
  state.fleets.push(fleet);
  log(state, 'court', `The Crown of Castile grants ${explorer.name} two ships and a charter: chart the coasts beyond Cape Bojador, open trade with the peoples there, and fill the treasury. Pilots say no ship that sails far into the open Mar Océano comes back.`);
  log(state, 'court', `The Crown asks for ${GOAL.treasury.toLocaleString('en')} ducats in the treasury by ${dateLabel(GOAL.turn)}.`);
  return { world, state };
}

// ---------- commands ----------

export type CommandResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): CommandResult => ({ ok: false, error });

function dockedMarket(world: World, s: GameState, f: Fleet, g: GoodId) {
  if (!f.at) return { error: 'The fleet must be in port to trade.' };
  const m = s.markets[f.at]?.[g];
  if (!m) return { error: `${portById(world, f.at)?.name} does not trade in ${GOOD_INFO[g].name.toLowerCase()}.` };
  return { m };
}

export function buy(world: World, s: GameState, fleetId: number, g: GoodId, qty: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  const r = dockedMarket(world, s, f, g);
  if ('error' in r) return fail(r.error!);
  const m = r.m!;
  qty = Math.min(qty, Math.floor(m.stock), cargoCapacity(f) - cargoUsed(f));
  while (qty > 0 && buyCost(m, qty, spread(s)) > s.treasury) qty--;
  if (qty <= 0) return fail('Nothing to buy: no stock, no hold space, or no money.');
  const cost = buyCost(m, qty, spread(s));
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
  const value = sellValue(m, qty, spread(s));
  s.treasury += value;
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
  if (portById(world, f.at)!.kind === 'home') f.crew = Math.max(f.crew, crewNeeded(f));
  return { ok: true, message: `Provisioned for ${cost} ducats.` };
}

export function repair(world: World, s: GameState, fleetId: number): CommandResult {
  const f = fleetById(s, fleetId);
  if (!f) return fail('No such fleet.');
  const cost = repairCost(world, f);
  if (cost <= 0) return fail('Repairs need a European port.');
  if (cost > s.treasury) return fail(`Repairs cost ${cost} ducats. The treasury cannot pay.`);
  s.treasury -= cost;
  for (const sh of f.ships) sh.hull = 100;
  return { ok: true, message: `Repaired for ${cost} ducats.` };
}

export function projectCost(p: ProjectKind, cityPort: number): { cost: number; build: number; allowed: boolean; why?: string } {
  if (p.kind === 'ship') {
    const spec = SHIPS[p.ship];
    return { cost: spec.cost, build: spec.build, allowed: cityPort >= spec.port, why: cityPort < spec.port ? `Needs a level ${spec.port} port.` : undefined };
  }
  if (p.kind === 'port') {
    const up = PORT_UPGRADE[cityPort + 1];
    return up ? { cost: up.cost, build: up.build, allowed: true } : { cost: 0, build: 0, allowed: false, why: 'The port is as large as it can be.' };
  }
  return { cost: EXPLORER_COST.cost, build: EXPLORER_COST.build, allowed: true };
}

export function startProject(s: GameState, cityId: string, p: ProjectKind): CommandResult {
  const city = s.cities[cityId];
  if (!city) return fail('Only your own cities can build.');
  if (city.project) return fail('This city is already busy with a project.');
  const c = projectCost(p, city.port);
  if (!c.allowed) return fail(c.why ?? 'Not possible.');
  if (c.cost > s.treasury) return fail(`That costs ${c.cost} ducats.`);
  s.treasury -= c.cost;
  city.project = { ...p, turnsLeft: c.build, total: c.build };
  return { ok: true, message: `Work begins. Ready in ${c.build} season${c.build > 1 ? 's' : ''}.` };
}

export function assignExplorer(s: GameState, explorerId: number, fleetId: number): CommandResult {
  const e = s.explorers.find((x) => x.id === explorerId && x.alive);
  const f = fleetById(s, fleetId);
  if (!e || !f) return fail('No such explorer or fleet.');
  if (f.explorer != null) return fail(`${f.name} already has a leader.`);
  if (!e.waitingAt || f.at !== e.waitingAt) return fail('The explorer must be in the same port as the fleet.');
  e.fleet = f.id;
  e.waitingAt = null;
  f.explorer = e.id;
  return { ok: true, message: `${e.name} takes command of ${f.name}.` };
}

export function mergeFleets(s: GameState, fromId: number, intoId: number): CommandResult {
  const a = fleetById(s, fromId), b = fleetById(s, intoId);
  if (!a || !b || a === b) return fail('No such fleets.');
  if (a.map !== b.map || a.hex !== b.hex) return fail('Fleets must be in the same place to join.');
  if (a.ships.length + b.ships.length > 8) return fail('A fleet can have at most 8 ships.');
  b.ships.push(...a.ships);
  b.crew += a.crew;
  b.supplies = Math.min(b.supplies, a.supplies);
  for (const g of GOODS) if (a.cargo[g]) b.cargo[g] = (b.cargo[g] ?? 0) + a.cargo[g]!;
  b.moves = Math.min(b.moves, a.moves);
  if (b.explorer == null && a.explorer != null) {
    b.explorer = a.explorer;
    const e = s.explorers.find((x) => x.id === a.explorer);
    if (e) e.fleet = b.id;
  } else if (a.explorer != null) {
    const e = s.explorers.find((x) => x.id === a.explorer);
    if (e) { e.fleet = null; e.waitingAt = b.at; }
  }
  s.fleets = s.fleets.filter((f) => f !== a);
  return { ok: true, message: `${a.name} joins ${b.name}.` };
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
    supplies: f.supplies, moves: f.moves, order: null, explorer: null, trail: [], movedThisTurn: f.movedThisTurn, deepThisTurn: f.deepThisTurn,
  };
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
    explorer: canExplore(f), ports: new Set(m.ports.map((p) => p.hex)), fog: s.fog[f.map],
    movesLeft: f.moves, movesMax: maxMoves(f, s), windward: windwardOf(f, s),
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
  if (!p) return fail(canExplore(f) ? 'No sea route there.' : 'No charted route there. Only a fleet led by an explorer may sail into unknown waters.');
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
  const explorer = explorerOf(s, f);
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
  const e = explorerOf(s, f);
  if (e) {
    e.alive = false;
    e.fleet = null;
  }
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
    const port = portAt(world, f.map, next);
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
    const cost = stepCost(g, m, season, f.hex, next, windwardOf(f, s));
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
    if (rng() < stormRisk(g, m, season, next) * (deep ? 3 : 1)) {
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
    f.supplies -= deep ? 2 : 1;
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
      const lost = Math.max(1, Math.ceil(f.crew * (deep ? 0.45 : 0.25)));
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
    const deep = deepPeril(s) && world[f.map].deep[f.hex] ? 3 : 1;
    if (rng() < stormRisk(GRIDS[f.map], world[f.map], seasonOf(s.turn), f.hex) * 4 * deep) storm(s, f, rng);
  }

  // city projects
  for (const city of Object.values(s.cities)) {
    const p = city.project;
    if (!p) continue;
    p.turnsLeft--;
    if (p.turnsLeft > 0) continue;
    city.project = null;
    const port = portById(world, city.id)!;
    if (p.kind === 'ship') {
      const ship = newShip(s, p.ship, rng);
      const n = s.fleets.length + 1;
      const fleet = makeFleet(s, `${port.name} Fleet ${n}`, [ship], port);
      s.fleets.push(fleet);
      log(s, 'court', `The ${SHIPS[p.ship].name.toLowerCase()} ${ship.name} is launched in ${port.name}.`);
    } else if (p.kind === 'port') {
      city.port++;
      log(s, 'court', `${port.name}’s harbour works are finished. The port is now level ${city.port}.`);
    } else {
      const e = { id: s.nextId++, name: explorerName(rng, s.explorers.map((x) => x.name)), fleet: null, waitingAt: city.id, alive: true, discoveries: 0 };
      s.explorers.push(e);
      log(s, 'court', `${e.name} arrives in ${port.name}, eager to lead an expedition.`);
    }
  }

  // markets
  for (const [id, book] of Object.entries(s.markets)) {
    const port = portById(world, id);
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
        event(s, { kind: 'tech', title: 'Volta do mar', map: 'old', hex: portById(world, 'seville')!.hex,
          text: 'Pilots have learned to sail wide into the open ocean and find the winds that bring them home. The Mar Océano is still dangerous, but it can be crossed.' });
      }
    }
  }

  // wages and upkeep
  const upkeep = s.fleets.reduce((t, f) => t + f.ships.reduce((u, sh) => u + SHIPS[sh.type].upkeep, 0), 0);
  s.treasury -= upkeep;
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
  s.prestige = Math.round(s.prestige * 100) / 100;
}

export { dateLabel };
