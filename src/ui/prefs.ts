/** Small per-player choices kept in the browser: they belong to the player, not to a voyage. */
const KEY = 'age-sail:prefs';

interface Prefs {
  /** ask before ending a turn with things undone */
  guard: boolean;
  /** the objectives panel folded away */
  objectivesFolded: boolean;
  /** first-voyage steps whose in-screen hint the player has closed */
  hintsSeen: string[];
}

const DEFAULTS: Prefs = { guard: true, objectivesFolded: false, hintsSeen: [] };

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
