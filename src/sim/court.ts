/** People at court: who they are, what they are good at, and how long they live. */
import { RANK_INFO } from '../data/court';
import { type Rng, int, pick, range, shuffle } from './rng';
import { explorerName } from './names';
import { SKILLS, yearOf, type Fleet, type GameState, type Person, type Skill, type TraitId } from './types';

const TRAITS: TraitId[] = ['learned', 'hardy', 'bold', 'shrewd', 'pious', 'ambitious'];

/** A new person, strong in one or two skills. */
export function makePerson(rng: Rng, id: number, year: number, taken: string[], focus?: Skill): Person {
  const skills = Object.fromEntries(SKILLS.map((k) => [k, int(rng, 0, 2)])) as Record<Skill, number>;
  const main = focus ?? pick(rng, SKILLS);
  skills[main] = int(rng, 3, 5);
  if (rng() < 0.5) {
    const second = pick(rng, SKILLS.filter((k) => k !== main));
    skills[second] = Math.max(skills[second], int(rng, 2, 4));
  }
  return {
    id, name: explorerName(rng, taken), born: year - int(rng, 21, 52), skills, trait: pick(rng, TRAITS),
    rank: 'courtier', ready: 0, unitType: null, fleet: null, city: 'seville', alive: true, discoveries: 0,
  };
}

/** Nine people at court in 1492, so every skill has someone worth sending. */
export function initialCourt(rng: Rng, nextId: () => number, year: number): Person[] {
  const focus: Skill[] = shuffle(rng, ['navigation', 'navigation', 'commerce', 'commerce', 'construction', 'diplomacy', 'military', 'military', 'navigation']);
  const people: Person[] = [];
  for (const f of focus) people.push(makePerson(rng, nextId(), year, people.map((p) => p.name), f));
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
    const person = makePerson(rng, nextId(), yearOf(s.turn), taken);
    person.born = yearOf(s.turn) - int(rng, 19, 40);
    s.petitioners.push({ person, cost: Math.round(hireCost(person) * range(rng, 0.85, 1.15)) });
  }
}
