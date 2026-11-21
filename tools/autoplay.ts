/**
 * The balance harness (P6-02): a bot plays whole games headlessly and the results are set side by side.
 *
 *   npx vite-node tools/autoplay.ts [seeds=3] [until=1650] [crowns=all|spain,england] [strategies=all|trader,settler,balanced|none] [difficulty=captain] [first seed=1]
 *
 * `none` plays no orders at all: what the rivals do when left alone.
 * Add `-v` as the last word for one line per checkpoint of every game.
 */
import { newGame, endTurn } from '../src/sim/game';
import { score } from '../src/sim/colony';
import { rivalScore } from '../src/sim/rivals';
import { CROWNS, rivalsOf, type CrownId } from '../src/data/rivals';
import { yearOf } from '../src/sim/types';
import type { Difficulty } from '../src/data/difficulty';
import { newBot, think, type Strategy } from './bot';

const arg = process.argv.slice(2).filter((a) => a !== '-v');
const verbose = process.argv.includes('-v');
const N = Number(arg[0] ?? 3), until = Number(arg[1] ?? 1650);
const crowns = (!arg[2] || arg[2] === 'all' ? CROWNS.map((c) => c.id) : arg[2].split(',')) as CrownId[];
const strategies = (!arg[3] || arg[3] === 'all' ? ['trader', 'settler', 'balanced'] : arg[3].split(',')) as (Strategy | 'none')[];
const difficulty = (arg[4] ?? 'captain') as Difficulty;
const first = Number(arg[5] ?? 1);
const MARKS = [1500, 1510, 1530, 1550, 1600, 1650, 1700, 1750].filter((y) => y <= until);

interface Row { crown: CrownId; strategy: string; seed: number; marks: Record<number, Record<string, number>>; end: Record<string, number | string>; rivals: Record<string, number>; fails: Record<string, number> }
const rows: Row[] = [];
const med = (v: number[]) => { const a = [...v].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };
const fmt = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

for (const crown of crowns) for (const strategy of strategies) for (let k = 0; k < N; k++) {
  const seed = first + k * 37;
  const { world, state: s } = newGame(seed, until, crown, difficulty);
  const bot = newBot(strategy === 'none' ? 'balanced' : strategy);
  const row: Row = { crown, strategy, seed, marks: {}, end: {}, rivals: {}, fails: {} };
  let turns = 0, firstColony = 0, firstNew = 0, volta = 0, storiesAt: number[] = [];
  let next = 0;
  const t0 = performance.now();
  while (!s.ended && turns < 2000) {
    if (strategy !== 'none') think(world, s, bot);
    else while (s.events.length) { if (s.events[0].kind === 'story') bot.stats.stories++; s.events.shift(); }
    endTurn(world, s);
    turns++;
    const y = yearOf(s.turn);
    if (!firstColony && s.colonies.length) firstColony = y;
    if (!firstNew && s.colonies.some((c) => c.map === 'new')) firstNew = y;
    if (!volta && s.research.known.includes('volta')) volta = y;
    while (next < MARKS.length && y >= MARKS[next]) {
      const sc = score(s, world);
      const riv = rivalsOf(crown).map((r) => rivalScore(s, r.id));
      row.marks[MARKS[next]] = {
        treasury: s.treasury, revenue: s.revenue, colonies: s.colonies.length, pop: sc.pop, score: sc.total, prestige: s.prestige, fleets: s.fleets.length,
        rivalBest: Math.max(...riv.map((r) => r.total)), rivalSales: Math.max(...rivalsOf(crown).map((r) => s.rivals[r.id].revenue)), profit: Math.round(s.revenue * 0.2), rivalCols: riv.reduce((t, r) => t + r.colonies, 0), stories: bot.stats.stories, cards: bot.stats.cards, orders: bot.stats.orders, turns, techs: s.research.known.length,
      };
      storiesAt.push(bot.stats.stories);
      if (verbose) console.log(`${crown} ${strategy} #${seed} ${MARKS[next]}:`, JSON.stringify(row.marks[MARKS[next]]));
      next++;
    }
  }
  const sc = score(s, world);
  for (const r of rivalsOf(crown)) row.rivals[r.id] = rivalScore(s, r.id).total;
  const place = 1 + Object.values(row.rivals).filter((v) => v > sc.total).length;
  row.end = { score: sc.total, place, victory: s.victory ? `${s.victory.kind}:${s.victory.crown === crown ? 'me' : s.victory.crown}@${yearOf(s.victory.turn)}` : '-', firstColony, firstNew, volta, turns,
    lostFleets: bot.stats.fleetsLost, lostCols: bot.stats.coloniesLost, founded: bot.stats.founded, debt: bot.stats.debtSeasons, stories: bot.stats.stories, distinct: Object.keys(s.told).length, prestige: Math.round(s.prestige), levels: s.colonies.map((c) => c.level[0] + c.pop).join(' '), cards: bot.stats.cards, orders: bot.stats.orders, free: s.freeStates.length, ms: Math.round(performance.now() - t0) };
  row.fails = bot.stats.fails;
  rows.push(row);
  if (verbose) console.log(`${crown} ${strategy} #${seed} end:`, JSON.stringify(row.end), JSON.stringify(row.rivals), JSON.stringify(row.fails));
}

