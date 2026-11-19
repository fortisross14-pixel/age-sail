import { useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { SHIPS, PORT_UPGRADE, type ShipType } from '../data/ships';
import { GOOD_INFO, GOODS, type GoodId } from '../data/goods';
import { unitPrice, buyCost, sellValue } from '../sim/market';
import {
  cargoUsed, cargoCapacity, crewNeeded, provisionCost, repairCost, portById, provisionsMax, maxMoves, explorerOf, isPortal, canCross,
  allPorts, projectCost, has, basePoints, techAvailable,
} from '../sim/game';
import { TECHS, BRANCH_NAMES, techById, type Branch } from '../data/tech';
import { dateLabel, type ProjectKind } from '../sim/types';
import { fmt } from './format';
import { GoodIcon, ShipIcon } from './Icon';
import { Sparkline } from './Sparkline';
import { getView } from './MapCanvas';
import { KIND_MARK } from './NewsFeed';

export function Drawer() {
  const drawer = useStore((s) => s.drawer);
  const set = useStore((s) => s.set);
  if (!drawer) return null;
  const title = { cities: 'Cities', markets: 'Markets', fleets: 'Fleets', court: 'Court' }[drawer];
  return (
    <aside className={`panel drawer drawer-${drawer}`} aria-label={title}>
      <header className="drawer-head">
        <h2>{title}</h2>
        <button className="close" onClick={() => set({ drawer: null })} aria-label="Close">×</button>
      </header>
      <div className="drawer-body">
        {drawer === 'fleets' && <Fleets />}
        {drawer === 'markets' && <Markets />}
        {drawer === 'cities' && <Cities />}
        {drawer === 'court' && <Court />}
      </div>
    </aside>
  );
}

function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: [T, ReactNode][] }) {
  return (
    <div className="maps tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

// ---------------- fleets ----------------

function Fleets() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const selected = useStore((s) => s.selectedFleet);
  const selectFleet = useStore((s) => s.selectFleet);
  const run = useStore((s) => s.run);
  const fleet = game.fleets.find((f) => f.id === selected);
  const explorer = fleet ? explorerOf(game, fleet) : undefined;
  const others = fleet ? game.fleets.filter((f) => f !== fleet && f.map === fleet.map && f.hex === fleet.hex) : [];
  const waiting = fleet?.at && fleet.explorer == null ? game.explorers.filter((e) => e.alive && e.waitingAt === fleet.at) : [];
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <>
      <ul className="fleet-list">
        {game.fleets.map((f) => {
          const where = f.at ? portById(world, f.at)?.name : f.order ? 'under sail' : f.map === 'new' ? 'Mar Océano' : 'at sea';
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
          {renaming != null ? (
            <form className="row" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'rename', fleet: fleet.id, name: renaming }); setRenaming(null); }}>
              <input className="text" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={40} aria-label="Fleet name" />
              <button className="primary">Save</button>
              <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
            </form>
          ) : (
            <h3>{fleet.name} <button className="link" onClick={() => setRenaming(fleet.name)}>rename</button></h3>
          )}
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
                  <div className="muted small">{SHIPS[s.type].name} · hold {SHIPS[s.type].cargo} · {SHIPS[s.type].moves} moves</div>
                  <div className="bar" title={`Hull ${s.hull}%`}><div style={{ width: `${s.hull}%` }} className={s.hull < 50 ? 'bad' : ''} /></div>
                </div>
                {fleet.ships.length > 1 && (
                  <button className="small-btn" title="Make this ship a fleet of her own" onClick={() => void run({ kind: 'split', fleet: fleet.id, ship: s.id })}>Detach</button>
                )}
              </div>
            ))}
          </div>
          <dl className="facts">
            <dt>Moves</dt><dd>{fleet.moves} / {maxMoves(fleet, game)} this season</dd>
            <dt>Supplies</dt><dd className={fleet.supplies <= 2 ? 'bad' : ''}>{fleet.supplies} of {provisionsMax(fleet, game)} seasons</dd>
            <dt>Crew</dt><dd className={fleet.crew < crewNeeded(fleet) * 0.6 ? 'bad' : ''}>{fleet.crew} / {crewNeeded(fleet)}</dd>
            <dt>Hold</dt><dd>{cargoUsed(fleet)} / {cargoCapacity(fleet)}</dd>
          </dl>
          <p className="muted small">Away from home, stores can only be refilled to half: in foreign ports, from native traders, or by anchoring a whole season off a green coast. Only a home port fills them.</p>
          {cargoUsed(fleet) > 0 && (
            <div className="cargo">
              {GOODS.filter((g) => fleet.cargo[g]).map((g) => (
                <span key={g} className="chip" title={GOOD_INFO[g].name}><GoodIcon good={g} size={20} />{fleet.cargo[g]}</span>
              ))}
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
            {fleet.at && portById(world, fleet.at)?.kind !== 'native' && (
              <button disabled={repairCost(world, fleet) <= 0} onClick={() => void run({ kind: 'repair', fleet: fleet.id })}>
                Repair{repairCost(world, fleet) > 0 ? ` · ${fmt(repairCost(world, fleet))}` : ''}
              </button>
            )}
            {others.map((o) => <button key={o.id} onClick={() => void run({ kind: 'merge', from: fleet.id, into: o.id })}>Join {o.name}</button>)}
            {waiting?.map((e) => <button key={e.id} onClick={() => void run({ kind: 'assignExplorer', explorer: e.id, fleet: fleet.id })}>Give command to {e.name}</button>)}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------- markets ----------------

function Markets() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const portId = useStore((s) => s.selectedPort);
  const set = useStore((s) => s.set);
  const [tab, setTab] = useState<'port' | 'compare'>(portId ? 'port' : 'compare');
  const known = allPorts(world).filter((p) => p.kind !== 'native' || game.discovered.includes(p.id));
  return (
    <>
      <div className="row between">
        <Tabs value={tab} onChange={setTab} tabs={[['port', 'Port'], ['compare', 'Compare prices']]} />
        {tab === 'port' && (
          <select className="text" value={portId ?? ''} onChange={(e) => set({ selectedPort: e.target.value || null })} aria-label="Port">
            <option value="">Choose a port…</option>
            {known.map((p) => <option key={p.id} value={p.id}>{p.name}{p.kind === 'native' ? ` (${p.people})` : ''}</option>)}
          </select>
        )}
      </div>
      {tab === 'port' ? (portId ? <PortMarket portId={portId} /> : <p className="muted">Choose a port, or click one on the map.</p>) : <Compare />}
    </>
  );
}

function PortMarket({ portId }: { portId: string }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const selected = useStore((s) => s.selectedFleet);
  const run = useStore((s) => s.run);
  const [qty, setQty] = useState(10);
  const port = portById(world, portId);
  if (!port) return null;
  const book = game.markets[port.id] ?? {};
  const fleet = game.fleets.find((f) => f.id === selected && f.at === port.id) ?? game.fleets.find((f) => f.at === port.id);
  const free = fleet ? cargoCapacity(fleet) - cargoUsed(fleet) : 0;
  const sp = has(game, 'bookkeeping') ? 0.04 : 0.08;
  const sub = port.kind === 'native' ? `Trading ground of the ${port.people}` : port.kind === 'home' ? 'Your city' : `Foreign market · ${port.nation}`;
  return (
    <div className="port-market">
      <h3>{port.name}</h3>
      <div className="muted small">{sub}. {port.blurb}</div>
      {fleet ? (
        <div className="row">
          <span className="small">Trading with <b>{fleet.name}</b> · {free} hold free</span>
          <span className="spacer" />
          <label className="qty">Lot {[1, 10, 50].map((q) => <button key={q} className={qty === q ? 'on' : ''} onClick={() => setQty(q)}>{q}</button>)}</label>
        </div>
      ) : <div className="muted small notice">Prices this season. Bring a fleet into port to trade.</div>}
      <table className="market">
        <thead><tr><th>Good</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Trend</th>{fleet && <><th>Hold</th><th /></>}</tr></thead>
        <tbody>
          {GOODS.filter((g) => book[g]).map((good) => {
            const m = book[good]!;
            const have = fleet?.cargo[good] ?? 0;
            const buyQ = Math.max(1, Math.min(qty, Math.floor(m.stock), free));
            const sellQ = Math.max(1, Math.min(qty, have));
            const hist = m.history;
            return (
              <tr key={good} title={GOOD_INFO[good].blurb}>
                <td className="good"><GoodIcon good={good} />{GOOD_INFO[good].name}</td>
                <td className="num">{fmt(unitPrice(m) * (1 + sp))}</td>
                <td className="num">{fmt(unitPrice(m) * (1 - sp))}</td>
                <td className="num">{fmt(m.stock)}</td>
                <td className={hist.length > 1 && hist[hist.length - 1] < hist[hist.length - 2] ? 'down' : 'up'}><Sparkline values={hist} /></td>
                {fleet && (
                  <>
                    <td className="num">{have || '–'}</td>
                    <td className="trade">
                      <button disabled={free <= 0 || m.stock < 1} title={`Buy ${buyQ} for ${fmt(buyCost(m, buyQ, sp))}`} onClick={() => void run({ kind: 'buy', fleet: fleet.id, good, qty })}>Buy {buyQ}</button>
                      <button disabled={!have} title={have ? `Sell ${sellQ} for ${fmt(sellValue(m, sellQ, sp))}` : ''} onClick={() => void run({ kind: 'sell', fleet: fleet.id, good, qty })}>Sell {sellQ}</button>
                      <button disabled={!have} onClick={() => void run({ kind: 'sell', fleet: fleet.id, good, qty: have })}>All</button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="muted small">Every lot moves the price: spread big cargoes across ports.</div>
    </div>
  );
}

function Compare() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const known = allPorts(world).filter((p) => p.kind !== 'native' || game.discovered.includes(p.id));
  const best = (g: GoodId, hi: boolean) => {
    const vals = known.map((p) => game.markets[p.id]?.[g]).filter(Boolean).map((m) => unitPrice(m!));
    return vals.length ? (hi ? Math.max(...vals) : Math.min(...vals)) : 0;
  };
  return (
    <div className="compare">
      <p className="muted small">Selling price in each known port this season. Gold marks the best place to sell, blue the cheapest to buy.</p>
      <div className="compare-scroll">
        <table className="market">
          <thead>
            <tr><th>Port</th>{GOODS.map((g) => <th key={g} title={GOOD_INFO[g].name}><GoodIcon good={g} size={22} /></th>)}</tr>
          </thead>
          <tbody>
            {known.map((p) => (
              <tr key={p.id}>
                <td><button className="link" onClick={() => set({ selectedPort: p.id })}>{p.name}</button></td>
                {GOODS.map((g) => {
                  const m = game.markets[p.id]?.[g];
                  if (!m) return <td key={g} className="num muted">–</td>;
                  const v = unitPrice(m);
                  const cls = v === best(g, true) ? 'best' : v === best(g, false) ? 'cheap' : '';
                  return <td key={g} className={`num ${cls}`}>{fmt(v)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- cities ----------------

function Cities() {
  const game = useStore((s) => s.game)!;
  return <>{Object.keys(game.cities).map((id) => <CityCard key={id} cityId={id} />)}</>;
}

function CityCard({ cityId }: { cityId: string }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [open, setOpen] = useState(cityId === 'seville');
  const city = game.cities[cityId];
  const port = portById(world, cityId)!;
  const p = city.project;
  const waiting = game.explorers.filter((e) => e.alive && e.waitingAt === cityId);
  const docked = game.fleets.filter((f) => f.at === cityId);
  const start = (project: ProjectKind) => void run({ kind: 'project', city: cityId, project });
  const projectName = (k: ProjectKind) => (k.kind === 'ship' ? `a ${SHIPS[k.ship].name.toLowerCase()}` : k.kind === 'port' ? 'harbour works' : 'an explorer');
  const up = PORT_UPGRADE[city.port + 1];
  return (
    <section className="city-card">
      <button className="city-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="city-name">{port.name}</span>
        <span className="muted small">port level {city.port} · {p ? `building ${projectName(p)}, ${p.turnsLeft} season${p.turnsLeft > 1 ? 's' : ''} left` : 'yards idle'}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="city-body">
          {p && <div className="bar"><div style={{ width: `${((p.total - p.turnsLeft) / p.total) * 100}%` }} /></div>}
          <div className="row small">
            {docked.length ? <>In port: {docked.map((f) => f.name).join(', ')}</> : <span className="muted">No fleets in port.</span>}
            {waiting.length > 0 && <> · Waiting: {waiting.map((e) => e.name).join(', ')}</>}
            <span className="spacer" />
            <button className="link" onClick={() => set({ drawer: 'markets', selectedPort: cityId })}>Market</button>
          </div>
          <div className="offers">
            {(Object.keys(SHIPS) as ShipType[]).map((t) => {
              const c = projectCost({ kind: 'ship', ship: t }, city.port);
              return (
                <div key={t} className="offer" title={SHIPS[t].blurb}>
                  <ShipIcon type={t} size={52} />
                  <div>
                    <b>{SHIPS[t].name}</b> · {fmt(c.cost)} · {c.build} seasons
                    <div className="muted small">Hold {SHIPS[t].cargo}, {SHIPS[t].moves} moves, food for {SHIPS[t].provisions} seasons, upkeep {SHIPS[t].upkeep}.</div>
                    <button disabled={!!p || !c.allowed || game.treasury < c.cost} title={c.why ?? ''} onClick={() => start({ kind: 'ship', ship: t })}>{c.allowed ? 'Build' : c.why}</button>
                  </div>
                </div>
              );
            })}
            <div className="offer">
              <div className="offer-mark" aria-hidden>⚓</div>
              <div>
                <b>Enlarge the port</b>{up ? ` · ${fmt(up.cost)} · ${up.build} seasons` : ''}
                <div className="muted small">{up ? up.blurb : 'The harbour is as large as it can be.'}</div>
                <button disabled={!!p || !up || game.treasury < (up?.cost ?? 0)} onClick={() => start({ kind: 'port' })}>Begin works</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------- court ----------------

function Court() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const tab = useStore((s) => s.courtTab);
  const setTab = (t: 'people' | 'research' | 'chronicle') => useStore.getState().set({ courtTab: t });
  const seville = game.cities.seville;
  const cost = projectCost({ kind: 'explorer' }, seville?.port ?? 1).cost;
  let lastTurn = -1;
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[['people', 'People'], ['research', 'Research'], ['chronicle', 'Chronicle']]} />
      {tab === 'research' ? <Research /> : tab === 'people' ? (
        <>
          <ul className="people">
            {game.explorers.map((e) => {
              const fleet = e.fleet != null ? game.fleets.find((f) => f.id === e.fleet) : undefined;
              const status = !e.alive ? 'Lost at sea' : fleet ? `Leading ${fleet.name}` : e.waitingAt ? `Waiting in ${portById(world, e.waitingAt)?.name}` : 'At court';
              return (
                <li key={e.id} className={e.alive ? '' : 'dead'}>
                  <img src={`${import.meta.env.BASE_URL}sprites/units/scout.png`} alt="" width={36} />
                  <div>
                    <b>{e.name}</b> <span className="muted small">explorer</span>
                    <div className="small">{status}{e.discoveries ? ` · ${Math.round(e.discoveries)} hexes of new land charted` : ''}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="offer">
            <div className="offer-mark" aria-hidden>✦</div>
            <div>
              <b>Recruit an explorer in Sevilla</b> · {fmt(cost)} · 1 season
              <div className="muted small">Only fleets led by an explorer may sail into uncharted waters. Merchants, missionaries, soldiers and colonists join the court in a later version.</div>
              <button disabled={!!seville?.project || game.treasury < cost} title={seville?.project ? 'Sevilla’s yards are busy' : ''}
                onClick={() => void run({ kind: 'project', city: 'seville', project: { kind: 'explorer' } })}>Recruit</button>
            </div>
          </div>
        </>
      ) : (
        <div className="entries">
          {[...game.chronicle].reverse().map((c, i) => {
            const head = c.turn !== lastTurn;
            lastTurn = c.turn;
            return (
              <div key={i}>
                {head && <div className="chron-date">{dateLabel(c.turn)}</div>}
                <p className={`entry ${c.kind}`}><span className="mark" aria-hidden>{KIND_MARK[c.kind]}</span>{c.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Research() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const r = game.research;
  const cur = r.current ? techById(r.current) : null;
  return (
    <div className="research">
      <div className="research-now">
        {cur ? (
          <>
            <div>Studying <b>{cur.name}</b>: {Math.floor(r.progress)} of {cur.cost}</div>
            <div className="bar"><div style={{ width: `${Math.min(100, (r.progress / cur.cost) * 100)}%` }} /></div>
          </>
        ) : <div>The scholars are idle. Choose a subject below.</div>}
        <div className="muted small">The court yields {basePoints(game)} points a season. New coasts, peoples and lands charted by your explorers add more.</div>
      </div>
      {(['navigation', 'commerce', 'state'] as Branch[]).map((b) => (
        <section key={b}>
          <h3>{BRANCH_NAMES[b]}</h3>
          <div className="techs">
            {TECHS.filter((t) => t.branch === b).map((t) => {
              const known = has(game, t.id);
              const open = techAvailable(game, t.id);
              const now = r.current === t.id;
              return (
                <div key={t.id} className={`tech ${known ? 'known' : open ? 'open' : 'locked'} ${now ? 'now' : ''}`}>
                  <div className="tech-head"><b>{t.name}</b><span className="muted small">{known ? 'known' : `${t.cost} points`}</span></div>
                  <div className="small">{t.effect}</div>
                  <div className="muted small"><i>{t.blurb}</i></div>
                  {!known && t.requires.length > 0 && <div className="muted small">Needs {t.requires.map((x) => techById(x).name).join(' and ')}.</div>}
                  {!known && open && !now && <button onClick={() => void run({ kind: 'research', tech: t.id })}>Study this</button>}
                  {now && <div className="small"><b>Being studied</b></div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
