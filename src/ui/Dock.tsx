import { useStore, type DrawerId } from '../store';
import { spriteUrl } from '../render/assets';

const ITEMS: { id: DrawerId; label: string; icon: string; key: string }[] = [
  { id: 'cities', label: 'Cities', icon: 'colonies/port-town', key: '1' },
  { id: 'markets', label: 'Markets', icon: 'goods/spices', key: '2' },
  { id: 'fleets', label: 'Fleets', icon: 'ships/caravel', key: '3' },
  { id: 'court', label: 'Court', icon: 'units/conquistador', key: '4' },
];

/** The four buttons that open everything else. */
export function Dock() {
  const drawer = useStore((s) => s.drawer);
  const game = useStore((s) => s.game)!;
  const set = useStore((s) => s.set);
  const badge: Record<DrawerId, number> = {
    cities: Object.values(game.cities).filter((c) => !c.project).length,
    markets: 0,
    fleets: game.fleets.filter((f) => f.moves > 0 && !f.order && !f.at).length + game.parties.filter((p) => p.moves > 0 && !p.order).length,
    court: game.people.filter((p) => p.alive && p.ready === 0 && p.fleet == null && (p.rank === 'explorer' || p.rank === 'merchant') && !game.parties.some((x) => x.leader === p.id)).length,
  };
  const why: Record<DrawerId, string> = {
    cities: 'idle yards', markets: '', fleets: 'fleets and parties without orders', court: 'leaders ready, waiting for a fleet',
  };
  return (
    <nav className="dock" aria-label="Panels">
      {ITEMS.map((it) => (
        <button key={it.id} className={`dock-btn ${drawer === it.id ? 'on' : ''}`} onClick={() => set({ drawer: drawer === it.id ? null : it.id })}
          title={`${it.label} (${it.key})`} aria-pressed={drawer === it.id}>
          <img src={spriteUrl(it.icon)} alt="" />
          <span>{it.label}</span>
          {badge[it.id] > 0 && <span className="badge" title={`${badge[it.id]} ${why[it.id]}`}>{badge[it.id]}</span>}
        </button>
      ))}
    </nav>
  );
}
