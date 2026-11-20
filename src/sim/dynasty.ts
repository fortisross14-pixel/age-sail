/**
 * The ruling house: a monarch who ages and dies, a consort, heirs, regencies, successions and
 * marriages with the other realms of Europe. Also what the ruler and the era's path do for the
 * realm (`realmMods`), which the rest of the rules read.
 */
import { HOUSES, DYNASTY, MATCH_NAMES, ROMAN, type Gift, type RoyalSeed } from '../data/dynasty';
import { ERA_PATHS, ERA_REWARD, ERAS, eraAt, type EraPath } from '../data/eras';
import { REALMS, realmSpec, type RealmId } from '../data/realms';
import type { CrownId } from '../data/rivals';
import { mulberry32, hashSeed, int, pick, type Rng } from './rng';
import { score } from './colony';
import { yearOf, seasonOf, type Dynasty, type GameEvent, type GameState, type MarriageOffer, type Royal, type World } from './types';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ev = (e: GameEvent) => void;
export type Result = { ok: true; message?: string } | { ok: false; error: string };

const GIFTS: Gift[] = ['navigation', 'military', 'commerce', 'construction', 'diplomacy'];
const royal = (seed: RoyalSeed, id: number): Royal => ({ id, name: seed.name, numeral: seed.numeral, sex: seed.sex, born: seed.born, gift: seed.gift });

/** The house as it stood in 1492. */
export function initialDynasty(crown: CrownId, nextId: () => number): Dynasty {
  const h = HOUSES[crown];
  const ruler = royal(h.ruler, nextId());
  return {
    house: h.house, ruler, consort: h.consort ? royal(h.consort, nextId()) : null, heirs: h.heirs.map((x) => royal(x, nextId())),
    regency: 1492 - ruler.born < DYNASTY.ofAge, reigns: [{ name: styled(crown, ruler), from: 1492, to: null }],
    counts: { ...h.before }, offers: [], ties: [],
  };
}

/** A house for a voyage saved before there was one: a ruler in their prime, named from the seed. */
export function dynastyFor(crown: CrownId, seed: number, turn: number): Dynasty {
  const h = HOUSES[crown];
  const rng = mulberry32(hashSeed(seed, 4711));
  const sex = rng() < 0.75 ? 'm' : 'f';
  const name = pick(rng, h.names[sex]);
  const counts = { ...h.before };
  counts[name] = (counts[name] ?? 0) + 1;
  const ruler: Royal = { id: -1, name, numeral: counts[name], sex, born: yearOf(turn) - int(rng, 28, 40), gift: pick(rng, GIFTS) };
  return { house: h.house, ruler, consort: null, heirs: [], regency: false, reigns: [{ name: styled(crown, ruler), from: yearOf(turn), to: null }], counts, offers: [], ties: [] };
}

export const titleOf = (crown: CrownId, r: Royal) => HOUSES[crown].titles[r.sex === 'm' ? 0 : 1];
/** "Queen Isabel I" */
export const styled = (crown: CrownId, r: Royal) => `${titleOf(crown, r)} ${r.name}${r.numeral ? ` ${ROMAN(r.numeral)}` : ''}`;
export const royalAge = (r: Royal, turn: number) => yearOf(turn) - r.born;
/** The next in line: the eldest living heir. */
export const heirOf = (d: Dynasty): Royal | undefined => [...d.heirs].sort((a, b) => a.born - b.born)[0];

// ---------- what the ruler and the age do for the realm ----------

export const eraPathOf = (s: GameState): EraPath | undefined => (s.eraPath ? ERA_PATHS[s.eraPath.era]?.find((p) => p.id === s.eraPath!.path) : undefined);

