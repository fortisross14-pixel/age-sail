import { newGame, endTurn } from '../src/sim/game';
import { rivalScore } from '../src/sim/rivals';
import { rivalsOf } from '../src/data/rivals';
import { yearOf } from '../src/sim/types';
for (const seed of [1492, 7]) {
  const { world, state } = newGame(seed);
  const t0 = Date.now();
  const turns = 40;
  for (let t = 0; t < turns; t++) {
    endTurn(world, state);
    if (t % 10 === 9) console.log(seed, yearOf(state.turn), rivalsOf(state.crown).map((r) => { const sc = rivalScore(state, r.id); return `${r.id}: ${sc.colonies} col (${state.rivalColonies.filter((c) => c.crown === r.id && c.map === 'new').length} west), pop ${sc.pop}, score ${sc.total}`; }).join(' | '));
  }
  console.log('  ms per turn', ((Date.now() - t0) / turns).toFixed(0), 'ships at sea', state.rivalShips.length);
}
