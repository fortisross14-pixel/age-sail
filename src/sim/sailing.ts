import { isWater } from '../data/terrain';
import { SHIPS } from '../data/ships';
import type { Grid } from './hex';
import { Fog, type MapData, type Fleet } from './types';

/** Fraction of best speed at each point of sail, by angle between heading and wind (0 = wind astern). */
function pointOfSail(rel: number, windward: number): number {
  // downwind, broad reach, beam reach, close-hauled, head to wind
  const pts = [0.85, 1.0, 0.85, 0.25 + 0.4 * windward, 0.06 + 0.25 * windward];
  const t = (rel / Math.PI) * 4;
  const k = Math.min(3, Math.floor(t));
  const u = t - k;
  return pts[k] * (1 - u) + pts[k + 1] * u;
}

export function crewNeeded(f: Pick<Fleet, 'ships'>): number {
  return f.ships.reduce((t, s) => t + SHIPS[s.type].crew, 0);
}

/** Movement points the fleet gets each season: its slowest ship, less if undermanned. */
export function maxMoves(f: Pick<Fleet, 'ships' | 'crew'>): number {
  const base = Math.min(...f.ships.map((s) => SHIPS[s.type].moves));
  const manning = Math.min(1, f.crew / Math.max(1, crewNeeded(f)));
  return manning < 0.6 ? Math.max(3, Math.round(base * (0.4 + manning))) : base;
}

export const windwardOf = (f: Pick<Fleet, 'ships'>) => Math.min(...f.ships.map((s) => SHIPS[s.type].windward));

/** Movement points to sail from hex a into neighbouring hex b in the given season (1 to 4). */
export function stepCost(g: Grid, m: MapData, season: number, a: number, b: number, windward: number): number {
  const wind = m.wind[season];
  const heading = Math.atan2(g.cy(b) - g.cy(a), g.cx(b) - g.cx(a));
  const w = (wind.angle[a] + wind.angle[b]) / 2;
  const str = (wind.strength[a] + wind.strength[b]) / 2;
  let rel = Math.abs(heading - w) % (2 * Math.PI);
  if (rel > Math.PI) rel = 2 * Math.PI - rel;
  // a fair wind is 1 point a hex; calms and headwinds cost more, up to 4
  const eff = 0.3 + 0.2 * (1 - str) + 0.75 * str * pointOfSail(rel, windward);
  return Math.min(4, Math.max(1, Math.round(2 / eff) / 2));
}

/** Chance of a storm for each hex sailed, by place and season. */
export function stormRisk(g: Grid, m: MapData, season: number, i: number): number {
  if (!isWater(m.terrain[i])) return 0;
  const lat = g.lat(i), lon = g.lon(i);
  let p = 0.002;
  if (lat > 42 && (season === 3 || season === 2)) p += 0.008; // North Atlantic gales
  if (g.id === 'new' && lat > 10 && lat < 28 && lon < -55 && (season === 1 || season === 2)) p += 0.012; // hurricanes
  return p;
}

export interface RoutePlan {
  path: number[];
  /** total movement points */
  cost: number;
  /** turns to arrive, counting the moves left this turn */
  turns: number;
  /** chance of at least one storm */
  risk: number;
  /** indexes into path where each season's movement runs out */
  turnEnds: number[];
}

export interface PlanOpts {
  /** may enter hexes nobody has charted (fleets led by an explorer) */
  explorer: boolean;
  /** hexes a fleet may end in even though they are land */
  ports: Set<number>;
  fog: ArrayLike<number>;
  movesLeft: number;
  movesMax: number;
  windward: number;
}

/**
 * Cheapest route by sea, aware of wind. Uncharted hexes are only open to explorers, and are assumed to be sea.
 * Ships may only touch land at the start (their port) and at the destination (a port).
 */
export function planRoute(g: Grid, m: MapData, season: number, from: number, to: number, o: PlanOpts): RoutePlan | null {
  if (from === to) return null;
  const known = (i: number) => o.fog[i] >= Fog.Charted;
  const passable = (i: number) => {
    if (i === from) return true;
    if (!known(i)) return o.explorer;
    return isWater(m.terrain[i]) || (i === to && o.ports.has(i));
  };
  if (!passable(to)) return null;
  const costOf = (a: number, b: number) => (known(b) ? stepCost(g, m, season, a, b, o.windward) : 1.5);
  const gScore = new Float64Array(g.N).fill(Infinity);
  const prev = new Int32Array(g.N).fill(-1);
  const closed = new Uint8Array(g.N);
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let s = k;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === k) break;
        [heap[s], heap[k]] = [heap[k], heap[s]];
        k = s;
      }
    }
    return top;
  };
  gScore[from] = 0;
  push(g.distance(from, to), from);
  while (heap.length) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === to) break;
    for (const j of g.neighbors(i)) {
      if (closed[j] || !passable(j)) continue;
      const ng = gScore[i] + costOf(i, j);
      if (ng < gScore[j]) {
        gScore[j] = ng;
        prev[j] = i;
        push(ng + g.distance(j, to), j);
      }
    }
  }
  if (!isFinite(gScore[to])) return null;
  const path: number[] = [];
  for (let c = to; c !== -1; c = prev[c]) path.push(c);
  path.reverse();
  // count turns the way movement works: a full-strength fleet can always make at least one step
  let turns = 1, left = o.movesLeft, survive = 1;
  const turnEnds: number[] = [];
  for (let k = 1; k < path.length; k++) {
    const c = costOf(path[k - 1], path[k]);
    if (left < c && left < o.movesMax) { turns++; left = o.movesMax; turnEnds.push(k - 1); }
    left = Math.max(0, left - c);
    survive *= 1 - stormRisk(g, m, season, path[k]);
  }
  return { path, cost: gScore[to], turns, risk: 1 - survive, turnEnds };
}
