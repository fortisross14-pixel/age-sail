import { describe, it, expect } from 'vitest';
import { newGame, endTurn, seasonTick, promote, chooseStory, nameLand, renameColony, marry, intercept, engage, declareWar } from './game';
import { STORIES } from '../data/stories';
import type { Effect, Outcome, StoryDef } from '../data/stories/types';
import { bindFor, tell, maybeStory, storyById } from './stories';
import { realmMods, styled, heirOf, eraProgress } from './dynasty';
import { courtYear, recallDeed, COURT } from './court';
import { reignHistory } from './history';
import { allNations } from './natives';
import { CROWNS, RIVAL_ECON, rivalsOf, type CrownId } from '../data/rivals';
import { HOUSES } from '../data/dynasty';
import { ERA_PATHS } from '../data/eras';
import { isWater } from '../data/terrain';
import { GRIDS } from './hex';
import { mulberry32 } from './rng';
import { planLand } from './land';
import { Fog, emptyAccount, type Colony, type GameEvent, type GameState, type RivalColony, type Royal, type World } from './types';
import { wrap, readSave } from '../save';

const seasons = (w: World, s: GameState, n: number) => { for (let i = 0; i < n; i++) { seasonTick(w, s); s.events = []; } };
const colony = (id: string, hex: number, over: Partial<Colony> = {}): Colony => ({ id, name: `Col ${id}`, map: 'old', hex, founded: 0, pop: 8, level: 'outpost', stock: { food: 50 }, growth: 0, loyalty: 80, charter: false, unrest: false, newcomers: 0, walls: 0, last: emptyAccount(), ...over });
const rcol = (s: GameState, crown: CrownId, hex: number): RivalColony => ({ id: `rcol-t${s.nextId++}`, crown, name: `R ${crown}`, map: 'old', hex, pop: 4, level: 'outpost', founded: 0, garrison: 1, seen: true, supply: RIVAL_ECON.supplyFull, stock: 0, growth: 0 });

/** A game in which every kind of story has someone and somewhere to be about. */
export function rich(crown: CrownId = 'spain') {
  const { world: w, state: s } = newGame(1492, 1650, crown);
  s.turn = 200; s.newWorldFound = true; s.treasury = 5000;
  const g = GRIDS.old;
  const landBy = (n: (typeof w.old.nations)[number]) => g.within(n.siteHex, 4).filter((h) => h !== n.siteHex && !isWater(w.old.terrain[h]) && !w.old.ports.some((p) => p.hex === h));
  // a people with room around it: some trading grounds are on small islands
  const n0 = [...w.old.nations].sort((x, y) => landBy(y).length - landBy(x).length)[0];
  const near = landBy(n0);
  const land = [...near].sort((x, y) => g.distance(x, n0.siteHex) - g.distance(y, n0.siteHex));
  s.colonies.push(colony('col-a', land[0], { loyalty: 30, founded: 195 }), colony('col-b', land[1], { loyalty: 90, founded: 20 }));
  s.units.push({ id: s.nextId++, type: 'infantry', fleet: null, city: null, party: null, colony: 'col-b' });
  const others = rivalsOf(crown).map((r) => r.id);
  for (const c of others) s.rivalColonies.push(rcol(s, c, land[2]));
  s.rivals[others[0]].attitude = -20;
  s.rivals[others[1]].attitude = 50;
  s.rivals[others[2]].relation = 'war'; s.rivals[others[2]].warSince = 190;
  s.rivals[others[3]].revenue = 1e7;
  const nations = [n0, ...allNations(w).filter((n) => n !== n0)];
  for (const n of nations) { const st = s.natives[n.id]; st.met = true; st.contact = 10; }
  Object.assign(s.natives[n0.id], { attitude: 60, post: true, mission: true, warriors: 20, feud: { with: nations[1].id, since: 190 } });
  s.natives[nations[1].id].feud = { with: n0.id, since: 190 };
  s.natives[nations[2].id].warriors = 3;
  s.natives[nations[3].id].relation = 'subject';
  const [a, b, c, d, e, f, h] = s.people;
  Object.assign(a, { trait: 'ambitious', loyalty: 85, rank: 'explorer', born: 1520 });
  Object.assign(b, { trait: 'pious', born: 1470 });
  Object.assign(c, { trait: 'learned', born: 1522 });
  Object.assign(d, { trait: 'bold', born: 1515 });
  Object.assign(e, { rank: 'merchant' });
  for (const p of [a, b, c, d, e, f, h]) p.skills = { navigation: 3, military: 3, commerce: 3, construction: 3, diplomacy: 3 };
  a.bonds = [{ with: b.id, kind: 'rival' }]; b.bonds = [{ with: a.id, kind: 'rival' }];
  const deep = [...Array(g.N).keys()].find((i) => w.old.deep[i])!;
  const [f1, f2] = s.fleets;
  Object.assign(f1, { at: null, hex: deep, supplies: 1, leader: a.id, cargo: { tools: 10 } }); a.fleet = f1.id;
  f1.ships.push({ ...f2.ships[0], id: 9999 });
  Object.assign(f2, { cargo: { tools: 5 }, leader: e.id }); e.fleet = f2.id;
  const nw = [...Array(GRIDS.new.N).keys()].find((i) => isWater(w.new.terrain[i]))!;
  s.fleets.push({ ...structuredClone(f2), id: 9998, name: 'Western', map: 'new', hex: nw, at: null, leader: null });
  s.dynasty.ties = ['venice'];
  if (!s.dynasty.consort) s.dynasty.consort = { id: -50, name: 'Bianca', sex: s.dynasty.ruler.sex === 'm' ? 'f' : 'm', born: 1520, gift: 'commerce', from: 'venice' };
  if (!s.dynasty.heirs.length) s.dynasty.heirs.push({ id: -51, name: 'Test', sex: 'm', born: 1530, gift: 'commerce' });
  return { w, s, ctx: { courtier: a.id, other: b.id, fleet: f1.id, colony: 'col-b', people: n0.id, crown: others[0], realm: 'venice', n: 3 } };
}

