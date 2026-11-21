import { useStore, newWorldOpen, type DrawerId } from '../store';
import { Icon, type IconName } from './theme/icons';
import { Medal } from './theme/Art';
import { getView } from './MapCanvas';

const ITEMS: { id: DrawerId; label: string; icon: IconName; key: string }[] = [
  { id: 'cities', label: 'Cities', icon: 'cities', key: '1' },
  { id: 'markets', label: 'Markets', icon: 'markets', key: '2' },
  { id: 'fleets', label: 'Fleets', icon: 'fleets', key: '3' },
  { id: 'court', label: 'Court', icon: 'court', key: '4' },
  { id: 'diplomacy', label: 'Diplomacy', icon: 'diplomacy', key: '5' },
  { id: 'research', label: 'Research', icon: 'research', key: '6' },
  { id: 'chronicle', label: 'Chronicle', icon: 'chronicle', key: '7' },
];

/** The six framed buttons along the bottom that open everything else. */
export function Dock() {
  const drawer = useStore((s) => s.drawer);
  const game = useStore((s) => s.game)!;
  const set = useStore((s) => s.set);
  const badge: Partial<Record<DrawerId, number>> = {
    cities: Object.values(game.cities).filter((c) => !c.project && c.buildings.docks > 0).length,
    fleets: game.fleets.filter((f) => f.moves > 0 && !f.order && !f.at).length + game.parties.filter((p) => p.moves > 0 && !p.order).length,
    court: game.dynasty.offers.length + game.people.filter((p) => p.alive && p.ready === 0 && p.fleet == null && (p.rank === 'explorer' || p.rank === 'merchant') && !game.parties.some((x) => x.leader === p.id)).length,
    research: game.research.current ? 0 : 1,
  };
  const why: Partial<Record<DrawerId, string>> = {
    cities: 'idle shipyards', fleets: 'fleets and parties without orders', court: 'leaders ready, waiting for a fleet', research: 'nothing being studied',
  };
  return (
    <nav className="dock" aria-label="Panels">
      {ITEMS.map((it) => (
        <button key={it.id} className={`dock-btn ${drawer === it.id ? 'on' : ''}`} onClick={() => set({ drawer: drawer === it.id ? null : it.id })}
          title={`${it.label} (${it.key})`} aria-pressed={drawer === it.id}>
          <Medal name={it.id} size={54} fallback={<Icon name={it.icon} size={40} />} />
          <span>{it.label}</span>
          {(badge[it.id] ?? 0) > 0 && <span className="badge" title={`${badge[it.id]} ${why[it.id]}`}>{badge[it.id]}</span>}
        </button>
      ))}
    </nav>
  );
}

/** Round medallions down the left: map views and tools. */
export function Rail() {
  const game = useStore((s) => s.game)!;
  const map = useStore((s) => s.map);
  const showWind = useStore((s) => s.showWind);
  const mapMode = useStore((s) => s.mapMode);
  const showGrid = useStore((s) => s.showGrid);
  const highlightAll = useStore((s) => s.highlightAll);
  const set = useStore((s) => s.set);
  const setMap = useStore((s) => s.setMap);
  const open = newWorldOpen(game);
  const next = () => {
    const fl = game.fleets;
    if (!fl.length) return;
    const s = useStore.getState();
    const i = fl.findIndex((f) => f.id === s.selectedFleet);
    const f = fl[(i + 1) % fl.length];
    s.selectFleet(f.id);
    setTimeout(() => getView()?.focusHex(f.map, f.hex), 0);
  };
  const other = map === 'old' ? (open ? (game.newWorldFound ? 'the New World' : 'the Mar Océano') : 'the unknown west (locked)') : 'the Old World';
  return (
    <nav className="rail" aria-label="Map tools">
      <button className={`adm-medal ${map === 'new' ? 'on' : ''}`} onClick={() => setMap(map === 'old' ? 'new' : 'old')} data-tip={`Show ${other} (M)`} aria-label={`Show ${other}`}><Medal name="globe" size={58} fallback={<Icon name="globe" size={28} />} /></button>
      <button className="adm-medal" onClick={() => getView()?.home()} data-tip="Back to your capital (C)" aria-label="Back to your capital"><Medal name="home" size={58} fallback={<Icon name="home" size={26} />} /></button>
      <button className="adm-medal" onClick={next} data-tip="Next fleet (Tab)" aria-label="Next fleet"><Medal name="next" size={58} fallback={<Icon name="next" size={26} />} /></button>
      <button className={`adm-medal ${mapMode !== 'realms' ? 'on' : ''}`} onClick={() => { const order = ['realms', 'finds', 'peoples', 'loyalty'] as const; set({ mapMode: order[(order.indexOf(mapMode) + 1) % order.length] }); }} data-tip="What the map shows: realms, finds, peoples, loyalty (O)" aria-label="Map mode"><Icon name="cities" size={26} /></button>
      <button className={`adm-medal ${showWind ? 'on' : ''}`} onClick={() => set({ showWind: !showWind })} data-tip="Winds (V)" aria-label="Winds" aria-pressed={showWind}><Medal name="wind" size={58} fallback={<Icon name="wind" size={26} />} /></button>
      <button className={`adm-medal ${showGrid ? 'on' : ''}`} onClick={() => set({ showGrid: !showGrid })} data-tip="Hex grid (G)" aria-label="Hex grid" aria-pressed={showGrid}><Medal name="grid" size={58} fallback={<Icon name="grid" size={26} />} /></button>
      <button className={`adm-medal ${highlightAll ? 'on' : ''}`} onClick={() => set({ highlightAll: !highlightAll })} data-tip="Show what you can click (Alt)" aria-label="Show what you can click" aria-pressed={highlightAll}><Medal name="eye" size={58} fallback={<Icon name="eye" size={26} />} /></button>
      <button className="adm-medal" onClick={() => set({ showHelp: true })} data-tip="How to play (H)" aria-label="How to play"><Medal name="help" size={58} fallback={<Icon name="help" size={26} />} /></button>
    </nav>
  );
}
