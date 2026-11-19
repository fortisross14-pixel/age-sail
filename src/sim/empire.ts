/** The long game: eras, colonial loyalty and independence, taxes, loans, and the final reckoning. */
import { ERAS, eraAt, eraIndex } from '../data/eras';
import { GRIDS } from './hex';
import { mulberry32, hashSeed, int } from './rng';
import { LEVELS, score } from './colony';
import { rivalScore } from './rivals';
import { RIVALS } from '../data/rivals';
import { yearOf, type Colony, type GameEvent, type GameState, type World, type Party } from './types';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ev = (e: GameEvent) => void;

export const TAX = { low: { per: 3, loyalty: 8 }, normal: { per: 5, loyalty: 0 }, high: { per: 8, loyalty: -12 } } as const;

/** Colonial taxes this season. */
export const colonyTaxes = (s: GameState, c: Colony) => Math.round(c.pop * TAX[s.taxRate].per * (c.charter ? 0.5 : 1));

/** What a colony's loyalty drifts toward, and why. */
export function loyaltyFactors(s: GameState, c: Colony): { label: string; value: number }[] {
  const years = (s.turn - c.founded) / 4;
  const garrison = s.units.filter((u) => u.colony === c.id && u.type === 'infantry').length;
  const f: { label: string; value: number }[] = [
    { label: 'Settlers loyal to the Crown', value: 75 },
    { label: 'Generations born overseas', value: -Math.min(30, Math.floor(years / 25) * 8) },
    { label: `The ${eraAt(yearOf(s.turn)).name}`, value: -eraIndex(yearOf(s.turn)) * 6 },
    { label: `${s.taxRate[0].toUpperCase()}${s.taxRate.slice(1)} taxes`, value: TAX[s.taxRate].loyalty },
    { label: 'Size: towns and cities think for themselves', value: c.level === 'city' ? -12 : c.level === 'town' ? -5 : 0 },
  ];
  if (c.map === 'new') f.push({ label: 'Across the ocean', value: -5 });
  if (c.charter) f.push({ label: 'Royal charter', value: 15 });
  if (garrison) f.push({ label: `Garrison (${garrison})`, value: Math.min(15, garrison * 4) });
  if (c.last.hungry || c.last.discontent) f.push({ label: 'Needs not met', value: -15 });
  if (c.last.luxuries) f.push({ label: 'Luxuries', value: 4 });
  return f;
}
export const loyaltyTarget = (s: GameState, c: Colony) => Math.max(0, Math.min(100, loyaltyFactors(s, c).reduce((t, x) => t + x.value, 0)));

export function charter(s: GameState, colonyId: string): Result {
  const c = s.colonies.find((x) => x.id === colonyId);
  if (!c) return fail('No such colony.');
  if (c.charter) return fail(`${c.name} already has a charter.`);
  c.charter = true;
  c.loyalty = Math.min(100, c.loyalty + 15);
  return { ok: true, message: `${c.name} receives a royal charter: its own council, and half the taxes.` };
}

export function festival(s: GameState, colonyId: string): Result {
  const c = s.colonies.find((x) => x.id === colonyId);
  if (!c) return fail('No such colony.');
  const cost = 150 + c.pop * 40;
  if (s.treasury < cost) return fail(`A festival in ${c.name} costs ${cost} ducats.`);
  s.treasury -= cost;
  c.loyalty = Math.min(100, c.loyalty + 12);
  return { ok: true, message: `Bells, wine and a royal proclamation in ${c.name}. The settlers cheer the Crown, for now.` };
}

export function setTaxRate(s: GameState, rate: GameState['taxRate']): Result {
  s.taxRate = rate;
  return { ok: true, message: `Colonial taxes set to ${rate}.` };
}

