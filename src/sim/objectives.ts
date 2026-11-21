/**
 * Objectives: the first voyage and your advisers' ambitions. Each is a condition over the game
 * state, checked after every order and every season; meeting one pays its reward once and is
 * written in the chronicle. Words, order and rewards are in `src/data/objectives.ts`.
 */
import { OBJECTIVES, VOYAGE, AMBITIONS, AMBITIONS_AT_ONCE, type ObjectiveDef, type ObjectiveId } from '../data/objectives';
import { difficultySpec } from '../data/difficulty';
import { KNOWN_SOUTH } from '../data/europe';
import { rivalsOf } from '../data/rivals';
import { GRIDS } from './hex';
import { score } from './colony';
import { rivalScore } from './rivals';
import { yearOf, type GameState, type World } from './types';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;

/** How far along an objective is, for those that count something. */
export interface Progress { have: number; need: number }

const explorers = (s: GameState) => s.people.filter((p) => p.alive && p.rank === 'explorer');
const settlers = (s: GameState) => s.colonies.reduce((t, c) => t + c.pop, 0);

const COUNTS: Partial<Record<ObjectiveId, (w: World, s: GameState) => Progress>> = {
  colonies3: (_w, s) => ({ have: s.colonies.length, need: 3 }),
  treasury: (_w, s) => ({ have: Math.max(0, Math.floor(s.treasury)), need: 10000 }),
  settlers25: (_w, s) => ({ have: settlers(s), need: 25 }),
  settlers100: (_w, s) => ({ have: settlers(s), need: 100 }),
  laws3: (_w, s) => ({ have: s.laws.length, need: 3 }),
  subjects20: (_w, s) => ({ have: s.research.known.length, need: 20 }),
  treaties3: (_w, s) => ({ have: Object.values(s.europe).filter((r) => r.treaty !== 'none').length, need: 3 }),
};

const MET: Record<ObjectiveId, (w: World, s: GameState) => boolean> = {
  explorer: (_w, s) => explorers(s).length > 0,
  cargo: (_w, s) => s.fleets.some((f) => Object.values(f.cargo).some((n) => (n ?? 0) > 0)) || s.revenue > 0,
  command: (_w, s) => explorers(s).some((p) => p.fleet != null),
  south: (_w, s) => s.newWorldFound || s.discovered.length > 0 || s.fleets.some((f) => f.map === 'new' || GRIDS.old.lat(f.hex) < KNOWN_SOUTH),
  meet: (_w, s) => Object.values(s.natives).some((n) => n.met),
  sale: (_w, s) => s.revenue > 0,
  ashore: (_w, s) => s.parties.length > 0 || s.finds.length > 0 || s.colonies.length > 0,
  colony: (_w, s) => s.colonies.length > 0,
  route: (_w, s) => s.fleets.some((f) => f.route?.active),
  post: (_w, s) => Object.values(s.natives).some((n) => n.post),
  volta: (_w, s) => s.research.known.includes('volta'),
  crossing: (_w, s) => s.newWorldFound,
  ally: (_w, s) => Object.values(s.natives).some((n) => n.relation === 'allied'),
  factory: (_w, s) => s.factories.some((f) => !s.cities[f.city]),
  university: (_w, s) => Object.values(s.cities).some((c) => c.buildings.university > 0),
  town: (_w, s) => s.colonies.some((c) => c.level !== 'outpost'),
  colonies3: (_w, s) => s.colonies.length >= 3,
  treasury: (_w, s) => s.treasury >= 10000,
  settlers25: (_w, s) => settlers(s) >= 25,
  laws3: (_w, s) => s.laws.length >= 3,
  subjects20: (_w, s) => s.research.known.length >= 20,
  treaties3: (_w, s) => Object.values(s.europe).filter((r) => r.treaty !== 'none').length >= 3,
  city: (_w, s) => s.colonies.some((c) => c.level === 'city'),
  promise: (_w, s) => s.flags.era_kept != null,
  settlers100: (_w, s) => settlers(s) >= 100,
  first: (w, s) => { const mine = score(s, w).total; return mine > 0 && rivalsOf(s.crown).every((r) => rivalScore(s, r.id).total < mine); },
};

export const objectiveDone = (s: GameState, id: ObjectiveId) => s.objectives.done[id] != null;
export const objectiveProgress = (w: World, s: GameState, id: ObjectiveId): Progress | null => COUNTS[id]?.(w, s) ?? null;

/** The first voyage, every step in order, done or not. */
export const voyageSteps = () => VOYAGE;
export const voyageDone = (s: GameState) => VOYAGE.every((o) => objectiveDone(s, o.id));

/** The ambitions your advisers press now: the first few, in order, whose time has come. */
export function activeAmbitions(s: GameState): ObjectiveDef[] {
  return AMBITIONS.filter((o) => !objectiveDone(s, o.id) && (o.after ?? []).every((a) => objectiveDone(s, a)) && (o.fromYear == null || yearOf(s.turn) >= o.fromYear)).slice(0, AMBITIONS_AT_ONCE);
}

/** What is being watched: every step of the first voyage still open, and the active ambitions. */
const watched = (s: GameState) => [...VOYAGE.filter((o) => !objectiveDone(s, o.id)), ...activeAmbitions(s)];

/** What an objective pays at this game's difficulty. */
export function rewardOf(s: GameState, o: ObjectiveDef) {
  return { ducats: Math.round((o.reward.ducats ?? 0) * difficultySpec(s.difficulty).rewards / 10) * 10, prestige: o.reward.prestige ?? 0 };
}

export const rewardText = (r: { ducats: number; prestige: number }) =>
  [r.ducats ? `${r.ducats.toLocaleString('en-US')} ducats` : '', r.prestige ? `${r.prestige} prestige` : ''].filter(Boolean).join(' and ');

/**
 * Mark and reward whatever has been achieved. Returns the objectives completed just now.
 * A save from before objectives existed catches up silently: what is already true is ticked
 * without a reward.
 */
export function checkObjectives(w: World, s: GameState, log: Log): ObjectiveDef[] {
  if (s.objectives.catchUp) {
    for (const o of OBJECTIVES) if (MET[o.id](w, s)) s.objectives.done[o.id] = s.turn;
    delete s.objectives.catchUp;
    return [];
  }
  const out: ObjectiveDef[] = [];
  // finishing one may bring the next ambition forward, already met: look again until nothing changes
  for (let pass = 0; pass < OBJECTIVES.length; pass++) {
    const now = watched(s).filter((o) => MET[o.id](w, s));
    if (!now.length) break;
    for (const o of now) {
      s.objectives.done[o.id] = s.turn;
      const r = rewardOf(s, o);
      s.treasury += r.ducats;
      s.prestige += r.prestige;
      const paid = rewardText(r);
      log('court', `${o.chain === 'voyage' ? 'First voyage' : 'Ambition fulfilled'}: ${o.title.toLowerCase()}.${paid ? ` The court rewards it with ${paid}.` : ''}`);
      out.push(o);
    }
  }
  return out;
}