/** Lasting advantages: the ruler's gift (none under a regent) and the path chosen for the era. */
export function realmMods(s: GameState) {
  const m = { taxes: 1, research: 0, upkeep: 1, loyalty: 0, regard: 0 };
  const gift = s.dynasty.regency ? null : s.dynasty.ruler.gift;
  if (gift === 'commerce') m.taxes *= 1.08;
  if (gift === 'navigation') m.research += 1;
  if (gift === 'military') m.upkeep *= 0.85;
  if (gift === 'construction') m.loyalty += 5;
  if (gift === 'diplomacy') m.regard += 10;
  if (s.dynasty.regency) { m.taxes *= 0.92; m.loyalty -= 5; }
  const p = eraPathOf(s)?.mod;
  if (p) { m.taxes *= p.taxes ?? 1; m.research += p.research ?? 0; m.upkeep *= p.upkeep ?? 1; m.loyalty += p.loyalty ?? 0; }
  return m;
}

const measure = (w: World, s: GameState, kind: EraPath['goal']['kind']) => {
  const sc = score(s, w);
  return kind === 'revenue' ? s.revenue : kind === 'colonists' ? sc.pop : kind === 'territory' ? sc.territory : s.prestige;
};
export const GOAL_WORD: Record<EraPath['goal']['kind'], string> = { revenue: 'ducats of sales', colonists: 'colonists overseas', prestige: 'prestige', territory: 'hexes of territory' };
/** How far the era's goal has come. */
export function eraProgress(w: World, s: GameState) {
  const p = eraPathOf(s);
  return p && s.eraPath ? { path: p, have: Math.max(0, Math.round(measure(w, s, p.goal.kind) - s.eraPath.base)), need: p.goal.need } : null;
}

/** The era ends: was its goal met? */
export function judgeEra(w: World, s: GameState, log: Log) {
  const pr = eraProgress(w, s);
  if (!pr) return;
  const era = ERAS.find((e) => e.id === s.eraPath!.era);
  if (pr.have >= pr.need) { s.prestige += ERA_REWARD; log('court', `The ${era?.name ?? 'age'} closes with its promise kept: ${pr.path.name.toLowerCase()} brought ${pr.have.toLocaleString('en-US')} ${GOAL_WORD[pr.path.goal.kind]}. +${ERA_REWARD} prestige.`); }
  else log('court', `The ${era?.name ?? 'age'} closes with its promise unkept: ${pr.path.name.toLowerCase()} asked for ${pr.need.toLocaleString('en-US')} ${GOAL_WORD[pr.path.goal.kind]}, and brought ${pr.have.toLocaleString('en-US')}.`);
  s.eraPath = null;
}

/** The card that opens an era: three paths, one choice. */
export function eraCard(eraId: string, hex: number): GameEvent | null {
  const era = ERAS.find((e) => e.id === eraId), paths = ERA_PATHS[eraId];
  if (!era || !paths) return null;
  return {
    kind: 'story', story: `era:${eraId}`, family: 'eras', ctx: {}, title: era.name, map: 'old', hex,
    text: `${era.blurb} Your council asks what this age shall be for.`,
    choices: paths.map((p) => ({ label: p.name, hint: `${p.blurb} Goal: ${p.goal.need.toLocaleString('en-US')} more ${GOAL_WORD[p.goal.kind]} before the age ends.` })),
  };
}

export function chooseEraPath(w: World, s: GameState, eraId: string, index: number): string {
  const p = ERA_PATHS[eraId]?.[index];
  if (!p) return '';
  s.eraPath = { era: eraId, path: p.id, base: measure(w, s, p.goal.kind) };
  return `The age will be remembered for ${p.name.toLowerCase()}.`;
}

// ---------- the years pass ----------

function deathChance(age: number, frail = 0) {
  const a = age + frail;
  return Math.min(0.6, a < 12 ? DYNASTY.childDeath : a < 40 ? 0.005 : a < 55 ? 0.012 + (a - 40) * 0.004 : 0.075 + (a - 55) * 0.02);
}

