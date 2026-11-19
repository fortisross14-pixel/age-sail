import { useEffect, useState, type ReactNode } from 'react';
import { useStore, type DrawerId } from '../store';
import type { GameState } from '../sim/types';
import { Frame } from './theme/Frame';
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
          <span className="adm-medal" aria-hidden><Icon name={head.icon} size={26} /></span>
          <div><h2>{head.title}</h2><div className="sub">{head.sub(game)}</div></div>
        </header>
      )}
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
  const [tab, setTab] = useState<'port' | 'compare'>(portId ? 'port' : 'compare');
  const known = allPorts(world).filter((p) => !p.inland && (p.kind !== 'native' || game.discovered.includes(p.id)));
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
  const sp = spreadFor(game, fleet, port.kind === 'native');
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

