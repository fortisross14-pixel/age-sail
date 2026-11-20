/** The long game: eras, colonial loyalty and independence, taxes, loans, and the final reckoning. */
import { ERAS, eraAt, eraIndex } from '../data/eras';
import { GRIDS } from './hex';
import { mulberry32, hashSeed, int } from './rng';
import { LEVELS, score } from './colony';
import { rivalScore } from './rivals';
import { rivalsOf, rivalSpec } from '../data/rivals';
import { fight, casualties, recordLosses, blood, partyForce, type Force } from './battle';
import { isMilitary } from '../data/army';
import { realmMods, judgeEra, eraCard } from './dynasty';
import { yearOf, emptyAccount, type Stance, type Colony, type GameEvent, type GameState, type World, type Party } from './types';

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
  const garrison = s.units.filter((u) => u.colony === c.id && isMilitary(u.type)).length;
  const f: { label: string; value: number }[] = [
    { label: 'Settlers loyal to you', value: 75 },
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
  const realm = realmMods(s).loyalty;
  if (realm) f.push({ label: s.dynasty.regency ? 'A regency, and the path of the age' : 'Your rule, and the path of the age', value: realm });
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
  return { ok: true, message: `Bells, wine and a royal proclamation in ${c.name}. The settlers cheer you, for now.` };
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
    // the age that closes is judged by what it promised; the new one asks for a path
    judgeEra(w, s, log);
    log('court', `A new age begins: the ${era.name}.`);
    const hex = w.old.ports.find((p) => p.id === rivalSpec(s.crown).home)!.hex;
    ev(eraCard(era.id, hex) ?? { kind: 'era', title: era.name, map: 'old', hex, text: era.blurb });
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
    if (c.unrest && !wasUnrest) log('peril', `Unrest in ${c.name}: the settlers grumble against your officers, and work slows.`);
    if (c.loyalty < 15 && c.pop >= 6 && rng() < 0.12) {
      const garrison = s.units.filter((u) => u.colony === c.id && isMilitary(u.type)).length;
      const rebels = c.pop * 0.8;
      if (rng() < (garrison * 4) / (garrison * 4 + rebels)) {
        c.pop = Math.max(1, c.pop - 1);
        c.loyalty += 10;
        log('peril', `The settlers of ${c.name} rise against you. The garrison puts the rising down; the ringleaders hang.`);
      } else {
        s.colonies = s.colonies.filter((x) => x !== c);
        s.units = s.units.filter((u) => u.colony !== c.id);
        s.freeStates.push({ id: `free-${s.nextId++}`, name: c.name, map: c.map, hex: c.hex, pop: c.pop, level: c.level, since: s.turn });
        log('peril', `${c.name} declares its independence.`);
        ev({ kind: 'lost', title: `${c.name} breaks away`, map: c.map, hex: c.hex,
          text: `The settlers of ${c.name}, ${c.pop} strong, have thrown out your officers and declared themselves free. You may let them go, or send soldiers to bring them back.` });
      }
    }
  }
  // free states grow slowly
  for (const f of s.freeStates) if ((s.turn - f.since) % 6 === 5 && f.pop < LEVELS[f.level].cap) f.pop++;
  // the end of the age
  if (!s.ended && s.turn >= s.endTurn) {
    s.ended = true;
    judgeEra(w, s, log);
    const st = standings(w, s);
    const first = st[0];
    const mine = st.find((x) => x.mine)!;
    const place = st.indexOf(mine) + 1;
    const nth = ['first', 'second', 'third', 'fourth', 'fifth'][place - 1];
    log('court', `The age ends. ${mine.name} stands ${nth} among the crowns, with a score of ${mine.total}.`);
    ev({ kind: 'end', title: place === 1 ? `${mine.name} triumphant` : 'The age ends', map: 'old', hex: w.old.ports.find((p) => p.id === rivalSpec(s.crown).home)!.hex,
      text: place === 1
        ? `As the age closes, no crown can match ${mine.name}: ${mine.pop} colonists, ${mine.territory} hexes of land, and ${mine.commerce} in commerce. The chroniclers will remember your reign.`
        : `As the age closes, ${first.name} leads the crowns of Europe. ${mine.name} stands ${nth}, with ${mine.total} points. You may play on.` });
  }
  void int;
}

