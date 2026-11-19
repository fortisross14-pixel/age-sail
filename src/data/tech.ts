export type TechId = 'portolan' | 'lateen' | 'astrolabe' | 'volta' | 'bookkeeping' | 'factors' | 'chancery';
export type Branch = 'navigation' | 'commerce' | 'state';

export interface Tech {
  id: TechId;
  name: string;
  branch: Branch;
  cost: number;
  requires: TechId[];
  effect: string;
  blurb: string;
}

export const TECHS: Tech[] = [
  {
    id: 'portolan', name: 'Portolan charts', branch: 'navigation', cost: 16, requires: [],
    effect: 'All fleets see 1 hex further.', blurb: 'Pilots copy each other’s coastlines onto vellum, bearing by bearing.',
  },
  {
    id: 'lateen', name: 'Lateen rig', branch: 'navigation', cost: 24, requires: ['portolan'],
    effect: 'All ships sail better toward the wind.', blurb: 'Triangular sails borrowed from the Mediterranean let a ship beat home against the trades.',
  },
  {
    id: 'astrolabe', name: 'Astrolabe and tables', branch: 'navigation', cost: 30, requires: ['portolan'],
    effect: 'All fleets get 2 more moves a season.', blurb: 'With the sun’s height and a book of tables, a pilot knows his latitude far from land.',
  },
  {
    id: 'volta', name: 'Volta do mar', branch: 'navigation', cost: 55, requires: ['lateen', 'astrolabe'],
    effect: 'Long-distance navigation: the deep ocean no longer spoils stores or doubles storms. Ships carry 2 more seasons of food.',
    blurb: 'Sail wide into the ocean to find the wind that brings you home. The crossing becomes hard, but possible.',
  },
  {
    id: 'bookkeeping', name: 'Double-entry bookkeeping', branch: 'commerce', cost: 25, requires: [],
    effect: 'Buy and sell closer to the market price.', blurb: 'Every ducat in two columns. Factors cheat less when the books balance.',
  },
  {
    id: 'factors', name: 'Factors abroad', branch: 'commerce', cost: 45, requires: ['bookkeeping'],
    effect: 'Trading grounds you have found gather half as much again of their goods.',
    blurb: 'Agents who stay behind between voyages, buying ahead of the next fleet.',
  },
  {
    id: 'chancery', name: 'Royal chancery', branch: 'state', cost: 25, requires: [],
    effect: '2 more research points every season.', blurb: 'Clerks, copyists and cosmographers paid from your purse.',
  },
];

export const techById = (id: TechId) => TECHS.find((t) => t.id === id)!;
export const BRANCH_NAMES: Record<Branch, string> = { navigation: 'Navigation', commerce: 'Commerce', state: 'State' };
