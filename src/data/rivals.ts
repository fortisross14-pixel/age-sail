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
  blurb: string;
  edge: CrownEdge;
}

export const CROWNS: RivalSpec[] = [
  {
    id: 'spain', name: 'Castile', people: 'the Castilians', home: 'seville', volta: 20, pace: 8, start: 4,
    prefer: { old: [-5, 27], new: [5, 30] }, trade: 0.2,
    blurb: 'The largest realm in Iberia, with ports on the Atlantic and the Mediterranean and colonists to spare.',
    edge: { label: 'Colonists and missionaries come cheaper, and one more colonist waits in Sevilla.', extraUnits: ['colonist'], unitCost: { colonist: 0.7, missionary: 0.7 } },
  },
  {
    id: 'portugal', name: 'Portugal', people: 'the Portuguese', home: 'lisbon', volta: 16, pace: 9, start: 3,
    prefer: { old: [-5, 27], new: [-6, 15] }, trade: 0.5,
    blurb: 'The best navigators in Europe, with feitorias already along the African coast.',
    edge: { label: 'Begins with portolan charts and lateen rigs already known.', startTechs: ['portolan', 'lateen'] },
  },
  {
    id: 'england', name: 'England', people: 'the English', home: 'london', volta: 32, pace: 11, start: 10,
    prefer: { old: [5, 20], new: [33, 55] }, trade: 0.2,
    blurb: 'Late to the sea, but their colonies grow fast once planted.',
    edge: { label: 'Ships fight with half as many guns again at sea.', guns: 1.5 },
  },
  {
    id: 'france', name: 'France', people: 'the French', home: 'larochelle', volta: 36, pace: 13, start: 14,
    prefer: { old: [5, 20], new: [40, 55] }, trade: 0.6,
    blurb: 'The most populous kingdom in Europe, with a large court and a talent for alliances.',
    edge: { label: 'Two more courtiers, and gifts to native peoples count half as much again.', court: 2, gifts: 1.5 },
  },
  {
    id: 'netherlands', name: 'the Netherlands', people: 'the Dutch', home: 'antwerp', volta: 40, pace: 14, start: 20,
    prefer: { old: [-5, 15], new: [5, 45] }, trade: 0.7,
    blurb: 'Merchants above all: trading posts, cheap ships, and credit.',
    edge: { label: 'Better prices in every market, and ships cost a fifth less.', spread: 0.02, ships: 0.8 },
  },
];

export const rivalSpec = (id: CrownId) => CROWNS.find((r) => r.id === id)!;
export const crownSpec = rivalSpec;
/** The four crowns you are not playing. */
export const rivalsOf = (me: CrownId) => CROWNS.filter((c) => c.id !== me);

/** A rival colony gains a settler from home every this many seasons (yours grow by the ships you send). */
export const RIVAL_SETTLERS_EVERY = 8;
