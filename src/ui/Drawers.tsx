import { useEffect, useState, type ReactNode } from 'react';
import { useStore, type DrawerId } from '../store';
import { factoryAt, factoryCost, factoryPace, demandFactor, shocksIn, shockTitle } from '../sim/trade';
import { FACTORY, REGION_NAME, type Region } from '../data/trade';
import { turnLabel } from '../sim/types';
import type { GameState, World } from '../sim/types';
import { realmSpec } from '../data/realms';
import { Frame } from './theme/Frame';
import { PortScreen } from './PortScreen';
import { Medal, CrestArt } from './theme/Art';
import { Icon, type IconName } from './theme/icons';
import { sfx } from './sound';
import { GOOD_INFO, GOODS, type GoodId } from '../data/goods';
import { unitPrice, buyCost, sellValue } from '../sim/market';
import { cargoUsed, cargoCapacity, portById, allPorts, spreadFor, storesAt, storesTrade } from '../sim/game';
import { fmt } from './format';
import { GoodIcon } from './Icon';
import { Sparkline } from './Sparkline';
import { Fleets } from './FleetsDrawer';
import { Cities } from './CityScreen';
import { Court, Diplomacy, Research, Chronicle } from './CourtDrawer';
import { StepHint } from './Guidance';
import { FirstHint } from './More';
import { CaptivesRow } from './Late';

const HEADS: Record<Exclude<DrawerId, 'cities' | 'port'>, { title: string; icon: IconName; sub: (g: GameState) => string }> = {
  markets: { title: 'Markets', icon: 'markets', sub: () => 'Prices in every port you know' },
  fleets: { title: 'Fleets', icon: 'fleets', sub: (g) => `${g.fleets.length} fleet${g.fleets.length === 1 ? '' : 's'} · ${g.parties.length} part${g.parties.length === 1 ? 'y' : 'ies'} ashore` },
  diplomacy: { title: 'Diplomacy', icon: 'diplomacy', sub: (g) => `${Object.values(g.natives).filter((n) => n.met).length} peoples met · ${Object.values(g.europe).filter((r) => r.treaty !== 'none').length} treaties · ${g.euroWars.length} war${g.euroWars.length === 1 ? '' : 's'} in Europe` },
  court: { title: 'Court', icon: 'court', sub: (g) => `${g.people.filter((p) => p.alive).length} courtiers · ${g.petitioners.length} petitioner${g.petitioners.length === 1 ? '' : 's'} waiting` },
  research: { title: 'Research', icon: 'research', sub: (g) => `${g.research.known.length} subject${g.research.known.length === 1 ? '' : 's'} mastered` },
  chronicle: { title: 'Chronicle', icon: 'chronicle', sub: () => 'What has happened in your reign' },
};

/** Which first-time hint belongs to the screen and tab in view. */
const hintFor = (shown: DrawerId, s: { courtTab: string; researchTab: string }) => (shown === 'diplomacy' ? 'diplomacy' : shown === 'court' && s.courtTab === 'dynasty' ? 'dynasty' : shown === 'research' && s.researchTab !== 'subjects' ? s.researchTab : null);

/** A screen over everything (HUD included): one at a time; closing returns to the map. */
export function Drawer() {
  const drawer = useStore((s) => s.drawer);
  const game = useStore((s) => s.game)!;
  const set = useStore((s) => s.set);
  const [shown, setShown] = useState<DrawerId | null>(drawer);
  const [leaving, setLeaving] = useState(false);
  const [shine, setShine] = useState(0);
  const [entering, setEntering] = useState(true);
  useStore((s) => `${s.courtTab}|${s.researchTab}`); // the hint follows the tab
  // the keyboard goes with the screen: focus moves into it when it opens
  useEffect(() => { if (drawer) setTimeout(() => document.querySelector<HTMLElement>('.drawer .adm-close')?.focus({ preventScroll: true }), 80); }, [drawer]);
  useEffect(() => {
    if (drawer && drawer !== shown) {
      sfx(shown ? 'page' : 'open');
      setEntering(!shown);
      setShown(drawer); setLeaving(false);
      const t = setTimeout(() => { setShine((n) => n + 1); setEntering(false); }, shown ? 60 : 560);
      return () => clearTimeout(t);
    }
    if (!drawer && shown) {
      sfx('close');
      setLeaving(true);
      const t = setTimeout(() => { setShown(null); setLeaving(false); }, 320);
      return () => clearTimeout(t);
    }
  }, [drawer]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const head = shown === 'cities' || shown === 'port' ? null : HEADS[shown];
  return (
    <>
    <div className={`screen-back ${leaving ? 'leave' : ''}`} onClick={() => set({ drawer: null })} aria-hidden />
    <Frame className={`panel drawer drawer-${shown} ${leaving ? 'leave' : entering ? 'enter' : ''} ${shine ? `shine-${shine % 2}` : ''}`} aria-label={head?.title ?? 'Cities'} role="complementary">
      <button className="adm-medal adm-close" onClick={() => set({ drawer: null })} aria-label="Close" title="Close (Esc)"><Icon name="close" size={20} /></button>
      {head && (
        <header className="drawer-head">
          <span className="adm-medal" aria-hidden><Medal name={head.icon} size={60} fallback={<Icon name={head.icon} size={26} />} /></span>
          <div><h2>{head.title}</h2><div className="sub">{head.sub(game)}</div></div>
        </header>
      )}
      <StepHint screen={shown} />
      <FirstHint id={hintFor(shown, useStore.getState())} />
      <div className="drawer-body" key={shown}>
        {shown === 'fleets' && <Fleets />}
        {shown === 'markets' && <Markets />}
        {shown === 'cities' && <Cities />}
        {shown === 'port' && <PortScreen />}
        {shown === 'court' && <Court />}
        {shown === 'diplomacy' && <Diplomacy />}
        {shown === 'research' && <Research />}
        {shown === 'chronicle' && <Chronicle />}
      </div>
    </Frame>
    </>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: [T, ReactNode][] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => { if (id !== value) { sfx('tab'); onChange(id); } }}>{label}</button>
      ))}
    </div>
  );
}

