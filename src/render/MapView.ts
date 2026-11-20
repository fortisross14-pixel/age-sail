import { isMilitary } from '../data/army';
import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite, CanvasSource } from 'pixi.js';
import { SHIPS } from '../data/ships';
import { SEA_LABELS } from '../data/europe';
import { isWater } from '../data/terrain';
import { HEX_R, HEX_W, GRIDS, type Grid, type MapId } from '../sim/hex';
import { Fog, seasonOf, type GameState, type World, type Fleet, type MapData, type PortDef } from '../sim/types';
import { realmSpec, realmAt } from '../data/realms';
import { crownSpec } from '../data/rivals';
import type { Assets } from './assets';
import {
  buildField, drawWash, drawInk, drawFogMask, drawPaper, drawVeil, INK_RES, WASH_SCALE, VEIL_SCALE, PAPER_ALPHA, PAPER_TILE,
} from './mapArt';
import { CROWN, NATIVE, type CrownKey } from './palette';
import { RESOURCES, RESOURCE_IDS } from '../data/city';
import { UNIT_INFO } from '../data/court';
import { colonyKind } from './colonyKind';

export interface RoutePreview { path: number[]; turns: number; risk: number; turnEnds: number[]; cross: boolean }

export interface ViewUi {
  map: MapId;
  selectedFleet: number | null;
  selectedParty: number | null;
  /** shore hexes the selected fleet can land on, while choosing */
  landing: number[] | null;
  preview: RoutePreview | null;
  showWind: boolean;
  showGrid: boolean;
  highlightAll: boolean;
}

export interface MapCallbacks {
  onClick: (map: MapId, hex: number, fleetId: number | null, partyId: number | null) => void;
  onRightClick: (map: MapId, hex: number) => void;
  onHover: (map: MapId, hex: number) => void;
  /** the part of the board in view, in board pixels, after every camera move */
  onCamera?: (map: MapId, view: { x: number; y: number; w: number; h: number }) => void;
}

const MARGIN = 220;
const INK_HEX = 0x4a321e;
const ROUTE = 0x8b2a1a;

function canvasTexture(cv: HTMLCanvasElement, mip = false): Texture {
  return new Texture({ source: new CanvasSource({ resource: cv, autoGenerateMipmaps: mip, scaleMode: 'linear' }) });
}

function label(text: string, size: number, opts: { italic?: boolean; color?: string; spacing?: number; halo?: boolean } = {}) {
  const t = new Text({
    text,
    style: {
      fontFamily: '"IM Fell English", Georgia, serif', fontSize: size, fontStyle: opts.italic ? 'italic' : 'normal',
      fill: opts.color ?? '#3b2614', letterSpacing: opts.spacing ?? 0,
      ...(opts.halo ? { stroke: { color: '#f3e6c8', width: Math.max(3, size / 4), join: 'round' as const } } : {}),
    },
    resolution: 3,
  });
  t.anchor.set(0.5);
  return t;
}

function chaikin(pts: number[]): number[] {
  if (pts.length < 6) return pts;
  const out = [pts[0], pts[1]];
  for (let k = 0; k < pts.length - 2; k += 2) {
    out.push(0.75 * pts[k] + 0.25 * pts[k + 2], 0.75 * pts[k + 1] + 0.25 * pts[k + 3],
      0.25 * pts[k] + 0.75 * pts[k + 2], 0.25 * pts[k + 1] + 0.75 * pts[k + 3]);
  }
  out.push(pts[pts.length - 2], pts[pts.length - 1]);
  return out;
}

function dashed(g: Graphics, pts: number[], dash: number, gap: number) {
  let on = true, left = dash;
  for (let k = 0; k < pts.length - 2; k += 2) {
    let x = pts[k], y = pts[k + 1];
    const x1 = pts[k + 2], y1 = pts[k + 3];
    let seg = Math.hypot(x1 - x, y1 - y);
    const ux = (x1 - x) / (seg || 1), uy = (y1 - y) / (seg || 1);
    while (seg > 0) {
      const step = Math.min(left, seg);
      const nx = x + ux * step, ny = y + uy * step;
      if (on) g.moveTo(x, y).lineTo(nx, ny);
      x = nx; y = ny; seg -= step; left -= step;
      if (left <= 0) { on = !on; left = on ? dash : gap; }
    }
  }
}

interface FleetSprite {
  root: Container;
  ring: Graphics;
  ship: Sprite;
  badge: Container;
  anim: { pts: number[]; t0: number; dur: number } | null;
  facing: number;
  target: string;
}

/** Everything drawn for one board. */
class Scene {
  root = new Container();
  cam = { x: 0, y: 0, scale: 0.7, set: false };
  private fogKnown = document.createElement('canvas');
  private fogSeen = document.createElement('canvas');
  private paper!: HTMLCanvasElement;
  private veilInk = document.createElement('canvas');
  private veilWash = document.createElement('canvas');
  private veilInkTex!: Texture;
  private veilWashTex!: Texture;
  grid = new Graphics();
  windG = new Graphics();
  routes = new Graphics();
  hover = new Graphics();
  highlight = new Graphics();
  previewLabel = label('', 15, { italic: true, color: '#7a2416' });
  turnMarks = new Container();
  ports = new Container();
  fleets = new Container();
  labels = new Container();
  monsters = new Container();
  plateLayer = new Container();
  portPlates = new Map<string, Container>();
  plates: Container[] = [];
  resLayer = new Container();
  rumourLayer = new Container();
  parties = new Container();
  landingG = new Graphics();
  colonyLayer = new Container();
  nationLayer = new Container();
  rivalLayer = new Container();
  rivalShipLayer = new Container();
  lastRivals = '';
  lastNations = '';
  territoryG = new Graphics();
  lastColonies = '';
  partySprites = new Map<number, { root: Container; ring: Graphics; fig: Sprite; target: string }>();
  lastFinds = '';
  fleetSprites = new Map<number, FleetSprite>();
  portSprites = new Map<string, Container>();
  decorLabels: { hex: number; node: Container }[] = [];
  islandLabels: { hex: number; node: Container }[] = [];
  monsterSprites: { hex: number; node: Sprite }[] = [];
  lastFogKey = '';
  lastSeason = -1;

  /** your crown's colours, for everything that is yours on the map */
  readonly me: (typeof CROWN)[CrownKey];

  constructor(readonly g: Grid, readonly m: MapData, private seed: number, private assets: Assets, crown: CrownKey = 'spain') {
    this.me = CROWN[crown];
  }

