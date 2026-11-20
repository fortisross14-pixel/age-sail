import { useEffect, useState, type ReactNode } from 'react';
import { useStore, type DrawerId } from '../store';
import { factoryAt, factoryCost, factoryPace, demandFactor, shocksIn, shockTitle } from '../sim/trade';
import { FACTORY, REGION_NAME, type Region } from '../data/trade';
import { turnLabel } from '../sim/types';
import type { GameState } from '../sim/types';
import { realmSpec } from '../data/realms';
import { Frame } from './theme/Frame';
import { Medal, CrestArt } from './theme/Art';
import { Icon, type IconName } from './theme/icons';
import { sfx } from './sound';
import { GOOD_INFO, GOODS, type GoodId } from '../data/goods';
import { unitPrice, buyCost, sellValue } from '../sim/market';
import { cargoUsed, cargoCapacity, portById, allPorts, spreadFor } from '../sim/game';
import { fmt } from './format';
import { GoodIcon } from './Icon';
import { Sparkline } from './Sparkline';
import { Fleets } from './FleetsDrawer';
import { Cities } from './CityScreen';
import { Court, Research, Chronicle } from './CourtDrawer';
import { StepHint } from './Guidance';
import { CaptivesRow } from './Late';

const HEADS: Record<Exclude<DrawerId, 'cities'>, { title: string; icon: IconName; sub: (g: GameState) => string }> = {
  markets: { title: 'Markets', icon: 'markets', sub: () => 'Prices in every port you know' },
  fleets: { title: 'Fleets', icon: 'fleets', sub: (g) => `${g.fleets.length} fleet${g.fleets.length === 1 ? '' : 's'} · ${g.parties.length} part${g.parties.length === 1 ? 'y' : 'ies'} ashore` },
  court: { title: 'Court', icon: 'court', sub: (g) => `${g.people.filter((p) => p.alive).length} courtiers · ${g.petitioners.length} petitioner${g.petitioners.length === 1 ? '' : 's'} waiting` },
  research: { title: 'Research', icon: 'research', sub: (g) => `${g.research.known.length} subject${g.research.known.length === 1 ? '' : 's'} mastered` },
  chronicle: { title: 'Chronicle', icon: 'chronicle', sub: () => 'What has happened in your reign' },
};

/** A screen over everything (HUD included): one at a time; closing returns to the map. */
export function Drawer() {
  const drawer = useStore((s) => s.drawer);
  const game = useStore((s) => s.game)!;
  const set = useStore((s) => s.set);
  const [shown, setShown] = useState<DrawerId | null>(drawer);
  const [leaving, setLeaving] = useState(false);
  const [shine, setShine] = useState(0);
  const [entering, setEntering] = useState(true);
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
  const head = shown === 'cities' ? null : HEADS[shown];
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
      <div className="drawer-body" key={shown}>
        {shown === 'fleets' && <Fleets />}
        {shown === 'markets' && <Markets />}
        {shown === 'cities' && <Cities />}
        {shown === 'court' && <Court />}
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
                          <span className="fleet-where">{factoryAt(game, p.id) ? <span className="chip">factory</span> : null}{docked ? `${docked} fleet${docked > 1 ? 's' : ''} in port` : ''}</span>
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

const hexColor = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

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
  const sp = spreadFor(game, fleet, port.kind === 'native');
  const factory = factoryAt(game, port.id);
  const pacePreview = book.sugar ? factoryPace(book.sugar) : FACTORY.minPace;
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
      <CaptivesRow port={port} fleet={fleet} free={free} />
      <div className="goods-list">
        {GOODS.filter((g) => book[g]).map((good) => {
          const m = book[good]!;
          const have = fleet?.cargo[good] ?? 0;
          const buyQ = Math.max(1, Math.min(qty, Math.floor(m.stock), free));
          const sellQ = Math.max(1, Math.min(qty, have));
          const hist = m.history;
          const falling = hist.length > 1 && hist[hist.length - 1] < hist[hist.length - 2];
          const fill = m.stock / Math.max(1, m.ref);
          const taste = port.kind !== 'native' ? demandFactor(game, port.realm, good) : 1;
          const tag = fill > 1.6 ? ['glut', 'Glut: too much in stock, prices are low'] : fill < 0.4 ? ['scarce', 'Scarce: they will pay well'] : taste >= 1.25 ? ['wanted', 'In demand in this region'] : null;
          const fstock = Math.floor(factory?.stock[good] ?? 0);
          const mode = factory?.orders[good] ?? 'hold';
          return (
            <div key={good} className="good-row" title={GOOD_INFO[good].blurb}>
              <GoodIcon good={good} size={40} />
              <span className="g-name"><b>{GOOD_INFO[good].name}{tag && <em className={`tag ${tag[0]}`} title={tag[1]}>{tag[0]}</em>}</b><span className="stock" title={`${fmt(m.stock)} in stock`}><i style={{ width: `${Math.min(100, fill * 100)}%` }} /></span></span>
              <span className="g-price"><b>{fmt(unitPrice(m) * (1 - sp))}</b><span>sell</span></span>
              <span className="g-price buy"><b>{fmt(unitPrice(m) * (1 + sp))}</b><span>buy</span></span>
              <span className={`g-trend ${falling ? 'down' : 'up'}`}><Sparkline values={hist} /></span>
              {fleet && (
                <span className="g-trade">
                  {have > 0 && <span className="hold">{have} aboard</span>}
                  <button disabled={free <= 0 || m.stock < 1} title={`Buy ${buyQ} for ${fmt(buyCost(m, buyQ, sp))}`} onClick={() => void run({ kind: 'buy', fleet: fleet.id, good, qty })}>Buy {buyQ}</button>
                  <button disabled={!have} title={have ? `Sell ${sellQ} for ${fmt(sellValue(m, sellQ, sp))}` : ''} onClick={() => void run({ kind: 'sell', fleet: fleet.id, good, qty })}>Sell {sellQ}</button>
                  <button disabled={!have} onClick={() => void run({ kind: 'sell', fleet: fleet.id, good, qty: have })}>All</button>
                </span>
              )}
              {factory && (
                <span className="g-factor">
                  <span className="hold" title="With your factor">{fstock} stored</span>
                  <span className="stance mini" role="radiogroup" aria-label={`Factor orders for ${GOOD_INFO[good].name}`}>
                    {(['hold', 'sell', 'buy'] as const).map((k) => <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? 'on' : ''} onClick={() => void run({ kind: 'factoryOrder', city: port.id, good, mode: k })}>{k === 'hold' ? 'Hold' : k === 'sell' ? 'Sell' : 'Buy'}</button>)}
                  </span>
                  {fleet && have > 0 && <button title="Leave it all with the factor" onClick={() => void run({ kind: 'factoryTransfer', fleet: fleet.id, good, qty: have })}>Leave {have}</button>}
                  {fleet && fstock > 0 && <button disabled={free <= 0} onClick={() => void run({ kind: 'factoryTransfer', fleet: fleet.id, good, qty: -fstock })}>Take</button>}
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

