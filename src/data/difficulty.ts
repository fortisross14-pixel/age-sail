/**
 * Difficulty: three levels chosen on the menu. Deliberately few levers, all read from here.
 * `aggression` changes how the rivals behave, not only how fast they are.
 * Tuned with the harness (Phase 6): on Captain the bot of `tools/bot.ts` ends just behind the rival
 * crowns, on Squire among them, on Admiral well behind.
 */
export type Difficulty = 'squire' | 'captain' | 'admiral';

export interface DifficultySpec {
  id: Difficulty;
  name: string;
  blurb: string;
  /** ducats in the treasury at the start */
  treasury: number;
  /** multiplies the seasons between each rival crown's expeditions (higher is slower rivals) */
  rivalPace: number;
  /** multiplies every storm's chance */
  storms: number;
  /** how readily rivals go to war with you, raid your colonies and contest what you have found */
  aggression: number;
  /** multiplies the ducats that objectives pay */
  rewards: number;
  /** multiplies how fast rival colonies grow and are raised, and what their trade earns: the lever that lasts the whole game */
  rivalGrowth: number;
}

export const DIFFICULTIES: DifficultySpec[] = [
  { id: 'squire', name: 'Squire', blurb: 'A fuller treasury, slower rivals and kinder seas. For a first voyage.', treasury: 8000, rivalPace: 1.4, storms: 0.7, aggression: 0.6, rewards: 1.5, rivalGrowth: 0.7 },
  { id: 'captain', name: 'Captain', blurb: 'The game as it is meant to be played.', treasury: 5000, rivalPace: 1, storms: 1, aggression: 1, rewards: 1, rivalGrowth: 1 },
  { id: 'admiral', name: 'Admiral', blurb: 'A thin treasury, rivals who waste no time and rougher seas.', treasury: 3500, rivalPace: 0.75, storms: 1.25, aggression: 1.4, rewards: 0.75, rivalGrowth: 1.3 },
];

export const DEFAULT_DIFFICULTY: Difficulty = 'captain';
export const difficultySpec = (id: Difficulty | undefined) => DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
