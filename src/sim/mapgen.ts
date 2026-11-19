import { createNoise2D } from 'simplex-noise';
import { T, isWater } from '../data/terrain';
import { OLD_WORLD, ATLANTIC_ISLANDS, STRAITS, EUROPEAN_PORTS, DECOR_CITIES } from '../data/europe';
import { OLD, NEW, type Grid } from './hex';
import { mulberry32, hashSeed, range, int, shuffle, type Rng } from './rng';
import type { World, MapData, PortDef, WindField } from './types';
import { nativeWord, islandName } from './names';

/** The Old World board looks the same every game. */
const OLD_WORLD_SEED = 1492;

function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct = 4): number {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    v += amp * noise(x * f, y * f);
    amp *= 0.5;
    f *= 2;
  }
  return v;
}

function biomeFor(lat: number, elev: number, moist: number, oldWorld: boolean): T {
  if (elev > 0.78) return T.Mountains;
  if (elev > 0.62) return T.Hills;
  const a = Math.abs(lat);
  if (oldWorld) {
    if (lat < 31) return moist > 0.8 ? T.Savanna : T.Desert;
    if (lat > 57) return T.Taiga;
    if (lat < 40) return moist > 0.55 ? T.Forest : T.Plains;
    return moist > 0.42 ? T.Forest : T.Plains;
  }
  if (a < 12) return moist > 0.35 ? T.Jungle : T.Savanna;
  if (a < 24) return moist > 0.55 ? T.Jungle : moist > 0.3 ? T.Savanna : T.Plains;
  if (a < 33) return moist < 0.25 ? T.Desert : moist > 0.7 ? T.Marsh : moist > 0.45 ? T.Forest : T.Plains;
  if (a < 50) return moist > 0.4 ? T.Forest : T.Plains;
  if (a < 58) return T.Taiga;
  return T.Tundra;
}

/** BFS distance from every hex to the nearest water hex. */
function distanceToSea(g: Grid, land: Uint8Array): Int32Array {
  const toSea = new Int32Array(g.N).fill(-1);
  let frontier: number[] = [];
  for (let i = 0; i < g.N; i++) if (!land[i]) { toSea[i] = 0; frontier.push(i); }
  while (frontier.length) {
    const next: number[] = [];
    for (const i of frontier) for (const j of g.neighbors(i)) if (toSea[j] < 0) { toSea[j] = toSea[i] + 1; next.push(j); }
    frontier = next;
  }
  return toSea;
}

