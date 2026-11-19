import { createNoise2D } from 'simplex-noise';
import { T, isWater } from '../data/terrain';
import { OLD_WORLD, ATLANTIC_ISLANDS, STRAITS, CITIES, AFRICA_OUTLINE, FIXED_SOUTH } from '../data/europe';
import { realmIndex, realmSpec, type RealmId } from '../data/realms';

const realmName = (r: RealmId) => realmSpec(r).name;
import type { CrownId } from '../data/rivals';
import { OLD, NEW, type Grid } from './hex';
import { mulberry32, hashSeed, range, int, shuffle, type Rng } from './rng';
import type { World, MapData, PortDef, WindField, Rumour, NationDef } from './types';
import { RESOURCE_IDS, type ResourceId } from '../data/city';
import { nativeWord, islandName } from './names';

// Changing what generateWorld makes for an existing seed? Bump GEN_VERSION in ./version.ts.

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
    if (lat < 7) return moist > 0.3 ? T.Jungle : T.Savanna;
    if (lat < 13) return moist > 0.6 ? T.Jungle : moist > 0.3 ? T.Savanna : T.Plains;
    if (lat < 17) return moist > 0.55 ? T.Savanna : T.Plains;
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
  // open ocean: more than DEEP hexes from any land
  const toLand = new Int32Array(g.N).fill(-1);
  let front: number[] = [];
  for (let i = 0; i < g.N; i++) if (land[i]) { toLand[i] = 0; front.push(i); }
  while (front.length) {
    const next: number[] = [];
    for (const i of front) for (const j of g.neighbors(i)) if (toLand[j] < 0) { toLand[j] = toLand[i] + 1; next.push(j); }
    front = next;
  }
  const deep = new Uint8Array(g.N);
  for (let i = 0; i < g.N; i++) if (toLand[i] < 0 || toLand[i] > DEEP) deep[i] = 1;
  return { terrain, elevation, toSea, mainland, comps, deep };
}

/** Water more than this many hexes from land is the deep ocean. */
export const DEEP = 5;

