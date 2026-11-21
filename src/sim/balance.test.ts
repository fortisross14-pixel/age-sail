import { describe, it, expect } from 'vitest';
import { newGame, crossOcean, endTurn } from './game';
import { score } from './colony';
import { rivalScore } from './rivals';
import { races } from './victory';
import { tickMarket } from './market';
import { VICTORY, SCORE, PRESTIGE } from '../data/scenarios';
import { CROSSING } from '../data/ships';
import { NATIVE_TRADE } from '../data/trade';
import { DIFFICULTIES } from '../data/difficulty';
import { rivalsOf } from '../data/rivals';

describe('Phase 6: balance', () => {
  it('reckons your sales as the rivals reckon theirs: a fifth of a sale is profit', () => {
    const { world, state } = newGame(7);
    state.revenue = 100000;
    const rival = rivalsOf(state.crown)[0].id;
    state.rivals[rival].revenue = 100000 * VICTORY.salesAsProfit;
    expect(score(state, world).commerce).toBe(Math.floor(100000 * VICTORY.salesAsProfit / SCORE.sales));
    expect(score(state, world).commerce).toBe(rivalScore(state, rival).commerce);
    const trade = races(world, state).find((r) => r.kind === 'trade')!;
    expect(trade.me).toBeCloseTo(100000 * VICTORY.salesAsProfit / VICTORY.trade);
  });

  it('asks more prestige of a longer game and less of a shorter, half as steeply as the other races', () => {
    const share = (until: number) => { const { world, state } = newGame(7, until); state.prestige = 325; return races(world, state).find((r) => r.kind === 'prestige')!.me; };
    expect(share(1650)).toBeCloseTo(325 / VICTORY.prestige);
    expect(share(1550)).toBeGreaterThan(share(1650));
    expect(share(1750)).toBeLessThan(share(1650));
  });

  it('does not make a court famous for one summer of charting', () => {
    const { world, state } = newGame(7);
    for (let t = 0; t < 4; t++) { state.events = []; endTurn(world, state); }
    expect(PRESTIGE.landSeen).toBeLessThan(0.1);
    expect(state.prestige).toBeLessThan(VICTORY.prestige / 10);
  });

  it('keeps only a small pile at a people’s ground, however long nobody calls', () => {
    const { state } = newGame(7);
    const id = Object.keys(state.markets).find((k) => k.startsWith('site-') && Object.values(state.markets[k]).some((m) => m!.pile))!;
    const m = Object.values(state.markets[id]).find((x) => x!.pile)!;
    for (let t = 0; t < 200; t++) tickMarket(m);
    expect(m.pile).toBe(NATIVE_TRADE.pile);
    expect(m.stock).toBeLessThanOrEqual(m.ref * NATIVE_TRADE.pile + 1e-9);
  });

  it('lets a crew refuse a crossing with thin stores, and never with full ones', () => {
    const { world, state } = newGame(7);
    state.research.known.push('volta');
    state.newWorldFound = true;
    const f = state.fleets[0];
    const attempt = (turn: number, supplies: number) => {
      state.turn = turn;
      state.events = [];
      for (const x of f.ships) x.hull = 100;
      f.map = 'old'; f.hex = world.old.portals[0]; f.at = null; f.moves = 10; f.supplies = supplies;
      const r = crossOcean(world, state, f.id);
      return { ok: r.ok, map: f.map as string };
    };
    const thin = Array.from({ length: 40 }, (_, t) => attempt(40 + t, CROSSING.thinStores - 1));
    const full = Array.from({ length: 40 }, (_, t) => attempt(40 + t, CROSSING.thinStores));
    expect(thin.some((x) => !x.ok && x.map === 'old')).toBe(true);
    expect(thin.some((x) => x.ok && x.map === 'new')).toBe(true);
    expect(full.every((x) => x.ok)).toBe(true);
  });

  it('has a lever for the rivals that lasts the whole game, in step with the difficulty', () => {
    const [squire, captain, admiral] = DIFFICULTIES;
    expect(squire.rivalGrowth).toBeLessThan(captain.rivalGrowth);
    expect(captain.rivalGrowth).toBe(1);
    expect(admiral.rivalGrowth).toBeGreaterThan(captain.rivalGrowth);
  });
});
