import { describe, it, expect } from 'vitest';
import { newGame, endTurn, promote, buy, mainPort, checkObjectives, setResearch } from './game';
import { activeAmbitions, objectiveDone, voyageDone, rewardOf } from './objectives';
import { OBJECTIVES, VOYAGE, AMBITIONS, AMBITIONS_AT_ONCE, objectiveById } from '../data/objectives';
import { DIFFICULTIES } from '../data/difficulty';
import { CROWNS, type CrownId } from '../data/rivals';
import { attention } from '../ui/attention';
import { wrap, readSave, SAVE_VERSION } from '../save';

describe('Phase 1: objectives', () => {
  it('starts with the whole first voyage open and no ambitions yet', () => {
    const { world, state } = newGame(1492);
    expect(checkObjectives(world, state)).toEqual([]);
    expect(VOYAGE.every((o) => !objectiveDone(state, o.id))).toBe(true);
    expect(activeAmbitions(state)).toEqual([]);
    expect(voyageDone(state)).toBe(false);
  });

  it('ticks a step when its condition is met, pays once and writes it down', () => {
    const { world, state } = newGame(1492);
    const best = [...state.people].sort((a, b) => b.skills.navigation - a.skills.navigation)[0];
    expect(promote(state, best.id, 'explorer', { unit: 'colonist' }).ok).toBe(true);
    const before = state.treasury;
    const got = checkObjectives(world, state).map((o) => o.id);
    expect(got).toContain('explorer');
    expect(state.treasury).toBe(before + rewardOf(state, objectiveById('explorer')).ducats);
    expect(state.chronicle.at(-1)!.text).toMatch(/First voyage: commission an explorer/);
    // an ambition that waited on it comes forward
    expect(activeAmbitions(state).map((o) => o.id)).toContain('university');
    const again = state.treasury;
    expect(checkObjectives(world, state)).toEqual([]);
    expect(state.treasury).toBe(again);
  });

  it('counts cargo bought in port', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets.find((x) => x.at === mainPort(state))!;
    expect(buy(world, state, f.id, 'tools', 5).ok).toBe(true);
    expect(checkObjectives(world, state).map((o) => o.id)).toEqual(['cargo']);
  });

  it('never presses more than a few ambitions at once, and every prerequisite exists', () => {
    const { state } = newGame(1492);
    for (const o of OBJECTIVES) state.objectives.done[o.id] = 0;
    for (const o of AMBITIONS) delete state.objectives.done[o.id];
    expect(activeAmbitions(state).length).toBe(AMBITIONS_AT_ONCE);
    const ids = new Set(OBJECTIVES.map((o) => o.id));
    expect(ids.size).toBe(OBJECTIVES.length);
    for (const o of OBJECTIVES) for (const a of o.after ?? []) expect(ids.has(a), `${o.id} after ${a}`).toBe(true);
  });

  it('is checked every season, and plays the same game twice', () => {
    const run = () => { const g = newGame(7); for (let i = 0; i < 30; i++) endTurn(g.world, g.state); return g.state; };
    const a = run(), b = run();
    expect(a.objectives).toEqual(b.objectives);
    expect(a.treasury).toBe(b.treasury);
  });
});

describe('Phase 1: difficulty', () => {
  it('sets the starting treasury, and Captain is the game as it was', () => {
    for (const d of DIFFICULTIES) expect(newGame(1492, 1650, 'spain', d.id).state.treasury).toBe(d.treasury);
    expect(newGame(1492).state.difficulty).toBe('captain');
    expect(newGame(1492).state.treasury).toBe(5000);
  });

  it('slows the rivals for a squire and hurries them for an admiral', () => {
    const colonies = (id: 'squire' | 'admiral') => {
      let n = 0;
      for (const seed of [3, 7, 1492]) { const g = newGame(seed, 1650, 'spain', id); for (let i = 0; i < 60; i++) endTurn(g.world, g.state); n += g.state.rivalColonies.length; }
      return n;
    };
    expect(colonies('admiral')).toBeGreaterThan(colonies('squire'));
  });
});

describe('Phase 1: what needs you before the turn ends', () => {
  it('asks for an explorer on the first turn, and stops asking once one is commissioned', () => {
    const { world, state } = newGame(1492);
    const urgent = () => attention(state, world).filter((a) => a.urgent).map((a) => a.id);
    expect(urgent()).toContain('no-explorer');
    const best = [...state.people].sort((a, b) => b.skills.navigation - a.skills.navigation)[0];
    promote(state, best.id, 'explorer', { unit: 'colonist' });
    checkObjectives(world, state);
    expect(urgent()).not.toContain('no-explorer');
    // once ready, the explorer waits for a fleet
    endTurn(world, state);
    expect(urgent()).toContain(`leader-${best.id}`);
  });

  it('notices idle ships in port and scholars with nothing to study', () => {
    const { world, state } = newGame(1492);
    expect(attention(state, world).map((a) => a.id)).toContain('docked');
    state.research.current = null;
    expect(attention(state, world).filter((a) => a.urgent).map((a) => a.id)).toContain('research');
    setResearch(state, 'portolan');
    expect(attention(state, world).map((a) => a.id)).not.toContain('research');
  });
});

describe('Phase 1: stories and saves', () => {
  it('never asks a crown to ransom its own sailors', () => {
    for (const c of CROWNS) {
      const { world, state } = newGame(11, 1650, c.id as CrownId);
      for (let i = 0; i < 80; i++) {
        endTurn(world, state);
        for (const e of state.events) if (e.story === 'survivors') expect(e.ctx!.crown).not.toBe(c.id);
        state.events = [];
      }
    }
  });

  it('brings a version 14 voyage forward: Captain, with what is already done ticked and unpaid', () => {
    const { world, state } = newGame(1492);
    const best = [...state.people].sort((a, b) => b.skills.navigation - a.skills.navigation)[0];
    promote(state, best.id, 'explorer', { unit: 'colonist' });
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    delete old.difficulty; delete old.objectives;
    const r = readSave({ ...wrap(state), saveVersion: SAVE_VERSION - 1, state: old });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migrated).toBe(true);
    expect(r.state.difficulty).toBe('captain');
    const before = r.state.treasury;
    expect(checkObjectives(world, r.state)).toEqual([]);
    expect(objectiveDone(r.state, 'explorer')).toBe(true);
    expect(r.state.treasury).toBe(before);
    expect(r.state.objectives.catchUp).toBeUndefined();
  });
});
