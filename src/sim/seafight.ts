/**
 * A fight at sea in three rounds, like a battle on land: gunnery as the ships close, boarding when
 * they touch, and the chase that decides whether the beaten side escapes. Pure: who fights whom,
 * and what follows from the result, is decided by the caller.
 */
import type { CrownId } from '../data/rivals';
import type { Rng } from './rng';

export interface SeaSide { name: string; guns: number; crew: number; speed: number; crown?: CrownId; yours?: boolean }
export interface SeaReport {
  attacker: SeaSide;
  defender: SeaSide;
  /** what each side did to the other in each round */
  rounds: { name: 'Gunnery' | 'Boarding' | 'Chase'; atk: number; def: number }[];
  attackerWon: boolean;
  /** the beaten side got away: damaged, but not taken */
  escaped: boolean;
}

/** Numbers for fights at sea. Provisional. */
export const SEA = { luck: 0.35, boardWeight: 0.8, crewPerPoint: 10 };

export function seaFight(rng: Rng, a: SeaSide, d: SeaSide): SeaReport {
  const luck = () => 1 + (rng() * 2 - 1) * SEA.luck;
  const r1 = { name: 'Gunnery' as const, atk: a.guns * luck(), def: d.guns * luck() };
  // the guns thin the crews before they meet
  const ac = a.crew * (1 - 0.4 * r1.def / (r1.atk + r1.def + 1e-6)), dc = d.crew * (1 - 0.4 * r1.atk / (r1.atk + r1.def + 1e-6));
  const r2 = { name: 'Boarding' as const, atk: (ac / SEA.crewPerPoint) * luck(), def: (dc / SEA.crewPerPoint) * luck() };
  const margin = (r: { atk: number; def: number }) => (r.atk - r.def) / (r.atk + r.def + 1e-6);
  const attackerWon = margin(r1) + SEA.boardWeight * margin(r2) > 0;
  const r3 = { name: 'Chase' as const, atk: a.speed * luck(), def: d.speed * luck() };
  const escaped = attackerWon ? r3.def > r3.atk : r3.atk > r3.def;
  const round = (r: { name: 'Gunnery' | 'Boarding' | 'Chase'; atk: number; def: number }) => ({ name: r.name, atk: Math.round(r.atk * 10) / 10, def: Math.round(r.def * 10) / 10 });
  return { attacker: a, defender: d, rounds: [round(r1), round(r2), round(r3)], attackerWon, escaped };
}
