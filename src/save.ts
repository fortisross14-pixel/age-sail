import { GEN_VERSION } from './sim/version';
import type { GameState } from './sim/types';
import { RIVAL_ECON, rivalSpec, type CrownId } from './data/rivals';
import { dynastyFor } from './sim/dynasty';

/**
 * Save format. Bump SAVE_VERSION when the shape of GameState changes and add a migration from the
 * previous version; keep every migration, or saves of that version are stranded.
 * Version 10 is the M8 state (stored bare under `age-sail:save:v9`), now wrapped in an envelope.
 * Version 11 (M9) adds the crown you play and city sizes; M9 also redrew the maps (genVersion 2), so
 * older saves are refused rather than migrated.
 * Version 12 (M11) adds colony newcomers and births and deaths, and what native peoples remember and
 * whether they besiege a colony. Turns now cover half a year, then a year; the season clock is unchanged.
 * Version 13 (M12) adds army supply (party food), colony walls and veteran ranks; old infantry are
 * pikemen.
 * Version 14 (M13) adds factories in European ports and market shocks.
 * Version 15 (Phase 1, the first hour) adds the difficulty and objectives. An older voyage is Captain,
 * and ticks the objectives it has already met without rewards when it is next loaded.
 * Version 16 (Phase 2, a world that pushes back) gives rival crowns a purse, ships that come home, plans and
 * relations with each other; their colonies stores and produce; peoples a regard for each crown and feuds.
 * Version 17 (Phase 3, stories and dynasty) adds the ruling house, story flags and follow-ups, what courtiers
 * remember and want, the era's path, the name of the new land, pacts between peoples, and what rivals have
 * learned of the crossing. An older voyage gets a ruler in their prime, named from its seed.
 */
export const SAVE_VERSION = 17;
export const SAVE_KEY = 'age-sail:save';
/** Keys used before the envelope. v9 is migrated; older ones can't be read and are removed. */
export const LEGACY_KEY = 'age-sail:save:v9';
export const STALE_KEYS = [1, 2, 3, 4, 5, 6, 7, 8].map((v) => `age-sail:save:v${v}`);

export interface SaveEnvelope {
  saveVersion: number;
  genVersion: number;
  state: GameState;
}

export type LoadResult =
  | { ok: true; state: GameState; migrated: boolean }
  | { ok: false; reason: string };

/** saveVersion n → n + 1. Each is a pure function of the previous shape. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  11: (s) => {
    const colonies = (s.colonies as Record<string, unknown>[]).map((c) => ({
      ...c, growth: 0, newcomers: 0,
      last: { ...(c.last as object), births: 0, deaths: 0, garrison: 0, seasoned: 0, besieged: false },
    }));
    const natives = Object.fromEntries(Object.entries(s.natives as Record<string, Record<string, unknown>>)
      .map(([id, st]) => [id, { ...st, memory: [], siege: null }]));
    return { ...s, colonies, natives };
  },
  12: (s) => ({
    ...s,
    colonies: (s.colonies as Record<string, unknown>[]).map((c) => ({ ...c, walls: 0 })),
    parties: (s.parties as Record<string, unknown>[]).map((p) => ({ ...p, food: 12 })),
  }),
  13: (s) => ({ ...s, factories: [], shocks: [] }),
  14: (s) => ({ ...s, difficulty: 'captain', objectives: { done: {}, catchUp: true } }),
  15: (s) => ({
    ...s,
    rivals: Object.fromEntries(Object.entries(s.rivals as Record<string, Record<string, unknown>>).map(([id, r]) => [id, {
      ...r, treasury: RIVAL_ECON.startTreasury, hulls: RIVAL_ECON.startShips, built: RIVAL_ECON.startShips + (s.rivalShips as { crown: string }[]).filter((x) => x.crown === id).length,
      plan: { kind: 'idle' }, toward: {}, wars: [], rivalWarSince: {},
    }])),
    rivalColonies: (s.rivalColonies as Record<string, unknown>[]).map((c) => ({ ...c, supply: RIVAL_ECON.supplyFull, stock: 0, growth: 0 })),
    rivalShips: (s.rivalShips as Record<string, unknown>[]).map((x, i) => ({ ...x, name: `Ship ${i + 1}`, homeward: false, cargo: null })),
    natives: Object.fromEntries(Object.entries(s.natives as Record<string, Record<string, unknown>>).map(([id, st]) => [id, { ...st, crowns: {}, feud: null }])),
  }),
  16: (s) => {
    const person = (p: Record<string, unknown>) => ({ ...p, loyalty: 60, memory: [], bonds: [], want: null });
    const turn = s.turn as number;
    return {
      ...s, flags: {}, pending: [], eraPath: null, land: null, dynasty: dynastyFor(s.crown as CrownId, s.seed as number, turn),
      people: (s.people as Record<string, unknown>[]).map(person),
      petitioners: (s.petitioners as { person: Record<string, unknown> }[]).map((x) => ({ ...x, person: person(x.person) })),
      natives: Object.fromEntries(Object.entries(s.natives as Record<string, Record<string, unknown>>).map(([id, st]) => [id, { ...st, pact: null }])),
      // they knew the crossing from a fixed season before: keep what they knew
      rivals: Object.fromEntries(Object.entries(s.rivals as Record<string, Record<string, unknown>>).map(([id, r]) => [id, { ...r, learning: turn, volta: turn >= rivalSpec(id as CrownId).volta }])),
    };
  },
};

export function wrap(state: GameState): SaveEnvelope {
  return { saveVersion: SAVE_VERSION, genVersion: GEN_VERSION, state };
}

/** Wrap a bare M8 state (the legacy v9 key) as a version-10 envelope. */
export function fromLegacy(raw: unknown): SaveEnvelope | null {
  if (!isObject(raw) || typeof raw.seed !== 'number') return null;
  return { saveVersion: 10, genVersion: 1, state: raw as unknown as GameState };
}

/** Read a stored envelope: refuse what this build can't load, migrate what it can, then validate. */
export function readSave(raw: unknown): LoadResult {
  if (!isObject(raw) || typeof raw.saveVersion !== 'number' || !isObject(raw.state)) {
    return { ok: false, reason: 'The saved voyage is damaged and cannot be read.' };
  }
  let v = raw.saveVersion;
  if (v > SAVE_VERSION) return { ok: false, reason: 'This voyage was saved by a newer version of the game. Reload the page to update.' };
  if (raw.genVersion !== GEN_VERSION) {
    return { ok: false, reason: 'The maps have been redrawn since this voyage was saved, so it can no longer be continued.' };
  }
  let state = raw.state as Record<string, unknown>;
  const migrated = v < SAVE_VERSION;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: 'This voyage was saved by an older version of the game that can no longer be continued.' };
    state = step(state);
    v++;
  }
  const problem = validate(state);
  if (problem) return { ok: false, reason: `The saved voyage is damaged (${problem}).` };
  return { ok: true, state: state as unknown as GameState, migrated };
}

function validate(s: Record<string, unknown>): string | null {
  if (typeof s.seed !== 'number' || typeof s.turn !== 'number' || s.turn < 0) return 'turn';
  if (typeof s.treasury !== 'number' || !Number.isFinite(s.treasury)) return 'treasury';
  for (const k of ['fleets', 'people', 'colonies', 'parties', 'chronicle', 'events']) if (!Array.isArray(s[k])) return k;
  const fog = s.fog as Record<string, unknown> | undefined;
  if (!isObject(fog) || !Array.isArray(fog.old) || !Array.isArray(fog.new)) return 'fog';
  return null;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