const outcomes = (d: StoryDef): Outcome[] => d.choices.flatMap((c) => (c.else ? [c, c.else] : [c]));
const words = (d: StoryDef) => [d.title, d.text, ...d.choices.flatMap((c) => [c.label, c.hint ?? '']), ...outcomes(d).map((o) => o.text), ...outcomes(d).flatMap((o) => o.effects.filter((e) => e[0] === 'opinion' || e[0] === 'regard' || e[0] === 'courtAll').map((e) => String(e[e.length - 1])))].join(' ');
const NEEDS: Partial<Record<Effect[0], keyof NonNullable<StoryDef['about']>>> = {
  crew: 'fleet', stores: 'fleet', hull: 'fleet', halt: 'fleet', cargoLose: 'fleet',
  loyalty: 'colony', pop: 'colony', food: 'colony', charter: 'colony', garrison: 'colony',
  regard: 'people', warriors: 'people', convert: 'people', attitude: 'crown', war: 'crown', rivalDucats: 'crown', realmTie: 'realm',
};

describe('Phase 3: the stories as data', () => {
  it('has a hundred stories, each with its own name, and three set pieces for every crown', () => {
    expect(STORIES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length);
    for (const c of CROWNS) {
      const mine = STORIES.filter((s) => s.family === 'history' && !s.chained && s.when?.some((w) => w[0] === 'crown' && (w.slice(1) as string[]).includes(c.id)));
      expect(mine.length, c.id).toBe(3);
    }
  });

  it('names only what it binds, and acts only on what it binds', () => {
    const slots = ['courtier', 'other', 'fleet', 'colony', 'people', 'crown', 'realm'] as const;
    for (const d of STORIES) {
      expect(d.choices.length, d.id).toBeGreaterThan(0);
      for (const o of outcomes(d)) for (const e of o.effects) if (e[0] === 'later') { expect(storyById(e[1])?.chained, `${d.id} later ${e[1]}`).toBe(true); }
      if (d.chained) continue; // a follow-up inherits its subjects from the story before it
      const text = words(d);
      for (const slot of slots) if (new RegExp(`\\{${slot}[.}]`).test(text)) expect(d.about?.[slot], `${d.id} names {${slot}}`).toBeTruthy();
      for (const o of outcomes(d)) for (const e of o.effects) {
        const need = NEEDS[e[0]];
        if (need) expect(d.about?.[need], `${d.id}: ${e[0]} needs ${need}`).toBeTruthy();
        if (e[0] === 'skill' || e[0] === 'trait' || e[0] === 'leave' || e[0] === 'die' || e[0] === 'opinion') expect(d.about?.[e[1]], `${d.id}: ${e[0]} ${e[1]}`).toBeTruthy();
        if (e[0] === 'bond') expect(d.about?.courtier && d.about?.other, d.id).toBeTruthy();
      }
      for (const c of d.choices) if (c.roll && (c.roll[0] === 'courtier' || c.roll[0] === 'other')) expect(d.about?.[c.roll[0]], `${d.id} roll`).toBeTruthy();
    }
  });

  it('is written for any crown: only the set pieces name a particular realm’s places', () => {
    for (const d of STORIES.filter((s) => s.family !== 'history')) expect(words(d), d.id).not.toMatch(/Sevilla|Toledo|Salamanca|Castil|Lisboa|London|Paris|Antwerp/);
  });

  it('can tell every story and carry out every choice, for every crown, leaving no blank in the text', () => {
    for (const crown of CROWNS.map((c) => c.id)) {
      const base = rich(crown);
      for (const d of STORIES) {
        const { w, s } = base;
        const ctx = d.chained ? base.ctx : bindFor(w, s, d.id, mulberry32(7));
        expect(ctx, `${crown}: ${d.id} finds nobody to be about`).not.toBeNull();
        for (let i = 0; i < d.choices.length; i++) {
          const t = structuredClone(s);
          t.events = [];
          const told = tell(w, t, d.id, ctx!, (e) => t.events.push(e));
          expect(told, `${crown}: ${d.id}`).toBe(true);
          const card = t.events[0];
          expect(`${card.title} ${card.text} ${card.choices!.map((c) => `${c.label} ${c.hint ?? ''}`).join(' ')}`, `${crown}: ${d.id}`).not.toMatch(/[{}]|undefined|NaN/);
          if (i >= card.choices!.length) continue;
          const r = chooseStory(w, t, i);
          expect(r.ok, `${crown}: ${d.id} choice ${i}`).toBe(true);
          if (r.ok) expect(r.message ?? '', `${crown}: ${d.id} choice ${i}`).not.toMatch(/[{}]|undefined|NaN/);
          expect(Number.isFinite(t.treasury) && Number.isFinite(t.prestige), d.id).toBe(true);
        }
      }
    }
  }, 60000);
});