  async build(progress: (msg: string) => void) {
    const { g, m, assets } = this;
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const paper = new TilingSprite({ texture: Texture.from(assets.img.parchment), width: g.pxW + 2 * MARGIN, height: g.pxH + 2 * MARGIN });
    paper.position.set(-MARGIN, -MARGIN);
    paper.alpha = PAPER_ALPHA;
    paper.tileScale.set(PAPER_TILE);
    this.root.addChild(paper);
    this.paper = drawPaper(g, assets.img.parchment);
    const inner = new Sprite(canvasTexture(this.paper));
    inner.scale.set(1 / VEIL_SCALE);
    this.root.addChild(inner);
    const frame = new Graphics()
      .rect(-14, -14, g.pxW + 28, g.pxH + 28).stroke({ width: 3, color: INK_HEX, alpha: 0.7 })
      .rect(-6, -6, g.pxW + 12, g.pxH + 12).stroke({ width: 1, color: INK_HEX, alpha: 0.6 });
    this.root.addChild(frame);

    progress('Charting coastlines…');
    await tick();
    const field = buildField(g, m, this.seed);
    progress('Washing the colours…');
    await tick();
    const wash = new Sprite(canvasTexture(drawWash(g, m, field, this.seed)));
    wash.scale.set(1 / WASH_SCALE);
    this.root.addChild(wash);
    drawFogMask(g, this.fogSeen, [], Fog.Explored);
    drawVeil(this.veilWash, this.paper, this.fogSeen);
    this.veilWashTex = canvasTexture(this.veilWash);
    const veilWash = new Sprite(this.veilWashTex);
    veilWash.scale.set(1 / VEIL_SCALE);
    this.root.addChild(veilWash);

    progress('Inking the chart…');
    await tick();
    const ink = new Container();
    for (const c of drawInk(g, m, assets, field, this.seed)) {
      const s = new Sprite(canvasTexture(c.canvas, true));
      s.position.set(c.x, c.y);
      s.scale.set(1 / INK_RES);
      ink.addChild(s);
    }
    this.root.addChild(ink);
    if (m.realm.some((r) => r > 0)) this.root.addChild(this.realms());
    drawFogMask(g, this.fogKnown, [], Fog.Charted);
    drawVeil(this.veilInk, this.paper, this.fogKnown);
    this.veilInkTex = canvasTexture(this.veilInk);
    const veilInk = new Sprite(this.veilInkTex);
    veilInk.scale.set(1 / VEIL_SCALE);
    this.root.addChild(veilInk);

    // the blank chart's own furniture sits on top of the fog
    this.root.addChild(this.rhumbLines());
    this.drawGrid();
    this.root.addChild(this.grid);
    this.root.addChild(this.portalBand());
    this.buildMonsters();
    this.root.addChild(this.monsters, this.windG, this.territoryG, this.labels, this.nationLayer, this.resLayer, this.rumourLayer, this.routes, this.landingG, this.turnMarks, this.highlight,
      this.ports, this.colonyLayer, this.rivalLayer, this.parties, this.rivalShipLayer, this.fleets, this.plateLayer, this.hover, this.previewLabel);
    this.buildLabels();
    this.buildPorts();
  }

