/**
 * Battles on land, fought out automatically in three rounds: fire, melee, pursuit. Each side is a
 * force of companies (or native warriors), led perhaps by a general, perhaps behind walls, on a
 * terrain. Morale decides who breaks; the winner's horsemen decide how many of the broken escape.
 */
import { COMBAT, WARRIOR, BATTLE, WALLS, BREACH, isMilitary } from '../data/army';
import { T, TERRAIN_INFO } from '../data/terrain';
import { mulberry32, hashSeed, type Rng } from './rng';
import { skill, personById } from './court';
import { crownSpec } from '../data/rivals';
import type { BattleReport, BattleSide, Colony, GameState, Party, Person, Stance, Unit, UnitType } from './types';

/** One side going into battle. */
export interface Force {
  name: string;
  units: Pick<Unit, 'type' | 'vet'>[];
  /** native warriors */
  warriors?: number;
  empire?: boolean;
  /** a people who have not yet faced firearms */
  natives?: boolean;
  general?: Person;
  walls?: number;
  crown?: BattleSide['crown'];
  nation?: string;
}

const ROUGH = new Set<number>([T.Forest, T.Jungle, T.Taiga, T.Hills, T.Mountains, T.Marsh]);
const OPEN = new Set<number>([T.Plains, T.Savanna, T.Desert]);

interface Power { fire: number; shock: number; hp: number; pursuit: number; firearms: boolean }

function power(f: Force, enemy: Force, terrain: number, defending: boolean): Power {
  const rough = ROUGH.has(terrain);
  const open = OPEN.has(terrain);
  const enemyAll = enemy.units.length + (enemy.warriors ?? 0);
  const enemyHorse = enemyAll ? enemy.units.filter((u) => u.type === 'cavalry').length / enemyAll : 0;
  let fire = 0, shock = 0, hp = 0, pursuit = 0, firearms = false;
  for (const u of f.units) {
    const c = COMBAT[u.type];
    const vet = 1 + BATTLE.veteran * (u.vet ?? 0);
    const terr = c.open && rough ? BATTLE.roughPenalty : u.type === 'cavalry' && open ? BATTLE.openBonus : 1;
    const pike = c.antiHorse ? 1 + (BATTLE.antiHorse - 1) * enemyHorse * 2 : 1;
    fire += c.fire * vet * terr;
    shock += c.shock * vet * terr * pike;
    hp += c.hp * vet;
    pursuit += c.pursuit * vet * terr;
    if (c.firearms) firearms = true;
  }
  if (f.warriors) {
    const w = f.warriors;
    fire += WARRIOR.fire * w;
    shock += (f.empire ? WARRIOR.empireShock : WARRIOR.shock) * w;
    hp += (f.empire ? WARRIOR.empireHp : WARRIOR.hp) * w;
    pursuit += WARRIOR.pursuit * w;
  }
  const g = f.general ? 1 + BATTLE.generalSkill * skill(f.general, 'military') : 1;
  const bold = f.general?.trait === 'bold' ? 1.15 : 1;
  fire *= g; shock *= g * bold; pursuit *= g;
  if (defending) {
    if (rough) hp *= BATTLE.roughDefence;
    const w = f.walls ?? 0;
    if (w > 0) {
      const guns = enemy.units.filter((u) => COMBAT[u.type].breach).length;
      const left = Math.max(0, 1 - (BREACH * guns) / w);
      hp *= 1 + WALLS[w].hp * left;
      fire *= 1 + WALLS[w].fire * left;
    }
  }
  return { fire, shock, hp: Math.max(0.5, hp), pursuit, firearms };
}

export interface Outcome {
  attackerWon: boolean;
  /** shares of each side lost, 0..1 */
  atkLoss: number;
  defLoss: number;
  report: BattleReport;
}