describe('Phase 3: how stories are told', () => {
  it('tells a story nobody has heard before one they have', () => {
    const { world, state } = newGame(1492);
    for (const d of STORIES) if (d.id !== 'papal_tithe') state.told[d.id] = -999;
    let got: string | undefined;
    for (let i = 0; i < 80 && !got; i++) { state.turn++; maybeStory(world, state, (e) => { got = e.story; }); }
    expect(got).toBe('papal_tithe');
  });

  it('remembers a choice and comes back to it: a ransom is repaid in kind years later', () => {
    const { w, s, ctx } = rich();
    s.events = [];
    tell(w, s, 'survivors', ctx, (e) => s.events.push(e));
    chooseStory(w, s, 1);
    expect(s.flags.ransomed).toBe(s.turn);
    expect(s.pending.map((p) => p.story)).toContain('ransom_remembered');
    const due = s.pending.find((p) => p.story === 'ransom_remembered')!.at;
    s.turn = due;
    s.events = [];
    maybeStory(w, s, (e) => s.events.push(e));
    expect(s.events[0]?.story).toBe('ransom_remembered');
    expect(s.events[0].text).toMatch(/captain of/);
  });

  it('plays the same stories twice from the same seed', () => {
    const run = () => { const g = newGame(7); const got: string[] = []; for (let i = 0; i < 120; i++) { seasonTick(g.world, g.state); for (const e of g.state.events) if (e.story) got.push(e.story); while (g.state.events.length) { if (g.state.events[0].choices) chooseStory(g.world, g.state, 0); else g.state.events.shift(); } } return got; };
    const a = run();
    expect(a.length).toBeGreaterThan(5);
    expect(run()).toEqual(a);
  });
});

