/**
 * Slavery. Enslaved people are neither a named unit nor a plain cargo: a fleet carries a number of
 * captives in its hold, a colony holds a number of enslaved people who work its land. They are
 * bought at trading grounds on the African coast, taken when a village falls, sold in the ports of
 * southern Europe, or put to work in your colonies.
 *
 * The game states what happens and leaves the judgment to the player. Nothing here feeds the
 * score, an objective or an ambition; what it costs is in this file too: deaths at sea and in the
 * fields, flight, risings, the memory of the peoples it was done to, and a law that ends it.
 */
import { SLAVERY as S } from '../data/slavery';
import { REGION_OF } from '../data/trade';
import { isMilitary } from '../data/army';
import { mulberry32, hashSeed, int, type Rng } from './rng';
import { allNations, nationOfSite, remember } from './natives';
import { LEVELS } from './colony';
import { seasonOf, type Colony, type Fleet, type GameState, type NationDef, type PortDef, type World } from './types';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const captivesOf = (x: { captives?: number }) => x.captives ?? 0;
export const enslavedOf = (c: Colony) => c.enslaved ?? 0;
export const forbidden = (s: GameState) => s.laws.includes('abolition');
/** How many enslaved people a colony can hold. */
export const enslavedCap = (c: Colony) => LEVELS[c.level].cap * S.capPerSettler;
/** A trading ground on the African coast where captives are sold. */
export const groundOf = (w: World, port: PortDef | undefined): NationDef | undefined => (port?.kind === 'native' && port.map === 'old' ? nationOfSite(w, port.id) : undefined);
/** A European port where captives can be sold. */
export const buysCaptives = (port: PortDef | undefined) => !!port && port.kind !== 'native' && port.kind !== 'colony' && !port.inland && !!port.realm && S.sellRegions.includes(REGION_OF[port.realm]);

export function buyCaptives(w: World, s: GameState, f: Fleet, qty: number, free: number, port: PortDef | undefined): Result {
  const n = groundOf(w, port), st = n ? s.natives[n.id] : undefined;
  if (!n || !st) return fail('Captives are sold at the trading grounds of the African coast.');
  if (forbidden(s)) return fail('The law of your realm forbids the trade.');
  if (st.relation === 'war') return fail(`The ${n.people} will not trade with you while you are at war.`);
  const have = Math.floor(st.captives ?? 0);
  if (qty < 1 || have < qty) return fail(have ? `Only ${have} are offered here.` : 'None are offered here now.');
  if (free < qty * S.hold) return fail(`No room in the hold: each takes the space of ${S.hold} units of cargo.`);
  const cost = qty * S.buy;
  if (s.treasury < cost) return fail(`That costs ${cost} ducats.`);
  s.treasury -= cost;
  st.captives = have - qty;
  f.captives = captivesOf(f) + qty;
  s.flags.slaving ??= s.turn;
  // those sold were taken in this people's wars: their enemies learn whose ships carried them off
  for (const id of n.rivals) { const r = s.natives[id]; if (r?.met) remember(s, r, 'Their people carried off in your ships', -Math.max(1, Math.round(qty * S.rivalsRemember))); }
  return { ok: true, message: `${qty} captives are brought aboard ${f.name}.` };
}

export function sellCaptives(s: GameState, f: Fleet, qty: number, port: PortDef | undefined): Result {
  if (!buysCaptives(port)) return fail('There is no market for captives here.');
  if (forbidden(s)) return fail('The law of your realm forbids the trade.');
  if (qty < 1 || captivesOf(f) < qty) return fail('There are not so many aboard.');
  f.captives = captivesOf(f) - qty;
  // the money goes to the treasury; it is not counted as commerce for the score
  s.treasury += qty * S.sell;
  return { ok: true, message: `${qty} captives are sold in ${port!.name} for ${qty * S.sell} ducats.` };
}

/** Put the captives aboard ashore to work in the colony the fleet is docked at. */
export function landCaptives(s: GameState, f: Fleet, c: Colony | undefined): Result {
  if (!c) return fail('The fleet must be docked at one of your colonies.');
  if (forbidden(s)) return fail('The law of your realm forbids it.');
  const room = enslavedCap(c) - enslavedOf(c);
  const n = Math.min(room, captivesOf(f));
  if (n < 1) return fail(captivesOf(f) ? `${c.name} can hold no more.` : 'There are no captives aboard.');
  f.captives = captivesOf(f) - n;
  c.enslaved = enslavedOf(c) + n;
  return { ok: true, message: `${n} enslaved people are put to work at ${c.name}.` };
}

