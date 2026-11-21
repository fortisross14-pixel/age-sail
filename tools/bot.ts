/**
 * A simple player for the balance harness (P6-02). It plays by the same commands the interface
 * sends: it trades by hand between the ports it knows, sends its caravel to chart coasts, founds
 * colonies and supplies them, and spends what is left on ships and settlers. It is a competent
 * beginner, not an expert: read its results as a floor for what a person does, and compare runs
 * with each other rather than with a human game.
 */
import * as G from '../src/sim/game';
import * as Col from '../src/sim/colony';
import * as Nat from '../src/sim/natives';
import { GRIDS } from '../src/sim/hex';
import { isWater } from '../src/data/terrain';
import { GOODS, type GoodId } from '../src/data/goods';
import { SHIPS } from '../src/data/ships';
import { buyCost, sellValue, unitPrice } from '../src/sim/market';
import { Fog, yearOf, type Fleet, type GameState, type Person, type World } from '../src/sim/types';

export type Strategy = 'trader' | 'settler' | 'balanced';
type Role = 'trade' | 'explore' | 'colony';
type Phase = 'outfit' | 'toSite' | 'cross' | 'toNewPort' | 'out' | 'home';
interface FleetMind { role: Role; phase: Phase; colony: string | null; site: number | null; found: boolean; idle: number }

export interface Bot {
  strategy: Strategy;
  minds: Map<number, FleetMind>;
  visited: Map<string, number>;
  badSites: Set<string>;
  /** no founding voyages before this turn: the last one found no room */
  noFoundUntil: number;
  stats: { stories: number; cards: number; orders: number; fleetsLost: number; coloniesLost: number; founded: number; crossings: number; debtSeasons: number; fails: Record<string, number>; goods: Record<string, number> };
  seenFleets: Set<number>;
  seenColonies: Set<string>;
}

export const newBot = (strategy: Strategy): Bot => ({
  strategy, minds: new Map(), visited: new Map(), badSites: new Set(), noFoundUntil: 0, seenFleets: new Set(), seenColonies: new Set(),
  stats: { stories: 0, cards: 0, orders: 0, fleetsLost: 0, coloniesLost: 0, founded: 0, crossings: 0, debtSeasons: 0, fails: {}, goods: {} },
});

const SUPPLY: GoodId[] = ['food', 'cloth', 'wine', 'tools', 'timber', 'stone'];
const RESERVE = 800;

