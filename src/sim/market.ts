import type { GoodId } from '../data/goods';
import type { MarketGood } from './types';

/** How sharply prices react to stock. */
const K = 0.8;
const MIN_F = 0.3;
const MAX_F = 3.2;

/**
 * Patrician-style price: the fewer turns of demand in stock, the higher the price.
 * P = base * (ref / (stock + 1))^k, clamped to [0.3, 3.2] x base.
 */
export function unitPrice(m: MarketGood, stock = m.stock): number {
  const f = Math.pow(m.ref / (Math.max(0, stock) + 1), K);
  return m.base * (m.demand ?? 1) * Math.min(MAX_F, Math.max(MIN_F, f));
}

/** Total cost to buy qty units, unit by unit (each purchase lowers the stock). */
export function buyCost(m: MarketGood, qty: number, spread = 0.08): number {
  let t = 0;
  for (let k = 0; k < qty; k++) t += Math.round(unitPrice(m, m.stock - k) * (1 + spread));
  return t;
}

/** Total proceeds for selling qty units (each sale raises the stock). */
export function sellValue(m: MarketGood, qty: number, spread = 0.08): number {
  let t = 0;
  for (let k = 0; k < qty; k++) t += Math.round(unitPrice(m, m.stock + k) * (1 - spread));
  return t;
}

/** Advance a market one season. Europe's consumption of new goods grows with adoption. */
export function tickMarket(m: MarketGood, adoption = 1): void {
  const consume = m.consumption * (0.35 + 0.65 * adoption);
  m.stock = Math.max(0, m.stock + m.production - consume);
  // other traders slowly nudge stock toward normal
  m.stock += (m.ref - m.stock) * 0.06;
  m.stock = Math.min(m.stock, m.ref * 5);
  m.history.push(Math.round(unitPrice(m)));
  if (m.history.length > 16) m.history.shift();
}

export function makeMarket(base: number, ref: number, consumption: number, production: number, stock = ref): MarketGood {
  const m: MarketGood = { base, ref, consumption, production, stock, history: [] };
  m.history.push(Math.round(unitPrice(m)));
  return m;
}

export type MarketBook = Partial<Record<GoodId, MarketGood>>;
