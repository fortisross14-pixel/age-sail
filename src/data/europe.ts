import type { GoodId } from './goods';
import type { RealmId } from './realms';

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
  // Otranto, so the Adriatic and Venice open to the Mediterranean
  [40.6, 18.4], [40.0, 18.4], [39.4, 18.4], [40.6, 17.8],
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

export type CitySize = 1 | 2 | 3;

export interface EuropeanCity {
  id: string;
  name: string;
  lat: number;
  lon: number;
  realm: RealmId;
  /** 3 great city, 2 city, 1 town: building room, taxes and market depth */
  size: CitySize;
  /** coastal cities are ports with a market; inland ones are your cities to build in, or names on the chart */
  coastal: boolean;
  blurb: string;
  /** per good: base price, reference stock, consumption/turn, production/turn; generated when absent */
  market?: Partial<Record<GoodId, [number, number, number, number]>>;
}

/**
 * The Old World's cities, largest first: placement goes in this order and keeps at least one
 * empty hex between any two, so a smaller city moves aside for a larger neighbour.
 */
export const CITIES: EuropeanCity[] = [
  { id: 'seville', name: 'Sevilla', lat: 37.2, lon: -6.3, realm: 'spain', size: 3, coastal: true, blurb: 'The great port of Castile on the Guadalquivir. Cacao and gold fetch the best price here.', market: { silver: [130, 40, 12, 0], timber: [14, 80, 20, 24], stone: [9, 80, 15, 18], food: [6, 150, 40, 48], cloth: [24, 80, 20, 22], wine: [17, 80, 20, 26], sugar: [70, 30, 10, 0], spices: [110, 30, 10, 1], furs: [55, 30, 8, 1], tobacco: [65, 30, 10, 0], cacao: [100, 30, 12, 0], dyes: [65, 30, 8, 1], gold: [175, 40, 14, 0], tools: [20, 120, 30, 40] } },
  { id: 'barcelona', name: 'Barcelona', lat: 41.4, lon: 2.2, realm: 'spain', size: 3, coastal: true, blurb: 'Aragon’s great port, the gate to the western Mediterranean.' },
  { id: 'lisbon', name: 'Lisboa', lat: 38.7, lon: -9.2, realm: 'portugal', size: 3, coastal: true, blurb: 'Portugal’s great harbour, rich from the African trade. A steady buyer of gold and dyes.', market: { silver: [120, 30, 8, 0], timber: [14, 60, 15, 18], stone: [10, 60, 12, 14], food: [7, 100, 30, 32], cloth: [24, 60, 15, 16], wine: [14, 70, 15, 22], sugar: [64, 25, 8, 1], spices: [100, 25, 9, 2], furs: [50, 20, 6, 0], tobacco: [60, 20, 7, 0], cacao: [70, 20, 6, 0], dyes: [78, 25, 9, 1], gold: [165, 30, 10, 0], tools: [21, 90, 22, 30] } },
  { id: 'london', name: 'London', lat: 51.5, lon: 0.6, realm: 'england', size: 3, coastal: true, blurb: 'A growing port on the Thames. Takes to tobacco faster than anyone.', market: { silver: [118, 30, 10, 0], timber: [12, 90, 20, 26], stone: [10, 60, 12, 14], food: [7, 110, 30, 34], cloth: [17, 100, 22, 32], wine: [24, 50, 15, 10], sugar: [72, 25, 9, 0], spices: [115, 25, 8, 0], furs: [72, 30, 10, 2], tobacco: [80, 30, 12, 0], cacao: [50, 20, 4, 0], dyes: [80, 30, 9, 1], gold: [150, 30, 8, 0], tools: [18, 110, 25, 40] } },
  { id: 'paris', name: 'Paris', lat: 48.86, lon: 2.35, realm: 'france', size: 3, coastal: false, blurb: 'The largest city in Christendom, far from the sea.' },
  { id: 'antwerp', name: 'Antwerpen', lat: 51.3, lon: 4.1, realm: 'netherlands', size: 3, coastal: true, blurb: 'The great market of the north. Its cloth workshops pay well for dyes and furs.', market: { silver: [115, 40, 12, 0], timber: [11, 100, 25, 32], stone: [9, 80, 15, 18], food: [7, 120, 35, 38], cloth: [15, 120, 25, 40], wine: [22, 60, 18, 15], sugar: [75, 30, 12, 0], spices: [125, 30, 10, 1], furs: [80, 40, 14, 3], tobacco: [70, 30, 10, 0], cacao: [55, 25, 5, 0], dyes: [95, 40, 14, 2], gold: [150, 40, 10, 0], tools: [16, 140, 30, 50] } },
  { id: 'venice', name: 'Venezia', lat: 45.44, lon: 12.33, realm: 'venice', size: 3, coastal: true, blurb: 'The Serenissima: galleys, spices from the east and bankers’ credit.' },
  { id: 'fez', name: 'Fès', lat: 34.0, lon: -5.0, realm: 'morocco', size: 3, coastal: false, blurb: 'The old capital of the Maghreb, at the northern end of the caravan roads.' },
  { id: 'cadiz', name: 'Cádiz', lat: 36.5, lon: -6.3, realm: 'spain', size: 2, coastal: true, blurb: 'A small Atlantic harbour, closer to the open sea.', market: { silver: [125, 20, 6, 0], timber: [15, 40, 10, 11], stone: [10, 40, 8, 9], food: [7, 80, 20, 22], cloth: [26, 40, 10, 10], wine: [16, 40, 10, 13], sugar: [66, 15, 5, 0], spices: [105, 15, 4, 0], furs: [52, 15, 4, 0], tobacco: [62, 15, 5, 0], cacao: [92, 15, 5, 0], dyes: [62, 15, 4, 0], gold: [165, 20, 6, 0], tools: [22, 60, 15, 18] } },
  { id: 'malaga', name: 'Málaga', lat: 36.7, lon: -4.4, realm: 'spain', size: 2, coastal: true, blurb: 'Raisins, wine and almonds for the northern markets.' },
  { id: 'valencia', name: 'Valencia', lat: 39.5, lon: -0.4, realm: 'spain', size: 2, coastal: true, blurb: 'Silk, rice and sugar from the huerta.' },
  { id: 'bilbao', name: 'Bilbao', lat: 43.3, lon: -2.9, realm: 'spain', size: 2, coastal: true, blurb: 'Iron, wool and the ships of the Cantabrian coast.' },
  { id: 'palermo', name: 'Palermo', lat: 38.1, lon: 13.4, realm: 'spain', size: 2, coastal: true, blurb: 'Sicily’s grain and sugar, under the crown of Aragon.' },
  { id: 'granada', name: 'Granada', lat: 37.2, lon: -3.6, realm: 'spain', size: 2, coastal: false, blurb: 'The last Moorish kingdom, taken in 1492: silk and orchards.' },
  { id: 'toledo', name: 'Toledo', lat: 39.9, lon: -4.0, realm: 'spain', size: 2, coastal: false, blurb: 'Swords, cloth and the seat of the primate of Spain.' },
  { id: 'valladolid', name: 'Valladolid', lat: 41.65, lon: -4.7, realm: 'spain', size: 2, coastal: false, blurb: 'Where the court of Castile most often sits.' },
  { id: 'porto', name: 'Porto', lat: 41.15, lon: -8.6, realm: 'portugal', size: 2, coastal: true, blurb: 'Wine and shipwrights on the Douro.' },
  { id: 'bristol', name: 'Bristol', lat: 51.45, lon: -2.6, realm: 'england', size: 2, coastal: true, blurb: 'England’s western port: wool, fish and sailors bound for Iceland.' },
  { id: 'dublin', name: 'Dublin', lat: 53.35, lon: -6.26, realm: 'england', size: 2, coastal: true, blurb: 'The Pale, the English lordship in Ireland.' },
  { id: 'york', name: 'York', lat: 53.96, lon: -1.08, realm: 'england', size: 2, coastal: false, blurb: 'Wool and the northern church.' },
  { id: 'larochelle', name: 'La Rochelle', lat: 46.16, lon: -1.15, realm: 'france', size: 2, coastal: true, blurb: 'An Atlantic harbour of salt and wine, independent of mind.' },
  { id: 'nantes', name: 'Nantes', lat: 47.2, lon: -1.55, realm: 'france', size: 2, coastal: true, blurb: 'The Loire’s port, rich in salt and shipping.' },
  { id: 'bordeaux', name: 'Bordeaux', lat: 44.84, lon: -0.58, realm: 'france', size: 2, coastal: true, blurb: 'Claret for the north, and ships for anything.' },
  { id: 'rouen', name: 'Rouen', lat: 49.44, lon: 1.1, realm: 'france', size: 2, coastal: true, blurb: 'The port of the Seine, and Paris’s door to the sea.' },
  { id: 'marseille', name: 'Marseille', lat: 43.3, lon: 5.37, realm: 'france', size: 2, coastal: true, blurb: 'France’s window on the Mediterranean.' },
  { id: 'lyon', name: 'Lyon', lat: 45.76, lon: 4.84, realm: 'france', size: 2, coastal: false, blurb: 'Fairs, silk and the bankers of Florence.' },
  { id: 'amsterdam', name: 'Amsterdam', lat: 52.37, lon: 4.9, realm: 'netherlands', size: 2, coastal: true, blurb: 'Herring, grain from the Baltic and a growing fleet.' },
  { id: 'tunis', name: 'Tunis', lat: 36.8, lon: 10.2, realm: 'ottoman', size: 2, coastal: true, blurb: 'Corsairs and merchants of the Barbary coast.' },
  { id: 'algiers', name: 'Alger', lat: 36.75, lon: 3.06, realm: 'ottoman', size: 2, coastal: true, blurb: 'A corsair stronghold looking out to Spain.' },
  { id: 'marrakesh', name: 'Marrakech', lat: 31.6, lon: -8.0, realm: 'morocco', size: 2, coastal: false, blurb: 'Red walls, sugar and the gold of the south.' },
  { id: 'genoa', name: 'Genova', lat: 44.3, lon: 8.9, realm: 'genoa', size: 2, coastal: true, blurb: 'Bankers and merchants of the Mediterranean. Steady buyers of everything.', market: { silver: [125, 40, 12, 0], timber: [16, 60, 15, 15], stone: [8, 100, 15, 22], food: [8, 100, 30, 30], cloth: [20, 80, 20, 24], wine: [13, 90, 20, 30], sugar: [68, 25, 8, 0], spices: [95, 35, 10, 3], furs: [65, 30, 9, 2], tobacco: [62, 30, 9, 0], cacao: [72, 25, 7, 0], dyes: [82, 35, 10, 1], gold: [160, 40, 12, 0], tools: [18, 120, 25, 40] } },
  { id: 'rome', name: 'Roma', lat: 41.9, lon: 12.5, realm: 'papacy', size: 2, coastal: false, blurb: 'The Pope’s city, rebuilding in marble.' },
  { id: 'naples', name: 'Napoli', lat: 40.85, lon: 14.27, realm: 'naples', size: 2, coastal: true, blurb: 'A great, crowded kingdom of the south.' },
  { id: 'lubeck', name: 'Lübeck', lat: 53.87, lon: 10.69, realm: 'hanse', size: 2, coastal: true, blurb: 'Queen of the Hanse: furs, wax and Baltic grain.' },
  { id: 'danzig', name: 'Danzig', lat: 54.35, lon: 18.4, realm: 'hanse', size: 2, coastal: true, blurb: 'The granary of the Baltic.' },
  { id: 'copenhagen', name: 'København', lat: 55.68, lon: 12.57, realm: 'denmark', size: 2, coastal: true, blurb: 'The Sound and its tolls.' },
  { id: 'edinburgh', name: 'Edinburgh', lat: 55.95, lon: -3.19, realm: 'scotland', size: 2, coastal: true, blurb: 'Scotland’s capital, with Leith as its port.' },
  { id: 'cologne', name: 'Köln', lat: 50.94, lon: 6.96, realm: 'empire', size: 2, coastal: false, blurb: 'The Rhine’s great market.' },
  { id: 'vienna', name: 'Wien', lat: 48.2, lon: 16.37, realm: 'empire', size: 2, coastal: false, blurb: 'The Habsburgs’ city on the Danube.' },
  { id: 'coruna', name: 'A Coruña', lat: 43.4, lon: -8.4, realm: 'spain', size: 1, coastal: true, blurb: 'A Galician harbour on the open Atlantic.' },
  { id: 'zaragoza', name: 'Zaragoza', lat: 41.65, lon: -0.9, realm: 'spain', size: 1, coastal: false, blurb: 'Aragon’s inland capital on the Ebro.' },
  { id: 'lagos', name: 'Lagos', lat: 37.1, lon: -8.7, realm: 'portugal', size: 1, coastal: true, blurb: 'Where Henry the Navigator’s caravels set out.' },
  { id: 'ceuta', name: 'Ceuta', lat: 35.9, lon: -5.3, realm: 'portugal', size: 1, coastal: true, blurb: 'A Portuguese foothold in Africa since 1415.' },
  { id: 'plymouth', name: 'Plymouth', lat: 50.37, lon: -4.14, realm: 'england', size: 1, coastal: true, blurb: 'A Devon harbour facing the ocean.' },
  { id: 'calais', name: 'Calais', lat: 50.95, lon: 1.85, realm: 'england', size: 1, coastal: true, blurb: 'England’s last town in France: the wool staple.' },
  { id: 'brest', name: 'Brest', lat: 48.39, lon: -4.49, realm: 'france', size: 1, coastal: true, blurb: 'A deep Breton roadstead.' },
  { id: 'toulouse', name: 'Toulouse', lat: 43.6, lon: 1.44, realm: 'france', size: 1, coastal: false, blurb: 'Woad and the south of France.' },
  { id: 'groningen', name: 'Groningen', lat: 53.2, lon: 6.57, realm: 'netherlands', size: 1, coastal: true, blurb: 'A small northern market of the Low Countries.' },
  { id: 'tripoli', name: 'Tripoli', lat: 32.9, lon: 13.2, realm: 'ottoman', size: 1, coastal: true, blurb: 'A walled port on the Libyan coast.' },
  { id: 'sale', name: 'Salé', lat: 34.05, lon: -6.8, realm: 'morocco', size: 1, coastal: true, blurb: 'A corsair harbour on the Atlantic coast of Morocco.' },
  { id: 'bergen', name: 'Bergen', lat: 60.4, lon: 5.3, realm: 'denmark', size: 1, coastal: true, blurb: 'Stockfish and the Hanse’s northern kontor.' },
  { id: 'frankfurt', name: 'Frankfurt', lat: 50.11, lon: 8.68, realm: 'empire', size: 1, coastal: false, blurb: 'Fairs and printers on the Main.' },
  { id: 'augsburg', name: 'Augsburg', lat: 48.37, lon: 10.9, realm: 'empire', size: 1, coastal: false, blurb: 'The Fuggers’ city: copper, silver and loans.' },
];

