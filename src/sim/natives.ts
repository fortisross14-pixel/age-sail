/**
 * Native peoples: how they stand with the Crown, and every way of dealing with them, from trade and missions
 * to alliances, setting rivals against each other, and conquest. Battles are a matter of numbers.
 */
import { crownSpec } from '../data/rivals';
import { T, isWater } from '../data/terrain';
import { UNIT_INFO } from '../data/court';
import { GOOD_INFO, type GoodId } from '../data/goods';
import { GRIDS } from './hex';
import { mulberry32, hashSeed, int, type Rng } from './rng';
import { personById, skill } from './court';
import type { Colony, Fleet, GameEvent, GameState, NationDef, NativeState, Party, World, MapId, Person } from './types';
import { NATIVE, DEFENCE } from '../data/colony';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ev = (e: GameEvent) => void;

export const allNations = (w: World): NationDef[] => [...w.old.nations, ...w.new.nations];
export const nationById = (w: World, id: string) => allNations(w).find((n) => n.id === id);
export const nationOfSite = (w: World, siteId: string) => allNations(w).find((n) => n.site === siteId);

const territoryCache = new WeakMap<NationDef, number[]>();
/** The lands of a people: within two hexes of their trading ground or any of their villages. */
export function territory(n: NationDef): number[] {
  let t = territoryCache.get(n);
  if (!t) {
    const g = GRIDS[n.map];
    t = [...new Set([n.siteHex, ...n.villages].flatMap((h) => g.within(h, 2)))];
    territoryCache.set(n, t);
  }
  return t;
}

export function nationAt(w: World, map: MapId, hex: number): NationDef | undefined {
  return w[map].nations.find((n) => territory(n).includes(hex));
}

export function initNatives(w: World): Record<string, NativeState> {
  return Object.fromEntries(allNations(w).map((n) => [n.id, {
    met: false, attitude: 10, relation: 'peace' as const, warriors: n.warriors, converted: 0, post: false, mission: false, lost: [], contact: null, epidemic: false,
    memory: [], siege: null,
  }]));
}

/** Hostile peoples raid and ambush. */
export const isHostile = (st: NativeState) => st.relation === 'war' || (st.relation === 'peace' && st.attitude <= -40);

export function moodOf(st: NativeState): string {
  if (st.relation === 'subject') return 'your subjects';
  if (st.relation === 'allied') return 'allied';
  if (st.relation === 'war') return 'at war';
  if (st.attitude <= -40) return 'hostile';
  if (st.attitude < 0) return 'wary';
  if (st.attitude < 40) return 'cautious';
  return 'friendly';
}

/** Your envoy: the best diplomat at court (not at sea or ashore). */
export function envoy(s: GameState): Person | undefined {
  return s.people.filter((p) => p.alive && p.fleet == null && !s.parties.some((x) => x.leader === p.id))
    .sort((a, b) => skill(b, 'diplomacy') - skill(a, 'diplomacy'))[0];
}

const clampAtt = (st: NativeState) => { st.attitude = Math.max(-100, Math.min(100, st.attitude)); };

/**
 * Change how a people feels about you, and remember why. Deeds of the same kind add up in one memory,
 * so the player can read the reasons behind their mood: "settlers on our land", "the trading post".
 */
export function remember(s: GameState, st: NativeState, why: string, delta: number) {
  const before = st.attitude;
  st.attitude += delta;
  clampAtt(st);
  const d = st.attitude - before;
  if (!d) return;
  const m = st.memory.find((x) => x.why === why);
  if (m) { m.amount += d; m.turn = s.turn; } else st.memory.push({ why, amount: d, turn: s.turn });
  st.memory.sort((a, b) => b.turn - a.turn);
  if (st.memory.length > 8) st.memory.length = 8;
}

/** The peoples whose land lies within two hexes of a colony. */
export function neighbours(w: World, s: GameState, c: Colony): { n: NationDef; st: NativeState }[] {
  const near = new Set(GRIDS[c.map].within(c.hex, 2));
  return w[c.map].nations.filter((n) => s.natives[n.id] && territory(n).some((h) => near.has(h))).map((n) => ({ n, st: s.natives[n.id] }));
}

/** The people laying siege to a colony, if any. */
export function besieging(w: World, s: GameState, c: Colony): NationDef | undefined {
  return allNations(w).find((n) => s.natives[n.id]?.siege?.colony === c.id);
}

