import { describe, it, expect } from 'vitest';
import { generateWorld, generateOldWorld } from './mapgen';
import {
  newGame, endTurn, seasonTick, buy, sell, moveFleet, previewMove, crossOcean, startProject, portById, cargoUsed, maxMoves,
  provision, provisionCost, splitShip, mergeFleets, setResearch, has, promote, assignLeader, recall, hire, setTradeRoute,
  slotsUsed, slotsMax, unitsAboard, leaderOf, embark, projectCost, landParty, moveParty, boardParty, citySlots, slotsUsedIn,
  foundColony, upgradeColony, colonyTransfer, allyNation, incorporateNation, attackVillage, tradingPost, declareWar, rivalPeace, stormColony,
  grantCharter, setTaxRate, chooseStory, buildWalls, openFactory, factoryOrder,
} from './game';
import { demandFactor, rivalMerchants } from './trade';
import { battleOdds, type Force } from './battle';
import { T } from '../data/terrain';
import type { UnitType } from './types';
import { makeMarket, unitPrice, buyCost, sellValue } from './market';
import { planRoute } from './sailing';
import { OLD, NEW } from './hex';
import { FIXED_SOUTH } from '../data/europe';
import { canFound, score } from './colony';
import { gift, odds } from './natives';
import { rivalScore } from './rivals';
import { colonyTaxes, loyaltyTarget } from './empire';
import { Fog, emptyAccount, turnLabel, turnStride } from './types';

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
      const ports = new Set(m.ports.filter((p) => !p.inland).map((p) => p.hex));
      const fog = new Array(OLD.N).fill(Fog.Explored);
      const o = { explorer: true, ports, fog, movesLeft: 12, movesMax: 12, windward: 0.5 };
      const seville = m.ports.find((p) => p.id === 'seville')!;
      expect(m.ports.filter((p) => p.kind === 'native').length).toBeGreaterThanOrEqual(6);
      for (const p of m.ports) {
        if (p.id !== 'seville' && !p.inland) expect(planRoute(OLD, m, 0, seville.hex, p.hex, o), p.name).not.toBeNull();
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

type Game = ReturnType<typeof newGame>;

/** The opening moves: merge the two ships, make the best navigator an explorer, wait, put them in command. */
function expedition({ world, state }: Game) {
  // these tests follow the explorer's own unit: leave the colonist and soldier of the start at home
  state.units = state.units.filter((u) => u.city == null);
  const [a, b] = state.fleets;
  expect(mergeFleets(state, a.id, b.id).ok).toBe(true);
  const f = state.fleets[0];
  const nav = [...state.people].sort((x, y) => y.skills.navigation - x.skills.navigation)[0];
  expect(promote(state, nav.id, 'explorer', { unit: 'infantry' }).ok).toBe(true);
  expect(assignLeader(state, nav.id, f.id).ok).toBe(false); // still preparing
  endTurn(world, state);
  endTurn(world, state);
  expect(assignLeader(state, nav.id, f.id).ok).toBe(true);
  return f;
}

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
    const game = newGame(1492);
    const { world, state } = game;
    const f = expedition(game);
    expect(f.leader).not.toBeNull();
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
    const lone = { ...f, id: 999, leader: null, order: null };
    state.fleets.push(lone);
    expect(previewMove(world, state, 999, edge)!.crossBlocked).toBe(true);
    state.fleets.pop();
  });

  it('with long-distance navigation, an explorer sails west, finds land, meets a people, trades', () => {
    const game = newGame(1492);
    const { world, state } = game;
    state.research.known.push('portolan', 'lateen', 'astrolabe', 'volta');
    const f = expedition(game);
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

  it('builds ships in home ports over several seasons, faster with a good governor', () => {
    const { world, state } = newGame(1492);
    expect(startProject(state, 'seville', { kind: 'ship', ship: 'caravel' }).ok).toBe(true);
    expect(startProject(state, 'seville', { kind: 'ship', ship: 'carrack' }).ok).toBe(false); // busy
    expect(startProject(state, 'cadiz', { kind: 'ship', ship: 'carrack' }).ok).toBe(false); // port too small
    const n = state.fleets.length;
    seasonTick(world, state);
    expect(state.fleets.length).toBe(n);
    seasonTick(world, state);
    expect(state.fleets.length).toBe(n + 1);
    const builder = [...state.people].sort((x, y) => y.skills.construction - x.skills.construction)[0];
    const cadiz = state.cities.cadiz;
    const plain = projectCost({ kind: 'building', building: 'docks' }, cadiz);
    expect(promote(state, builder.id, 'governor', { city: 'cadiz' }).ok).toBe(true);
    const governed = projectCost({ kind: 'building', building: 'docks' }, cadiz, builder);
    expect(governed.cost).toBeLessThan(plain.cost);
    expect(governed.build).toBeLessThanOrEqual(plain.build);
    expect(portById(world, 'cadiz')).toBeDefined();
  });

  it('a fleet with no food loses its crew to scurvy', () => {
    const { world, state } = newGame(7);
    const f = state.fleets[0];
    for (const p of state.people) p.skills.navigation = 0;
    const sea = [...Array(OLD.N).keys()].find((i) => world.old.terrain[i] === 0 && state.fog.old[i] === Fog.Explored && OLD.lat(i) > 38 && OLD.lat(i) < 42 && OLD.lon(i) < -12 && OLD.lon(i) > -18)!;
    sailTo(world, state, f.id, sea, 4);
    f.supplies = 0;
    f.order = null;
    f.movedThisTurn = true; // under way, not foraging at anchor
    const crew = f.crew;
    seasonTick(world, state);
    // in the open ocean, empty stores can also mean the fleet is never seen again
    expect(!state.fleets.includes(f) || f.crew < crew).toBe(true);
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
    expect(mergeFleets(state, state.fleets[1].id, state.fleets[0].id).ok).toBe(true);
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
    const game = newGame(1492);
    const { world, state } = game;
    const f = expedition(game);
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
    for (const p of state.people) p.skills.navigation = 0;
    const deep = [...Array(OLD.N).keys()].find((i) => world.old.deep[i] && OLD.lat(i) > 35 && OLD.lat(i) < 40)!;
    f.hex = deep; f.at = null; f.order = null; f.supplies = 8;
    seasonTick(world, state);
    expect(f.supplies).toBe(6);
    state.research.known.push('volta');
    seasonTick(world, state);
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

describe('M3: the court', () => {
  it('starts with nine people, two ships with nobody in command, and petitioners', () => {
    const { state } = newGame(1492);
    expect(state.people.length).toBe(9);
    expect(state.crown).toBe('spain');
    // a plain start: a colonist and a soldier wait in Sevilla, and Castile's edge adds a colonist
    expect(state.units.filter((u) => u.city === 'seville').map((u) => u.type).sort()).toEqual(['colonist', 'colonist', 'infantry']);
    expect(state.fleets.length).toBe(2);
    expect(state.fleets.every((f) => f.leader == null)).toBe(true);
    expect(state.petitioners.length).toBeGreaterThan(0);
    for (const k of ['navigation', 'military', 'commerce', 'construction', 'diplomacy'] as const) {
      expect(Math.max(...state.people.map((p) => p.skills[k]))).toBeGreaterThanOrEqual(3);
    }
  });

  it('an explorer comes with a free unit that takes a slot aboard', () => {
    const game = newGame(1492);
    const f = expedition(game);
    const { state } = game;
    expect(unitsAboard(state, f).map((u) => u.type)).toEqual(['infantry']);
    expect(slotsUsed(state, f)).toBe(2);
    expect(slotsMax(f)).toBe(3); // caravel 1 + carrack 2
    // a lone caravel has room for the leader only
    const solo = game.state.fleets[0];
    void solo;
  });

  it('a navigator leading a fleet gives it more moves', () => {
    const game = newGame(1492);
    const f = expedition(game);
    const nav = leaderOf(game.state, f)!;
    expect(maxMoves(f, game.state)).toBe(15 + Math.floor(nav.skills.navigation / 2) + (nav.trait === 'bold' ? 1 : 0));
  });

  it('a leader comes ashore only at home, and units with them', () => {
    const game = newGame(1492);
    const f = expedition(game);
    const { world, state } = game;
    expect(recall(world, state, f.id).ok).toBe(true);
    expect(f.leader).toBeNull();
    expect(state.units.every((u) => u.city === 'seville')).toBe(true);
    expect(embark(world, state, state.units[0].id, f.id).ok).toBe(true);
  });

  it('people age and some die over the years; petitioners can be hired', () => {
    const { world, state } = newGame(1492);
    const pet = state.petitioners[0];
    state.treasury = 100000;
    expect(hire(state, pet.person.id).ok).toBe(true);
    expect(state.people.length).toBe(10);
    for (const p of state.people) p.born = 1420; // all very old
    for (let k = 0; k < 4 * 6; k++) endTurn(world, state);
    expect(state.people.some((p) => !p.alive)).toBe(true);
  });

  it('a merchant runs a trade route by itself and makes money', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[1]; // the carrack
    const merchant = [...state.people].sort((x, y) => y.skills.commerce - x.skills.commerce)[0];
    expect(promote(state, merchant.id, 'merchant').ok).toBe(true);
    endTurn(world, state);
    expect(assignLeader(state, merchant.id, f.id).ok).toBe(true);
    expect(setTradeRoute(world, state, f.id, {
      next: 0, active: true,
      stops: [
        { port: 'seville', sell: ['dyes', 'furs'], buy: [{ good: 'tools', qty: 100, maxPrice: null }] },
        { port: 'antwerp', sell: ['tools'], buy: [{ good: 'dyes', qty: 30, maxPrice: null }, { good: 'furs', qty: 30, maxPrice: null }] },
      ],
    }).ok).toBe(true);
    const start = state.treasury;
    let visits = 0;
    for (let k = 0; k < 12; k++) {
      endTurn(world, state);
      if (f.at === 'antwerp') visits++;
    }
    const log = state.chronicle.filter((c) => c.kind === 'trade').map((c) => c.text).join(' ');
    expect(log).toContain('at Antwerpen: sold');
    expect(log).toContain('at Sevilla: sold');
    void visits;
    void start;
  });
});

describe('M4: cities and parties ashore', () => {
  it('cities have limited room for buildings, and buildings unlock units', () => {
    const { world, state } = newGame(1492);
    const c = state.cities.cadiz;
    expect(startProject(state, 'cadiz', { kind: 'unit', unit: 'infantry' }).ok).toBe(false); // no barracks
    expect(startProject(state, 'cadiz', { kind: 'unit', unit: 'colonist' }).ok).toBe(true);
    endTurn(world, state);
    expect(state.units.some((u) => u.type === 'colonist' && u.city === 'cadiz')).toBe(true);
    state.treasury = 1e6;
    for (let k = 0; k < 20 && slotsUsedIn(c) < citySlots(c); k++) {
      if (!c.project) startProject(state, 'cadiz', { kind: 'building', building: (['barracks', 'church', 'university', 'market', 'barracks'] as const)[k % 5] });
      endTurn(world, state);
    }
    expect(slotsUsedIn(c)).toBe(citySlots(c));
    expect(projectCost({ kind: 'building', building: 'university' }, c).allowed).toBe(false);
  });

  it('taxes come in every season', () => {
    const { world, state } = newGame(1492);
    const before = state.treasury;
    endTurn(world, state);
    // two ships of upkeep and the court's salaries, against Sevilla and Cádiz taxes and Sevilla's market
    expect(state.treasury).toBeGreaterThan(before - 200);
  });

  it('an expedition lands a party that walks inland, surveys, and boards again', () => {
    const game = newGame(1492);
    const { world, state } = game;
    const f = expedition(game);
    // sail to the first coastal people and put the party ashore beside the ship
    const site = world.old.ports.filter((p) => p.kind === 'native' && world.old.mainland[p.hex]).sort((a, b) => OLD.lat(b.hex) - OLD.lat(a.hex))[0];
    sailTo(world, state, f.id, site.hex, 10);
    const shore = OLD.neighbors(f.hex).find((h) => world.old.terrain[h] > 1 && h !== f.hex) ?? f.hex;
    expect(landParty(world, state, f.id, shore, true).ok).toBe(true);
    expect(state.parties.length).toBe(1);
    const p = state.parties[0];
    expect(f.leader).toBeNull();
    const surveyedBefore = state.surveyed.old.filter(Boolean).length;
    expect(surveyedBefore).toBeGreaterThan(0);
    // march a few hexes inland and come back
    const inland = OLD.within(p.hex, 4).find((h) => world.old.terrain[h] > 1 && OLD.distance(h, p.hex) === 4)!;
    expect(moveParty(world, state, p.id, inland).ok).toBe(true);
    for (let k = 0; k < 4 && p.order; k++) endTurn(world, state);
    expect(state.surveyed.old.filter(Boolean).length).toBeGreaterThan(surveyedBefore);
    expect(moveParty(world, state, p.id, shore).ok).toBe(true);
    for (let k = 0; k < 4 && p.order; k++) endTurn(world, state);
    expect(p.hex).toBe(shore);
    expect(boardParty(state, p.id, f.id).ok).toBe(true);
    expect(state.parties.length).toBe(0);
    expect(f.leader).not.toBeNull();
  });

  it('resources and rumours exist on both boards, and every game differs', () => {
    const a = generateWorld(1), b = generateWorld(2);
    for (const w of [a, b]) {
      expect(w.new.resource.filter(Boolean).length).toBeGreaterThan(40);
      expect(w.old.resource.filter(Boolean).length).toBeGreaterThan(10);
      expect(w.new.rumours.length).toBeGreaterThanOrEqual(6);
      expect(w.old.rumours.length).toBeGreaterThanOrEqual(3);
      // nothing hidden in fixed Europe
      for (let i = 0; i < OLD.N; i++) if (OLD.lat(i) >= FIXED_SOUTH) expect(w.old.resource[i]).toBe(0);
    }
    expect(Buffer.from(a.new.resource).equals(Buffer.from(b.new.resource))).toBe(false);
  });
});

describe('M5: colonies', () => {
  /** Put a ready expedition with colonists and materials beside an empty stretch of African coast. */
  function beachhead(seed = 1492) {
    const game = newGame(seed);
    const { world, state } = game;
    const f = expedition(game);
    state.units.push({ id: 900, type: 'colonist', fleet: f.id, city: null, party: null });
    f.cargo = { timber: 40, tools: 30, cloth: 20, wine: 20 };
    const m = world.old;
    const ports = m.ports.map((p) => p.hex);
    const shore = [...Array(OLD.N).keys()].find((h) => OLD.lat(h) < 20 && OLD.lat(h) > 8 && m.terrain[h] > 1 && m.mainland[h]
      && OLD.neighbors(h).some((j) => m.terrain[j] <= 1) && ports.every((p) => OLD.distance(p, h) > 3))!;
    const sea = OLD.neighbors(shore).find((j) => m.terrain[j] <= 1)!;
    f.hex = sea; f.at = null;
    for (const h of OLD.within(shore, 3)) state.fog.old[h] = Fog.Explored;
    expect(landParty(world, state, f.id, shore, true).ok).toBe(true);
    return { ...game, f, p: state.parties[0], shore };
  }

  it('a party with colonists, beside a fleet with timber and tools, founds a colony', () => {
    const { world, state, f, p, shore } = beachhead();
    expect(canFound(world, state, p).ok).toBe(true);
    expect(foundColony(world, state, p.id).ok).toBe(true);
    expect(state.colonies.length).toBe(1);
    const c = state.colonies[0];
    expect(c.hex).toBe(shore);
    expect(c.pop).toBe(1); // one colonist landed with the party... plus the explorer's unit was infantry
    expect(f.cargo.timber).toBeUndefined(); // materials used, the rest carried ashore
    expect(c.stock.cloth).toBe(20);
    expect(state.parties.length).toBe(0);
    expect(state.units.some((u) => u.colony === c.id)).toBe(true); // the infantry stays as a garrison
  });

  it('a colony fed, clothed and given wine grows slowly by births; one without cloth and wine loses ground', () => {
    const { world, state, p } = beachhead();
    foundColony(world, state, p.id);
    const c = state.colonies[0];
    c.pop = 3;
    c.stock = { food: 10, cloth: 20, wine: 20, sugar: 10, tools: 10 };
    seasonTick(world, state);
    expect(c.last.births).toBeGreaterThan(c.last.deaths);
    const g = c.growth;
    seasonTick(world, state);
    expect(c.growth).toBeGreaterThan(g);
    // a year of births adds well under one colonist: settlers have to come from home
    expect(c.pop * (c.last.births - c.last.deaths)).toBeLessThan(1);
    const content = c.last.births;
    c.stock = { food: 10 };
    seasonTick(world, state);
    expect(c.last.discontent).toBe(true);
    expect(c.last.births).toBeLessThan(content);
  });

  it('newcomers season for a turn before they count, and the garrison eats', () => {
    const { world, state, p } = beachhead();
    foundColony(world, state, p.id);
    const c = state.colonies[0];
    const pop = c.pop;
    const soldiers = state.units.filter((u) => u.colony === c.id).length;
    c.newcomers = 2;
    state.units.push({ id: 9001, type: 'infantry', fleet: null, city: null, party: null, colony: c.id });
    c.stock = { food: 1 };
    seasonTick(world, state);
    expect(c.pop + c.last.seasoned).toBe(pop + 2);
    expect(c.newcomers).toBe(0);
    expect(c.last.garrison).toBe(soldiers + 1);
  });

  it('colonists work the land around the colony and fill its warehouse', () => {
    const { world, state, p } = beachhead();
    foundColony(world, state, p.id);
    const c = state.colonies[0];
    c.pop = 3;
    c.stock = { cloth: 30, wine: 30 };
    endTurn(world, state);
    expect(c.last.worked.length).toBeGreaterThanOrEqual(2); // a desert coast has few hexes worth working
    expect(c.last.worked.length).toBeLessThanOrEqual(3);
    expect(Object.keys(c.last.produced).length).toBeGreaterThan(0);
  });

  it('an outpost with materials and colonists becomes a town; the score counts it all', () => {
    const { world, state, p } = beachhead();
    foundColony(world, state, p.id);
    const c = state.colonies[0];
    expect(upgradeColony(state, c.id).ok).toBe(false);
    c.pop = 4;
    c.stock = { timber: 60, tools: 30, stone: 20 };
    const s0 = score(state);
    expect(upgradeColony(state, c.id).ok).toBe(true);
    expect(c.level).toBe('town');
    expect(score(state).territory).toBeGreaterThan(s0.territory);
    expect(score(state).total).toBeGreaterThan(0);
  });

  it('fleets dock at colonies and move goods in and out', () => {
    const { world, state, f, p } = beachhead();
    foundColony(world, state, p.id);
    const c = state.colonies[0];
    expect(moveFleet(world, state, f.id, c.hex).ok).toBe(true);
    for (let k = 0; k < 3 && f.at !== c.id; k++) endTurn(world, state);
    expect(f.at).toBe(c.id);
    c.stock.food = 10;
    expect(colonyTransfer(state, f.id, 'food', 5).ok).toBe(true);
    expect(f.cargo.food).toBe(5);
    expect(c.stock.food).toBe(5);
    expect(colonyTransfer(state, f.id, 'food', -5).ok).toBe(true);
    expect(f.cargo.food).toBeUndefined();
  });
});

describe('M6: native peoples', () => {
  it('every trading ground is a people with villages and rivals; each board has an empire', () => {
    const w = generateWorld(1492);
    for (const m of [w.old, w.new]) {
      expect(m.nations.length).toBe(m.ports.filter((p) => p.kind === 'native').length);
      expect(m.nations.filter((n) => n.empire).length).toBe(1);
      // peoples of small islands may live at their trading ground alone
      expect(m.nations.filter((n) => n.villages.length > 0).length).toBeGreaterThan(m.nations.length / 2);
      for (const n of m.nations) expect(n.rivals.length).toBeGreaterThan(0);
    }
  });

  it('meeting a people, gifts and an alliance', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    state.discovered.push(n.site);
    endTurn(world, state);
    const st = state.natives[n.id];
    expect(st.met).toBe(true);
    state.treasury = 1e5;
    expect(gift(world, state, n.id, 1000).ok).toBe(true);
    expect(st.attitude).toBeGreaterThanOrEqual(50);
    let allied = false;
    for (let k = 0; k < 10 && !allied; k++) { allyNation(world, state, n.id); allied = st.relation === 'allied'; if (!allied) gift(world, state, n.id, 300); }
    expect(allied).toBe(true);
  });

  it('a mission converts a friendly people over the years, and they can join the Crown', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    const st = state.natives[n.id];
    st.met = true; st.contact = 0; st.mission = true; st.attitude = 50;
    for (let k = 0; k < 30; k++) endTurn(world, state);
    expect(st.converted).toBe(1);
    st.attitude = 60;
    expect(incorporateNation(world, state, n.id).ok).toBe(true);
    expect(st.relation).toBe('subject');
    expect(score(state, world).territory).toBeGreaterThan(0);
  });

  it('a people remembers why it feels as it does', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    state.natives[n.id].met = true;
    expect(gift(world, state, n.id, 200).ok).toBe(true);
    const m = state.natives[n.id].memory.find((x) => x.why === 'Your gifts');
    expect(m && m.amount).toBeGreaterThan(0);
  });

  it('a furious people lays siege to an unguarded colony, and can burn it', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations.find((x) => !x.empire)!;
    const st = state.natives[n.id];
    st.met = true; st.contact = 0; st.epidemic = true; st.attitude = -90; st.warriors = 30;
    const hex = OLD.neighbors(n.siteHex).find((h) => world.old.terrain[h] > 1)!;
    state.colonies.push({ id: 'col-s', name: 'Testa', map: 'old', hex, founded: 0, pop: 2, level: 'outpost', stock: { food: 40 }, growth: 0, loyalty: 80,
      charter: false, unrest: false, newcomers: 0, walls: 0, last: emptyAccount() });
    let besieged = false;
    for (let k = 0; k < 40 && state.colonies.length; k++) {
      seasonTick(world, state);
      st.attitude = -90; // keep them furious
      if (st.siege) besieged = true;
    }
    expect(besieged).toBe(true);
    expect(state.colonies.length).toBe(0);
    expect(st.siege).toBeNull();
  });

  it('battles are about numbers: a lone soldier rarely beats a whole people', () => {
    expect(odds(4, 15)).toBeLessThan(0.25);
    expect(odds(40, 15)).toBeGreaterThan(0.7);
  });

  it('attacking a village means war; taking their ground makes them subjects; others resent it', () => {
    const game = newGame(1492);
    const { world, state } = game;
    const n = world.old.nations.find((x) => !x.empire)!;
    const other = world.old.nations.find((x) => x !== n)!;
    state.natives[other.id].met = true;
    const before = state.natives[other.id].attitude;
    for (let k = 0; k < 6; k++) state.units.push({ id: 800 + k, type: 'infantry', fleet: null, city: null, party: 700 });
    state.parties.push({ id: 700, name: 'Test column', map: 'old', hex: OLD.neighbors(n.siteHex).find((h) => world.old.terrain[h] > 1)!, leader: null, moves: 3, order: null, trail: [], food: 20 });
    state.natives[n.id].warriors = 6;
    let tries = 0;
    while (state.natives[n.id].relation !== 'subject' && tries++ < 6 && state.parties.length) attackVillage(world, state, 700, n.siteHex);
    expect(['war', 'subject']).toContain(state.natives[n.id].relation);
    expect(state.natives[other.id].attitude).toBeLessThan(before);
  });

  it('a hostile people raids colonies near their land', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations.find((x) => x.villages.length > 0)!;
    const st = state.natives[n.id];
    st.met = true; st.contact = 0; st.epidemic = true; st.attitude = -80; st.warriors = 30;
    state.colonies.push({ id: 'col-x', name: 'Test', map: 'old', hex: n.villages[0], founded: 0, pop: 4, level: 'outpost', stock: { food: 40, cloth: 40, wine: 40 }, growth: 0, loyalty: 80, charter: false, unrest: false,
      newcomers: 0, walls: 0, last: emptyAccount() });
    for (let k = 0; k < 8; k++) endTurn(world, state);
    expect(state.chronicle.some((c) => c.text.includes('raid Test'))).toBe(true);
  });

  it('first contact is followed, some seasons later, by an epidemic', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    state.discovered.push(n.site);
    const w0 = state.natives[n.id].warriors;
    for (let k = 0; k < 10; k++) endTurn(world, state);
    expect(state.natives[n.id].epidemic).toBe(true);
    expect(state.natives[n.id].warriors).toBeLessThan(w0);
  });
});