export const cityById = (id: string) => CITIES.find((c) => c.id === id);

type Book = Partial<Record<GoodId, [number, number, number, number]>>;
/** Regional tastes for cities without a hand-tuned market, from the closest hand-tuned one. */
const TEMPLATE: Record<string, string> = {
  spain: 'seville', portugal: 'lisbon', england: 'london', scotland: 'london', france: 'lisbon', netherlands: 'antwerp',
  hanse: 'antwerp', denmark: 'antwerp', empire: 'antwerp', venice: 'genoa', genoa: 'genoa', papacy: 'genoa', naples: 'genoa',
  ottoman: 'genoa', morocco: 'lisbon',
};
const MED = new Set(['barcelona', 'valencia', 'palermo', 'marseille', 'malaga']);

/** A city's market: hand-tuned for the old ports, otherwise scaled from its region's model. */
export function cityMarket(c: EuropeanCity): Book | null {
  if (!c.coastal) return null;
  if (c.market) return c.market;
  const model = cityById(MED.has(c.id) ? 'genoa' : TEMPLATE[c.realm])!.market!;
  const depth = c.size === 3 ? 1 : c.size === 2 ? 0.6 : 0.35;
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out: Book = {};
  for (const [g, v] of Object.entries(model) as [GoodId, [number, number, number, number]][]) {
    h = (h * 1103515245 + 12345) >>> 0;
    const jitter = 0.94 + (h % 1000) / 1000 * 0.12;
    let base = v[0] * jitter;
    // the Maghreb sits at the end of the caravan roads and drinks no wine
    if (c.realm === 'morocco' || c.realm === 'ottoman') { if (g === 'gold') base *= 0.85; if (g === 'wine') base *= 0.7; if (g === 'spices') base *= 0.92; }
    const r = (x: number) => Math.max(0, Math.round(x * depth));
    out[g] = [Math.round(base), Math.max(4, r(v[1])), r(v[2]), r(v[3])];
  }
  return out;
}

/** Sea names on the Old World board: name, lat, lon, font size */
export const SEA_LABELS: [string, number, number, number][] = [
  ['Mar Océano', 42, -15, 26],
  ['Mar del Norte', 56.5, 3.5, 18],
  ['Mar Mediterráneo', 38.6, 5.5, 18],
  ['Mar de Canarias', 25.0, -21.0, 15],
  ['Golfo de Vizcaya', 45.5, -4.5, 15],
];