/** Rivers: walk downhill toward the sea from inland hexes. */
function makeRivers(g: Grid, terrain: Uint8Array, elevation: Float32Array, toSea: Int32Array, rng: Rng, where: (i: number) => boolean, max: number) {
  const rivers: number[][] = [];
  const used = new Uint8Array(g.N);
  const candidates = shuffle(rng, [...Array(g.N).keys()].filter((i) => where(i) && !isWater(terrain[i]) && toSea[i] >= 6));
  for (const src of candidates) {
    if (rivers.length >= max) break;
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
  return rivers;
}

/**
 * Hidden riches: resources that only a party on foot will find, and one unusually rich region.
 * `where` limits them to the generated parts of a board.
 */
function placeResources(g: Grid, terrain: Uint8Array, rivers: number[][], toSea: Int32Array, rng: Rng, map: 'old' | 'new', where: (i: number) => boolean) {
  const resource = new Uint8Array(g.N);
  const onRiver = new Set(rivers.flat());
  const land = [...Array(g.N).keys()].filter((i) => where(i) && !isWater(terrain[i]));
  // the rich region: a cluster of gold (and, in the New World, silver) somewhere inland
  const inland = land.filter((i) => toSea[i] >= 3);
  const rich = inland.length ? inland[int(rng, 0, inland.length - 1)] : -1;
  const id = (r: ResourceId) => RESOURCE_IDS.indexOf(r) + 1;
  for (const i of land) {
    const t = terrain[i];
    const near = rich >= 0 && g.distance(i, rich) <= 5;
    const boost = near ? 6 : 1;
    const r = rng();
    let pick: ResourceId | null = null;
    if (t === T.Mountains) pick = map === 'new' && r < 0.06 * boost ? 'silver' : r < 0.11 * boost ? 'gold' : null;
    else if (t === T.Hills) pick = r < 0.05 * boost ? 'gold' : null;
    else if (near && r < 0.12) pick = 'gold';
    else if ((t === T.Plains || t === T.Savanna) && (onRiver.has(i) ? r < 0.25 : r < 0.04)) pick = 'fertile';
    else if (t === T.Forest) pick = r < 0.05 ? 'timber' : onRiver.has(i) && r < 0.12 ? 'fertile' : null;
    else if (t === T.Taiga) pick = r < 0.08 ? 'furs' : r < 0.11 ? 'timber' : null;
    else if (t === T.Jungle) pick = map === 'old' ? (r < 0.07 ? 'spices' : r < 0.1 ? 'dyes' : null) : r < 0.06 ? 'dyes' : r < 0.08 ? 'fertile' : null;
    if (pick) resource[i] = id(pick);
  }
  return { resource, rich };
}

/** Each trading ground is the coast of a people with villages inland; one people per board is a great empire. */
function placeNations(g: Grid, terrain: Uint8Array, toSea: Int32Array, rng: Rng, sites: PortDef[], map: 'old' | 'new'): NationDef[] {
  const used = new Set<number>(sites.map((p) => p.hex));
  const nations: NationDef[] = sites.map((p) => ({
    id: `nat-${p.id}`, people: p.people!, map, site: p.id, siteHex: p.hex, villages: [], warriors: int(rng, 8, 20), empire: false, rivals: [],
  }));
  // the empire: the people whose ground lies furthest inland-reaching, picked at random among the larger coasts
  if (nations.length) {
    const e = nations[int(rng, 0, nations.length - 1)];
    e.empire = true;
    e.warriors = int(rng, 35, 50);
  }
  for (const n of nations) {
    const want = n.empire ? int(rng, 5, 7) : int(rng, 2, 4);
    const cands = shuffle(rng, g.within(n.siteHex, n.empire ? 7 : 5).filter((h) => !isWater(terrain[h]) && toSea[h] >= 1 && terrain[h] !== T.Mountains));
    for (const h of cands) {
      if (n.villages.length >= want) break;
      if ([...used].some((u) => g.distance(u, h) < 2)) continue;
      n.villages.push(h);
      used.add(h);
    }
  }
  for (const n of nations) {
    n.rivals = nations.filter((o) => o !== n).sort((a, b) => g.distance(a.siteHex, n.siteHex) - g.distance(b.siteHex, n.siteHex)).slice(0, 2).map((o) => o.id);
  }
  return nations;
}

function placeRumours(g: Grid, terrain: Uint8Array, toSea: Int32Array, rng: Rng, n: number, where: (i: number) => boolean): Rumour[] {
  const kinds: Rumour['kind'][] = ['ruins', 'city', 'shrine'];
  const cands = shuffle(rng, [...Array(g.N).keys()].filter((i) => where(i) && !isWater(terrain[i]) && toSea[i] >= 2 && terrain[i] !== T.Mountains));
  const out: Rumour[] = [];
  for (const h of cands) {
    if (out.length >= n) break;
    if (out.some((r) => g.distance(r.hex, h) < 6)) continue;
    out.push({ hex: h, kind: kinds[int(rng, 0, 2)] });
  }
  return out;
}

/** Spread trading grounds of native peoples along coasts, a few per latitude band. */
function placeSites(g: Grid, terrain: Uint8Array, rng: Rng, map: 'old' | 'new', bands: [number, number, number][], ok: (i: number) => boolean): PortDef[] {
  const coast = shuffle(rng, [...Array(g.N).keys()].filter((i) => coastal(g, terrain, i) && ok(i)));
  coast.sort((a, b) => (map === 'new' ? g.lon(b) - g.lon(a) : g.lon(a) - g.lon(b))); // shores facing the ocean first
  const sites: number[] = [];
  for (const [lo, hi, n] of bands) {
    let placed = 0;
    for (const i of coast) {
      if (placed >= n) break;
      if (g.lat(i) < lo || g.lat(i) >= hi) continue;
      if (sites.some((x) => g.distance(x, i) < 7)) continue;
      // only shores that face open water, so ships can reach them
      if (!g.neighbors(i).some((j) => isWater(terrain[j]) && g.neighbors(j).filter((k) => isWater(terrain[k])).length >= 3)) continue;
      sites.push(i);
      placed++;
    }
  }
  return sites.map((hex) => {
    const people = nativeWord(rng);
    return {
      id: `site-${map}-${hex}`, name: nativeWord(rng), map, hex, kind: 'native' as const, people,
      blurb: `A trading ground of the ${people} people, who meet strangers here to barter.`,
    };
  });
}

function nearestLand(g: Grid, terrain: Uint8Array, target: number): number {
  if (!isWater(terrain[target])) return target;
  for (let r = 1; r < 6; r++) for (const h of g.within(target, r)) if (!isWater(terrain[h])) return h;
  return -1;
}

function coastal(g: Grid, terrain: Uint8Array, i: number) {
  return !isWater(terrain[i]) && g.neighbors(i).some((j) => isWater(terrain[j]));
}

/**
 * The land hex nearest a real position that keeps at least one empty hex to every city already
 * placed: coastal for ports, any land for inland cities.
 */
function placeCity(g: Grid, terrain: Uint8Array, lat: number, lon: number, port: boolean, blocked: Set<number>): number {
  const cos = Math.cos((lat * Math.PI) / 180);
  let best = -1, bd = 1e9;
  for (let i = 0; i < g.N; i++) {
    if (blocked.has(i) || isWater(terrain[i]) || (port && !coastal(g, terrain, i))) continue;
    const d = (g.lat(i) - lat) ** 2 + ((g.lon(i) - lon) * cos) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Land with no city that still belongs to a realm in 1492: [lat, lon, realm]. */
const REALM_SEEDS: [number, number, RealmId][] = [
  [40.0, 9.0, 'spain'], [39.6, 2.9, 'spain'], [42.1, 9.1, 'genoa'], [38.9, 1.4, 'spain'], [40.0, 4.0, 'spain'],
  [57.0, -4.5, 'scotland'], [52.5, -8.5, 'england'], [59.0, 15.0, 'denmark'],
];
/** How far a realm reaches overland from its cities, in hexes. */
const REALM_REACH = 6;

/**
 * Which realm holds each hex: every city claims the land around it, spreading overland (never across
 * the sea) until it meets a neighbour's claim; the nearest city wins. Africa south of the fixed map
 * belongs to its peoples, not to a realm.
 */
function realmMap(g: Grid, terrain: Uint8Array, sources: { hex: number; realm: RealmId }[]): Uint8Array {
  const out = new Uint8Array(g.N);
  const dist = new Int32Array(g.N).fill(-1);
  let frontier: number[] = [];
  for (const src of sources) {
    if (src.hex < 0 || dist[src.hex] >= 0) continue;
    dist[src.hex] = 0;
    out[src.hex] = realmIndex(src.realm);
    frontier.push(src.hex);
  }
  for (let d = 1; d <= REALM_REACH && frontier.length; d++) {
    const next: number[] = [];
    for (const h of frontier) {
      for (const n of g.neighbors(h)) {
        if (dist[n] >= 0 || isWater(terrain[n]) || g.lat(n) < FIXED_SOUTH - 1) continue;
        dist[n] = d;
        out[n] = out[h];
        next.push(n);
      }
    }
    frontier = next;
  }
  return out;
}

const edgePortals = (g: Grid, terrain: Uint8Array, col: number) =>
  [...Array(g.H).keys()].map((r) => g.idx(col, r)).filter((i) => isWater(terrain[i]));

// ---------------- Old World ----------------

/**
 * The African coast south of FIXED_SOUTH: the outline jittered, warped by noise, and decorated with
 * capes, bays and island groups. Different every game.
 */
function africaLand(seed: number): (lat: number, lon: number) => boolean {
  const rng = mulberry32(hashSeed(seed, 21));
  const nx = createNoise2D(mulberry32(hashSeed(seed, 22)));
  const ny = createNoise2D(mulberry32(hashSeed(seed, 23)));
  const ring = AFRICA_OUTLINE.map(([lon, lat, j]) => [lon + range(rng, -j, j), lat + range(rng, -j * 0.4, j * 0.4)] as [number, number]);
  const blobs: (Blob & { sea: boolean })[] = [];
  // capes and bays along the coast
  const coastPts = ring.slice(2, -3);
  for (let k = 0; k < 7; k++) {
    const [lon, lat] = coastPts[int(rng, 0, coastPts.length - 1)];
    const sea = k % 2 === 1;
    blobs.push({ lat: lat + range(rng, -1.5, 1.5), lon: lon + (sea ? range(rng, 0.3, 1.2) : range(rng, -1.8, -0.6)), r: range(rng, 0.9, 1.8), w: 1, sea });
  }
  // a Cape Verde-like archipelago, Canary-like islets near the known coast, Gulf islands, and strays
  const group = (lat: number, lon: number, n: number, spread: number, r: [number, number]) => {
    for (let k = 0; k < n; k++) blobs.push({ lat: lat + range(rng, -spread, spread), lon: lon + range(rng, -spread, spread), r: range(rng, r[0], r[1]), w: 1, sea: false });
  };
  if (rng() < 0.85) group(range(rng, 13, 18), range(rng, -25, -21.5), int(rng, 4, 7), 1.8, [0.4, 0.8]);
  group(range(rng, 27.6, 29), range(rng, -18, -15), int(rng, 3, 5), 1.4, [0.35, 0.6]);
  if (rng() < 0.8) group(range(rng, -1.5, 3.5), range(rng, 5, 8), int(rng, 2, 3), 1.2, [0.4, 0.7]);
  group(range(rng, 2, 25), range(rng, -25, -20), int(rng, 1, 3), 4, [0.4, 0.9]);
  return (lat, lon) => {
    const fade = Math.min(1, Math.max(0, (FIXED_SOUTH - lat) / 3)); // no warp at the seam with fixed Morocco
    const w = 1.7 * fade;
    const wl = lon + fbm(nx, lon * 0.16, lat * 0.16) * w;
    const wa = lat + fbm(ny, lon * 0.16 + 9, lat * 0.16) * w;
    let land = pointInRing(wl, wa, ring);
    for (const b of blobs) {
      const d2 = ((lat - b.lat) ** 2 + (lon - b.lon) ** 2) / (b.r * b.r);
      if (d2 < 1) land = !b.sea;
    }
    return land;
  };
}

export function generateOldWorld(seed: number, crown: CrownId = 'spain'): MapData {
  const g = OLD;
  const africa = africaLand(seed);
  const land = new Uint8Array(g.N);
  for (let i = 0; i < g.N; i++) {
    const lat = g.lat(i), lon = g.lon(i);
    land[i] = (lat >= FIXED_SOUTH ? OLD_WORLD.some((ring) => pointInRing(lon, lat, ring)) : africa(lat, lon)) ? 1 : 0;
  }
  for (const [, lat, lon] of ATLANTIC_ISLANDS) land[g.hexAt(lat, lon)] = 1;
  for (const [lat, lon] of STRAITS) land[g.hexAt(lat, lon)] = 0;
  // Europe is shaped with a fixed seed so it looks the same every game; the south with the game's seed
  const north = shapeTerrain(g, land.slice(), OLD_WORLD_SEED, true);
  const south = shapeTerrain(g, land.slice(), seed, true);
  const isNorth = (i: number) => g.lat(i) >= FIXED_SOUTH;
  const terrain = new Uint8Array(g.N), elevation = new Float32Array(g.N);
  for (let i = 0; i < g.N; i++) {
    const src = isNorth(i) ? north : south;
    terrain[i] = src.terrain[i];
    elevation[i] = src.elevation[i];
  }
  for (const [lat, lon] of [[46.3, 8.0], [46.5, 9.5], [46.6, 11.0], [46.8, 12.5], [42.7, 1.5], [42.7, 0.2], [42.8, -1.2], [37.1, -3.3]] as const) {
    const h = g.hexAt(lat, lon);
    if (!isWater(terrain[h])) { terrain[h] = T.Mountains; elevation[h] = 0.9; }
  }
  const rng = mulberry32(hashSeed(seed, 24));
  const rivers = makeRivers(g, terrain, elevation, south.toSea, rng, (i) => g.lat(i) < FIXED_SOUTH - 2, 5);

  // Cities go down largest first, each keeping one empty hex to its neighbours.
  const taken = new Set<number>();
  const blocked = new Set<number>();
  const ports: PortDef[] = CITIES.map((c) => {
    const hex = placeCity(g, terrain, c.lat, c.lon, c.coastal, blocked);
    taken.add(hex);
    blocked.add(hex);
    for (const n of g.neighbors(hex)) blocked.add(n);
    return {
      id: c.id, name: c.name, map: 'old', hex, kind: c.realm === crown ? 'home' : 'foreign', nation: realmName(c.realm),
      realm: c.realm, size: c.size, ...(c.coastal ? {} : { inland: true }), blurb: c.blurb,
    };
  });
  const realm = realmMap(g, terrain, [
    ...ports.map((p) => ({ hex: p.hex, realm: p.realm! })),
    ...REALM_SEEDS.map(([lat, lon, r]) => ({ hex: nearestLand(g, terrain, g.hexAt(lat, lon)), realm: r })),
  ]);
  const coastalPeoples = placeSites(g, terrain, rng, 'old', [[20, 27.5, 2], [13, 20, 2], [7, 13, 2], [2, 7, 2], [-4, 2, 1]], (i) => g.lat(i) < 27.5 && !taken.has(i));
  for (const p of coastalPeoples) p.blurb = `A trading ground of the ${p.people}, who have heard rumours of strangers in ships from the north.`;
  ports.push(...coastalPeoples);
  const decorCities: MapData['decorCities'] = [];
  const islandNames = south.comps
    .filter((c) => c.length >= 2 && c.length < 40 && g.lat(c[0]) < FIXED_SOUTH - 1)
    .map((c) => ({ name: islandName(rng), hex: [...c].sort((a, b) => south.toSea[b] - south.toSea[a])[0] }));
  const wind = [0, 1, 2, 3].map((sn) => windField(g, OLD_WORLD_SEED, sn, terrain));
  const south_ = (i: number) => g.lat(i) < FIXED_SOUTH - 2;
  const { resource } = placeResources(g, terrain, rivers, south.toSea, rng, 'old', south_);
  const rumours = placeRumours(g, terrain, south.toSea, rng, 5, south_);
  const nations = placeNations(g, terrain, south.toSea, rng, coastalPeoples, 'old');
  return {
    id: 'old', terrain, elevation, rivers, wind, ports, decorCities, islandNames, monsters: [], realm,
    portals: edgePortals(g, terrain, 0), mainland: south.mainland, deep: south.deep, resource, rumours, nations,
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
  const { terrain, elevation, toSea, comps, deep } = shapeTerrain(g, land, seed, false, ridge);
  const mainland = new Uint8Array(g.N);
  for (const c of comps) if (c.length >= 40) for (const h of c) mainland[h] = 1;

  const rivers = makeRivers(g, terrain, elevation, toSea, rng, () => true, 10);
  const ports = placeSites(g, terrain, rng, 'new', [[44, 62, 2], [33, 44, 2], [22, 33, 2], [10, 22, 2], [-6, 10, 2]], (i) => g.lon(i) < -45);

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
  const { resource } = placeResources(g, terrain, rivers, toSea, rng, 'new', () => true);
  const rumours = placeRumours(g, terrain, toSea, rng, 9, () => true);
  const nations = placeNations(g, terrain, toSea, rng, ports, 'new');
  return {
    id: 'new', terrain, elevation, rivers, wind, ports, decorCities: [], islandNames, monsters, realm: new Uint8Array(g.N),
    portals: edgePortals(g, terrain, g.W - 1), mainland, deep, resource, rumours, nations,
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
  // steady bands with smooth edges: a pilot can learn them and rely on them
  const band = (L: number): [number, number] => {
    if (L >= 37) return [-0.2, 0.9]; // westerlies blow toward the east
    if (L >= 30) return [Math.PI * 0.75, 0.4]; // horse latitudes: light northerlies drifting southwest
    if (L >= 7) return [Math.PI + 0.32, 1]; // NE trade winds blow toward the west-southwest
    return [Math.PI * 0.6, 0.25]; // doldrums: light and slow
  };
  for (let i = 0; i < g.N; i++) {
    const L = g.lat(i) - shift;
    const n = noise(g.lon(i) * 0.03, L * 0.03);
    // blend across band edges over about 6 degrees of latitude, as vectors
    let vx = 0, vy = 0, st = 0;
    for (let k = -3; k <= 3; k++) {
      const [ba, bs] = band(L + k);
      vx += Math.cos(ba) * bs;
      vy += Math.sin(ba) * bs;
      st += bs / 7;
    }
    const a = Math.atan2(vy, vx);
    angle[i] = a + n * 0.12;
    strength[i] = Math.max(0.15, Math.min(1, st + n * 0.04));
    if (!isWater(terrain[i])) strength[i] *= 0.5;
  }
  return { angle, strength };
}

export function generateWorld(seed: number, crown: CrownId = 'spain'): World {
  return { seed, crown, old: generateOldWorld(seed, crown), new: generateNewWorld(seed) };
}