/** Turn a land mask into terrain: shallows, elevation, biomes. */
function shapeTerrain(g: Grid, land: Uint8Array, seed: number, oldWorld: boolean, ridge?: (lat: number, lon: number) => number) {
  const nElev = createNoise2D(mulberry32(hashSeed(seed, 3)));
  const nMoist = createNoise2D(mulberry32(hashSeed(seed, 4)));
  // drop single-hex lakes so every water hex is real sea
  for (let i = 0; i < g.N; i++) if (!land[i] && g.neighbors(i).every((j) => land[j])) land[i] = 1;
  const toSea = distanceToSea(g, land);
  const terrain = new Uint8Array(g.N);
  const elevation = new Float32Array(g.N);
  const scale = oldWorld ? 0.22 : 0.11;
  for (let i = 0; i < g.N; i++) {
    const lat = g.lat(i), lon = g.lon(i);
    if (!land[i]) {
      terrain[i] = g.neighbors(i).some((j) => land[j]) ? T.Shallows : T.Sea;
      continue;
    }
    const inland = Math.min(1, toSea[i] / (oldWorld ? 10 : 7));
    let e = 0.5 + fbm(nElev, lon * scale, lat * scale) * 0.7;
    if (ridge) e += ridge(lat, lon);
    if (oldWorld) e -= 0.1;
    e *= 0.35 + 0.65 * inland;
    elevation[i] = e;
    const m = 0.5 + fbm(nMoist, lon * scale * 0.8 + 40, lat * scale * 0.8) * 0.8;
    terrain[i] = biomeFor(lat, e, m, oldWorld);
  }
  // landmass sizes
  const mainland = new Uint8Array(g.N);
  const seen = new Uint8Array(g.N);
  const comps: number[][] = [];
  for (let i = 0; i < g.N; i++) {
    if (!land[i] || seen[i]) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const j of g.neighbors(c)) if (land[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    comps.push(comp);
    if (comp.length >= 40) for (const c of comp) mainland[c] = 1;
  }
  return { terrain, elevation, toSea, mainland, comps };
}

function coastal(g: Grid, terrain: Uint8Array, i: number) {
  return !isWater(terrain[i]) && g.neighbors(i).some((j) => isWater(terrain[j]));
}

function nearestCoastal(g: Grid, terrain: Uint8Array, target: number, taken: Set<number>) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < g.N; i++) {
    if (taken.has(i) || !coastal(g, terrain, i)) continue;
    const d = g.distance(i, target);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const edgePortals = (g: Grid, terrain: Uint8Array, col: number) =>
  [...Array(g.H).keys()].map((r) => g.idx(col, r)).filter((i) => isWater(terrain[i]));

// ---------------- Old World ----------------

export function generateOldWorld(): MapData {
  const g = OLD;
  const land = new Uint8Array(g.N);
  for (let i = 0; i < g.N; i++) land[i] = OLD_WORLD.some((ring) => pointInRing(g.lon(i), g.lat(i), ring)) ? 1 : 0;
  for (const [, lat, lon] of ATLANTIC_ISLANDS) land[g.hexAt(lat, lon)] = 1;
  for (const [lat, lon] of STRAITS) land[g.hexAt(lat, lon)] = 0;
  const { terrain, elevation, mainland } = shapeTerrain(g, land, OLD_WORLD_SEED, true);
  for (const [lat, lon] of [[46.3, 8.0], [46.5, 9.5], [46.6, 11.0], [46.8, 12.5], [42.7, 1.5], [42.7, 0.2], [42.8, -1.2], [37.1, -3.3]] as const) {
    const h = g.hexAt(lat, lon);
    if (!isWater(terrain[h])) { terrain[h] = T.Mountains; elevation[h] = 0.9; }
  }
  const taken = new Set<number>();
  const ports: PortDef[] = EUROPEAN_PORTS.map((p) => {
    const hex = nearestCoastal(g, terrain, g.hexAt(p.lat, p.lon), taken);
    taken.add(hex);
    return { id: p.id, name: p.name, map: 'old', hex, kind: p.kind, nation: p.nation, blurb: p.blurb };
  });
  const decorCities = DECOR_CITIES.map(([name, lat, lon]) => {
    const h = g.hexAt(lat, lon);
    return { name, hex: isWater(terrain[h]) ? nearestCoastal(g, terrain, h, taken) : h };
  });
  const wind = [0, 1, 2, 3].map((s) => windField(g, OLD_WORLD_SEED, s, terrain));
  return {
    id: 'old', terrain, elevation, rivers: [], wind, ports, decorCities, islandNames: [], monsters: [],
    portals: edgePortals(g, terrain, 0), mainland,
  };
}

// ---------------- New World ----------------

interface Blob { lat: number; lon: number; r: number; w: number }

/**
 * The New World's east coast as longitude by latitude. Anchors are jittered per seed, so the
 * continents change every game but keep a familiar shape: a northern landmass, a deep gulf,
 * a narrow middle, and a southern bulge reaching east.
 */
function coastAnchors(rng: Rng): [number, number][] {
  const a: [number, number, number][] = [
    [64, -64, 7], [55, -60, 7], [47, -66, 6], [40, -75, 5], [33, -80, 5], [27, -93, 6], [21, -91, 5],
    [15, -85, 4], [10, -77, 5], [5, -62, 6], [0, -50, 5], [-6, -45, 5],
  ];
  return a.map(([lat, lon, j]) => [lat, lon + range(rng, -j, j)]);
}

function coastLon(anchors: [number, number][], lat: number): number {
  for (let k = 0; k < anchors.length - 1; k++) {
    const [la, lo] = anchors[k], [lb, lob] = anchors[k + 1];
    if (lat <= la && lat >= lb) {
      const t = (la - lat) / (la - lb);
      const u = (1 - Math.cos(t * Math.PI)) / 2;
      return lo + (lob - lo) * u;
    }
  }
  return anchors[anchors.length - 1][1];
}

function newWorldBlobs(rng: Rng): Blob[] {
  const blobs: Blob[] = [];
  // a peninsula on the gulf's eastern side
  blobs.push({ lat: range(rng, 26, 29), lon: range(rng, -85, -80), r: range(rng, 2.5, 3.5), w: 0.9 });
  // an island arc in the warm latitudes
  const arcN = int(rng, 7, 10);
  const lat0 = range(rng, 22, 25), lon0 = range(rng, -87, -80);
  for (let k = 0; k < arcN; k++) {
    const t = k / (arcN - 1);
    blobs.push({
      lat: lat0 - t * range(rng, 8, 11) + range(rng, -1.2, 1.2),
      lon: lon0 + t * range(rng, 20, 26) + range(rng, -1.5, 1.5),
      r: range(rng, 1.4, 3.4), w: 0.8,
    });
  }
  // a large northern island
  blobs.push({ lat: range(rng, 47, 54), lon: range(rng, -60, -53), r: range(rng, 2.5, 4), w: 0.8 });
  // islands far out in the ocean: landfalls on the way, or not
  for (let k = 0, n = int(rng, 2, 4); k < n; k++) {
    blobs.push({ lat: range(rng, 28, 42), lon: range(rng, -40, -26), r: range(rng, 0.9, 1.6), w: 0.75 });
  }
  return blobs;
}

export function generateNewWorld(seed: number): MapData {
  const g = NEW;
  const rng = mulberry32(hashSeed(seed, 1));
  const nLand = createNoise2D(mulberry32(hashSeed(seed, 2)));
  const anchors = coastAnchors(rng);
  const blobs = newWorldBlobs(rng);
  // sometimes the middle is cut by a sea passage, giving two continents
  const strait = rng() < 0.35 ? range(rng, 9, 14) : -99;
  const land = new Uint8Array(g.N);
  for (let i = 0; i < g.N; i++) {
    const lat = g.lat(i), lon = g.lon(i);
    const rough = fbm(nLand, lon * 0.09, lat * 0.09, 5);
    let v = (coastLon(anchors, lat) - lon) / 7 + rough * 0.9;
    if (Math.abs(lat - strait) < 1.2 && lon > -100) v = -1;
    for (const b of blobs) {
      const d2 = ((lat - b.lat) ** 2 + (lon - b.lon) ** 2) / (b.r * b.r);
      v = Math.max(v, b.w * Math.exp(-d2 * 1.6) - 0.5 + rough * 0.6);
    }
    // the eastern edge is always open ocean
    if (g.col(i) >= g.W - 4) v = -1;
    land[i] = v > 0 ? 1 : 0;
  }
  const ridge = (lat: number, lon: number) => Math.max(0, 1 - Math.abs(lon + 100 + lat * 0.25) / 7) * 0.26;
  const { terrain, elevation, toSea, comps } = shapeTerrain(g, land, seed, false, ridge);
  const mainland = new Uint8Array(g.N);
  for (const c of comps) if (c.length >= 40) for (const h of c) mainland[h] = 1;

  // rivers: walk downhill toward the sea from inland hexes
  const rivers: number[][] = [];
  const used = new Uint8Array(g.N);
  const candidates = shuffle(rng, [...Array(g.N).keys()].filter((i) => !isWater(terrain[i]) && toSea[i] >= 6));
  for (const src of candidates) {
    if (rivers.length >= 10) break;
    if (used[src]) continue;
    const path = [src];
    let cur = src;
    while (toSea[cur] > 0 && path.length < 60) {
      const opts = g.neighbors(cur).filter((j) => toSea[j] < toSea[cur]);
      if (!opts.length) break;
      opts.sort((a, b) => elevation[a] - elevation[b]);
      cur = rng() < 0.7 ? opts[0] : opts[opts.length - 1];
      path.push(cur);
      if (used[cur]) break;
    }
    if (path.length >= 6 && path.every((p, k) => k === path.length - 1 || !isWater(terrain[p]))) {
      for (const p of path) { used[p] = 1; for (const q of g.neighbors(p)) used[q] = 1; }
      rivers.push(path);
      for (const p of path) if (terrain[p] === T.Desert) terrain[p] = T.Plains;
    }
  }

  // native trading sites spread along mainland and island coasts, by latitude band
  const coast = shuffle(rng, [...Array(g.N).keys()].filter((i) => coastal(g, terrain, i) && g.lon(i) < -45));
  coast.sort((a, b) => g.lon(b) - g.lon(a)); // prefer eastern (reachable) shores first
  const sites: number[] = [];
  for (const [lo, hi] of [[44, 62], [33, 44], [22, 33], [10, 22], [-6, 10]]) {
    let placed = 0;
    for (const i of coast) {
      if (placed >= 2) break;
      if (g.lat(i) < lo || g.lat(i) >= hi) continue;
      if (sites.some((s) => g.distance(s, i) < 7)) continue;
      // only shores that face open water, so ships can reach them
      if (!g.neighbors(i).some((j) => isWater(terrain[j]) && g.neighbors(j).filter((k) => isWater(terrain[k])).length >= 3)) continue;
      sites.push(i);
      placed++;
    }
  }
  const ports: PortDef[] = sites.map((hex) => {
    const people = nativeWord(rng);
    return {
      id: `site-${hex}`, name: nativeWord(rng), map: 'new', hex, kind: 'native', people,
      blurb: `A trading ground of the ${people} people, who meet strangers here to barter.`,
    };
  });

  const islandNames = comps
    .filter((c) => c.length >= 3 && c.length < 40)
    .map((c) => ({ name: islandName(rng), hex: [...c].sort((a, b) => toSea[b] - toSea[a])[0] }));

  // sea monsters guard the unknown
  const monsters: MapData['monsters'] = [];
  const ocean = shuffle(rng, [...Array(g.N).keys()].filter((i) => terrain[i] === T.Sea && g.lon(i) > -55 && g.lon(i) < -25));
  for (const h of ocean) {
    if (monsters.length >= 3) break;
    if (monsters.some((m) => g.distance(m.hex, h) < 14)) continue;
    monsters.push({ kind: monsters.length % 2 ? 'whale' : 'serpent', hex: h });
  }

  const wind = [0, 1, 2, 3].map((s) => windField(g, seed, s, terrain));
  return {
    id: 'new', terrain, elevation, rivers, wind, ports, decorCities: [], islandNames, monsters,
    portals: edgePortals(g, terrain, g.W - 1), mainland,
  };
}

/**
 * Prevailing winds by latitude: westerlies in the north, trade winds in the warm band,
 * calms in between and at the equator. Bands shift north in summer.
 */
export function windField(g: Grid, seed: number, season: number, terrain: Uint8Array): WindField {
  const noise = createNoise2D(mulberry32(hashSeed(seed, 10 + season)));
  const shift = [0, 4, 1, -4][season];
  const angle = new Float32Array(g.N);
  const strength = new Float32Array(g.N);
  for (let i = 0; i < g.N; i++) {
    const L = g.lat(i) - shift;
    const lon = g.lon(i);
    const n = noise(lon * 0.05, L * 0.05);
    let a: number, s: number;
    if (L >= 37) { a = -0.2; s = 0.9; } // westerlies blow toward the east
    else if (L >= 30) { a = n * 2.5; s = 0.35; } // horse latitudes: weak and variable
    else if (L >= 7) { a = Math.PI + 0.32; s = 1; } // NE trade winds blow toward the west-southwest
    else { a = Math.PI / 2 + n * 2; s = 0.22; } // doldrums
    angle[i] = a + n * 0.35;
    strength[i] = Math.max(0.12, Math.min(1, s + n * 0.12));
    if (!isWater(terrain[i])) strength[i] *= 0.5;
  }
  return { angle, strength };
}

export function generateWorld(seed: number): World {
  return { seed, old: generateOldWorld(), new: generateNewWorld(seed) };
}