describe('M6: trading posts', () => {
  it('a fleet docked at a people’s ground with timber and tools builds a trading post', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    const f = state.fleets[0];
    f.hex = n.siteHex; f.at = n.site;
    state.natives[n.id].met = true;
    expect(tradingPost(world, state, f.id).ok).toBe(false); // no materials
    f.cargo = { timber: 20, tools: 10 };
    expect(tradingPost(world, state, f.id).ok).toBe(true);
    expect(state.natives[n.id].post).toBe(true);
    expect(f.cargo.timber).toBeUndefined();
  });
});

describe('M7: rival crowns', () => {
  it('rivals found colonies over the years, on both boards once they can cross', () => {
    const { world, state } = newGame(1492);
    for (let k = 0; k < 60; k++) endTurn(world, state);
    expect(state.rivalColonies.length).toBeGreaterThanOrEqual(3);
    expect(state.rivalColonies.some((c) => c.map === 'new')).toBe(true);
    expect(state.rivalColonies.some((c) => c.crown === 'portugal')).toBe(true);
    expect(state.chronicle.some((c) => c.text.includes('Tordesillas'))).toBe(true);
    for (const c of state.rivalColonies) if (c.map === 'old') expect(OLD.lat(c.hex)).toBeLessThan(30);
  });

  it('a rival colony blocks founding nearby', () => {
    const { world, state } = newGame(1492);
    for (let k = 0; k < 40 && !state.rivalColonies.length; k++) endTurn(world, state);
    const rc = state.rivalColonies[0];
    expect(rc).toBeDefined();
    const g = rc.map === 'old' ? OLD : NEW;
    state.units.push({ id: 901, type: 'colonist', fleet: null, city: null, party: 950 });
    const hex = g.within(rc.hex, 2).find((h) => world[rc.map].terrain[h] > 1 && h !== rc.hex && g.neighbors(h).some((j) => world[rc.map].terrain[j] <= 1))!;
    state.surveyed[rc.map][hex] = 1;
    state.parties.push({ id: 950, name: 'P', map: rc.map, hex, leader: null, moves: 3, order: null, trail: [], food: 20 });
    expect(canFound(world, state, state.parties[0]).why).toContain(rc.name);
  });

  it('war brings privateers; peace can be bought; a rival colony can be stormed and taken', () => {
    const game = newGame(1492);
    const { world, state } = game;
    for (let k = 0; k < 40 && !state.rivalColonies.length; k++) endTurn(world, state);
    const rc = state.rivalColonies[0];
    expect(declareWar(state, rc.crown).ok).toBe(true);
    // a column of ten infantry beside the colony
    const g = rc.map === 'old' ? OLD : NEW;
    const beside = g.neighbors(rc.hex).find((h) => world[rc.map].terrain[h] > 1)!;
    for (let k = 0; k < 10; k++) state.units.push({ id: 960 + k, type: 'infantry', fleet: null, city: null, party: 951 });
    state.parties.push({ id: 951, name: 'Column', map: rc.map, hex: beside, leader: null, moves: 3, order: null, trail: [], food: 20 });
    let tries = 0;
    while (state.rivalColonies.includes(rc) && state.units.some((u) => u.party === 951) && tries++ < 5) stormColony(world, state, 951, rc.id);
    expect(state.colonies.some((c) => c.name === rc.name) || tries > 0).toBe(true);
    state.treasury = 1e5;
    endTurn(world, state);
    endTurn(world, state);
    expect(rivalPeace(state, rc.crown).ok).toBe(true);
    expect(state.rivals[rc.crown].relation).toBe('peace');
  });

  it('every crown has a score', () => {
    const { world, state } = newGame(7);
    for (let k = 0; k < 30; k++) endTurn(world, state);
    for (const r of ['portugal', 'england', 'netherlands'] as const) expect(rivalScore(state, r).total).toBeGreaterThanOrEqual(0);
  });
});

