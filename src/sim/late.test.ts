import { describe, it, expect } from 'vitest';
import {
  newGame, seasonTick, buyCaptives, sellCaptives, landCaptives, enactLaw, cargoUsed, startProject, projectCost, realmGate, cityTaxes, mainPort,
  favour, recognise, intercept, checkObjectives,
} from './game';
import { SLAVERY } from '../data/slavery';
import { takeCaptives, enslavedCap } from './slavery';
import { seaFight } from './seafight';
import { workPlan, score } from './colony';
import { loyaltyTarget, FREE } from './empire';
import { races, scenarioProgress } from './victory';
import { activeAmbitions } from './objectives';
import { BUILDINGS, BUILDING_ORDER } from '../data/city';
import { SCENARIOS, FAVOURS } from '../data/scenarios';
import { OBJECTIVES } from '../data/objectives';
import { crownSpec } from '../data/rivals';
import { mulberry32 } from './rng';
import { GRIDS } from './hex';
import { isWater } from '../data/terrain';
import { emptyAccount, type Colony, type GameState, type World } from './types';
import { wrap, readSave } from '../save';

const seasons = (w: World, s: GameState, n: number) => { for (let i = 0; i < n; i++) { seasonTick(w, s); s.events = []; } };
const colony = (id: string, hex: number, over: Partial<Colony> = {}): Colony => ({ id, name: `Col ${id}`, map: 'old', hex, founded: 0, pop: 6, level: 'outpost', stock: { food: 400, cloth: 100, wine: 100, tools: 50 }, growth: 0, loyalty: 80, charter: false, unrest: false, newcomers: 0, walls: 0, last: emptyAccount(), ...over });
/** A coastal hex with land around it, clear of ports, for a test colony. */
const site = (w: World) => { const g = GRIDS.old; return [...Array(g.N).keys()].find((h) => !isWater(w.old.terrain[h]) && g.lat(h) < 24 && g.neighbors(h).filter((j) => !isWater(w.old.terrain[j])).length >= 4 && !w.old.ports.some((p) => g.distance(p.hex, h) <= 3))!; };

