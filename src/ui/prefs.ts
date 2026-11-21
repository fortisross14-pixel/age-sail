/** Small per-player choices kept in the browser: they belong to the player, not to a voyage. */
const KEY = 'age-sail:prefs';

interface Prefs {
  /** ask before ending a turn with things undone */
  guard: boolean;
  /** the objectives panel folded away */
  objectivesFolded: boolean;
  /** first-voyage steps whose in-screen hint the player has closed */
  hintsSeen: string[];
  sideTab: 'goals' | 'realm';
  /** keys the player has changed: a row of the key table, and the keys it answers to */
  keys: Record<string, string[]>;
  /** how large the interface is drawn */
  uiScale: number;
  /** kinds of news shown on the map; the rest are only in the Chronicle */
  news: Record<string, boolean>;
}

const DEFAULTS: Prefs = { guard: true, objectivesFolded: false, hintsSeen: [], sideTab: 'goals', keys: {}, uiScale: 1, news: { discovery: true, trade: true, voyage: true, peril: true, court: true } };

let prefs: Prefs = { ...DEFAULTS };
try {
  const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (v && typeof v === 'object') prefs = { ...DEFAULTS, ...v };
} catch { /* storage unavailable: defaults */ }

export const pref = <K extends keyof Prefs>(k: K): Prefs[K] => prefs[k];
export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  prefs = { ...prefs, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}
