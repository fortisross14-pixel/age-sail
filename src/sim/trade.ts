/**
 * The living market: factories that trade for you in European ports, regional tastes and shocks
 * that move demand. (Rival cargoes come home in their own ships: see `rivals.ts`.)
 */
import { GOODS, GOOD_INFO, type GoodId } from '../data/goods';
import { FACTORY, REGION_OF, REGION_NAME, TASTE, SHOCKS, SHOCK_CHANCE, type Region } from '../data/trade';
import type { RealmId } from '../data/realms';
import { mulberry32, hashSeed, int, pick } from './rng';
import { buyCost, sellValue, unitPrice } from './market';
import type { Fleet, GameState, MarketGood, PortDef, World } from './types';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
type Log = (kind: 'trade', text: string) => void;

const REGIONS: Region[] = ['iberia', 'france', 'north', 'mediterranean', 'islam'];

/** How much more (or less) a region pays for a good than the usual, with any shock under way. */
export function demandFactor(s: GameState, realm: RealmId | undefined, g: GoodId): number {
  if (!realm) return 1;
  const region = REGION_OF[realm];
  let f = TASTE[region][g] ?? 1;
  for (const sh of s.shocks) {
    if (sh.region !== region) continue;
    const k = SHOCKS.find((x) => x.id === sh.kind);
    if (k && (k.goods === 'all' || k.goods.includes(g))) f *= k.factor;
  }
  return f;
}

/** The shocks under way in a region, for the market screen. */
export function shocksIn(s: GameState, realm: RealmId | undefined) {
  if (!realm) return [];
  return s.shocks.filter((x) => x.region === REGION_OF[realm]).map((x) => ({ ...x, spec: SHOCKS.find((k) => k.id === x.kind)! }));
}

export const shockTitle = (kind: string, region: string) => (SHOCKS.find((k) => k.id === kind)?.title ?? kind).replace('{region}', REGION_NAME[region as Region]);

/** Old shocks end, and now and then a new one begins somewhere. */
export function shockSeason(s: GameState, log: Log) {
  for (const sh of s.shocks.filter((x) => x.until <= s.turn)) log('trade', `${shockTitle(sh.kind, sh.region)} is over: trade in ${REGION_NAME[sh.region as Region]} returns to normal.`);
  s.shocks = s.shocks.filter((x) => x.until > s.turn);
  const rng = mulberry32(hashSeed(s.seed, s.turn, 131));
  if (s.shocks.length >= 2 || rng() > SHOCK_CHANCE) return;
  const k = pick(rng, SHOCKS);
  const region = pick(rng, REGIONS.filter((r) => !s.shocks.some((x) => x.region === r)));
  s.shocks.push({ kind: k.id, region, since: s.turn, until: s.turn + int(rng, k.seasons[0], k.seasons[1]) });
  log('trade', k.text.replace('{region}', REGION_NAME[region]));
}

// ---------- factories ----------

export const factoryAt = (s: GameState, city: string) => s.factories.find((f) => f.city === city);
const foreign = (s: GameState, city: string) => !s.cities[city];
export const factoryCost = (s: GameState, city: string) => (foreign(s, city) ? FACTORY.foreignCost : FACTORY.cost);
/** What a factor trades each season in a market. */
export const factoryPace = (m: MarketGood) => Math.max(FACTORY.minPace, Math.round(m.ref * FACTORY.pace));

export function openFactory(w: World, s: GameState, port: PortDef | undefined): Result {
  if (!port || port.map !== 'old' || port.kind === 'native' || port.kind === 'colony') return fail('Factories can be opened in European ports.');
  if (!s.markets[port.id]) return fail(`${port.name} has no market.`);
  if (factoryAt(s, port.id)) return fail(`You already keep a factor in ${port.name}.`);
  const cost = factoryCost(s, port.id);
  if (s.treasury < cost) return fail(`A factory in ${port.name} costs ${cost} ducats.`);
  s.treasury -= cost;
  s.factories.push({ city: port.id, stock: {}, orders: {}, opened: s.turn, last: { sold: 0, bought: 0 } });
  void w;
  return { ok: true, message: `Your factor opens a warehouse in ${port.name}. Leave goods there to sell slowly, or have them buy cheap.` };
}

