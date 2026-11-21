/**
 * The ruling houses of the five crowns in 1492, and what the game needs to carry them on: names
 * for children, numerals, titles, and the flavour that stories draw on (great houses, a seat of
 * learning, bankers, a saint) so that no text is written for one crown alone.
 */
import type { CrownId } from './rivals';
import type { RealmId } from './realms';

export type Gift = 'navigation' | 'military' | 'commerce' | 'construction' | 'diplomacy';

export interface RoyalSeed { name: string; sex: 'm' | 'f'; born: number; gift: Gift; numeral?: number }

export interface HouseSpec {
  house: string;
  /** what a ruling man and a ruling woman are called */
  titles: [string, string];
  ruler: RoyalSeed;
  consort?: RoyalSeed;
  heirs: RoyalSeed[];
  names: { m: string[]; f: string[] };
  /** how many rulers of each name came before 1492, for numerals */
  before: Record<string, number>;
  /** great families, for marriages and quarrels */
  houses: string[];
  school: string;
  bankers: string;
  saint: string;
  court: string;
}

export const HOUSES: Record<CrownId, HouseSpec> = {
  spain: {
    house: 'Trastámara', titles: ['King', 'Queen'],
    ruler: { name: 'Isabel', sex: 'f', born: 1451, gift: 'diplomacy', numeral: 1 },
    consort: { name: 'Fernando', sex: 'm', born: 1452, gift: 'military' },
    heirs: [{ name: 'Juan', sex: 'm', born: 1478, gift: 'military' }, { name: 'Juana', sex: 'f', born: 1479, gift: 'commerce' }],
    names: { m: ['Juan', 'Fernando', 'Carlos', 'Felipe', 'Alfonso', 'Enrique'], f: ['Isabel', 'Juana', 'María', 'Catalina', 'Leonor'] },
    before: { Juan: 2, Enrique: 4, Fernando: 5, Alfonso: 11, Isabel: 1 },
    houses: ['Mendoza', 'Guzmán', 'Velasco', 'Enríquez', 'Álvarez de Toledo'], school: 'Salamanca', bankers: 'the Genoese', saint: 'Santiago', court: 'the Alcázar',
  },
  portugal: {
    house: 'Avis', titles: ['King', 'Queen'],
    ruler: { name: 'João', sex: 'm', born: 1455, gift: 'navigation', numeral: 2 },
    consort: { name: 'Leonor', sex: 'f', born: 1458, gift: 'diplomacy' },
    heirs: [{ name: 'Manuel', sex: 'm', born: 1469, gift: 'commerce' }],
    names: { m: ['João', 'Manuel', 'Afonso', 'Sebastião', 'Henrique', 'Duarte'], f: ['Isabel', 'Maria', 'Beatriz', 'Leonor', 'Catarina'] },
    before: { 'João': 2, Afonso: 5, Duarte: 1 },
    houses: ['Bragança', 'Meneses', 'Castro', 'Almeida', 'Noronha'], school: 'Coimbra', bankers: 'the Florentines of Lisboa', saint: 'São Vicente', court: 'the Paço da Ribeira',
  },
  england: {
    house: 'Tudor', titles: ['King', 'Queen'],
    ruler: { name: 'Henry', sex: 'm', born: 1457, gift: 'commerce', numeral: 7 },
    consort: { name: 'Elizabeth', sex: 'f', born: 1466, gift: 'diplomacy' },
    heirs: [{ name: 'Arthur', sex: 'm', born: 1486, gift: 'diplomacy' }, { name: 'Henry', sex: 'm', born: 1491, gift: 'military' }],
    names: { m: ['Henry', 'Edward', 'Arthur', 'Edmund', 'Richard', 'Charles'], f: ['Elizabeth', 'Mary', 'Margaret', 'Catherine', 'Anne'] },
    before: { Henry: 7, Edward: 5, Richard: 3 },
    houses: ['Howard', 'Percy', 'Stanley', 'Courtenay', 'Neville'], school: 'Oxford', bankers: 'the Lombards of London', saint: 'Saint George', court: 'Westminster',
  },
  france: {
    house: 'Valois', titles: ['King', 'Queen'],
    ruler: { name: 'Charles', sex: 'm', born: 1470, gift: 'military', numeral: 8 },
    consort: { name: 'Anne', sex: 'f', born: 1477, gift: 'commerce' },
    heirs: [{ name: 'Louis', sex: 'm', born: 1462, gift: 'diplomacy' }],
    names: { m: ['Charles', 'Louis', 'François', 'Henri', 'Philippe'], f: ['Anne', 'Claude', 'Marguerite', 'Louise', 'Madeleine'] },
    before: { Charles: 8, Louis: 11, Philippe: 6, Henri: 1 },
    houses: ['Montmorency', 'Guise', 'Bourbon', 'Rohan', 'La Trémoille'], school: 'the Sorbonne', bankers: 'the bankers of Lyon', saint: 'Saint Denis', court: 'Amboise',
  },
  netherlands: {
    house: 'Burgundy', titles: ['Duke', 'Duchess'],
    ruler: { name: 'Philip', sex: 'm', born: 1478, gift: 'commerce', numeral: 1 },
    heirs: [{ name: 'Margaret', sex: 'f', born: 1480, gift: 'diplomacy' }],
    names: { m: ['Philip', 'Charles', 'Maximilian', 'William', 'Maurice'], f: ['Margaret', 'Mary', 'Eleanor', 'Isabella', 'Anna'] },
    before: { Philip: 1, Charles: 1 },
    houses: ['Egmont', 'Nassau', 'Croÿ', 'Brederode', 'Lalaing'], school: 'Leuven', bankers: 'the bankers of Brugge', saint: 'Saint Nicholas', court: 'the Coudenberg',
  },
};

