import { newGame, endTurn } from '../src/sim/game';
import { rivalScore } from '../src/sim/rivals';
import { RIVALS } from '../src/data/rivals';
for (const seed of [1492, 7]) {
  const { world, state } = newGame(seed);
  const t0 = Date.now();
  for (let t = 0; t < 60; t++) {
    endTurn(world, state);
    if (t % 12 === 11) console.log(seed, `${1492 + Math.floor((t + 1) / 4)}`, RIVALS.map((r) => { const sc = rivalScore(state, r.id); return `${r.id}: ${sc.colonies} col (${state.rivalColonies.filter((c) => c.crown === r.id && c.map === 'new').length} west), pop ${sc.pop}, posts ${state.rivals[r.id].posts.length}, score ${sc.total}`; }).join(' | '));
  }
  console.log('  ms per season', ((Date.now() - t0) / 60).toFixed(0), 'ships at sea', state.rivalShips.length);
}
