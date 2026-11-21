import { useState } from 'react';
import { useStore } from '../store';
import { SHIPS } from '../data/ships';
import { GOOD_INFO, GOODS, type GoodId } from '../data/goods';
import { RANK_INFO, UNIT_INFO, SKILL_INFO } from '../data/court';
import {
  cargoUsed, cargoCapacity, crewNeeded, provisionCost, repairCost, portById, provisionsMax, maxMoves, leaderOf, isPortal, canCross,
  slotsMax, slotsUsed, unitsAboard, allPorts, mainPort, routeEstimate,
} from '../sim/game';
import { SKILLS, type Fleet, type GameState, type Person, type TradeRoute, type TradeStop, type UnitType, type World } from '../sim/types';
import { fmt } from './format';
import { GoodIcon, ShipIcon } from './Icon';
import { unitPrice } from '../sim/market';
import { getView } from './MapCanvas';
import { Pips, Tabs } from './Drawers';
import { Portrait } from './theme/Portrait';
import { Art } from './theme/Art';

type FleetTab = 'command' | 'ships' | 'route';

const whereIs = (world: World, game: GameState, f: Fleet) => (f.at ? portById(world, f.at, game)?.name ?? 'in port' : f.map === 'new' ? 'the Mar Océano' : 'at sea');
const doing = (f: Fleet) => (f.route?.active ? 'on a trade route' : f.standing ? (f.standing.mode === 'explore' ? 'exploring' : f.standing.mode === 'home' ? 'going home' : 'on patrol') : f.order ? 'under sail' : f.at ? 'in port' : f.moves > 0 ? 'waiting for orders' : 'at sea');

