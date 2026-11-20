import { describe, it, expect } from 'vitest';
import {
  newGame, seasonTick, startProject, setResearch, has, maxMoves, spreadFor, enactLaw, repealLaw, lawPlaces, fundExpedition, discover, promote, EXPEDITION,
  sendEnvoy, sendGift, proposeTreaty, breakTreaty, joinWar, setMarque, setTribute, buy, buildWalls, declareWar, mainPort,
} from './game';
import { TECHS, BRANCHES, techById, type TechId } from '../data/tech';
import { LAWS, lawTech } from '../data/laws';
import { DIPLOMACY as D, CORSAIR_REALMS } from '../data/diplomacy';
import { REALMS } from '../data/realms';
import { rivalsOf } from '../data/rivals';
import { realmMods, knowledgeMods } from './dynasty';
import { regardOf, enemyOf } from './europe';
import { GRIDS } from './hex';
import { isWater } from '../data/terrain';
import { emptyAccount, type GameState, type World } from './types';
import { wrap, readSave } from '../save';

const seasons = (w: World, s: GameState, n: number) => { for (let i = 0; i < n; i++) { seasonTick(w, s); s.events = []; } };
const know = (s: GameState, ...t: TechId[]) => { for (const x of t) if (!s.research.known.includes(x)) s.research.known.push(x); };

describe('Phase 4: the research tree', () => {
  it('has thirty subjects or more in four branches, each resting on subjects that exist', () => {
    expect(TECHS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TECHS.map((t) => t.id)).size).toBe(TECHS.length);
    for (const b of BRANCHES) expect(TECHS.filter((t) => t.branch === b).length, b).toBeGreaterThanOrEqual(7);
    for (const t of TECHS) for (const r of t.requires) expect(TECHS.some((x) => x.id === r), `${t.id} needs ${r}`).toBe(true);
    for (const l of LAWS) expect(lawTech(l.id), l.id).toBeTruthy();
  });

  it('can be studied to the end, a subject at a time', () => {
    const { state } = newGame(1492);
    let guard = 0;
    while (state.research.known.length < TECHS.length && guard++ < 100) {
      const next = TECHS.find((t) => !has(state, t.id) && t.requires.every((r) => has(state, r)))!;
      expect(next, `stuck after ${state.research.known.join(',')}`).toBeTruthy();
      expect(setResearch(state, next.id).ok).toBe(true);
      state.research.known.push(next.id);
    }
    expect(state.research.known.length).toBe(TECHS.length);
  });

  it('gates arquebusiers, galleons and star forts behind their subjects', () => {
    const { state } = newGame(1492);
    const home = state.cities[mainPort(state)];
    home.buildings.barracks = 2; home.buildings.docks = 3; state.treasury = 1e6;
    expect(startProject(state, home.id, { kind: 'unit', unit: 'musketeer' })).toMatchObject({ ok: false });
    expect(startProject(state, home.id, { kind: 'ship', ship: 'galleon' })).toMatchObject({ ok: false });
    know(state, 'arquebus');
    expect(startProject(state, home.id, { kind: 'unit', unit: 'musketeer' }).ok).toBe(true);
    home.project = null;
    know(state, 'galleon');
    expect(startProject(state, home.id, { kind: 'ship', ship: 'galleon' }).ok).toBe(true);
    state.colonies.push({ id: 'col-w', name: 'W', map: 'old', hex: 1, founded: 0, pop: 8, level: 'town', stock: { stone: 500, tools: 500, timber: 500 }, growth: 0, loyalty: 80, charter: false, unrest: false, newcomers: 0, walls: 2, last: emptyAccount() });
    expect(buildWalls(state, 'col-w')).toMatchObject({ ok: false });
    know(state, 'bastions');
    expect(buildWalls(state, 'col-w').ok).toBe(true);
  });

  it('makes what is learned count: more moves, better prices, cheaper soldiers, more research', () => {
    const { state } = newGame(1492);
    const f = state.fleets[0];
    const moves = maxMoves(f, state), spread = spreadFor(state, f), pts = realmMods(state).research;
    know(state, 'latitude', 'exchange', 'printing', 'regiments');
    expect(maxMoves(f, state)).toBe(moves + 1);
    expect(spreadFor(state, f)).toBeLessThan(spread);
    expect(realmMods(state).research).toBe(pts + 2);
    expect(knowledgeMods(state).unitCost).toBeCloseTo(0.85);
  });

  it('keeps only a few laws, opened by research, and repealing one costs prestige', () => {
    const { state } = newGame(1492);
    state.treasury = 1e5;
    expect(enactLaw(state, 'census')).toMatchObject({ ok: false });
    know(state, 'bureaucracy', 'humanism', 'exchange', 'companies');
    const taxes = realmMods(state).taxes;
    expect(enactLaw(state, 'census').ok).toBe(true);
    expect(realmMods(state).taxes).toBeCloseTo(taxes * 1.05);
    expect(enactLaw(state, 'tolerance').ok).toBe(true);
    expect(enactLaw(state, 'orthodoxy')).toMatchObject({ ok: false });
    expect(state.laws.length).toBe(lawPlaces(state));
    expect(enactLaw(state, 'free_ports')).toMatchObject({ ok: false });
    const p = state.prestige;
    expect(repealLaw(state, 'census').ok).toBe(true);
    expect(state.prestige).toBeLessThan(p);
    expect(enactLaw(state, 'free_ports').ok).toBe(true);
    expect(enactLaw(state, 'monopoly')).toMatchObject({ ok: false });
  });

  it('a funded expedition makes discoveries count three times, and ends with a reward', () => {
    const { state } = newGame(1492);
    expect(fundExpedition(state)).toMatchObject({ ok: false });
    promote(state, state.people[0].id, 'explorer', { unit: 'colonist' });
    expect(fundExpedition(state).ok).toBe(true);
    expect(fundExpedition(state)).toMatchObject({ ok: false });
    const before = state.research.pending;
    discover(state, 10);
    expect(state.research.pending).toBe(before + 10 * EXPEDITION.multiplier);
    const prestige = state.prestige;
    discover(state, EXPEDITION.need);
    expect(state.expedition).toBeNull();
    expect(state.prestige).toBe(prestige + EXPEDITION.prestige);
  });
});

