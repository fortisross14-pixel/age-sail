// Plays each crown for N seasons with no player orders: rival activity, treasury, season cost and save size.
import { newGame, endTurn } from '../src/sim/game';
import { CROWNS, rivalsOf } from '../src/data/rivals';
import { rivalScore } from '../src/sim/rivals';
const N = Number(process.argv[2] ?? 200);
for (const c of CROWNS) {
  const { world, state } = newGame(1492, 1650, c.id);
  const t0 = performance.now();
  for (let t = 0; t < N; t++) endTurn(world, state);
  const ms = (performance.now() - t0) / N;
  const rivals = rivalsOf(c.id).map((r) => `${r.id} ${rivalScore(state, r.id).colonies}c/${rivalScore(state, r.id).total}`).join(', ');
  const kb = new TextEncoder().encode(JSON.stringify(state)).length / 1024;
  console.log(`${c.name.padEnd(16)} treasury ${String(state.treasury).padStart(7)} · ${ms.toFixed(2)} ms/season · save ${kb.toFixed(0)} KB · rivals: ${rivals}`);
}
