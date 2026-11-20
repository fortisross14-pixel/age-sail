/**
 * Numbers for slavery (`src/sim/slavery.ts`). Provisional until the balance phase.
 * Nothing here adds to the score, an objective or an ambition, on purpose.
 */
import type { Region } from './trade';

export const SLAVERY = {
  /** ducats for one captive at an African trading ground, and what one fetches in a southern European port */
  buy: 90,
  sell: 170,
  /** where there is a market for captives in Europe */
  sellRegions: ['iberia', 'mediterranean', 'islam'] as Region[],
  /** cargo space each captive takes in the hold */
  hold: 2,
  /** how many a trading ground offers at most, and how fast it refills: faster when that people is at war */
  groundMax: 10,
  groundPeace: 0.4,
  groundWar: 1.5,
  /** regard lost with the enemies of the people who sold them, for each captive bought */
  rivalsRemember: 0.6,
  /** taken when a village falls, and what that people remembers of it */
  taken: [2, 5] as [number, number],
  takenRemember: -12,
  /** share who die each season in a ship at sea, and in a ship in port */
  seaDeaths: 0.1,
  portDeaths: 0.03,
  /** in a colony: share who die each year, and the chance each year that one or two flee */
  fieldDeaths: 0.07,
  flight: 0.3,
  /** a colony may hold this many for each settler its size allows */
  capPerSettler: 2,
  /** what an enslaved person eats, as a share of a settler's food; they are given no cloth, wine or luxuries */
  food: 0.8,
  /** when they outnumber the settlers by this much, the chance each year of a rising; one company holds down this many */
  outnumber: 1.5,
  rising: 0.12,
  perCompany: 6,
  /** when the trade is abolished: the share of the freed who stay as settlers, and what the law is worth in prestige */
  freedStay: 0.5,
  abolitionPrestige: 15,
};
