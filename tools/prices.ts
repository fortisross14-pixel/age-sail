/** Prices over a long game (no player trade): npx vite-node tools/prices.ts */
import { newGame, endTurn } from '../src/sim/game';
import { unitPrice } from '../src/sim/market';
import { yearOf } from '../src/sim/types';
const { world, state } = newGame(1492);
const cities = ['seville', 'lisbon', 'london', 'antwerp', 'genoa', 'lubeck', 'tunis'].filter((c) => state.markets[c]);
const goods = ['sugar', 'tobacco', 'furs', 'wine', 'food', 'tools'] as const;
for (let t = 0; t < 120; t++) {
  endTurn(world, state);
  if (t % 30 === 29) {
    console.log(yearOf(state.turn), 'shocks:', state.shocks.map((s) => `${s.kind}@${s.region}`).join(', ') || 'none');
    for (const c of cities) console.log('  ', c.padEnd(9), goods.map((g) => { const m = state.markets[c][g]; return m ? `${g} ${(unitPrice(m) / m.base).toFixed(2)}` : ''; }).join('  '));
  }
}
void world;
