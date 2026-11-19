import { useStore } from '../store';
import { provisionsMax, maxMoves, explorerOf, isPortal, canCross, portById, cargoUsed, cargoCapacity, provisionCost } from '../sim/game';
import { fmt } from './format';
import { ShipIcon } from './Icon';

/** A compact card for the selected fleet: what it has, and what it can do next. */
export function SelectionCard() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const map = useStore((s) => s.map);
  const selected = useStore((s) => s.selectedFleet);
  const preview = useStore((s) => s.preview);
  const run = useStore((s) => s.run);
  const confirm = useStore((s) => s.confirmPreview);
  const set = useStore((s) => s.set);
  const fleet = game.fleets.find((f) => f.id === selected && f.map === map);
  if (!fleet) return null;
  const explorer = explorerOf(game, fleet);
  const port = fleet.at ? portById(world, fleet.at) : undefined;
  const lowFood = fleet.supplies <= 2;
  return (
    <div className="selection" role="region" aria-label={`Selected fleet ${fleet.name}`}>
      <ShipIcon type={fleet.ships[0].type} size={54} />
      <div className="sel-main">
        <div className="sel-title">
          <b>{fleet.name}</b>
          <span className="muted small">{explorer ? `led by ${explorer.name}` : 'no explorer'}{port ? ` · at ${port.name}` : ''}</span>
        </div>
        <div className="sel-stats">
          <span title="Movement left this season">⛵ {fleet.moves}/{maxMoves(fleet, game)}</span>
          <span title="Seasons of food and water" className={lowFood ? 'bad' : ''}>🍞 {fleet.supplies}/{provisionsMax(fleet, game)}</span>
          <span title="Crew">⚓ {fleet.crew}</span>
          <span title="Hold">▣ {cargoUsed(fleet)}/{cargoCapacity(fleet)}</span>
          <span title="Ships">{fleet.ships.length} ship{fleet.ships.length > 1 ? 's' : ''}</span>
        </div>
        {preview && preview.fleet === fleet.id ? (
          <div className="sel-plan">
            <b>{preview.turns > 1 ? `${preview.turns} seasons` : 'This season'}</b>{preview.cross ? ', then across the ocean' : ''}
            <span className="muted"> · storm risk {Math.round(preview.risk * 100)}%{preview.provision ? ` · provisions ${fmt(preview.provision)}` : ''}</span>
            {preview.turns > fleet.supplies && !fleet.at && <span className="bad"> · food runs out on the way</span>}
            {preview.crossBlocked && <span className="bad"> · needs an explorer</span>}
            {preview.deep > 0 && <span className="bad"> · open ocean: stores spoil twice as fast and storms are fiercer</span>}
          </div>
        ) : fleet.order ? (
          <div className="sel-plan muted">Under orders{fleet.order.cross ? ' to cross the ocean' : ''}: {fleet.order.path.length - 1} hexes to go.</div>
        ) : (
          <div className="sel-plan muted">Click the sea or a port to plan · Space to sail · right-click sails at once</div>
        )}
      </div>
      <div className="sel-actions">
        {preview && preview.fleet === fleet.id && (
          <>
            <button className="primary" disabled={preview.crossBlocked} onClick={() => void confirm()}>Sail</button>
            <button onClick={() => set({ preview: null })}>Cancel</button>
          </>
        )}
        {!preview && fleet.order && <button onClick={() => void run({ kind: 'cancelOrder', fleet: fleet.id })}>Stop</button>}
        {isPortal(world, fleet) && !preview && (
          <button className="primary" disabled={fleet.moves <= 0 || !canCross(game, fleet)} onClick={() => void run({ kind: 'cross', fleet: fleet.id })}>
            {fleet.map === 'old' ? 'Cross ⟵' : 'To Europe ⟶'}
          </button>
        )}
        {port && !preview && <button onClick={() => set({ drawer: 'markets', selectedPort: port.id })}>Trade</button>}
        {port && !preview && provisionCost(world, fleet, game) > 0 && (
          <button onClick={() => void run({ kind: 'provision', fleet: fleet.id })}>Provision · {fmt(provisionCost(world, fleet, game))}</button>
        )}
        {!preview && <button onClick={() => set({ drawer: 'fleets' })}>Details</button>}
      </div>
      <button className="x" onClick={() => useStore.getState().selectFleet(null)} aria-label="Deselect">×</button>
    </div>
  );
}
