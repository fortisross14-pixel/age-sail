import { describe, it, expect } from 'vitest';
import { newGame, endTurn, seasonTick, declareWar } from './game';
import { rivalDoing, friendOf } from './rivals';
import { allNations, territory } from './natives';
import { RIVAL_ECON, rivalsOf } from '../data/rivals';
import { isWater } from '../data/terrain';
import { GRIDS } from './hex';
import { emptyAccount, type Colony, type GameState, type RivalColony, type World } from './types';
import { wrap, readSave } from '../save';

const seasons = (w: World, s: GameState, n: number) => { for (let i = 0; i < n; i++) { seasonTick(w, s); s.events = []; } };
/** A rival colony placed by hand on the first coastal hex that suits. */
function plant(w: World, s: GameState, crown: RivalColony['crown'], where: (h: number) => boolean, over: Partial<RivalColony> = {}): RivalColony {
  const g = GRIDS.old;
  const hex = [...Array(g.N).keys()].find((h) => !isWater(w.old.terrain[h]) && g.lat(h) < 25 && g.neighbors(h).some((j) => isWater(w.old.terrain[j])) && !w.old.ports.some((p) => g.distance(p.hex, h) <= 2) && where(h))!;
  const c: RivalColony = { id: `rcol-t${s.nextId++}`, crown, name: 'Testville', map: 'old', hex, pop: 4, level: 'outpost', founded: s.turn, garrison: 1, seen: true, supply: RIVAL_ECON.supplyFull, stock: 0, growth: 0, ...over };
  s.rivalColonies.push(c);
  return c;
}

describe('Phase 2: rivals with a purse and ships', () => {
  it('a crown with no money founds nothing, and says what it is saving for', () => {
    const { world, state } = newGame(1492);
    for (let i = 0; i < 40; i++) { for (const r of rivalsOf(state.crown)) state.rivals[r.id].treasury = -1e6; seasonTick(world, state); state.events = []; }
    expect(state.rivalColonies.length).toBe(0);
    expect(state.rivalShips.length).toBe(0);
    expect(state.rivals.portugal.plan.kind).toBe('saving');
    expect(rivalDoing(state, 'portugal')).toMatch(/Saving for/);
  });

  it('every ship is in port or at sea: none appear from nowhere or vanish unaccounted', () => {
    for (const seed of [3, 1492]) {
      const { world, state } = newGame(seed);
      declareWar(state, 'england');
      for (let i = 0; i < 160; i++) {
        seasonTick(world, state); state.events = [];
        for (const r of rivalsOf(state.crown)) {
          const st = state.rivals[r.id];
          const out = state.rivalShips.filter((x) => x.crown === r.id).length;
          expect(st.hulls + out, `${r.id} season ${i}`).toBe(st.built);
          expect(st.built).toBeLessThanOrEqual(RIVAL_ECON.maxShips);
          expect(st.hulls).toBeGreaterThanOrEqual(0);
        }
      }
      // they did sail, settle and come home
      expect(state.rivalColonies.length).toBeGreaterThan(2);
    }
  });

  it('a colony no ship reaches shrinks, and is abandoned in the end', () => {
    const { world, state } = newGame(1492);
    const c = plant(world, state, 'portugal', () => true, { supply: 0, pop: 3 });
    for (let i = 0; i < 120 && state.rivalColonies.includes(c); i++) { state.rivals.portugal.treasury = -1e6; seasons(world, state, 1); }
    expect(state.rivalColonies.includes(c)).toBe(false);
    expect(state.chronicle.some((e) => /lies abandoned/.test(e.text))).toBe(true);
  });

  it('a convoy resupplies a colony, lands a settler and carries its produce home to be sold', () => {
    const { world, state } = newGame(1492);
    const c = plant(world, state, 'portugal', () => true, { supply: 1, stock: 60 });
    const r = state.rivals.portugal;
    r.treasury = 5000; r.next = 0;
    const before = r.revenue;
    let resupplied = false, carried = false;
    for (let i = 0; i < 24; i++) {
      seasons(world, state, 1);
      if (c.supply > RIVAL_ECON.supplyLow) resupplied = true;
      if (state.rivalShips.some((x) => x.crown === 'portugal' && x.cargo)) carried = true;
    }
    expect(resupplied).toBe(true);
    expect(carried).toBe(true);
    expect(c.pop).toBeGreaterThan(4);
    // the cargo's profit is more than posts alone could have earned
    expect(r.revenue - before).toBeGreaterThan(r.posts.length * RIVAL_ECON.perPost * 24);
  });
});