/** Fight it out. The report's unit losses are filled in by `casualties`. */
export function fight(rng: Rng, a: Force, d: Force, terrain: number, stance: Stance = 'assault'): Outcome {
  const A = power(a, d, terrain, false);
  const D = power(d, a, terrain, true);
  const st = BATTLE[stance];
  const luck = () => BATTLE.damage * (1 + (rng() * 2 - 1) * BATTLE.luck);
  let lostA = 0, lostD = 0;
  let mA = 100 + 5 * skill(a.general, 'military');
  let mD = 100 + 5 * skill(d.general, 'military');
  const rounds: BattleReport['rounds'] = [];
  const exchange = (name: 'Fire' | 'Melee', key: 'fire' | 'shock') => {
    const leftA = Math.max(0, 1 - lostA / A.hp), leftD = Math.max(0, 1 - lostD / D.hp);
    const toD = A[key] * leftA * st.hit * luck();
    const toA = D[key] * leftD * st.take * luck();
    lostD += toD; lostA += toA;
    const fright = (side: Force, enemy: Power) => (side.natives && enemy.firearms && key === 'fire' ? BATTLE.firearmsMorale : 1);
    mD -= (toD / D.hp) * BATTLE.moraleLoss * fright(d, A);
    mA -= (toA / A.hp) * BATTLE.moraleLoss * fright(a, D);
    rounds.push({ name, atk: round1(toD), def: round1(toA) });
  };
  exchange('Fire', 'fire');
  exchange('Melee', 'shock');
  // the side with less heart left gives way; the attacker must break the defender to win
  const attackerWon = mD < mA && (mD < BATTLE.breaks || lostD >= lostA * 0.8);
  const leftW = attackerWon ? Math.max(0, 1 - lostA / A.hp) : Math.max(0, 1 - lostD / D.hp);
  const chase = (attackerWon ? A.pursuit : D.pursuit) * leftW * luck();
  if (attackerWon) lostD += chase; else lostA += chase * 0.6; // a beaten attacker falls back in order more often than a broken defender
  rounds.push({ name: 'Pursuit', atk: attackerWon ? round1(chase) : 0, def: attackerWon ? 0 : round1(chase * 0.6) });
  const atkLoss = Math.min(1, lostA / A.hp);
  const defLoss = Math.min(1, lostD / D.hp);
  const side = (f: Force): BattleSide => ({
    name: f.name, general: f.general?.id, crown: f.crown, nation: f.nation, walls: f.walls,
    units: tally(f.units),
    ...(f.warriors ? { warriors: { n: Math.round(f.warriors), lost: 0 } } : {}),
  });
  return {
    attackerWon, atkLoss, defLoss,
    report: {
      attacker: side(a), defender: side(d), rounds,
      morale: { atk: Math.max(0, Math.round(mA)), def: Math.max(0, Math.round(mD)) },
      attackerWon, stance, terrain: TERRAIN_INFO[terrain as T]?.name ?? 'open ground',
    },
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function tally(units: Pick<Unit, 'type'>[]): BattleSide['units'] {
  const out: BattleSide['units'] = [];
  for (const u of units) {
    const o = out.find((x) => x.type === u.type);
    if (o) o.n++; else out.push({ type: u.type, n: 1, lost: 0 });
  }
  return out;
}

/**
 * Who falls: a share of the companies, chosen at random but the weakest more often, rounded by
 * chance so a small loss on a small force still means something.
 */
export function casualties<U extends Pick<Unit, 'type'>>(rng: Rng, units: U[], share: number): U[] {
  const want = units.length * share;
  let n = Math.floor(want) + (rng() < want - Math.floor(want) ? 1 : 0);
  n = Math.min(units.length, n);
  const order = [...units].sort((x, y) => COMBAT[x.type].hp - COMBAT[y.type].hp + (rng() - 0.5) * 3);
  return order.slice(0, n);
}

/** Fill the report's losses from the companies that fell. */
export function recordLosses(side: BattleSide, dead: Pick<Unit, 'type'>[], warriorsLost = 0) {
  for (const u of dead) { const o = side.units.find((x) => x.type === u.type); if (o) o.lost++; }
  if (side.warriors) side.warriors.lost = Math.round(warriorsLost);
}

/** Survivors of a won battle gain a veteran rank (soldiers only, at most two). */
export function blood(units: Unit[]) {
  for (const u of units) if (isMilitary(u.type)) u.vet = Math.min(2, (u.vet ?? 0) + 1);
}

/** The chance the attacker wins, from many quiet rehearsals of the battle (the same every time for the same armies). */
export function battleOdds(a: Force, d: Force, terrain: number, stance: Stance = 'assault', tries = 80): number {
  const key = hashSeed(a.units.length, Math.round((a.warriors ?? 0) * 10), d.units.length, Math.round((d.warriors ?? 0) * 10), terrain, d.walls ?? 0, stance === 'assault' ? 1 : 2);
  const rng = mulberry32(key);
  let wins = 0;
  for (let k = 0; k < tries; k++) if (fight(rng, a, d, terrain, stance).attackerWon) wins++;
  return wins / tries;
}

/** A party ashore as an army: its companies and its leader as general. */
export function partyForce(s: GameState, p: Party): Force {
  return { name: crownSpec(s.crown).name, units: s.units.filter((u) => u.party === p.id), general: personById(s, p.leader), crown: s.crown };
}

/** A colony's defenders: its garrison, its settlers with whatever they can grab, and its walls. */
export function colonyForce(s: GameState, c: Colony): Force {
  const garrison = s.units.filter((u) => u.colony === c.id);
  const settlers = Array.from({ length: c.pop }, () => ({ type: 'colonist' as const, vet: 0 }));
  return { name: `${c.name} (${crownSpec(s.crown).name})`, units: [...garrison, ...settlers], walls: c.walls ?? 0, crown: s.crown };
}

/** An attack on one of your colonies: the garrison and settlers stand behind the walls. */
export function assaultColony(s: GameState, c: Colony, enemy: Force, terrain: number, rng: Rng) {
  const out = fight(rng, enemy, colonyForce(s, c), terrain, 'assault');
  const garrison = s.units.filter((u) => u.colony === c.id);
  const share = out.defLoss;
  const fallen = casualties(rng, garrison, share);
  s.units = s.units.filter((u) => !fallen.includes(u));
  if (!out.attackerWon) blood(garrison.filter((u) => !fallen.includes(u)));
  // settlers die in proportion, a little less than soldiers who stand in front
  const settlers = Math.round(c.pop * share * 0.7);
  return { win: out.attackerWon, lost: out.atkLoss, soldiers: fallen.length, settlers, garrison: garrison.length > 0, report: out.report };
}

/** A force's units as types, for the report or a preview. */
export const forceOf = (name: string, units: Pick<Unit, 'type' | 'vet'>[], extra: Partial<Force> = {}): Force => ({ name, units, ...extra });

/** Companies of a rival garrison: pikes and arquebuses, more arquebuses as the age goes on. */
export function rivalGarrison(garrison: number, pop: number, year: number): Pick<Unit, 'type' | 'vet'>[] {
  const guns = year >= 1530 ? Math.floor(garrison / 2) : 0;
  const out: Pick<Unit, 'type' | 'vet'>[] = [];
  for (let k = 0; k < garrison; k++) out.push({ type: k < guns ? 'musketeer' : 'infantry', vet: 0 });
  for (let k = 0; k < pop; k++) out.push({ type: 'colonist', vet: 0 });
  return out;
}

export type { UnitType };
