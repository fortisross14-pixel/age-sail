import { isMilitary } from '../data/army';
import type { Colony, GameState } from '../sim/types';

/** Which colony drawing fits: a fort, a mission, a mine, a plantation, a trading post, or a plain port. */
export function colonyKind(s: GameState, c: Colony): string {
  const units = s.units.filter((u) => u.colony === c.id);
  if (units.some((u) => isMilitary(u.type))) return 'fort';
  if (units.some((u) => u.type === 'missionary')) return 'mission';
  const p = c.last.produced;
  const v = (k: string[]) => k.reduce((t, g) => t + ((p as Record<string, number>)[g] ?? 0), 0);
  if (v(['gold', 'silver']) > 0) return 'mine';
  if (v(['sugar', 'tobacco', 'cacao']) >= 2) return 'plantation';
  if (v(['furs', 'dyes', 'spices']) >= 2) return 'trading-post';
  return 'port';
}
