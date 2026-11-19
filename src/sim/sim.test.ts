import { describe, it, expect } from 'vitest';
import { generateWorld, generateOldWorld } from './mapgen';
import {
  newGame, endTurn, buy, sell, moveFleet, previewMove, crossOcean, startProject, assignExplorer, portById, cargoUsed, maxMoves,
  provision, provisionCost, splitShip, mergeFleets, setResearch, has,
} from './game';
import { makeMarket, unitPrice, buyCost, sellValue } from './market';
import { planRoute } from './sailing';
import { OLD, NEW } from './hex';
import { FIXED_SOUTH } from '../data/europe';
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
  it('keeps Europe fixed and generates the African coast per game', () => {
    const a = generateOldWorld(1), b = generateOldWorld(2), a2 = generateOldWorld(1);
    let northDiff = 0, southDiff = 0;
    for (let i = 0; i < OLD.N; i++) {
      if (a.terrain[i] !== a2.terrain[i]) throw new Error('not deterministic');
      if (a.terrain[i] !== b.terrain[i]) OLD.lat(i) >= FIXED_SOUTH + 1 ? northDiff++ : southDiff++; // the seam itself may shift a little
    }
    expect(northDiff).toBe(0);
    expect(southDiff).toBeGreaterThan(50);
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: every port and coastal people can be reached from Sevilla, and so can the western edge`, () => {
      const m = generateOldWorld(seed);
      const ports = new Set(m.ports.map((p) => p.hex));
      const fog = new Array(OLD.N).fill(Fog.Explored);
      const o = { explorer: true, ports, fog, movesLeft: 12, movesMax: 12, windward: 0.5 };
      const seville = m.ports.find((p) => p.id === 'seville')!;
      expect(m.ports.filter((p) => p.kind === 'native').length).toBeGreaterThanOrEqual(6);
      for (const p of m.ports) {
        if (p.id !== 'seville') expect(planRoute(OLD, m, 0, seville.hex, p.hex, o), p.name).not.toBeNull();
      }
      expect(planRoute(OLD, m, 0, seville.hex, m.portals[40], o)).not.toBeNull();
    });
  }
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
    // a charted part of the western edge, off Iberia
    const edge = world.old.portals.reduce((b, h) => (Math.abs(OLD.lat(h) - 40) < Math.abs(OLD.lat(b) - 40) ? h : b));
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

  it('with long-distance navigation, an explorer sails west, finds land, meets a people, trades', () => {
    const { world, state } = newGame(1492);
    state.research.known.push('portolan', 'lateen', 'astrolabe', 'volta');
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

describe('M1 rules', () => {
  it('foraging and foreign ports refill stores only to half; home fills them', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    f.supplies = 1;
    f.at = 'lisbon';
    expect(provisionCost(world, f)).toBeGreaterThan(0);
    provision(world, state, f.id);
    expect(f.supplies).toBe(4);
    f.at = 'seville';
    provision(world, state, f.id);
    expect(f.supplies).toBe(8);
  });

  it('splits a ship into its own fleet and merges it back', () => {
    const { state } = newGame(1492);
    const f = state.fleets[0];
    expect(splitShip(state, f.id, f.ships[1].id).ok).toBe(true);
    expect(state.fleets.length).toBe(2);
    expect(f.ships.length).toBe(1);
    const nf = state.fleets[1];
    expect(f.crew + nf.crew).toBe(74);
    expect(mergeFleets(state, nf.id, f.id).ok).toBe(true);
    expect(state.fleets.length).toBe(1);
    expect(f.ships.length).toBe(2);
  });

  it('winds are steady: neighbouring hexes rarely differ by much', () => {
    const w = generateWorld(1492).new;
    let big = 0, n = 0;
    for (let i = 0; i < NEW.N; i += 7) for (const j of NEW.neighbors(i)) {
      let d = Math.abs(w.wind[0].angle[i] - w.wind[0].angle[j]);
      if (d > Math.PI) d = 2 * Math.PI - d;
      n++;
      if (d > 0.35) big++;
    }
    expect(big / n).toBeLessThan(0.05); // only where one band turns into the next
  });
});

describe('M2: near shore, deep ocean, research', () => {
  it('Europe is known at the start, the coast beyond Cape Bojador is not', () => {
    const { world, state } = newGame(1492);
    const seville = portById(world, 'seville')!;
    expect(state.fog.old[seville.hex]).toBe(Fog.Explored);
    const natives = world.old.ports.filter((p) => p.kind === 'native');
    expect(natives.every((p) => state.fog.old[p.hex] === Fog.Unknown)).toBe(true);
  });

  it('an explorer can sail south along the coast and meet a coastal people', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    buy(world, state, f.id, 'tools', 60);
    const site = world.old.ports.filter((p) => p.kind === 'native').sort((a, b) => OLD.lat(b.hex) - OLD.lat(a.hex))[0];
    const turns = sailTo(world, state, f.id, site.hex, 10);
    expect(turns).toBeLessThan(6);
    expect(f.at).toBe(site.id);
    expect(state.discovered).toContain(site.id);
    expect(sell(world, state, f.id, 'tools', 60).ok).toBe(true);
  });

  it('the deep ocean spoils stores twice as fast until long-distance navigation', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    const deep = [...Array(OLD.N).keys()].find((i) => world.old.deep[i] && OLD.lat(i) > 35 && OLD.lat(i) < 40)!;
    f.hex = deep; f.at = null; f.order = null; f.supplies = 8;
    endTurn(world, state);
    expect(f.supplies).toBe(6);
    state.research.known.push('volta');
    endTurn(world, state);
    expect(f.supplies).toBe(5);
  });

  it('research advances each season and needs its foundations', () => {
    const { world, state } = newGame(1492);
    expect(setResearch(state, 'volta').ok).toBe(false);
    expect(state.research.current).toBe('portolan');
    for (let k = 0; k < 8; k++) endTurn(world, state);
    expect(has(state, 'portolan')).toBe(true);
    expect(state.research.current).not.toBeNull();
  });
});