/** One player turn of orders. Call before `endTurn`. */
export function think(w: World, s: GameState, bot: Bot) {
  const st = bot.stats;
  const run = <T extends { ok: boolean; error?: string }>(what: string, r: T): T => {
    st.orders++;
    if (!r.ok) st.fails[what] = (st.fails[what] ?? 0) + 1;
    return r;
  };
  // cards and stories
  for (let guard = 0; s.events.length && guard < 200; guard++) {
    const e = s.events[0];
    st.cards++;
    if (e.kind === 'story') {
      st.stories++;
      const before = s.events.length;
      const pick = e.choices && e.choices.length > 1 && (s.turn + s.events.length) % 3 === 0 ? 1 : 0;
      if (!G.chooseStory(w, s, pick).ok && s.events.length === before) s.events.shift();
    } else s.events.shift();
  }
  // losses
  for (const id of bot.seenFleets) if (!s.fleets.some((f) => f.id === id)) { bot.seenFleets.delete(id); bot.minds.delete(id); st.fleetsLost++; }
  for (const id of bot.seenColonies) if (!s.colonies.some((c) => c.id === id)) { bot.seenColonies.delete(id); st.coloniesLost++; }
  for (const c of s.colonies) bot.seenColonies.add(c.id);
  if (s.treasury < 0) st.debtSeasons++;

  // the least diplomacy a player would do: buy peace when at war, and keep the neighbours of a colony from boiling over
  for (const r of Object.keys(s.rivals) as (keyof typeof s.rivals)[]) if (s.rivals[r]?.relation === 'war') run('peace', G.rivalPeace(s, r));
  for (const n of Nat.allNations(w)) {
    const ns = s.natives[n.id];
    if (!ns?.met || ns.relation === 'subject') continue;
    const land = Nat.territory(n);
    if (!s.colonies.some((c) => c.map === n.map && land.some((h) => GRIDS[n.map].distance(h, c.hex) <= 4))) continue;
    if (ns.relation === 'war') { if (s.treasury > 1200) run('npeace', G.peaceNation(w, s, n.id)); }
    else if (ns.attitude < -10 && s.treasury > 1500) run('gift', G.giftNation(w, s, n.id, 250));
  }

  // and a feast where a colony is turning away
  for (const c of s.colonies) if (c.loyalty < 35 && s.treasury > 6000) run('festival', G.holdFestival(s, c.id));

  // research: the ocean winds first, then whatever is open
  if (!s.research.current) {
    const path = G.has(s, 'volta') ? [] : G.studyPath(s, 'volta');
    const open = path.find((t) => G.techAvailable(s, t));
    if (open) G.setResearch(s, open);
  }

  const home = G.portById(w, G.mainPort(s))!;
  const year = yearOf(s.turn);
  const colonial = bot.strategy !== 'trader';
  const colonyFleets = () => [...bot.minds.values()].filter((m) => m.role === 'colony').length;
  const tradeFleets = () => [...bot.minds.values()].filter((m) => m.role === 'trade').length;
  const wantColonyFleets = colonial ? Math.min(s.treasury > 30000 ? 8 : 4, 1 + Math.floor(s.colonies.length / 2) + (s.treasury > 30000 ? 2 : 0)) : 0;
  const wantTradeFleets = bot.strategy === 'trader' ? Math.min(6, 2 + Math.floor((year - 1492) / 10)) : Math.min(3, 1 + Math.floor((year - 1492) / 25));
  const wantColonies = colonial ? Math.min(14, 1 + Math.floor((year - 1492) / 6)) : 0;

  // new fleets get a job
  for (const f of s.fleets) {
    if (bot.minds.has(f.id)) continue;
    bot.seenFleets.add(f.id);
    const caravelOnly = f.ships.every((x) => x.type === 'caravel');
    let role: Role;
    if (caravelOnly && bot.strategy !== 'trader' && ![...bot.minds.values()].some((m) => m.role === 'explore')) role = 'explore';
    else if (bot.strategy === 'settler' && colonyFleets() === 0) role = 'colony';
    else if (tradeFleets() === 0) role = 'trade';
    else if (colonyFleets() < wantColonyFleets) role = 'colony';
    else role = 'trade';
    bot.minds.set(f.id, { role, phase: 'outfit', colony: null, site: null, found: false, idle: 0 });
  }

  // leaders: an explorer for fleets that chart or cross, a merchant for those that trade
  const best = (skill: 'navigation' | 'commerce', pool: Person[]) => [...pool].sort((a, b) => b.skills[skill] - a.skills[skill])[0];
  for (const f of s.fleets) {
    const m = bot.minds.get(f.id)!;
    if (f.leader != null || f.at !== home.id) continue;
    const rank = m.role === 'trade' ? 'merchant' : 'explorer';
    const skill = rank === 'merchant' ? 'commerce' : 'navigation';
    const ready = s.people.filter((p) => p.alive && p.rank === rank && p.fleet == null && p.ready === 0);
    if (ready.some((p) => G.assignLeader(s, p.id, f.id).ok)) { st.orders++; continue; }
    if (s.people.some((p) => p.alive && p.rank === rank && p.fleet == null && p.ready > 0)) continue;
    const free = s.people.filter((p) => p.alive && p.rank === 'courtier');
    const cand = best(skill, free);
    if (cand && cand.skills[skill] >= 2 && s.treasury > 600) { run('promote', G.promote(s, cand.id, rank, rank === 'explorer' ? { unit: 'colonist' } : {})); continue; }
    const pet = [...s.petitioners].sort((a, b) => b.person.skills[skill] - a.person.skills[skill])[0];
    if (pet && pet.person.skills[skill] >= 3 && s.treasury > pet.cost + RESERVE) run('hire', G.hire(s, pet.person.id));
  }

  for (const f of [...s.fleets]) {
    const m = bot.minds.get(f.id)!;
    if (!s.fleets.includes(f)) continue;
    // mend storm damage whenever a European port is under the keel
    if (f.at && !f.order && f.ships.some((x) => x.hull < 75) && G.repairCost(w, f, s) > 0 && G.repairCost(w, f, s) < s.treasury) run('repair', G.repair(w, s, f.id));
    if (m.role === 'explore') explore(w, s, f, m, bot, run);
    else if (m.role === 'trade') trade(w, s, f, home, run);
    else colony(w, s, f, m, bot, home, wantColonies, run);
  }

  // spending
  const city = s.cities[home.id];
  if (city && !city.project) {
    const waiting = s.units.filter((u) => u.city === home.id && u.type === 'colonist').length;
    const room = s.colonies.reduce((t, c) => t + Col.LEVELS[c.level].cap - c.pop - c.newcomers, 0) + (s.colonies.length < wantColonies ? 2 : 0);
    const carrack = G.projectCost({ kind: 'ship', ship: 'carrack' }, city, undefined, undefined, G.realmGate(s));
    const galleon = G.projectCost({ kind: 'ship', ship: 'galleon' }, city, undefined, undefined, G.realmGate(s));
    const ship = galleon.allowed && s.treasury > galleon.cost + 4000 ? 'galleon' : 'carrack';
    const shipCost = ship === 'galleon' ? galleon.cost : carrack.cost;
    if (colonial && colonyFleets() > 0 && waiting < 2 && waiting < room && s.treasury > 300 + RESERVE) run('colonist', G.startProject(s, home.id, { kind: 'unit', unit: 'colonist' }));
    else if ((colonyFleets() < wantColonyFleets || tradeFleets() < wantTradeFleets) && s.treasury > shipCost + RESERVE + 500) run('ship', G.startProject(s, home.id, { kind: 'ship', ship }));
    else if (s.treasury > 6000) {
      for (const b of ['market', 'docks', 'warehouse', 'university'] as const) {
        const c = G.projectCost({ kind: 'building', building: b }, city, undefined, undefined, G.realmGate(s));
        if (c.allowed && c.cost + 3000 < s.treasury) { run('building', G.startProject(s, home.id, { kind: 'building', building: b })); break; }
      }
    }
  }
}

