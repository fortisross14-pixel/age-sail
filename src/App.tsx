import { useEffect } from 'react';
import { useStore, type DrawerId } from './store';
import { Menu } from './ui/Menu';
import { MapCanvas, getView } from './ui/MapCanvas';
import { Hud } from './ui/Hud';
import { Dock, Rail } from './ui/Dock';
import { Minimap } from './ui/Minimap';
import { GoldDefs } from './ui/theme/icons';
import { Drawer } from './ui/Drawers';
import { SelectionCard } from './ui/SelectionCard';
import { NewsFeed } from './ui/NewsFeed';
import { HoverInfo } from './ui/HoverInfo';
import { EventCard, Help, Toast, Settings } from './ui/Overlays';
import { ObjectivesPanel, EndTurnGuard, Welcome, MapPointer } from './ui/Guidance';

const DRAWER_KEYS: Record<string, DrawerId> = { '1': 'cities', '2': 'markets', '3': 'fleets', '4': 'court', '5': 'research', '6': 'chronicle' };
const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

function useKeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const s = useStore.getState();
      if (s.phase !== 'playing' || !s.game) return;
      const k = e.key.toLowerCase();
      if (PAN_KEYS.has(k)) return; // the map view pans on these
      if (e.key === 'Alt') { e.preventDefault(); s.set({ highlightAll: true }); return; }
      if (s.game.events.length) return; // answer the card first
      if (s.showWelcome) {
        if (e.key === 'Escape') { e.preventDefault(); s.set({ showWelcome: false }); }
        return; // Enter presses the focused button
      }
      if (s.showGuard) {
        if (e.key === 'Escape') { e.preventDefault(); s.set({ showGuard: false }); }
        return; // Enter presses "End the turn anyway", which has the focus
      }
      if (s.showHelp) {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); s.set({ showHelp: false }); }
        return;
      }
      if (DRAWER_KEYS[k]) { s.set({ drawer: s.drawer === DRAWER_KEYS[k] ? null : DRAWER_KEYS[k] }); return; }
      switch (k) {
        case 'enter': e.preventDefault(); void s.endTurn(); break;
        case ' ': e.preventDefault(); void s.confirmPreview(); break;
        case 'escape':
          if (s.showSettings) s.set({ showSettings: false });
          else if (s.landing) s.set({ landing: null });
          else if (s.preview) s.set({ preview: null });
          else if (s.drawer) s.set({ drawer: null });
          else { s.selectFleet(null); s.selectParty(null); }
          break;
        case 'v': s.set({ showWind: !s.showWind }); break;
        case 'g': s.set({ showGrid: !s.showGrid }); break;
        case 'm': s.setMap(s.map === 'old' ? 'new' : 'old'); break;
        case 'n': s.nextAttention(); break;
        case 'h': case '?': s.set({ showHelp: true }); break;
        case '+': case '=': getView()?.zoomBy(1.2); break;
        case '-': getView()?.zoomBy(1 / 1.2); break;
        case 'tab': {
          e.preventDefault();
          const fl = s.game.fleets;
          if (!fl.length) break;
          const i = fl.findIndex((f) => f.id === s.selectedFleet);
          const next = fl[(i + 1) % fl.length];
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
  const drawer = useStore((s) => s.drawer);
  useKeys();
  if (phase !== 'playing') return <Menu />;
  return (
    <div className={`game ${drawer ? 'screen-open' : ''}`}>
      <GoldDefs />
      <MapCanvas />
      <Hud />
      <Rail />
      <MapPointer />
      <NewsFeed />
      <ObjectivesPanel />
      <Dock />
      <Minimap />
      <Settings />
      <Drawer />
      <SelectionCard />
      <HoverInfo />
      <Toast />
      <EventCard />
      <Help />
      <Welcome />
      <EndTurnGuard />
    </div>
  );
}