describe('Phase 3: the dynasty', () => {
  it('starts each crown with its house of 1492', () => {
    for (const c of CROWNS) {
      const { state } = newGame(1492, 1650, c.id as CrownId);
      expect(state.dynasty.house).toBe(HOUSES[c.id as CrownId].house);
      expect(styled(state.crown, state.dynasty.ruler)).toMatch(/^(King|Queen|Duke|Duchess) \p{L}+ [IVX]+$/u);
    }
    expect(newGame(1492, 1650, 'netherlands').state.dynasty.regency).toBe(true);
    expect(styled('spain', newGame(1492).state.dynasty.ruler)).toBe('Queen Isabel I');
  });

  it('passes the crown to the eldest heir when the ruler dies, with a regent for a child', () => {
    const { world, state } = newGame(1492, 1650, 'england');
    const heir = heirOf(state.dynasty)!;
    state.dynasty.ruler.born = 1380;
    let card;
    for (let i = 0; i < 40 && !card; i++) { seasonTick(world, state); card = state.events.find((e) => e.story === 'succession'); if (!card) state.events = []; }
    expect(card).toBeTruthy();
    expect(state.dynasty.ruler.name).toBe(heir.name);
    expect(state.dynasty.regency).toBe(true);
    expect(state.dynasty.reigns.length).toBe(2);
    expect(realmMods(state).taxes).toBeLessThan(1);
    expect(chooseStory(world, state, 0).ok).toBe(true);
  });

  it('pays for a throne with no heir in prestige and loyalty', () => {
    const { world, state } = newGame(1492);
    state.dynasty.heirs = []; state.dynasty.consort = null; state.dynasty.ruler.born = 1380;
    const before = state.prestige;
    for (let i = 0; i < 60 && state.dynasty.reigns.length < 2; i++) { seasonTick(world, state); state.events = []; }
    expect(state.dynasty.reigns.length).toBe(2);
    expect(state.prestige).toBeLessThan(before);
  });

  it('brings offers of marriage to an unmarried ruler; a match with a rival crown warms it', () => {
    const { world, state } = newGame(1492);
    state.dynasty.consort = null; state.dynasty.ruler.born = 1470;
    for (let i = 0; i < 16 && !state.dynasty.offers.length; i++) { seasonTick(world, state); state.events = []; }
    expect(state.dynasty.offers.length).toBeGreaterThan(0);
    state.dynasty.offers[0].realm = 'portugal';
    const o = state.dynasty.offers[0], gold = state.treasury, att = state.rivals.portugal.attitude;
    expect(marry(state, o.id).ok).toBe(true);
    expect((state.dynasty.consort as Royal | null)?.name).toBe(o.name);
    expect(state.treasury).toBe(gold + o.dowry);
    expect(state.dynasty.ties).toContain('portugal');
    expect(state.rivals.portugal.attitude).toBeGreaterThan(att);
    expect(marry(state, o.id).ok).toBe(false);
  });

  it('gives the realm what its ruler is good at', () => {
    const { state } = newGame(1492, 1650, 'england');
    expect(realmMods(state).taxes).toBeCloseTo(1.08);
    expect(realmMods(newGame(1492, 1650, 'portugal').state).research).toBe(1);
    expect(realmMods(newGame(1492, 1650, 'france').state).upkeep).toBeCloseTo(0.85);
  });
});