/** The fleets as a list; choosing one opens its own page. */
export function Fleets() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const open = useStore((s) => s.fleetOpen);
  const set = useStore((s) => s.set);
  const selectFleet = useStore((s) => s.selectFleet);
  const fleet = game.fleets.find((f) => f.id === open);
  if (fleet) return <FleetPage key={fleet.id} fleet={fleet} />;
  const groups: [string, Fleet[], string][] = [
    ['Expeditions', game.fleets.filter((f) => leaderOf(game, f)?.rank === 'explorer'), 'None yet. Open a fleet below and choose an explorer to lead it.'],
    ['Trade', game.fleets.filter((f) => leaderOf(game, f)?.rank === 'merchant'), 'None yet. Open a fleet and choose a merchant to lead it.'],
    ['Without a leader', game.fleets.filter((f) => f.leader == null), 'Every fleet has a leader.'],
  ];
  return (
    <div className="fleet-index">
      {!game.fleets.length && <p className="muted">No fleets. Build a ship in a city with docks.</p>}
      {groups.filter(([, fleets]) => fleets.length > 0).map(([title, fleets, none]) => (
        <section key={title} className="fleet-group">
          <h3>{title} <span className="muted small">{fleets.length || ''}</span></h3>
          {fleets.length ? (
            <ul className="fleet-list">
              {fleets.map((f) => {
                const l = leaderOf(game, f);
                const waiting = game.people.find((p) => p.alive && p.posted === f.id);
                return (
                  <li key={f.id}>
                    <button className="fleet-line" onClick={() => { selectFleet(f.id); set({ fleetOpen: f.id }); }}>
                      <span className="ship-art"><Art slot={`ship/${f.ships[0].type}`} fallback={<ShipIcon type={f.ships[0].type} size={46} />} /></span>
                      <span className="fl-name"><b>{f.name}</b><span className="muted small">{l ? `${l.name}, ${l.rank}` : waiting ? `${waiting.name} takes command when ready` : 'no one in command'}</span></span>
                      <span className="fl-cell"><b>{f.ships.length}</b><span className="muted small">ship{f.ships.length > 1 ? 's' : ''}</span></span>
                      <span className="fl-cell"><b>{cargoUsed(f)}/{cargoCapacity(f)}</b><span className="muted small">hold</span></span>
                      <span className={`fl-cell ${f.supplies <= 2 ? 'bad' : ''}`}><b>{f.supplies}</b><span className="muted small">seasons of stores</span></span>
                      <span className="fl-where"><b>{whereIs(world, game, f)}</b><span className="muted small">{doing(f)}</span></span>
                      <span className="fl-go" aria-hidden>›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted small">{none}</p>}
        </section>
      ))}
      {game.parties.length > 0 && (
        <section className="fleet-group">
          <h3>Ashore <span className="muted small">{game.parties.length}</span></h3>
          <ul className="fleet-list">
            {game.parties.map((p) => (
              <li key={p.id}>
                <button className="fleet-line party" onClick={() => { useStore.getState().selectParty(p.id); set({ drawer: null }); setTimeout(() => getView()?.focusHex(p.map, p.hex), 0); }}>
                  <span className="ship-art"><img src={`${import.meta.env.BASE_URL}sprites/units/scout.png`} alt="" height={34} /></span>
                  <span className="fl-name"><b>{p.name}</b><span className="muted small">{game.units.filter((u) => u.party === p.id).length} units</span></span>
                  <span className="fl-where"><b>{p.order ? 'marching' : p.moves > 0 ? 'ready' : 'resting'}</b><span className="muted small">show on the map</span></span>
                  <span className="fl-go" aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One fleet: what she is doing at the top, then command, ships and trade route each on its own tab. */
function FleetPage({ fleet }: { fleet: Fleet }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [renaming, setRenaming] = useState<string | null>(null);
  const leader = leaderOf(game, fleet);
  const [tab, setTab] = useState<FleetTab>('command');
  const port = fleet.at ? portById(world, fleet.at, game) : undefined;
  const here = game.fleets.filter((f) => f !== fleet && f.map === fleet.map && f.hex === fleet.hex);
  return (
    <div className="fleet-page">
      <div className="fleet-page-head">
        <button className="back" onClick={() => set({ fleetOpen: null })}>‹ All fleets</button>
        <span className="ship-art"><Art slot={`ship/${fleet.ships[0].type}`} fallback={<ShipIcon type={fleet.ships[0].type} size={54} />} /></span>
        {renaming != null ? (
          <form className="row" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'rename', fleet: fleet.id, name: renaming }); setRenaming(null); }}>
            <input className="text" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={40} aria-label="Fleet name" />
            <button className="primary">Save</button>
            <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
          </form>
        ) : (
          <div className="fp-title">
            <h3>{fleet.name} <button className="link" onClick={() => setRenaming(fleet.name)}>rename</button></h3>
            <div className="muted">{leader ? `${leader.name}, ${leader.rank}` : 'No one in command'} · {whereIs(world, game, fleet)} · {doing(fleet)}</div>
          </div>
        )}
        <span className="spacer" />
        <button onClick={() => { set({ drawer: null }); setTimeout(() => getView()?.focusHex(fleet.map, fleet.hex), 0); }}>Show on the map</button>
      </div>

      <dl className="facts wide">
        <dt>Moves</dt><dd>{fleet.moves} / {maxMoves(fleet, game)}</dd>
        <dt>Stores</dt><dd className={fleet.supplies <= 2 ? 'bad' : ''}>{fleet.supplies} of {provisionsMax(fleet, game)} seasons</dd>
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
        {fleet.at && provisionCost(world, fleet, game) > 0 && <button onClick={() => void run({ kind: 'provision', fleet: fleet.id })}>Provision · {fmt(provisionCost(world, fleet, game))}</button>}
        {fleet.at && port?.kind !== 'native' && repairCost(world, fleet) > 0 && <button onClick={() => void run({ kind: 'repair', fleet: fleet.id })}>Repair · {fmt(repairCost(world, fleet))}</button>}
        {port && port.kind !== 'colony' && <button onClick={() => set({ drawer: 'markets', selectedPort: port.id })}>Trade in {port.name}</button>}
        {port?.kind === 'colony' && <button onClick={() => set({ drawer: 'cities', selectedColony: port.id })}>Open {port.name}</button>}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        ['command', leader ? 'Command and people' : 'Choose a leader'],
        ['ships', `Ships (${fleet.ships.length})${here.length ? ` · ${here.length} more here` : ''}`],
        ['route', `Trade route${fleet.route?.active ? ' · running' : ''}`],
      ]} />
      {tab === 'command' && <CommandTab fleet={fleet} />}
      {tab === 'ships' && <ShipsTab fleet={fleet} here={here} />}
      {tab === 'route' && (leader?.rank === 'merchant'
        ? <RouteEditor fleet={fleet} />
        : <p className="muted">Only a fleet led by a merchant can run a trade route by itself. {leader ? `${leader.name} is an explorer.` : 'Choose a merchant to lead this fleet on the first tab.'}</p>)}
    </div>
  );
}

const UNIT_CHOICES: UnitType[] = ['colonist', 'infantry', 'missionary'];

/** Who commands, who is aboard, and, with no one in command, everyone who could be: one click each. */
function CommandTab({ fleet }: { fleet: Fleet }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const leader = leaderOf(game, fleet);
  const port = fleet.at ? portById(world, fleet.at, game) : undefined;
  const home = port?.kind === 'home';
  const [unit, setUnit] = useState<UnitType>('colonist');
  const waitingUnits = home ? game.units.filter((u) => u.city === port!.id && u.fleet == null && u.party == null) : [];
  const posted = game.people.find((p) => p.alive && p.posted === fleet.id);
  const free = (p: Person) => p.alive && p.fleet == null && !game.parties.some((x) => x.leader === p.id);
  const here = home ? game.people.filter((p) => free(p) && p.city === port!.id && p.rank !== 'governor') : [];
  const best = (p: Person) => Math.max(p.skills.navigation, p.skills.commerce);
  const candidates = [...here].sort((a, b) => Number(b.rank !== 'courtier') - Number(a.rank !== 'courtier') || best(b) - best(a));
  return (
    <div className="command-tab">
      {leader ? (
        <div className="leader">
          <div><b>{leader.name}</b>, {RANK_INFO[leader.rank].name.toLowerCase()}. {leader.rank === 'explorer' ? 'May sail into unknown waters.' : 'May run a trade route.'}</div>
          <div className="skills">
            {SKILLS.map((k) => <span key={k} className="skill" title={SKILL_INFO[k].blurb}><span className="skill-name">{SKILL_INFO[k].short}</span><Pips n={leader.skills[k]} /></span>)}
          </div>
          {home && <button className="small-btn" onClick={() => void run({ kind: 'recall', fleet: fleet.id })}>Bring {leader.name.split(' ')[0]} ashore</button>}
          {!home && <span className="muted small">A leader comes ashore only in one of your own ports.</span>}
        </div>
      ) : (
        <div className="lead-pick">
          <p className="lead-note">
            <b>No one in command.</b> Without a leader she sails only charted waters{game.newWorldFound ? '' : ' and cannot cross the Mar Océano'}. An <b>explorer</b> may sail into the unknown and lead a party ashore; a <b>merchant</b> gets better prices and can run a trade route.
          </p>
          {posted && <p className="lead-posted"><b>{posted.name}</b> takes command {posted.ready > 0 ? `in ${posted.ready} season${posted.ready > 1 ? 's' : ''}` : 'as soon as the fleet lies in their port'}. <button className="link" onClick={() => void run({ kind: 'post', person: posted.id, fleet: null })}>Choose someone else</button></p>}
          {!home && <p className="muted">Leaders are chosen in one of your own ports: bring the fleet home first.</p>}
          {home && !posted && (
            <>
              <div className="row lead-unit">
                <span className="small">A new explorer brings one unit, free:</span>
                {UNIT_CHOICES.map((u) => <button key={u} className={`small-btn ${unit === u ? 'on' : ''}`} aria-pressed={unit === u} title={UNIT_INFO[u].blurb} onClick={() => setUnit(u)}>{UNIT_INFO[u].name}</button>)}
              </div>
              <ul className="lead-list">
                {candidates.map((p) => (
                  <li key={p.id} className="lead-row">
                    <span className="lead-face"><Portrait p={p} turn={game.turn} /></span>
                    <span className="lead-who"><b>{p.name}</b><span className="muted small">{RANK_INFO[p.rank].name}{p.ready > 0 ? ` · ready in ${p.ready} season${p.ready > 1 ? 's' : ''}` : ''}</span></span>
                    <span className="lead-skill" title={SKILL_INFO.navigation.blurb}>Navigation <Pips n={p.skills.navigation} /></span>
                    <span className="lead-skill" title={SKILL_INFO.commerce.blurb}>Commerce <Pips n={p.skills.commerce} /></span>
                    <span className="lead-act">
                      {p.rank === 'courtier' ? (
                        <>
                          <button className="adm-gold-btn" disabled={game.treasury < RANK_INFO.explorer.cost} title={`${RANK_INFO.explorer.cost} ducats. Ready in 2 seasons, then takes command of this fleet without being asked.`}
                            onClick={() => void run({ kind: 'promote', person: p.id, rank: 'explorer', unit, fleet: fleet.id })}>Explorer · {fmt(RANK_INFO.explorer.cost)}</button>
                          <button className="adm-gold-btn" disabled={game.treasury < RANK_INFO.merchant.cost} title={`${RANK_INFO.merchant.cost} ducats. Ready in 1 season, then takes command of this fleet without being asked.`}
                            onClick={() => void run({ kind: 'promote', person: p.id, rank: 'merchant', fleet: fleet.id })}>Merchant · {fmt(RANK_INFO.merchant.cost)}</button>
                        </>
                      ) : p.ready > 0 ? (
                        <button className="adm-gold-btn" onClick={() => void run({ kind: 'post', person: p.id, fleet: fleet.id })}>Command when ready</button>
                      ) : (
                        <button className="adm-gold-btn" onClick={() => void run({ kind: 'assignLeader', person: p.id, fleet: fleet.id })}>Give command</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {!candidates.length && <p className="muted">Nobody at court in {port!.name} is free. Hire a petitioner at Court.</p>}
            </>
          )}
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
          {!leader && !unitsAboard(game, fleet).length && <span className="muted small">No one yet.</span>}
        </div>
        {waitingUnits.length > 0 && (
          <div className="row">
            <span className="small">Waiting in {port!.name}:</span>
            {[...new Set(waitingUnits.map((u) => u.type))].map((type) => {
              const of = waitingUnits.filter((u) => u.type === type);
              return (
                <button key={type} className="small-btn" disabled={slotsUsed(game, fleet) >= slotsMax(fleet)} title={slotsUsed(game, fleet) >= slotsMax(fleet) ? 'No room aboard: add a ship on the Ships tab' : `${of.length} waiting in port`}
                  onClick={() => void run({ kind: 'embark', unit: of[0].id, fleet: fleet.id })}>
                  Embark {UNIT_INFO[type].name.toLowerCase()}{of.length > 1 ? ` (${of.length})` : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** The ships of this fleet, one by one: send one off on her own, or take in the other ships lying here. */
function ShipsTab({ fleet, here }: { fleet: Fleet; here: Fleet[] }) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const leader = leaderOf(game, fleet);
  return (
    <div className="ships-tab">
      <h4>In this fleet</h4>
      <div className="ships">
        {fleet.ships.map((s) => (
          <div key={s.id} className="ship" title={SHIPS[s.type].blurb}>
            <ShipIcon type={s.type} size={46} />
            <div>
              <div className="ship-name">{s.name}</div>
              <div className="muted small">{SHIPS[s.type].name} · hold {SHIPS[s.type].cargo} · {SHIPS[s.type].slots} place{SHIPS[s.type].slots > 1 ? 's' : ''} · {SHIPS[s.type].guns} guns</div>
              <div className="bar" title={`Hull ${s.hull}%`}><div style={{ width: `${s.hull}%` }} className={s.hull < 50 ? 'bad' : ''} /></div>
            </div>
            <button className="small-btn" disabled={fleet.ships.length < 2} title={fleet.ships.length < 2 ? 'The last ship of a fleet cannot leave it' : 'She becomes a fleet of her own, in the same place'}
              onClick={() => void run({ kind: 'split', fleet: fleet.id, ship: s.id })}>Remove from fleet</button>
          </div>
        ))}
      </div>
      <h4>Other ships lying here</h4>
      {here.length ? (
        <div className="ships">
          {here.map((o) => {
            const both = leader != null && o.leader != null;
            const full = fleet.ships.length + o.ships.length > 8;
            return (
              <div key={o.id} className="ship">
                <ShipIcon type={o.ships[0].type} size={46} />
                <div>
                  <div className="ship-name">{o.name}</div>
                  <div className="muted small">{o.ships.map((x) => SHIPS[x.type].name).join(', ')}{leaderOf(game, o) ? ` · led by ${leaderOf(game, o)!.name}` : ''}</div>
                </div>
                <button className="small-btn" disabled={both || full} title={both ? 'Both fleets have a leader: bring one ashore first' : full ? 'A fleet has at most 8 ships' : 'Her ships, cargo and people join this fleet'}
                  onClick={() => void run({ kind: 'merge', from: o.id, into: fleet.id })}>Add to this fleet</button>
              </div>
            );
          })}
        </div>
      ) : <p className="muted small">None. Fleets join when they lie in the same port or the same stretch of sea.</p>}
      <p className="muted small">New ships are built in a city with docks. <button className="link" onClick={() => set({ drawer: 'cities' })}>Open Cities</button></p>
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
