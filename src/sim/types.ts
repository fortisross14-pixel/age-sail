import type { GoodId } from '../data/goods';
import type { ShipType } from '../data/ships';
import type { TechId } from '../data/tech';
import type { BuildingId, ResourceId } from '../data/city';
import type { CrownId } from '../data/rivals';
import type { RealmId } from '../data/realms';
import type { CitySize } from '../data/europe';
import type { MapId } from './hex';
import { HALF_YEAR_TURNS_UNTIL } from '../data/eras';

export type { MapId };
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const START_YEAR = 1492;

export enum Fog { Unknown = 0, Charted = 1, Explored = 2 }

export interface WindField {
  /** direction the wind blows toward, radians in map space (+x east, +y south) */
  angle: Float32Array;
  /** 0..1 */
  strength: Float32Array;
}

export interface PortDef {
  id: string;
  name: string;
  map: MapId;
  hex: number;
  kind: 'home' | 'foreign' | 'native' | 'colony';
  nation?: string;
  /** Old World cities: the realm that holds it, its size, and whether ships can reach it */
  realm?: RealmId;
  size?: CitySize;
  inland?: boolean;
  /** for native trading sites: the people who trade there */
  people?: string;
  blurb: string;
}

export interface MapData {
  id: MapId;
  terrain: Uint8Array;
  elevation: Float32Array;
  /** rivers as hex paths, source first, mouth last */
  rivers: number[][];
  /** one field per season */
  wind: WindField[];
  ports: PortDef[];
  decorCities: { name: string; hex: number }[];
  islandNames: { name: string; hex: number }[];
  /** hexes where sea monsters are drawn on the unknown ocean */
  monsters: { kind: 'serpent' | 'whale'; hex: number }[];
  /** open-water hexes on the board edge that lead to the other board */
  portals: number[];
  /** realm holding each hex (Old World): realmIndex code, 0 for none */
  realm: Uint8Array;
  /** 1 where a hex belongs to a large landmass (not a small island) */
  mainland: Uint8Array;
  /** 1 for open ocean far from any land, where ships without long-distance navigation suffer */
  deep: Uint8Array;
  /** hidden resources, found only by parties on foot: index into RESOURCE_IDS + 1, 0 for none */
  resource: Uint8Array;
  rumours: Rumour[];
  nations: NationDef[];
}

export interface World {
  seed: number;
  /** the crown the player leads: decides which cities are home */
  crown: CrownId;
  old: MapData;
  new: MapData;
}

export interface MarketGood {
  stock: number;
  base: number;
  ref: number;
  consumption: number;
  production: number;
  /** price at the end of each recent turn, newest last */
  history: number[];
}

export interface Ship {
  id: number;
  type: ShipType;
  name: string;
  hull: number;
}

export type Skill = 'navigation' | 'military' | 'commerce' | 'construction' | 'diplomacy';
export const SKILLS: Skill[] = ['navigation', 'military', 'commerce', 'construction', 'diplomacy'];
export type Rank = 'courtier' | 'explorer' | 'merchant' | 'governor';
export type UnitType = 'colonist' | 'missionary' | 'infantry' | 'swordsman' | 'archer' | 'musketeer' | 'cavalry' | 'cannon';
export type TraitId = 'learned' | 'hardy' | 'bold' | 'shrewd' | 'pious' | 'ambitious';

/** A member of the court. */
export interface Person {
  id: number;
  name: string;
  born: number;
  /** 0..5 each */
  skills: Record<Skill, number>;
  trait: TraitId;
  rank: Rank;
  /** seasons until a new rank takes effect (0 = ready) */
  ready: number;
  /** the unit that came with an explorer's rank */
  unitType: UnitType | null;
  /** fleet they lead */
  fleet: number | null;
  /** home city where they are when not at sea (or the city they govern) */
  city: string | null;
  alive: boolean;
  died?: number;
  /** hexes of new land charted, people met */
  discoveries: number;
}

export interface Unit {
  id: number;
  type: UnitType;
  /** aboard this fleet, ashore in this party, waiting in this home city, or stationed in this colony */
  fleet: number | null;
  city: string | null;
  party: number | null;
  colony?: string | null;
  /** battles survived and won: 0, 1 or 2 (veteran ranks) */
  vet?: number;
}

/** People and units ashore, exploring on foot. */
export interface Party {
  id: number;
  name: string;
  map: MapId;
  hex: number;
  leader: number | null;
  moves: number;
  order: number[] | null;
  trail: number[];
  /** food carried, in rations (a company eats one a season, half of it foraged) */
  food: number;
}

export type ColonyLevel = 'outpost' | 'town' | 'city';

