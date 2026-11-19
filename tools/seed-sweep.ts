// Seed sweep: determinism and content bounds for the procedural maps.
import { createHash } from 'node:crypto';
import { generateWorld } from '../src/sim/mapgen';
const digest = (w: ReturnType<typeof generateWorld>) => createHash('sha1').update(w.old.terrain).update(w.new.terrain).update(w.new.resource).update(JSON.stringify([w.old.ports, w.new.ports, w.new.nations])).digest('hex');
const N = Number(process.argv[2] ?? 100);
const digests = new Set<string>(); const bad: string[] = []; const stats: Record<string, number[]> = { ms: [], natPorts: [], nations: [], portals: [], landPct: [], res: [] };
for (let s = 1; s <= N; s++) {
  const a = performance.now(); const w = generateWorld(s); stats.ms.push(performance.now() - a);
  const d = digest(w); if (d !== digest(generateWorld(s))) bad.push(`${s}: not deterministic`);
  digests.add(d);
  const nw = w.new; const land = nw.terrain.filter((t) => t > 1).length;
  stats.nations.push((nw as any).nations?.length ?? 0); stats.portals.push(nw.portals.length + w.old.portals.length);
  stats.natPorts.push(w.old.ports.filter((p) => p.kind === 'native').length);
  stats.landPct.push(Math.round(100 * land / nw.terrain.length)); stats.res.push(nw.resource.filter((r) => r > 0).length);
  if (!nw.portals.length || !w.old.portals.length) bad.push(`${s}: no portal`);
  if (((nw as any).nations?.length ?? 0) < 3) bad.push(`${s}: few nations`);
}
const r = (k: string) => { const v = [...stats[k]].sort((x, y) => x - y); return `${k} min ${v[0].toFixed(0)} med ${v[v.length >> 1].toFixed(0)} max ${v[v.length - 1].toFixed(0)}`; };
console.log(`seeds ${N}, distinct ${digests.size}, failures ${bad.length}`, bad.slice(0, 8));
console.log(Object.keys(stats).map(r).join('\n'));
