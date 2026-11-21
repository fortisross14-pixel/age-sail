import type { UnitType } from '../sim/types';

export type BuildingId = 'docks' | 'barracks' | 'church' | 'university' | 'market' | 'warehouse' | 'arsenal' | 'fortress' | 'observatory' | 'cathedral';

export interface BuildingSpec {
  name: string;
  /** cost and seasons to reach each level; index = level (index 0 unused) */
  levels: { cost: number; build: number }[];
  /** what each level does, for the player */
  effect: string[];
  blurb: string;
  /** another building this one rests on, and the level of it */
  needs?: { building: BuildingId; level: number };
}

/** What the second wave of buildings does. Provisional numbers. */
export const BUILDING_FX = { warehouseDues: 40, arsenalShips: 0.85, observatory: 3, cathedralPrestige: 0.25, cathedralLoyalty: 2, cathedralsCount: 2 };

export const BUILDINGS: Record<BuildingId, BuildingSpec> = {
  docks: {
    name: 'Docks', blurb: 'Slipways and quays. Larger docks build larger ships.',
    levels: [{ cost: 0, build: 0 }, { cost: 1200, build: 2 }, { cost: 2500, build: 3 }, { cost: 5000, build: 4 }],
    effect: ['', 'Builds caravels.', 'Builds carracks.', 'Builds galleons.'],
  },
  barracks: {
    name: 'Barracks', blurb: 'A drill yard and an armoury for soldiers bound overseas.',
    levels: [{ cost: 0, build: 0 }, { cost: 1500, build: 2 }, { cost: 3000, build: 3 }],
    effect: ['', 'Trains pikemen, swordsmen and crossbowmen.', 'Also trains arquebusiers, lancers and field guns, and every company faster and cheaper.'],
  },
  church: {
    name: 'Church', blurb: 'A great church with a friary, sending friars to the peoples beyond the sea.',
    levels: [{ cost: 0, build: 0 }, { cost: 1200, build: 2 }],
    effect: ['', 'Trains missionaries.'],
  },
  university: {
    name: 'University', blurb: 'Cosmographers, physicians and lawyers. Knowledge for the realm.',
    levels: [{ cost: 0, build: 0 }, { cost: 2500, build: 3 }, { cost: 4000, build: 4 }],
    effect: ['', '+2 research points a season.', '+4 research points a season.'],
  },
  market: {
    name: 'Market', blurb: 'An exchange and warehouses. Merchants pay their dues, and trade comes cheaper.',
    levels: [{ cost: 0, build: 0 }, { cost: 1500, build: 2 }, { cost: 3500, build: 3 }],
    effect: ['', '+60 ducats in dues a season; better prices in this city.', '+120 ducats a season; better prices still.'],
  },
  warehouse: {
    name: 'Warehouses', blurb: 'Bonded stores along the quay, where cargoes wait for a better price.', needs: { building: 'market', level: 1 },
    levels: [{ cost: 0, build: 0 }, { cost: 1400, build: 2 }, { cost: 2800, build: 3 }],
    effect: ['', '+40 ducats in dues a season.', '+80 ducats in dues a season.'],
  },
  arsenal: {
    name: 'Arsenal', blurb: 'Ropewalks, sail lofts and a gun wharf: a yard that builds ships as a mill grinds corn.', needs: { building: 'docks', level: 2 },
    levels: [{ cost: 0, build: 0 }, { cost: 3000, build: 3 }],
    effect: ['', 'Ships built here cost 15% less.'],
  },
  fortress: {
    name: 'Fortress', blurb: 'A citadel and a standing garrison, where recruits are drilled by men who have seen war.', needs: { building: 'barracks', level: 1 },
    levels: [{ cost: 0, build: 0 }, { cost: 2600, build: 3 }],
    effect: ['', 'Soldiers trained here leave as veterans.'],
  },
  observatory: {
    name: 'Observatory', blurb: 'A tower, instruments of brass, and a pension for whoever will watch the sky every clear night.', needs: { building: 'university', level: 1 },
    levels: [{ cost: 0, build: 0 }, { cost: 3200, build: 3 }],
    effect: ['', '+3 research points a season.'],
  },
  cathedral: {
    name: 'Cathedral', blurb: 'A work of generations. Its bells are heard at sea, and its fame overseas.', needs: { building: 'church', level: 1 },
    levels: [{ cost: 0, build: 0 }, { cost: 5000, build: 6 }],
    effect: ['', 'Prestige grows every season, and your colonies are a little more loyal (two cathedrals count).'],
  },
};