const soldiersIn = (s: GameState, c: Colony) => s.units.filter((u) => u.colony === c.id && u.type === 'infantry').length;
/** A colony's strength behind its palisade: soldiers, settlers and walls. */
export const palisade = (s: GameState, c: Colony) => soldiersIn(s, c) * DEFENCE.soldier + c.pop * DEFENCE.settler + DEFENCE.base
  + (c.level === 'town' ? DEFENCE.town : c.level === 'city' ? DEFENCE.city : 0);
const nameOf = (n: NationDef) => `the ${n.people}`;

// ---------- strength and battle ----------

const UNIT_STRENGTH = { infantry: 4, colonist: 1, missionary: 0.3 } as const;

export function partyStrength(s: GameState, p: Party): number {
  const units = s.units.filter((u) => u.party === p.id);
  const l = personById(s, p.leader);
  return units.reduce((t, u) => t + UNIT_STRENGTH[u.type], 0) + (l ? 1 + skill(l, 'military') : 0);
}

export function defenceOf(w: World, n: NationDef, st: NativeState, hex: number): number {
  const t = w[n.map].terrain[hex];
  let d = st.warriors;
  if (t === T.Forest || t === T.Jungle || t === T.Hills) d *= 1.25;
  if (hex === n.siteHex) d *= n.empire ? 1.4 : 1.2;
  return d;
}

/** Peoples allied with you who are rivals of the target fight on your side. */
export function alliedHelp(w: World, s: GameState, target: NationDef): number {
  return allNations(w)
    .filter((o) => o.map === target.map && o.id !== target.id && s.natives[o.id]?.relation === 'allied' && (o.rivals.includes(target.id) || target.rivals.includes(o.id)))
    .reduce((t, o) => t + s.natives[o.id].warriors * 0.5, 0);
}

/** Odds of the attacker winning. */
export const odds = (a: number, d: number) => (a + d > 0 ? a / (a + d) : 0);

function battle(rng: Rng, a: number, d: number) {
  const win = rng() < odds(a, d);
  const ratio = win ? d / Math.max(1, a) : a / Math.max(1, d);
  return { win, winnerLoss: Math.min(0.6, 0.15 + 0.35 * ratio), loserLoss: 0.5 + rng() * 0.3 };
}

function killUnits(s: GameState, p: Party, frac: number, rng: Rng): string[] {
  const units = s.units.filter((u) => u.party === p.id);
  const n = Math.min(units.length, Math.round(units.length * frac));
  // soldiers stand in front
  const order = [...units].sort((x, y) => UNIT_STRENGTH[y.type] - UNIT_STRENGTH[x.type] + (rng() - 0.5) * 0.1);
  const dead = order.slice(0, n);
  s.units = s.units.filter((u) => !dead.includes(u));
  return dead.map((u) => UNIT_INFO[u.type].name.toLowerCase());
}

// ---------- commands ----------

function requireMet(s: GameState, w: World, id: string) {
  const n = nationById(w, id);
  const st = n ? s.natives[n.id] : undefined;
  return n && st?.met ? { n, st } : undefined;
}

export function gift(w: World, s: GameState, id: string, ducats: number): Result {
  const x = requireMet(s, w, id);
  if (!x) return fail('You have not met that people.');
  if (x.st.relation === 'war') return fail(`${nameOf(x.n)} will not receive envoys while at war. Make peace first.`);
  if (ducats > s.treasury) return fail('The treasury cannot afford it.');
  const e = envoy(s);
  s.treasury -= ducats;
  const gain = (ducats / 25) * (1 + 0.15 * skill(e, 'diplomacy')) * (crownSpec(s.crown).edge.gifts ?? 1);
  remember(s, x.st, 'Your gifts', gain);
  return { ok: true, message: `${e?.name ?? 'Your envoy'} brings gifts to ${nameOf(x.n)}. They are ${moodOf(x.st)} now.` };
}

export function proposeAlliance(w: World, s: GameState, id: string, rng: Rng): Result {
  const x = requireMet(s, w, id);
  if (!x) return fail('You have not met that people.');
  if (x.st.relation !== 'peace') return fail(`You are already ${moodOf(x.st)} with ${nameOf(x.n)}.`);
  if (x.st.attitude < 50) return fail(`${nameOf(x.n)} do not trust you enough yet (they must be friendly).`);
  const e = envoy(s);
  if (rng() < 0.5 + 0.1 * skill(e, 'diplomacy')) {
    x.st.relation = 'allied';
    return { ok: true, message: `${nameOf(x.n)} agree to an alliance, negotiated by ${e?.name ?? 'your envoy'}.` };
  }
  remember(s, x.st, 'An alliance pressed on them too soon', -5);
  return fail(`${nameOf(x.n)} turn the alliance down, for now.`);
}

