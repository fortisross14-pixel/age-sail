/**
 * Pointy-top hex grids in "odd-r" offset layout: odd rows are shifted right by half a hex.
 * A hex is addressed by its index i = row * W + col. There are two boards: the fixed Old World
 * and the procedural New World. Each has its own size and its own latitude/longitude mapping.
 */
export const HEX_R = 28; // map pixels from centre to corner
export const HEX_W = Math.sqrt(3) * HEX_R;
export const ROW_H = 1.5 * HEX_R;

export type MapId = 'old' | 'new';

export interface GridSpec {
  id: MapId;
  W: number;
  H: number;
  latTop: number;
  latPerRow: number;
  lonLeft: number;
  lonPerCol: number;
}

const DIRS: [number, number][][] = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

export class Grid {
  readonly id: MapId;
  readonly W: number;
  readonly H: number;
  readonly N: number;
  readonly pxW: number;
  readonly pxH: number;
  private nb: number[][];

  constructor(readonly spec: GridSpec) {
    this.id = spec.id;
    this.W = spec.W;
    this.H = spec.H;
    this.N = spec.W * spec.H;
    this.pxW = Math.ceil(HEX_W * (spec.W + 0.5));
    this.pxH = Math.ceil(ROW_H * (spec.H - 1) + 2 * HEX_R);
    this.nb = [];
    for (let i = 0; i < this.N; i++) {
      const c = this.col(i), r = this.row(i);
      const out: number[] = [];
      for (const [dc, dr] of DIRS[r & 1]) if (this.inBounds(c + dc, r + dr)) out.push(this.idx(c + dc, r + dr));
      this.nb.push(out);
    }
  }

  col = (i: number) => i % this.W;
  row = (i: number) => Math.floor(i / this.W);
  idx = (c: number, r: number) => r * this.W + c;
  inBounds = (c: number, r: number) => c >= 0 && c < this.W && r >= 0 && r < this.H;

  cx = (i: number) => HEX_W * (this.col(i) + 0.5 * (this.row(i) & 1)) + HEX_W / 2;
  cy = (i: number) => ROW_H * this.row(i) + HEX_R;

  lat = (i: number) => this.spec.latTop - this.row(i) * this.spec.latPerRow;
  lon = (i: number) => this.spec.lonLeft + (this.col(i) + 0.5 * (this.row(i) & 1)) * this.spec.lonPerCol;

  /** Hex nearest to a latitude / longitude (clamped to the board). */
  hexAt(lat: number, lon: number): number {
    const s = this.spec;
    const r = Math.max(0, Math.min(this.H - 1, Math.round((s.latTop - lat) / s.latPerRow)));
    const c = Math.max(0, Math.min(this.W - 1, Math.round((lon - s.lonLeft) / s.lonPerCol - 0.5 * (r & 1))));
    return this.idx(c, r);
  }

  neighbors(i: number): number[] {
    return this.nb[i];
  }

  private cube(i: number): [number, number, number] {
    const c = this.col(i), r = this.row(i);
    const q = c - (r - (r & 1)) / 2;
    return [q, r, -q - r];
  }

  distance(a: number, b: number): number {
    const [aq, ar, as] = this.cube(a);
    const [bq, br, bs] = this.cube(b);
    return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
  }

  /** All hexes within distance d of i (including i). */
  within(i: number, d: number): number[] {
    const out: number[] = [];
    const c0 = this.col(i), r0 = this.row(i);
    for (let r = r0 - d; r <= r0 + d; r++) {
      for (let c = c0 - d - 1; c <= c0 + d + 1; c++) {
        if (!this.inBounds(c, r)) continue;
        const j = this.idx(c, r);
        if (this.distance(i, j) <= d) out.push(j);
      }
    }
    return out;
  }

  /** Hex under a map-pixel point, or -1 off the board. */
  atPixel(x: number, y: number): number {
    const px = x - HEX_W / 2;
    const py = y - HEX_R;
    const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / HEX_R;
    const r = ((2 / 3) * py) / HEX_R;
    let rx = Math.round(q), ry = Math.round(r);
    const rz = Math.round(-q - r);
    const dx = Math.abs(rx - q), dy = Math.abs(ry - r), dz = Math.abs(rz + q + r);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    const cc = rx + (ry - (ry & 1)) / 2;
    if (!this.inBounds(cc, ry)) return -1;
    return this.idx(cc, ry);
  }

  corners(i: number, scale = 1): number[] {
    const x = this.cx(i), y = this.cy(i);
    const pts: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 30);
      pts.push(x + HEX_R * scale * Math.cos(a), y + HEX_R * scale * Math.sin(a));
    }
    return pts;
  }
}

/** Western Europe, the Mediterranean and North Africa. Fixed. */
export const OLD = new Grid({ id: 'old', W: 62, H: 72, latTop: 62, latPerRow: 0.5, lonLeft: -21, lonPerCol: 0.62 });
/** The western Mar Océano and the lands beyond. Procedural. */
export const NEW = new Grid({ id: 'new', W: 88, H: 68, latTop: 62, latPerRow: 1.0, lonLeft: -108, lonPerCol: 1.0 });

export const GRIDS: Record<MapId, Grid> = { old: OLD, new: NEW };