export function standings(w: World, s: GameState) {
  const me = score(s, w);
  return [
    { id: s.crown, name: rivalSpec(s.crown).name, mine: true, ...me },
    ...rivalsOf(s.crown).map((r) => ({ id: r.id, name: r.name, mine: false, ...rivalScore(s, r.id) })),
  ].sort((a, b) => b.total - a.total);
}

/** Retake a colony that broke away: its settlers fight for their freedom behind whatever walls they have. */
export function retake(w: World, s: GameState, p: Party, freeId: string, log: Log, ev: (e: GameEvent) => void, stance: Stance = 'assault'): Result {
  const f = s.freeStates.find((x) => x.id === freeId);
  if (!f) return fail('No such place.');
  const g = GRIDS[p.map];
  if (f.map !== p.map || (f.hex !== p.hex && !g.neighbors(p.hex).includes(f.hex))) return fail('The party must stand beside it.');
  const mine = partyForce(s, p);
  if (!mine.units.length) return fail('The party has no one who can fight.');
  const rng = mulberry32(hashSeed(s.seed, s.turn, f.hex, 92));
  const theirs = freeForce(f);
  const out = fight(rng, mine, theirs, w[f.map].terrain[f.hex], stance);
  const units = s.units.filter((u) => u.party === p.id);
  const dead = casualties(rng, units, out.atkLoss);
  s.units = s.units.filter((u) => !dead.includes(u));
  recordLosses(out.report.attacker, dead);
  recordLosses(out.report.defender, casualties(rng, theirs.units, out.defLoss));
  if (out.attackerWon) {
    s.freeStates = s.freeStates.filter((x) => x !== f);
    s.colonies.push({
      id: `col-${s.nextId++}`, name: f.name, map: f.map, hex: f.hex, founded: s.turn, pop: Math.max(1, Math.round(f.pop * 0.8)), level: f.level,
      stock: { food: 10 }, growth: 0, loyalty: 35, charter: false, unrest: true, newcomers: 0, walls: 0, last: emptyAccount(),
    });
    const survivors = s.units.filter((u) => u.party === p.id);
    blood(survivors);
    for (const u of survivors) if (isMilitary(u.type)) { u.party = null; u.colony = s.colonies[s.colonies.length - 1].id; }
    if (!s.units.some((u) => u.party === p.id)) s.parties = s.parties.filter((x) => x !== p);
    const text = `Royal soldiers retake ${f.name}. Its settlers submit, sullenly.`;
    log('peril', text);
    ev({ kind: 'battle', title: `${f.name} retaken`, map: f.map, hex: f.hex, text, battle: out.report });
    return { ok: true };
  }
  const text = `The free settlers of ${f.name} beat back the royal soldiers.`;
  log('peril', text);
  ev({ kind: 'battle', title: `Beaten back at ${f.name}`, map: f.map, hex: f.hex, text, battle: out.report });
  return { ok: true };
}

/** A free state's defenders: armed settlers, a militia of pikes, and walls if it was a town. */
export function freeForce(f: GameState['freeStates'][number]): Force {
  const militia = Math.floor(f.pop / 3);
  const units = [
    ...Array.from({ length: militia }, () => ({ type: 'infantry' as const, vet: 0 })),
    ...Array.from({ length: f.pop }, () => ({ type: 'colonist' as const, vet: 0 })),
  ];
  return { name: f.name, units, walls: f.level === 'town' ? 1 : f.level === 'city' ? 2 : 0 };
}
