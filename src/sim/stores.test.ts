import { describe, it, expect } from 'vitest';
import { newGame, mainPort, storeBuy, storeSell, stow, storesAt, openFactory, cargoUsed } from './game';
import { wrap, readSave } from '../save';

describe('stores ashore', () => {
  it('buys into the city stores, never into a ship, and a fleet loads them by order', () => {
    const { world, state } = newGame(1492);
    const home = mainPort(state);
    const f = state.fleets.find((x) => x.at === home)!;
    const before = cargoUsed(f);
    expect(storeBuy(world, state, home, 'tools', 10).ok).toBe(true);
    expect(cargoUsed(f)).toBe(before);
    expect(storesAt(state, home)!.tools).toBe(10);
    expect(stow(state, f.id, 'tools', 4).ok).toBe(true);
    expect(f.cargo.tools).toBe(4);
    expect(storesAt(state, home)!.tools).toBe(6);
    expect(stow(state, f.id, 'tools', -4).ok).toBe(true);
    expect(f.cargo.tools ?? 0).toBe(0);
    expect(storesAt(state, home)!.tools).toBe(10);
    const t = state.treasury;
    expect(storeSell(world, state, home, 'tools', 10).ok).toBe(true);
    expect(state.treasury).toBeGreaterThan(t);
    expect(storesAt(state, home)!.tools ?? 0).toBe(0);
  });

  it('keeps nothing in a foreign port without a factor; a factor there is the store', () => {
    const { world, state } = newGame(1492);
    const foreign = world.old.ports.find((p) => p.kind === 'foreign' && !p.inland && state.markets[p.id])!;
    expect(storesAt(state, foreign.id)).toBeNull();
    expect(storeBuy(world, state, foreign.id, 'tools', 5).ok).toBe(false);
    state.treasury = 50_000;
    expect(openFactory(world, state, foreign.id).ok).toBe(true);
    expect(storeBuy(world, state, foreign.id, 'tools', 5).ok).toBe(true);
    expect(state.factories[0].stock.tools).toBe(5);
  });

  it('hands the city stores to a factor opened in your own city', () => {
    const { world, state } = newGame(1492);
    const home = mainPort(state);
    state.treasury = 50_000;
    storeBuy(world, state, home, 'cloth', 8);
    expect(openFactory(world, state, home).ok).toBe(true);
    expect(state.stores[home]).toBeUndefined();
    expect(storesAt(state, home)!.cloth).toBe(8);
  });

  it('survives a save', () => {
    const { world, state } = newGame(1492);
    storeBuy(world, state, mainPort(state), 'tools', 3);
    const r = readSave(JSON.parse(JSON.stringify(wrap(state))));
    expect(r.ok && r.state.stores[mainPort(state)]?.tools).toBe(3);
  });
});