export const BUILDING_ORDER: BuildingId[] = ['docks', 'barracks', 'church', 'university', 'market', 'warehouse', 'arsenal', 'fortress', 'observatory', 'cathedral'];

/**
 * A crown's base taxes are scaled toward this total, within REALM_TAX_RANGE, so a realm of many
 * cities is somewhat richer than a small one but no crown starts broke. Tune in the balance pass.
 */
export const REALM_TAX_TARGET = 200;
export const REALM_TAX_RANGE: [number, number] = [0.75, 1.6];

/** Building places and base taxes by city size (3 great city, 2 city, 1 town). */
export const CITY_SIZE: Record<1 | 2 | 3, { slots: number; taxes: number }> = {
  3: { slots: 7, taxes: 45 },
  2: { slots: 5, taxes: 15 },
  1: { slots: 3, taxes: 6 },
};

/** What a unit costs and needs: the building, and the level of it (barracks II for horse, guns and arquebuses). */
export interface UnitSpec { cost: number; build: number; needs: BuildingId | null; level?: number; upkeep: number; moves: number }

export const UNIT_SPECS: Record<UnitType, UnitSpec> = {
  colonist: { cost: 300, build: 1, needs: null, upkeep: 4, moves: 3 },
  missionary: { cost: 400, build: 1, needs: 'church', upkeep: 4, moves: 3 },
  infantry: { cost: 500, build: 2, needs: 'barracks', upkeep: 8, moves: 3 },
  swordsman: { cost: 550, build: 2, needs: 'barracks', upkeep: 8, moves: 3 },
  archer: { cost: 450, build: 2, needs: 'barracks', upkeep: 7, moves: 3 },
  musketeer: { cost: 700, build: 2, needs: 'barracks', level: 2, upkeep: 10, moves: 3 },
  cavalry: { cost: 900, build: 2, needs: 'barracks', level: 2, upkeep: 14, moves: 5 },
  cannon: { cost: 1000, build: 3, needs: 'barracks', level: 2, upkeep: 12, moves: 2 },
};
/** The order units are offered in. */
export const UNIT_ORDER: UnitType[] = ['colonist', 'missionary', 'infantry', 'swordsman', 'archer', 'musketeer', 'cavalry', 'cannon'];

export type ResourceId = 'gold' | 'silver' | 'fertile' | 'timber' | 'furs' | 'dyes' | 'spices';

export const RESOURCES: Record<ResourceId, { name: string; icon: string; blurb: string }> = {
  gold: { name: 'Gold', icon: 'goods/gold', blurb: 'Gold in the rivers and the rock. A colony here could mine it.' },
  silver: { name: 'Silver', icon: 'goods/silver', blurb: 'Silver ore in the mountains: the richest find of all.' },
  fertile: { name: 'Fertile land', icon: 'goods/corn', blurb: 'Deep, well-watered soil for crops and plantations.' },
  timber: { name: 'Fine timber', icon: 'goods/timber', blurb: 'Tall straight trees, good for masts and building.' },
  furs: { name: 'Fur country', icon: 'goods/furs', blurb: 'Beaver and fox in plenty.' },
  dyes: { name: 'Dyewoods', icon: 'goods/dyes', blurb: 'Brazilwood and indigo grow wild here.' },
  spices: { name: 'Pepper groves', icon: 'goods/spices', blurb: 'Wild malagueta pepper.' },
};
export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/** Land costs in movement points for parties on foot. */
export const LAND_COST: Record<number, number> = {};
