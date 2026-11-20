/**
 * Europe: how the other realms regard you, treaties with them, the wars they fight among
 * themselves (which you may join), letters of marque, corsairs, and the Levant spice trade.
 * The four rival crowns keep their regard for you in `s.rivals`; everything else is in `s.europe`.
 */
import { DIPLOMACY as D, QUARRELS, CORSAIR_REALMS, TREATY_INFO, TREATY_ORDER, type Treaty } from '../data/diplomacy';
import { REALMS, realmSpec, type RealmId } from '../data/realms';
import { RIVAL_ECON, rivalsOf, type CrownId } from '../data/rivals';
import { REGION_OF } from '../data/trade';
import { cityById } from '../data/europe';
import { GRIDS } from './hex';
import { mulberry32, hashSeed, int, pick, type Rng } from './rng';
import { envoy } from './natives';
import { skill } from './court';
import { realmMods } from './dynasty';
import { fleetGuns } from './rivals';
import type { EuroWar, Fleet, GameState, RealmState, World } from './types';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const clamp = (v: number) => Math.max(-100, Math.min(100, v));
const Cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const name = (id: string) => realmSpec(id as RealmId).name;

export function initEurope(crown: CrownId): Record<string, RealmState> {
  return Object.fromEntries(REALMS.filter((r) => r.id !== crown).map((r) => [r.id, {
    attitude: CORSAIR_REALMS.includes(r.id) ? D.corsairRest : D.rest, treaty: 'none' as Treaty, envoy: -99, tribute: false,
  }]));
}

const isRival = (s: GameState, realm: string) => realm !== s.crown && !!s.rivals[realm as CrownId] && rivalsOf(s.crown).some((r) => r.id === realm);
/** How a realm regards you: a rival crown's is kept with the rest of what is known of it. */
export const regardOf = (s: GameState, realm: string) => (isRival(s, realm) ? s.rivals[realm as CrownId].attitude : s.europe[realm]?.attitude ?? 0);
function adjust(s: GameState, realm: string, d: number) {
  if (isRival(s, realm)) s.rivals[realm as CrownId].attitude = clamp(s.rivals[realm as CrownId].attitude + d);
  else if (s.europe[realm]) s.europe[realm].attitude = clamp(s.europe[realm].attitude + d);
}
export const treatyWith = (s: GameState, realm: string | undefined): Treaty => (realm ? s.europe[realm]?.treaty ?? 'none' : 'none');
const atLeast = (t: Treaty, min: Treaty) => TREATY_ORDER.indexOf(t) >= TREATY_ORDER.indexOf(min);
/** A pact or an alliance: they will not attack you. */
export const pacted = (s: GameState, realm: string | undefined) => atLeast(treatyWith(s, realm), 'pact');
/** The war you have joined against this realm, if any: its ports are closed to you. */
export const enemyOf = (s: GameState, realm: string | undefined) => !!realm && s.euroWars.some((w) => w.side && (w.a === realm || w.b === realm) && w.side !== realm);
/** What a treaty takes off the haggling margin in a port. */
export function treatySpread(s: GameState, port: string | null | undefined): number {
  const realm = port ? cityById(port)?.realm : undefined;
  const t = treatyWith(s, realm);
  return t === 'alliance' ? D.allySpread : t === 'none' ? 0 : D.tradeSpread;
}
export const warsOf = (s: GameState, realm: string) => s.euroWars.filter((w) => w.a === realm || w.b === realm);

// ---------- what you can do ----------

function heard(s: GameState, realm: string): Result | null {
  const st = s.europe[realm];
  if (!st || realm === s.crown) return fail('No such realm.');
  if (enemyOf(s, realm)) return fail(`You are at war with ${name(realm)}.`);
  if (isRival(s, realm) && s.rivals[realm as CrownId].relation === 'war') return fail(`You are at war with ${name(realm)}: make peace first, in Court, Crowns.`);
  return null;
}

/** Send an envoy: a little regard, more with a good diplomat. */
export function sendEnvoy(s: GameState, realm: string): Result {
  const no = heard(s, realm); if (no) return no;
  const st = s.europe[realm];
  if (s.turn - st.envoy < D.envoyEvery) return fail(`Your last envoy to ${name(realm)} has barely come home.`);
  if (s.treasury < D.envoyCost) return fail(`An embassy costs ${D.envoyCost} ducats.`);
  const e = envoy(s);
  s.treasury -= D.envoyCost;
  st.envoy = s.turn;
  const gain = D.envoyGain + 2 * skill(e, 'diplomacy');
  adjust(s, realm, gain);
  return { ok: true, message: `${e ? e.name : 'Your envoy'} is well received in ${name(realm)}.` };
}

