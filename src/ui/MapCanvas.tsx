import { useEffect, useRef, useState } from 'react';
import { MapView } from '../render/MapView';
import { loadAssets } from '../render/assets';
import { useStore } from '../store';
import { isWater } from '../data/terrain';
import { Fog } from '../sim/types';

let viewRef: MapView | null = null;
export const getView = () => viewRef;

export function MapCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const world = useStore((s) => s.world);
  const [status, setStatus] = useState<string | null>('Unrolling the charts…');

  useEffect(() => {
    if (!world || !host.current) return;
    let view: MapView | null = null;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const assets = await loadAssets();
      await document.fonts.load('16px "IM Fell English"').catch(() => undefined);
      if (cancelled) return;
      view = new MapView(host.current!, world, assets, {
        onClick: (map, hex, fleetId) => {
          const s = useStore.getState();
          const g = s.game!;
          if (fleetId != null) {
            if (s.selectedFleet !== fleetId) s.selectFleet(fleetId);
            return;
          }
          const port = world[map].ports.find((p) => p.hex === hex && (p.kind !== 'native' || g.discovered.includes(p.id)));
          const fleet = g.fleets.find((f) => f.id === s.selectedFleet && f.map === map);
          const again = s.preview?.dest === hex && s.preview.map === map;
          if (port) {
            if (fleet && fleet.hex !== hex) {
              if (again) void s.confirmPreview();
              else { s.set({ selectedPort: port.id }); void s.planTo(hex); }
            } else s.set({ selectedPort: port.id, preview: null, drawer: port.kind === 'home' && !fleet ? 'cities' : 'markets' });
            return;
          }
          const known = g.fog[map][hex] >= Fog.Charted;
          if (fleet && (!known || isWater(world[map].terrain[hex]))) {
            if (again) void s.confirmPreview();
            else void s.planTo(hex);
            return;
          }
          s.set({ preview: null });
        },
        onRightClick: async (map, hex) => {
          const s = useStore.getState();
          const fleet = s.game?.fleets.find((f) => f.id === s.selectedFleet && f.map === map);
          if (!fleet) return;
          await s.planTo(hex);
          if (useStore.getState().preview) await useStore.getState().confirmPreview();
        },
        onHover: (map, hex) => useStore.getState().set({ hover: hex >= 0 ? { map, hex } : null }),
      });
      viewRef = view;
      if (import.meta.env.DEV) (window as unknown as { __view: MapView; __store: typeof useStore }).__view = view;
      if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
      await view.init((m) => setStatus(m));
      if (cancelled) return;
      setStatus(null);
      const push = () => {
        const s = useStore.getState();
        if (s.game) view!.update(s.game, {
          map: s.map, selectedFleet: s.selectedFleet, preview: s.preview && { ...s.preview },
          showWind: s.showWind, showGrid: s.showGrid, highlightAll: s.highlightAll,
        });
      };
      push();
      unsub = useStore.subscribe(push);
    })().catch((e) => setStatus(`Could not draw the map: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      cancelled = true;
      unsub?.();
      view?.destroy();
      viewRef = null;
    };
  }, [world]);

  return (
    <>
      <div ref={host} className="map-host" />
      {status && <div className="map-status"><div className="spinner" />{status}</div>}
    </>
  );
}
