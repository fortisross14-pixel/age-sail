import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { GRIDS, type MapId } from '../sim/hex';
import { Fog } from '../sim/types';
import { isWater } from '../data/terrain';
import { realmAt, realmSpec } from '../data/realms';
import { CROWN } from '../render/palette';
import { Frame } from './theme/Frame';
import { Icon } from './theme/icons';
import { getView } from './MapCanvas';

/** Where the camera is, shared by the map view and the minimap without going through the store. */
export const camera = { map: 'old' as MapId, x: 0, y: 0, w: 0, h: 0, listeners: new Set<() => void>() };
export function setCamera(map: MapId, v: { x: number; y: number; w: number; h: number }) {
  Object.assign(camera, { map }, v);
  camera.listeners.forEach((f) => f());
}

/** the chart fits this box, keeping the board's shape */
const BOX = { w: 230, h: 230 };
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** A small chart of the whole board: realms, your colonies and fleets, and the part in view. */
export function Minimap() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const map = useStore((s) => s.map);
  const base = useRef<HTMLCanvasElement | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const g = GRIDS[map];
  const scale = Math.min(BOX.w / g.pxW, BOX.h / g.pxH);
  const WIDTH = Math.round(g.pxW * scale);
  const height = Math.round(g.pxH * scale);

  // the chart itself: redrawn when fog, colonies or fleets change
  useEffect(() => {
    const c = base.current ?? (base.current = document.createElement('canvas'));
    c.width = WIDTH * 2; c.height = height * 2;
    const x = c.getContext('2d')!;
    x.setTransform(2 * scale, 0, 0, 2 * scale, 0, 0);
    const m = world[map], fog = game.fog[map];
    x.fillStyle = '#1b2a33'; x.fillRect(0, 0, g.pxW, g.pxH);
    const r = 44;
    for (let i = 0; i < g.N; i++) {
      const known = fog[i] >= Fog.Charted;
      const realm = realmAt(m.realm[i]);
      x.fillStyle = !known ? '#2b2a22' : isWater(m.terrain[i]) ? (m.deep[i] ? '#3a5a6e' : '#4f7488')
        : realm ? hex(realmSpec(realm).color) : '#b9a26f';
      x.fillRect(g.cx(i) - r * 0.5, g.cy(i) - r * 0.45, r, r * 0.9);
    }
    x.fillStyle = CROWN[game.crown].css;
    for (const col of game.colonies) if (col.map === map) { x.beginPath(); x.arc(g.cx(col.hex), g.cy(col.hex), 55, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#fff4d0';
    for (const f of game.fleets) if (f.map === map) { x.beginPath(); x.arc(g.cx(f.hex), g.cy(f.hex), 38, 0, Math.PI * 2); x.fill(); }
    paint();
  }, [game.fog, game.colonies, game.fleets, map, world, game.crown]);

  function paint() {
    const c = cv.current, b = base.current;
    if (!c || !b) return;
    c.width = WIDTH * 2; c.height = height * 2;
    const x = c.getContext('2d')!;
    x.drawImage(b, 0, 0);
    if (camera.map === map && camera.w) {
      x.strokeStyle = '#ffe39a'; x.lineWidth = 3;
      x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 4;
      x.strokeRect(camera.x * scale * 2, camera.y * scale * 2, camera.w * scale * 2, camera.h * scale * 2);
    }
  }
  useEffect(() => { camera.listeners.add(paint); return () => { camera.listeners.delete(paint); }; });

  const jump = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    getView()?.centerOn(((e.clientX - r.left) / r.width) * g.pxW, ((e.clientY - r.top) / r.height) * g.pxH);
  };
  return (
    <Frame className="minimap" surface="lacquer" corners={false}>
      <canvas ref={cv} width={WIDTH * 2} height={height * 2} style={{ width: WIDTH, height }} onClick={jump} aria-label="Chart of the whole board: click to look there" role="img" />
      <div className="zoom">
        <button className="adm-medal small" onClick={() => getView()?.zoomBy(1.25)} aria-label="Zoom in"><Icon name="plus" size={18} /></button>
        <button className="adm-medal small" onClick={() => getView()?.zoomBy(0.8)} aria-label="Zoom out"><Icon name="minus" size={18} /></button>
      </div>
    </Frame>
  );
}