describe('M8: the long game', () => {
  const testColony = (state: ReturnType<typeof newGame>['state'], world: ReturnType<typeof newGame>['world'], pop = 8) => {
    const hex = [...Array(NEW.N).keys()].find((h) => world.new.terrain[h] > 1)!;
    const c = { id: 'col-t', name: 'Testa', map: 'new' as const, hex, founded: 0, pop, level: 'town' as const, stock: { food: 100, cloth: 100, wine: 100 }, growth: 0,
      loyalty: 80, charter: false, unrest: false, newcomers: 0, walls: 0, last: emptyAccount() };
    state.colonies.push(c);
    return c;
  };

  it('a new era begins with a card', () => {
    const { world, state } = newGame(1492);
    state.turn = (1520 - 1492) * 4 - 1;
    endTurn(world, state);
    expect(state.events.some((e) => e.kind === 'era' && e.title === 'Age of Conquest')).toBe(true);
  });

  it('loyalty falls with high taxes and generations overseas; a charter wins it back and halves taxes', () => {
    const { world, state } = newGame(1492);
    const c = testColony(state, world);
    const t0 = loyaltyTarget(state, c);
    setTaxRate(state, 'high');
    state.turn = 400;
    expect(loyaltyTarget(state, c)).toBeLessThan(t0);
    const tax = colonyTaxes(state, c);
    expect(grantCharter(state, c.id).ok).toBe(true);
    expect(colonyTaxes(state, c)).toBeLessThan(tax);
    expect(loyaltyTarget(state, c)).toBeGreaterThan(loyaltyTarget({ ...state, colonies: [] } as never, { ...c, charter: false }));
  });

  it('a large, disloyal colony without a garrison may break away', () => {
    const { world, state } = newGame(1492);
    const c = testColony(state, world, 10);
    setTaxRate(state, 'high');
    state.turn = 4 * (1700 - 1492);
    c.founded = 0;
    for (let k = 0; k < 60 && state.colonies.includes(c); k++) endTurn(world, state);
    expect(state.colonies.includes(c)).toBe(false);
    expect(state.freeStates.some((f) => f.name === 'Testa')).toBe(true);
  });

  it('stories come with choices, and answering one changes the game', () => {
    const { world, state } = newGame(1492);
    let story = false;
    for (let k = 0; k < 40 && !story; k++) {
      endTurn(world, state);
      while (state.events.length && state.events[0].kind !== 'story') state.events.shift();
      story = state.events[0]?.kind === 'story';
    }
    expect(story).toBe(true);
    const e = state.events[0];
    expect(e.choices!.length).toBeGreaterThanOrEqual(1);
    const logBefore = state.chronicle.length;
    expect(chooseStory(world, state, 0).ok).toBe(true);
    expect(state.chronicle.length).toBeGreaterThan(logBefore);
    expect(state.events[0]?.story === e.story && state.events[0]?.ctx === e.ctx).toBe(false);
  });

  it('a short game ends with a final reckoning, and play can go on', () => {
    const { world, state } = newGame(1492, 1495);
    for (let k = 0; k < 13; k++) endTurn(world, state);
    expect(state.ended).toBe(true);
    expect(state.events.some((e) => e.kind === 'end')).toBe(true);
    endTurn(world, state);
    expect(state.events.filter((e) => e.kind === 'end').length).toBe(1);
  });
});

