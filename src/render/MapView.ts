import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite, CanvasSource } from 'pixi.js';
import { SHIPS } from '../data/ships';
import { SEA_LABELS } from '../data/europe';
import { isWater } from '../data/terrain';
import { HEX_R, HEX_W, GRIDS, type Grid, type MapId } from '../sim/hex';
import { Fog, seasonOf, type GameState, type World, type Fleet, type MapData } from '../sim/types';
import type { Assets } from './assets';
import {
  buildField, drawWash, drawInk, drawFogMask, drawPaper, drawVeil, INK_RES, WASH_SCALE, VEIL_SCALE, PAPER_ALPHA, PAPER_TILE,
} from './mapArt';
import { CROWN, NATIVE } from './palette';

export interface RoutePreview { path: number[]; turns: number; risk: number; turnEnds: number[]; cross: boolean }

export interface ViewUi {
  map: MapId;
  selectedFleet: number | null;
  preview: RoutePreview | null;
  showWind: boolean;
  showGrid: boolean;
  highlightAll: boolean;
}

export interface MapCallbacks {
  onClick: (map: MapId, hex: number, fleetId: number | null) => void;
  onRightClick: (map: MapId, hex: number) => void;
  onHover: (map: MapId, hex: number) => void;
}

const MARGIN = 220;
const INK_HEX = 0x4a321e;
const ROUTE = 0x8b2a1a;

function canvasTexture(cv: HTMLCanvasElement, mip = false): Texture {
  return new Texture({ source: new CanvasSource({ resource: cv, autoGenerateMipmaps: mip, scaleMode: 'linear' }) });
}

function label(text: string, size: number, opts: { italic?: boolean; color?: string; spacing?: number } = {}) {
  const t = new Text({
    text,
    style: {
      fontFamily: '"IM Fell English", Georgia, serif', fontSize: size, fontStyle: opts.italic ? 'italic' : 'normal',
      fill: opts.color ?? '#3b2614', letterSpacing: opts.spacing ?? 0,
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
  plates: Container[] = [];
  fleetSprites = new Map<number, FleetSprite>();
  portSprites = new Map<string, Container>();
  decorLabels: { hex: number; node: Container }[] = [];
  islandLabels: { hex: number; node: Container }[] = [];
  monsterSprites: { hex: number; node: Sprite }[] = [];
  lastFogKey = '';
  lastSeason = -1;

  constructor(readonly g: Grid, readonly m: MapData, private seed: number, private assets: Assets) {}

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
    this.root.addChild(this.monsters, this.windG, this.labels, this.routes, this.turnMarks, this.highlight, this.ports, this.fleets, this.hover, this.previewLabel);
    this.buildLabels();
    this.buildPorts();
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

  private buildPorts() {
    const { g, m } = this;
    for (const p of m.ports) {
      const node = new Container();
      const big = p.kind !== 'native';
      const icon = new Sprite(this.assets.tex(p.kind === 'native' ? 'colonies/trading-post-outpost' : p.kind === 'home' ? 'colonies/port-city' : 'colonies/port-town'));
      icon.anchor.set(0.5, 0.72);
      icon.width = p.id === 'seville' ? HEX_W * 1.9 : big ? HEX_W * 1.5 : HEX_W * 1.15;
      icon.scale.y = icon.scale.x;
      // home ports carry the crown's colours; foreign ports a muted plate; native sites earth tones
      const color = p.kind === 'home' ? CROWN.spain.primary : p.kind === 'native' ? NATIVE.plate : 0x8d8472;
      const plate = this.plate(p.name, color, p.kind === 'native' ? p.people : p.kind === 'foreign' ? p.nation : undefined);
      plate.position.set(0, HEX_R * 0.75);
      this.plates.push(plate);
      node.addChild(icon, plate);
      node.position.set(g.cx(p.hex), g.cy(p.hex));
      node.visible = p.kind !== 'native';
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
      for (const p of this.m.ports) if (p.kind === 'native') this.portSprites.get(p.id)!.visible = state.discovered.includes(p.id);
      this.lastSeason = -1;
    }
    const season = seasonOf(state.turn);
    if (season !== this.lastSeason) { this.lastSeason = season; this.drawWind(season, fog); }
    this.windG.visible = ui.showWind;
    this.grid.alpha = ui.showGrid || ui.preview ? 0.22 : 0.1;
    this.syncFleets(state, ui, animate);
    this.drawRoutes(state, ui);
    this.drawHighlight(ui);
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
      const c = CROWN.spain;
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
      this.previewLabel.text = `${when}${p.cross ? ', then crosses the ocean' : ''} · storm risk ${Math.round(p.risk * 100)}%`;
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
    h.stroke({ width: 3, color: 0xffffff, alpha: 0.9 }).stroke({ width: 1.5, color: CROWN.spain.secondary });
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

  constructor(private el: HTMLElement, private world: World, private assets: Assets, private cb: MapCallbacks) {}

  async init(onProgress?: (msg: string) => void) {
    await this.app.init({
      resizeTo: this.el, background: '#efe2c4', antialias: true, autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl',
    });
    if (this.destroyed) return;
    this.el.appendChild(this.app.canvas);
    for (const id of ['old', 'new'] as MapId[]) {
      const sc = new Scene(GRIDS[id], this.world[id], this.world.seed, this.assets);
      await sc.build((m) => onProgress?.(`${id === 'old' ? 'Old World' : 'Mar Océano'}: ${m}`));
      if (this.destroyed) return;
      sc.root.visible = false;
      this.app.stage.addChild(sc.root);
      this.scenes[id] = sc;
    }
    this.bindInput();
    this.app.ticker.add(() => this.scene.tick(this.scene.cam.scale));
    this.show('old');
  }

  destroy() {
    this.destroyed = true;
    this.cleanup.forEach((f) => f());
    try { this.app.destroy(true, { children: true, texture: true }); } catch { /* not initialised */ }
  }

  private get scene() { return this.scenes[this.active]; }

  show(map: MapId) {
    if (!this.scenes[map]) return;
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
      const seville = this.world.old.ports.find((p) => p.id === 'seville')!;
      fx = g.cx(seville.hex); fy = g.cy(seville.hex); sx = (vw - right) * 0.62;
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

  private bindInput() {
    const cv = this.app.canvas;
    cv.style.touchAction = 'none';
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; camX: number; camY: number; moved: boolean; button: number } | null = null;
    let pinch: { d: number; scale: number } | null = null;
    const rect = () => cv.getBoundingClientRect();

    const onDown = (e: PointerEvent) => {
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
      const r = rect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
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
      const overFleet = sc.fleetAt(mx, my) != null;
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
      else this.cb.onClick(this.active, h, this.scene.fleetAt(mx, my));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = rect();
      this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    const onCtx = (e: Event) => e.preventDefault();
    const onLeave = () => { this.scene.hover.clear(); this.hoverHex = -1; this.cb.onHover(this.active, -1); };
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
