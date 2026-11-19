import type { GoodId } from '../data/goods';
import type { ShipType } from '../data/ships';
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

export interface Explorer {
  id: number;
  name: string;
  /** fleet they lead, or the home port where they wait */
  fleet: number | null;
  waitingAt: string | null;
  alive: boolean;
  discoveries: number;
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
  explorer: number | null;
  /** hexes moved through most recently, for animation */
  trail: number[];
  movedThisTurn: boolean;
}

export type ProjectKind = { kind: 'ship'; ship: ShipType } | { kind: 'port' } | { kind: 'explorer' };
export type Project = ProjectKind & { turnsLeft: number; total: number };

export interface City {
  id: string;
  port: number;
  project: Project | null;
}

export interface ChronicleEntry {
  turn: number;
  text: string;
  kind: 'discovery' | 'trade' | 'voyage' | 'peril' | 'court';
}

/** A big moment shown as a card: the first landfall, meeting a people. */
export interface GameEvent {
  kind: 'landfall' | 'people' | 'lost';
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
  explorers: Explorer[];
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
}

export const seasonOf = (turn: number) => turn % 4;
export const yearOf = (turn: number) => START_YEAR + Math.floor(turn / 4);
export const dateLabel = (turn: number) => `${SEASONS[seasonOf(turn)]} ${yearOf(turn)}`;