/** Pay a people to fall on their rival. Secret, unless it gets out. */
export function incite(w: World, s: GameState, id: string, targetId: string, rng: Rng, log: Log): Result {
  const x = requireMet(s, w, id);
  const t = nationById(w, targetId);
  if (!x || !t) return fail('You have not met that people.');
  if (!x.n.rivals.includes(t.id) && !t.rivals.includes(x.n.id)) return fail(`${nameOf(x.n)} have no quarrel with ${nameOf(t)}.`);
  if (x.st.relation !== 'allied' && x.st.attitude < 30) return fail(`${nameOf(x.n)} will not fight for someone they barely trust.`);
  const cost = 400;
  if (s.treasury < cost) return fail(`It takes ${cost} ducats in gifts and arms.`);
  s.treasury -= cost;
  const e = envoy(s);
  const ts = s.natives[t.id];
  if (rng() < 0.45 + 0.1 * skill(e, 'diplomacy')) {
    const r = battle(rng, x.st.warriors, ts.warriors);
    const [win, lose] = r.win ? [x.st, ts] : [ts, x.st];
    win.warriors = Math.max(1, Math.round(win.warriors * (1 - r.winnerLoss * 0.5)));
    lose.warriors = Math.max(1, Math.round(lose.warriors * (1 - r.loserLoss * 0.5)));
    log('court', `${nameOf(x.n)} raid their old rivals ${nameOf(t)} with the arms you gave them, and ${r.win ? 'win' : 'are beaten back'}. Both peoples are weaker for it.`);
    if (rng() < 0.25) { remember(s, ts, `You armed ${nameOf(x.n)} against them`, -30); log('peril', `${nameOf(t)} learn who armed their enemies. They will not forget.`); }
    return { ok: true };
  }
  return fail(`${nameOf(x.n)} take the gifts, but do not go to war.`);
}

export function makePeace(w: World, s: GameState, id: string): Result {
  const x = requireMet(s, w, id);
  if (!x || x.st.relation !== 'war') return fail('You are not at war with them.');
  const cost = 500;
  if (s.treasury < cost) return fail(`Peace costs ${cost} ducats in gifts.`);
  s.treasury -= cost;
  x.st.relation = 'peace';
  x.st.attitude = Math.max(x.st.attitude, -30);
  return { ok: true, message: `${nameOf(x.n)} accept peace, warily.` };
}

export function incorporate(w: World, s: GameState, id: string, log: Log, ev: Ev): Result {
  const x = requireMet(s, w, id);
  if (!x) return fail('You have not met that people.');
  if (x.st.converted < 1) return fail('The mission has not yet won them over.');
  if (x.st.attitude < 40) return fail(`${nameOf(x.n)} are not friendly enough to join your realm.`);
  x.st.relation = 'subject';
  log('discovery', `${nameOf(x.n)} choose to live under your rule. Their lands are part of your realm now.`);
  ev({ kind: 'people', title: `The ${x.n.people} join your realm`, map: x.n.map, hex: x.n.siteHex, text: `After years of the mission among them, ${nameOf(x.n)} agree to become your subjects. No blood was spilled.` });
  return { ok: true };
}

const docked = (f: Fleet, n: NationDef) => f.at === n.site;

export function tradingPost(w: World, s: GameState, f: Fleet): Result {
  const n = f.at ? nationOfSite(w, f.at) : undefined;
  if (!n || !docked(f, n)) return fail('Dock at a people’s trading ground first.');
  const st = s.natives[n.id];
  if (st.post) return fail('There is already a trading post here.');
  if (st.relation === 'war' || st.attitude < 0) return fail(`${nameOf(n)} are too wary to allow it. Trade and gifts will help.`);
  const needs: [GoodId, number][] = [['timber', 20], ['tools', 10]];
  for (const [g, q] of needs) if ((f.cargo[g] ?? 0) < q) return fail(`A trading post needs ${needs.map(([gg, qq]) => `${qq} ${GOOD_INFO[gg].name.toLowerCase()}`).join(' and ')} in the hold.`);
  for (const [g, q] of needs) { f.cargo[g] = (f.cargo[g] ?? 0) - q; if (!f.cargo[g]) delete f.cargo[g]; }
  st.post = true;
  remember(s, st, 'The trading post', 10);
  s.prestige += 5;
  return { ok: true, message: `A trading post rises beside the ground of ${nameOf(n)}. Trade will grow.` };
}

