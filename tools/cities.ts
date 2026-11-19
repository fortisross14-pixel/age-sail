// Prints where each Old World city landed, how far it moved, and the realm map as ASCII.
import { generateOldWorld } from '../src/sim/mapgen';
import { OLD } from '../src/sim/hex';
import { CITIES } from '../src/data/europe';
import { REALM_IDS } from '../src/data/realms';
import { isWater } from '../src/data/terrain';
const m = generateOldWorld(1492);
const g = OLD;
let minD = 99;
for (const p of m.ports.filter((p) => p.realm)) {
  const c = CITIES.find((x) => x.id === p.id)!;
  const want = g.hexAt(c.lat, c.lon);
  const moved = g.distance(want, p.hex);
  for (const q of m.ports.filter((q) => q.realm && q !== p)) minD = Math.min(minD, g.distance(p.hex, q.hex));
  if (moved > 1 || p.hex < 0) console.log(`${p.name.padEnd(12)} moved ${moved}`);
}
console.log('min distance between cities', minD);
const letters = 'SPEFNOMVGRqHDCI';
const rows: string[] = [];
for (let r = 0; r < 70; r++) {
  let line = '';
  for (let c = 0; c < g.W; c++) {
    const i = g.idx(c, r);
    const city = m.ports.find((p) => p.hex === i && p.realm);
    line += city ? '*' : isWater(m.terrain[i]) ? ' ' : m.realm[i] ? letters[m.realm[i] - 1] : '.';
  }
  rows.push(line);
}
console.log(rows.join('\n'));
console.log(REALM_IDS.map((id, i) => `${letters[i]}=${id}`).join(' '));
