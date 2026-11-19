/**
 * Draws the static map art once, on canvases: a watercolour wash layer (low resolution, soft)
 * and an ink layer (coastlines, water-lining, rivers, terrain symbols) split into chunks.
 * The land/sea boundary is a smooth field blended from hex centres, so coasts never follow hex edges.
 */
import { createNoise2D } from 'simplex-noise';
import { T, TERRAIN_INFO, isWater } from '../data/terrain';
import { HEX_R, HEX_W, type Grid } from '../sim/hex';
import { mulberry32, hashSeed, range, int, pick, type Rng } from '../sim/rng';
import type { MapData } from '../sim/types';
import type { Assets } from './assets';

export const INK_RES = 1.5;
export const CHUNK = 1024;
export const WASH_SCALE = 0.25;
const CELL = 6;
const INK = [74, 50, 30];

export interface DistanceField {
  gw: number;
  gh: number;
  /** signed distance to the coast in map px, positive on land */
  d: Float32Array;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function buildField(g: Grid, m: MapData, seed: number): DistanceField {
  const gw = Math.ceil(g.pxW / CELL) + 2;
  const gh = Math.ceil(g.pxH / CELL) + 2;
  const noise = createNoise2D(mulberry32(hashSeed(seed, 77)));
  const f = new Float32Array(gw * gh);
  const sigma2 = 2 * (0.42 * HEX_W) ** 2;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * CELL, y = gy * CELL;
      const h = g.atPixel(x, y);
      let v: number;
      if (h < 0) {
        v = 0;
      } else {
        let sw = 0, sl = 0;
        for (const j of [h, ...g.neighbors(h)]) {
          const w = Math.exp(-((x - g.cx(j)) ** 2 + (y - g.cy(j)) ** 2) / sigma2);
          sw += w;
          if (!isWater(m.terrain[j])) sl += w;
        }
        v = sl / sw;
      }
      v += noise(x * 0.016, y * 0.016) * 0.15 + noise(x * 0.05, y * 0.05) * 0.07 + noise(x * 0.12, y * 0.12) * 0.03;
      f[gy * gw + gx] = v;
    }
  }
  // signed distance from value and gradient
  const d = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const k = gy * gw + gx;
      const fx = (f[gy * gw + Math.min(gw - 1, gx + 1)] - f[gy * gw + Math.max(0, gx - 1)]) / (2 * CELL);
      const fy = (f[Math.min(gh - 1, gy + 1) * gw + gx] - f[Math.max(0, gy - 1) * gw + gx]) / (2 * CELL);
      const g = Math.max(0.004, Math.hypot(fx, fy));
      d[k] = Math.max(-60, Math.min(60, (f[k] - 0.5) / g));
    }
  }
  return { gw, gh, d };
}