/** A missionary from a docked fleet or a party beside the people's village. */
export function foundMission(w: World, s: GameState, from: { fleet?: Fleet; party?: Party }): Result {
  let n: NationDef | undefined;
  let unit;
  if (from.fleet) {
    n = from.fleet.at ? nationOfSite(w, from.fleet.at) : undefined;
    unit = s.units.find((u) => u.fleet === from.fleet!.id && u.type === 'missionary');
  } else if (from.party) {
    const g = GRIDS[from.party.map];
    n = w[from.party.map].nations.find((x) => [x.siteHex, ...x.villages].some((h) => h === from.party!.hex || g.neighbors(from.party!.hex).includes(h)));
    unit = s.units.find((u) => u.party === from.party!.id && u.type === 'missionary');
  }
  if (!n) return fail('Go to a people’s village or trading ground first.');
  if (!unit) return fail('A mission needs a missionary.');
  const st = s.natives[n.id];
  if (st.mission) return fail('There is already a mission among them.');
  if (st.relation === 'war' || st.attitude < -10) return fail(`${nameOf(n)} will not let friars live among them now.`);
  s.units = s.units.filter((u) => u !== unit);
  st.mission = true;
  return { ok: true, message: `Friars begin a mission among ${nameOf(n)}.` };
}

/** Attack a village (or the trading ground) beside the party. */
export function attack(w: World, s: GameState, p: Party, hex: number, rng: Rng, log: Log, ev: Ev): Result {
  const g = GRIDS[p.map];
  if (hex !== p.hex && !g.neighbors(p.hex).includes(hex)) return fail('The party must stand beside the village.');
  const n = w[p.map].nations.find((x) => x.siteHex === hex || x.villages.includes(hex));
  if (!n) return fail('There is no village there.');
  const st = s.natives[n.id];
  if (st.lost.includes(hex)) return fail('That village is already abandoned.');
  if (st.relation === 'subject') return fail(`${nameOf(n)} are already your subjects.`);
  const a = partyStrength(s, p) + alliedHelp(w, s, n);
  const d = defenceOf(w, n, st, hex);
  if (a <= 0) return fail('The party has no one who can fight.');
  const firstWar = st.relation !== 'war';
  st.relation = 'war';
  st.met = true;
  for (const [id, o] of Object.entries(s.natives)) if (id !== n.id && o.met && o.relation !== 'subject') remember(s, o, `You made war on ${nameOf(n)}`, -10);
  const r = battle(rng, a, d);
  const leader = personById(s, p.leader);
  const who = leader?.name ?? p.name;
  if (r.win) {
    const dead = killUnits(s, p, r.winnerLoss * 0.6, rng);
    st.warriors = Math.max(0, Math.round(st.warriors * (1 - r.loserLoss)));
    st.lost.push(hex);
    remember(s, st, 'You burned their villages', -40);
    const all = [n.siteHex, ...n.villages].every((h) => st.lost.includes(h));
    const loss = dead.length ? ` The party loses ${dead.join(', ')}.` : '';
    if (hex === n.siteHex || all || st.warriors < 3) {
      st.relation = 'subject';
      const loot = n.empire ? int(rng, 3000, 6000) : int(rng, 300, 900);
      s.treasury += loot;
      s.prestige += n.empire ? 40 : 10;
      log('peril', `${who} defeats ${nameOf(n)}.${loss} They submit to you and must pay tribute. Spoils worth ${loot} ducats are sent home.`);
      ev({ kind: 'people', title: n.empire ? 'An empire falls' : `The ${n.people} submit`, map: n.map, hex,
        text: `${who}’s party has defeated ${nameOf(n)}${n.empire ? ', the greatest power of these lands' : ''}. They are your subjects now, paying tribute. Every other people has heard of it.` });
    } else {
      log('peril', `${who} takes a village of ${nameOf(n)}; its people flee inland.${loss} ${nameOf(n)} still have ${st.warriors} warriors.`);
    }
    return { ok: true };
  }
  const dead = killUnits(s, p, r.loserLoss, rng);
  st.warriors = Math.max(1, Math.round(st.warriors * (1 - r.winnerLoss * 0.5)));
  remember(s, st, 'You attacked them', -30);
  let msg = `${nameOf(n)} beat back ${who}’s attack.${dead.length ? ` The party loses ${dead.join(', ')}.` : ''}`;
  if (leader && !s.units.some((u) => u.party === p.id) && rng() < 0.5) {
    leader.alive = false;
    leader.died = s.turn;
    s.parties = s.parties.filter((x) => x !== p);
    msg += ` ${leader.name} falls in the fighting.`;
  }
  log('peril', msg);
  if (firstWar) ev({ kind: 'lost', title: 'Repulsed', map: n.map, hex, text: msg });
  return { ok: true };
}

