import type { GoodId } from './goods';

/** Simplified Old World coastlines as [lon, lat] rings. Stylized, not survey-grade. */
export const OLD_WORLD: [number, number][][] = [
  // Continental Europe (Iberia, France, Low Countries, Germany, Italy)
  [
    [-5.6, 36.1], [-2.0, 36.7], [0.0, 38.6], [0.4, 40.4], [3.2, 41.9], [4.0, 43.4], [6.2, 43.1], [8.9, 44.4],
    [10.3, 43.6], [12.0, 41.8], [14.3, 40.7], [15.7, 38.1], [17.1, 39.0], [18.5, 40.1], [16.2, 41.4], [13.8, 43.4],
    [12.4, 44.6], [13.7, 45.7], [20.0, 45.7], [20.0, 54.6], [11.0, 54.3], [9.6, 54.7], [8.4, 55.6], [8.6, 57.1],
    [10.6, 57.7], [10.5, 56.1], [9.0, 54.0], [8.5, 53.6], [7.0, 53.5], [5.0, 53.4], [4.6, 52.4], [3.6, 51.5],
    [2.4, 51.1], [1.6, 50.2], [0.1, 49.5], [-1.3, 49.7], [-1.8, 48.7], [-4.8, 48.4], [-4.3, 47.8], [-2.2, 47.2],
    [-1.3, 46.0], [-1.3, 44.5], [-1.8, 43.4], [-4.0, 43.5], [-8.0, 43.8], [-9.3, 43.0], [-8.9, 41.9], [-8.7, 40.9],
    [-9.5, 38.7], [-8.8, 38.0], [-9.0, 37.0], [-7.4, 37.2], [-6.3, 36.6],
  ],
  // Great Britain
  [
    [-5.7, 50.1], [-3.4, 50.5], [-1.0, 50.8], [1.4, 51.2], [1.8, 52.6], [0.3, 53.4], [-0.4, 54.5], [-1.6, 55.6],
    [-2.0, 57.1], [-1.8, 57.6], [-3.2, 58.6], [-5.0, 58.6], [-6.2, 57.5], [-5.6, 56.2], [-4.9, 55.0], [-3.2, 54.1],
    [-3.0, 53.4], [-4.6, 53.3], [-4.1, 52.3], [-5.3, 51.8], [-3.1, 51.4], [-4.5, 51.0],
  ],
  // Ireland
  [[-6.0, 52.1], [-6.1, 53.3], [-5.8, 54.6], [-7.3, 55.3], [-8.6, 54.6], [-10.1, 53.5], [-9.9, 52.0], [-8.3, 51.6]],
  // Scandinavia (southern tip)
  [[5.5, 58.2], [7.5, 58.0], [10.5, 59.0], [11.5, 58.2], [12.6, 56.2], [20.0, 56.0], [20.0, 62.5], [5.0, 62.5], [5.0, 60.0]],
  // North Africa down to the Atlantic coast of Morocco. South of 30.5N the coast is generated.
  [
    [20.0, 32.5], [11.0, 33.4], [10.4, 36.9], [9.4, 37.3], [3.0, 36.8], [-1.0, 35.6], [-5.4, 35.8], [-6.0, 35.4],
    [-6.8, 34.0], [-8.6, 33.2], [-9.8, 30.8], [-10.0, 29.0], [20.0, 29.0],
  ],
  // Mediterranean islands
  [[8.4, 39.0], [9.8, 39.2], [9.7, 41.0], [9.5, 43.0], [8.6, 42.5], [8.4, 40.6]], // Corsica & Sardinia
  [[12.4, 38.1], [15.6, 38.3], [15.1, 36.7], [12.4, 37.6]], // Sicily
];

/** Small Atlantic islands placed as single hexes: [name, lat, lon] */
export const ATLANTIC_ISLANDS: [string, number, number][] = [
  ['Madeira', 32.7, -17.0],
  ['Mallorca', 39.6, 2.9], ['Menorca', 40.0, 4.0], ['Ibiza', 38.9, 1.4],
];