describe('Phase 4: slavery', () => {
  const dock = (w: World, s: GameState, portId: string) => { const p = [...w.old.ports, ...w.new.ports].find((x) => x.id === portId)!; const f = s.fleets[1]; f.at = p.id; f.hex = p.hex; f.map = p.map; return f; };

  it('captives are bought at an African ground, take room in the hold, and die at sea', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    state.natives[n.id].met = true; state.natives[n.id].captives = 6;
    for (const id of n.rivals) if (state.natives[id]) state.natives[id].met = true;
    const f = dock(world, state, n.site);
    const hold = cargoUsed(f), gold = state.treasury;
    expect(buyCaptives(world, state, f.id, 4).ok).toBe(true);
    expect(f.captives).toBe(4);
    expect(state.treasury).toBe(gold - 4 * SLAVERY.buy);
    expect(cargoUsed(f)).toBe(hold + 4 * SLAVERY.hold);
    expect(buyCaptives(world, state, f.id, 4)).toMatchObject({ ok: false });
    for (const id of n.rivals) if (state.natives[id]) expect(state.natives[id].memory.some((m) => /carried off/.test(m.why))).toBe(true);
    f.captives = 40; f.at = null; f.supplies = 99;
    const g = GRIDS.old; f.hex = g.neighbors(f.hex).find((h) => isWater(world.old.terrain[h])) ?? f.hex;
    seasons(world, state, 4);
    expect(state.fleets.find((x) => x.id === f.id)?.captives ?? 0).toBeLessThan(40);
  });

  it('selling them fills the treasury but never the score; a colony puts them to work, fed and nothing more', () => {
    const { world, state } = newGame(1492);
    const f = dock(world, state, mainPort(state));
    f.captives = 5;
    const sales = state.revenue, gold = state.treasury;
    expect(sellCaptives(world, state, f.id, 2).ok).toBe(true);
    expect(state.treasury).toBe(gold + 2 * SLAVERY.sell);
    expect(state.revenue).toBe(sales);
    const c = colony('col-s', site(world), { pop: 2 });
    state.colonies.push(c);
    f.at = c.id;
    const before = workPlan(world, state, c).length, points = score(state, world).total;
    expect(landCaptives(state, f.id).ok).toBe(true);
    expect(c.enslaved).toBe(3);
    expect(f.captives).toBe(0);
    expect(workPlan(world, state, c).length).toBeGreaterThan(before);
    expect(score(state, world).total).toBe(points);
    expect(enslavedCap(c)).toBeGreaterThan(3);
    const food = c.stock.food!;
    seasons(world, state, 1);
    expect(c.stock.cloth).toBeGreaterThan(100 - c.pop * 1.01 - 1); // cloth goes to settlers only
    expect(c.stock.food).toBeLessThan(food + 30);
  });

  it('where the enslaved far outnumber the settlers with no soldiers by, they rise', () => {
    const { world, state } = newGame(1492);
    const c = colony('col-r', site(world), { pop: 3 });
    state.colonies.push(c);
    let rose = false;
    for (let i = 0; i < 160 && !rose; i++) { c.enslaved = 12; c.stock.food = 500; c.stock.cloth = 50; c.stock.wine = 50; seasons(world, state, 1); rose = state.chronicle.some((x) => /rise, and there are too few soldiers/.test(x.text)); }
    expect(rose).toBe(true);
  });

  it('taking captives is remembered by the people they were taken from', () => {
    const { world, state } = newGame(1492);
    const n = world.old.nations[0];
    const before = state.natives[n.id].attitude;
    expect(takeCaptives(state, n, mulberry32(3))).toBeGreaterThanOrEqual(SLAVERY.taken[0]);
    expect(state.natives[n.id].attitude).toBeLessThan(before);
  });

  it('abolition frees everyone, some stay as settlers, and the trade is closed', () => {
    const { world, state } = newGame(1492);
    const c = colony('col-f', site(world), { enslaved: 6, pop: 2 });
    state.colonies.push(c);
    state.fleets[0].captives = 3; state.treasury = 1e5;
    expect(enactLaw(state, 'abolition')).toMatchObject({ ok: false });
    state.research.known.push('philosophy');
    const prestige = state.prestige;
    expect(enactLaw(state, 'abolition').ok).toBe(true);
    expect(c.enslaved).toBe(0);
    expect(c.pop).toBe(4);
    expect(state.fleets[0].captives).toBe(0);
    expect(state.prestige).toBeGreaterThan(prestige);
    const n = world.old.nations[0];
    state.natives[n.id].captives = 5;
    const f = dock(world, state, n.site);
    expect(buyCaptives(world, state, f.id, 1)).toMatchObject({ ok: false });
    expect(takeCaptives(state, n, mulberry32(3))).toBe(0);
  });

  it('is rewarded by no objective or ambition', () => {
    expect(JSON.stringify(OBJECTIVES)).not.toMatch(/captive|slave|enslaved/i);
  });
});