/** What a ruler's gift does for the realm, in words. The numbers are in `src/sim/realm.ts`. */
export const GIFT_INFO: Record<Gift, { name: string; blurb: string }> = {
  navigation: { name: 'A patron of pilots', blurb: 'Your scholars work faster.' },
  military: { name: 'A soldier', blurb: 'Soldiers and ships cost less to keep.' },
  commerce: { name: 'A keeper of accounts', blurb: 'Your cities and colonies pay more in taxes.' },
  construction: { name: 'A builder', blurb: 'Colonies are more loyal: roads, churches and harbours are built in your name.' },
  diplomacy: { name: 'A peacemaker', blurb: 'The other crowns think better of you.' },
};

/** Princes and princesses the other realms of Europe offer in marriage. */
export const MATCH_NAMES: Partial<Record<RealmId, { m: string[]; f: string[] }>> = {
  spain: { m: ['Juan', 'Fernando'], f: ['Catalina', 'María'] },
  portugal: { m: ['Afonso', 'Luís'], f: ['Isabel', 'Beatriz'] },
  england: { m: ['Edmund', 'Arthur'], f: ['Margaret', 'Mary'] },
  france: { m: ['François', 'Charles'], f: ['Claude', 'Renée'] },
  netherlands: { m: ['Philip', 'Charles'], f: ['Margaret', 'Eleanor'] },
  empire: { m: ['Maximilian', 'Ferdinand'], f: ['Kunigunde', 'Margarete'] },
  naples: { m: ['Ferrante', 'Alfonso'], f: ['Giovanna', 'Isabella'] },
  denmark: { m: ['Christian', 'Frederik'], f: ['Elisabeth', 'Dorothea'] },
  scotland: { m: ['James', 'Alexander'], f: ['Margaret', 'Mary'] },
  venice: { m: ['Marco', 'Andrea'], f: ['Caterina', 'Lucrezia'] },
  genoa: { m: ['Andrea', 'Giovanni'], f: ['Bianca', 'Tommasina'] },
};

/** Numbers for the dynasty. Provisional until the balance phase. */
export const DYNASTY = {
  /** a ruler under this age reigns through a regent */
  ofAge: 16,
  /** chance each year that a married couple of the right age has a child */
  birth: 0.2,
  fertileUntil: 42,
  maxHeirs: 5,
  /** chance each year that a child under ten dies */
  childDeath: 0.02,
  /** years between rounds of marriage offers, and how many come */
  offersEvery: 2,
  offers: 3,
  /** a dowry, before prestige raises it */
  dowry: [600, 2400] as [number, number],
};

export const ROMAN = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'][n] ?? String(n);
