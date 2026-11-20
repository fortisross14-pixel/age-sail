import { describe, it, expect } from 'vitest';
import { newGame, endTurn, seasonTick, buy, mainPort, promote, assignLeader, setStanding, queueResearch, studyPath, routeEstimate } from './game';
import { GRIDS } from './hex';
import { isWater } from '../data/terrain';
import { KEYS, keyDef, keysOf, rebind, resetKeys } from '../ui/keys';
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
      for (const k of KEYS.filter((x) => x.group !== 'Cards' && (x.where === 'anywhere' || x.where === where))) for (const key of keysOf(k)) {
        expect(seen.has(key), `${key} twice on the ${where}: ${seen.get(key)} and ${k.label}`).toBe(false);
        seen.set(key, k.label);
      }
    }
    expect(new Set(KEYS.map((k) => k.id)).size).toBe(KEYS.length);
    expect(keyDef('enter', 'map')?.action).toBe('endTurn');
    expect(keyDef('enter', 'screen')).toBeUndefined();
    expect(keyDef(' ', 'screen')).toBeUndefined();
    expect(keyDef('escape', 'screen')?.action).toBe('escape');
    expect(KEYS.filter((k) => k.screen).map((k) => k.screen)).toEqual(['cities', 'markets', 'fleets', 'court', 'diplomacy', 'research', 'chronicle']);
  });

  it('can be changed, unless another key in the same place already does that', () => {
    expect(rebind('wind', 'x')).toBeNull();
    expect(keyDef('x', 'map')?.action).toBe('wind');
    expect(keyDef('v', 'map')).toBeUndefined();
    expect(rebind('grid', 'x')).toMatch(/already/);
    expect(rebind('pan', 'x')).toMatch(/cannot/);
    expect(rebind('ledger', 'enter')).toMatch(/already/);
    resetKeys();
    expect(keyDef('v', 'map')?.action).toBe('wind');
  });
});

describe('Phase 5: orders that carry themselves out', () => {
  it('a fleet sent to explore charts new coast by itself and comes home to resupply', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    const p = [...state.people].sort((a, b) => b.skills.navigation - a.skills.navigation)[0];
    expect(setStanding(world, state, f.id, 'explore')).toMatchObject({ ok: false });
    promote(state, p.id, 'explorer', { unit: 'colonist' });
    p.ready = 0;
    expect(assignLeader(state, p.id, f.id).ok).toBe(true);
    const known = () => state.fog.old.filter((x) => x > 0).length;
    const before = known();
    expect(setStanding(world, state, f.id, 'explore').ok).toBe(true);
    let home = 0, away = 0;
    for (let i = 0; i < 40 && state.fleets.includes(f); i++) { seasonTick(world, state); state.events = []; if (f.at) home++; else away++; if (f.standing) expect(attention(state, world).some((x) => x.id === `adrift-${f.id}`)).toBe(false); }
    expect(known()).toBeGreaterThan(before + 40);
    expect(away).toBeGreaterThan(5);
    expect(home).toBeGreaterThan(0);
    expect(setStanding(world, state, f.id, null).ok).toBe(true);
    expect(f.standing).toBeNull();
  });

  it('a fleet sent home makes for the nearest of your ports and then waits', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    const g = GRIDS.old, start = f.hex;
    const sea = g.within(start, 6).find((h) => isWater(world.old.terrain[h]) && g.distance(h, start) >= 4 && state.fog.old[h] > 0)!;
    Object.assign(f, { at: null, hex: sea, supplies: 3 });
    expect(setStanding(world, state, f.id, 'home').ok).toBe(true);
    for (let i = 0; i < 10 && f.standing; i++) { seasonTick(world, state); state.events = []; }
    expect(f.standing).toBeNull();
    expect(f.at).toBeTruthy();
    expect(f.supplies).toBeGreaterThan(3);
  });
});

describe('Phase 5: research and trade helps', () => {
  it('queues a subject with everything it rests on, and studies them in order', () => {
    const { world, state } = newGame(1492);
    expect(studyPath(state, 'volta')).toEqual(['portolan', 'lateen', 'astrolabe', 'volta']);
    expect(queueResearch(state, 'volta').ok).toBe(true);
    const order: string[] = [];
    for (let i = 0; i < 80 && !state.research.known.includes('volta'); i++) { const c = state.research.current; if (c && order[order.length - 1] !== c) order.push(c); seasonTick(world, state); state.events = []; }
    expect(order).toEqual(['portolan', 'lateen', 'astrolabe', 'volta']);
    expect(queueResearch(state, 'galleon').ok).toBe(true);
    expect(state.research.queue).toContain('galleon');
    expect(queueResearch(state, 'galleon').ok).toBe(true);
    expect(state.research.queue).not.toContain('galleon');
  });

  it('estimates what a trade route earns in a round', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[1];
    const route = { stops: [{ port: mainPort(state), sell: [], buy: [{ good: 'tools' as const, qty: 20, maxPrice: null }] }, { port: 'lisbon', sell: ['tools' as const], buy: [] }], next: 0, active: false };
    const e = routeEstimate(world, state, f, route)!;
    expect(e.seasons).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(e.profit)).toBe(true);
    expect(routeEstimate(world, state, f, { ...route, stops: route.stops.slice(0, 1) })).toBeNull();
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