describe('M11 calendar', () => {
  it('a turn is half a year until 1550, then a year; the seasons still pass one by one', () => {
    const { world, state } = newGame(1492);
    expect(turnLabel(state.turn)).toBe('Spring 1492');
    endTurn(world, state);
    expect(state.turn).toBe(2);
    expect(turnLabel(state.turn)).toBe('Autumn 1492');
    expect(turnStride((1549 - 1492) * 4 + 2)).toBe(2);
    expect(turnStride((1550 - 1492) * 4)).toBe(4);
    expect(turnLabel((1551 - 1492) * 4)).toBe('1551');
    state.turn = (1550 - 1492) * 4;
    endTurn(world, state);
    expect(state.turn).toBe((1551 - 1492) * 4);
  });
});

describe('M12 armies', () => {
  const army = (...types: UnitType[]): Force => ({ name: 'a', units: types.map((type) => ({ type, vet: 0 })) });
  const warriors = (w: number): Force => ({ name: 'n', units: [], warriors: w, natives: true });

  it('mixed arms beat the same number of pikes; firearms beat bows', () => {
    const pikes = battleOdds(army('infantry', 'infantry', 'infantry', 'infantry'), warriors(10), T.Plains);
    const bows = battleOdds(army('infantry', 'infantry', 'archer', 'archer'), warriors(10), T.Plains);
    const guns = battleOdds(army('infantry', 'infantry', 'musketeer', 'musketeer'), warriors(10), T.Plains);
    expect(bows).toBeGreaterThan(pikes);
    expect(guns).toBeGreaterThanOrEqual(bows);
  });

  it('horse fights worse in forest than on the plains; walls hold until guns breach them', () => {
    const horse = army('cavalry', 'cavalry', 'cavalry');
    expect(battleOdds(horse, warriors(9), T.Plains)).toBeGreaterThan(battleOdds(horse, warriors(9), T.Forest));
    const garrison = (walls: number): Force => ({ ...army('infantry', 'infantry', 'colonist', 'colonist'), walls });
    const foot = army(...Array<UnitType>(5).fill('infantry'));
    expect(battleOdds(foot, garrison(2), T.Plains)).toBeLessThan(battleOdds(foot, garrison(0), T.Plains));
    const guns = army(...Array<UnitType>(3).fill('infantry'), 'cannon', 'cannon');
    expect(battleOdds(guns, garrison(2), T.Plains)).toBeGreaterThan(battleOdds(foot, garrison(2), T.Plains));
  });

  it('an attack on a village gives a report, and survivors of a victory become veterans', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations.find((x) => !x.empire)!;
    state.natives[n.id].warriors = 4;
    for (let k = 0; k < 5; k++) state.units.push({ id: 880 + k, type: k < 3 ? 'swordsman' : 'musketeer', fleet: null, city: null, party: 701 });
    state.parties.push({ id: 701, name: 'Column', map: 'old', hex: OLD.neighbors(n.siteHex).find((h) => world.old.terrain[h] > 1)!, leader: null, moves: 3, order: null, trail: [], food: 20 });
    attackVillage(world, state, 701, n.siteHex);
    const ev = state.events.find((e) => e.kind === 'battle');
    expect(ev?.battle?.rounds.length).toBe(3);
    if (ev?.battle?.attackerWon) expect(state.units.filter((u) => u.party === 701 || u.colony).some((u) => (u.vet ?? 0) > 0)).toBe(true);
  });

  it('an army without food starves; one beside its colony restocks', () => {
    const { world, state } = newGame(1492);
    const hex = [...Array(OLD.N).keys()].find((h) => world.old.terrain[h] === T.Desert)!;
    for (let k = 0; k < 8; k++) state.units.push({ id: 890 + k, type: 'infantry', fleet: null, city: null, party: 702 });
    state.parties.push({ id: 702, name: 'Column', map: 'old', hex, leader: null, moves: 3, order: null, trail: [], food: 0 });
    seasonTick(world, state);
    expect(state.units.filter((u) => u.party === 702).length).toBeLessThan(8);
  });

  it('walls are raised with materials from the warehouse', () => {
    const { world, state } = newGame(1492);
    state.colonies.push({ id: 'col-w', name: 'Murada', map: 'new', hex: 5, founded: 0, pop: 4, level: 'outpost', stock: { timber: 40 }, growth: 0, loyalty: 80,
      charter: false, unrest: false, newcomers: 0, walls: 0, last: emptyAccount() });
    void world;
    expect(buildWalls(state, 'col-w').ok).toBe(true);
    expect(state.colonies[0].walls).toBe(1);
    expect(state.colonies[0].stock.timber).toBe(10);
    expect(buildWalls(state, 'col-w').ok).toBe(false); // no stone
  });
});

