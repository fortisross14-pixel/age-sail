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
  { id: 'short', name: 'Short', until: 1550, blurb: 'The age of discovery and conquest. About 230 seasons.' },
  { id: 'standard', name: 'Standard', until: 1650, blurb: 'Through the plantations to the golden age of trade. About 630 seasons.' },
  { id: 'full', name: 'Full', until: 1750, blurb: 'The whole age of sail. About 1,030 seasons.' },
] as const;

/** The standard game, used wherever no length is chosen. */
export const DEFAULT_UNTIL = 1650;