// ---------- sieges ----------

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A season of siege: one assault on the palisade. The colony can fall, and burn. */
function siegeSeason(s: GameState, n: NationDef, st: NativeState, rng: Rng, log: Log, ev: Ev) {
  const c = s.colonies.find((x) => x.id === st.siege!.colony);
  if (!c) { st.siege = null; return; }
  const who = cap(nameOf(n));
  const r = battle(rng, st.warriors * NATIVE.assault, palisade(s, c));
  if (r.win) {
    const dead = Math.min(c.pop, c.pop >= 6 ? 2 : 1);
    c.pop -= dead;
    for (const k of Object.keys(c.stock) as GoodId[]) c.stock[k] = Math.floor((c.stock[k] ?? 0) / 2);
    const soldier = s.units.find((u) => u.colony === c.id && u.type === 'infantry');
    if (soldier && rng() < 0.5) s.units = s.units.filter((u) => u !== soldier);
    st.warriors = Math.max(1, Math.round(st.warriors * (1 - r.winnerLoss * 0.5)));
    if (c.pop <= 0) {
      s.colonies = s.colonies.filter((x) => x !== c);
      s.units = s.units.filter((u) => u.colony !== c.id);
      for (const f of s.fleets) if (f.at === c.id) f.at = null;
      st.siege = null;
      remember(s, st, `Vengeance taken at ${c.name}`, 25);
      log('peril', `${who} storm the palisade of ${c.name} and burn it to the ground. No one is left.`);
      ev({ kind: 'lost', title: `${c.name} is burned`, map: c.map, hex: c.hex,
        text: `${who} broke into ${c.name} at dawn. The houses and the warehouse are ashes, the settlers dead or carried off. The coast is theirs again.` });
      return;
    }
    log('peril', `${who} break into ${c.name}: ${dead} settler${dead > 1 ? 's' : ''} killed and the warehouse plundered before they are driven out. ${c.pop} left.`);
  } else {
    st.warriors = Math.max(1, Math.round(st.warriors * (1 - r.loserLoss * 0.4)));
    log('peril', `${who} throw themselves at the palisade of ${c.name} and are beaten back.`);
  }
  // they go home when the siege has cost too much, when tempers cool, or for their own harvest
  const tooLong = s.turn - st.siege!.since >= NATIVE.siegeSeasons;
  if (st.warriors < NATIVE.siegeWarriors / 2 || (st.relation !== 'war' && st.attitude > NATIVE.hostile) || tooLong) {
    st.siege = null;
    log('peril', `${who} lift the siege of ${c.name} and melt back into the forest.${tooLong ? ' Their own fields need them.' : ''}`);
  }
}

// ---------- the season ----------

