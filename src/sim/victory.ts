/** Ways to win other than the score, scenarios with a goal and a year, and favours bought with prestige. */
import { SCENARIOS, VICTORY, VICTORY_NAME, FAVOURS, scenarioById, type FavourId, type VictoryKind } from '../data/scenarios';
import { rivalSpec, rivalsOf, type CrownId } from '../data/rivals';
import { score } from './colony';
import { rivalScore } from './rivals';
import { makePerson, recallDeed } from './court';
import { mulberry32, hashSeed, int } from './rng';
import { yearOf, type GameEvent, type GameState, type World } from './types';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ev = (e: GameEvent) => void;
export type Result = { ok: true; message?: string } | { ok: false; error: string };
const KINDS: VictoryKind[] = ['trade', 'empire', 'prestige'];

const scaleOf = (s: GameState) => { const end = 1492 + Math.round(s.endTurn / 4); return VICTORY.scale[end] ?? Math.max(0.3, (end - 1492) / 158); };

/** How far each crown has come in each race: a share of the target, 0..1. Rivals do not race for prestige. */
export function races(w: World, s: GameState) {
  const k = scaleOf(s);
  const mine = score(s, w);
  const empire = (pop: number, land: number) => Math.min(pop / (VICTORY.empire.colonists * k), land / (VICTORY.empire.territory * k));
  const row = (kind: VictoryKind) => {
    const me = kind === 'trade' ? s.revenue / (VICTORY.trade * k) : kind === 'empire' ? empire(mine.pop, mine.territory) : s.prestige / VICTORY.prestige;
    const others = kind === 'prestige' ? [] : rivalsOf(s.crown).map((r) => {
      const sc = rivalScore(s, r.id);
      return { crown: r.id, share: kind === 'trade' ? s.rivals[r.id].revenue / (VICTORY.trade * k) : empire(sc.pop, sc.territory) };
    });
    return { kind, name: VICTORY_NAME[kind].name, me: Math.max(0, me), best: [...others].sort((a, b) => b.share - a.share)[0] };
  };
  return KINDS.map(row);
}

/** The first crown to finish a race is remembered for it; the game goes on to the end of the age. */
export function checkVictory(w: World, s: GameState, log: Log, ev: Ev, hex: number) {
  if (s.victory) return;
  for (const r of races(w, s)) {
    const winner: CrownId | null = r.me >= 1 ? s.crown : r.best && r.best.share >= 1 ? r.best.crown : null;
    if (!winner) continue;
    s.victory = { kind: r.kind, crown: winner, turn: s.turn };
    const name = rivalSpec(winner).name, mine = winner === s.crown;
    if (mine) s.prestige += 20;
    log('court', `${name[0].toUpperCase()}${name.slice(1)} ${VICTORY_NAME[r.kind].won}.`);
    ev({ kind: 'end', title: mine ? r.name : `${name[0].toUpperCase()}${name.slice(1)} wins the race`, map: 'old', hex,
      text: mine
        ? `In ${yearOf(s.turn)} ${name} ${VICTORY_NAME[r.kind].won}. Whatever the final reckoning says, this is a victory, and it is yours. The age is not over: you may play on.`
        : `In ${yearOf(s.turn)} ${name} ${VICTORY_NAME[r.kind].won}. That race is lost. The age is not over, and the final reckoning is still to come.` });
    return;
  }
}

/** How far the scenario's goal has come. */
export function scenarioProgress(s: GameState) {
  const sc = scenarioById(s.scenario?.id);
  if (!sc || !s.scenario) return null;
  const have = sc.goal.kind === 'treasury' ? s.treasury : sc.goal.kind === 'sales' ? s.revenue : s.colonies.filter((c) => c.map === 'new').length;
  return { scenario: sc, have: Math.max(0, Math.floor(have)), need: sc.goal.need, done: s.scenario.done, left: sc.by - yearOf(s.turn) };
}

export function checkScenario(s: GameState, log: Log, ev: Ev, hex: number) {
  const p = scenarioProgress(s);
  if (!p || p.done) return;
  if (p.have >= p.need) {
    s.scenario!.done = 'won';
    s.prestige += 25;
    log('court', `${p.scenario.name}: done, in ${yearOf(s.turn)}. +25 prestige.`);
    ev({ kind: 'tech', title: `${p.scenario.name}: achieved`, map: 'old', hex, text: `${p.scenario.ask}, with ${Math.max(0, p.left)} year${p.left === 1 ? '' : 's'} to spare. The court gives thanks, and the chroniclers sharpen their pens. The voyage goes on as a free game.` });
  } else if (p.left < 0) {
    s.scenario!.done = 'lost';
    s.prestige -= 10;
    log('court', `${p.scenario.name}: the year ${p.scenario.by} has passed, and it is not done.`);
    ev({ kind: 'tech', title: `${p.scenario.name}: not achieved`, map: 'old', hex, text: `${p.scenario.by} has come and gone with ${p.have.toLocaleString('en-US')} of ${p.need.toLocaleString('en-US')}. −10 prestige. Nothing else is lost: the voyage goes on as a free game.` });
  }
}

/** Spend prestige on a favour. */
export function favour(s: GameState, id: FavourId, log: Log): Result {
  const f = FAVOURS[id];
  if (!f) return { ok: false, error: 'No such favour.' };
  if (s.prestige < f.cost) return { ok: false, error: `That takes ${f.cost} prestige.` };
  s.prestige -= f.cost;
  if (id === 'summon') {
    const rng = mulberry32(hashSeed(s.seed, s.turn, s.nextId, 601));
    const taken = [...s.people.map((p) => p.name), ...s.petitioners.map((x) => x.person.name)];
    const p = makePerson(rng, s.nextId++, yearOf(s.turn), taken, undefined, s.crown, rivalSpec(s.crown).home);
    p.born = yearOf(s.turn) - int(rng, 24, 38);
    const best = (Object.keys(p.skills) as (keyof typeof p.skills)[]).sort((a, b) => p.skills[b] - p.skills[a]);
    p.skills[best[0]] = 5; p.skills[best[1]] = Math.max(p.skills[best[1]], 3);
    s.petitioners.push({ person: p, cost: 300 });
    log('court', `Drawn by your fame, ${p.name} comes to court and asks for a place.`);
    return { ok: true, message: `${p.name} waits among the petitioners.` };
  }
  if (id === 'honours') { for (const p of s.people) if (p.alive) recallDeed(s, p, 6, 'Honoured before the court'); return { ok: true, message: 'The court is pleased with itself, and with you.' }; }
  for (const r of rivalsOf(s.crown)) s.rivals[r.id].attitude = Math.min(100, s.rivals[r.id].attitude + 12);
  for (const st of Object.values(s.europe)) st.attitude = Math.min(100, st.attitude + 12);
  return { ok: true, message: 'Your embassy is received in every capital.' };
}
export { SCENARIOS };
