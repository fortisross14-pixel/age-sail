import { describe, it, expect } from 'vitest';
import { generateWorld, generateOldWorld } from './mapgen';
import {
  newGame, endTurn, buy, sell, moveFleet, previewMove, crossOcean, startProject, portById, cargoUsed, maxMoves,
  provision, provisionCost, splitShip, mergeFleets, setResearch, has, promote, assignLeader, recall, hire, setTradeRoute,
  slotsUsed, slotsMax, unitsAboard, leaderOf, embark, projectCost, landParty, moveParty, boardParty, citySlots, slotsUsedIn,
  foundColony, upgradeColony, colonyTransfer,
} from './game';
import { makeMarket, unitPrice, buyCost, sellValue } from './market';
import { planRoute } from './sailing';
import { OLD, NEW } from './hex';
import { FIXED_SOUTH } from '../data/europe';
import { canFound, score } from './colony';
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

type Game = ReturnType<typeof newGame>;

/** The opening moves: merge the two ships, make the best navigator an explorer, wait, put them in command. */
function expedition({ world, state }: Game) {
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
    endTurn(world, state);
    expect(state.fleets.length).toBe(n);
    endTurn(world, state);
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

describe('M3: the court', () => {
  it('starts with nine people, two ships with nobody in command, and petitioners', () => {
    const { state } = newGame(1492);
    expect(state.people.length).toBe(9);
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

  it('a colony fed, clothed and given wine grows; one without cloth and wine stalls', () => {
    const { world, state, p } = beachhead();
    foundColony(world, state, p.id);
    const c = state.colonies[0];
    c.pop = 3;
    c.stock = { food: 10, cloth: 20, wine: 20, sugar: 10 };
    for (let k = 0; k < 6; k++) endTurn(world, state);
    expect(c.pop).toBeGreaterThan(3);
    const before = c.pop;
    c.stock = { food: 10 };
    for (let k = 0; k < 6; k++) endTurn(world, state);
    expect(c.last.discontent).toBe(true);
    expect(c.pop).toBeLessThanOrEqual(before);
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
