import { describe, it, expect } from 'vitest';
import { generateWorld, generateOldWorld } from './mapgen';
import {
  newGame, endTurn, buy, sell, moveFleet, previewMove, crossOcean, startProject, assignExplorer, portById, cargoUsed, maxMoves,
} from './game';
import { makeMarket, unitPrice, buyCost, sellValue } from './market';
import { planRoute } from './sailing';
import { OLD, NEW } from './hex';
import { Fog } from './types';

const SEEDS = [1492, 7, 42, 2024, 31337];

describe('hex grids', () => {
  it('neighbours are at distance 1 and pixel lookup round-trips', () => {
    for (const g of [OLD, NEW]) {
      for (const i of [0, 115, 2000, g.N - 1]) {
        for (const j of g.neighbors(i)) expect(g.distance(i, j)).toBe(1);
        expect(g.atPixel(g.cx(i), g.cy(i))).toBe(i);
      }
    }
  });
});

describe('the Old World board', () => {
  it('is the same every game', () => {
    expect(Buffer.from(generateOldWorld().terrain).equals(Buffer.from(generateOldWorld().terrain))).toBe(true);
  });

  it('every European port can reach Sevilla and the western edge by sea', () => {
    const m = generateOldWorld();
    const ports = new Set(m.ports.map((p) => p.hex));
    const fog = new Array(OLD.N).fill(Fog.Explored);
    const o = { explorer: false, ports, fog, movesLeft: 12, movesMax: 12, windward: 0.5 };
    const seville = m.ports.find((p) => p.id === 'seville')!;
    for (const p of m.ports) {
      if (p.id !== 'seville') expect(planRoute(OLD, m, 0, seville.hex, p.hex, o), p.name).not.toBeNull();
      expect(planRoute(OLD, m, 0, p.hex, m.portals[30], o), `${p.name} to the west`).not.toBeNull();
    }
  });
});

