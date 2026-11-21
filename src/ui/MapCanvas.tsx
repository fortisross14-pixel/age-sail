import { useEffect, useRef, useState } from 'react';
import { setCamera } from './Minimap';
import { MapView } from '../render/MapView';
import { loadAssets } from '../render/assets';
import { useStore } from '../store';
import { isWater } from '../data/terrain';
import { Fog } from '../sim/types';
import { GRIDS } from '../sim/hex';

let viewRef: MapView | null = null;

/** Shore hexes beside the selected fleet where it can put people ashore. */
export function landingHexes(s: ReturnType<typeof useStore.getState>): number[] {
  const f = s.game?.fleets.find((x) => x.id === s.selectedFleet);
  if (!f || !s.world) return [];
  const g = GRIDS[f.map];
  return [f.hex, ...g.neighbors(f.hex)].filter((h) => !isWater(s.world![f.map].terrain[h]) && s.game!.fog[f.map][h] !== Fog.Unknown);
}
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
        onClick: (map, hex, fleetId, partyId) => {
          const s = useStore.getState();
          const g = s.game!;
          // choosing a shore to land on
          if (s.landing && s.selectedFleet != null) {
            const lead = s.landing.leader;
            s.set({ landing: null });
            if (!isWater(world[map].terrain[hex])) void s.run({ kind: 'land', fleet: s.selectedFleet, hex, leader: lead }).then((ok) => {
              const st = useStore.getState();
              if (ok) { const p = st.game?.parties[st.game.parties.length - 1]; if (p) st.selectParty(p.id); }
            });
            return;
          }
          if (partyId != null) {
            if (s.selectedParty !== partyId) s.selectParty(partyId);
            return;
          }
          const party = g.parties.find((p) => p.id === s.selectedParty && p.map === map);
          if (party && fleetId == null) {
            if (s.preview?.dest === hex && s.preview.map === map) void s.confirmPreview();
            else void s.planTo(hex);
            return;
          }
          if (fleetId != null) {
            if (s.selectedFleet !== fleetId) s.selectFleet(fleetId);
            else s.set({ drawer: 'fleets', fleetOpen: fleetId });
            return;
          }
          const colony = g.colonies.find((c) => c.map === map && c.hex === hex);
          const port = colony ? { id: colony.id, kind: 'colony' as const } : world[map].ports.find((p) => p.hex === hex && (p.kind !== 'native' || g.discovered.includes(p.id)));
          const fleet = g.fleets.find((f) => f.id === s.selectedFleet && f.map === map);
          const again = s.preview?.dest === hex && s.preview.map === map;
          // inland cities: yours open the city panel; foreign ones are names on the chart
          if (port && 'inland' in port && port.inland) {
            if (port.kind === 'home') s.set({ selectedPort: port.id, preview: null, drawer: 'cities' });
            return;
          }
          if (port) {
            if (fleet && fleet.hex !== hex) {
              if (again) void s.confirmPreview();
              else { s.set({ selectedPort: port.id }); void s.planTo(hex); }
            } else s.set({ selectedPort: port.id, preview: null, drawer: (port.kind === 'home' || port.kind === 'colony') && !fleet ? 'cities' : 'markets', ...(port.kind === 'colony' ? { selectedColony: port.id } : {}) });
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
          const party = s.game?.parties.find((p) => p.id === s.selectedParty && p.map === map);
          if (!fleet && !party) return;
          await s.planTo(hex);
          if (useStore.getState().preview) await useStore.getState().confirmPreview();
        },
        onHover: (map, hex) => useStore.getState().set({ hover: hex >= 0 ? { map, hex } : null }),
        onCamera: (map, v) => setCamera(map, v),
      });
      viewRef = view;
      if (import.meta.env.DEV) (window as unknown as { __view: MapView; __store: typeof useStore }).__view = view;
      if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
      await view.init((m) => setStatus(m || null));
      if (cancelled) return;
      setStatus(null);
      // Redraw only when something the map shows changes: hover, toasts and drawers don't count.
      let last: unknown[] = [];
      const push = () => {
        const s = useStore.getState();
        const deps = [s.game, s.map, s.selectedFleet, s.selectedParty, s.preview, s.landing, s.showWind, s.showGrid, s.highlightAll, s.mapMode];
        if (deps.length === last.length && deps.every((d, i) => d === last[i])) return;
        last = deps;
        if (s.game) view!.update(s.game, {
          map: s.map, selectedFleet: s.selectedFleet, selectedParty: s.selectedParty, preview: s.preview && { ...s.preview },
          landing: s.landing ? landingHexes(s) : null,
          showWind: s.showWind, showGrid: s.showGrid, highlightAll: s.highlightAll, mode: s.mapMode,
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
