import { describe, it, expect } from 'vitest';
import { newGame, endTurn, buy, mainPort, promote } from './game';
import { KEYS, keyDef, SCREEN_KEYS } from '../ui/keys';
import { attention } from '../ui/attention';
import { wrap, readSave } from '../save';

describe('Phase 5: the ledger', () => {
  it('accounts for every ducat of a turn, your own orders included', () => {
    const { world, state } = newGame(1492);
    for (let t = 0; t < 12; t++) {
      const before = state.treasury;
      if (t === 0) { const f = state.fleets.find((x) => x.at === mainPort(state))!; expect(buy(world, state, f.id, 'tools', 10).ok).toBe(true); promote(state, state.people[0].id, 'merchant'); }
      endTurn(world, state);
      while (state.events.length) state.events.shift();
      const last = state.ledger.last!;
      expect(Math.round(last.total), `turn ${t}`).toBe(Math.round(state.treasury - before));
      expect(Object.values(last.lines).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(last.total);
      if (t === 0) expect(last.lines.orders).toBeLessThan(0);
      expect(last.lines.taxes).toBeGreaterThan(0);
      expect(last.lines.upkeep).toBeLessThan(0);
      expect(state.ledger.mark).toBe(state.treasury);
    }
  });

  it('comes with an older voyage', () => {
    const { world, state } = newGame(1492);
    endTurn(world, state);
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    delete old.ledger; old.events = [];
    const r = readSave({ ...wrap(state), saveVersion: 20, state: old });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    endTurn(world, r.state);
    expect(r.state.ledger.last).not.toBeNull();
  });
});

describe('Phase 5: keys', () => {
  it('every key does one thing in each place, and Enter and Space do nothing behind a screen', () => {
    for (const where of ['map', 'screen'] as const) {
      const seen = new Map<string, string>();
      for (const k of KEYS.filter((x) => x.group !== 'Cards' && (x.where === 'anywhere' || x.where === where))) for (const key of k.keys) {
        expect(seen.has(key), `${key} twice on the ${where}: ${seen.get(key)} and ${k.label}`).toBe(false);
        seen.set(key, k.label);
      }
    }
    expect(keyDef('enter', 'map')?.action).toBe('endTurn');
    expect(keyDef('enter', 'screen')).toBeUndefined();
    expect(keyDef(' ', 'screen')).toBeUndefined();
    expect(keyDef('escape', 'screen')?.action).toBe('escape');
    expect(Object.values(SCREEN_KEYS)).toEqual(['cities', 'markets', 'fleets', 'court', 'diplomacy', 'research', 'chronicle']);
    for (const d of Object.keys(SCREEN_KEYS)) expect(keyDef(d, 'screen')?.action).toBe('screen');
  });
});

describe('Phase 5: what needs you', () => {
  it('points at the screens as they are now grouped', () => {
    const { world, state } = newGame(1492);
    state.rebels.push({ id: 1, free: 'x', name: 'The militia of X', map: 'old', hex: 5, target: 9, path: [5, 9], strength: 2, trail: [] });
    state.colonies.push({ id: 'col-q', name: 'Q', map: 'old', hex: 9, founded: 0, pop: 3, level: 'outpost', stock: {}, growth: 0, loyalty: 60, charter: false, unrest: false, newcomers: 0, walls: 0, last: { produced: {}, worked: [], hungry: false, discontent: false, luxuries: false, births: 0, deaths: 0, garrison: 0, seasoned: 0, besieged: false } });
    expect(attention(state, world).find((a) => a.id === 'rebels-1')?.urgent).toBe(true);
  });
});