// ---------- report ----------
console.log(`\n${N} seed(s) from ${first}, to ${until}, ${difficulty}. Medians.\n`);
const head = ['crown', 'play', ...MARKS.flatMap((y) => [`${y} tr`, 'profit', 'rprofit', 'col', 'pop', 'score', 'rival', 'rcol']), 'place', '1st col', 'west', 'volta', 'lostF', 'lostC', 'debt', 'free'];
console.log(head.join('\t'));
for (const crown of crowns) for (const strategy of strategies) {
  const g = rows.filter((r) => r.crown === crown && r.strategy === strategy);
  const m = (y: number, k: string) => fmt(med(g.map((r) => r.marks[y]?.[k] ?? 0)));
  const e = (k: string) => fmt(med(g.map((r) => Number(r.end[k]) || 0)));
  console.log([crown, strategy, ...MARKS.flatMap((y) => [m(y, 'treasury'), m(y, 'profit'), m(y, 'rivalSales'), m(y, 'colonies'), m(y, 'pop'), m(y, 'score'), m(y, 'rivalBest'), m(y, 'rivalCols')]), e('place'), e('firstColony'), e('firstNew'), e('volta'), e('lostFleets'), e('lostCols'), e('debt'), e('free')].join('\t'));
}
console.log('\nrival scores at the end (median), by who the player is:');
for (const crown of crowns) {
  const g = rows.filter((r) => r.crown === crown);
  console.log(`  ${crown}: ` + rivalsOf(crown).map((r) => `${r.id} ${fmt(med(g.map((x) => x.rivals[r.id] ?? 0)))}`).join(', '));
}
const wins: Record<string, number> = {};
for (const r of rows) wins[String(r.end.victory).replace(/@.*/, '')] = (wins[String(r.end.victory).replace(/@.*/, '')] ?? 0) + 1;
console.log('\nraces won:', JSON.stringify(wins), ' years:', rows.map((r) => String(r.end.victory).split('@')[1]).filter(Boolean).join(' '));
const per = (k: string) => med(rows.map((r) => Number(r.end[k]) / Number(r.end.turns)));
console.log(`per player turn: ${per('stories').toFixed(2)} stories, ${per('cards').toFixed(2)} cards, ${per('orders').toFixed(1)} orders; ${med(rows.map((r) => Number(r.end.turns)))} turns; ${med(rows.map((r) => Number(r.end.ms)))} ms a game`);
const fails: Record<string, number> = {};
for (const r of rows) for (const [k, v] of Object.entries(r.fails)) fails[k] = (fails[k] ?? 0) + v;
if (MARKS.includes(1550) && until > 1550) {
  const early = (k: string) => med(rows.map((r) => r.marks[1550][k] / r.marks[1550].turns));
  const late = (k: string) => med(rows.map((r) => (Number(r.end[k]) - r.marks[1550][k]) / (Number(r.end.turns) - r.marks[1550].turns)));
  console.log(`pace, half-year turns to 1550: ${early('stories').toFixed(2)} stories, ${early('cards').toFixed(2)} cards, ${early('orders').toFixed(1)} orders a turn; yearly turns after: ${late('stories').toFixed(2)} stories, ${late('cards').toFixed(2)} cards, ${late('orders').toFixed(1)} orders a turn`);
}
console.log(`stories: ${med(rows.map((r) => Number(r.end.stories)))} told in a game, ${med(rows.map((r) => Number(r.end.distinct)))} different; prestige at the end ${rows.map((r) => r.end.prestige).join(' ')}`);
console.log('colonies at the end:', rows.map((r) => `[${r.end.levels}]`).join(' '));
console.log('orders refused:', JSON.stringify(fails));
