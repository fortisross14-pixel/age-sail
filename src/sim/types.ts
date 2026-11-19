import type { GoodId } from '../data/goods';
import type { ShipType } from '../data/ships';
import type { TechId } from '../data/tech';
import type { MapId } from './hex';

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
  kind: 'home' | 'foreign' | 'native';
  nation?: string;
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
  /** 1 where a hex belongs to a large landmass (not a small island) */
  mainland: Uint8Array;
  /** 1 for open ocean far from any land, where ships without long-distance navigation suffer */
  deep: Uint8Array;
}

export interface World {
  seed: number;
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
export type UnitType = 'colonist' | 'infantry' | 'missionary';
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
  /** aboard this fleet, or waiting in this home city */
  fleet: number | null;
  city: string | null;
}

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

export type ProjectKind = { kind: 'ship'; ship: ShipType } | { kind: 'port' };
export type Project = ProjectKind & { turnsLeft: number; total: number };

export interface City {
  id: string;
  port: number;
  project: Project | null;
  governor: number | null;
}

export interface ChronicleEntry {
  turn: number;
  text: string;
  kind: 'discovery' | 'trade' | 'voyage' | 'peril' | 'court';
}

/** A big moment shown as a card: the first landfall, meeting a people. */
export interface GameEvent {
  kind: 'landfall' | 'people' | 'lost' | 'tech';
  title: string;
  text: string;
  map: MapId;
  hex: number;
}

export interface GameState {
  seed: number;
  turn: number;
  treasury: number;
  prestige: number;
  fog: Record<MapId, number[]>;
  fleets: Fleet[];
  people: Person[];
  /** people asking for a place at court, and what they ask */
  petitioners: { person: Person; cost: number }[];
  units: Unit[];
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
