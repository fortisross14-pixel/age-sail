import type { TechId } from './tech';
import type { UnitType } from '../sim/types';

/** The five Atlantic crowns: one is the player, the other four are rivals. */
export type CrownId = 'spain' | 'portugal' | 'england' | 'france' | 'netherlands';

/** What sets a crown apart when you play it. */
export interface CrownEdge {
  /** shown on the menu */
  label: string;
  /** units waiting in the main port at the start, besides the usual colonist and soldier */
  extraUnits?: UnitType[];
  /** cheaper units: price factor */
  unitCost?: Partial<Record<UnitType, number>>;
  startTechs?: TechId[];
  /** sea battles: guns count this much more */
  guns?: number;
  /** more courtiers at the start */
  court?: number;
  /** gifts to native peoples count this much more */
  gifts?: number;
  /** narrower spread when trading */
  spread?: number;
  /** ship building price factor */
  ships?: number;
}

export interface RivalSpec {
  id: CrownId;
  name: string;
  /** what the player sees: "the Portuguese" */
  people: string;
  home: string;
  /** turn they master long-distance navigation */
  volta: number;
  /** seasons between new colonies, at first */
  pace: number;
  /** first season they found anything */
  start: number;
  /** where they prefer to settle: latitude range on each board */
  prefer: { old?: [number, number]; new?: [number, number] };
  /** how much of their effort goes into trading posts rather than colonies */
  trade: number;
  /** how readily they fight: with you, and with each other (1 is ordinary) */
  war: number;
  blurb: string;
  edge: CrownEdge;
}

export const CROWNS: RivalSpec[] = [
  {
    id: 'spain', name: 'Castile', people: 'the Castilians', home: 'seville', volta: 20, pace: 8, start: 4,
    prefer: { old: [-5, 27], new: [5, 30] }, trade: 0.2, war: 1.1,
    blurb: 'The largest realm in Iberia, with ports on the Atlantic and the Mediterranean and colonists to spare.',
    edge: { label: 'Colonists and missionaries come cheaper, and one more colonist waits in Sevilla.', extraUnits: ['colonist'], unitCost: { colonist: 0.7, missionary: 0.7 } },
  },
  {
    id: 'portugal', name: 'Portugal', people: 'the Portuguese', home: 'lisbon', volta: 16, pace: 9, start: 3,
    prefer: { old: [-5, 27], new: [-6, 15] }, trade: 0.5, war: 0.8,
    blurb: 'The best navigators in Europe, with feitorias already along the African coast.',
    edge: { label: 'Begins with portolan charts and lateen rigs already known.', startTechs: ['portolan', 'lateen'] },
  },
  {
    id: 'england', name: 'England', people: 'the English', home: 'london', volta: 32, pace: 11, start: 10,
    prefer: { old: [5, 20], new: [33, 55] }, trade: 0.2, war: 1.3,
    blurb: 'Late to the sea, but their colonies grow fast once planted.',
    edge: { label: 'Ships fight with half as many guns again at sea.', guns: 1.5 },
  },
  {
    id: 'france', name: 'France', people: 'the French', home: 'larochelle', volta: 36, pace: 13, start: 14,
    prefer: { old: [5, 20], new: [40, 55] }, trade: 0.6, war: 1,
    blurb: 'The most populous kingdom in Europe, with a large court and a talent for alliances.',
    edge: { label: 'Two more courtiers, and gifts to native peoples count half as much again.', court: 2, gifts: 1.5 },
  },
  {
    id: 'netherlands', name: 'the Netherlands', people: 'the Dutch', home: 'antwerp', volta: 40, pace: 14, start: 20,
    prefer: { old: [-5, 15], new: [5, 45] }, trade: 0.7, war: 0.7,
    blurb: 'Merchants above all: trading posts, cheap ships, and credit.',
    edge: { label: 'Better prices in every market, and ships cost a fifth less.', spread: 0.02, ships: 0.8 },
  },
];

export const rivalSpec = (id: CrownId) => CROWNS.find((r) => r.id === id)!;
export const crownSpec = rivalSpec;
/** The four crowns you are not playing. */
export const rivalsOf = (me: CrownId) => CROWNS.filter((c) => c.id !== me);

/**
 * How a rival crown lives. Provisional numbers (Phase 6 tunes them); chosen so that a crown with
 * no colonies still sends an expedition about every `pace` seasons, as it did before it had a purse.
 */
export const RIVAL_ECON = {
  /** ducats a season the realm spares for ventures overseas */
  homeIncome: 70,
  /** ducats a season from each trading post */
  perPost: 25,
  startTreasury: 300,
  startShips: 2,
  /** a crown keeps this many ships, and one more for every two colonies, up to `maxShips` */
  baseShips: 4,
  maxShips: 12,
  shipCost: 600,
  /** ducats a season to keep each ship */
  shipUpkeep: 6,
  /** a colonising voyage and a trading voyage cost this much for each season of the crown's `pace` */
  settlePerPace: 55,
  tradePerPace: 30,
  supply: 150,
  privateer: 300,
  raid: 400,
  /** how far from one of their colonies they will land soldiers on yours */
  raidReach: 12,
  /** seasons of stores a convoy leaves; a colony asks for a ship when it is down to `supplyLow` */
  supplyFull: 16,
  supplyLow: 5,
  /** a supplied colony's growth a season (a convoy also lands a settler); an unsupplied one shrinks */
  births: 0.05,
  want: 0.08,
  /** share of its produce an unsupplied colony still grows */
  wantWork: 0.4,
  /** chance a season that the last settler of an unsupplied colony gives up */
  abandon: 0.1,
  /** what is left of a cargo's sale after the voyage is paid for: their profit, and their commerce score */
  margin: 0.2,
  /** chance a season that a ship at sea is lost (twice that across the ocean) */
  wreck: 0.008,
  /** ducats a season a crown pays its pilots to study the ocean crossing; it is learned after `volta` seasons of study */
  study: 12,
  /** an army marches when the colony is within this many hexes by land, this many hexes a season */
  marchReach: 9,
  marchPace: 2,
  /** ducats a season a war with another crown costs each side */
  warCost: 30,
  /** a people's regard for a crown: friends above, raiders below */
  peopleFriend: 40,
  peopleAngry: -40,
};

/** Names for rival ships. */
export const SHIP_NAMES_BY_CROWN: Record<CrownId, string[]> = {
  spain: ['Santa Ana', 'San Martín', 'La Trinidad', 'Santiago', 'San Pedro', 'La Concepción'],
  portugal: ['São Gabriel', 'São Rafael', 'Bérrio', 'Flor de la Mar', 'Santa Catarina', 'Esperança'],
  england: ['Mary Rose', 'Golden Hind', 'Swallow', 'Minion', 'Jesus of Lübeck', 'Pelican'],
  france: ['La Dauphine', 'Grande Hermine', 'Petite Hermine', 'Émérillon', 'La Normande', 'Le Griffon'],
  netherlands: ['Halve Maen', 'Duyfken', 'Mauritius', 'Hollandia', 'Amsterdam', 'Eendracht'],
};