function child(s: GameState, rng: Rng): Royal {
  const h = HOUSES[s.crown];
  const sex = rng() < 0.5 ? 'm' : 'f';
  const taken = s.dynasty.heirs.map((x) => x.name);
  const free = h.names[sex].filter((n) => !taken.includes(n));
  return { id: s.nextId++, name: pick(rng, free.length ? free : h.names[sex]), sex, born: yearOf(s.turn), gift: pick(rng, GIFTS) };
}

/** The heir takes the throne, or, with no heir, a cousin does and the realm pays for the doubt. */
function succeed(w: World, s: GameState, rng: Rng, log: Log, ev: Ev, hex: number) {
  const d = s.dynasty, old = d.ruler, year = yearOf(s.turn);
  const last = d.reigns[d.reigns.length - 1];
  if (last) last.to = year;
  const heir = heirOf(d);
  const next: Royal = heir ?? { ...child(s, rng), born: year - int(rng, 24, 40) };
  d.heirs = d.heirs.filter((x) => x !== heir);
  d.counts[next.name] = (d.counts[next.name] ?? 0) + 1;
  next.numeral = d.counts[next.name];
  d.ruler = next;
  d.consort = null;
  d.ties = [];
  d.offers = [];
  d.regency = royalAge(next, s.turn) < DYNASTY.ofAge;
  const name = styled(s.crown, next);
  d.reigns.push({ name, from: year, to: null });
  const was = styled(s.crown, old);
  let text: string;
  if (!heir) {
    s.prestige -= 25;
    for (const c of s.colonies) c.loyalty = Math.max(0, c.loyalty - 12);
    for (const p of s.people) if (p.alive) p.loyalty = Math.max(0, p.loyalty - 10);
    text = `${was} has died, aged ${year - old.born}, leaving no heir of the body. After weeks of argument the estates acclaim a cousin of the house of ${d.house}: ${name}. Half the court doubts the claim, and the colonies hear of it with unease.`;
  } else if (d.regency) {
    text = `${was} has died, aged ${year - old.born}. The crown passes to a child: ${name}, ${royalAge(next, s.turn)} years old. A regent will govern until ${next.sex === 'm' ? 'he' : 'she'} is ${DYNASTY.ofAge}; taxes come in slower and the colonies are less sure of you.`;
  } else {
    text = `${was} has died, aged ${year - old.born}. ${name}, ${royalAge(next, s.turn)} years old, is crowned. ${GIFT_TEXT[next.gift]}`;
  }
  log('court', `${was} has died. ${name} reigns.`);
  ev({ kind: 'story', story: 'succession', family: 'dynasty', ctx: {}, title: `${titleOf(s.crown, old) === 'Queen' ? 'The Queen' : `The ${titleOf(s.crown, old)}`} is dead`, text, map: 'old', hex, choices: [{ label: `Long live the ${titleOf(s.crown, next)}` }] });
  void w;
}

const GIFT_TEXT: Record<Gift, string> = {
  navigation: 'The new reign favours pilots and scholars.',
  military: 'The new reign will be a soldier’s.',
  commerce: 'The new reign will count every ducat.',
  construction: 'The new reign means to build.',
  diplomacy: 'The new reign looks for friends abroad.',
};

