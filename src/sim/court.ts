/** People at court: who they are, what they are good at, and how long they live. */
import { RANK_INFO } from '../data/court';
import { type Rng, int, pick, range, shuffle } from './rng';
import { explorerName } from './names';
import { crownSpec, type CrownId } from '../data/rivals';
import { SKILLS, yearOf, type Fleet, type GameState, type Person, type Skill, type TraitId } from './types';

const TRAITS: TraitId[] = ['learned', 'hardy', 'bold', 'shrewd', 'pious', 'ambitious'];

/** A new person, strong in one or two skills. */
export function makePerson(rng: Rng, id: number, year: number, taken: string[], focus?: Skill, crown: CrownId = 'spain', city = 'seville'): Person {
  const skills = Object.fromEntries(SKILLS.map((k) => [k, int(rng, 0, 2)])) as Record<Skill, number>;
  const main = focus ?? pick(rng, SKILLS);
  skills[main] = int(rng, 3, 5);
  if (rng() < 0.5) {
    const second = pick(rng, SKILLS.filter((k) => k !== main));
    skills[second] = Math.max(skills[second], int(rng, 2, 4));
  }
  return {
    id, name: explorerName(rng, taken, crown), born: year - int(rng, 21, 52), skills, trait: pick(rng, TRAITS),
    rank: 'courtier', ready: 0, unitType: null, fleet: null, city, alive: true, discoveries: 0,
    loyalty: int(rng, 50, 70), memory: [], bonds: [], want: null,
  };
}

/** Nine people at court in 1492, so every skill has someone worth sending. */
export function initialCourt(rng: Rng, nextId: () => number, year: number, crown: CrownId = 'spain', city = 'seville', extra = 0): Person[] {
  const base: Skill[] = ['navigation', 'navigation', 'commerce', 'commerce', 'construction', 'diplomacy', 'military', 'military', 'navigation'];
  const more: Skill[] = ['diplomacy', 'commerce', 'construction'];
  const focus: Skill[] = shuffle(rng, [...base, ...more.slice(0, extra)]);
  const people: Person[] = [];
  for (const f of focus) people.push(makePerson(rng, nextId(), year, people.map((p) => p.name), f, crown, city));
  bondCourt(rng, people);
  return people;
}

export const ageOf = (p: Person, turn: number) => yearOf(turn) - p.born;
export const personById = (s: GameState, id: number | null | undefined) => (id == null ? undefined : s.people.find((p) => p.id === id));
export const leaderOf = (s: GameState, f: Fleet) => personById(s, f.leader);

/** Effective skill, counting traits. */
export function skill(p: Person | undefined, k: Skill): number {
  if (!p) return 0;
  return p.skills[k] + (k === 'commerce' && p.trait === 'shrewd' ? 1 : 0);
}

export const salary = (p: Person) => RANK_INFO[p.rank].salary * (p.trait === 'ambitious' ? 1.5 : 1);

export function hireCost(p: Person): number {
  const total = Object.values(p.skills).reduce((a, b) => a + b, 0);
  return 150 + total * 55;
}

/** A yearly chance of death, rising with age. */
export function deathChance(p: Person, turn: number): number {
  const age = ageOf(p, turn);
  let c = age < 40 ? 0.006 : age < 55 ? 0.012 + (age - 40) * 0.004 : 0.075 + (age - 55) * 0.02;
  if (p.trait === 'hardy') c *= 0.5;
  return Math.min(0.6, c);
}

/** New people asking for a place at court each spring. */
export function newPetitioners(s: GameState, rng: Rng, nextId: () => number) {
  s.petitioners = s.petitioners.filter(() => rng() < 0.5); // some lose patience
  const n = int(rng, 1, 2);
  for (let k = 0; k < n && s.petitioners.length < 4; k++) {
    const taken = [...s.people.map((p) => p.name), ...s.petitioners.map((x) => x.person.name)];
    const person = makePerson(rng, nextId(), yearOf(s.turn), taken, undefined, s.crown, crownSpec(s.crown).home);
    person.born = yearOf(s.turn) - int(rng, 19, 40);
    // a court with a great name draws better people
    if (rng() < Math.min(0.6, Math.max(0, s.prestige) / 200)) { const best = [...SKILLS].sort((a, b) => person.skills[b] - person.skills[a])[0]; person.skills[best] = Math.min(5, person.skills[best] + 1); }
    s.petitioners.push({ person, cost: Math.round(hireCost(person) * range(rng, 0.85, 1.15)) });
  }
}

// ---------- what courtiers remember, want and feel ----------

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const surname = (name: string) => name.split(' ').slice(-1)[0];