/** A village has fallen to your soldiers: some of its people are taken. */
export function takeCaptives(s: GameState, n: NationDef, rng: Rng): number {
  if (forbidden(s)) return 0;
  const st = s.natives[n.id];
  const taken = int(rng, S.taken[0], S.taken[1]);
  remember(s, st, 'Their people carried off in chains', S.takenRemember);
  s.flags.slaving ??= s.turn;
  return taken;
}

/** The law that ends it: everyone held is freed. Some stay as settlers; the rest go their own way. */
export function abolish(s: GameState, log: Log) {
  let freed = 0, stayed = 0;
  for (const c of s.colonies) {
    const n = enslavedOf(c);
    if (!n) continue;
    const join = Math.max(0, Math.min(LEVELS[c.level].cap - c.pop, Math.round(n * S.freedStay)));
    c.pop += join; c.enslaved = 0;
    c.loyalty = Math.min(100, c.loyalty + 4);
    freed += n; stayed += join;
  }
  for (const f of s.fleets) { freed += captivesOf(f); f.captives = 0; }
  for (const p of s.parties) { freed += captivesOf(p); p.captives = 0; }
  s.prestige += S.abolitionPrestige;
  log('court', freed
    ? `By your law the trade in people is ended and ${freed} are freed. ${stayed} stay in the colonies as settlers; the rest go where they choose.`
    : 'By your law the trade in people is forbidden in every land you rule.');
}

const share = (rng: Rng, n: number, rate: number) => { const x = n * rate; return Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0); };

/** Each season: deaths in the hold, the grounds refill from their own wars; each spring, deaths, flight and risings in the colonies. */
export function slaverySeason(w: World, s: GameState, log: Log) {
  const rng = mulberry32(hashSeed(s.seed, s.turn, 503));
  for (const f of s.fleets) {
    const n = captivesOf(f);
    if (!n) continue;
    const dead = share(rng, n, f.at ? S.portDeaths : S.seaDeaths);
    if (dead) { f.captives = n - dead; log('peril', `${dead} of the captives in the hold of ${f.name} die${dead === 1 ? 's' : ''} this season.`); }
  }
  for (const n of allNations(w)) {
    const st = s.natives[n.id];
    if (!st || n.map !== 'old' || st.relation === 'subject') continue;
    st.captives = Math.min(S.groundMax, (st.captives ?? 0) + (st.feud ? S.groundWar : S.groundPeace));
  }
  if (seasonOf(s.turn) !== 0) return;
  for (const c of s.colonies) {
    let n = enslavedOf(c);
    if (!n) continue;
    const dead = share(rng, n, S.fieldDeaths);
    const fled = rng() < S.flight ? Math.min(n - dead, int(rng, 1, 2)) : 0;
    n -= dead + fled;
    if (dead || fled) log('peril', `${c.name}: ${[dead ? `${dead} of the enslaved died this year` : '', fled ? `${fled} fled into the country` : ''].filter(Boolean).join(', and ')}.`);
    if (n > c.pop * S.outnumber && rng() < S.rising) {
      const garrison = s.units.filter((u) => u.colony === c.id && isMilitary(u.type)).length;
      if (garrison * S.perCompany >= n) {
        const lost = Math.ceil(n * 0.2);
        n -= lost; c.loyalty = Math.max(0, c.loyalty - 4);
        log('peril', `The enslaved of ${c.name} rise against their masters. The garrison puts the rising down; ${lost} are killed.`);
      } else {
        const gone = Math.ceil(n * 0.5);
        n -= gone;
        for (const k of Object.keys(c.stock) as (keyof Colony['stock'])[]) c.stock[k] = Math.floor((c.stock[k] ?? 0) / 2);
        if (c.pop > 1) c.pop--;
        c.loyalty = Math.max(0, c.loyalty - 8);
        log('peril', `The enslaved of ${c.name} rise, and there are too few soldiers to stop them. ${gone} fight their way out and found a free village in the hills; the warehouses burn.`);
      }
    }
    c.enslaved = Math.max(0, n);
  }
}
