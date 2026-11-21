/**
 * Scenarios: a goal and a year to reach it by, on top of the ordinary game. Reaching it is a win
 * to be proud of; missing it ends nothing: the voyage goes on as a free game. Provisional numbers.
 */
export type ScenarioId = 'charge' | 'spice' | 'crossing' | 'crisis';
/** `hold` is judged in the last year, not before: keep at least this many colonies until then. */
export type ScenarioGoal = { kind: 'treasury' | 'sales' | 'newColony' | 'hold'; need: number };

export interface Scenario {
  id: ScenarioId;
  name: string;
  /** the last year in which the goal can be met */
  by: number;
  goal: ScenarioGoal;
  blurb: string;
  /** how the goal reads in the objectives panel */
  ask: string;
  /** begins in this year, with an empire already made (the years before are played out without you) */
  from?: number;
}

export const SCENARIOS: Scenario[] = [
  { id: 'charge', name: 'The treasurer’s charge', by: 1502, goal: { kind: 'treasury', need: 20000 },
    blurb: 'The wars at home have emptied the treasury. Your treasurer gives you ten years to fill it from the sea.', ask: '20,000 ducats in the treasury' },
  { id: 'spice', name: 'The spice race', by: 1515, goal: { kind: 'sales', need: 60000 },
    blurb: 'Pepper, gold and dyes from the African coast, sold wherever they are dearest, before your rivals own the trade.', ask: '60,000 ducats of sales, all told' },
  { id: 'crossing', name: 'Beyond the ocean', by: 1510, goal: { kind: 'newColony', need: 1 },
    blurb: 'Master the ocean winds, find land in the west, and plant a colony there that lasts.', ask: 'A colony across the Mar Océano' },
  { id: 'crisis', name: 'The restless empire', by: 1720, from: 1690, goal: { kind: 'hold', need: 4 },
    blurb: 'It is 1690. You inherit five colonies across the ocean, a generation that has never seen the mother country, and one town that has already thrown off your rule. Hold the empire together for thirty years.', ask: 'Still four colonies or more in 1720' },
];

/** What the heir to a restless empire starts with. */
export const CRISIS = { colonies: 5, loyalty: [28, 42] as [number, number], treasury: 6000, subjects: 22 };
export const scenarioById = (id: string | undefined) => SCENARIOS.find((x) => x.id === id);

/**
 * Other ways to win than the score: the first crown to reach one is remembered for it. The numbers
 * are for a standard game and are scaled by its length. Provisional.
 */
export const VICTORY = {
  /**
   * Rival crowns' books record the profit on a cargo, not the sale. When crowns are compared (the
   * score and the trade race) your sales are reckoned at the same share, so a hold of pepper is
   * worth the same to every crown.
   */
  salesAsProfit: 0.2,
  trade: 340000,
  empire: { colonists: 170, territory: 270 },
  /** for a standard game; a shorter or longer one moves it half as far as the other two races (`prestigeScale`) */
  prestige: 650,
  /** how the targets scale with the year the game ends */
  scale: { 1550: 0.45, 1650: 1, 1750: 1.6 } as Record<number, number>,
};
/** The final reckoning: points for each colonist, each hex of territory, and one for every `sales` ducats of trading profit. */
export const SCORE = { colonist: 10, territory: 2, sales: 200 };
export type VictoryKind = 'trade' | 'empire' | 'prestige';
export const VICTORY_NAME: Record<VictoryKind, { name: string; won: string }> = {
  trade: { name: 'Mastery of trade', won: 'is the counting house of the world' },
  empire: { name: 'An empire overseas', won: 'rules an empire on which the sun does not set' },
  prestige: { name: 'The first court of Europe', won: 'is the wonder and the envy of every court in Europe' },
};

/**
 * What deeds are worth in prestige. Tuned with the harness (Phase 6) so that the first court of
 * Europe is the work of a long reign and several kinds of deed, not of one caravel's first summer.
 */
export const PRESTIGE = {
  /** each hex of land seen for the first time */
  landSeen: 0.02,
  /** a people met at their trading ground */
  peopleMet: 3,
  newWorld: 30,
  continent: 20,
  colonyFounded: 8,
  colonyRaised: 10,
  /** a find surveyed ashore: precious metal, anything else */
  find: [3, 1] as [number, number],
  tradingPost: 3,
};

/** Favours a ruler can spend prestige on. */
export const FAVOURS = {
  summon: { name: 'Summon a renowned captain', cost: 25, blurb: 'A man or woman of proven gifts comes to ask a place at court.' },
  honours: { name: 'A day of honours', cost: 15, blurb: 'Titles, chains and kind words: every courtier is a little more loyal.' },
  legate: { name: 'A grand embassy', cost: 30, blurb: 'Your ambassadors make the round of Europe in state: every realm thinks better of you.' },
} as const;
export type FavourId = keyof typeof FAVOURS;