/** A settlement of your own across the sea. */
export interface Colony {
  id: string;
  name: string;
  map: MapId;
  hex: number;
  founded: number;
  /** colonists living and working here */
  pop: number;
  level: ColonyLevel;
  /** goods in the colony's warehouse */
  stock: Partial<Record<GoodId, number>>;
  /** births minus deaths so far, in colonists: a whole one joins (or leaves) the colony */
  growth: number;
  /** settlers who arrived this turn and are still seasoning: they eat but do not work yet */
  newcomers: number;
  /** 0 none, 1 palisade, 2 stone walls, 3 star fort */
  walls: number;
  /** 0..100: how loyal the settlers are to the Crown */
  loyalty: number;
  /** a royal charter: self-government and half taxes, in return for loyalty */
  charter: boolean;
  unrest: boolean;
  /** last season's account, for the player */
  last: {
    produced: Partial<Record<GoodId, number>>;
    worked: { hex: number; good: GoodId; amount: number }[];
    hungry: boolean;
    discontent: boolean;
    luxuries: boolean;
    /** yearly births and deaths, as shares of the colony, for the player */
    births: number;
    deaths: number;
    /** soldiers and friars fed, and newcomers who died seasoning */
    garrison: number;
    seasoned: number;
    besieged: boolean;
  };
}

/** A native people: their trading ground on the coast and their villages inland. Fixed for the game. */
export interface NationDef {
  id: string;
  people: string;
  map: MapId;
  /** the trading ground (a port id) and its hex */
  site: string;
  siteHex: number;
  villages: number[];
  /** fighting strength at the start */
  warriors: number;
  /** one great empire per board */
  empire: boolean;
  rivals: string[];
}

export type Relation = 'peace' | 'allied' | 'war' | 'subject';

/** How a people stands with the Crown, season by season. */
export interface NativeState {
  met: boolean;
  /** -100 hostile .. 100 friendly */
  attitude: number;
  relation: Relation;
  warriors: number;
  /** 0..1 */
  converted: number;
  post: boolean;
  mission: boolean;
  /** villages taken or abandoned */
  lost: number[];
  contact: number | null;
  epidemic: boolean;
  /** what they remember of you: the reasons behind their attitude */
  memory: Memory[];
  /** a siege they are laying to one of your colonies */
  siege: { colony: string; since: number } | null;
}

/** One remembered deed, good or bad, and how much it still weighs. */
export interface Memory { why: string; amount: number; turn: number }

export type { CrownId };

/** How a rival crown stands with Castile. */
export interface RivalState {
  attitude: number;
  relation: 'peace' | 'war';
  /** season when their next colony expedition sails */
  next: number;
  /** abstract earnings from trade, for their score */
  revenue: number;
  /** trading posts they hold at native grounds (site ids) */
  posts: string[];
  warSince: number | null;
}

/** A rival colony: grows by itself, can be raided or taken. */
export interface RivalColony {
  id: string;
  crown: CrownId;
  name: string;
  map: MapId;
  hex: number;
  pop: number;
  level: ColonyLevel;
  founded: number;
  garrison: number;
  /** the player has seen it */
  seen: boolean;
}

/** A rival ship on the map, sailing with a purpose. */
export interface RivalShip {
  id: number;
  crown: CrownId;
  map: MapId;
  hex: number;
  kind: 'settlers' | 'trader' | 'privateer';
  /** where it is going: a hex to settle, a port to trade at, or home */
  target: number | null;
  path: number[] | null;
  trail: number[];
  strength: number;
}

/** A rumour of ruins or a lost city, somewhere inland. */
export interface Rumour { hex: number; kind: 'ruins' | 'city' | 'shrine' }

export interface TradeStop {
  port: string;
  /** goods to sell here, all of them */
  sell: GoodId[];
  /** goods to buy here, up to qty, never above maxPrice */
  buy: { good: GoodId; qty: number; maxPrice: number | null }[];
}

export interface TradeRoute {
  stops: TradeStop[];
  /** index of the stop the fleet is heading for */
  next: number;
  active: boolean;
}

export interface Order {
  /** remaining path, current hex first */
  path: number[];
  /** cross to the other board on arrival (path ends on a portal) */
  cross: boolean;
}

export interface Fleet {
  id: number;
  name: string;
  ships: Ship[];
  map: MapId;
  hex: number;
  /** port id when docked */
  at: string | null;
  cargo: Partial<Record<GoodId, number>>;
  crew: number;
  /** seasons of food and water aboard */
  supplies: number;
  /** movement points left this turn */
  moves: number;
  order: Order | null;
  /** the courtier in command */
  leader: number | null;
  route: TradeRoute | null;
  /** hexes moved through most recently, for animation */
  trail: number[];
  movedThisTurn: boolean;
  /** sailed through deep ocean this season */
  deepThisTurn: boolean;
}

export type ProjectKind = { kind: 'ship'; ship: ShipType } | { kind: 'building'; building: BuildingId } | { kind: 'unit'; unit: UnitType };
export type Project = ProjectKind & { turnsLeft: number; total: number };

export interface City {
  id: string;
  size: CitySize;
  /** inland cities build and train but have no quay: no docks, and their units march to the nearest port */
  inland: boolean;
  /** base taxes a season, before market dues */
  taxes: number;
  buildings: Record<BuildingId, number>;
  project: Project | null;
  governor: number | null;
}

export interface ChronicleEntry {
  turn: number;
  text: string;
  kind: 'discovery' | 'trade' | 'voyage' | 'peril' | 'court';
}

