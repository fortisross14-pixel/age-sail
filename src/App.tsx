import { useEffect } from 'react';
import { useStore } from './store';
import { keyDef } from './ui/keys';
import { Saves, MapModeChip, applyScale } from './ui/More';
import { pref } from './ui/prefs';
import { SidePanel, Ledger, TurnSummary } from './ui/Realm';
import { Menu } from './ui/Menu';
import { MapCanvas, getView } from './ui/MapCanvas';
import { Hud } from './ui/Hud';
import { Dock, Rail } from './ui/Dock';
import { Minimap } from './ui/Minimap';
import { GoldDefs } from './ui/theme/icons';
import { Drawer } from './ui/Drawers';
import { SelectionCard } from './ui/SelectionCard';
import { HoverInfo } from './ui/HoverInfo';
import { EventCard, Help, Toast, Settings } from './ui/Overlays';
import { EndTurnGuard, Welcome, MapPointer } from './ui/Guidance';

/** A digit picks an option on a card; Enter or Escape continues one that has nothing to choose. */
function cardKey(e: KeyboardEvent, k: string) {
  const s = useStore.getState();
  const ev = s.game!.events[0];
  if (ev.choices) {
    const i = Number(k) - 1;
    if (Number.isInteger(i) && i >= 0 && i < ev.choices.length) { e.preventDefault(); void s.run({ kind: 'choose', index: i }); }
    return; // Enter is left to the focused option, so nothing is chosen by accident
  }
  // a card that asks for a name is answered in its field or with its buttons
  if ((k === 'enter' || k === 'escape') && !(ev.kind === 'landfall' && !s.game!.land)) { e.preventDefault(); void s.run({ kind: 'dismissEvent' }); }
}

function useKeys() {
  useEffect(() => {
    /** Space on a focused button clicks it when the key comes up: swallow that when the game used the key. */
    let swallow = false;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) return; // the browser's own shortcuts
      const s = useStore.getState();
      if (s.phase !== 'playing' || !s.game) return;
      const k = e.key.toLowerCase();
      // layers, from the top: each takes the keys it knows and stops the rest
      if (s.game.events.length) { cardKey(e, k); return; }
      if (s.showWelcome) { if (k === 'escape' || k === 'enter') { e.preventDefault(); s.set({ showWelcome: false }); } return; }
      if (s.showGuard) {
        if (k === 'escape') { e.preventDefault(); s.set({ showGuard: false }); }
        else if (k === 'enter') { e.preventDefault(); void s.endTurn(true); }
        return;
      }
      if (s.showHelp) { if (k === 'escape' || k === 'enter' || k === 'h') { e.preventDefault(); s.set({ showHelp: false }); } return; }
      if (s.showSaves) { if (k === 'escape') { e.preventDefault(); s.set({ showSaves: false }); } return; }
      if (s.showLedger) { if (k === 'escape' || k === 'enter' || k === 'l') { e.preventDefault(); s.set({ showLedger: false }); } return; }
      const def = keyDef(k, s.drawer ? 'screen' : 'map');
      if (!def) return; // with a screen open, Enter and Space belong to the control that has the focus
      if (def.action === 'pan') return; // the map view pans while these are held
      e.preventDefault();
      if (k === ' ' || k === 'enter') { swallow = true; (document.activeElement as HTMLElement | null)?.blur?.(); }
      switch (def.action) {
        case 'endTurn': void s.endTurn(); break;
        case 'sail': void s.confirmPreview(); break;
        case 'escape':
          if (s.showSettings) s.set({ showSettings: false });
          else if (s.drawer) s.set({ drawer: null });
          else if (s.landing) s.set({ landing: null });
          else if (s.preview) s.set({ preview: null });
          else { s.selectFleet(null); s.selectParty(null); }
          break;
        case 'screen': { const d = def.screen!; s.set({ drawer: s.drawer === d ? null : d }); break; }
        case 'ledger': s.set({ showLedger: true }); break;
        case 'undo': void s.undoLast(); break;
        case 'mode': { const order = ['realms', 'finds', 'peoples', 'loyalty'] as const; s.set({ mapMode: order[(order.indexOf(s.mapMode) + 1) % order.length] }); break; }
        case 'help': s.set({ showHelp: true }); break;
        case 'nextNeed': s.nextAttention(); break;
        case 'wind': s.set({ showWind: !s.showWind }); break;
        case 'grid': s.set({ showGrid: !s.showGrid }); break;
        case 'map': s.setMap(s.map === 'old' ? 'new' : 'old'); break;
        case 'home': getView()?.home(); break;
        case 'zoomIn': getView()?.zoomBy(1.2); break;
        case 'zoomOut': getView()?.zoomBy(1 / 1.2); break;
        case 'highlight': s.set({ highlightAll: true }); break;
        case 'nextFleet': {
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
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') useStore.getState().set({ highlightAll: false });
      if (swallow && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); swallow = false; }
    };
    const blur = () => useStore.getState().set({ highlightAll: false });
    /** A button clicked with the mouse keeps the focus, and would be clicked again by Space or Enter: let it go. */
    const click = (e: MouseEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (e.detail > 0 && el?.tagName === 'BUTTON' && !el.closest('.modal, .drawer')) el.blur();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('click', click);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('click', click); };
  }, []);
}

export function App() {
  const phase = useStore((s) => s.phase);
  const drawer = useStore((s) => s.drawer);
  useKeys();
  useEffect(() => applyScale(pref('uiScale')), []);
  if (phase !== 'playing') return <><Menu /><Saves /></>;
  return (
    <div className={`game ${drawer ? 'screen-open' : ''}`}>
      <GoldDefs />
      <MapCanvas />
      <Hud />
      <Rail />
      <MapPointer />
      <TurnSummary />
      <SidePanel />
      <Dock />
      <Minimap />
      <Settings />
      <Drawer />
      <SelectionCard />
      <HoverInfo />
      <Toast />
      <EventCard />
      <Help />
      <Ledger />
      <Saves />
      <MapModeChip />
      <Welcome />
      <EndTurnGuard />
    </div>
  );
}
