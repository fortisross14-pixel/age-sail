export interface Era { id: string; name: string; year: number; blurb: string }

export const ERAS: Era[] = [
  { id: 'discovery', name: 'Age of Discovery', year: 1492, blurb: 'Caravels feel their way along unknown coasts. Every chart is a secret worth a fortune.' },
  { id: 'conquest', name: 'Age of Conquest', year: 1520, blurb: 'Soldiers follow the explorers. Empires across the sea are toppled or courted, and the treasure ships begin.' },
  { id: 'plantations', name: 'Age of Plantations', year: 1570, blurb: 'Sugar, tobacco and silver flow to Europe. Colonies grow into towns, and their settlers begin to see themselves differently.' },
  { id: 'trade', name: 'Golden Age of Trade', year: 1620, blurb: 'Companies, exchanges and convoys. Whoever controls the markets controls the age.' },
  { id: 'empire', name: 'Empire and Rivalry', year: 1690, blurb: 'Great colonial empires face each other, and their own colonists. Loyalty can no longer be taken for granted.' },
];

export const eraAt = (year: number) => [...ERAS].reverse().find((e) => year >= e.year)!;
export const eraIndex = (year: number) => ERAS.indexOf(eraAt(year));

export const GAME_LENGTHS = [
  { id: 'short', name: 'Short', until: 1550, blurb: 'The age of discovery and conquest. About 115 turns.' },
  { id: 'standard', name: 'Standard', until: 1650, blurb: 'Through the plantations to the golden age of trade. About 215 turns.' },
  { id: 'full', name: 'Full', until: 1750, blurb: 'The whole age of sail. About 315 turns.' },
] as const;

/** The standard game, used wherever no length is chosen. */
export const DEFAULT_UNTIL = 1650;

/**
 * The calendar of turns. The rules run season by season underneath; a player's turn covers half a
 * year (spring and summer, then autumn and winter) until this year, then a whole year.
 */
export const HALF_YEAR_TURNS_UNTIL = 1550;

/** What a path asks of the age: a gain in this, by the time the next era begins. */
export type EraGoal = { kind: 'revenue' | 'colonists' | 'prestige' | 'territory'; need: number };

/**
 * A path for an era: a lasting advantage while the era lasts, and a goal. Each new era offers
 * three. Meeting the goal by the end of the era pays `ERA_REWARD` prestige. The goals are
 * totals since the start of the game, set in the balance pass a little above what the harness's bot
 * has when each era ends, so that a promise is kept by intent and not by default.
 */
export interface EraPath {
  id: string;
  name: string;
  blurb: string;
  /** multipliers and additions read by `src/sim/realm.ts` */
  mod: { taxes?: number; research?: number; upkeep?: number; loyalty?: number };
  goal: EraGoal;
}

export const ERA_REWARD = 30;

export const ERA_PATHS: Record<string, EraPath[]> = {
  conquest: [
    { id: 'sword', name: 'The sword', blurb: 'Soldiers are the cheapest way to an empire. Your captains are promised land and titles.', mod: { upkeep: 0.8 }, goal: { kind: 'prestige', need: 180 } },
    { id: 'cross', name: 'The cross', blurb: 'The friars go first, and the settlers follow them. Colonies that hear Mass stay loyal.', mod: { loyalty: 6 }, goal: { kind: 'colonists', need: 50 } },
    { id: 'ledger', name: 'The ledger', blurb: 'Let others take cities. You will take their trade, and tax it.', mod: { taxes: 1.1 }, goal: { kind: 'revenue', need: 600000 } },
  ],
  plantations: [
    { id: 'estates', name: 'Great estates', blurb: 'Grant the land in great parcels to those who will make it pay.', mod: { taxes: 1.12 }, goal: { kind: 'revenue', need: 1200000 } },
    { id: 'towns', name: 'Free towns', blurb: 'Councils, markets and schools: settlers who feel at home do not dream of leaving you.', mod: { loyalty: 8 }, goal: { kind: 'colonists', need: 80 } },
    { id: 'fleets', name: 'Royal fleets', blurb: 'Convoys under your flag, and yards that never stand idle.', mod: { upkeep: 0.8 }, goal: { kind: 'territory', need: 120 } },
  ],
  trade: [
    { id: 'companies', name: 'Chartered companies', blurb: 'Merchants who share the risk, and the Crown that shares the profit.', mod: { taxes: 1.15 }, goal: { kind: 'revenue', need: 2000000 } },
    { id: 'academies', name: 'Academies', blurb: 'Astronomers, botanists and engineers at your expense, and in your service.', mod: { research: 3 }, goal: { kind: 'prestige', need: 400 } },
    { id: 'forts', name: 'Convoys and forts', blurb: 'What is yours will be held, on every coast.', mod: { upkeep: 0.8 }, goal: { kind: 'territory', need: 160 } },
  ],
  empire: [
    { id: 'reform', name: 'Reform', blurb: 'Lighter hands, fairer courts, and seats for the colonists at your table.', mod: { loyalty: 10 }, goal: { kind: 'colonists', need: 130 } },
    { id: 'mercantile', name: 'The mercantile laws', blurb: 'The colonies exist to enrich the mother country, and the law will say so.', mod: { taxes: 1.18, loyalty: -5 }, goal: { kind: 'revenue', need: 3000000 } },
    { id: 'army', name: 'A standing army', blurb: 'Regiments in every colony, paid for by the colonies.', mod: { upkeep: 0.75 }, goal: { kind: 'prestige', need: 550 } },
  ],
};