describe('Phase 4: fights at sea', () => {
  it('are fought in three rounds, and the stronger side usually wins', () => {
    const strong = { name: 'A', guns: 20, crew: 200, speed: 15 }, weak = { name: 'B', guns: 6, crew: 60, speed: 15 };
    let wins = 0;
    for (let k = 0; k < 200; k++) { const r = seaFight(mulberry32(k), strong, weak); expect(r.rounds.map((x) => x.name)).toEqual(['Gunnery', 'Boarding', 'Chase']); if (r.attackerWon) wins++; }
    expect(wins).toBeGreaterThan(170);
    expect(seaFight(mulberry32(5), strong, weak)).toEqual(seaFight(mulberry32(5), strong, weak));
  });

  it('an interception ends with a report on the card', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0], g = GRIDS.old;
    const sea = [...Array(g.N).keys()].find((i) => isWater(world.old.terrain[i]) && g.lat(i) < 25)!;
    Object.assign(f, { at: null, hex: sea });
    state.rivalShips.push({ id: 778, crown: 'portugal', map: 'old', hex: g.neighbors(sea).find((h) => isWater(world.old.terrain[h]))!, kind: 'trader', target: null, path: null, trail: [], strength: 0, name: 'Bérrio', homeward: false, cargo: null });
    state.events = [];
    expect(intercept(world, state, f.id, 778).ok).toBe(true);
    expect(state.events[0].sea?.rounds.length).toBe(3);
  });
});

describe('Phase 4: buildings at home', () => {
  it('has ten buildings; the new ones rest on the old, and do what they say', () => {
    expect(BUILDING_ORDER.length).toBe(10);
    for (const b of BUILDING_ORDER.slice(5)) expect(BUILDINGS[b].needs, b).toBeTruthy();
    const { world, state } = newGame(1492);
    const home = state.cities[mainPort(state)];
    state.treasury = 1e6;
    home.buildings.market = 0;
    expect(startProject(state, home.id, { kind: 'building', building: 'warehouse' })).toMatchObject({ ok: false });
    home.buildings.market = 1;
    const taxes = cityTaxes(home);
    expect(startProject(state, home.id, { kind: 'building', building: 'warehouse' }).ok).toBe(true);
    seasons(world, state, 3);
    expect(home.buildings.warehouse).toBe(1);
    expect(cityTaxes(home)).toBeGreaterThan(taxes);
    const ship = () => projectCost({ kind: 'ship', ship: 'caravel' }, home, undefined, crownSpec(state.crown).edge, realmGate(state)).cost;
    const cost = ship();
    home.buildings.arsenal = 1;
    expect(ship()).toBeLessThan(cost);
    home.buildings.barracks = 1; home.buildings.fortress = 1; home.project = null;
    expect(startProject(state, home.id, { kind: 'unit', unit: 'infantry' }).ok).toBe(true);
    seasons(world, state, 3);
    expect(state.units.some((u) => u.type === 'infantry' && u.vet === 1 && u.city === home.id)).toBe(true);
    const c = colony('col-c', site(world));
    state.colonies.push(c);
    const loyal = loyaltyTarget(state, c);
    home.buildings.cathedral = 1;
    expect(loyaltyTarget(state, c)).toBeGreaterThan(loyal);
  });
});

describe('Phase 4: prestige, victory and scenarios', () => {
  it('prestige buys favours', () => {
    const { state } = newGame(1492);
    expect(favour(state, 'summon')).toMatchObject({ ok: false });
    state.prestige = 100;
    const n = state.petitioners.length;
    expect(favour(state, 'summon').ok).toBe(true);
    expect(state.petitioners.length).toBe(n + 1);
    expect(Math.max(...Object.values(state.petitioners[n].person.skills))).toBe(5);
    expect(state.prestige).toBe(100 - FAVOURS.summon.cost);
    const loyal = state.people[0].loyalty;
    expect(favour(state, 'honours').ok).toBe(true);
    expect(state.people[0].loyalty).toBeGreaterThan(loyal);
    const regard = state.europe.venice.attitude;
    expect(favour(state, 'legate').ok).toBe(true);
    expect(state.europe.venice.attitude).toBeGreaterThan(regard);
  });

  it('the first crown to finish a race wins it, once', () => {
    const { world, state } = newGame(1492);
    expect(races(world, state).every((r) => r.me < 1)).toBe(true);
    state.prestige = 1000;
    seasonTick(world, state);
    expect(state.victory).toMatchObject({ kind: 'prestige', crown: 'spain' });
    expect(state.events.some((e) => e.kind === 'end')).toBe(true);
    state.events = []; state.revenue = 1e9;
    seasonTick(world, state);
    expect(state.victory?.kind).toBe('prestige');
    expect(state.events.some((e) => e.kind === 'end')).toBe(false);
    const other = newGame(1492);
    other.state.rivals.england.revenue = 1e9;
    seasonTick(other.world, other.state);
    expect(other.state.victory).toMatchObject({ kind: 'trade', crown: 'england' });
  });

  it('a scenario is won by its goal or lost by its year, and the game goes on either way', () => {
    const won = newGame(1492, 1650, 'spain', 'captain', 'charge');
    expect(scenarioProgress(won.state)?.need).toBe(SCENARIOS[0].goal.need);
    won.state.treasury = 50000;
    seasonTick(won.world, won.state);
    expect(won.state.scenario?.done).toBe('won');
    const lost = newGame(1492, 1650, 'spain', 'captain', 'crossing');
    lost.state.turn = (1511 - 1492) * 4;
    seasonTick(lost.world, lost.state);
    expect(lost.state.scenario?.done).toBe('lost');
    expect(lost.state.ended).toBe(false);
    expect(newGame(1492).state.scenario).toBeNull();
  });
});