/** Each season: eras turn, loyalty drifts, unrest and independence, loans fall due, the end approaches. */
export function empireSeason(w: World, s: GameState, log: Log, ev: Ev) {
  const rng = mulberry32(hashSeed(s.seed, s.turn, 91));
  const year = yearOf(s.turn);
  // a new era
  const era = ERAS.find((e) => e.year === year && s.turn % 4 === 0);
  if (era && era.year > 1492) {
    log('court', `A new age begins: the ${era.name}.`);
    ev({ kind: 'era', title: era.name, map: 'old', hex: w.old.ports.find((p) => p.id === 'seville')!.hex, text: era.blurb });
  }
  // loans
  for (const l of s.loans) { s.treasury -= l.perSeason; l.left--; }
  s.loans = s.loans.filter((l) => l.left > 0);
  // loyalty, unrest, independence
  for (const c of [...s.colonies]) {
    const target = loyaltyTarget(s, c);
    c.loyalty += Math.max(-2, Math.min(2, (target - c.loyalty) * 0.15));
    const wasUnrest = c.unrest;
    c.unrest = c.loyalty < 30;
    if (c.unrest && !wasUnrest) log('peril', `Unrest in ${c.name}: the settlers grumble against the Crown’s officers, and work slows.`);
    if (c.loyalty < 15 && c.pop >= 6 && rng() < 0.12) {
      const garrison = s.units.filter((u) => u.colony === c.id && u.type === 'infantry').length;
      const rebels = c.pop * 0.8;
      if (rng() < (garrison * 4) / (garrison * 4 + rebels)) {
        c.pop = Math.max(1, c.pop - 1);
        c.loyalty += 10;
        log('peril', `The settlers of ${c.name} rise against the Crown. The garrison puts the rising down; the ringleaders hang.`);
      } else {
        s.colonies = s.colonies.filter((x) => x !== c);
        s.units = s.units.filter((u) => u.colony !== c.id);
        s.freeStates.push({ id: `free-${s.nextId++}`, name: c.name, map: c.map, hex: c.hex, pop: c.pop, level: c.level, since: s.turn });
        log('peril', `${c.name} declares its independence from the Crown.`);
        ev({ kind: 'lost', title: `${c.name} breaks away`, map: c.map, hex: c.hex,
          text: `The settlers of ${c.name}, ${c.pop} strong, have thrown out the Crown’s officers and declared themselves free. You may let them go, or send soldiers to bring them back.` });
      }
    }
  }
  // free states grow slowly
  for (const f of s.freeStates) if ((s.turn - f.since) % 6 === 5 && f.pop < LEVELS[f.level].cap) f.pop++;
  // the end of the age
  if (!s.ended && s.turn >= s.endTurn) {
    s.ended = true;
    const st = standings(w, s);
    const first = st[0];
    const mine = st.find((x) => x.id === 'castile')!;
    const place = st.indexOf(mine) + 1;
    log('court', `The age ends. Castile stands ${['first', 'second', 'third', 'fourth'][place - 1]} among the crowns, with a score of ${mine.total}.`);
    ev({ kind: 'end', title: place === 1 ? 'Castile triumphant' : 'The age ends', map: 'old', hex: w.old.ports.find((p) => p.id === 'seville')!.hex,
      text: place === 1
        ? `As the age closes, no crown can match Castile: ${mine.pop} colonists, ${mine.territory} hexes of land, and ${mine.commerce} in commerce. The chroniclers will remember your reign.`
        : `As the age closes, ${first.name} leads the crowns of Europe. Castile stands ${['first', 'second', 'third', 'fourth'][place - 1]}, with ${mine.total} points. You may play on.` });
  }
  void int;
}

export function standings(w: World, s: GameState) {
  const me = score(s, w);
  return [
    { id: 'castile', name: 'Castile', ...me },
    ...RIVALS.map((r) => ({ id: r.id, name: r.name, ...rivalScore(s, r.id) })),
  ].sort((a, b) => b.total - a.total);
}

/** Retake a colony that broke away. */
export function retake(s: GameState, p: Party, freeId: string, strength: number, log: Log): Result {
  const f = s.freeStates.find((x) => x.id === freeId);
  if (!f) return fail('No such place.');
  const g = GRIDS[p.map];
  if (f.map !== p.map || (f.hex !== p.hex && !g.neighbors(p.hex).includes(f.hex))) return fail('The party must stand beside it.');
  const rng = mulberry32(hashSeed(s.seed, s.turn, f.hex, 92));
  const d = f.pop * 1.5 + (f.level === 'town' ? 4 : f.level === 'city' ? 8 : 0);
  const units = s.units.filter((u) => u.party === p.id);
  if (rng() < strength / (strength + d)) {
    s.freeStates = s.freeStates.filter((x) => x !== f);
    s.colonies.push({
      id: `col-${s.nextId++}`, name: f.name, map: f.map, hex: f.hex, founded: s.turn, pop: Math.max(1, Math.round(f.pop * 0.8)), level: f.level,
      stock: { food: 10 }, growth: 0, loyalty: 35, charter: false, unrest: true, last: { produced: {}, worked: [], hungry: false, discontent: false, luxuries: false },
    });
    for (const u of units) if (u.type === 'infantry') { u.party = null; u.colony = s.colonies[s.colonies.length - 1].id; }
    if (!s.units.some((u) => u.party === p.id)) s.parties = s.parties.filter((x) => x !== p);
    log('peril', `Royal soldiers retake ${f.name}. Its settlers submit, sullenly.`);
    return { ok: true };
  }
  const dead = units.slice(0, Math.max(1, Math.round(units.length * 0.5)));
  s.units = s.units.filter((u) => !dead.includes(u));
  log('peril', `The free settlers of ${f.name} beat back the royal soldiers.`);
  return { ok: true };
}