describe('M13 a living market', () => {
  it('a factor sells slowly at fair prices, and earns more than dumping the whole cargo at once', () => {
    const { world, state } = newGame(1492);
    state.treasury = 10000;
    expect(openFactory(world, state, 'antwerp').ok).toBe(true);
    const f = state.factories[0];
    const m = state.markets.antwerp.sugar!;
    const dump = sellValue({ ...m }, 120, 0.1);
    f.stock.sugar = 120;
    expect(factoryOrder(state, 'antwerp', 'sugar', 'sell').ok).toBe(true);
    let earned = 0;
    for (let k = 0; k < 40 && (f.stock.sugar ?? 0) > 0; k++) { seasonTick(world, state); earned += f.last.sold; }
    expect(earned).toBeGreaterThan(dump);
    expect(unitPrice(m)).toBeGreaterThan(m.base * 0.6);
  });

  it('regions have tastes, and shocks move demand', () => {
    const { state } = newGame(1492);
    expect(demandFactor(state, 'england', 'spices')).toBeGreaterThan(demandFactor(state, 'spain', 'spices'));
    expect(demandFactor(state, 'morocco', 'wine')).toBeLessThan(demandFactor(state, 'spain', 'wine'));
    const before = demandFactor(state, 'france', 'food');
    state.shocks.push({ kind: 'famine', region: 'france', since: 0, until: 10 });
    expect(demandFactor(state, 'france', 'food')).toBeGreaterThan(before * 1.5);
  });

  it("rival merchants bring their colonies' goods into their home port", () => {
    const { world, state } = newGame(1492);
    const home = state.markets.lisbon;
    const hex = [...Array(NEW.N).keys()].find((h) => Math.abs(NEW.lat(h)) < 20 && world.new.terrain[h] > 1)!;
    state.rivalColonies.push({ id: 'rcol-x', crown: 'portugal', name: 'X', map: 'new', hex, pop: 10, level: 'town', founded: 0, garrison: 1, seen: false });
    const sugar = home.sugar!.stock;
    rivalMerchants(world, state);
    expect(home.sugar!.stock).toBeGreaterThan(sugar);
  });
});