/** One season for every people: drift, missions, trade, encroachment, sickness, raids and ambushes. */
export function nativesSeason(w: World, s: GameState, log: Log, _ev: Ev) {
  const rng = mulberry32(hashSeed(s.seed, s.turn, 55));
  for (const n of allNations(w)) {
    const st = s.natives[n.id];
    if (!st) continue;
    const g = GRIDS[n.map];
    const land = new Set(territory(n));
    if (!st.met) {
      if (s.discovered.includes(n.site) || s.parties.some((p) => p.map === n.map && land.has(p.hex))) { st.met = true; st.contact = s.turn; }
      else continue;
    }
    if (st.contact == null) st.contact = s.turn;
    // attitude drifts back toward wary neutrality
    st.attitude += st.attitude > 5 ? -0.5 : st.attitude < -5 ? 1 : 0;
    for (const m of st.memory) m.amount *= NATIVE.memoryFade;
    st.memory = st.memory.filter((m) => Math.abs(m.amount) >= 1);
    if (st.post) remember(s, st, 'The trading post', 1);
    if (st.mission) {
      remember(s, st, 'The friars of the mission', 1);
      if (st.converted < 1) {
        st.converted = Math.min(1, st.converted + 0.035);
        if (st.converted >= 1) log('court', `The mission among ${nameOf(n)} has won most of them over. They might join your realm, if asked.`);
      }
    }
    // colonies on their land wear them down; friends trade them food
    const near = s.colonies.filter((c) => c.map === n.map && g.within(c.hex, 2).some((h) => land.has(h)));
    for (const c of near) {
      const k = st.relation === 'allied' ? 0.5 : st.post || st.mission ? 1 : 2.5;
      if (st.relation !== 'subject') remember(s, st, `Settlers at ${c.name} on their land`, -k);
      const friendly = st.relation === 'allied' || st.relation === 'subject' || (st.relation === 'peace' && st.attitude >= NATIVE.friendly);
      if (friendly && !st.siege) c.stock.food = (c.stock.food ?? 0) + (st.relation === 'peace' ? NATIVE.friendFood : NATIVE.allyFood);
    }
    // sickness: some seasons after first contact, an epidemic
    if (!st.epidemic && s.turn - st.contact >= 4 + (hashSeed(s.seed, n.siteHex) % 5)) {
      st.epidemic = true;
      const before = st.warriors;
      st.warriors = Math.max(1, Math.round(st.warriors * 0.6));
      remember(s, st, 'The sickness that came with your ships', -8);
      log('peril', `Sickness brought by the strangers’ ships spreads among ${nameOf(n)}. Many die, old and young; ${before - st.warriors} of their warriors among them.`);
    }
    // slow recovery
    if (st.relation !== 'subject' && s.turn % 4 === 0 && st.warriors < n.warriors) st.warriors = Math.min(n.warriors, st.warriors + 1);
    // tribute from subjects
    if (st.relation === 'subject') s.treasury += Math.round(st.warriors * 4 + 20);
    // a siege under way: an assault each season, until the colony falls or they give up
    if (st.siege) {
      siegeSeason(s, n, st, rng, log, _ev);
      continue;
    }
    if (!isHostile(st) || st.warriors < 2) continue;
    // furious and strong: lay siege to the weakest colony near their land
    const reach = s.colonies.filter((c) => c.map === n.map && g.within(c.hex, 4).some((h) => land.has(h)));
    if ((st.attitude <= NATIVE.furious || st.relation === 'war') && st.warriors >= NATIVE.siegeWarriors && reach.length && rng() < NATIVE.siegeChance) {
      const c = [...reach].sort((x, y) => palisade(s, x) - palisade(s, y))[0];
      st.siege = { colony: c.id, since: s.turn };
      log('peril', `${cap(nameOf(n))} surround ${c.name} with ${st.warriors} warriors. Nobody can leave the palisade to work the fields.`);
      _ev({ kind: 'lost', title: `${c.name} besieged`, map: c.map, hex: c.hex,
        text: `${cap(nameOf(n))} have had enough of the strangers. Their warriors surround ${c.name}: the fields go untended and every season they will try the palisade. Send soldiers and food by sea, make peace, or the colony may be burned.` });
      continue;
    }
    // otherwise they raid colonies near their land
    for (const c of reach) {
      if (rng() > 0.3) continue;
      const r = battle(rng, st.warriors * 0.5, palisade(s, c));
      if (r.win) {
        if (c.pop > 1) c.pop--;
        for (const k of Object.keys(c.stock) as GoodId[]) c.stock[k] = Math.floor((c.stock[k] ?? 0) / 2);
        log('peril', `${cap(nameOf(n))} raid ${c.name}: a colonist is killed and the warehouse plundered.`);
      } else {
        st.warriors = Math.max(1, st.warriors - 2);
        log('peril', `${cap(nameOf(n))} raid ${c.name}, but the settlers drive them off.`);
      }
    }
    // ambushes on parties in their land
    for (const p of [...s.parties]) {
      if (p.map !== n.map || !land.has(p.hex) || rng() > 0.25) continue;
      const r = battle(rng, st.warriors * 0.35, partyStrength(s, p) + 0.5);
      if (r.win) {
        const dead = killUnits(s, p, 0.5, rng);
        log('peril', `${nameOf(n)} ambush ${p.name}${dead.length ? `: ${dead.join(', ')} are killed` : ''}.`);
      } else log('peril', `${nameOf(n)} ambush ${p.name}, and are driven off.`);
    }
  }
  void isWater;
}
