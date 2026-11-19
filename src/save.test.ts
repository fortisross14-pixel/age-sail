import { describe, it, expect } from 'vitest';
import { newGame, endTurn } from './sim/game';
import { generateWorld } from './sim/mapgen';
import { GEN_VERSION } from './sim/version';
import { wrap, readSave, fromLegacy, SAVE_VERSION } from './save';

describe('saves', () => {
  const { world, state } = newGame(1492);
  for (let i = 0; i < 6; i++) endTurn(world, state);

  it('round-trips through structured clone (what IndexedDB stores)', () => {
    const r = readSave(structuredClone(wrap(state)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migrated).toBe(false);
    expect(r.state).toEqual(state);
    // the world rebuilt from the seed is the one the save was played on
    const w = generateWorld(r.state.seed);
    expect(Array.from(w.new.terrain)).toEqual(Array.from(world.new.terrain));
    // and play continues identically from the loaded copy
    const a = structuredClone(state), b = r.state;
    endTurn(world, a); endTurn(w, b);
    expect(b).toEqual(a);
  });

  it('upgrades the bare M8 save', () => {
    const env = fromLegacy(structuredClone(state));
    expect(env).not.toBeNull();
    expect(readSave(env).ok).toBe(true);
    expect(fromLegacy({ nonsense: true })).toBeNull();
  });

  it('refuses newer saves, other map generators and damaged data', () => {
    expect(readSave({ ...wrap(state), saveVersion: SAVE_VERSION + 1 })).toMatchObject({ ok: false });
    expect(readSave({ ...wrap(state), genVersion: GEN_VERSION + 1 })).toMatchObject({ ok: false });
    expect(readSave({ ...wrap(state), state: { ...state, fleets: null } })).toMatchObject({ ok: false });
    expect(readSave('{"saveVers')).toMatchObject({ ok: false });
    expect(readSave(undefined)).toMatchObject({ ok: false });
  });
});
