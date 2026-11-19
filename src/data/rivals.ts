export type CrownId = 'portugal' | 'england' | 'netherlands';

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
}

export const RIVALS: RivalSpec[] = [
  {
    id: 'portugal', name: 'Portugal', people: 'the Portuguese', home: 'lisbon', volta: 16, pace: 9, start: 3,
    prefer: { old: [-5, 27], new: [-6, 15] }, trade: 0.5,
    blurb: 'The best navigators in Europe, with feitorias already along the African coast.',
  },
  {
    id: 'england', name: 'England', people: 'the English', home: 'london', volta: 32, pace: 11, start: 10,
    prefer: { old: [5, 20], new: [33, 55] }, trade: 0.2,
    blurb: 'Late to the sea, but their colonies grow fast once planted.',
  },
  {
    id: 'netherlands', name: 'the Netherlands', people: 'the Dutch', home: 'antwerp', volta: 40, pace: 14, start: 20,
    prefer: { old: [-5, 15], new: [5, 45] }, trade: 0.7,
    blurb: 'Merchants above all: trading posts, cheap ships, and credit.',
  },
];

export const rivalSpec = (id: CrownId) => RIVALS.find((r) => r.id === id)!;
