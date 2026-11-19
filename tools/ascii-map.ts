import { generateWorld } from '../src/sim/mapgen';
import { GRIDS } from '../src/sim/hex';
const seed = Number(process.argv[2] ?? 1492);
const which = (process.argv[3] ?? 'new') as 'old' | 'new';
const w = generateWorld(seed);
const m = w[which], g = GRIDS[which];
const ch = '~.dpsfjtTHM%';
const ports = new Map(m.ports.map((p) => [p.hex, p.kind === 'native' ? 'N' : p.kind === 'home' ? 'H' : 'E']));
for (let r = 0; r < g.H; r++) {
  let line = r & 1 ? ' ' : '';
  for (let c = 0; c < g.W; c++) {
    const i = g.idx(c, r);
    line += ports.get(i) ?? (m.terrain[i] === 0 ? ' ' : ch[m.terrain[i]]);
  }
  console.log(line);
}
console.log(m.ports.map((p) => `${p.name}@${p.hex}`).join(' '), 'rivers', m.rivers.length, 'portals', m.portals.length);
