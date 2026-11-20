import type { ShipType } from './ships';

export type TechId =
  | 'portolan' | 'lateen' | 'astrolabe' | 'volta' | 'victualling' | 'latitude' | 'galleon' | 'cartography' | 'careening' | 'lunars'
  | 'bookkeeping' | 'factors' | 'exchange' | 'insurance' | 'companies' | 'plantations' | 'mercantilism' | 'banking'
  | 'chancery' | 'printing' | 'humanism' | 'bureaucracy' | 'viceroys' | 'ambassadors' | 'philosophy'
  | 'arquebus' | 'pikeshot' | 'gunfounding' | 'horses' | 'bastions' | 'broadside' | 'regiments';
export type Branch = 'navigation' | 'commerce' | 'state' | 'war';

/**
 * What knowledge and law do for the realm, added up by `realmMods` in `src/sim/dynasty.ts`.
 * Multipliers multiply; the rest add. Provisional numbers.
 */
export interface Mods {
  taxes?: number; upkeep?: number; growth?: number; storms?: number; unitCost?: number; guns?: number;
  research?: number; loyalty?: number; regard?: number; moves?: number; sight?: number; stores?: number;
  /** taken off the haggling margin on every trade */
  spread?: number;
}

export interface Tech {
  id: TechId;
  name: string;
  branch: Branch;
  cost: number;
  requires: TechId[];
  effect: string;
  blurb: string;
  mods?: Mods;
  /** what it makes possible: ships to build, companies to train, the star fort, laws to enact */
  unlocks?: { ships?: ShipType[]; units?: string[]; walls?: number; laws?: string[]; treaties?: string[] };
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
  {
    id: 'victualling', name: 'Victualling', branch: 'navigation', cost: 30, requires: ['portolan'], mods: { stores: 1 },
    effect: 'Ships carry 1 more season of food.', blurb: 'Twice-baked biscuit, salt beef in brine, and a purser who is watched.',
  },
  {
    id: 'latitude', name: 'Latitude sailing', branch: 'navigation', cost: 70, requires: ['volta'], mods: { moves: 1, storms: 0.85 },
    effect: '1 more move a season; storms strike less often.', blurb: 'Run down the latitude of your landfall and you cannot miss it.',
  },
  {
    id: 'galleon', name: 'The galleon', branch: 'navigation', cost: 80, requires: ['volta'], unlocks: { ships: ['galleon'] },
    effect: 'Your largest docks can build galleons.', blurb: 'Lower castles, a longer keel, and a hold for the riches of the Indies.',
  },
  {
    id: 'cartography', name: 'The new cartography', branch: 'navigation', cost: 100, requires: ['latitude', 'printing'], mods: { sight: 1, research: 1 },
    effect: 'Fleets see 1 hex further; 1 more research point a season.', blurb: 'A chart on which a straight course is a straight line.',
  },
  {
    id: 'careening', name: 'Careening and sheathing', branch: 'navigation', cost: 110, requires: ['galleon'], mods: { upkeep: 0.93 },
    effect: 'Ships and soldiers cost less to keep.', blurb: 'Hulls scraped, tarred and sheathed against the worm of warm seas.',
  },
  {
    id: 'lunars', name: 'Lunar distances', branch: 'navigation', cost: 180, requires: ['cartography', 'philosophy'], mods: { moves: 1, storms: 0.9 },
    effect: '1 more move a season; storms strike less often.', blurb: 'The Moon as a clock in the sky: longitude, at last, within a degree.',
  },
  {
    id: 'exchange', name: 'The bourse', branch: 'commerce', cost: 50, requires: ['bookkeeping'], mods: { spread: 0.01 }, unlocks: { laws: ['free_ports'] },
    effect: 'Better prices everywhere. Opens the law of free ports.', blurb: 'One building where every price in Europe is known by noon.',
  },
  {
    id: 'insurance', name: 'Marine insurance', branch: 'commerce', cost: 70, requires: ['exchange'], mods: { taxes: 1.04 },
    effect: 'Taxes rise a little: merchants risk more when a loss is shared.', blurb: 'A lost ship ruins nobody when forty men have each signed for a fortieth.',
  },
  {
    id: 'plantations', name: 'Plantation husbandry', branch: 'commerce', cost: 80, requires: ['factors'], mods: { growth: 1.15 }, unlocks: { laws: ['land_grants'] },
    effect: 'Colonies grow faster. Opens the law of land grants.', blurb: 'Which crop, which soil, which season: written down, and sent out with every ship.',
  },
  {
    id: 'companies', name: 'Joint-stock companies', branch: 'commerce', cost: 110, requires: ['factors', 'exchange'], mods: { taxes: 1.06 }, unlocks: { laws: ['monopoly'] },
    effect: 'Taxes rise. Opens the law of royal monopoly.', blurb: 'A venture too large for any one purse, owned in shares by a thousand.',
  },
  {
    id: 'banking', name: 'Public banks', branch: 'commerce', cost: 120, requires: ['insurance'],
    effect: 'Debt costs less: interest falls from 5% to 2% a season.', blurb: 'A bank that answers to the city, and lends to the Crown at a rate the Crown can bear.',
  },
  {
    id: 'mercantilism', name: 'The balance of trade', branch: 'commerce', cost: 160, requires: ['companies', 'bureaucracy'], mods: { taxes: 1.04 }, unlocks: { laws: ['navigation_acts'] },
    effect: 'Taxes rise a little. Opens the navigation acts.', blurb: 'Sell more to strangers than you buy from them, and the realm grows rich.',
  },
  {
    id: 'printing', name: 'The printing press', branch: 'state', cost: 45, requires: ['chancery'], mods: { research: 2 },
    effect: '2 more research points a season.', blurb: 'A book that took a monk a year is now a morning’s work.',
  },
  {
    id: 'bureaucracy', name: 'Councils and secretaries', branch: 'state', cost: 60, requires: ['chancery'], mods: { taxes: 1.05 }, unlocks: { laws: ['census'] },
    effect: 'Taxes rise. Opens the law of the census.', blurb: 'Government by paper: slower than a king’s word, and much harder to cheat.',
  },
  {
    id: 'humanism', name: 'The new learning', branch: 'state', cost: 75, requires: ['printing'], mods: { research: 1 }, unlocks: { laws: ['tolerance', 'orthodoxy'] },
    effect: '1 more research point a season. Opens the laws of toleration and of orthodoxy.', blurb: 'Read the old books in their own tongues, and doubt what you were told they said.',
  },
  {
    id: 'viceroys', name: 'Viceroys and councils of the Indies', branch: 'state', cost: 100, requires: ['bureaucracy'], mods: { loyalty: 5 }, unlocks: { laws: ['charters'] },
    effect: 'Colonies are more loyal. Opens the law of municipal charters.', blurb: 'Your person, in another hemisphere, with a seal and a salary.',
  },
  {
    id: 'ambassadors', name: 'Resident ambassadors', branch: 'state', cost: 100, requires: ['humanism'], mods: { regard: 8 }, unlocks: { treaties: ['alliance'] },
    effect: 'Every crown thinks better of you. Alliances can be made in Europe.', blurb: 'An honest man sent to lie abroad for the good of his country.',
  },
  {
    id: 'philosophy', name: 'Natural philosophy', branch: 'state', cost: 150, requires: ['humanism'], mods: { research: 3 },
    effect: '3 more research points a season.', blurb: 'Measure it, weigh it, try it again, and write down what happened.',
  },
  {
    id: 'arquebus', name: 'The arquebus', branch: 'war', cost: 25, requires: [], unlocks: { units: ['musketeer'] },
    effect: 'Barracks can train arquebusiers.', blurb: 'A tube, a match and a prayer. It frightens the horses, and whoever has never heard one.',
  },
  {
    id: 'horses', name: 'Horse transports', branch: 'war', cost: 30, requires: [], unlocks: { units: ['cavalry'] },
    effect: 'Barracks can train lancers to carry overseas.', blurb: 'Slings, stalls and fodder: half the horses now live to see the other shore.',
  },
  {
    id: 'gunfounding', name: 'Gun founding', branch: 'war', cost: 55, requires: ['arquebus'], unlocks: { units: ['cannon'] },
    effect: 'Barracks can train field guns.', blurb: 'Bronze cast in one piece, on wheels, light enough for six horses.',
  },
  {
    id: 'pikeshot', name: 'Pike and shot', branch: 'war', cost: 70, requires: ['arquebus'], mods: { upkeep: 0.95 }, unlocks: { laws: ['conscription'] },
    effect: 'Soldiers cost a little less to keep. Opens the law of conscription.', blurb: 'Pikes to hold the horse off, shot to break the pikes: one body, drilled to move as one.',
  },
  {
    id: 'bastions', name: 'The bastion trace', branch: 'war', cost: 100, requires: ['gunfounding'], unlocks: { walls: 3 },
    effect: 'Towns overseas can raise star forts.', blurb: 'Low, thick, angled walls that leave a besieger no ground the guns cannot sweep.',
  },
  {
    id: 'broadside', name: 'Broadside gunnery', branch: 'war', cost: 120, requires: ['gunfounding', 'galleon'], mods: { guns: 1.25 },
    effect: 'Your ships fight a quarter better at sea.', blurb: 'Guns along the side, fired together, and reloaded before the enemy can close.',
  },
  {
    id: 'regiments', name: 'Standing regiments', branch: 'war', cost: 140, requires: ['pikeshot', 'bureaucracy'], mods: { unitCost: 0.85 },
    effect: 'Soldiers cost less to raise.', blurb: 'Companies that are not paid off at the peace, and so need not be raised again at the war.',
  },
];

export const techById = (id: TechId) => TECHS.find((t) => t.id === id)!;
export const BRANCH_NAMES: Record<Branch, string> = { navigation: 'Navigation', commerce: 'Commerce', state: 'State', war: 'War' };
export const BRANCHES: Branch[] = ['navigation', 'commerce', 'state', 'war'];
/** The tech that first allows a ship, a company of soldiers or a level of walls, if any does. */
export const techFor = (kind: 'ships' | 'units', what: string) => TECHS.find((t) => (t.unlocks?.[kind] as string[] | undefined)?.includes(what));
export const wallsTech = (level: number) => TECHS.find((t) => t.unlocks?.walls === level);