export function sampleField(fd: DistanceField, x: number, y: number): number {
  const gx = Math.max(0, Math.min(fd.gw - 1.001, x / CELL));
  const gy = Math.max(0, Math.min(fd.gh - 1.001, y / CELL));
  const x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0;
  const k = y0 * fd.gw + x0;
  const a = fd.d[k], b = fd.d[k + 1], c = fd.d[k + fd.gw], e = fd.d[k + fd.gw + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Soft watercolour washes for land and sea. */
export function drawWash(g: Grid, m: MapData, fd: DistanceField, seed: number): HTMLCanvasElement {
  const w = Math.ceil(g.pxW * WASH_SCALE), h = Math.ceil(g.pxH * WASH_SCALE);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const noise = createNoise2D(mulberry32(hashSeed(seed, 78)));
  const colors = Object.fromEntries(Object.entries(TERRAIN_INFO).map(([k, v]) => [k, hexRgb(v.wash)]));
  const sea = hexRgb('#97aeb5'), shore = hexRgb('#b4c6c0'), abyss = hexRgb('#7d97a3');
  const sigma2 = 2 * (0.5 * HEX_W) ** 2;
  for (let py = 0; py < h; py++) {
    for (let pxi = 0; pxi < w; pxi++) {
      const x = (pxi + 0.5) / WASH_SCALE, y = (py + 0.5) / WASH_SCALE;
      const d = sampleField(fd, x, y);
      const mottle = noise(x * 0.008, y * 0.008) * 0.5 + noise(x * 0.03, y * 0.03) * 0.25;
      const o = (py * w + pxi) * 4;
      let r: number, gr: number, b: number, a: number;
      if (d > -1.5) {
        // land: blend biome colours of nearby land hexes
        const hh = g.atPixel(x, y);
        let sr = 0, sg = 0, sb = 0, sw = 0;
        if (hh >= 0) {
          for (const j of [hh, ...g.neighbors(hh)]) {
            if (isWater(m.terrain[j])) continue;
            const wt = Math.exp(-((x - g.cx(j)) ** 2 + (y - g.cy(j)) ** 2) / sigma2);
            const c = colors[m.terrain[j]];
            sr += c[0] * wt; sg += c[1] * wt; sb += c[2] * wt; sw += wt;
          }
        }
        if (sw === 0) { sr = 195; sg = 191; sb = 124; sw = 1; }
        r = sr / sw; gr = sg / sw; b = sb / sw;
        // watercolour pools darker at its edge
        const rim = 1 - smooth(0, 7, d);
        const dark = 1 - 0.14 * rim + mottle * 0.08;
        r *= dark; gr *= dark; b *= dark;
        a = (0.62 + 0.2 * rim + mottle * 0.12) * smooth(-1.5, 1.5, d);
      } else {
        const t = smooth(-2, -26, d);
        // the open ocean reads a shade darker, blended across neighbouring hexes
        const hh = g.atPixel(x, y);
        let dp = 0;
        if (hh >= 0) {
          const ns = g.neighbors(hh);
          dp = (m.deep[hh] * 2 + ns.reduce((a, j) => a + m.deep[j], 0)) / (2 + ns.length);
        }
        const base = [sea[0] + (abyss[0] - sea[0]) * dp, sea[1] + (abyss[1] - sea[1]) * dp, sea[2] + (abyss[2] - sea[2]) * dp];
        r = shore[0] + (base[0] - shore[0]) * t;
        gr = shore[1] + (base[1] - shore[1]) * t;
        b = shore[2] + (base[2] - shore[2]) * t;
        a = 0.5 + mottle * 0.12 + 0.06 * t;
      }
      px[o] = r; px[o + 1] = gr; px[o + 2] = b; px[o + 3] = Math.max(0, Math.min(1, a)) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // rivers in blue
  ctx.save();
  ctx.scale(WASH_SCALE, WASH_SCALE);
  ctx.strokeStyle = 'rgba(110,145,160,0.85)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pts of riverLines(g, m, seed)) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
    ctx.stroke();
  }
  ctx.restore();
  return cv;
}

function chaikin(pts: number[], iters = 2): number[] {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const out = [p[0], p[1]];
    for (let k = 0; k < p.length - 2; k += 2) {
      const [x0, y0, x1, y1] = [p[k], p[k + 1], p[k + 2], p[k + 3]];
      out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    out.push(p[p.length - 2], p[p.length - 1]);
    p = out;
  }
  return p;
}

const riverCache = new WeakMap<MapData, number[][]>();
export function riverLines(g: Grid, m: MapData, seed: number): number[][] {
  const hit = riverCache.get(m);
  if (hit) return hit;
  const rng = mulberry32(hashSeed(seed, 79));
  const centerX = g.cx, centerY = g.cy;
  const lines = m.rivers.map((path) => {
    const pts: number[] = [];
    path.forEach((h, k) => {
      const last = k === path.length - 1;
      let x = centerX(h) + (last ? 0 : range(rng, -6, 6));
      let y = centerY(h) + (last ? 0 : range(rng, -6, 6));
      if (last) {
        // stop at the coast, between the last land hex and the sea
        x = (x + centerX(path[k - 1])) / 2;
        y = (y + centerY(path[k - 1])) / 2;
      }
      pts.push(x, y);
    });
    return chaikin(pts, 3);
  });
  riverCache.set(m, lines);
  return lines;
}

interface Symbol { key: string; x: number; y: number; w: number; h: number }

function placeSymbols(g: Grid, m: MapData, assets: Assets, fd: DistanceField, seed: number): Symbol[] {
  const centerX = g.cx, centerY = g.cy;
  const out: Symbol[] = [];
  const skip = new Set<number>();
  for (const p of m.ports) [p.hex, ...g.neighbors(p.hex)].forEach((h) => skip.add(h));
  for (const c of m.decorCities) skip.add(c.hex);
  const size = (key: string) => assets.manifest[key.split('/')[0]].find((s) => s.name === key.split('/')[1])!;
  const add = (key: string, x: number, y: number, w: number) => {
    if (sampleField(fd, x, y) < 2) return; // keep symbols on dry land
    const s = size(key);
    out.push({ key, x, y, w, h: (w * s.h) / s.w });
  };
  const scatter = (rng: Rng, i: number, n: number, keys: string[], w: [number, number]) => {
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * HEX_R * 0.7;
      add(pick(rng, keys), centerX(i) + Math.cos(a) * r, centerY(i) + Math.sin(a) * r * 0.8 + 6, range(rng, w[0], w[1]));
    }
  };
  const trees = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `terrain/tree-${k}`);
  const conifers = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `terrain/conifer-${k}`);
  const palms = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `terrain/palm-${k}`);
  const hills = [0, 1, 2, 3, 4].map((k) => `terrain/hill-${k}`);
  for (let i = 0; i < g.N; i++) {
    if (skip.has(i)) continue;
    const t = m.terrain[i];
    const rng = mulberry32(hashSeed(seed, i, 80));
    const cx = centerX(i), cy = centerY(i);
    switch (t) {
      case T.Mountains: {
        const big = m.elevation[i] > 0.92 || rng() < 0.35;
        add(big ? pick(rng, ['terrain/mountain-3', 'terrain/mountain-4']) : pick(rng, ['terrain/mountain-1', 'terrain/mountain-2']),
          cx + range(rng, -5, 5), cy + HEX_R * 0.45, big ? range(rng, 70, 84) : range(rng, 52, 62));
        break;
      }
      case T.Hills:
        add(pick(rng, hills), cx + range(rng, -6, 6), cy + HEX_R * 0.35, range(rng, 40, 52));
        break;
      case T.Forest: scatter(rng, i, int(rng, 3, 4), trees, [13, 18]); break;
      case T.Taiga: scatter(rng, i, int(rng, 4, 5), conifers, [9, 13]); break;
      case T.Jungle: scatter(rng, i, int(rng, 3, 5), palms, [13, 18]); if (rng() < 0.4) scatter(rng, i, 1, trees, [13, 16]); break;
      case T.Savanna: if (rng() < 0.45) scatter(rng, i, int(rng, 1, 2), palms, [11, 15]); break;
      case T.Plains: if (rng() < 0.3) scatter(rng, i, 1, trees, [11, 14]); break;
      case T.Marsh: scatter(rng, i, 2, ['terrain/marsh-0', 'terrain/marsh-1', 'terrain/marsh-2'], [14, 18]); break;
      case T.Shallows:
        if (g.lat(i) < 30 && rng() < 0.05) {
          const s = size('terrain/rocks-0');
          out.push({ key: pick(rng, ['terrain/rocks-0', 'terrain/rocks-1']), x: cx, y: cy + 6, w: 22, h: (22 * s.h) / s.w });
        }
        break;
    }
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

/** Ink layer chunks. Each chunk covers CHUNK/INK_RES map px. */
export function drawInk(g: Grid, m: MapData, assets: Assets, fd: DistanceField, seed: number): { canvas: HTMLCanvasElement; x: number; y: number }[] {
  const symbols = placeSymbols(g, m, assets, fd, seed);
  const rivers = riverLines(g, m, seed);
  const span = CHUNK / INK_RES;
  const cols = Math.ceil(g.pxW / span), rows = Math.ceil(g.pxH / span);
  const noise = createNoise2D(mulberry32(hashSeed(seed, 81)));
  const chunks: { canvas: HTMLCanvasElement; x: number; y: number }[] = [];
  for (let cr = 0; cr < rows; cr++) {
    for (let cc = 0; cc < cols; cc++) {
      const x0 = cc * span, y0 = cr * span;
      const tw = Math.min(CHUNK, Math.ceil((g.pxW - x0) * INK_RES));
      const th = Math.min(CHUNK, Math.ceil((g.pxH - y0) * INK_RES));
      const cv = document.createElement('canvas');
      cv.width = tw;
      cv.height = th;
      const ctx = cv.getContext('2d')!;
      const img = ctx.createImageData(tw, th);
      const px = img.data;
      for (let py = 0; py < th; py++) {
        const y = y0 + (py + 0.5) / INK_RES;
        for (let pxi = 0; pxi < tw; pxi++) {
          const x = x0 + (pxi + 0.5) / INK_RES;
          const d = sampleField(fd, x, y);
          if (d < -18 || d > 6) continue;
          let a = 0;
          // the coastline itself, slightly uneven like a pen line
          const wob = noise(x * 0.05, y * 0.05);
          const half = 0.75 + 0.35 * wob;
          a = Math.max(a, 1 - smooth(half - 0.35, half + 0.45, Math.abs(d)));
          if (d < 0) {
            // water-lining: fading lines that follow the shore
            const s = -d;
            for (let k = 1; k <= 4; k++) {
              const pos = 3.3 * k + wob * 0.6;
              const line = 1 - smooth(0.25, 0.75, Math.abs(s - pos));
              a = Math.max(a, line * [0, 0.5, 0.38, 0.26, 0.15][k]);
            }
          } else {
            // a little shading just inside the shore
            a = Math.max(a, 0.22 * (1 - smooth(1, 5, d)));
          }
          if (a <= 0.01) continue;
          const o = (py * tw + pxi) * 4;
          px[o] = INK[0]; px[o + 1] = INK[1]; px[o + 2] = INK[2]; px[o + 3] = a * 235;
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.setTransform(INK_RES, 0, 0, INK_RES, -x0 * INK_RES, -y0 * INK_RES);
      ctx.imageSmoothingQuality = 'high';
      // rivers: thin at the source, wider at the mouth
      ctx.strokeStyle = `rgba(${INK.join(',')},0.85)`;
      ctx.lineCap = 'round';
      for (const pts of rivers) {
        const n = pts.length / 2;
        for (let k = 0; k < n - 1; k++) {
          ctx.lineWidth = 0.7 + (k / n) * 1.6;
          ctx.beginPath();
          ctx.moveTo(pts[2 * k], pts[2 * k + 1]);
          ctx.lineTo(pts[2 * k + 2], pts[2 * k + 3]);
          ctx.stroke();
        }
      }
      for (const s of symbols) {
        if (s.x + s.w / 2 < x0 || s.x - s.w / 2 > x0 + span || s.y < y0 || s.y - s.h > y0 + span) continue;
        ctx.drawImage(assets.img[s.key], s.x - s.w / 2, s.y - s.h, s.w, s.h);
      }
      chunks.push({ canvas: cv, x: x0, y: y0 });
    }
  }
  return chunks;
}

/** Fog mask: white, alpha = how revealed. Low resolution and blurred. */
export const MASK_SCALE = 1 / 8;
export function drawFogMask(g: Grid, cv: HTMLCanvasElement, fog: ArrayLike<number>, level: number): void {
  const w = Math.ceil(g.pxW * MASK_SCALE), h = Math.ceil(g.pxH * MASK_SCALE);
  if (cv.width !== w) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  const r = HEX_R * 1.05 * MASK_SCALE;
  ctx.beginPath();
  for (let i = 0; i < fog.length; i++) {
    if (fog[i] < level) continue;
    const x = g.cx(i) * MASK_SCALE, y = g.cy(i) * MASK_SCALE;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  // soften the edge (box blur on alpha, 2 passes)
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) src[k] = img.data[k * 4 + 3];
  const tmp = new Float32Array(w * h);
  const R = 2;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -R; k <= R; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } }
      tmp[y * w + x] = s / n;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -R; k <= R; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
      src[y * w + x] = s / n;
    }
  }
  for (let k = 0; k < w * h; k++) {
    img.data[k * 4] = 255; img.data[k * 4 + 1] = 255; img.data[k * 4 + 2] = 255; img.data[k * 4 + 3] = src[k];
  }
  ctx.putImageData(img, 0, 0);
}

/** Blank parchment for the map area, at veil resolution. */
export const VEIL_SCALE = 0.5;
export const PAPER_BG = '#efe2c4';
export const PAPER_ALPHA = 0.55;
export const PAPER_TILE = 0.9;

export function drawPaper(g: Grid, parchment: HTMLImageElement): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(g.pxW * VEIL_SCALE);
  cv.height = Math.ceil(g.pxH * VEIL_SCALE);
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const pat = ctx.createPattern(parchment, 'repeat')!;
  pat.setTransform(new DOMMatrix().scale(PAPER_TILE * VEIL_SCALE));
  ctx.globalAlpha = PAPER_ALPHA;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

/** A veil is the paper with holes where the map is revealed. */
export function drawVeil(veil: HTMLCanvasElement, paper: HTMLCanvasElement, mask: HTMLCanvasElement): void {
  if (veil.width !== paper.width) { veil.width = paper.width; veil.height = paper.height; }
  const ctx = veil.getContext('2d')!;
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(paper, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mask, 0, 0, veil.width, veil.height);
  ctx.globalCompositeOperation = 'source-over';
}