describe('Phase 3: courtiers remember', () => {
  it('raising someone galls their rivals', () => {
    const { state } = newGame(1492);
    const [a, b] = state.people;
    a.bonds = [{ with: b.id, kind: 'rival' }]; b.bonds = [{ with: a.id, kind: 'rival' }];
    const before = b.loyalty;
    promote(state, a.id, 'merchant');
    expect(b.loyalty).toBeLessThan(before);
    expect(b.memory.some((m) => m.why.includes(a.name))).toBe(true);
    expect(a.memory.some((m) => m.why === 'Given a commission')).toBe(true);
  });

  it('a courtier kept waiting grows disloyal, and a rival crown makes an offer', () => {
    const { world, state } = newGame(1492);
    const p = state.people[0];
    p.trait = 'ambitious'; p.want = { kind: 'rank', since: 0 };
    recallDeed(state, p, -45, 'Slighted');
    state.turn = 40;
    expect(courtYear(state, mulberry32(1))).toContain(p);
    expect(p.loyalty).toBeLessThanOrEqual(COURT.leaving);
    let card: GameEvent | undefined;
    for (let i = 0; i < 12 && !card; i++) { seasonTick(world, state); card = state.events.find((e) => e.story === 'defect'); if (!card) state.events = []; }
    expect(card?.text).toContain(p.name);
    const to = card!.ctx!.crown as CrownId, gold = state.rivals[to].treasury;
    state.events = [card!];
    chooseStory(world, state, 1);
    expect(state.people.includes(p)).toBe(false);
    expect(state.rivals[to].treasury).toBeGreaterThanOrEqual(gold + 300);
  });
});

describe('Phase 3: the age, the land and the record', () => {
  it('opens an era with three paths; the one chosen helps the realm and sets a goal', () => {
    const { world, state } = newGame(1492, 1650, 'netherlands');
    state.dynasty.regency = false;
    state.turn = (1520 - 1492) * 4 - 1;
    endTurn(world, state);
    const i = state.events.findIndex((e) => e.story === 'era:conquest');
    state.events = [state.events[i]];
    expect(chooseStory(world, state, 0).ok).toBe(true);
    expect(state.eraPath?.path).toBe(ERA_PATHS.conquest[0].id);
    expect(realmMods(state).upkeep).toBeCloseTo(0.8);
    expect(eraProgress(world, state)?.need).toBe(ERA_PATHS.conquest[0].goal.need);
    state.prestige += 100;
    state.turn = (1570 - 1492) * 4 - 1;
    const before = state.prestige;
    seasonTick(world, state);
    expect(state.chronicle.some((c) => /promise kept/.test(c.text))).toBe(true);
    expect(state.prestige).toBeGreaterThan(before);
  });

  it('lets you name the land and your colonies, and writes a history of the reign', () => {
    const { w, s } = rich();
    expect(nameLand(s, '  Nueva <b>Castilla</b> ', 'new', 5).ok).toBe(true);
    expect(s.land?.name).toBe('Nueva bCastilla/b'.replace(/[^\p{L} ]/gu, ''));
    expect(nameLand(s, 'x', 'new', 5).ok).toBe(false);
    expect(renameColony(s, 'col-a', 'Santa Fe').ok).toBe(true);
    expect(renameColony(s, 'col-b', 'Santa Fe').ok).toBe(false);
    const h = reignHistory(w, s).join(' ');
    expect(h).toContain('Trastámara');
    expect(h).toContain('Santa Fe');
    expect(h).not.toMatch(/undefined|NaN/);
  });
});