describe('Phase 4: Europe', () => {
  it('knows every other realm; the corsair states start cool', () => {
    const { state } = newGame(1492);
    expect(Object.keys(state.europe).length).toBe(REALMS.length - 1);
    expect(state.europe.spain).toBeUndefined();
    for (const c of CORSAIR_REALMS) expect(state.europe[c].attitude).toBeLessThan(0);
  });

  it('envoys and gifts win regard, and regard wins treaties that better your prices', () => {
    const { world, state } = newGame(1492);
    const r = regardOf(state, 'venice');
    expect(sendEnvoy(state, 'venice').ok).toBe(true);
    expect(regardOf(state, 'venice')).toBeGreaterThan(r);
    expect(sendEnvoy(state, 'venice')).toMatchObject({ ok: false });
    expect(sendGift(state, 'venice').ok).toBe(true);
    expect(proposeTreaty(state, 'venice', 'alliance')).toMatchObject({ ok: false });
    state.europe.venice.attitude = 100; state.europe.venice.envoy = -99;
    const f = state.fleets[0];
    f.at = 'venice'; f.hex = world.old.ports.find((p) => p.id === 'venice')!.hex;
    const spread = spreadFor(state, f);
    expect(proposeTreaty(state, 'venice', 'trade').ok).toBe(true);
    expect(spreadFor(state, f)).toBeCloseTo(spread - D.tradeSpread);
    state.europe.venice.envoy = -99;
    expect(proposeTreaty(state, 'venice', 'alliance')).toMatchObject({ ok: false });
    know(state, 'ambassadors');
    expect(proposeTreaty(state, 'venice', 'alliance').ok).toBe(true);
    const p = state.prestige;
    expect(breakTreaty(state, 'venice').ok).toBe(true);
    expect(state.prestige).toBe(p - D.breakPrestige);
  });

  it('realms go to war over old quarrels and make peace; you may take a side, at a price', () => {
    const { world, state } = newGame(1492);
    let war;
    for (let i = 0; i < 300 && !war; i++) { seasons(world, state, 1); war = state.euroWars[0]; }
    expect(war).toBeTruthy();
    expect([war!.a, war!.b]).not.toContain(state.crown);
    const foe = war!.b;
    expect(joinWar(state, war!.id, war!.a).ok).toBe(true);
    expect(enemyOf(state, foe)).toBe(true);
    expect(joinWar(state, war!.id, war!.b)).toMatchObject({ ok: false });
    const port = world.old.ports.find((p) => p.realm === foe && state.markets[p.id]);
    if (port) { const f = state.fleets[0]; f.at = port.id; f.hex = port.hex; expect(buy(world, state, f.id, 'tools', 1)).toMatchObject({ ok: false }); f.at = mainPort(state); }
    state.treasury = 1e5;
    for (let i = 0; i < 40 && state.euroWars.includes(war!); i++) seasons(world, state, 1);
    expect(state.euroWars.includes(war!)).toBe(false);
    expect(state.chronicle.some((c) => /You chose the (winning|losing) side/.test(c.text))).toBe(true);
    expect(enemyOf(state, foe)).toBe(false);
  });

  it('a pact keeps a rival crown from declaring war, and an ally fights your enemies', () => {
    const { world, state } = newGame(1492);
    const [a, b] = rivalsOf(state.crown).map((r) => r.id);
    state.europe[a].treaty = 'pact';
    for (let i = 0; i < 60; i++) { state.rivals[a].attitude = -90; seasons(world, state, 1); }
    expect(state.rivals[a].relation).toBe('peace');
    state.europe[a].treaty = 'alliance';
    declareWar(state, b);
    seasons(world, state, 1);
    expect(state.rivals[a].wars).toContain(b);
    expect(state.rivals[b].wars).toContain(a);
  });

  it('corsairs hunt near their ports until they are paid or befriended', () => {
    const { world, state } = newGame(1492);
    const g = GRIDS.old;
    const base = world.old.ports.find((p) => p.realm === 'ottoman' && !p.inland)!;
    const sea = g.within(base.hex, 3).find((h) => isWater(world.old.terrain[h]))!;
    const park = () => { for (const f of state.fleets) Object.assign(f, { at: null, hex: sea, map: 'old', supplies: 8, order: null }); };
    const raids = () => state.chronicle.filter((c) => /[Cc]orsairs/.test(c.text)).length;
    expect(setTribute(state, 'ottoman', true).ok).toBe(true);
    expect(setTribute(state, 'venice', true)).toMatchObject({ ok: false });
    for (let i = 0; i < 40; i++) { park(); seasons(world, state, 1); }
    expect(raids()).toBe(0);
    setTribute(state, 'ottoman', false);
    for (let i = 0; i < 60 && state.fleets.length && !raids(); i++) { park(); seasons(world, state, 1); }
    expect(raids()).toBeGreaterThan(0);
  });

  it('an Ottoman war with Venice makes pepper scarce in Italy; letters of marque pay while you have an enemy', () => {
    const { world, state } = newGame(1492);
    seasons(world, state, 8);
    const m = state.markets.venice!.spices!;
    const before = m.stock;
    state.euroWars.push({ id: 9001, a: 'ottoman', b: 'venice', cause: 'a test', since: state.turn, until: state.turn + 40, side: null });
    seasons(world, state, 12);
    expect(m.stock).toBeLessThan(before);
    expect(setMarque(state, true).ok).toBe(true);
    const run = (on: boolean) => { const g = newGame(1492); declareWar(g.state, rivalsOf(g.state.crown)[3].id); setMarque(g.state, on); for (let i = 0; i < 6; i++) { g.state.fleets.forEach((f) => { f.at = mainPort(g.state); }); seasonTick(g.world, g.state); g.state.events = []; } return g.state.treasury; };
    expect(run(true)).toBeGreaterThan(run(false));
  });
});

describe('Phase 4: saves', () => {
  it('brings a version 17 voyage forward with no laws, a Europe at peace and what it had learned', () => {
    const { world, state } = newGame(1492);
    seasons(world, state, 30);
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    for (const k of ['laws', 'expedition', 'europe', 'euroWars', 'marque']) delete old[k];
    old.events = [];
    const r = readSave({ ...wrap(state), saveVersion: 17, state: old });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.laws).toEqual([]);
    expect(Object.keys(r.state.europe).length).toBe(REALMS.length - 1);
    expect(r.state.research.known.every((t) => !!techById(t))).toBe(true);
    seasons(world, r.state, 20);
    expect(r.state.turn).toBe(state.turn + 20);
  });
});