describe('Phase 4: the late game', () => {
  it('a free state unsettles its neighbours until it is recognised, and then trades', () => {
    const { world, state } = newGame(1492);
    const h = site(world);
    const c = colony('col-n', h);
    state.colonies.push(c);
    const before = loyaltyTarget(state, c);
    state.freeStates.push({ id: 'free-1', name: 'Libertad', map: 'old', hex: GRIDS.old.neighbors(h)[0], pop: 8, level: 'town', since: 0 });
    expect(loyaltyTarget(state, c)).toBe(before - FREE.example);
    const prestige = state.prestige;
    expect(recognise(state, 'free-1').ok).toBe(true);
    expect(state.prestige).toBe(prestige - FREE.recognisePrestige);
    expect(loyaltyTarget(state, c)).toBe(before);
    expect(recognise(state, 'free-1')).toMatchObject({ ok: false });
  });

  it('a free state left alone finds a protector among your rivals', () => {
    const { world, state } = newGame(1492);
    state.freeStates.push({ id: 'free-2', name: 'Libertad', map: 'old', hex: site(world), pop: 8, level: 'town', since: 0 });
    for (let i = 0; i < 200 && !state.freeStates[0].by; i++) seasons(world, state, 1);
    expect(state.freeStates[0].by).toBeTruthy();
  });

  it('keeps ambitions for the later ages until their year', () => {
    const { world, state } = newGame(1492);
    for (const o of OBJECTIVES) if (!o.fromYear) state.objectives.done[o.id] = 0;
    expect(activeAmbitions(state)).toEqual([]);
    state.turn = (1525 - 1492) * 4;
    expect(activeAmbitions(state).map((o) => o.id)).toEqual(['laws3', 'treaties3']);
    state.laws = ['census', 'tolerance', 'charters'];
    expect(checkObjectives(world, state).map((o) => o.id)).toContain('laws3');
  });
});

describe('Phase 4: saves, second half', () => {
  it('brings a version 18 voyage forward with room for the new buildings', () => {
    const { world, state } = newGame(1492);
    seasons(world, state, 12);
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    delete old.victory; delete old.scenario;
    for (const c of Object.values(old.cities as Record<string, { buildings: Record<string, number> }>)) for (const b of BUILDING_ORDER.slice(5)) delete c.buildings[b];
    old.events = [];
    const r = readSave({ ...wrap(state), saveVersion: 18, state: old });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const c of Object.values(r.state.cities)) for (const b of BUILDING_ORDER) expect(typeof c.buildings[b]).toBe('number');
    expect(r.state.victory).toBeNull();
    seasons(world, r.state, 12);
    expect(r.state.turn).toBe(state.turn + 12);
  });
});