describe('Phase 2: the world acts without you', () => {
  it('crowns go to war with each other and make peace again', () => {
    const { world, state } = newGame(1492);
    state.rivals.england.toward.france = state.rivals.france.toward.england = -95;
    let warred = false;
    for (let i = 0; i < 200; i++) {
      seasons(world, state, 1);
      const e = state.rivals.england.wars.includes('france'), f = state.rivals.france.wars.includes('england');
      expect(e).toBe(f);
      if (e) warred = true;
      if (!e && !warred) state.rivals.england.toward.france = state.rivals.france.toward.england = -95;
    }
    expect(warred).toBe(true);
    expect(state.chronicle.some((c) => /England and France are at war|France and England are at war/.test(c.text))).toBe(true);
    expect(state.chronicle.some((c) => /make peace/.test(c.text))).toBe(true);
  });

  it('a people angry with a crown falls on its colony', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    const hex = territory(n).find((h) => h !== n.siteHex && !isWater(world.old.terrain[h]))!;
    const c = plant(world, state, 'portugal', () => true, { hex, pop: 2, garrison: 0 });
    const st = state.natives[n.id];
    st.warriors = 40;
    let hit = false;
    for (let i = 0; i < 80 && !hit; i++) {
      st.crowns.portugal = -90; st.feud = null;
      c.supply = RIVAL_ECON.supplyFull;
      seasons(world, state, 1);
      hit = !state.rivalColonies.includes(c) || c.pop < 2;
    }
    expect(hit).toBe(true);
  });

  it('a trading post makes a people the friend of the crown that built it', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    state.rivals.portugal.posts.push(n.site);
    seasons(world, state, 60);
    expect(friendOf(state.natives[n.id])).toBe('portugal');
  });

  it('peoples go to war with their rivals, both or neither', () => {
    const { world, state } = newGame(7);
    let any = false;
    for (let i = 0; i < 240; i++) {
      seasons(world, state, 1);
      for (const n of allNations(world)) {
        const st = state.natives[n.id];
        if (!st.feud) continue;
        any = true;
        expect(state.natives[st.feud.with].feud?.with).toBe(n.id);
      }
    }
    expect(any).toBe(true);
  });

  it('at war, a crown sends soldiers by sea to land at your colony', () => {
    const { world, state } = newGame(1492);
    const theirs = plant(world, state, 'portugal', () => true);
    const g = GRIDS.old;
    const hex = g.within(theirs.hex, 6).find((h) => h !== theirs.hex && !isWater(world.old.terrain[h]) && g.distance(h, theirs.hex) >= 3 && g.neighbors(h).some((j) => isWater(world.old.terrain[j])))!;
    const mine: Colony = { id: 'col-t', name: 'Mine', map: 'old', hex, founded: 0, pop: 5, level: 'outpost', stock: { food: 50 }, growth: 0, loyalty: 80, charter: false, unrest: false, newcomers: 0, walls: 0, last: emptyAccount() };
    state.colonies.push(mine);
    declareWar(state, 'portugal');
    let sailed = false;
    for (let i = 0; i < 60 && !sailed; i++) {
      state.rivals.portugal.treasury = 5000; state.rivals.portugal.next = 0; theirs.supply = RIVAL_ECON.supplyFull;
      seasons(world, state, 1);
      sailed = state.rivalShips.some((x) => x.kind === 'raid') || state.chronicle.some((c) => /land at Mine/.test(c.text));
    }
    expect(sailed).toBe(true);
  });

  it('is slower to anger for a squire than for an admiral', () => {
    const wars = (d: 'squire' | 'admiral') => {
      let n = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const { world, state } = newGame(seed, 1650, 'spain', d);
        for (let i = 0; i < 40; i++) { for (const r of rivalsOf(state.crown)) state.rivals[r.id].attitude = -80; seasonTick(world, state); state.events = []; }
        n += rivalsOf(state.crown).filter((r) => state.rivals[r.id].relation === 'war').length;
      }
      return n;
    };
    expect(wars('admiral')).toBeGreaterThanOrEqual(wars('squire'));
  });
});

describe('Phase 2: saves', () => {
  it('brings a version 15 voyage forward and plays on', () => {
    const { world, state } = newGame(1492);
    for (let i = 0; i < 20; i++) endTurn(world, state);
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    for (const r of Object.values(old.rivals as Record<string, Record<string, unknown>>)) for (const k of ['treasury', 'hulls', 'built', 'plan', 'toward', 'wars', 'rivalWarSince']) delete r[k];
    for (const c of old.rivalColonies as Record<string, unknown>[]) for (const k of ['supply', 'stock', 'growth']) delete c[k];
    for (const x of old.rivalShips as Record<string, unknown>[]) for (const k of ['name', 'homeward', 'cargo']) delete x[k];
    for (const st of Object.values(old.natives as Record<string, Record<string, unknown>>)) { delete st.crowns; delete st.feud; }
    const r = readSave({ ...wrap(state), saveVersion: 15, state: old });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const c of rivalsOf(r.state.crown)) {
      const st = r.state.rivals[c.id];
      expect(st.hulls + r.state.rivalShips.filter((x) => x.crown === c.id).length).toBe(st.built);
    }
    for (let i = 0; i < 20; i++) endTurn(world, r.state);
    expect(r.state.turn).toBeGreaterThan(state.turn);
  });
});
