import { useStore } from '../store';
import { SHIPS } from '../data/ships';
import { GOOD_INFO, GOODS } from '../data/goods';
import {
  cargoUsed, cargoCapacity, crewNeeded, provisionCost, repairCost, portById, provisionsMax, maxMoves, explorerOf, isPortal, canCross,
} from '../sim/game';
import { fmt } from './format';
import { GoodIcon, ShipIcon } from './Icon';
import { getView } from './MapCanvas';

export function FleetPanel() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const selected = useStore((s) => s.selectedFleet);
  const preview = useStore((s) => s.preview);
  const selectFleet = useStore((s) => s.selectFleet);
  const run = useStore((s) => s.run);
  const confirm = useStore((s) => s.confirmPreview);
  const set = useStore((s) => s.set);
  const fleet = game.fleets.find((f) => f.id === selected);
  const explorer = fleet ? explorerOf(game, fleet) : undefined;
  const others = fleet ? game.fleets.filter((f) => f !== fleet && f.map === fleet.map && f.hex === fleet.hex) : [];
  const waiting = fleet?.at && fleet.explorer == null ? game.explorers.filter((e) => e.alive && e.waitingAt === fleet.at) : [];

  return (
    <aside className="panel fleet-panel">
      <h2>Fleets</h2>
      <ul className="fleet-list">
        {game.fleets.map((f) => {
          const where = f.at ? portById(world, f.at)?.name : f.order ? 'Under sail' : f.map === 'new' ? 'Mar Océano' : 'At sea';
          return (
            <li key={f.id}>
              <button className={`fleet-row ${f.id === selected ? 'sel' : ''}`} onClick={() => { selectFleet(f.id); setTimeout(() => getView()?.focusHex(f.map, f.hex), 0); }}>
                <ShipIcon type={f.ships[0].type} size={34} />
                <span className="fleet-name">{f.name}{f.explorer != null && <span className="explorer-mark" title="Led by an explorer"> ✦</span>}</span>
                <span className="fleet-where">{where}{f.moves > 0 && !f.at && !f.order ? ' · ready' : ''}</span>
              </button>
            </li>
          );
        })}
        {!game.fleets.length && <li className="muted">No ships left. Build one in Sevilla.</li>}
      </ul>

      {fleet && (
        <div className="fleet-detail">
          <h3>{fleet.name}</h3>
          <div className={`leader ${explorer ? '' : 'none'}`}>
            {explorer
              ? <>Led by <b>{explorer.name}</b>, explorer. May sail into unknown waters.</>
              : <>No explorer aboard. May only sail charted waters{game.newWorldFound ? '' : ' and cannot cross the Mar Océano'}.</>}
          </div>
          <div className="ships">
            {fleet.ships.map((s) => (
              <div key={s.id} className="ship" title={SHIPS[s.type].blurb}>
                <ShipIcon type={s.type} size={46} />
                <div>
                  <div className="ship-name">{s.name}</div>
                  <div className="muted small">{SHIPS[s.type].name} · hold {SHIPS[s.type].cargo}</div>
                  <div className="bar" title={`Hull ${s.hull}%`}><div style={{ width: `${s.hull}%` }} className={s.hull < 50 ? 'bad' : ''} /></div>
                </div>
              </div>
            ))}
          </div>
          <dl className="facts">
            <dt>Moves</dt><dd>{fleet.moves} / {maxMoves(fleet)} this season</dd>
            <dt>Supplies</dt><dd className={fleet.supplies <= 2 ? 'bad' : ''}>{fleet.supplies} of {provisionsMax(fleet)} seasons</dd>
            <dt>Crew</dt><dd className={fleet.crew < crewNeeded(fleet) * 0.6 ? 'bad' : ''}>{fleet.crew} / {crewNeeded(fleet)}</dd>
            <dt>Hold</dt><dd>{cargoUsed(fleet)} / {cargoCapacity(fleet)}</dd>
          </dl>
          {cargoUsed(fleet) > 0 && (
            <div className="cargo">
              {GOODS.filter((g) => fleet.cargo[g]).map((g) => (
                <span key={g} className="chip" title={GOOD_INFO[g].name}><GoodIcon good={g} size={20} />{fleet.cargo[g]}</span>
              ))}
            </div>
          )}

          {preview && preview.fleet === fleet.id ? (
            <div className="orders preview">
              <div><b>{preview.turns > 1 ? `${preview.turns} seasons` : 'This season'}</b>{preview.cross ? ', then across the ocean' : ''}</div>
              <div className="muted small">Storm risk {Math.round(preview.risk * 100)}%{preview.provision ? ` · provisions ${fmt(preview.provision)} ducats` : ''}</div>
              {preview.turns > fleet.supplies && !fleet.at && <div className="bad small">Supplies will run out on the way.</div>}
              {preview.crossBlocked && <div className="bad small">Needs an explorer to cross into the unknown.</div>}
              <div className="row">
                <button className="primary" disabled={preview.crossBlocked} onClick={() => void confirm()}>Sail (S)</button>
                <button onClick={() => set({ preview: null })}>Cancel</button>
              </div>
            </div>
          ) : fleet.order ? (
            <div className="orders">
              <div>Under orders{fleet.order.cross ? ' to cross the ocean' : ''}: {fleet.order.path.length - 1} hexes to go.</div>
              <div className="muted small">The fleet sails on by itself at the start of each season.</div>
              <button onClick={() => void run({ kind: 'cancelOrder', fleet: fleet.id })}>Cancel orders</button>
            </div>
          ) : (
            <div className="orders muted small">
              Click the sea or a port to plan a voyage, click again (or press S) to sail. Right-click sails straight there.
            </div>
          )}

          <div className="row">
            {isPortal(world, fleet) && (
              <button className="primary" disabled={fleet.moves <= 0 || !canCross(game, fleet)} onClick={() => void run({ kind: 'cross', fleet: fleet.id })}
                title={canCross(game, fleet) ? '' : 'Needs an explorer'}>
                {fleet.map === 'old' ? 'Cross the Mar Océano ⟵' : 'Sail for Europe ⟶'}
              </button>
            )}
            {fleet.at && (
              <button disabled={provisionCost(world, fleet) <= 0} onClick={() => void run({ kind: 'provision', fleet: fleet.id })}>
                Provision{provisionCost(world, fleet) > 0 ? ` · ${fmt(provisionCost(world, fleet))}` : ''}
              </button>
            )}
            {fleet.at && portById(world, fleet.at)?.kind !== 'native' && (
              <button disabled={repairCost(world, fleet) <= 0} onClick={() => void run({ kind: 'repair', fleet: fleet.id })}>
                Repair{repairCost(world, fleet) > 0 ? ` · ${fmt(repairCost(world, fleet))}` : ''}
              </button>
            )}
            {others.map((o) => (
              <button key={o.id} onClick={() => void run({ kind: 'merge', from: fleet.id, into: o.id })}>Join {o.name}</button>
            ))}
            {waiting?.map((e) => (
              <button key={e.id} onClick={() => void run({ kind: 'assignExplorer', explorer: e.id, fleet: fleet.id })}>Give command to {e.name}</button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
