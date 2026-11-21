// How big rival colonies get, by year, with nobody playing: npx vite-node tools/rivalsizes.ts [seed]
import { newGame, endTurn } from '../src/sim/game';
import { rivalsOf } from '../src/data/rivals';
import { rivalScore } from '../src/sim/rivals';
import { yearOf } from '../src/sim/types';
const { world, state: s } = newGame(Number(process.argv[2] ?? 1), 1650, 'spain');
let mark = 1510;
while (!s.ended) {
  s.events = [];
  endTurn(world, s);
  if (yearOf(s.turn) >= mark) {
    console.log(mark, rivalsOf('spain').map((r) => { const sc = rivalScore(s, r.id); const cols = s.rivalColonies.filter((c) => c.crown === r.id); return `${r.id} ${sc.colonies}c pop ${sc.pop} terr ${sc.territory} com ${sc.commerce} [${cols.map((c) => c.level[0] + c.pop).join(' ')}]`; }).join(' | '));
    mark += mark < 1550 ? 20 : 50;
  }
}
