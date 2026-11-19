import { useEffect } from 'react';
import { useStore } from './store';
import { Menu } from './ui/Menu';
import { MapCanvas, getView } from './ui/MapCanvas';
import { TopBar } from './ui/TopBar';
import { FleetPanel } from './ui/FleetPanel';
import { PortPanel } from './ui/PortPanel';
import { Chronicle } from './ui/Chronicle';
import { HoverInfo } from './ui/HoverInfo';
import { Dispatch, EventCard, Help, Toast } from './ui/Overlays';

function useKeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const s = useStore.getState();
      if (s.phase !== 'playing' || !s.game) return;
      if (e.key === 'Alt') { e.preventDefault(); s.set({ highlightAll: true }); return; }
      if (s.game.events.length) return;
      if (s.dispatch || s.showHelp) {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); s.set({ dispatch: null, showHelp: false }); }
        return;
      }
      switch (e.key) {
        case 'Enter': e.preventDefault(); void s.endTurn(); break;
        case 'Escape': s.set(s.preview ? { preview: null } : { selectedPort: null }); break;
        case 'w': case 'W': s.set({ showWind: !s.showWind }); break;
        case 'g': case 'G': s.set({ showGrid: !s.showGrid }); break;
        case 'c': case 'C': s.set({ showChronicle: !s.showChronicle }); break;
        case 'm': case 'M': s.setMap(s.map === 'old' ? 'new' : 'old'); break;
        case 'h': case 'H': case '?': s.set({ showHelp: true }); break;
        case 's': case 'S': void s.confirmPreview(); break;
        case '+': case '=': getView()?.zoomBy(1.2); break;
        case '-': getView()?.zoomBy(1 / 1.2); break;
        case 'Tab': {
          e.preventDefault();
          const fl = s.game.fleets;
          if (!fl.length) break;
          const k = fl.findIndex((f) => f.id === s.selectedFleet);
          const next = fl[(k + 1) % fl.length];
          s.selectFleet(next.id);
          setTimeout(() => getView()?.focusHex(next.map, next.hex), 0);
          break;
        }
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') useStore.getState().set({ highlightAll: false }); };
    const blur = () => useStore.getState().set({ highlightAll: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
}

export function App() {
  const phase = useStore((s) => s.phase);
  const showChronicle = useStore((s) => s.showChronicle);
  useKeys();
  if (phase !== 'playing') return <Menu />;
  return (
    <div className="game">
      <MapCanvas />
      <TopBar />
      {showChronicle && <Chronicle />}
      <FleetPanel />
      <PortPanel />
      <HoverInfo />
      <Toast />
      <Dispatch />
      <EventCard />
      <Help />
    </div>
  );
}