/** Each spring: ages, births, deaths, the end of a regency, and new offers of marriage. */
export function dynastySeason(w: World, s: GameState, log: Log, ev: Ev, hex: number) {
  if (seasonOf(s.turn) !== 0) return;
  const d = s.dynasty;
  const rng = mulberry32(hashSeed(s.seed, s.turn, 311));
  const year = yearOf(s.turn);
  if (d.regency && royalAge(d.ruler, s.turn) >= DYNASTY.ofAge) {
    d.regency = false;
    log('court', `${styled(s.crown, d.ruler)} comes of age and rules alone. ${GIFT_TEXT[d.ruler.gift]}`);
  }
  for (const h of [...d.heirs]) {
    if (rng() >= deathChance(year - h.born, h.frail)) continue;
    d.heirs = d.heirs.filter((x) => x !== h);
    log('court', `${h.sex === 'm' ? 'Prince' : 'Princess'} ${h.name} has died, aged ${year - h.born}.`);
  }
  if (d.consort && rng() < deathChance(year - d.consort.born)) {
    log('court', `${d.consort.name}, consort of ${styled(s.crown, d.ruler)}, has died.`);
    if (d.consort.from) d.ties = d.ties.filter((t) => t !== d.consort!.from);
    d.consort = null;
  }
  if (d.consort && d.heirs.length < DYNASTY.maxHeirs) {
    const mother = d.ruler.sex === 'f' ? d.ruler : d.consort;
    if (year - mother.born < DYNASTY.fertileUntil && year - mother.born >= 16 && rng() < DYNASTY.birth) {
      const c = child(s, rng);
      d.heirs.push(c);
      log('court', `A ${c.sex === 'm' ? 'son' : 'daughter'} is born to ${styled(s.crown, d.ruler)}: ${c.name}. Bells ring in every city of the realm.`);
    }
  }
  if (rng() < deathChance(year - d.ruler.born, d.ruler.frail)) { succeed(w, s, rng, log, ev, hex); return; }
  // envoys with portraits: offers come while the ruler is of age and unmarried
  if (!d.consort && !d.regency && year % DYNASTY.offersEvery === 0) {
    const realms = REALMS.filter((r) => r.id !== s.crown && MATCH_NAMES[r.id]);
    const want = d.ruler.sex === 'm' ? 'f' : 'm';
    d.offers = [];
    for (let k = 0; k < DYNASTY.offers && realms.length; k++) {
      const r = realms.splice(int(rng, 0, realms.length - 1), 1)[0];
      const [lo, hi] = DYNASTY.dowry;
      d.offers.push({ id: s.nextId++, realm: r.id, name: pick(rng, MATCH_NAMES[r.id]![want]), sex: want, born: year - int(rng, 16, 28), gift: pick(rng, GIFTS), dowry: Math.round((int(rng, lo, hi) * (1 + Math.max(0, s.prestige) / 100)) / 50) * 50 });
    }
    if (d.offers.length) log('court', `Envoys bring offers of marriage for ${styled(s.crown, d.ruler)}. See Court, Dynasty.`);
  }
}

/** Accept an offer: a consort, a dowry, and a tie to their realm. */
export function marry(s: GameState, offerId: number, log: Log): Result {
  const d = s.dynasty;
  const o = d.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, error: 'That offer is no longer open.' };
  if (d.consort) return { ok: false, error: `${styled(s.crown, d.ruler)} is already married.` };
  if (d.regency) return { ok: false, error: 'The regent will arrange no marriage until the ruler is of age.' };
  d.consort = { id: s.nextId++, name: o.name, sex: o.sex, born: o.born, gift: o.gift, from: o.realm };
  d.offers = [];
  d.ties.push(o.realm);
  s.treasury += o.dowry;
  s.prestige += 10;
  const rival = s.rivals[o.realm as CrownId];
  if (rival && o.realm !== s.crown) { rival.attitude = Math.min(100, rival.attitude + 35); if (rival.relation === 'war') { rival.relation = 'peace'; rival.warSince = null; } }
  const realm = realmSpec(o.realm as RealmId).name;
  log('court', `${styled(s.crown, d.ruler)} marries ${o.name} of ${realm}. The dowry is ${o.dowry.toLocaleString('en-US')} ducats, and the two houses are bound together.`);
  return { ok: true, message: `A royal wedding: ${o.name} of ${realm}. +${o.dowry.toLocaleString('en-US')} ducats, +10 prestige.` };
}

/** Is this realm bound to yours by a marriage? Its merchants give you better terms. */
export const tiedTo = (s: GameState, realm: string | undefined) => !!realm && s.dynasty.ties.includes(realm);
export const offerText = (o: MarriageOffer, turn: number) => `${o.name} of ${realmSpec(o.realm as RealmId).name}, ${yearOf(turn) - o.born}`;
export { eraAt };