/** Add to what a courtier remembers of you; their loyalty moves with it. */
export function recallDeed(s: GameState, p: Person, amount: number, why: string) {
  const m = p.memory.find((x) => x.why === why);
  if (m) { m.amount += amount; m.turn = s.turn; } else p.memory.push({ why, amount, turn: s.turn });
  p.loyalty = clamp(p.loyalty + amount);
}

const tie = (a: Person, b: Person, kind: 'rival' | 'friend' | 'kin') => {
  if (a === b || a.bonds.some((x) => x.with === b.id)) return;
  a.bonds.push({ with: b.id, kind }); b.bonds.push({ with: a.id, kind });
};
/** The court as it starts: those of one family are kin, and there is an old rivalry and an old friendship. */
export function bondCourt(rng: Rng, people: Person[]) {
  for (const a of people) for (const b of people) if (a.id < b.id && surname(a.name) === surname(b.name)) tie(a, b, 'kin');
  if (people.length < 4) return;
  const free = shuffle(rng, people.filter((p) => !p.bonds.length));
  if (free.length >= 2) tie(free[0], free[1], 'rival');
  if (free.length >= 4) tie(free[2], free[3], 'friend');
}

/** Someone was raised: their rivals resent it, their friends and kin are glad. */
export function onPromotion(s: GameState, p: Person) {
  recallDeed(s, p, 6, 'Given a commission');
  if (p.want?.kind === 'rank') p.want = null;
  for (const b of p.bonds) {
    const o = personById(s, b.with);
    if (!o?.alive) continue;
    if (b.kind === 'rival') recallDeed(s, o, -5, `You raised their rival ${p.name}`);
    else recallDeed(s, o, 3, `You raised their ${b.kind === 'kin' ? 'kinsman' : 'friend'} ${p.name}`);
  }
}

export const COURT = {
  /** where loyalty rests with nothing remembered */
  rest: 55,
  /** seasons a want may go unanswered before it is held against you */
  patience: 8,
  /** at or under this, a courtier listens to offers from abroad */
  leaving: 20,
};

/**
 * Each spring: old deeds fade, wants are born, met or resented, and loyalty settles toward what is
 * remembered. Returns those disloyal enough to be courted by a rival crown.
 */
export function courtYear(s: GameState, rng: Rng): Person[] {
  const leaving: Person[] = [];
  const leads = (p: Person) => p.fleet != null || s.parties.some((x) => x.leader === p.id);
  for (const p of s.people) {
    if (!p.alive) continue;
    for (const m of p.memory) m.amount *= 0.8;
    p.memory = p.memory.filter((m) => Math.abs(m.amount) >= 1);
    const total = Object.values(p.skills).reduce((a, b) => a + b, 0);
    if (!p.want) {
      if (p.rank === 'courtier' && (p.trait === 'ambitious' || total >= 9) && rng() < 0.35) p.want = { kind: 'rank', since: s.turn };
      else if ((p.rank === 'explorer' || p.rank === 'merchant') && p.ready === 0 && !leads(p) && rng() < 0.5) p.want = { kind: 'command', since: s.turn };
    } else {
      const met = p.want.kind === 'rank' ? p.rank !== 'courtier' : leads(p) || p.rank === 'governor';
      if (met) { recallDeed(s, p, 8, p.want.kind === 'rank' ? 'Given a commission' : 'Given a command'); p.want = null; }
      else if (s.turn - p.want.since >= COURT.patience) recallDeed(s, p, -6, p.want.kind === 'rank' ? 'Passed over for a commission' : 'Left ashore without a command');
    }
    if (s.treasury < 0) recallDeed(s, p, -3, 'Wages paid late');
    const target = clamp(COURT.rest + p.memory.reduce((t, m) => t + m.amount, 0));
    p.loyalty = Math.round(p.loyalty + (target - p.loyalty) * 0.35);
    if (p.loyalty <= COURT.leaving && !leads(p)) leaving.push(p);
  }
  return leaving;
}

/** A few lines on someone's life, from what the chronicle says of them. */
export function biography(s: GameState, p: Person): string[] {
  const out = [`Born in ${p.born}${p.died != null ? `, died in ${yearOf(p.died)}, aged ${yearOf(p.died) - p.born}` : ''}.`];
  if (p.discoveries) out.push(`Credited with ${p.discoveries} discover${p.discoveries === 1 ? 'y' : 'ies'}.`);
  const first = p.name.split(' ')[0];
  const lines = s.chronicle.filter((c) => c.text.includes(p.name) || (c.kind === 'discovery' && c.text.includes(`${first} `))).slice(-5);
  for (const c of lines) out.push(`${yearOf(c.turn)}: ${c.text}`);
  return out;
}