export function sendGift(s: GameState, realm: string): Result {
  const no = heard(s, realm); if (no) return no;
  if (s.treasury < D.giftCost) return fail(`A gift worthy of ${name(realm)} costs ${D.giftCost} ducats.`);
  s.treasury -= D.giftCost;
  adjust(s, realm, D.giftGain);
  return { ok: true, message: `${Cap(name(realm))} thinks better of you.` };
}

/** What stands in the way of a treaty, if anything. */
export function treatyOpen(s: GameState, realm: string, t: Exclude<Treaty, 'none'>): { ok: boolean; why?: string } {
  const st = s.europe[realm];
  if (!st) return { ok: false, why: 'No such realm.' };
  if (atLeast(st.treaty, t)) return { ok: false, why: 'Already agreed.' };
  if (t === 'alliance' && !s.research.known.includes('ambassadors')) return { ok: false, why: 'Alliances need resident ambassadors (Research).' };
  if (regardOf(s, realm) < TREATY_INFO[t].need) return { ok: false, why: `They must think better of you first (${TREATY_INFO[t].need} or more).` };
  if (s.turn - st.envoy < D.envoyEvery) return { ok: false, why: 'Your envoys have only just been heard.' };
  return { ok: true };
}

export function proposeTreaty(s: GameState, realm: string, t: Exclude<Treaty, 'none'>, log: Log): Result {
  const no = heard(s, realm); if (no) return no;
  const open = treatyOpen(s, realm, t);
  if (!open.ok) return fail(open.why ?? 'Not possible.');
  const st = s.europe[realm];
  const rng = mulberry32(hashSeed(s.seed, s.turn, st.envoy, 401));
  st.envoy = s.turn;
  const chance = 0.5 + (regardOf(s, realm) - TREATY_INFO[t].need) / 60 + 0.06 * skill(envoy(s), 'diplomacy') + Math.max(0, s.prestige) / 500;
  if (rng() >= chance) { adjust(s, realm, D.refused); return fail(`${Cap(name(realm))} declines, for now. Regard for you cools a little.`); }
  st.treaty = t;
  s.prestige += t === 'alliance' ? 6 : 2;
  log('court', `${TREATY_INFO[t].name} with ${name(realm)}. ${TREATY_INFO[t].blurb}`);
  return { ok: true, message: `${TREATY_INFO[t].name} with ${name(realm)}.` };
}

export function breakTreaty(s: GameState, realm: string, log: Log): Result {
  const st = s.europe[realm];
  if (!st || st.treaty === 'none') return fail('There is no treaty to break.');
  log('court', `You renounce the ${TREATY_INFO[st.treaty].name.toLowerCase()} with ${name(realm)}. Every court in Europe takes note.`);
  st.treaty = 'none';
  s.prestige -= D.breakPrestige;
  adjust(s, realm, D.breakRegard);
  return { ok: true, message: `The treaty is broken. −${D.breakPrestige} prestige.` };
}

/** Take a side in a war between two realms: the other side's ports close to you. */
export function joinWar(s: GameState, warId: number, side: string, log: Log): Result {
  const w = s.euroWars.find((x) => x.id === warId);
  if (!w || (side !== w.a && side !== w.b)) return fail('No such war.');
  if (w.side) return fail('You have already taken a side.');
  const foe = side === w.a ? w.b : w.a;
  if (pacted(s, foe)) return fail(`You have a treaty with ${name(foe)}: break it first.`);
  w.side = side;
  adjust(s, side, D.joinFriend);
  adjust(s, foe, D.joinFoe);
  if (s.europe[foe]) s.europe[foe].treaty = 'none';
  log('court', `You enter the war over ${w.cause} on the side of ${name(side)}. The ports of ${name(foe)} are closed to your ships.`);
  return { ok: true, message: `At war beside ${name(side)}.` };
}

export function setMarque(s: GameState, on: boolean): Result {
  s.marque = on;
  return { ok: true, message: on ? 'Letters of marque are issued: your captains may take the enemy’s ships where they find them.' : 'The letters of marque are recalled.' };
}