describe('Phase 2, the last items', () => {
  it('rivals learn the crossing by paying for it, not on a date', () => {
    const { world, state } = newGame(1492);
    for (let i = 0; i < 60; i++) { state.rivals.england.treasury = -1e6; seasonTick(world, state); state.events = []; }
    expect(state.rivals.portugal.volta).toBe(true);
    expect(state.rivals.england.volta).toBe(false);
    expect(state.rivalColonies.some((c) => c.crown === 'england' && c.map === 'new')).toBe(false);
  });

  it('a fleet can take a rival ship beside it, and that is war', () => {
    const { world, state } = newGame(1492);
    const f = state.fleets[0];
    const g = GRIDS.old;
    const sea = [...Array(g.N).keys()].find((i) => isWater(world.old.terrain[i]) && g.lat(i) < 25)!;
    Object.assign(f, { at: null, hex: sea });
    state.rivalShips.push({ id: 777, crown: 'portugal', map: 'old', hex: g.neighbors(sea).find((h) => isWater(world.old.terrain[h]))!, kind: 'supply', target: null, path: null, trail: [], strength: 0, name: 'Bérrio', homeward: false, cargo: null });
    const built = state.rivals.portugal.built;
    expect(intercept(world, state, f.id, 777).ok).toBe(true);
    expect(state.rivals.portugal.relation).toBe('war');
    const taken = !state.rivalShips.some((x) => x.id === 777);
    expect(state.rivals.portugal.built).toBe(taken ? built - 1 : built);
    expect(intercept(world, state, f.id, 12345).ok).toBe(false);
  });

  it('at war, soldiers march overland to a colony they can walk to, and a party can stop them', () => {
    const { w, s } = rich();
    const foe = rivalsOf(s.crown)[0].id;
    declareWar(s, foe);
    // their colony a few days' march away, on the same shore
    const g = GRIDS.old, fog = new Array(g.N).fill(Fog.Explored);
    const far = g.within(s.colonies[0].hex, 8).find((h) => !isWater(w.old.terrain[h]) && g.distance(h, s.colonies[0].hex) >= 6 && s.colonies.every((c) => !!planLand(g, w.old, fog, h, c.hex, 99, 99)))!;
    s.rivalColonies.find((c) => c.crown === foe)!.hex = far;
    let army;
    for (let i = 0; i < 80 && !army; i++) { s.rivals[foe].treasury = 5000; s.rivals[foe].next = 0; for (const c of s.rivalColonies) c.supply = RIVAL_ECON.supplyFull; seasons(w, s, 1); army = s.rivalShips.find((x) => x.kind === 'army'); }
    expect(army).toBeTruthy();
    s.parties.push({ id: 4242, name: 'Guard', map: army!.map, hex: army!.hex, leader: null, moves: 3, order: null, trail: [], food: 50 });
    for (let k = 0; k < 6; k++) s.units.push({ id: s.nextId++, type: 'musketeer', fleet: null, city: null, party: 4242 });
    s.events = [];
    expect(engage(w, s, 4242, army!.id).ok).toBe(true);
    expect(s.events[0].kind).toBe('battle');
  });

  it('peoples with a common enemy swear pacts, both or neither', () => {
    const { world, state } = newGame(7);
    let any = false;
    for (let i = 0; i < 400; i++) {
      seasons(world, state, 1);
      for (const n of allNations(world)) { const st = state.natives[n.id]; if (st.pact) { any = true; expect(state.natives[st.pact].pact).toBe(n.id); } }
    }
    expect(any).toBe(true);
  });
});

describe('Phase 3: saves', () => {
  it('brings a version 16 voyage forward with a ruler, loyal courtiers and rivals who keep what they knew', () => {
    const { world, state } = newGame(1492);
    for (let i = 0; i < 20; i++) endTurn(world, state);
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    for (const k of ['flags', 'pending', 'dynasty', 'eraPath', 'land']) delete old[k];
    for (const p of old.people as Record<string, unknown>[]) for (const k of ['loyalty', 'memory', 'bonds', 'want']) delete p[k];
    for (const r of Object.values(old.rivals as Record<string, Record<string, unknown>>)) { delete r.learning; delete r.volta; }
    for (const st of Object.values(old.natives as Record<string, Record<string, unknown>>)) delete st.pact;
    old.events = [];
    const r = readSave({ ...wrap(state), saveVersion: 16, state: old });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.dynasty.ruler.name).toBeTruthy();
    expect(r.state.people.every((p) => p.loyalty === 60)).toBe(true);
    expect(r.state.rivals.portugal.volta).toBe(true);
    for (let i = 0; i < 30; i++) { endTurn(world, r.state); while (r.state.events.length) { if (r.state.events[0].choices) chooseStory(world, r.state, 0); else r.state.events.shift(); } }
    expect(r.state.turn).toBeGreaterThan(state.turn);
  });
});
