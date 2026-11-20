/**
 * How colonies live and die, and how the peoples around them act. Rates are a year's worth; the
 * rules apply a quarter of them each season.
 */

/** Births and deaths, as shares of the colony a year. Natural growth is slow: settlers come from home. */
export const DEMOGRAPHY = {
  /** births among fed settlers */
  births: 0.035,
  /** more when the harvest leaves half a ration spare for everyone */
  plentyBirths: 0.015,
  /** sugar, tobacco or cacao on the table */
  luxuryBirths: 0.01,
  /** friendly peoples nearby: food, guides, marriages */
  friendBirths: 0.015,
  /** ordinary deaths: accidents, sickness, old age */
  deaths: 0.025,
  /** fevers within the tropics (latitude under 23) */
  tropicDeaths: 0.03,
  /** behind a palisade with the enemy outside */
  siegeDeaths: 0.06,
};

/** Newcomers spend their first season "seasoning": they eat, do not work, and some die of the climate. */
export const SEASONING = { tropics: 0.15, temperate: 0.04 };

/** What a soldier or friar living in a colony eats each season. */
export const GARRISON_FOOD = 1;

/** Natives and colonies. */
export const NATIVE = {
  /** a people is friendly from this attitude */
  friendly: 40,
  /** below this they raid */
  hostile: -40,
  /** below this, with enough warriors, they may lay siege */
  furious: -60,
  /** food a friendly (allied) people trades to each colony near them each season */
  friendFood: 1,
  allyFood: 2,
  /** chance a season that a furious people lays siege to the weakest colony near them */
  siegeChance: 0.25,
  /** warriors it takes */
  siegeWarriors: 6,
  /** seasons before the besiegers go home for their own harvest */
  siegeSeasons: 6,
  /** share of their warriors in each assault */
  assault: 0.6,
  /** how fast remembered deeds fade each season (attitude drifts back the same way) */
  memoryFade: 0.97,
};

/** A colony's defence: soldiers count four, settlers a little, walls by level. */
export const DEFENCE = { soldier: 4, settler: 0.6, base: 1, town: 2, city: 4 };
