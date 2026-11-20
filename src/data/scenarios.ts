/**
 * Scenarios: a goal and a year to reach it by, on top of the ordinary game. Reaching it is a win
 * to be proud of; missing it ends nothing: the voyage goes on as a free game. Provisional numbers.
 */
export type ScenarioId = 'charge' | 'spice' | 'crossing';
export type ScenarioGoal = { kind: 'treasury' | 'sales' | 'newColony'; need: number };

export interface Scenario {
  id: ScenarioId;
  name: string;
  /** the last year in which the goal can be met */
  by: number;
  goal: ScenarioGoal;
  blurb: string;
  /** how the goal reads in the objectives panel */
  ask: string;
}

export const SCENARIOS: Scenario[] = [
  { id: 'charge', name: 'The treasurer’s charge', by: 1502, goal: { kind: 'treasury', need: 20000 },
    blurb: 'The wars at home have emptied the treasury. Your treasurer gives you ten years to fill it from the sea.', ask: '20,000 ducats in the treasury' },
  { id: 'spice', name: 'The spice race', by: 1515, goal: { kind: 'sales', need: 30000 },
    blurb: 'Pepper, gold and dyes from the African coast, sold wherever they are dearest, before your rivals own the trade.', ask: '30,000 ducats of sales, all told' },
  { id: 'crossing', name: 'Beyond the ocean', by: 1510, goal: { kind: 'newColony', need: 1 },
    blurb: 'Master the ocean winds, find land in the west, and plant a colony there that lasts.', ask: 'A colony across the Mar Océano' },
];
export const scenarioById = (id: string | undefined) => SCENARIOS.find((x) => x.id === id);

/**
 * Other ways to win than the score: the first crown to reach one is remembered for it. The numbers
 * are for a standard game and are scaled by its length. Provisional.
 */
export const VICTORY = {
  trade: 520000,
  empire: { colonists: 260, territory: 420 },
  prestige: 300,
  /** how the targets scale with the year the game ends */
  scale: { 1550: 0.3, 1650: 1, 1750: 1.6 } as Record<number, number>,
};
export type VictoryKind = 'trade' | 'empire' | 'prestige';
export const VICTORY_NAME: Record<VictoryKind, { name: string; won: string }> = {
  trade: { name: 'Mastery of trade', won: 'is the counting house of the world' },
  empire: { name: 'An empire overseas', won: 'rules an empire on which the sun does not set' },
  prestige: { name: 'The first court of Europe', won: 'is the wonder and the envy of every court in Europe' },
};

/** Favours a ruler can spend prestige on. */
export const FAVOURS = {
  summon: { name: 'Summon a renowned captain', cost: 25, blurb: 'A man or woman of proven gifts comes to ask a place at court.' },
  honours: { name: 'A day of honours', cost: 15, blurb: 'Titles, chains and kind words: every courtier is a little more loyal.' },
  legate: { name: 'A grand embassy', cost: 30, blurb: 'Your ambassadors make the round of Europe in state: every realm thinks better of you.' },
} as const;
export type FavourId = keyof typeof FAVOURS;