/** Ducats in and out by good, over every game played in this process. */
export const TALLY: Record<string, number> = {};

type Run = <T extends { ok: boolean; error?: string }>(what: string, r: T) => T;

function explore(w: World, s: GameState, f: Fleet, m: FleetMind, _bot: Bot, run: Run) {
  if (f.standing || !G.canExplore(s, f)) return;
  // nothing left to chart from here: the caravel goes into trade
  if (++m.idle > 2) { m.role = 'trade'; return; }
  run('explore', G.setStanding(w, s, f.id, 'explore'));
}

/** Sell what is aboard, then carry whatever pays best to wherever it pays. */
function trade(w: World, s: GameState, f: Fleet, home: ReturnType<typeof G.portById> & object, run: Run) {
  if (f.order) return;
  if (!f.at) { if (f.map === 'old') run('move', G.moveFleet(w, s, f.id, home.hex)); return; }
  const here = s.markets[f.at];
  if (here) for (const g of GOODS) if ((f.cargo[g] ?? 0) > 0 && here[g]) { const t0 = s.treasury; run('sell', G.sell(w, s, f.id, g, f.cargo[g]!)); TALLY[`sell ${g}`] = (TALLY[`sell ${g}`] ?? 0) + (s.treasury - t0); }
  if (!here) { run('move', G.moveFleet(w, s, f.id, home.hex)); return; }
  const cap = G.cargoCapacity(f) - G.cargoUsed(f);
  const sp = G.spreadFor(s, f);
  let bestPlan: { dest: number; buys: [GoodId, number][]; score: number } | null = null;
  for (const d of w.old.ports) {
    if (d.id === f.at || d.inland || !s.markets[d.id]) continue;
    if (d.kind === 'native' && !s.discovered.includes(d.id)) continue;
    const pv = G.previewMove(w, s, f.id, d.hex);
    if (!pv || pv.deep || pv.crossBlocked) continue;
    const there = s.markets[d.id];
    const margins = GOODS.filter((g) => here[g] && there[g]).map((g) => ({ g, m: unitPrice(there[g]!) * (1 - sp) - unitPrice(here[g]!) * (1 + sp) })).filter((x) => x.m > 2).sort((a, b) => b.m - a.m);
    let left = cap, money = s.treasury * 0.7, profit = 0;
    const buys: [GoodId, number][] = [];
    for (const { g } of margins) {
      let q = Math.min(left, Math.floor(here[g]!.stock * 0.5));
      while (q > 0 && (buyCost(here[g]!, q, sp) > money || sellValue(there[g]!, q, sp) <= buyCost(here[g]!, q, sp))) q = Math.floor(q * 0.7);
      if (q < 3) continue;
      const c = buyCost(here[g]!, q, sp);
      profit += sellValue(there[g]!, q, sp) - c; money -= c; left -= q; buys.push([g, q]);
    }
    const score = profit / (pv.turns + 0.5);
    if (buys.length && (!bestPlan || score > bestPlan.score)) bestPlan = { dest: d.hex, buys, score };
  }
  if (bestPlan && bestPlan.score > 30) {
    for (const [g, q] of bestPlan.buys) { const t0 = s.treasury; run('buy', G.buy(w, s, f.id, g, q)); TALLY[`buy ${g}`] = (TALLY[`buy ${g}`] ?? 0) + (s.treasury - t0); }
    run('move', G.moveFleet(w, s, f.id, bestPlan.dest));
  } else if (f.at !== home.id) run('move', G.moveFleet(w, s, f.id, home.hex));
}