export function setTribute(s: GameState, realm: string, on: boolean): Result {
  const st = s.europe[realm];
  if (!st || !CORSAIR_REALMS.includes(realm as RealmId)) return fail('Only the corsair states take tribute.');
  st.tribute = on;
  return { ok: true, message: on ? `You will pay ${name(realm)} ${D.tribute} ducats a season, and their corsairs will leave your ships alone.` : `The tribute to ${name(realm)} is stopped.` };
}

/** Is there anyone your privateers may lawfully take? */
export const hasEnemy = (s: GameState) => s.euroWars.some((w) => w.side) || rivalsOf(s.crown).some((r) => s.rivals[r.id].relation === 'war');
/** Will this realm's corsairs take your ships? */
export const corsairsHunt = (s: GameState, realm: string) => CORSAIR_REALMS.includes(realm as RealmId) && !s.europe[realm]?.tribute && !pacted(s, realm) && (regardOf(s, realm) < 0 || enemyOf(s, realm));

// ---------- the season ----------

function corsairs(w: World, s: GameState, rng: Rng, log: Log, onFleetLost: (f: Fleet, why: string) => void) {
  const g = GRIDS.old;
  for (const realm of CORSAIR_REALMS) {
    if (realm === s.crown || !corsairsHunt(s, realm)) continue;
    const bases = w.old.ports.filter((p) => p.realm === realm && !p.inland);
    for (const f of [...s.fleets]) {
      if (f.map !== 'old' || f.at || !bases.some((b) => g.distance(b.hex, f.hex) <= D.corsairReach) || rng() >= D.corsairChance) continue;
      const a = fleetGuns(s, f), d = int(rng, D.corsairStrength[0], D.corsairStrength[1]);
      if (rng() < a / (a + d)) {
        const prize = int(rng, 150, 400);
        s.treasury += prize; s.prestige += 2;
        log('peril', `Corsairs out of ${pick(rng, bases).name} fall on ${f.name} and are beaten off, leaving a galley behind. Prize money: ${prize} ducats.`);
      } else if (f.ships.length > 1) {
        const lost = f.ships[int(rng, 0, f.ships.length - 1)];
        f.ships = f.ships.filter((x) => x !== lost);
        for (const k of Object.keys(f.cargo) as (keyof Fleet['cargo'])[]) f.cargo[k] = Math.floor((f.cargo[k] ?? 0) / 2);
        log('peril', `Corsairs of ${name(realm)} take the ${lost.name} from ${f.name}, with half the cargo. Tribute or a treaty would stop them.`);
      } else if (rng() < 0.4) onFleetLost(f, `Corsairs of ${name(realm)} take ${f.name}, ship, cargo and crew.`);
      else {
        for (const k of Object.keys(f.cargo) as (keyof Fleet['cargo'])[]) f.cargo[k] = 0;
        for (const x of f.ships) x.hull = Math.max(10, x.hull - 25);
        log('peril', `Corsairs of ${name(realm)} plunder ${f.name} and let her go, stripped. Tribute or a treaty would stop them.`);
      }
    }
  }
}

