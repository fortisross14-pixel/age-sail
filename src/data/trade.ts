/**
 * The living market: your factories abroad, the regions' tastes, the shocks that shake prices, and
 * the rival merchants who bring their own colonies' goods home.
 */
import type { GoodId } from './goods';
import type { RealmId } from './realms';

/** A factory: a factor and a warehouse in a European port, selling slowly and buying cheap. */
export const FACTORY = {
  /** opening one in your own realm, and abroad */
  cost: 1200,
  foreignCost: 2500,
  /** wages and rent each season */
  upkeep: 15,
  /** share of a market's normal stock the factor trades each season (at least minPace) */
  pace: 0.12,
  minPace: 3,
  /** the factor sells only while the price is at least this share of the normal price... */
  sellFloor: 0.85,
  /** ...and buys only while it is at most this share */
  buyCeiling: 1.0,
  /** how much the factor buys and keeps in store for you */
  buyTarget: 40,
  /** a foreign city's dues on a factor's sales, on top of the usual spread */
  foreignDues: 0.05,
};

export type Region = 'iberia' | 'france' | 'north' | 'mediterranean' | 'islam';

export const REGION_OF: Record<RealmId, Region> = {
  spain: 'iberia', portugal: 'iberia', france: 'france', england: 'north', netherlands: 'north', scotland: 'north',
  hanse: 'north', denmark: 'north', empire: 'north', venice: 'mediterranean', genoa: 'mediterranean', papacy: 'mediterranean',
  naples: 'mediterranean', ottoman: 'islam', morocco: 'islam',
};

export const REGION_NAME: Record<Region, string> = {
  iberia: 'Iberia', france: 'France', north: 'the North', mediterranean: 'Italy', islam: 'the Maghreb and the Levant',
};

/**
 * What each region craves (price × this): wine and spices in the cold north, sugar and silver in
 * Italy, furs where winters bite, no wine for the faithful. Goods sell best far from where they grow.
 */
export const TASTE: Record<Region, Partial<Record<GoodId, number>>> = {
  iberia: { cacao: 1.15, tools: 1.1, cloth: 1.1 },
  france: { dyes: 1.1, furs: 1.05, sugar: 1.05, wine: 0.9 },
  north: { spices: 1.15, sugar: 1.1, dyes: 1.1, furs: 1.1, timber: 0.9 },
  mediterranean: { silver: 1.15, sugar: 1.1, furs: 0.85, spices: 0.9 },
  islam: { wine: 0.6, silver: 1.15, cloth: 1.1, tools: 1.1, furs: 0.8 },
}

/** Shocks: a few years of unusual demand in a region. Factor multiplies what the goods fetch there. */
export interface ShockKind { id: string; title: string; text: string; goods: GoodId[] | 'all'; factor: number; seasons: [number, number] }
export const SHOCKS: ShockKind[] = [
  { id: 'famine', title: 'Bad harvests', text: 'The harvest fails in {region}. Bread is dear and every ship with grain is welcome.', goods: ['food'], factor: 1.9, seasons: [3, 6] },
  { id: 'plague', title: 'Plague', text: 'Plague in {region}. The markets empty; nobody buys what they can do without.', goods: 'all', factor: 0.7, seasons: [3, 5] },
  { id: 'war', title: 'War in {region}', text: 'Armies are raised in {region}. Arsenals and quartermasters pay well for tools, cloth and timber.', goods: ['tools', 'cloth', 'timber', 'food'], factor: 1.5, seasons: [4, 10] },
  { id: 'wedding', title: 'A royal wedding', text: 'A great royal wedding in {region}. For a season or two every noble house wants sugar, spices, cacao and dyed silks.', goods: ['sugar', 'spices', 'cacao', 'dyes', 'wine'], factor: 1.5, seasons: [2, 4] },
  { id: 'fashion', title: 'A new fashion', text: 'Fur trims and beaver hats are all the fashion in {region}.', goods: ['furs'], factor: 1.6, seasons: [4, 8] },
  { id: 'peace', title: 'A good peace', text: 'Peace and full granaries in {region}: trade is brisk, but nobody pays over the odds.', goods: ['food', 'tools', 'cloth'], factor: 0.8, seasons: [4, 8] },
];
/** chance each season that a new shock begins (at most two at a time) */
export const SHOCK_CHANCE = 0.06;

/** Rival merchants: what each settler of a rival colony ships home a season, and what their home port buys back. */
export const RIVAL_TRADE = { perSettler: 0.35, fill: 1.1, buys: { tools: 0.06, cloth: 0.06, wine: 0.04 } as Partial<Record<GoodId, number>> };

/** Colonial demand: tools wear out; each working settler uses this much a season, and works at `without` without them. */
export const TOOL_WEAR = { perWorker: 0.05, without: 0.85 };