const coastal = (w: World, map: 'old' | 'new', h: number) => !isWater(w[map].terrain[h]) && GRIDS[map].neighbors(h).some((j) => isWater(w[map].terrain[j]));

/** A free stretch of explored coast, nearest first, that the fleet can reach. */
function findSite(w: World, s: GameState, f: Fleet, bot: Bot): { site: number; berth: number } | null {
  const g = GRIDS[f.map], m = w[f.map];
  const taken = [...s.colonies, ...s.rivalColonies, ...s.freeStates].filter((c) => c.map === f.map).map((c) => c.hex);
  const cands: number[] = [];
  for (let h = 0; h < g.N; h++) {
    if (s.fog[f.map][h] === Fog.Unknown || !coastal(w, f.map, h)) continue;
    if (f.map === 'old' && g.lat(h) >= 30) continue;
    if (bot.badSites.has(`${f.map}:${h}`)) continue;
    if (m.ports.some((p) => g.distance(p.hex, h) <= 2) || taken.some((x) => g.distance(x, h) <= 4)) continue;
    if (Col.tileOptions(w, f.map, h).length === 0 && g.neighbors(h).every((j) => Col.tileOptions(w, f.map, j).length === 0)) continue;
    cands.push(h);
  }
  const theirs = Nat.allNations(w).filter((n) => n.map === f.map && s.natives[n.id]?.relation !== 'subject').flatMap((n) => Nat.territory(n));
  const crowded = (h: number) => (theirs.some((t) => g.distance(t, h) <= 2) ? 1 : 0);
  const crowd = new Map(cands.map((h) => [h, crowded(h)]));
  cands.sort((a, b) => crowd.get(a)! - crowd.get(b)! || g.distance(a, f.hex) - g.distance(b, f.hex));
  for (const site of cands.slice(0, 10)) {
    for (const berth of g.neighbors(site).filter((j) => isWater(m.terrain[j]))) {
      const pv = berth === f.hex ? { deep: 0 } : G.previewMove(w, s, f.id, berth);
      if (pv && !pv.deep) return { site, berth };
    }
    bot.badSites.add(`${f.map}:${site}`);
  }
  return null;
}

function portalFor(w: World, s: GameState, f: Fleet, lat: number): number | null {
  const g = GRIDS[f.map];
  const ps = [...w[f.map].portals].sort((a, b) => Math.abs(g.lat(a) - lat) - Math.abs(g.lat(b) - lat));
  for (const p of ps.slice(0, 6)) if (G.previewMove(w, s, f.id, p)) return p;
  return null;
}