/** Hexes forced to open water so the straits stay passable: [lat, lon] */
export const STRAITS: [number, number][] = [
  // Gibraltar
  [36.0, -6.6], [36.0, -6.0], [36.0, -5.4], [36.0, -4.8], [36.0, -4.2],
  // Dover
  [51.0, 1.5], [51.0, 2.1],
  // Messina and Sicily
  [38.2, 15.6], [37.4, 11.6],
];

/** South of this latitude the Old World board is generated per game. */
export const FIXED_SOUTH = 30.5;
/** In 1492 Iberian pilots know the coast down to about here. */
export const KNOWN_SOUTH = 27;

/**
 * The African coast below FIXED_SOUTH as [lon, lat, jitter]: a rough outline that each game bends,
 * warps and decorates with capes, bays and islands.
 */
export const AFRICA_OUTLINE: [number, number, number][] = [
  [-9.9, 31.0, 0], [-10.6, 29.2, 0.4], [-13.2, 27.6, 1.5], [-16.0, 24.0, 2], [-17.0, 21.0, 2.5], [-16.4, 19.0, 2], [-17.3, 14.7, 2.5],
  [-15.0, 11.0, 2.5], [-13.0, 8.5, 2.5], [-11.0, 6.5, 2.5], [-7.5, 4.6, 2], [-3.0, 5.0, 2], [1.0, 6.0, 2], [4.5, 6.2, 2],
  [7.0, 4.3, 2], [9.0, 3.8, 1.5], [9.6, 1.0, 1.5], [9.4, -5.0, 1], [20.0, -5.0, 0], [20.0, 31.0, 0],
];

export interface EuropeanPort {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** home ports belong to the player's crown; foreign ports are markets only */
  kind: 'home' | 'foreign';
  nation: string;
  blurb: string;
  /** per good: base price, reference stock, consumption/turn, production/turn */
  market: Partial<Record<GoodId, [number, number, number, number]>>;
  /** starting port level for home ports */
  port?: number;
}

