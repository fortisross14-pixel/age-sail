import type { UnitType } from '../sim/types';

export type BuildingId = 'docks' | 'barracks' | 'church' | 'university' | 'market';

export interface BuildingSpec {
  name: string;
  /** cost and seasons to reach each level; index = level (index 0 unused) */
  levels: { cost: number; build: number }[];
  /** what each level does, for the player */
  effect: string[];
  blurb: string;
}

export const BUILDINGS: Record<BuildingId, BuildingSpec> = {
  docks: {
    name: 'Docks', blurb: 'Slipways and quays. Larger docks build larger ships.',
    levels: [{ cost: 0, build: 0 }, { cost: 1200, build: 2 }, { cost: 2500, build: 3 }, { cost: 5000, build: 4 }],
    effect: ['', 'Builds caravels.', 'Builds carracks.', 'Builds galleons.'],
  },
  barracks: {
    name: 'Barracks', blurb: 'A drill yard and an armoury for soldiers bound overseas.',
    levels: [{ cost: 0, build: 0 }, { cost: 1500, build: 2 }, { cost: 3000, build: 3 }],
    effect: ['', 'Trains infantry.', 'Trains infantry faster and cheaper.'],
  },
  church: {
    name: 'Church', blurb: 'A great church with a friary, sending friars to the peoples beyond the sea.',
    levels: [{ cost: 0, build: 0 }, { cost: 1200, build: 2 }],
    effect: ['', 'Trains missionaries.'],
  },
  university: {
    name: 'University', blurb: 'Cosmographers, physicians and lawyers. Knowledge for the Crown.',
    levels: [{ cost: 0, build: 0 }, { cost: 2500, build: 3 }, { cost: 4000, build: 4 }],
    effect: ['', '+2 research points a season.', '+4 research points a season.'],
  },
  market: {
    name: 'Market', blurb: 'An exchange and warehouses. Merchants pay their dues, and trade comes cheaper.',
    levels: [{ cost: 0, build: 0 }, { cost: 1500, build: 2 }, { cost: 3500, build: 3 }],
    effect: ['', '+60 ducats in dues a season; better prices in this city.', '+120 ducats a season; better prices still.'],
  },
};

export const BUILDING_ORDER: BuildingId[] = ['docks', 'barracks', 'church', 'university', 'market'];

/** Building places in each city: every level of every building takes one. */
export const CITY_SPACE: Record<string, { slots: number; taxes: number; start: Partial<Record<BuildingId, number>> }> = {
  seville: { slots: 7, taxes: 100, start: { docks: 2, market: 1 } },
  cadiz: { slots: 5, taxes: 40, start: { docks: 1 } },
};

export interface UnitSpec { cost: number; build: number; needs: BuildingId | null; upkeep: number; moves: number }

export const UNIT_SPECS: Record<UnitType, UnitSpec> = {
  colonist: { cost: 300, build: 1, needs: null, upkeep: 4, moves: 3 },
  infantry: { cost: 500, build: 2, needs: 'barracks', upkeep: 8, moves: 3 },
  missionary: { cost: 400, build: 1, needs: 'church', upkeep: 4, moves: 3 },
};

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
