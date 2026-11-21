/**
 * Stories as data. A story binds its subjects (a courtier, a fleet, a colony, a people, a crown...),
 * checks its conditions, and offers choices whose effects come from a fixed vocabulary. The engine
 * that reads these is `src/sim/stories.ts`; nothing here is code.
 *
 * Text may use {courtier} {courtier.first} {other} {other.first} {fleet} {colony} {people} {crown}
 * {crown.people} {realm} {capital} {me} {ruler} {ruler.title} {heir} {house} {school} {bankers}
 * {saint} {court} {land}; a follow-up may also use what its sender put in its context ({foe},
 * {cause}). A story may only name a subject it binds in `about`.
 */
export type Family = 'sea' | 'court' | 'colonies' | 'peoples' | 'crowns' | 'europe' | 'eras' | 'dynasty' | 'history';

export const FAMILY_NAME: Record<Family, string> = {
  sea: 'At sea', court: 'The court', colonies: 'The colonies', peoples: 'The peoples', crowns: 'Rival crowns',
  europe: 'Europe', eras: 'The age', dynasty: 'The dynasty', history: 'History',
};

/** Who or what a story is about, and which of them will do. Several filters are joined by spaces. */
export interface About {
  /** any | atCourt | explorer | merchant | governor | ranked | plain | young | old | disloyal | loyal | ambitious | pious | learned | bold | navigator | soldier | trader | builder | envoy */
  courtier?: string;
  /** a second courtier: any | atCourt | rivalOf (a rival of the first) | friendOf */
  other?: string;
  /** any | atSea | inPort | led | lowStores | deep | cargo | newWorld | big */
  fleet?: string;
  /** any | disloyal | loyal | big | hungry | old | new | chartered | uncharted | garrison | nogarrison | nearRival */
  colony?: string;
  /** met | peace | allied | hostile | friendly | post | mission | feud | subject | strong | weak */
  people?: string;
  /** a rival crown: any | peace | war | hostile | friendly | ahead | behind | neighbour */
  crown?: string;
  /** another realm of Europe: any | tied (by marriage) | untied */
  realm?: string;
  /** a stretch of coast no chart shows */
  coast?: 'unknown';
}

/** A condition on the realm as a whole. */
export type Cond =
  | ['year', '<' | '>=', number]
  | ['treasury', '<' | '>=', number]
  | ['prestige', '<' | '>=', number]
  | ['colonies', '<' | '>=', number]
  | ['fleets', '<' | '>=', number]
  | ['flag', string] | ['noflag', string]
  | ['crown', ...string[]]
  | ['tech', string] | ['notech', string]
  | ['newWorld'] | ['noNewWorld']
  | ['married'] | ['unmarried'] | ['heir'] | ['noheir'] | ['regency'] | ['noregency'] | ['rulerOld'] | ['rulerYoung']
  | ['atWar'] | ['atPeace']
  | ['found', ...string[]]
  | ['galleonHome']
  | ['chance', number];

/** Something a choice does. The subject is the one the story binds, unless a slot is named. */
export type Effect =
  | ['ducats', number] | ['prestige', number] | ['research', number]
  | ['loan', number, number, number]
  | ['skill', 'courtier' | 'other', string, number]
  | ['trait', 'courtier' | 'other', string]
  | ['leave', 'courtier' | 'other'] | ['die', 'courtier' | 'other']
  | ['opinion', 'courtier' | 'other', number, string]
  | ['bond', 'rival' | 'friend']
  | ['courtAll', number, string]
  | ['crew', number] | ['stores', number] | ['hull', number] | ['halt'] | ['cargoLose', number]
  | ['loyalty', number] | ['loyaltyAll', number] | ['pop', number] | ['food', number] | ['charter'] | ['garrison', number]
  | ['regard', number, string] | ['warriors', number] | ['convert', number]
  | ['attitude', number] | ['attitudeAll', number] | ['war'] | ['rivalDucats', number]
  | ['realmTie'] | ['shock', string, string]
  | ['flag', string] | ['unflag', string]
  | ['later', string, number]
  | ['heirBorn'] | ['heirGift', string] | ['rulerFrail', number] | ['consortDies']
  | ['special', string];

export interface Outcome { effects: Effect[]; text: string }

export interface ChoiceDef extends Outcome {
  label: string;
  /** shown under the label; written from the effects when left out */
  hint?: string;
  /** offered only when these hold */
  need?: Cond[];
  /** the outcome is not certain: `[whose, skill, base chance, added per skill point]`; on a miss, `else` happens */
  roll?: ['courtier' | 'other' | 'ruler' | 'none', string, number, number];
  else?: Outcome;
}

export interface StoryDef {
  id: string;
  family: Family;
  /** seasons before it may come again; left out, it is told once in a game */
  again?: number;
  /** how likely beside the others, 1 if left out */
  weight?: number;
  about?: About;
  when?: Cond[];
  /** only ever reached as a follow-up (`later`) or by the rules, never drawn by chance */
  chained?: boolean;
  title: string;
  text: string;
  choices: ChoiceDef[];
}