/** One season of Europe: regard drifts, quarrels become wars, wars end, allies and enemies do their part. */
export function europeSeason(w: World, s: GameState, log: Log, onFleetLost: (f: Fleet, why: string) => void) {
  const rng = mulberry32(hashSeed(s.seed, s.turn, 407));
  const regard = realmMods(s).regard;
  for (const [id, st] of Object.entries(s.europe)) {
    if (isRival(s, id)) continue;
    const rest = (CORSAIR_REALMS.includes(id as RealmId) ? D.corsairRest : D.rest) + regard + (s.dynasty.ties.includes(id) ? D.tie : 0) + (st.treaty !== 'none' ? 10 : 0);
    st.attitude = clamp(st.attitude + (st.attitude > rest ? -0.3 : st.attitude < rest ? 0.3 : 0));
    if (st.tribute) s.treasury -= D.tribute;
  }

  // a quarrel becomes a war
  if (s.euroWars.length < D.maxWars && rng() < D.warChance) {
    const busy = new Set(s.euroWars.flatMap((x) => [x.a, x.b]));
    const open = QUARRELS.filter(([a, b]) => a !== s.crown && b !== s.crown && !busy.has(a) && !busy.has(b));
    if (open.length) {
      const [a, b, cause] = pick(rng, open);
      s.euroWars.push({ id: s.nextId++, a, b, cause, since: s.turn, until: s.turn + int(rng, D.warLength[0], D.warLength[1]), side: null });
      const region = REGION_OF[a];
      if (!s.shocks.some((x) => x.region === region)) s.shocks.push({ kind: 'war', region, since: s.turn, until: s.turn + 8 });
      const levant = a === 'ottoman' && (b === 'venice' || b === 'genoa');
      log('court', `War in Europe: ${name(a)} and ${name(b)} fight over ${cause}.${levant ? ' The spice road through the Levant is cut: pepper will be dear in Italy.' : ''} You may take a side in Court, Europe.`);
      for (const side of [a, b]) if (treatyWith(s, side) === 'alliance') log('court', `Your ally ${name(side)} looks to you for help.`);
    }
  }

  // wars cost those who fight them, and end
  for (const war of [...s.euroWars]) {
    for (const side of [war.a, war.b]) if (isRival(s, side)) s.rivals[side as CrownId].treasury -= RIVAL_ECON.warCost;
    if (war.side) s.treasury -= D.joinCost;
    if (s.turn < war.until) continue;
    s.euroWars = s.euroWars.filter((x) => x !== war);
    const aWins = rng() < 0.5 + (war.side === war.a ? D.joinEdge : war.side === war.b ? -D.joinEdge : 0);
    const [win, lose] = aWins ? [war.a, war.b] : [war.b, war.a];
    log('court', `Peace in Europe: the war over ${war.cause} ends, and ${name(win)} has the better of ${name(lose)}.`);
    if (!war.side) continue;
    if (war.side === win) { s.prestige += D.winPrestige; s.treasury += D.winDucats; adjust(s, win, 15); log('court', `You chose the winning side: +${D.winPrestige} prestige, and ${D.winDucats} ducats of the indemnity.`); }
    else { s.prestige -= D.losePrestige; log('court', `You chose the losing side: −${D.losePrestige} prestige.`); }
    adjust(s, war.side === war.a ? war.b : war.a, 20); // the peace mends a little
  }

  // allies: a rival crown fights your enemies overseas, any other realm pays toward your wars
  const foes = rivalsOf(s.crown).filter((r) => s.rivals[r.id].relation === 'war').map((r) => r.id);
  for (const [id, st] of Object.entries(s.europe)) {
    if (st.treaty !== 'alliance' || !foes.length) continue;
    if (!isRival(s, id)) { s.treasury += D.subsidy; continue; }
    const ally = s.rivals[id as CrownId];
    for (const foe of foes) {
      if (foe === id || ally.wars.includes(foe)) continue;
      ally.wars.push(foe); s.rivals[foe].wars.push(id as CrownId);
      ally.rivalWarSince[foe] = s.rivals[foe].rivalWarSince[id as CrownId] = s.turn;
      ally.toward[foe] = s.rivals[foe].toward[id as CrownId] = -60;
      log('court', `${Cap(name(id))}, your ally, declares war on ${name(foe)}.`);
    }
  }

  // letters of marque: prizes while there is an enemy, and now and then a neutral's ship by mistake
  if (s.marque && hasEnemy(s)) {
    const prize = int(rng, D.marque[0], D.marque[1]);
    s.treasury += prize;
    if (rng() < D.marqueProtest) {
      const neutral = pick(rng, Object.keys(s.europe).filter((id) => !enemyOf(s, id) && !(isRival(s, id) && s.rivals[id as CrownId].relation === 'war')));
      adjust(s, neutral, -8);
      log('court', `Your privateers have taken a ship of ${name(neutral)} “by mistake”. Their ambassador protests.`);
    }
  }

  corsairs(w, s, rng, log, onFleetLost);

  // the Levant trade: Venice and Genoa fill Italy's spice markets, unless the Sultan is at war with them
  const cut = s.euroWars.some((x) => (x.a === 'ottoman' || x.b === 'ottoman') && ['venice', 'genoa'].some((v) => x.a === v || x.b === v));
  for (const p of w.old.ports) {
    if (!p.realm || REGION_OF[p.realm] !== 'mediterranean') continue;
    const m = s.markets[p.id]?.spices;
    if (m) m.stock = cut ? m.stock * D.levantDearth : Math.min(m.ref * 1.6, m.stock + m.ref * D.levantFlow);
  }
}

export type { EuroWar };