  /**
   * Realms on the chart, as on a period map: a light wash of each realm's colour, a coloured band
   * inside each border, a dashed ink line between neighbours, and the realm's name in spaced capitals.
   */
  private realms(): Container {
    const { g, m } = this;
    const root = new Container();
    const wash = new Graphics(), bands = new Graphics(), ink = new Graphics(), names = new Container();
    const colour = (code: number) => realmSpec(realmAt(code)!).color;
    for (let i = 0; i < g.N; i++) if (m.realm[i]) wash.poly(g.corners(i)).fill({ color: colour(m.realm[i]), alpha: 0.13 });
    const seen = new Set<string>();
    for (let i = 0; i < g.N; i++) {
      const r = m.realm[i];
      if (!r || isWater(m.terrain[i])) continue;
      const cs = g.corners(i);
      const cx = g.cx(i), cy = g.cy(i);
      for (const n of g.neighbors(i)) {
        const rn = m.realm[n];
        if (rn === r || isWater(m.terrain[n])) continue;
        // the shared edge: the two corners of this hex closest to the neighbour's centre
        const nx = g.cx(n), ny = g.cy(n);
        const pts: [number, number][] = [];
        for (let k = 0; k < cs.length; k += 2) pts.push([cs[k], cs[k + 1]]);
        pts.sort((a, b) => Math.hypot(a[0] - nx, a[1] - ny) - Math.hypot(b[0] - nx, b[1] - ny));
        const [a, b] = pts;
        // inner band, pulled a little toward this hex's centre
        const pull = 0.16;
        bands.moveTo(a[0] + (cx - a[0]) * pull, a[1] + (cy - a[1]) * pull).lineTo(b[0] + (cx - b[0]) * pull, b[1] + (cy - b[1]) * pull);
        bands.stroke({ width: 5, color: colour(r), alpha: 0.7, cap: 'round' });
        const key = i < n ? `${i}|${n}` : `${n}|${i}`;
        if (rn && !seen.has(key)) {
          seen.add(key);
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let t = 0; t < len; t += 7) {
            const u0 = t / len, u1 = Math.min(1, (t + 4) / len);
            ink.moveTo(a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0).lineTo(a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1);
          }
        }
      }
    }
    ink.stroke({ width: 1.6, color: INK_HEX, alpha: 0.8 });
    // names at the middle of each realm's largest stretch of land, larger for larger realms
    const byRealm = new Map<number, number[]>();
    for (let i = 0; i < g.N; i++) if (m.realm[i] && !isWater(m.terrain[i])) (byRealm.get(m.realm[i]) ?? byRealm.set(m.realm[i], []).get(m.realm[i])!).push(i);
    for (const [code, hexes] of byRealm) {
      if (hexes.length < 6) continue;
      const mx = hexes.reduce((t, h) => t + g.cx(h), 0) / hexes.length, my = hexes.reduce((t, h) => t + g.cy(h), 0) / hexes.length;
      const at = hexes.reduce((b, h) => (Math.hypot(g.cx(h) - mx, g.cy(h) - my) < Math.hypot(g.cx(b) - mx, g.cy(b) - my) ? h : b));
      const spec = realmSpec(realmAt(code)!);
      const size = Math.min(30, 13 + Math.sqrt(hexes.length) * 1.1);
      const t = label(spec.name.replace(/^the /, '').toUpperCase(), size, { color: '#4a321e', spacing: size * 0.45 });
      t.alpha = 0.42;
      t.position.set(g.cx(at), g.cy(at) + HEX_R * 0.9);
      names.addChild(t);
    }
    root.addChild(wash, bands, ink, names);
    return root;
  }

  private rhumbLines(): Container {
    const { g } = this;
    const c = new Container();
    const lines = new Graphics();
    const centres = g.id === 'old' ? [g.hexAt(44, -14), g.hexAt(34, 4)] : [g.hexAt(38, -36), g.hexAt(14, -42), g.hexAt(50, -80)];
    centres.forEach((h, k) => {
      const x = g.cx(h), y = g.cy(h);
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        lines.moveTo(x, y).lineTo(x + Math.cos(ang) * 4000, y + Math.sin(ang) * 4000);
      }
      if (k === 0) {
        const rose = new Sprite(this.assets.tex('ornaments/compass-large'));
        rose.anchor.set(0.5);
        rose.width = 150;
        rose.scale.y = rose.scale.x;
        rose.position.set(x, y);
        c.addChild(rose);
      }
    });
    lines.stroke({ width: 0.8, color: 0x8a3b26, alpha: 0.16 });
    const clip = new Graphics().rect(0, 0, g.pxW, g.pxH).fill(0xffffff);
    lines.mask = clip;
    c.addChildAt(lines, 0);
    c.addChild(clip);
    return c;
  }

  /** The board edge that leads across the ocean. */
  private portalBand(): Container {
    const { g, m } = this;
    const c = new Container();
    const west = g.id === 'old';
    const x0 = west ? 0 : g.pxW - HEX_W * 1.4;
    const band = new Graphics();
    for (let k = 0; k < 14; k++) {
      const a = 0.16 * (1 - k / 14);
      const x = west ? x0 + (k * HEX_W * 1.4) / 14 : x0 + HEX_W * 1.4 - ((k + 1) * HEX_W * 1.4) / 14;
      band.rect(x, 0, (HEX_W * 1.4) / 14, g.pxH).fill({ color: 0x34556a, alpha: a });
    }
    const edgeX = west ? HEX_W * 1.4 : g.pxW - HEX_W * 1.4;
    const dash = new Graphics();
    dashed(dash, [edgeX, 0, edgeX, g.pxH], 10, 8);
    dash.stroke({ width: 1.4, color: 0x34556a, alpha: 0.6 });
    c.addChild(band, dash);
    const lats = m.portals.map((h) => g.cy(h));
    const mid = lats[Math.floor(lats.length / 2)] ?? g.pxH / 2;
    for (const y of [mid - g.pxH * 0.28, mid, mid + g.pxH * 0.28]) {
      if (y < 60 || y > g.pxH - 60) continue;
      const t = label(west ? '⟵  To the Mar Océano and the unknown west' : 'To Europe  ⟶', 15, { italic: true, color: '#2b4756', spacing: 1 });
      t.rotation = -Math.PI / 2;
      t.position.set(west ? HEX_W * 0.55 : g.pxW - HEX_W * 0.55, y);
      c.addChild(t);
    }
    return c;
  }

  private drawGrid() {
    const g = this.grid;
    g.clear();
    for (let i = 0; i < this.g.N; i++) {
      const p = this.g.corners(i);
      g.moveTo(p[0], p[1]).lineTo(p[2], p[3]).lineTo(p[4], p[5]).lineTo(p[6], p[7]);
    }
    g.stroke({ width: 0.7, color: INK_HEX, alpha: 1 });
    g.alpha = 0.1;
  }

  private buildMonsters() {
    for (const mo of this.m.monsters) {
      const s = new Sprite(this.assets.tex(`ornaments/${mo.kind}`));
      s.anchor.set(0.5);
      s.width = mo.kind === 'serpent' ? 190 : 150;
      s.scale.y = s.scale.x;
      s.position.set(this.g.cx(mo.hex), this.g.cy(mo.hex));
      this.monsters.addChild(s);
      this.monsterSprites.push({ hex: mo.hex, node: s });
    }
  }

  private buildLabels() {
    const { g, m } = this;
    if (g.id === 'old') {
      for (const [name, lat, lon, size] of SEA_LABELS) {
        const t = label(name, size, { italic: true, color: '#4a321e', spacing: size > 20 ? 6 : 2 });
        const h = g.hexAt(lat, lon);
        t.position.set(g.cx(h), g.cy(h));
        t.alpha = 0.75;
        this.labels.addChild(t);
      }
    }
    for (const c of m.decorCities) {
      const node = new Container();
      const dot = new Graphics().circle(0, 0, 3.2).fill({ color: 0xf3e6c8 }).stroke({ width: 1.4, color: INK_HEX });
      dot.circle(0, 0, 1).fill(INK_HEX);
      const t = label(c.name, 13, { italic: true });
      t.position.set(0, -11);
      node.addChild(dot, t);
      node.position.set(g.cx(c.hex), g.cy(c.hex));
      this.labels.addChild(node);
      this.decorLabels.push({ hex: c.hex, node });
    }
    for (const isl of m.islandNames) {
      const node = new Container();
      node.addChild(label(isl.name, 13, { italic: true }));
      node.position.set(g.cx(isl.hex), g.cy(isl.hex) - 4);
      node.visible = false;
      this.labels.addChild(node);
      this.islandLabels.push({ hex: isl.hex, node });
    }
  }

  private plate(name: string, color: number, sub?: string): Container {
    const c = new Container();
    const t = label(name, 14, { color: '#2a1a0c', spacing: 0.5 });
    const w = Math.ceil(t.width + 22), h = 20;
    const bg = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, 3).fill({ color: 0xf8efd8, alpha: 0.95 }).stroke({ width: 1, color: INK_HEX, alpha: 0.8 })
      .rect(-w / 2 + 1, -h / 2 + 1, 6, h - 2).fill(color);
    t.position.set(4, 0);
    c.addChild(bg, t);
    if (sub) {
      const s = label(sub, 11, { italic: true, color: '#5a3a1e' });
      s.position.set(0, h / 2 + 7);
      c.addChild(s);
    }
    return c;
  }

  /** A city of the Old World, drawn plainly: a small town and its name, sized by the city's size. */
  private buildCity(p: PortDef) {
    const { g } = this;
    const size = p.size ?? 2;
    const node = new Container();
    const key = p.inland ? (size === 1 ? 'colonies/fort-outpost' : 'colonies/fort-town') : size === 1 ? 'colonies/port-outpost' : 'colonies/port-town';
    const icon = new Sprite(this.assets.tex(key));
    icon.anchor.set(0.5, 0.72);
    icon.width = HEX_W * (size === 3 ? 1.35 : size === 2 ? 1.1 : 0.85);
    icon.scale.y = icon.scale.x;
    node.addChild(icon);
    node.position.set(g.cx(p.hex), g.cy(p.hex));
    const name = new Container();
    const t = label(p.name, size === 3 ? 17 : size === 2 ? 14 : 12.5, { italic: size === 1, halo: true, color: '#2a1a0c' });
    name.addChild(t);
    // a smaller city right beside a larger one puts its name above its icon instead of below
    const m = this.m;
    const crowded = m.ports.some((q) => q !== p && q.realm && g.distance(q.hex, p.hex) <= 2 && m.ports.indexOf(q) < m.ports.indexOf(p)
      && Math.abs(g.cy(q.hex) - g.cy(p.hex)) < HEX_R * 2.2);
    name.position.set(g.cx(p.hex), g.cy(p.hex) + (crowded ? -HEX_R * 1.25 : HEX_R * 0.78));
    this.plates.push(name);
    this.plateLayer.addChild(name);
    this.portPlates.set(p.id, name);
    this.ports.addChild(node);
    this.portSprites.set(p.id, node);
  }

  private buildPorts() {
    const { g, m } = this;
    for (const p of m.ports) {
      if (p.realm) { this.buildCity(p); continue; }
      const node = new Container();
      const big = p.kind !== 'native';
      const icon = new Sprite(this.assets.tex(p.kind === 'native' ? 'colonies/trading-post-outpost' : p.kind === 'home' ? 'colonies/port-city' : 'colonies/port-town'));
      icon.anchor.set(0.5, 0.72);
      icon.width = big ? HEX_W * 1.5 : HEX_W * 1.15;
      icon.scale.y = icon.scale.x;
      // home ports carry the crown's colours; foreign ports a muted plate; native sites earth tones
      const color = p.kind === 'home' ? this.me.primary : p.kind === 'native' ? NATIVE.plate : 0x8d8472;
      const plate = this.plate(p.name, color, p.kind === 'native' ? p.people : p.kind === 'foreign' ? p.nation : undefined);
      // when two ports sit side by side, put the second name above its icon
      const crowded = m.ports.some((q) => q !== p && g.distance(q.hex, p.hex) <= 2 && m.ports.indexOf(q) < m.ports.indexOf(p));
      plate.position.set(g.cx(p.hex), g.cy(p.hex) + (crowded ? -HEX_R * 1.55 : HEX_R * 0.75));
      this.plates.push(plate);
      this.plateLayer.addChild(plate);
      this.portPlates.set(p.id, plate);
      node.addChild(icon);
      node.position.set(g.cx(p.hex), g.cy(p.hex));
      node.visible = p.kind !== 'native';
      plate.visible = node.visible;
      this.ports.addChild(node);
      this.portSprites.set(p.id, node);
    }
  }

  private drawWind(season: number, fog: number[]) {
    const { g: grid, m } = this;
    const g = this.windG;
    g.clear();
    const wind = m.wind[season];
    for (let i = 0; i < grid.N; i++) {
      if (!isWater(m.terrain[i]) || grid.col(i) % 3 !== 0 || grid.row(i) % 2 !== 0) continue;
      if (fog[i] < Fog.Charted) continue;
      const a = wind.angle[i], s = wind.strength[i];
      const len = 8 + s * 16;
      const x = grid.cx(i), y = grid.cy(i);
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
      g.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5).lineTo(x1, y1);
      g.moveTo(x1, y1).lineTo(x1 - Math.cos(a - 0.5) * 6, y1 - Math.sin(a - 0.5) * 6);
      g.moveTo(x1, y1).lineTo(x1 - Math.cos(a + 0.5) * 6, y1 - Math.sin(a + 0.5) * 6);
    }
    g.stroke({ width: 1.3, color: 0x34556a, alpha: 0.55 });
  }

  update(state: GameState, ui: ViewUi, animate: boolean) {
    const { g } = this;
    const fog = state.fog[g.id];
    let sum = 0;
    for (let i = 0; i < fog.length; i++) sum += fog[i];
    const fogKey = `${sum}`;
    if (fogKey !== this.lastFogKey) {
      this.lastFogKey = fogKey;
      drawFogMask(g, this.fogKnown, fog, Fog.Charted);
      drawFogMask(g, this.fogSeen, fog, Fog.Explored);
      drawVeil(this.veilInk, this.paper, this.fogKnown);
      drawVeil(this.veilWash, this.paper, this.fogSeen);
      this.veilInkTex.source.update();
      this.veilWashTex.source.update();
      for (const mo of this.monsterSprites) mo.node.visible = fog[mo.hex] === Fog.Unknown;
      for (const d of this.decorLabels) d.node.visible = fog[d.hex] >= Fog.Charted;
      for (const d of this.islandLabels) d.node.visible = fog[d.hex] >= Fog.Explored;
      for (const p of this.m.ports) {
        if (p.kind !== 'native') continue;
        const seen = state.discovered.includes(p.id);
        this.portSprites.get(p.id)!.visible = seen;
        this.portPlates.get(p.id)!.visible = seen;
      }
      this.lastSeason = -1;
    }
    const season = seasonOf(state.turn);
    if (season !== this.lastSeason) { this.lastSeason = season; this.drawWind(season, fog); }
    this.windG.visible = ui.showWind;
    this.grid.alpha = ui.showGrid || ui.preview ? 0.22 : 0.1;
    const surveyed = state.surveyed[g.id];
    let sk = 0;
    for (let i = 0; i < surveyed.length; i++) sk += surveyed[i];
    const findsKey = `${sk}|${state.rumoursDone[g.id].length}|${fogKey}|${state.land?.name ?? ''}`;
    if (findsKey !== this.lastFinds) { this.lastFinds = findsKey; this.drawFinds(state); }
    this.syncColonies(state);
    this.syncNations(state, fogKey);
    this.syncRivals(state, fogKey);
    this.syncFleets(state, ui, animate);
    this.syncParties(state, ui);
    this.landingG.clear();
    if (ui.landing && ui.map === g.id) {
      for (const h of ui.landing) this.landingG.poly(g.corners(h, 0.9)).fill({ color: this.me.primary, alpha: 0.28 }).stroke({ width: 2, color: this.me.secondary, alpha: 0.9 });
    }
    this.drawRoutes(state, ui);
    this.drawHighlight(ui);
  }

  /** Resources found on foot, and rumours seen but not yet followed. */
  private drawFinds(state: GameState) {
    const { g, m } = this;
    this.resLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.rumourLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const surveyed = state.surveyed[g.id];
    for (let i = 0; i < g.N; i++) {
      const r = m.resource[i];
      if (!r || !surveyed[i]) continue;
      const node = new Container();
      node.addChild(new Graphics().circle(0, 0, 13).fill({ color: 0xfbf3df, alpha: 0.92 }).stroke({ width: 1.2, color: INK_HEX, alpha: 0.8 }));
      const icon = new Sprite(this.assets.tex(RESOURCES[RESOURCE_IDS[r - 1]].icon));
      icon.anchor.set(0.5);
      icon.width = 20;
      icon.scale.y = icon.scale.x;
      node.addChild(icon);
      node.position.set(g.cx(i) + HEX_R * 0.35, g.cy(i) - HEX_R * 0.3);
      this.resLayer.addChild(node);
    }
    // the name you gave the land, written where it was first sighted
    if (state.land && state.land.map === g.id) {
      const t = label(state.land.name, 30, { italic: true, spacing: 6, halo: true });
      t.position.set(g.cx(state.land.hex) + HEX_W * 2.5, g.cy(state.land.hex) - HEX_R * 1.6);
      this.rumourLayer.addChild(t);
    }
    const fog = state.fog[g.id];
    for (const r of m.rumours) {
      if (fog[r.hex] < Fog.Explored || state.rumoursDone[g.id].includes(r.hex)) continue;
      const node = new Container();
      node.addChild(new Graphics().circle(0, 0, 12).fill({ color: 0xf3e2b0 }).stroke({ width: 1.8, color: 0x8b2a1a }));
      const t = label('?', 18, { color: '#8b2a1a' });
      t.style.fontWeight = 'bold';
      node.addChild(t);
      node.position.set(g.cx(r.hex), g.cy(r.hex));
      this.rumourLayer.addChild(node);
    }
  }

  private syncParties(state: GameState, ui: ViewUi) {
    const { g } = this;
    const here = state.parties.filter((p) => p.map === g.id);
    const alive = new Set(here.map((p) => p.id));
    for (const [id, ps] of this.partySprites) if (!alive.has(id)) { ps.root.destroy({ children: true }); this.partySprites.delete(id); }
    for (const p of here) {
      let ps = this.partySprites.get(p.id);
      if (!ps) {
        const root = new Container();
        const ring = new Graphics();
        const fig = new Sprite();
        fig.anchor.set(0.5, 0.9);
        root.addChild(ring, fig);
        this.parties.addChild(root);
        ps = { root, ring, fig, target: '' };
        this.partySprites.set(p.id, ps);
      }
      const units = state.units.filter((u) => u.party === p.id);
      const lead = units.find((u) => isMilitary(u.type)) ?? units[0];
      ps.fig.texture = this.assets.tex(lead ? UNIT_INFO[lead.type].sprite : 'units/scout');
      ps.fig.height = HEX_R * 1.6;
      ps.fig.scale.x = ps.fig.scale.y;
      const sel = ui.selectedParty === p.id;
      ps.ring.clear();
      if (sel) ps.ring.ellipse(0, 0, HEX_W * 0.5, HEX_W * 0.2).fill({ color: 0xfff6d8, alpha: 0.9 });
      ps.ring.ellipse(0, 0, HEX_W * 0.36, HEX_W * 0.14).fill({ color: this.me.primary, alpha: p.moves > 0 ? 0.6 : 0.25 })
        .stroke({ width: sel ? 2.4 : 1.4, color: this.me.secondary });
      ps.root.position.set(g.cx(p.hex), g.cy(p.hex) + HEX_R * 0.3);
    }
  }

  /** Villages of the peoples you know, and how each people stands with you. */
  private syncNations(state: GameState, fogKey: string) {
    const { g, m } = this;
    const moods = m.nations.map((n) => { const st = state.natives[n.id]; return st ? `${st.met ? 1 : 0}${st.relation}${Math.round(st.attitude / 20)}${st.lost.length}${st.post ? 'p' : ''}${st.mission ? 'm' : ''}` : ''; }).join('|');
    const key = `${moods}|${fogKey}`;
    if (key === this.lastNations) return;
    this.lastNations = key;
    this.nationLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const fog = state.fog[g.id];
    for (const n of m.nations) {
      const st = state.natives[n.id];
      if (!st) continue;
      const color = st.relation === 'subject' ? this.me.primary : st.relation === 'allied' ? 0x3d6b38 : st.relation === 'war' || st.attitude <= -40 ? 0xa3231a : st.attitude < 0 ? 0xb07a2a : NATIVE.plate;
      for (const h of n.villages) {
        if (fog[h] < Fog.Explored) continue;
        const lost = st.lost.includes(h);
        const v = new Graphics();
        // three small huts, inked like the rest of the chart
        for (const [dx, dy, s] of [[-7, 2, 1], [6, 3, 0.9], [0, -5, 1.1]] as const) {
          v.moveTo(dx - 6 * s, dy + 4 * s).lineTo(dx, dy - 6 * s).lineTo(dx + 6 * s, dy + 4 * s).closePath();
        }
        v.fill({ color: 0xe8d5a6, alpha: lost ? 0.4 : 0.95 }).stroke({ width: 1.3, color: INK_HEX, alpha: lost ? 0.35 : 0.9 });
        if (st.met && !lost) v.circle(0, 10, 3).fill(color);
        v.position.set(g.cx(h), g.cy(h));
        this.nationLayer.addChild(v);
      }
      if (st.met && fog[n.siteHex] >= Fog.Explored) {
        const ring = new Graphics().circle(0, 0, HEX_R * 0.95).stroke({ width: 2.5, color, alpha: 0.75 });
        if (st.post) ring.rect(-HEX_R * 0.9, -HEX_R * 0.9, 9, 9).fill(this.me.secondary);
        if (st.mission) ring.moveTo(HEX_R * 0.75, -HEX_R * 1.0).lineTo(HEX_R * 0.75, -HEX_R * 0.55).moveTo(HEX_R * 0.6, -HEX_R * 0.85).lineTo(HEX_R * 0.9, -HEX_R * 0.85).stroke({ width: 2, color: INK_HEX });
        ring.position.set(g.cx(n.siteHex), g.cy(n.siteHex));
        this.nationLayer.addChild(ring);
      }
    }
  }

  /** Rival colonies (where charted) and rival ships (where you can see them), in their crowns' colours. */
  private syncRivals(state: GameState, fogKey: string) {
    const { g } = this;
    const fog = state.fog[g.id];
    const cols = state.rivalColonies.filter((c) => c.map === g.id && fog[c.hex] >= Fog.Charted);
    const ships = state.rivalShips.filter((x) => x.map === g.id && fog[x.hex] >= Fog.Explored);
    const free = state.freeStates.filter((c) => c.map === g.id);
    const key = `${cols.map((c) => `${c.id}${c.pop}${c.level}`).join(',')}|${ships.map((x) => `${x.id}@${x.hex}`).join(',')}|${free.map((f) => f.id + f.pop).join(',')}|${state.rebels.map((r) => `${r.id}@${r.hex}`).join(',')}|${fogKey}`;
    if (key === this.lastRivals) return;
    this.lastRivals = key;
    this.rivalLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.rivalShipLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const c of cols) {
      const crown = CROWN[c.crown];
      const t = new Graphics();
      for (const h of g.within(c.hex, c.level === 'outpost' ? 1 : 2)) t.poly(g.corners(h)).fill({ color: crown.primary, alpha: 0.1 });
      this.rivalLayer.addChild(t);
      const icon = new Sprite(this.assets.tex(`colonies/fort-${c.level}`));
      icon.anchor.set(0.5, 0.72);
      icon.width = HEX_W * (c.level === 'outpost' ? 1.1 : c.level === 'town' ? 1.5 : 1.9);
      icon.scale.y = icon.scale.x;
      icon.position.set(g.cx(c.hex), g.cy(c.hex));
      this.rivalLayer.addChild(icon);
      const plate = this.plate(`${c.name} · ${c.pop}`, crown.primary, crown.name);
      plate.position.set(g.cx(c.hex), g.cy(c.hex) + HEX_R * 0.75);
      this.plates.push(plate);
      this.rivalLayer.addChild(plate);
    }
    for (const f of free) {
      const icon = new Sprite(this.assets.tex(`colonies/port-${f.level}`));
      icon.anchor.set(0.5, 0.72);
      icon.width = HEX_W * (f.level === 'outpost' ? 1.1 : f.level === 'town' ? 1.5 : 1.9);
      icon.scale.y = icon.scale.x;
      icon.position.set(g.cx(f.hex), g.cy(f.hex));
      this.rivalLayer.addChild(icon);
      const plate = this.plate(`${f.name} · ${f.pop}`, 0x3b3b3b, 'free since ' + (1492 + Math.floor(f.since / 4)));
      plate.position.set(g.cx(f.hex), g.cy(f.hex) + HEX_R * 0.75);
      this.plates.push(plate);
      this.rivalLayer.addChild(plate);
    }
    for (const r of state.rebels.filter((x) => x.map === g.id && fog[x.hex] >= Fog.Charted)) {
      const node = new Container();
      node.addChild(new Graphics().ellipse(0, 0, HEX_W * 0.42, HEX_W * 0.17).fill({ color: 0x3b3b3b, alpha: 0.7 }).stroke({ width: 2.4, color: 0x111111 }));
      const sp = new Sprite(this.assets.tex('units/pikeman'));
      sp.anchor.set(0.5, 0.82); sp.width = HEX_W * 0.85; sp.scale.y = sp.scale.x;
      node.addChild(sp);
      node.position.set(g.cx(r.hex), g.cy(r.hex));
      this.rivalShipLayer.addChild(node);
    }
    for (const x of ships) {
      const crown = CROWN[x.crown];
      const node = new Container();
      node.addChild(new Graphics().ellipse(0, 0, HEX_W * 0.42, HEX_W * 0.17).fill({ color: crown.primary, alpha: 0.6 }).stroke({ width: x.kind === 'privateer' || x.kind === 'raid' ? 2.4 : 1.4, color: x.kind === 'privateer' || x.kind === 'raid' ? 0x111111 : crown.secondary }));
      const sp = new Sprite(this.assets.tex(x.kind === 'army' ? 'units/pikeman' : `ships/${x.kind === 'privateer' ? 'sloop' : x.kind === 'trader' || x.kind === 'supply' ? 'fluyt' : 'carrack'}`));
      sp.anchor.set(0.5, 0.82);
      sp.width = HEX_W * 0.85;
      sp.scale.y = sp.scale.x;
      const prev = x.trail.length > 1 ? x.trail[x.trail.length - 2] : null;
      if (prev != null && g.cx(prev) > g.cx(x.hex)) sp.scale.x *= -1;
      node.addChild(sp);
      node.position.set(g.cx(x.hex), g.cy(x.hex));
      this.rivalShipLayer.addChild(node);
    }
  }

  private syncColonies(state: GameState) {
    const { g } = this;
    const mine = state.colonies.filter((c) => c.map === g.id);
    const key = mine.map((c) => `${c.id}:${c.level}:${c.pop}:${colonyKind(state, c)}`).join('|');
    if (key === this.lastColonies) return;
    this.lastColonies = key;
    this.colonyLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.territoryG.clear();
    for (const c of mine) {
      for (const h of g.within(c.hex, c.level === 'outpost' ? 1 : 2)) this.territoryG.poly(g.corners(h)).fill({ color: this.me.primary, alpha: 0.09 });
      const node = new Container();
      const icon = new Sprite(this.assets.tex(`colonies/${colonyKind(state, c)}-${c.level}`));
      icon.anchor.set(0.5, 0.72);
      icon.width = HEX_W * (c.level === 'outpost' ? 1.1 : c.level === 'town' ? 1.5 : 1.9);
      icon.scale.y = icon.scale.x;
      node.addChild(icon);
      node.position.set(g.cx(c.hex), g.cy(c.hex));
      this.colonyLayer.addChild(node);
      const plate = this.plate(`${c.name} · ${c.pop}`, this.me.primary);
      plate.position.set(g.cx(c.hex), g.cy(c.hex) + HEX_R * 0.75);
      this.plates.push(plate);
      this.colonyLayer.addChild(plate);
    }
    this.territoryG.stroke({ width: 1, color: this.me.secondary, alpha: 0.18 });
  }

  partyAt(mx: number, my: number): number | null {
    let best: number | null = null, bd = HEX_R * 0.9;
    for (const [id, ps] of this.partySprites) {
      const d = Math.hypot(ps.root.x - mx, ps.root.y - HEX_R * 0.6 - my);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  private fleetPos(f: Fleet): [number, number] {
    const { g, m } = this;
    let x = g.cx(f.hex), y = g.cy(f.hex);
    if (f.at) {
      // moored beside the port, on the seaward side
      const sea = g.neighbors(f.hex).filter((j) => isWater(m.terrain[j]));
      if (sea.length) {
        const sx = sea.reduce((t, j) => t + g.cx(j), 0) / sea.length;
        const sy = sea.reduce((t, j) => t + g.cy(j), 0) / sea.length;
        x += (sx - x) * 0.95;
        y += (sy - y) * 0.95 + HEX_R * 0.2;
      }
    }
    return [x, y];
  }

  private syncFleets(state: GameState, ui: ViewUi, animate: boolean) {
    const { g } = this;
    const here = state.fleets.filter((f) => f.map === g.id);
    const alive = new Set(here.map((f) => f.id));
    for (const [id, fs] of this.fleetSprites) if (!alive.has(id)) { fs.root.destroy({ children: true }); this.fleetSprites.delete(id); }
    const stacks = new Map<number, number>();
    for (const f of here) {
      let fs = this.fleetSprites.get(f.id);
      const fresh = !fs;
      if (!fs) {
        const root = new Container();
        const ring = new Graphics();
        const ship = new Sprite();
        ship.anchor.set(0.5, 0.82);
        const badge = new Container();
        root.addChild(ring, ship, badge);
        this.fleets.addChild(root);
        fs = { root, ring, ship, badge, anim: null, facing: -1, target: '' };
        this.fleetSprites.set(f.id, fs);
      }
      const lead = [...f.ships].sort((a, b) => SHIPS[b.type].cargo - SHIPS[a.type].cargo)[0];
      fs.ship.texture = this.assets.tex(`ships/${lead.type}`);
      fs.ship.width = { caravel: 1.0, carrack: 1.12, galleon: 1.25 }[lead.type] * HEX_W * 0.95;
      fs.ship.scale.y = Math.abs(fs.ship.scale.x);
      const next = f.order && f.order.path.length > 1 ? f.order.path[1] : null;
      const prev = f.trail.length > 1 ? f.trail[f.trail.length - 2] : null;
      if (next != null) fs.facing = g.cx(next) >= g.cx(f.hex) ? 1 : -1;
      else if (prev != null) fs.facing = g.cx(f.hex) >= g.cx(prev) ? 1 : -1;
      fs.ship.scale.x = Math.abs(fs.ship.scale.x) * fs.facing;

      const selected = ui.selectedFleet === f.id;
      const c = this.me;
      fs.ring.clear();
      if (selected) fs.ring.ellipse(0, 0, HEX_W * 0.66, HEX_W * 0.27).fill({ color: 0xfff6d8, alpha: 0.85 });
      fs.ring.ellipse(0, 0, HEX_W * 0.5, HEX_W * 0.2).fill({ color: c.primary, alpha: f.moves > 0 ? 0.6 : 0.25 })
        .stroke({ width: selected ? 2.6 : 1.6, color: c.secondary, alpha: 0.95 });

      fs.badge.removeChildren();
      if (f.ships.length > 1) {
        const b = new Graphics().circle(0, 0, 8).fill(c.secondary).stroke({ width: 1.2, color: 0xf8efd8 });
        const t = label(String(f.ships.length), 11, { color: '#fff8e8' });
        t.style.fontFamily = 'system-ui, sans-serif';
        t.style.fontWeight = 'bold';
        fs.badge.addChild(b, t);
        fs.badge.position.set(HEX_W * 0.42, -HEX_W * 0.62);
      }

      const [tx, ty] = this.fleetPos(f);
      const k = stacks.get(f.hex) ?? 0;
      stacks.set(f.hex, k + 1);
      const ox = k * 10, oy = k * 6;
      const target = `${f.hex}:${f.at}:${k}`;
      const moved = target !== fs.target;
      fs.target = target;
      if (fresh) {
        fs.root.position.set(tx + ox, ty + oy);
      } else if (animate && moved && f.trail.length > 1) {
        const pts: number[] = [];
        const start = fs.root.position;
        pts.push(start.x, start.y);
        f.trail.slice(1).forEach((h, n, arr) => {
          if (n === arr.length - 1) pts.push(tx + ox, ty + oy);
          else pts.push(g.cx(h), g.cy(h));
        });
        if (Math.hypot(pts[0] - (tx + ox), pts[1] - (ty + oy)) > 1) {
          fs.anim = { pts: chaikin(pts), t0: performance.now(), dur: Math.min(1800, 250 + f.trail.length * 70) };
        }
        else fs.root.position.set(tx + ox, ty + oy);
      } else if (moved) {
        fs.anim = null;
        fs.root.position.set(tx + ox, ty + oy);
      }
    }
  }

  private drawRoutes(state: GameState, ui: ViewUi) {
    const { g } = this;
    const r = this.routes;
    r.clear();
    this.turnMarks.removeChildren();
    for (const f of state.fleets) {
      if (f.map !== g.id || !f.order || f.order.path.length < 2) continue;
      const pts = chaikin(f.order.path.flatMap((h) => [g.cx(h), g.cy(h)]));
      dashed(r, pts, 5, 6);
      r.stroke({ width: ui.selectedFleet === f.id ? 2.2 : 1.4, color: 0x7a2416, alpha: ui.selectedFleet === f.id ? 0.8 : 0.45 });
    }
    for (const pt of state.parties) {
      if (pt.map !== g.id || !pt.order || pt.order.length < 2) continue;
      dashed(r, chaikin(pt.order.flatMap((h) => [g.cx(h), g.cy(h)])), 4, 5);
      r.stroke({ width: ui.selectedParty === pt.id ? 2.2 : 1.4, color: 0x5a3d22, alpha: 0.7 });
    }
    const p = ui.preview;
    this.previewLabel.visible = !!p && ui.map === g.id;
    if (p && ui.map === g.id && p.path.length > 0) {
      const pts = chaikin(p.path.flatMap((h) => [g.cx(h), g.cy(h)]));
      if (p.path.length > 1) {
        dashed(r, pts, 8, 6);
        r.stroke({ width: 2.6, color: ROUTE, alpha: 0.95 });
      }
      const end = p.path[p.path.length - 1];
      const x = g.cx(end), y = g.cy(end);
      r.moveTo(x - 7, y - 7).lineTo(x + 7, y + 7).moveTo(x + 7, y - 7).lineTo(x - 7, y + 7);
      r.stroke({ width: 3, color: ROUTE });
      // where each season's sailing runs out, like the turn markers on a pilot's chart
      p.turnEnds.forEach((k, n) => {
        const h = p.path[k];
        const mark = new Container();
        mark.addChild(new Graphics().circle(0, 0, 9).fill({ color: 0xf8efd8 }).stroke({ width: 1.6, color: ROUTE }));
        const t = label(String(n + 1), 12, { color: '#7a2416' });
        t.style.fontFamily = 'system-ui, sans-serif';
        t.style.fontWeight = 'bold';
        mark.addChild(t);
        mark.position.set(g.cx(h), g.cy(h));
        this.turnMarks.addChild(mark);
      });
      const when = p.turns > 1 ? `arrives in ${p.turns} seasons` : 'arrives this season';
      this.previewLabel.text = ui.selectedParty != null ? `on foot · ${when}` : `${when}${p.cross ? ', then crosses the ocean' : ''} · storm risk ${Math.round(p.risk * 100)}%`;
      // keep the label inside the board
      const half = this.previewLabel.width / 2 + 10;
      this.previewLabel.position.set(Math.min(g.pxW - half, Math.max(half, x)), y - 24);
    }
  }

  private drawHighlight(ui: ViewUi) {
    const h = this.highlight;
    h.clear();
    if (!ui.highlightAll) return;
    for (const p of this.m.ports) {
      if (!this.portSprites.get(p.id)!.visible) continue;
      h.circle(this.g.cx(p.hex), this.g.cy(p.hex), HEX_R * 1.3);
    }
    for (const fs of this.fleetSprites.values()) h.circle(fs.root.x, fs.root.y - 10, HEX_R * 1.1);
    h.stroke({ width: 3, color: 0xffffff, alpha: 0.9 }).stroke({ width: 1.5, color: this.me.secondary });
  }

  /** true while any fleet is still sailing along its last move */
  get animating() {
    for (const fs of this.fleetSprites.values()) if (fs.anim) return true;
    return false;
  }

  tick(scale: number) {
    const now = performance.now();
    for (const fs of this.fleetSprites.values()) {
      if (!fs.anim) continue;
      const { pts, t0, dur } = fs.anim;
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      let total = 0;
      const seg: number[] = [];
      for (let k = 0; k < pts.length - 2; k += 2) { const l = Math.hypot(pts[k + 2] - pts[k], pts[k + 3] - pts[k + 1]); seg.push(l); total += l; }
      let want = e * total, k = 0;
      while (k < seg.length - 1 && want > seg[k]) { want -= seg[k]; k++; }
      const u = seg[k] ? Math.min(1, want / seg[k]) : 1;
      const x = pts[2 * k] + (pts[2 * k + 2] - pts[2 * k]) * u;
      const y = pts[2 * k + 1] + (pts[2 * k + 3] - pts[2 * k + 1]) * u;
      const dx = pts[2 * k + 2] - pts[2 * k];
      if (Math.abs(dx) > 0.5) fs.ship.scale.x = Math.abs(fs.ship.scale.x) * (dx > 0 ? 1 : -1);
      fs.root.position.set(x, y);
      if (t >= 1) fs.anim = null;
    }
    const s = Math.min(1.9, Math.max(0.85, 1 / scale));
    this.plates = this.plates.filter((p) => !p.destroyed);
    for (const p of this.plates) p.scale.set(s);
    for (const d of this.decorLabels) d.node.scale.set(s);
    for (const d of this.islandLabels) d.node.scale.set(s);
    this.previewLabel.scale.set(s);
    this.turnMarks.children.forEach((c) => c.scale.set(s));
  }

  fleetAt(mx: number, my: number): number | null {
    let best: number | null = null, bd = HEX_R * 1.05;
    for (const [id, fs] of this.fleetSprites) {
      const d = Math.hypot(fs.root.x - mx, fs.root.y - HEX_R * 0.45 - my);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }
}

export class MapView {
  app = new Application();
  private scenes = {} as Record<MapId, Scene>;
  private active: MapId = 'old';
  private state: GameState | null = null;
  private ui: ViewUi | null = null;
  private lastTurn = -1;
  private hoverHex = -1;
  private destroyed = false;
  private cleanup: (() => void)[] = [];
  /**
   * The map renders on demand: the ticker runs while something moves (a fleet animation, a held
   * scroll key, the pointer resting at an edge) or briefly after any change, then stops, so an
   * idle turn costs no GPU time.
   */
  private awakeUntil = 0;

  /** Keep rendering for at least `ms` more. */
  wake(ms = 200) {
    this.awakeUntil = Math.max(this.awakeUntil, performance.now() + ms);
    if (!this.destroyed && this.app.ticker && !this.app.ticker.started) this.app.ticker.start();
  }

  constructor(private el: HTMLElement, private world: World, private assets: Assets, private cb: MapCallbacks) {}

  async init(onProgress?: (msg: string) => void) {
    await this.app.init({
      resizeTo: this.el, background: '#efe2c4', antialias: true, autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl',
    });
    if (this.destroyed) return;
    this.el.appendChild(this.app.canvas);
    this.progress = onProgress ?? null;
    // Only the Old World is drawn at the start: the New World's art (about half the texture
    // memory) waits until someone first looks west.
    await this.buildScene('old');
    if (this.destroyed) return;
    this.bindInput();
    this.app.ticker.add((t) => {
      this.scrollTick(t.deltaMS / 1000);
      this.scene.tick(this.scene.cam.scale);
      const moving = this.scene.animating || this.held.size > 0 || this.edge.x !== 0 || this.edge.y !== 0;
      // stopping here still lets this frame render: the renderer runs after this listener
      if (!moving && performance.now() > this.awakeUntil) t.stop();
    });
    this.show('old');
    this.wake();
  }

  destroy() {
    this.destroyed = true;
    this.cleanup.forEach((f) => f());
    try { this.app.destroy(true, { children: true, texture: true }); } catch { /* not initialised */ }
  }

  private get scene() { return this.scenes[this.active]; }

  private progress: ((msg: string) => void) | null = null;
  private building: Partial<Record<MapId, Promise<void>>> = {};

  /** Draw a board's art once; later calls wait for the same build. */
  private buildScene(id: MapId): Promise<void> {
    return (this.building[id] ??= (async () => {
      const sc = new Scene(GRIDS[id], this.world[id], this.world.seed, this.assets, this.world.crown);
      await sc.build((m) => this.progress?.(`${id === 'old' ? 'Old World' : 'Mar Océano'}: ${m}`));
      if (this.destroyed) { sc.root.destroy({ children: true, texture: true }); return; }
      sc.root.visible = false;
      this.app.stage.addChild(sc.root);
      this.scenes[id] = sc;
      if (this.state && this.ui) sc.update(this.state, this.ui, false);
      this.progress?.('');
    })());
  }

  show(map: MapId) {
    if (!this.scenes[map]) {
      void this.buildScene(map).then(() => { if (!this.destroyed && this.ui?.map === map) this.show(map); });
      return;
    }
    this.active = map;
    for (const [id, sc] of Object.entries(this.scenes)) sc.root.visible = id === map;
    if (!this.scene.cam.set) this.home();
    else this.apply();
  }

  update(state: GameState, ui: ViewUi) {
    const animate = state.turn !== this.lastTurn && this.lastTurn >= 0;
    this.state = state;
    this.ui = ui;
    if (ui.map !== this.active) this.show(ui.map);
    for (const sc of Object.values(this.scenes)) sc.update(state, ui, true);
    void animate;
    this.lastTurn = state.turn;
    this.wake();
  }

  /** Opening view of each board. */
  home() {
    const sc = this.scene;
    const g = sc.g;
    const vw = this.el.clientWidth, vh = this.el.clientHeight;
    const right = vw > 900 ? 360 : 20;
    const s = 0.62;
    sc.cam.scale = s;
    sc.cam.set = true;
    let fx: number, fy: number, sx: number;
    const mine = this.state?.fleets.find((f) => f.map === g.id && f.id === this.ui?.selectedFleet) ?? this.state?.fleets.find((f) => f.map === g.id);
    if (g.id === 'old') {
      const home = this.world.old.ports.find((p) => p.id === crownSpec(this.world.crown).home)!;
      fx = g.cx(home.hex); fy = g.cy(home.hex); sx = (vw - right) * 0.62;
    } else if (mine) {
      fx = g.cx(mine.hex); fy = g.cy(mine.hex); sx = (vw - right) * 0.6;
    } else {
      fx = g.pxW - 300; fy = g.pxH * 0.45; sx = (vw - right) * 0.7;
    }
    sc.cam.x = sx - fx * s;
    sc.cam.y = vh * 0.52 - fy * s;
    this.apply();
  }

  private apply() {
    const sc = this.scene;
    const g = sc.g;
    const vw = this.el.clientWidth, vh = this.el.clientHeight;
    const s = sc.cam.scale;
    const minX = vw - (g.pxW + MARGIN) * s, maxX = MARGIN * s;
    const minY = vh - (g.pxH + MARGIN) * s, maxY = MARGIN * s;
    sc.cam.x = minX > maxX ? (vw - g.pxW * s) / 2 : Math.min(maxX, Math.max(minX, sc.cam.x));
    sc.cam.y = minY > maxY ? (vh - g.pxH * s) / 2 : Math.min(maxY, Math.max(minY, sc.cam.y));
    sc.root.position.set(sc.cam.x, sc.cam.y);
    sc.root.scale.set(s);
    this.wake();
    this.cb.onCamera?.(this.active, { x: -sc.cam.x / s, y: -sc.cam.y / s, w: vw / s, h: vh / s });
  }

  centerOn(x: number, y: number, scale = this.scene.cam.scale) {
    const sc = this.scene;
    sc.cam.scale = scale;
    sc.cam.x = this.el.clientWidth / 2 - x * scale;
    sc.cam.y = this.el.clientHeight / 2 - y * scale;
    this.apply();
  }

  focusHex(map: MapId, hex: number) {
    if (map !== this.active) return;
    const g = GRIDS[map];
    this.centerOn(g.cx(hex), g.cy(hex), Math.max(this.scene.cam.scale, 0.7));
  }

  zoomBy(f: number, sx = this.el.clientWidth / 2, sy = this.el.clientHeight / 2) {
    const sc = this.scene;
    const ns = Math.min(2.2, Math.max(0.2, sc.cam.scale * f));
    const mx = (sx - sc.cam.x) / sc.cam.scale, my = (sy - sc.cam.y) / sc.cam.scale;
    sc.cam.scale = ns;
    sc.cam.x = sx - mx * ns;
    sc.cam.y = sy - my * ns;
    this.apply();
  }

  private toMap(sx: number, sy: number): [number, number] {
    const c = this.scene.cam;
    return [(sx - c.x) / c.scale, (sy - c.y) / c.scale];
  }

  // ---------- keyboard and edge scrolling ----------

  private held = new Set<string>();
  private edge = { x: 0, y: 0, since: 0 };
  /** the HUD covers the top of the canvas; the edge zone starts below it */
  topInset = 64;

  private scrollTick(dt: number) {
    let dx = 0, dy = 0;
    const h = this.held;
    if (h.has('a') || h.has('arrowleft')) dx += 1;
    if (h.has('d') || h.has('arrowright')) dx -= 1;
    if (h.has('w') || h.has('arrowup')) dy += 1;
    if (h.has('s') || h.has('arrowdown')) dy -= 1;
    let speed = 620;
    if (!dx && !dy && (this.edge.x || this.edge.y) && performance.now() - this.edge.since > 250) {
      dx = this.edge.x;
      dy = this.edge.y;
      speed = 260; // gentle, so resting the pointer near an edge does not fling the map
    }
    if (!dx && !dy) return;
    const n = Math.hypot(dx, dy);
    this.scene.cam.x += (dx / n) * speed * dt;
    this.scene.cam.y += (dy / n) * speed * dt;
    this.apply();
  }

  private bindInput() {
    const cv = this.app.canvas;
    const typing = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey;
    };
    const keyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (typing(e) || !['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
      e.preventDefault();
      this.held.add(k);
      this.wake();
    };
    const keyUp = (e: KeyboardEvent) => this.held.delete(e.key.toLowerCase());
    const clearKeys = () => this.held.clear();
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clearKeys);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clearKeys);
    });
    const setEdge = (sx: number, sy: number) => {
      const w = this.el.clientWidth, hgt = this.el.clientHeight, m = 14;
      const ex = sx < m ? 1 : sx > w - m ? -1 : 0;
      const ey = sy < this.topInset + m ? 1 : sy > hgt - m ? -1 : 0;
      if (ex !== this.edge.x || ey !== this.edge.y) this.edge = { x: ex, y: ey, since: performance.now() };
    };
    cv.style.touchAction = 'none';
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; camX: number; camY: number; moved: boolean; button: number } | null = null;
    let pinch: { d: number; scale: number } | null = null;
    const rect = () => cv.getBoundingClientRect();

    const onDown = (e: PointerEvent) => {
      this.wake();
      const r = rect();
      pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
      cv.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scene.cam.scale };
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, camX: this.scene.cam.x, camY: this.scene.cam.y, moved: false, button: e.button };
    };
    const onMove = (e: PointerEvent) => {
      this.wake();
      const r = rect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (e.pointerType === 'mouse' && !down) setEdge(sx, sy);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: sx, y: sy });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomBy((pinch.scale * (d / pinch.d)) / this.scene.cam.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5) down.moved = true;
        if (down.moved) {
          this.scene.cam.x = down.camX + dx;
          this.scene.cam.y = down.camY + dy;
          this.apply();
          cv.style.cursor = 'grabbing';
          return;
        }
      }
      const sc = this.scene;
      const [mx, my] = this.toMap(sx, sy);
      const h = sc.g.atPixel(mx, my);
      const overFleet = sc.fleetAt(mx, my) != null || sc.partyAt(mx, my) != null;
      const overPort = sc.m.ports.some((p) => p.hex === h && sc.portSprites.get(p.id)!.visible);
      cv.style.cursor = overFleet || overPort ? 'pointer' : 'default';
      if (h !== this.hoverHex) {
        this.hoverHex = h;
        sc.hover.clear();
        if (h >= 0) sc.hover.poly(sc.g.corners(h)).stroke({ width: 1.6, color: INK_HEX, alpha: 0.6 });
        this.cb.onHover(this.active, h);
      }
    };
    const onUp = (e: PointerEvent) => {
      this.wake();
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      cv.style.cursor = 'default';
      if (!down) return;
      const d = down;
      down = null;
      if (d.moved) return;
      const r = rect();
      const [mx, my] = this.toMap(e.clientX - r.left, e.clientY - r.top);
      const h = this.scene.g.atPixel(mx, my);
      if (h < 0) return;
      if (d.button === 2) this.cb.onRightClick(this.active, h);
      else {
        const party = this.scene.partyAt(mx, my);
        this.cb.onClick(this.active, h, party == null ? this.scene.fleetAt(mx, my) : null, party);
      }
    };
    const onWheel = (e: WheelEvent) => {
      this.wake();
      e.preventDefault();
      const r = rect();
      this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    const onCtx = (e: Event) => e.preventDefault();
    const onLeave = () => {
      this.wake();
      this.scene.hover.clear();
      this.hoverHex = -1;
      this.edge = { x: 0, y: 0, since: 0 };
      this.cb.onHover(this.active, -1);
    };
    const onResize = () => this.apply();
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', onCtx);
    window.addEventListener('resize', onResize);
    this.cleanup.push(() => {
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('resize', onResize);
    });
  }
}