/** A big moment shown as a card: the first landfall, meeting a people. */
export interface EventChoice { label: string; hint?: string }

export interface GameEvent {
  kind: 'landfall' | 'people' | 'lost' | 'tech' | 'story' | 'era' | 'end' | 'battle';
  /** for battles: the report */
  battle?: BattleReport;
  /** for stories with choices: which story, and what it is about */
  story?: string;
  ctx?: Record<string, string | number>;
  choices?: EventChoice[];
  title: string;
  text: string;
  map: MapId;
  hex: number;
}

/** One side of a battle, as the report shows it. */
export interface BattleSide {
  name: string;
  /** a courtier who led them */
  general?: number;
  /** a crown's arms, or a native people */
  crown?: CrownId;
  nation?: string;
  /** companies by type: how many fought, how many were lost */
  units: { type: UnitType; n: number; lost: number }[];
  /** native warriors: how many fought, how many fell */
  warriors?: { n: number; lost: number };
  walls?: number;
}

/** What happened in a battle, round by round, for the report. */
export interface BattleReport {
  attacker: BattleSide;
  defender: BattleSide;
  /** damage each side dealt in the fire, melee and pursuit rounds */
  rounds: { name: 'Fire' | 'Melee' | 'Pursuit'; atk: number; def: number }[];
  /** morale left at the end, 0..100 */
  morale: { atk: number; def: number };
  attackerWon: boolean;
  stance: Stance;
  terrain: string;
}

export type Stance = 'assault' | 'steady';

export interface GameState {
  seed: number;
  /** the crown you lead */
  crown: CrownId;
  turn: number;
  treasury: number;
  prestige: number;
  fog: Record<MapId, number[]>;
  fleets: Fleet[];
  people: Person[];
  /** people asking for a place at court, and what they ask */
  petitioners: { person: Person; cost: number }[];
  units: Unit[];
  parties: Party[];
  /** land walked and surveyed by parties: resources there are known */
  surveyed: Record<MapId, number[]>;
  /** rumours already followed up */
  rumoursDone: Record<MapId, number[]>;
  colonies: Colony[];
  /** colonies that broke away from the Crown */
  freeStates: { id: string; name: string; map: MapId; hex: number; pop: number; level: ColonyLevel; since: number }[];
  natives: Record<string, NativeState>;
  /** the game ends (with a final reckoning) after this season; play may go on */
  endTurn: number;
  ended: boolean;
  taxRate: 'low' | 'normal' | 'high';
  loans: { perSeason: number; left: number }[];
  /** stories already told, so they are not repeated too often */
  told: Record<string, number>;
  rivals: Record<CrownId, RivalState>;
  rivalColonies: RivalColony[];
  rivalShips: RivalShip[];
  /** ducats earned from all sales, ever: part of the score */
  revenue: number;
  /** resources found, for the record */
  finds: { map: MapId; hex: number; resource: ResourceId; turn: number; by: string }[];
  cities: Record<string, City>;
  markets: Record<string, Partial<Record<GoodId, MarketGood>>>;
  /** native trading sites found so far */
  discovered: string[];
  /** 0..1 per good: how used to it Europe has become */
  adoption: Partial<Record<GoodId, number>>;
  chronicle: ChronicleEntry[];
  events: GameEvent[];
  nextId: number;
  /** true once anyone has sighted New World land */
  newWorldFound: boolean;
  research: {
    known: TechId[];
    current: TechId | null;
    /** points put into the current subject */
    progress: number;
    /** points earned from discoveries this season, added at the end of the turn */
    pending: number;
  };
}

export const seasonOf = (turn: number) => turn % 4;
export const yearOf = (turn: number) => START_YEAR + Math.floor(turn / 4);
export const dateLabel = (turn: number) => `${SEASONS[seasonOf(turn)]} ${yearOf(turn)}`;
/** Seasons in the player's turn that starts at this season: two (half a year) early on, then four. */
export const turnStride = (turn: number) => (yearOf(turn) < HALF_YEAR_TURNS_UNTIL ? 2 : 4);
/** The season the next player turn starts at. */
export const nextTurnStart = (turn: number) => { const k = turnStride(turn); return turn + k - (turn % k); };
/** The season the player's current turn started at, the one before this. */
export const prevTurnStart = (turn: number) => Math.max(0, turn - turnStride(Math.max(0, turn - 1)));
/** How a player's turn is named: "Spring 1492" and "Autumn 1492" in the half-year era, then "1551". */
export const turnLabel = (turn: number) => (turnStride(turn) === 2 ? `${seasonOf(turn) < 2 ? 'Spring' : 'Autumn'} ${yearOf(turn)}` : `${yearOf(turn)}`);
/** Player turns from the start of the game to a season. */
export const turnsBetween = (from: number, to: number) => { let n = 0; for (let t = from; t < to; t = nextTurnStart(t)) n++; return n; };

/** A colony's account before its first season. */
export const emptyAccount = (): Colony['last'] => ({ produced: {}, worked: [], hungry: false, discontent: false, luxuries: false, births: 0, deaths: 0, garrison: 0, seasoned: 0, besieged: false });