export const EUROPEAN_PORTS: EuropeanPort[] = [
  {
    id: 'seville', name: 'Sevilla', lat: 37.2, lon: -6.3, kind: 'home', nation: 'Castile', port: 2,
    blurb: 'Capital of your trade and seat of the royal shipyard. Cacao and gold fetch the best price here.',
    market: { silver: [130, 40, 12, 0], timber: [14, 80, 20, 24], stone: [9, 80, 15, 18], food: [6, 150, 40, 48], cloth: [24, 80, 20, 22], wine: [17, 80, 20, 26], sugar: [70, 30, 10, 0], spices: [110, 30, 10, 1], furs: [55, 30, 8, 1], tobacco: [65, 30, 10, 0], cacao: [100, 30, 12, 0], dyes: [65, 30, 8, 1], gold: [175, 40, 14, 0], tools: [20, 120, 30, 40] },
  },
  {
    id: 'cadiz', name: 'Cádiz', lat: 36.5, lon: -6.3, kind: 'home', nation: 'Castile', port: 1,
    blurb: 'A small Atlantic harbour of the Crown, closer to the open sea.',
    market: { silver: [125, 20, 6, 0], timber: [15, 40, 10, 11], stone: [10, 40, 8, 9], food: [7, 80, 20, 22], cloth: [26, 40, 10, 10], wine: [16, 40, 10, 13], sugar: [66, 15, 5, 0], spices: [105, 15, 4, 0], furs: [52, 15, 4, 0], tobacco: [62, 15, 5, 0], cacao: [92, 15, 5, 0], dyes: [62, 15, 4, 0], gold: [165, 20, 6, 0], tools: [22, 60, 15, 18] },
  },
  {
    id: 'lisbon', name: 'Lisboa', lat: 38.7, lon: -9.2, kind: 'foreign', nation: 'Portugal',
    blurb: 'Portugal’s great harbour, rich from the African trade. A steady buyer of gold and dyes.',
    market: { silver: [120, 30, 8, 0], timber: [14, 60, 15, 18], stone: [10, 60, 12, 14], food: [7, 100, 30, 32], cloth: [24, 60, 15, 16], wine: [14, 70, 15, 22], sugar: [64, 25, 8, 1], spices: [100, 25, 9, 2], furs: [50, 20, 6, 0], tobacco: [60, 20, 7, 0], cacao: [70, 20, 6, 0], dyes: [78, 25, 9, 1], gold: [165, 30, 10, 0], tools: [21, 90, 22, 30] },
  },
  {
    id: 'antwerp', name: 'Antwerpen', lat: 51.3, lon: 4.1, kind: 'foreign', nation: 'Flanders',
    blurb: 'The great market of the north. Its cloth workshops pay well for dyes and furs.',
    market: { silver: [115, 40, 12, 0], timber: [11, 100, 25, 32], stone: [9, 80, 15, 18], food: [7, 120, 35, 38], cloth: [15, 120, 25, 40], wine: [22, 60, 18, 15], sugar: [75, 30, 12, 0], spices: [125, 30, 10, 1], furs: [80, 40, 14, 3], tobacco: [70, 30, 10, 0], cacao: [55, 25, 5, 0], dyes: [95, 40, 14, 2], gold: [150, 40, 10, 0], tools: [16, 140, 30, 50] },
  },
  {
    id: 'london', name: 'London', lat: 51.5, lon: 0.6, kind: 'foreign', nation: 'England',
    blurb: 'A growing port on the Thames. Takes to tobacco faster than anyone.',
    market: { silver: [118, 30, 10, 0], timber: [12, 90, 20, 26], stone: [10, 60, 12, 14], food: [7, 110, 30, 34], cloth: [17, 100, 22, 32], wine: [24, 50, 15, 10], sugar: [72, 25, 9, 0], spices: [115, 25, 8, 0], furs: [72, 30, 10, 2], tobacco: [80, 30, 12, 0], cacao: [50, 20, 4, 0], dyes: [80, 30, 9, 1], gold: [150, 30, 8, 0], tools: [18, 110, 25, 40] },
  },
  {
    id: 'genoa', name: 'Genova', lat: 44.3, lon: 8.9, kind: 'foreign', nation: 'Genoa',
    blurb: 'Bankers and merchants of the Mediterranean. Steady buyers of everything.',
    market: { silver: [125, 40, 12, 0], timber: [16, 60, 15, 15], stone: [8, 100, 15, 22], food: [8, 100, 30, 30], cloth: [20, 80, 20, 24], wine: [13, 90, 20, 30], sugar: [68, 25, 8, 0], spices: [95, 35, 10, 3], furs: [65, 30, 9, 2], tobacco: [62, 30, 9, 0], cacao: [72, 25, 7, 0], dyes: [82, 35, 10, 1], gold: [160, 40, 12, 0], tools: [18, 120, 25, 40] },
  },
];

/** Old World places drawn as map art only (not markets). */
export const DECOR_CITIES: [string, number, number][] = [
  ['Paris', 48.9, 2.3], ['Amsterdam', 52.4, 4.9], ['Toledo', 39.9, -4.0], ['Valencia', 39.5, -0.4], ['Barcelona', 41.4, 2.2],
  ['Venezia', 45.4, 12.3], ['Roma', 41.9, 12.5], ['Bordeaux', 44.8, -0.6], ['Madrid', 40.4, -3.7],
  ['Lübeck', 53.9, 10.7], ['Dublin', 53.3, -6.3], ['Tunis', 36.8, 10.2], ['Fez', 34.0, -5.0],
];

/** Sea names on the Old World board: name, lat, lon, font size */
export const SEA_LABELS: [string, number, number, number][] = [
  ['Mar Océano', 42, -15, 26],
  ['Mar del Norte', 56.5, 3.5, 18],
  ['Mar Mediterráneo', 38.6, 5.5, 18],
  ['Mar de Canarias', 25.0, -21.0, 15],
  ['Golfo de Vizcaya', 45.5, -4.5, 15],
];
