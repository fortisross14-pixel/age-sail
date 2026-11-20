/**
 * Europe: what envoys, gifts and treaties cost and need, the quarrels that become wars, and the
 * corsairs. Provisional numbers.
 */
import type { RealmId } from './realms';

/** Each treaty includes what the one before it gives. */
export type Treaty = 'none' | 'trade' | 'pact' | 'alliance';
export const TREATY_ORDER: Treaty[] = ['none', 'trade', 'pact', 'alliance'];
export const TREATY_INFO: Record<Exclude<Treaty, 'none'>, { name: string; need: number; blurb: string }> = {
  trade: { name: 'Trade treaty', need: 20, blurb: 'Better prices in their ports.' },
  pact: { name: 'Pact of friendship', need: 40, blurb: 'They will not make war on you, nor let their corsairs loose on your ships.' },
  alliance: { name: 'Alliance', need: 60, blurb: 'The best prices in their ports; a rival crown fights your enemies overseas, another realm sends you money in your wars.' },
};

export const DIPLOMACY = {
  /** where a realm's regard for you rests; corsair realms start cool toward Christian crowns */
  rest: 10,
  corsairRest: -10,
  /** a marriage tie raises it */
  tie: 20,
  envoyCost: 150,
  /** seasons before another envoy, or another proposal, will be heard */
  envoyEvery: 4,
  envoyGain: 8,
  giftCost: 500,
  giftGain: 15,
  /** a refused proposal costs regard */
  refused: -5,
  breakPrestige: 10,
  breakRegard: -30,
  /** taken off the haggling margin in a realm's ports */
  tradeSpread: 0.03,
  allySpread: 0.05,
  /** ducats a season an allied realm sends while you are at war with a crown */
  subsidy: 150,
  /** chance each season that a quarrel becomes a war; never more than this many at once */
  warChance: 0.035,
  maxWars: 2,
  warLength: [8, 24] as [number, number],
  /** joining a war: its cost a season, what it does to regard, and what winning or losing brings */
  joinCost: 40,
  joinFriend: 25,
  joinFoe: -40,
  joinEdge: 0.15,
  winPrestige: 15,
  winDucats: 800,
  losePrestige: 8,
  /** letters of marque: prize money a season while you have an enemy, and the chance a neutral realm protests */
  marque: [40, 160] as [number, number],
  marqueProtest: 0.1,
  /** corsairs: tribute a season, how near their ports they hunt, how often, and how strong */
  tribute: 100,
  corsairReach: 7,
  corsairChance: 0.12,
  corsairStrength: [3, 7] as [number, number],
  /** the Levant trade: how fast Venice and Genoa fill Italy's spice markets, and how fast they empty in an Ottoman war */
  levantFlow: 0.03,
  levantDearth: 0.93,
};

/** Old quarrels: who fights whom, and over what. */
export const QUARRELS: [RealmId, RealmId, string][] = [
  ['ottoman', 'venice', 'the islands of the Levant'],
  ['ottoman', 'empire', 'the plains of Hungary'],
  ['ottoman', 'naples', 'the mouth of the Adriatic'],
  ['france', 'empire', 'the duchy of Milan'],
  ['france', 'naples', 'the crown of Naples'],
  ['england', 'scotland', 'the Border'],
  ['denmark', 'hanse', 'the tolls of the Sound'],
  ['genoa', 'venice', 'the eastern trade'],
  ['papacy', 'venice', 'the towns of the Romagna'],
  ['morocco', 'portugal', 'the Moroccan ports'],
  ['morocco', 'spain', 'the Barbary shore'],
  ['empire', 'denmark', 'the duchies of the North'],
  ['papacy', 'naples', 'an unpaid tribute'],
];

/** Realms whose ports shelter corsairs. */
export const CORSAIR_REALMS: RealmId[] = ['ottoman', 'morocco'];