describe('the New World board', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(Buffer.from(generateWorld(5).new.terrain).equals(Buffer.from(generateWorld(5).new.terrain))).toBe(true);
    expect(Buffer.from(generateWorld(1).new.terrain).equals(Buffer.from(generateWorld(2).new.terrain))).toBe(false);
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: native sites exist and are reachable from the eastern edge`, () => {
      const w = generateWorld(seed);
      const m = w.new;
      expect(m.ports.length).toBeGreaterThanOrEqual(6);
      expect(m.portals.length).toBeGreaterThan(40);
      const fog = new Array(NEW.N).fill(Fog.Explored);
      const o = { explorer: true, ports: new Set(m.ports.map((p) => p.hex)), fog, movesLeft: 14, movesMax: 14, windward: 0.5 };
      for (const p of m.ports) {
        const entry = m.portals[Math.floor(m.portals.length / 2)];
        expect(planRoute(NEW, m, 0, entry, p.hex, o), p.name).not.toBeNull();
      }
    });
  }
});

describe('markets', () => {
  it('prices fall as stock rises and buying costs more than selling', () => {
    const m = makeMarket(50, 30, 10, 0);
    expect(unitPrice(m, 5)).toBeGreaterThan(unitPrice(m, 30));
    expect(unitPrice(m, 30)).toBeGreaterThan(unitPrice(m, 100));
    expect(buyCost(m, 10)).toBeGreaterThan(sellValue(m, 10));
    expect(sellValue(m, 100) / 100).toBeLessThan(sellValue(m, 10) / 10);
  });
});

/** Sail the fleet toward a hex, ending seasons until it gets there (or gives up). */
function sailTo(w: ReturnType<typeof newGame>['world'], s: ReturnType<typeof newGame>['state'], id: number, hex: number, maxTurns = 12) {
  expect(moveFleet(w, s, id, hex).ok).toBe(true);
  for (let k = 0; k < maxTurns; k++) {
    const f = s.fleets.find((x) => x.id === id);
    if (!f || !f.order) return k;
    endTurn(w, s);
  }
  return maxTurns;
}

describe('a voyage, turn by turn', () => {
  it('moves hex by hex with movement points, and only an explorer may cross into the unknown', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    expect(f.explorer).not.toBeNull();
    const start = f.hex;
    const edge = world.old.portals[Math.floor(world.old.portals.length * 0.6)];
    const p = previewMove(world, state, f.id, edge)!;
    expect(p.cross).toBe(true);
    expect(p.turns).toBeGreaterThanOrEqual(2);
    expect(moveFleet(world, state, f.id, edge).ok).toBe(true);
    expect(f.hex).not.toBe(start); // moved right away
    expect(f.moves).toBeLessThan(maxMoves(f));
    // a fleet with no explorer may not cross while the New World is unknown
    const lone = { ...f, id: 999, explorer: null, order: null };
    state.fleets.push(lone);
    expect(previewMove(world, state, 999, edge)!.crossBlocked).toBe(true);
    state.fleets.pop();
  });

  it('explorer sails west, finds land, meets a people, trades, and the toggle unlocks', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    expect(buy(world, state, f.id, 'tools', 100).ok).toBe(true);
    const edge = world.old.portals.reduce((b, h) => (Math.abs(OLD.lat(h) - 30) < Math.abs(OLD.lat(b) - 30) ? h : b));
    const t1 = sailTo(world, state, f.id, edge);
    // the crossing happens at the edge
    for (let k = 0; k < 3 && f.map === 'old'; k++) { if (f.moves > 0) crossOcean(world, state, f.id); else endTurn(world, state); }
    expect(f.map).toBe('new');
    // head for the nearest native site through unknown water
    const site = [...world.new.ports].sort((a, b) => NEW.distance(f.hex, a.hex) - NEW.distance(f.hex, b.hex))[0];
    const t2 = sailTo(world, state, f.id, site.hex, 14);
    expect(state.fleets.includes(f)).toBe(true);
    expect(state.newWorldFound).toBe(true);
    expect(state.events.some((e) => e.kind === 'landfall')).toBe(true);
    expect(f.at).toBe(site.id);
    expect(state.discovered).toContain(site.id);
    const before = state.treasury;
    expect(sell(world, state, f.id, 'tools', 100).ok).toBe(true);
    expect(state.treasury).toBeGreaterThan(before);
    expect(cargoUsed(f)).toBe(0);
    // the whole outbound voyage should take a handful of seasons, not dozens
    expect(t1 + t2).toBeLessThan(12);
  });

  it('builds ships and recruits explorers in home ports over several seasons', () => {
    const { world, state } = newGame(1492);
    expect(startProject(state, 'seville', { kind: 'ship', ship: 'caravel' }).ok).toBe(true);
    expect(startProject(state, 'seville', { kind: 'explorer' }).ok).toBe(false); // busy
    expect(startProject(state, 'cadiz', { kind: 'ship', ship: 'carrack' }).ok).toBe(false); // port too small
    expect(startProject(state, 'cadiz', { kind: 'explorer' }).ok).toBe(true);
    endTurn(world, state);
    expect(state.fleets.length).toBe(1);
    expect(state.explorers.length).toBe(2);
    endTurn(world, state);
    expect(state.fleets.length).toBe(2);
    const ship = state.fleets[1];
    expect(ship.at).toBe('seville');
    const e = state.explorers[1];
    expect(e.waitingAt).toBe('cadiz');
    expect(assignExplorer(state, e.id, ship.id).ok).toBe(false); // different port
    expect(portById(world, 'cadiz')).toBeDefined();
  });

  it('a fleet with no food loses its crew to scurvy', () => {
    const { world, state } = newGame(7);
    const f = state.fleets[0];
    const sea = world.old.portals[20];
    sailTo(world, state, f.id, sea, 4);
    f.supplies = 0;
    f.order = null;
    const crew = f.crew;
    endTurn(world, state);
    expect(f.crew).toBeLessThan(crew);
  });
});