function colony(w: World, s: GameState, f: Fleet, m: FleetMind, bot: Bot, home: ReturnType<typeof G.portById> & object, wantColonies: number, run: Run) {
  if (f.order) return;
  const g = GRIDS[f.map];
  const target = Col.colonyById(s, m.colony);
  if (m.colony && !target) { m.colony = null; m.phase = 'home'; }
  const goHome = () => {
    m.phase = 'home';
    if (f.map === 'new') { const p = portalFor(w, s, f, 38); if (p != null) run('move', G.moveFleet(w, s, f.id, p)); }
    else if (f.at !== home.id) run('move', G.moveFleet(w, s, f.id, home.hex));
  };
  const sellAll = () => { const here = f.at ? s.markets[f.at] : undefined; if (here) for (const gd of GOODS) if ((f.cargo[gd] ?? 0) > 0 && here[gd]) run('sell', G.sell(w, s, f.id, gd, f.cargo[gd]!)); };
  const top = (gd: GoodId, n: number) => { const have = f.cargo[gd] ?? 0; if (have < n) run('buy', G.buy(w, s, f.id, gd, n - have)); };

  if (m.phase === 'home') {
    if (f.at === home.id) { sellAll(); m.phase = 'outfit'; }
    else { goHome(); return; }
  }

  if (m.phase === 'outfit') {
    if (f.at !== home.id) { goHome(); return; }
    sellAll();
    const waiting = s.units.filter((u) => u.city === home.id && u.type === 'colonist');
    for (const u of waiting) if (G.slotsUsed(s, f) < G.slotsMax(f)) run('embark', G.embark(w, s, u.id, f.id));
    const aboard = G.unitsAboard(s, f).filter((u) => u.type === 'colonist').length;
    const busy = [...bot.minds.values()].some((x) => x !== m && x.found && (x.phase === 'toSite' || x.phase === 'cross' || x.phase === 'toNewPort'));
    const found = s.colonies.length < wantColonies && aboard > 0 && !busy && s.turn >= bot.noFoundUntil;
    if (found) {
      top('timber', 30); top('tools', 22); top('food', 20); top('cloth', 10); top('wine', 10);
      if ((f.cargo.timber ?? 0) >= 30 && (f.cargo.tools ?? 0) >= 20) {
      const over = G.has(s, 'volta') && G.canCross(s, f) && s.colonies.some((c) => c.map === 'old') || (G.has(s, 'volta') && G.canCross(s, f) && yearOf(s.turn) > 1505);
      if (over) {
        const p = portalFor(w, s, f, 28);
        if (p != null && run('move', G.moveFleet(w, s, f.id, p)).ok) { m.phase = 'cross'; m.found = true; bot.stats.crossings++; return; }
      }
      const site = findSite(w, s, f, bot);
      if (site && run('move', G.moveFleet(w, s, f.id, site.berth)).ok) { m.site = site.site; m.phase = 'toSite'; m.found = true; return; }
      }
      // nowhere to found from here: the settlers go to a colony that has room
    }
    // supply the colony that has waited longest
    const mine = [...s.colonies].sort((a, b) => (bot.visited.get(a.id) ?? -1) - (bot.visited.get(b.id) ?? -1));
    const c = mine.find((x) => x.map === 'old' || G.canCross(s, f));
    if (!c) return;
    // a colony seen within the year needs no ship unless there are settlers to carry
    if (s.turn - (bot.visited.get(c.id) ?? -99) < 4 && !aboard) return;
    const L = Col.LEVELS[c.level];
    const lacks = (gd: GoodId, want: number) => Math.max(0, want - Math.floor(c.stock[gd] ?? 0));
    top('cloth', lacks('cloth', 4 + c.pop * 2)); top('wine', lacks('wine', 4 + c.pop * 2)); top('tools', lacks('tools', 4 + c.pop)); top('food', lacks('food', 6 + c.pop * 2));
    if (L.next && c.pop >= L.pop - 2 && s.treasury > 2500) for (const [gd, n] of Object.entries(L.needs)) { const lack = n! - Math.floor(c.stock[gd as GoodId] ?? 0); if (lack > 0) top(gd as GoodId, (f.cargo[gd as GoodId] ?? 0) + Math.min(lack, 40)); }
    m.colony = c.id; m.found = false; bot.visited.set(c.id, s.turn);
    if (c.map === 'new') { const p = portalFor(w, s, f, 28); if (p != null && run('move', G.moveFleet(w, s, f.id, p)).ok) { m.phase = 'out'; bot.stats.crossings++; } }
    else if (run('move', G.moveFleet(w, s, f.id, c.hex)).ok) m.phase = 'out';
    return;
  }

  if (m.phase === 'cross') {
    if (f.map !== 'new') { if (G.isPortal(w, f)) run('cross', G.crossOcean(w, s, f.id)); else goHome(); return; }
    const site = findSite(w, s, f, bot);
    if (site && run('move', G.moveFleet(w, s, f.id, site.berth)).ok) { m.site = site.site; m.phase = 'toSite'; return; }
    const port = [...w.new.ports].sort((a, b) => g.distance(a.hex, f.hex) - g.distance(b.hex, f.hex)).find((p) => G.previewMove(w, s, f.id, p.hex));
    if (port && run('move', G.moveFleet(w, s, f.id, port.hex)).ok) { m.phase = 'toNewPort'; return; }
    bot.noFoundUntil = s.turn + 40; m.found = false;
    goHome();
    return;
  }

  if (m.phase === 'toNewPort') {
    const site = findSite(w, s, f, bot);
    if (site && run('move', G.moveFleet(w, s, f.id, site.berth)).ok) { m.site = site.site; m.phase = 'toSite'; return; }
    bot.noFoundUntil = s.turn + 40; m.found = false;
    goHome();
    return;
  }

  if (m.phase === 'toSite') {
    const site = m.site!;
    if (f.hex !== site && !g.neighbors(f.hex).includes(site)) { bot.badSites.add(`${f.map}:${site}`); m.phase = f.map === 'new' ? 'toNewPort' : 'outfit'; if (f.map === 'old') goHome(); return; }
    const landed = run('land', G.landParty(w, s, f.id, site, false));
    const party = landed.ok ? s.parties[s.parties.length - 1] : undefined;
    const r = party ? run('found', G.foundColony(w, s, party.id)) : landed;
    if (r.ok) { bot.stats.founded++; m.found = false; m.colony = s.colonies[s.colonies.length - 1].id; bot.visited.set(m.colony, s.turn); goHome(); return; }
    bot.badSites.add(`${f.map}:${site}`);
    if (party) run('board', G.boardParty(s, party.id, f.id));
    m.phase = f.map === 'new' ? 'toNewPort' : 'outfit';
    if (f.map === 'old') goHome();
    return;
  }

  if (m.phase === 'out') {
    if (!target) { goHome(); return; }
    if (f.map !== target.map) { if (G.isPortal(w, f)) run('cross', G.crossOcean(w, s, f.id)); else goHome(); return; }
    if (f.at !== target.id) { if (!run('move', G.moveFleet(w, s, f.id, target.hex)).ok) goHome(); return; }
    for (const gd of SUPPLY) if ((f.cargo[gd] ?? 0) > 0) run('unload', G.colonyTransfer(s, f.id, gd, -(f.cargo[gd] ?? 0)));
    if (G.unitsAboard(s, f).some((u) => u.type === 'colonist')) G.settleColonists(s, f.id);
    if (Col.upgradeColony(s, target).ok) bot.stats.orders++;
    for (const gd of GOODS) if (!SUPPLY.includes(gd) && (target.stock[gd] ?? 0) >= 1) G.colonyTransfer(s, f.id, gd, Math.floor(target.stock[gd]!));
    goHome();
  }
}

export const shipValue = (s: GameState) => s.fleets.reduce((t, f) => t + f.ships.reduce((a, x) => a + SHIPS[x.type].cost, 0), 0);