export function setOrder(s: GameState, city: string, g: GoodId, mode: 'sell' | 'buy' | 'hold'): Result {
  const f = factoryAt(s, city);
  if (!f) return fail('No factory there.');
  if (mode === 'hold') delete f.orders[g]; else f.orders[g] = mode;
  return { ok: true };
}

/** Leave goods with the factor (qty > 0) or take them aboard (qty < 0). */
export function factoryTransfer(s: GameState, fleet: Fleet, g: GoodId, qty: number, room: number): Result {
  const f = fleet.at ? factoryAt(s, fleet.at) : undefined;
  if (!f) return fail('The fleet must be in a port where you keep a factor.');
  if (qty > 0) {
    const n = Math.min(qty, fleet.cargo[g] ?? 0);
    if (n <= 0) return fail('Nothing of that aboard.');
    fleet.cargo[g] = (fleet.cargo[g] ?? 0) - n;
    if (!fleet.cargo[g]) delete fleet.cargo[g];
    f.stock[g] = (f.stock[g] ?? 0) + n;
    return { ok: true, message: `${n} ${GOOD_INFO[g].name.toLowerCase()} left with the factor.` };
  }
  const n = Math.min(-qty, Math.floor(f.stock[g] ?? 0), room);
  if (n <= 0) return fail('Nothing to take, or no room aboard.');
  f.stock[g] = (f.stock[g] ?? 0) - n;
  if (!f.stock[g]) delete f.stock[g];
  fleet.cargo[g] = (fleet.cargo[g] ?? 0) + n;
  return { ok: true, message: `${n} ${GOOD_INFO[g].name.toLowerCase()} taken aboard.` };
}

/**
 * A season for every factor: sell a little of what they hold while the price is fair, buy what they
 * were told to while it is cheap, and pay their wages. Slow selling is how you avoid flooding a market.
 */
export function factorySeason(w: World, s: GameState, spread: (city: string) => number, adopt: (g: GoodId, qty: number) => void, log: Log) {
  const notes: string[] = [];
  for (const f of s.factories) {
    const book = s.markets[f.city];
    f.last = { sold: 0, bought: 0 };
    s.treasury -= FACTORY.upkeep;
    if (!book) continue;
    const sp = spread(f.city) + (foreign(s, f.city) ? FACTORY.foreignDues : 0);
    for (const g of GOODS) {
      const m = book[g];
      const mode = f.orders[g];
      if (!m || !mode) continue;
      const pace = factoryPace(m);
      if (mode === 'sell') {
        let n = Math.min(pace, Math.floor(f.stock[g] ?? 0));
        while (n > 0 && unitPrice(m, m.stock + n - 1) < m.base * FACTORY.sellFloor) n--;
        if (n <= 0) continue;
        const v = sellValue(m, n, sp);
        m.stock += n;
        f.stock[g] = (f.stock[g] ?? 0) - n;
        if (!f.stock[g]) delete f.stock[g];
        s.treasury += v;
        s.revenue += v;
        f.last.sold += v;
        adopt(g, n);
      } else {
        const have = f.stock[g] ?? 0;
        let n = Math.min(pace, Math.max(0, FACTORY.buyTarget - have), Math.floor(m.stock));
        while (n > 0 && (unitPrice(m, m.stock - n + 1) > m.base * FACTORY.buyCeiling || buyCost(m, n, sp) > s.treasury)) n--;
        if (n <= 0) continue;
        const c = buyCost(m, n, sp);
        m.stock -= n;
        f.stock[g] = have + n;
        s.treasury -= c;
        f.last.bought += c;
      }
    }
    const port = w.old.ports.find((p) => p.id === f.city);
    if (f.last.sold || f.last.bought) notes.push(`${port?.name ?? f.city}: ${f.last.sold ? `sold for ${f.last.sold}` : ''}${f.last.sold && f.last.bought ? ', ' : ''}${f.last.bought ? `bought for ${f.last.bought}` : ''}`);
  }
  if (notes.length) log('trade', `Your factors report. ${notes.join('; ')} ducats.`);
}