/** Five pips for a skill. */
export function Pips({ n, max = 5 }: { n: number; max?: number }) {
  return <span className="pips" aria-label={`${n} of ${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}

// ---------------- markets ----------------

function Markets() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const portId = useStore((s) => s.selectedPort);
  const set = useStore((s) => s.set);
  const [tab, setTab] = useState<'port' | 'compare'>('port');
  const known = allPorts(world).filter((p) => !p.inland && (p.kind !== 'native' || game.discovered.includes(p.id)));
  const current = known.find((p) => p.id === portId) ?? known.find((p) => p.id === game.fleets.find((f) => f.at)?.at) ?? known[0];
  const groups: [string, typeof known][] = [
    ['Your ports', known.filter((p) => p.kind === 'home')],
    ['Foreign ports', known.filter((p) => p.kind === 'foreign')],
    ['Trading grounds', known.filter((p) => p.kind === 'native')],
  ];
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[['port', 'Ports'], ['compare', 'Compare prices']]} />
      {tab === 'compare' ? <Compare /> : (
        <div className="split">
          <div className="split-list">
            {groups.filter(([, ps]) => ps.length).map(([title, ps]) => (
              <section key={title} className="fleet-group">
                <h3>{title} <span className="muted small">{ps.length}</span></h3>
                <ul className="fleet-list">
                  {ps.map((p) => {
                    const docked = game.fleets.filter((f) => f.at === p.id).length;
                    return (
                      <li key={p.id}>
                        <button className={`fleet-row ${p.id === current?.id ? 'sel' : ''}`} onClick={() => { sfx('select'); set({ selectedPort: p.id }); }}>
                          {p.realm ? <CrestArt realm={p.realm} size={34} fallback={<span className="crown-flag" style={{ background: hexColor(realmSpec(p.realm).color), borderColor: '#2a1806' }} aria-hidden />} /> : <span className="crown-flag native" aria-hidden />}
                          <span className="fleet-name">{p.name}<span className="muted small">{p.kind === 'native' ? ` · the ${p.people}` : p.kind === 'foreign' ? ` · ${p.nation}` : ''}</span></span>
                          <span className="fleet-where">{factoryAt(game, p.id) ? <span className="chip">factory</span> : null}{(() => { const st = storesAt(game, p.id); const n = st ? Object.values(st).reduce((t, v) => t + Math.floor(v ?? 0), 0) : 0; return n > 0 ? <span className="chip" title="Goods in your stores here">{n} kept</span> : null; })()}{docked ? `${docked} fleet${docked > 1 ? 's' : ''} in port` : ''}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          <div className="split-detail detail-card">{current ? <PortMarket key={current.id} portId={current.id} /> : <p className="muted">No markets known yet.</p>}</div>
        </div>
      )}
    </>
  );
}

/** Where a good sells for most among the ports you know on a map, at today's prices. */
function bestPort(game: GameState, world: World, good: GoodId, map: string) {
  let out: { id: string; name: string; price: number } | null = null;
  for (const p of allPorts(world)) {
    if (p.map !== map || p.inland || (p.kind === 'native' && !game.discovered.includes(p.id))) continue;
    const m = game.markets[p.id]?.[good];
    if (m && (!out || unitPrice(m) > out.price)) out = { id: p.id, name: p.name, price: unitPrice(m) };
  }
  return out;
}

const hexColor = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function PortMarket({ portId, bare = false }: { portId: string; bare?: boolean }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const selected = useStore((s) => s.selectedFleet);
  const run = useStore((s) => s.run);
  const openWindow = useStore((s) => s.openWindow);
  const [qty, setQty] = useState(10);
  const port = portById(world, portId);
  const docked = game.fleets.filter((f) => f.at === portId);
  const hasStores = storesTrade(game, portId);
  // what you trade from here is always shown and always yours to choose: your stores if you keep any,
  // otherwise the ship you have selected, or the only one in port
  const [from, setFrom] = useState<'stores' | number | null>(() => hasStores ? 'stores' : docked.find((f) => f.id === selected)?.id ?? (docked.length === 1 ? docked[0].id : null));
  if (!port) return null;
  const book = game.markets[port.id] ?? {};
  const fleet = typeof from === 'number' ? docked.find((f) => f.id === from) : undefined;
  const stores = from === 'stores' && hasStores ? storesAt(game, port.id) ?? {} : null;
  const trading = !!fleet || !!stores;
  const free = fleet ? cargoCapacity(fleet) - cargoUsed(fleet) : stores ? Infinity : 0;
  const sp = stores ? spreadFor(game, undefined, false, port.id) + (port.kind === 'foreign' ? FACTORY.foreignDues : 0) : spreadFor(game, fleet, port.kind === 'native');
  const factory = factoryAt(game, port.id);
  const pacePreview = book.sugar ? factoryPace(book.sugar) : FACTORY.minPace;
  const sub = port.kind === 'native' ? `Trading ground of the ${port.people}` : port.kind === 'home' ? 'Your city' : `Foreign market · ${port.nation}`;
  const where = factory ? 'your factor’s warehouse' : `your stores in ${port.name}`;
  return (
    <div className="port-market">
      {!bare && <><h3>{port.name}</h3>
      <div className="muted small">{sub}. {port.blurb}</div></>}
      {(hasStores || docked.length > 0) ? (
        <div className="trade-from">
          <span className="small"><b>Trading from</b></span>
          <span className="stance" role="radiogroup" aria-label="Trade from">
            {hasStores && <button role="radio" aria-checked={from === 'stores'} className={from === 'stores' ? 'on' : ''} title={`Buy into ${where}; sell what is kept there`} onClick={() => setFrom('stores')}>{factory ? 'Factor’s warehouse' : 'Your stores'}</button>}
            {docked.map((f) => <button key={f.id} role="radio" aria-checked={from === f.id} className={from === f.id ? 'on' : ''} title={`Buy into ${f.name}’s hold; sell from it`} onClick={() => setFrom(f.id)}>{f.name}</button>)}
          </span>
          <span className="spacer" />
          <label className="qty">Lot {[1, 10, 50].map((q) => <button key={q} className={qty === q ? 'on' : ''} onClick={() => setQty(q)}>{q}</button>)}</label>
          <div className="muted small from-note">
            {stores ? <>What you buy waits in {where} until a fleet loads it: open the ship and choose <b>Load and unload</b>.{docked.length > 0 && <> {docked.map((f, i) => <span key={f.id}>{i ? ', ' : ''}<button className="link" onClick={() => openWindow({ kind: 'fleet', id: f.id, tab: 'cargo' }, true)}>{f.name}</button></span>)} {docked.length > 1 ? 'lie' : 'lies'} here.</>}</>
              : fleet ? <>Straight in and out of <b>{fleet.name}</b>’s hold · {free} free.{hasStores ? ' Your stores here are kept apart.' : ''}</>
              : <>Choose what trades: {docked.length} ships lie here.</>}
          </div>
        </div>
      ) : <div className="muted small notice">Prices this season. You keep no stores here: bring a fleet into port to trade from her hold{port.map === 'old' && port.kind !== 'native' ? ', or open a factory' : ''}.</div>}
      {shocksIn(game, port.realm).map((x) => (
        <div key={x.kind} className="notice shock"><b>{shockTitle(x.kind, x.region)}</b> · {x.spec.text.replace('{region}', REGION_NAME[x.region as Region])} <span className="muted">Until {turnLabel(x.until)}.</span></div>
      ))}
      {port.map === 'old' && port.kind !== 'native' && (factory ? (
        <div className="factory-head">
          <b>Your factory</b>
          <span className="muted small">Leave goods with the factor, then choose <b>Sell</b>: they sell about {pacePreview} a season, only at fair prices. <b>Buy</b>: they buy up to {FACTORY.buyTarget} while it is cheap. Wages {FACTORY.upkeep} a season{port.kind === 'foreign' ? `, and ${Math.round(FACTORY.foreignDues * 100)}% dues to ${port.nation}` : ''}.</span>
          {(factory.last.sold > 0 || factory.last.bought > 0) && <span className="small">Last season: {factory.last.sold ? `sold for ${fmt(factory.last.sold)}` : ''} {factory.last.bought ? `bought for ${fmt(factory.last.bought)}` : ''}</span>}
        </div>
      ) : (
        <div className="factory-head">
          <button className="adm-gold-btn" disabled={game.treasury < factoryCost(game, port.id)} onClick={() => void run({ kind: 'openFactory', city: port.id })}>Open a factory · {fmt(factoryCost(game, port.id))}</button>
          <span className="muted small">A factor and a warehouse here: they sell what you leave a little at a time, so the price holds, and buy what you need when it is cheap.</span>
        </div>
      ))}
      <CaptivesRow port={port} fleet={fleet} free={fleet ? free : 0} />
      <div className="goods-list">
        {GOODS.filter((g) => book[g]).map((good) => {
          const m = book[good]!;
          const have = Math.floor((stores ? stores[good] : fleet?.cargo[good]) ?? 0);
          const buyQ = Math.max(1, Math.min(qty, Math.floor(m.stock), free));
          const buy = () => void run(stores ? { kind: 'storeBuy', port: port.id, good, qty } : { kind: 'buy', fleet: fleet!.id, good, qty });
          const sell = (n: number) => void run(stores ? { kind: 'storeSell', port: port.id, good, qty: n } : { kind: 'sell', fleet: fleet!.id, good, qty: n });
          const sellQ = Math.max(1, Math.min(qty, have));
          const hist = m.history;
          const best = have > 0 ? bestPort(game, world, good, port.map) : null;
          const falling = hist.length > 1 && hist[hist.length - 1] < hist[hist.length - 2];
          const fill = m.stock / Math.max(1, m.ref);
          const taste = port.kind !== 'native' ? demandFactor(game, port.realm, good) : 1;
          const tag = fill > 1.6 ? ['glut', 'Glut: too much in stock, prices are low'] : fill < 0.4 ? ['scarce', 'Scarce: they will pay well'] : taste >= 1.25 ? ['wanted', 'In demand in this region'] : null;
          const fstock = Math.floor(factory?.stock[good] ?? 0);
          const mode = factory?.orders[good] ?? 'hold';
          return (
            <div key={good} className="good-row" title={GOOD_INFO[good].blurb}>
              <GoodIcon good={good} size={40} />
              <span className="g-name"><b>{GOOD_INFO[good].name}{tag && <em className={`tag ${tag[0]}`} title={tag[1]}>{tag[0]}</em>}</b>{best && best.id !== port.id && best.price > unitPrice(m) * 1.05 && <span className="best-port" title="The port you know where this cargo sells for most, at today’s prices">best in {best.name}: {Math.round(best.price)}</span>}<span className="stock" title={`${fmt(m.stock)} in stock`}><i style={{ width: `${Math.min(100, fill * 100)}%` }} /></span></span>
              <span className="g-price"><b>{fmt(unitPrice(m) * (1 - sp))}</b><span>sell</span></span>
              <span className="g-price buy"><b>{fmt(unitPrice(m) * (1 + sp))}</b><span>buy</span></span>
              <span className={`g-trend ${falling ? 'down' : 'up'}`}><Sparkline values={hist} /></span>
              {trading && (
                <span className="g-trade">
                  <span className={`hold ${have ? '' : 'none'}`} title={stores ? `In ${where}` : `Aboard ${fleet!.name}`}>{have} {stores ? 'kept' : 'aboard'}</span>
                  <button disabled={free <= 0 || m.stock < 1} title={`Buy ${buyQ} for ${fmt(buyCost(m, buyQ, sp))}`} onClick={buy}>Buy {buyQ}</button>
                  <button disabled={!have} title={have ? `Sell ${sellQ} for ${fmt(sellValue(m, sellQ, sp))}` : ''} onClick={() => sell(qty)}>Sell {sellQ}</button>
                  <button disabled={!have} onClick={() => sell(have)}>All</button>
                </span>
              )}
              {factory && (
                <span className="g-factor">
                  <span className="hold" title="With your factor">{fstock} stored</span>
                  <span className="stance mini" role="radiogroup" aria-label={`Factor orders for ${GOOD_INFO[good].name}`}>
                    {(['hold', 'sell', 'buy'] as const).map((k) => <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? 'on' : ''} onClick={() => void run({ kind: 'factoryOrder', city: port.id, good, mode: k })}>{k === 'hold' ? 'Hold' : k === 'sell' ? 'Sell' : 'Buy'}</button>)}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="muted small">Every lot moves the price. Flood a market and the price collapses: spread big cargoes across ports, or leave them with a factor.</div>
    </div>
  );
}

function Compare() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const known = allPorts(world).filter((p) => !p.inland && (p.kind !== 'native' || game.discovered.includes(p.id)));
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

