/**
 * Armies and battles. A battle has three rounds: fire (crossbows, arquebuses, guns), melee (pikes,
 * swords, lances) and pursuit (who chases down a broken enemy). Numbers are per company.
 */
import type { UnitType } from '../sim/types';

export interface CombatStats {
  /** damage dealt in the fire round */
  fire: number;
  /** damage dealt in the melee round */
  shock: number;
  /** damage it can take before the company is lost */
  hp: number;
  /** damage dealt to a broken enemy */
  pursuit: number;
  /** food eaten each season in the field */
  food: number;
  /** pikes stand against horse */
  antiHorse?: boolean;
  /** horse and guns fight badly in forest, jungle, hills and marsh */
  open?: boolean;
  /** firearms frighten those who have never heard them */
  firearms?: boolean;
  /** field guns breach walls */
  breach?: boolean;
}

export const COMBAT: Record<UnitType, CombatStats> = {
  infantry: { fire: 0, shock: 3, hp: 4, pursuit: 0.5, food: 1, antiHorse: true },
  swordsman: { fire: 0, shock: 4, hp: 3, pursuit: 1, food: 1 },
  archer: { fire: 3, shock: 1, hp: 2, pursuit: 0.5, food: 1 },
  musketeer: { fire: 4.5, shock: 1.5, hp: 2.5, pursuit: 0.5, food: 1, firearms: true },
  cavalry: { fire: 0, shock: 5, hp: 3, pursuit: 4, food: 2, open: true },
  cannon: { fire: 6, shock: 0, hp: 1.5, pursuit: 0, food: 1, open: true, firearms: true, breach: true },
  colonist: { fire: 0.5, shock: 1, hp: 1, pursuit: 0.3, food: 1 },
  missionary: { fire: 0, shock: 0.2, hp: 0.5, pursuit: 0, food: 1 },
};

/** Soldiers: everyone who is not a settler or a friar. */
export const MILITARY: UnitType[] = ['infantry', 'swordsman', 'archer', 'musketeer', 'cavalry', 'cannon'];
export const isMilitary = (t: UnitType) => MILITARY.includes(t);

/** A native warrior: most fight hand to hand, some with bows; an empire's are better drilled. */
export const WARRIOR = { fire: 0.4, shock: 1, hp: 1, pursuit: 0.6, empireShock: 1.3, empireHp: 1.2 };

export const BATTLE = {
  /** share of a side's fire or melee that lands in a round: battles are decided by who breaks, not who is wiped out */
  damage: 0.3,
  /** random swing on each side's damage, ± */
  luck: 0.5,
  /** each point of a general's military skill */
  generalSkill: 0.1,
  /** horse and guns in rough country */
  roughPenalty: 0.5,
  /** horse on open plains and savanna */
  openBonus: 1.3,
  /** pikes against horse */
  antiHorse: 1.5,
  /** the defender's edge in forest, jungle or hills */
  roughDefence: 1.25,
  /** a people who have never faced firearms lose heart faster */
  firearmsMorale: 1.3,
  /** morale lost per share of the army lost; a side breaks below this */
  moraleLoss: 140,
  breaks: 35,
  /** a veteran company (per rank, up to 2) */
  veteran: 0.2,
  /** stances: assault hits harder and bleeds more; steady holds back */
  assault: { hit: 1.25, take: 1.2 },
  steady: { hit: 0.8, take: 0.8 },
};

/** Walls: what each level adds to a defender, and what building them takes from the warehouse. */
export const WALLS = [
  { name: 'No walls', hp: 0, fire: 0, needs: {} },
  { name: 'Palisade', hp: 0.5, fire: 0.25, needs: { timber: 30 } },
  { name: 'Stone walls', hp: 1, fire: 0.5, needs: { stone: 60, tools: 20 } },
  { name: 'Star fort', hp: 2, fire: 1, needs: { stone: 150, tools: 50 } },
] as const;
/** each field gun takes this much off the walls' effect */
export const BREACH = 0.5;

/** An army in the field eats this share of its rations a season (the rest it forages). */
export const RATIONS = 0.5;
/** A party starts with this many seasons of food from the ships' stores, per company. */
export const LANDING_FOOD = 2;
/** Each season without food, this share of an army deserts or dies (at least one company). */
export const STARVING = 0.25;

/** Food a party can forage in a season, by terrain (a small band lives off the land; an army cannot). */
export const FORAGE: Record<number, number> = { 2: 0, 3: 1.5, 4: 1, 5: 1, 6: 1, 7: 0.5, 8: 0.3, 9: 0.5, 10: 0, 11: 0.5 };
/** Rations a party can carry per company. */
export const CARRY = 6;
