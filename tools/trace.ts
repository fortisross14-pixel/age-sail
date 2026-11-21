// Plays one bot game and prints what went wrong on the way: npx vite-node tools/trace.ts [strategy] [until] [seed] [all]
import { newGame, endTurn } from '../src/sim/game';
import { yearOf } from '../src/sim/types';
import { newBot, think, TALLY, type Strategy } from './bot';
const strat = (process.argv[2] ?? 'balanced') as Strategy, until = Number(process.argv[3] ?? 1520), seed = Number(process.argv[4] ?? 1);
const { world, state: s } = newGame(seed, 1650, 'spain');
const bot = newBot(strat);
let lastP = 0; let last: unknown = null; const LOST: string[] = []; const quiet = process.argv[5] === 'sum';
while (yearOf(s.turn) < until) {
  think(world, s, bot);
  endTurn(world, s);
  if (process.argv[6] === 'fleets' && s.turn % 4 === 0 && yearOf(s.turn) >= Number(process.argv[7] ?? 1570) && yearOf(s.turn) < Number(process.argv[7] ?? 1570) + 6) console.log(yearOf(s.turn), Math.round(s.treasury), s.fleets.map((f) => { const m = bot.minds.get(f.id); return `${f.id}:${m?.role[0]}/${m?.phase} ${f.map[0]} at ${f.at ?? '-'} ${f.order ? 'sail' : 'idle'} L${f.leader ?? '-'} sup${f.supplies} u${s.units.filter((u) => u.fleet === f.id).length} c${Object.values(f.cargo).reduce((a, b) => a + (b ?? 0), 0)}`; }).join(' | '), 'proj', JSON.stringify(s.cities[Object.keys(s.cities)[0]].project?.kind ?? null), 'wait', s.units.filter((u) => u.city && u.type === 'colonist').length);
  if (process.argv[6] === 'cols' && s.turn % 40 < 4 && s.turn % 4 === 0) console.log(yearOf(s.turn), `tr ${Math.round(s.treasury)}`, s.colonies.map((c) => `${c.name.slice(0, 8)}:${c.map[0]}${c.level[0]}${c.pop}+${c.newcomers} L${Math.round(c.loyalty)} ${c.last.hungry ? 'H' : ''}${c.last.discontent ? 'D' : ''} b${(c.last.births * 100).toFixed(0)} d${(c.last.deaths * 100).toFixed(0)} [${Object.entries(c.stock).filter(([, v]) => v! >= 1).map(([g, v]) => g.slice(0, 2) + Math.floor(v!)).join(' ')}]`).join(' | '));
  if (!quiet && Math.abs(s.prestige - lastP) >= 8) { console.log(`  ** prestige ${lastP} -> ${s.prestige} in ${yearOf(s.turn)}`); }
  lastP = s.prestige;
  const fresh = s.chronicle.slice(last ? s.chronicle.indexOf(last) + 1 : 0); last = s.chronicle[s.chronicle.length - 1];
  for (const c of fresh) if (c.kind === 'peril' || /abandon|independen|lost|falls/i.test(c.text)) LOST.push(c.text);
  if (!quiet) for (const c of fresh) if (process.argv[5] === 'all' || c.kind === 'peril' || /prestige|lost|founded|abandon/i.test(c.text)) console.log(yearOf(c.turn), c.kind, c.text.slice(0, 230));
}
console.log(JSON.stringify(bot.stats));
const kinds: Record<string, number> = {};
for (const l of LOST) { const k = l.replace(/[A-ZÁÉÍÓÚÑ][\wáéíóúñü’'.]*( (de|del|la|of|fleet|Fleet) )?/g, '_').replace(/\d+/g, '#').slice(0, 70); kinds[k] = (kinds[k] ?? 0) + 1; }
console.log(Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${v}\t${k}`).join('\n'));
const net: Record<string, number> = {};
for (const [k, v] of Object.entries(TALLY)) { const g = k.split(' ')[1]; net[g] = (net[g] ?? 0) + v; }
console.log('net by good:', Object.entries(net).sort((a, b) => b[1] - a[1]).map(([g, v]) => `${g} ${Math.round(v / 1000)}k`).join(', '));
