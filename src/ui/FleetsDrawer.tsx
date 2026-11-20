import { useState } from 'react';
import { useStore } from '../store';
import { SHIPS } from '../data/ships';
import { GOOD_INFO, GOODS, type GoodId } from '../data/goods';
import { RANK_INFO, UNIT_INFO, SKILL_INFO } from '../data/court';
import {
  cargoUsed, cargoCapacity, crewNeeded, provisionCost, repairCost, portById, provisionsMax, maxMoves, leaderOf, isPortal, canCross,
  slotsMax, slotsUsed, unitsAboard, allPorts, mainPort, routeEstimate,
} from '../sim/game';
import { SKILLS, type Fleet, type TradeRoute, type TradeStop } from '../sim/types';
import { fmt } from './format';
import { GoodIcon, ShipIcon } from './Icon';
import { unitPrice } from '../sim/market';
import { getView } from './MapCanvas';
import { Pips } from './Drawers';
import { Art } from './theme/Art';

export function Fleets() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const selected = useStore((s) => s.selectedFleet);
  const selectFleet = useStore((s) => s.selectFleet);
  const fleet = game.fleets.find((f) => f.id === selected) ?? game.fleets[0];
  const groups: [string, Fleet[]][] = [
    ['Expeditions', game.fleets.filter((f) => leaderOf(game, f)?.rank === 'explorer')],
    ['Trade', game.fleets.filter((f) => leaderOf(game, f)?.rank === 'merchant')],
    ['Idle ships', game.fleets.filter((f) => f.leader == null)],
  ];
  return (
    <div className="split">
      <div className="split-list">
      {groups.map(([title, fleets]) => (
        <section key={title} className="fleet-group">
          <h3>{title} <span className="muted small">{fleets.length || ''}</span></h3>
          {fleets.length ? (
            <ul className="fleet-list">
              {fleets.map((f) => {
                const where = f.at ? portById(world, f.at, game)?.name : f.order ? 'under sail' : f.map === 'new' ? 'Mar Océano' : 'at sea';
                const l = leaderOf(game, f);
                return (
                  <li key={f.id}>
                    <button className={`fleet-row ${f.id === fleet?.id ? 'sel' : ''}`} onClick={() => { selectFleet(f.id); setTimeout(() => getView()?.focusHex(f.map, f.hex), 0); }}>
                      <span className="ship-art"><Art slot={`ship/${f.ships[0].type}`} fallback={<ShipIcon type={f.ships[0].type} size={46} />} /></span>
                      <span className="fleet-name">{f.name}<span className="muted small">{l ? ` · ${l.name}` : ` · ${f.ships.length} ship${f.ships.length > 1 ? 's' : ''}`}</span></span>
                      <span className="fleet-where">{where}{f.route?.active ? ' · on route' : f.moves > 0 && !f.at && !f.order ? ' · ready' : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted small">{title === 'Expeditions' ? 'None yet. Make a courtier an explorer and give them a fleet.' : title === 'Trade' ? 'Make a courtier a merchant to run trade routes.' : 'Every ship has a leader.'}</p>}
        </section>
      ))}
      {game.parties.length > 0 && (
        <section className="fleet-group">
          <h3>Ashore <span className="muted small">{game.parties.length}</span></h3>
          <ul className="fleet-list">
            {game.parties.map((p) => (
              <li key={p.id}>
                <button className="fleet-row" onClick={() => { useStore.getState().selectParty(p.id); setTimeout(() => getView()?.focusHex(p.map, p.hex), 0); }}>
                  <img src={`${import.meta.env.BASE_URL}sprites/units/scout.png`} alt="" height={34} />
                  <span className="fleet-name">{p.name}<span className="muted small"> · {game.units.filter((u) => u.party === p.id).length} units</span></span>
                  <span className="fleet-where">{p.order ? 'marching' : p.moves > 0 ? 'ready' : 'resting'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
      <div className="split-detail detail-card">
        {fleet ? <FleetDetail key={fleet.id} fleet={fleet} /> : <p className="muted">No fleets. Build a ship in a city with docks.</p>}
      </div>
    </div>
  );
}

function FleetDetail({ fleet }: { fleet: Fleet }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [renaming, setRenaming] = useState<string | null>(null);
  const leader = leaderOf(game, fleet);
  const others = game.fleets.filter((f) => f !== fleet && f.map === fleet.map && f.hex === fleet.hex);
  const port = fleet.at ? portById(world, fleet.at, game) : undefined;
  const home = port?.kind === 'home';
  const waitingUnits = home ? game.units.filter((u) => u.city === port!.id && u.fleet == null && u.party == null) : [];
  const ready = home && !leader ? game.people.filter((p) => p.alive && p.fleet == null && p.city === port!.id && p.ready === 0 && (p.rank === 'explorer' || p.rank === 'merchant')) : [];
  return (
    <div className="fleet-detail">
      {renaming != null ? (
        <form className="row" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'rename', fleet: fleet.id, name: renaming }); setRenaming(null); }}>
          <input className="text" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={40} aria-label="Fleet name" />
          <button className="primary">Save</button>
          <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
        </form>
      ) : (
        <h3>{fleet.name} <button className="link" onClick={() => setRenaming(fleet.name)}>rename</button></h3>
      )}

      {leader ? (
        <div className="leader">
          <div><b>{leader.name}</b>, {RANK_INFO[leader.rank].name.toLowerCase()}. {leader.rank === 'explorer' ? 'May sail into unknown waters.' : 'May run a trade route.'}</div>
          <div className="skills">
            {SKILLS.map((k) => <span key={k} className="skill" title={SKILL_INFO[k].blurb}><span className="skill-name">{SKILL_INFO[k].short}</span><Pips n={leader.skills[k]} /></span>)}
          </div>
          {home && <button className="small-btn" onClick={() => void run({ kind: 'recall', fleet: fleet.id })}>Bring {leader.name.split(' ')[0]} ashore</button>}
        </div>
      ) : (
        <div className="leader none">
          No one in command. May only sail charted waters{game.newWorldFound ? '' : ' and cannot cross the Mar Océano'}.
          {ready.map((p) => (
            <button key={p.id} className="small-btn" onClick={() => void run({ kind: 'assignLeader', person: p.id, fleet: fleet.id })}>Give command to {p.name}</button>
          ))}
          {!ready.length && <button className="link" onClick={() => set({ drawer: 'court', courtTab: 'people' })}>Choose someone at court</button>}
        </div>
      )}

      <div className="slots">
        <b>Aboard</b> <span className="muted small">{slotsUsed(game, fleet)} of {slotsMax(fleet)} places (caravel 1, carrack 2, galleon 4; the leader takes one)</span>
        {(fleet.captives ?? 0) > 0 && <div className="small">{fleet.captives} captives in the hold. About one in ten dies each season at sea.</div>}
        <div className="row">
          {leader && <span className="chip">✦ {leader.name.split(' ')[0]}</span>}
          {unitsAboard(game, fleet).map((u) => (
            <span key={u.id} className="chip" title={UNIT_INFO[u.type].blurb}>
              <img src={`${import.meta.env.BASE_URL}sprites/${UNIT_INFO[u.type].sprite}.png`} alt="" height={20} />{UNIT_INFO[u.type].name}
              {home && <button className="x-inline" onClick={() => void run({ kind: 'disembark', unit: u.id })} title="Go ashore" aria-label="Go ashore">↧</button>}
            </span>
          ))}
          {[...new Set(waitingUnits.map((u) => u.type))].map((type) => {
            const of = waitingUnits.filter((u) => u.type === type);
            return (
              <button key={type} className="small-btn" title={`${of.length} waiting in port`} onClick={() => void run({ kind: 'embark', unit: of[0].id, fleet: fleet.id })}>
                Embark {UNIT_INFO[type].name.toLowerCase()}{of.length > 1 ? ` (${of.length} waiting)` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ships">
        {fleet.ships.map((s) => (
          <div key={s.id} className="ship" title={SHIPS[s.type].blurb}>
            <ShipIcon type={s.type} size={46} />
            <div>
              <div className="ship-name">{s.name}</div>
              <div className="muted small">{SHIPS[s.type].name} · hold {SHIPS[s.type].cargo} · {SHIPS[s.type].slots} place{SHIPS[s.type].slots > 1 ? 's' : ''}</div>
              <div className="bar" title={`Hull ${s.hull}%`}><div style={{ width: `${s.hull}%` }} className={s.hull < 50 ? 'bad' : ''} /></div>
            </div>
            {fleet.ships.length > 1 && <button className="small-btn" title="Make this ship a fleet of her own" onClick={() => void run({ kind: 'split', fleet: fleet.id, ship: s.id })}>Detach</button>}
          </div>
        ))}
      </div>
      <dl className="facts">
        <dt>Moves</dt><dd>{fleet.moves} / {maxMoves(fleet, game)} this season</dd>
        <dt>Supplies</dt><dd className={fleet.supplies <= 2 ? 'bad' : ''}>{fleet.supplies} of {provisionsMax(fleet, game)} seasons</dd>
        <dt>Crew</dt><dd className={fleet.crew < crewNeeded(fleet) * 0.6 ? 'bad' : ''}>{fleet.crew} / {crewNeeded(fleet)}</dd>
        <dt>Hold</dt><dd>{cargoUsed(fleet)} / {cargoCapacity(fleet)}</dd>
      </dl>
      {cargoUsed(fleet) > 0 && (
        <div className="cargo">
          {GOODS.filter((g) => fleet.cargo[g]).map((g) => <span key={g} className="chip" title={GOOD_INFO[g].name}><GoodIcon good={g} size={20} />{fleet.cargo[g]}</span>)}
        </div>
      )}
      <div className="row">
        {isPortal(world, fleet) && (
          <button className="primary" disabled={fleet.moves <= 0 || !canCross(game, fleet)} onClick={() => void run({ kind: 'cross', fleet: fleet.id })}>
            {fleet.map === 'old' ? 'Cross the Mar Océano ⟵' : 'Sail for Europe ⟶'}
          </button>
        )}
        {fleet.order && <button onClick={() => void run({ kind: 'cancelOrder', fleet: fleet.id })}>Cancel orders</button>}
        {fleet.at && (
          <button disabled={provisionCost(world, fleet, game) <= 0} onClick={() => void run({ kind: 'provision', fleet: fleet.id })}>
            Provision{provisionCost(world, fleet, game) > 0 ? ` · ${fmt(provisionCost(world, fleet, game))}` : ''}
          </button>
        )}
        {fleet.at && port?.kind !== 'native' && (
          <button disabled={repairCost(world, fleet) <= 0} onClick={() => void run({ kind: 'repair', fleet: fleet.id })}>
            Repair{repairCost(world, fleet) > 0 ? ` · ${fmt(repairCost(world, fleet))}` : ''}
          </button>
        )}
        {others.map((o) => <button key={o.id} onClick={() => void run({ kind: 'merge', from: fleet.id, into: o.id })}>Join {o.name}</button>)}
      </div>
      <p className="muted small">Away from home, stores refill only to half: in foreign ports, from native traders, or by anchoring a whole season off a green coast.</p>
      {leader?.rank === 'merchant' && <RouteEditor fleet={fleet} />}
    </div>
  );
}

const emptyStop = (port: string): TradeStop => ({ port, sell: [], buy: [] });

function RouteEditor({ fleet }: { fleet: Fleet }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const known = [...allPorts(world).filter((p) => p.map === fleet.map && !p.inland && (p.kind !== 'native' || game.discovered.includes(p.id))),
    ...game.colonies.filter((c) => c.map === fleet.map).map((c) => ({ id: c.id, name: `${c.name} (colony)` }))];
  const [draft, setDraft] = useState<TradeRoute>(() => fleet.route ?? { stops: [emptyStop(fleet.at ?? mainPort(game)), emptyStop(known.find((p) => p.id !== (fleet.at ?? mainPort(game)))?.id ?? 'antwerp')], next: 0, active: false });
  const update = (k: number, st: TradeStop) => setDraft({ ...draft, stops: draft.stops.map((x, i) => (i === k ? st : x)) });
  const save = (active: boolean) => void run({ kind: 'tradeRoute', fleet: fleet.id, route: { ...draft, active } });
  return (
    <section className="route">
      <h3>Trade route</h3>
      <p className="muted small">The fleet sails the stops in order, again and again: it sells what you tick, then buys up to the amount you set, never above the price limit. It provisions in every port.</p>
      {draft.stops.map((st, k) => {
        const colony = game.colonies.find((c) => c.id === st.port);
        const book = game.markets[st.port] ?? {};
        const goods = colony ? GOODS : GOODS.filter((g) => book[g]);
        return (
          <div key={k} className={`stop ${fleet.route?.active && fleet.route.next === k ? 'next' : ''}`}>
            <div className="row between">
              <select className="text" value={st.port} onChange={(e) => update(k, emptyStop(e.target.value))} aria-label={`Stop ${k + 1}`}>
                {known.map((p) => <option key={p.id} value={p.id}>{k + 1}. {p.name}</option>)}
              </select>
              {draft.stops.length > 2 && <button className="small-btn" onClick={() => setDraft({ ...draft, stops: draft.stops.filter((_, i) => i !== k) })}>Remove</button>}
            </div>
            <div className="stop-goods">
              {goods.map((g) => {
                const sells = st.sell.includes(g);
                const b = st.buy.find((x) => x.good === g);
                return (
                  <div key={g} className="stop-good">
                    <GoodIcon good={g} size={20} /><span>{GOOD_INFO[g].name}</span>
                    <span className="muted small num">{colony ? Math.floor(colony.stock[g] ?? 0) : fmt(unitPrice(book[g]!))}</span>
                    <label className="small"><input type="checkbox" checked={sells} onChange={() => update(k, { ...st, sell: sells ? st.sell.filter((x) => x !== g) : [...st.sell, g] })} /> {colony ? 'unload' : 'sell'}</label>
                    <label className="small">{colony ? 'load' : 'buy'}
                      <input className="num-in" type="number" min={0} step={10} value={b?.qty ?? 0}
                        onChange={(e) => {
                          const qty = Math.max(0, Number(e.target.value) || 0);
                          const rest = st.buy.filter((x) => x.good !== g);
                          update(k, { ...st, buy: qty ? [...rest, { good: g as GoodId, qty, maxPrice: b?.maxPrice ?? null }] : rest });
                        }} />
                    </label>
                    {b && (
                      <label className="small">≤
                        <input className="num-in" type="number" min={0} placeholder="any" value={b.maxPrice ?? ''}
                          onChange={(e) => update(k, { ...st, buy: st.buy.map((x) => (x.good === g ? { ...x, maxPrice: e.target.value ? Number(e.target.value) : null } : x)) })} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="row">
        <button onClick={() => setDraft({ ...draft, stops: [...draft.stops, emptyStop(known[0].id)] })}>Add a stop</button>
        {(() => { const e = routeEstimate(world, game, fleet, draft); return e && <span className={`small ${e.profit < 0 ? 'bad' : ''}`} title="One round of the stops as set, at today’s prices, once the hold is turning over. Prices move as you trade.">About {e.profit >= 0 ? '+' : '−'}{fmt(Math.abs(e.profit))} ducats a round · {e.seasons} season{e.seasons > 1 ? 's' : ''}</span>; })()}
        <span className="spacer" />
        {fleet.route?.active
          ? <button onClick={() => save(false)}>Pause route</button>
          : <button className="primary" onClick={() => save(true)}>Start route</button>}
        {fleet.route && <button onClick={() => void run({ kind: 'tradeRoute', fleet: fleet.id, route: null })}>Clear</button>}
      </div>
    </section>
  );
}
