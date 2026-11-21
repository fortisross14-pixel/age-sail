/** The long game: eras, colonial loyalty and independence, taxes, loans, and the final reckoning. */
import { ERAS, eraAt, eraIndex } from '../data/eras';
import { GRIDS } from './hex';
import { mulberry32, hashSeed, int } from './rng';
import { LEVELS, score } from './colony';
import { rivalScore } from './rivals';
import { rivalsOf, rivalSpec } from '../data/rivals';
import { fight, casualties, recordLosses, blood, partyForce, assaultColony, type Force } from './battle';
import { planLand } from './land';
import { isMilitary } from '../data/army';
import { realmMods, judgeEra, eraCard } from './dynasty';
import { BUILDING_FX } from '../data/city';
import { Fog, yearOf, emptyAccount, type Stance, type Colony, type GameEvent, type GameState, type World, type Party } from './types';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ev = (e: GameEvent) => void;

/** Colonies that have broken away. Provisional numbers. */
export const FREE = {
  /** how far their example carries, and how much it lowers a neighbour's loyalty (two count) */
  reach: 10, example: 6,
  /** recognising one costs prestige, and it then trades with you: ducats a season for each of its people */
  recognisePrestige: 8, trade: 4,
  /** seasons before a rival crown may recognise one you have neither retaken nor recognised, and the chance each season after */
  foreignAfter: 24, foreignChance: 0.05,
  /** a free state of this many people may send its militia against a colony within `marchReach` hexes by land; the chance each season, doubled once the free states are in league */
  musterPop: 5, muster: 0.04, marchReach: 12, marchPace: 2,
  /** what a colony loses in loyalty when the militia breaks in; under `defect` it goes over to them */
  shaken: 25, defect: 20,
};

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
  // a colony that has broken away, and that you have not come to terms with, is an example to its neighbours
  const free = s.freeStates.filter((x) => !x.recognised && x.map === c.map && GRIDS[c.map].distance(x.hex, c.hex) <= FREE.reach).length;
  if (free) f.push({ label: free > 1 ? 'Free states nearby' : 'A free state nearby', value: -FREE.example * Math.min(2, free) });
  const cathedrals = Math.min(BUILDING_FX.cathedralsCount, Object.values(s.cities).filter((x) => x.buildings.cathedral).length);
  if (cathedrals) f.push({ label: cathedrals > 1 ? 'The cathedrals at home' : 'The cathedral at home', value: cathedrals * BUILDING_FX.cathedralLoyalty });
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
        ev({ kind: 'lost', title: `A rising in ${c.name}`, map: c.map, hex: c.hex, text: `The settlers of ${c.name} took up arms against your officers. The garrison held and the ringleaders hang, but a colony that has risen once will rise again: its loyalty is ${Math.round(c.loyalty)}. A charter, lighter taxes, a festival or more soldiers would steady it.` });
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
  // free states: those you recognise trade with you; the others, in time, find a protector among your rivals
  for (const f of s.freeStates) {
    if (f.recognised) { s.treasury += f.pop * FREE.trade; continue; }
    if (f.by || s.turn - f.since < FREE.foreignAfter || rng() >= FREE.foreignChance) continue;
    const patron = [...rivalsOf(s.crown)].sort((a, b) => s.rivals[a.id].attitude - s.rivals[b.id].attitude)[0];
    f.by = patron.id;
    log('court', `${patron.name} recognises ${f.name} as a free state and promises to defend it. To retake it now would mean war.`);
  }
  // free states in league: two or more that you have not come to terms with make common cause
  const loose = s.freeStates.filter((f) => !f.recognised);
  if (loose.length >= 2 && s.flags.league == null) {
    s.flags.league = s.turn;
    log('peril', `${loose.map((f) => f.name).join(' and ')} form a league of free states, and call on every colony to join them.`);
    ev({ kind: 'lost', title: 'A league of free states', map: loose[0].map, hex: loose[0].hex,
      text: `${loose.map((f) => f.name).join(' and ')} have sworn to stand together. They will arm, and their militia will march on your loyal colonies to raise them or take them. Recognise them, retake them, or meet their soldiers in the field.` });
  }
  if (loose.length < 2) delete s.flags.league;
  // their militia marches
  for (const f of loose) {
    if (f.pop < FREE.musterPop || s.rebels.some((r) => r.free === f.id) || rng() >= FREE.muster * (s.flags.league != null ? 2 : 1)) continue;
    const g = GRIDS[f.map];
    const near = s.colonies.filter((c) => c.map === f.map && g.distance(c.hex, f.hex) <= FREE.marchReach).sort((a, b) => g.distance(a.hex, f.hex) - g.distance(b.hex, f.hex));
    for (const c of near) {
      const road = planLand(g, w[f.map], open(f.map), f.hex, c.hex, 99, 99);
      if (!road) continue;
      s.rebels.push({ id: s.nextId++, free: f.id, name: `The militia of ${f.name}`, map: f.map, hex: f.hex, target: c.hex, path: road.path, strength: Math.max(2, Math.floor(f.pop / 3)), trail: [f.hex] });
      log('peril', `The militia of ${f.name} marches on ${c.name}.`);
      break;
    }
  }
  for (const r of [...s.rebels]) {
    r.trail = [r.hex];
    for (let k = 0; k < FREE.marchPace && r.path.length > 1; k++) { r.path.shift(); r.hex = r.path[0]; r.trail.push(r.hex); }
    if (r.path.length > 1) continue;
    s.rebels = s.rebels.filter((x) => x !== r);
    const c = s.colonies.find((x) => x.map === r.map && x.hex === r.target);
    const f = s.freeStates.find((x) => x.id === r.free);
    if (!c || !f || f.recognised) continue;
    const out = assaultColony(s, c, { name: r.name, units: Array.from({ length: r.strength }, () => ({ type: 'infantry' as const, vet: 0 })) }, w[c.map].terrain[c.hex], rng);
    if (!out.win) { log('peril', `The militia of ${f.name} is beaten off at ${c.name}.`); c.loyalty = Math.min(100, c.loyalty + 5); continue; }
    c.loyalty = Math.max(0, c.loyalty - FREE.shaken);
    if (c.loyalty < FREE.defect) {
      s.colonies = s.colonies.filter((x) => x !== c);
      s.units = s.units.filter((u) => u.colony !== c.id);
      s.freeStates.push({ id: `free-${s.nextId++}`, name: c.name, map: c.map, hex: c.hex, pop: c.pop, level: c.level, since: s.turn });
      log('peril', `${c.name} opens its gates to the militia of ${f.name} and declares itself free.`);
      ev({ kind: 'lost', title: `${c.name} goes over`, map: c.map, hex: c.hex, text: `The militia of ${f.name} is welcomed into ${c.name}. Your officers are put on a ship, and another colony is lost to the league.` });
    } else log('peril', `The militia of ${f.name} breaks into ${c.name}. They are driven out in the end, but the town is shaken and many listened to them.`);
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

const openFog = new Map<string, number[]>();
/** Militia know their own country: every hex is open to them. */
function open(map: 'old' | 'new') { let f = openFog.get(map); if (!f) { f = new Array(GRIDS[map].N).fill(Fog.Explored); openFog.set(map, f); } return f; }

/** Meet a free state's militia in the field with a party beside it. */
export function engageRebels(w: World, s: GameState, p: Party, rebelId: number, log: Log, ev: Ev, stance: Stance = 'assault'): Result {
  const r = s.rebels.find((x) => x.id === rebelId);
  if (!r) return fail('No such force.');
  if (r.map !== p.map || GRIDS[p.map].distance(p.hex, r.hex) > 1) return fail('The party must stand beside them.');
  const mine = partyForce(s, p);
  if (!mine.units.length) return fail('The party has no one who can fight.');
  const rng = mulberry32(hashSeed(s.seed, s.turn, r.id, 93));
  const theirs: Force = { name: r.name, units: Array.from({ length: r.strength }, () => ({ type: 'infantry' as const, vet: 0 })) };
  const out = fight(rng, mine, theirs, w[p.map].terrain[r.hex], stance);
  const dead = casualties(rng, s.units.filter((u) => u.party === p.id), out.atkLoss);
  s.units = s.units.filter((u) => !dead.includes(u));
  recordLosses(out.report.attacker, dead);
  const theirDead = casualties(rng, theirs.units, out.defLoss);
  recordLosses(out.report.defender, theirDead);
  let text: string;
  if (out.attackerWon) { s.rebels = s.rebels.filter((x) => x !== r); blood(s.units.filter((u) => u.party === p.id)); s.prestige += 4; text = `Royal soldiers scatter ${r.name.toLowerCase()} on the march.`; }
  else { r.strength = Math.max(1, r.strength - theirDead.length); text = `${r.name} beats off the royal soldiers and marches on.`; }
  if (!s.units.some((u) => u.party === p.id)) s.parties = s.parties.filter((x) => x !== p);
  log('peril', text);
  ev({ kind: 'battle', title: out.attackerWon ? 'The militia scattered' : 'Beaten by the militia', map: p.map, hex: r.hex, text, battle: out.report });
  return { ok: true };
}

/** Come to terms with a colony that broke away: it stops stirring up its neighbours, and trades with you. */
export function recognise(s: GameState, freeId: string, log: Log): Result {
  const f = s.freeStates.find((x) => x.id === freeId);
  if (!f) return fail('No such place.');
  if (f.recognised) return fail(`${f.name} is recognised already.`);
  f.recognised = true;
  s.rebels = s.rebels.filter((r) => r.free !== f.id);
  s.prestige -= FREE.recognisePrestige;
  log('court', `You recognise ${f.name} as a free state. Its merchants are welcome in your ports, and yours in theirs.`);
  return { ok: true, message: `${f.name} is recognised. −${FREE.recognisePrestige} prestige; it will trade with you.` };
}

/** Retake a colony that broke away: its settlers fight for their freedom behind whatever walls they have. */
export function retake(w: World, s: GameState, p: Party, freeId: string, log: Log, ev: (e: GameEvent) => void, stance: Stance = 'assault'): Result {
  const f = s.freeStates.find((x) => x.id === freeId);
  if (!f) return fail('No such place.');
  const g = GRIDS[p.map];
  if (f.map !== p.map || (f.hex !== p.hex && !g.neighbors(p.hex).includes(f.hex))) return fail('The party must stand beside it.');
  const mine = partyForce(s, p);
  if (!mine.units.length) return fail('The party has no one who can fight.');
  if (f.by && s.rivals[f.by].relation !== 'war') { s.rivals[f.by].relation = 'war'; s.rivals[f.by].warSince = s.turn; s.rivals[f.by].attitude = Math.min(s.rivals[f.by].attitude, -70); log('peril', `The attack on ${f.name} means war with ${rivalSpec(f.by).name}, its protector.`); }
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
