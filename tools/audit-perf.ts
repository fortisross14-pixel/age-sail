// Measures what crosses the worker boundary and what a season costs, over a long game.
import { newGame, endTurn } from '../src/sim/game';
const { world, state } = newGame(1492);
const size = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).length;
console.log('world bytes', size(world), 'state bytes t0', size(state));
const turns: number[] = [];
for (let t = 0; t < 200; t++) {
  const a = performance.now(); endTurn(world, state); turns.push(performance.now() - a);
  if (t % 50 === 49) {
    const c0 = performance.now(); for (let i = 0; i < 20; i++) structuredClone(state); const clone = (performance.now() - c0) / 20;
    const s = [...turns].sort((x, y) => x - y);
    console.log(`turn ${t + 1}: state ${(size(state) / 1024).toFixed(0)} KB, clone ${clone.toFixed(1)} ms, endTurn avg ${(s.reduce((x, y) => x + y) / s.length).toFixed(1)} p95 ${s[Math.floor(s.length * .95)].toFixed(1)} ms, chronicle ${state.chronicle.length}`);
    const big = Object.entries(state).map(([k, v]) => [k, size(v)] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log('   biggest:', big.map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}KB`).join(', '));
  }
}
