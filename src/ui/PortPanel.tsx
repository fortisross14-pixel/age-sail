import { useState } from 'react';
import { useStore } from '../store';
import { GOODS, GOOD_INFO, type GoodId } from '../data/goods';
import { SHIPS, PORT_UPGRADE, type ShipType } from '../data/ships';
import { unitPrice, buyCost, sellValue } from '../sim/market';
import { cargoUsed, cargoCapacity, portById, projectCost } from '../sim/game';
import type { ProjectKind } from '../sim/types';
import { fmt } from './format';
import { GoodIcon, ShipIcon } from './Icon';
import { Sparkline } from './Sparkline';

export function PortPanel() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const portId = useStore((s) => s.selectedPort);
  const selected = useStore((s) => s.selectedFleet);
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [qty, setQty] = useState(10);
  const [tab, setTab] = useState<'market' | 'city'>('market');
  const port = portId ? portById(world, portId) : undefined;
  if (!port) return null;
  const book = game.markets[port.id] ?? {};
  const fleet = game.fleets.find((f) => f.id === selected && f.at === port.id);
  const free = fleet ? cargoCapacity(fleet) - cargoUsed(fleet) : 0;
  const goods = GOODS.filter((g) => book[g]);
  const sub = port.kind === 'native' ? `Trading ground of the ${port.people}` : port.kind === 'home' ? 'Your city' : `Foreign market · ${port.nation}`;

  return (
    <section className="panel port-panel">
      <header className="port-head">
        <div>
          <h2>{port.name}</h2>
          <div className="muted small">{sub} · {port.blurb}</div>
        </div>
        <div className="row">
          {port.kind === 'home' && (
            <div className="maps tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'market'} className={tab === 'market' ? 'on' : ''} onClick={() => setTab('market')}>Market</button>
              <button role="tab" aria-selected={tab === 'city'} className={tab === 'city' ? 'on' : ''} onClick={() => setTab('city')}>
                City{game.cities[port.id]?.project ? ' ·' : ''}
              </button>
            </div>
          )}
          {fleet && (tab === 'market' || port.kind !== 'home') && (
            <label className="qty">
              Lot
              {[1, 10, 50].map((q) => (
                <button key={q} className={qty === q ? 'on' : ''} onClick={() => setQty(q)}>{q}</button>
              ))}
            </label>
          )}
          <button className="close" onClick={() => set({ selectedPort: null })} aria-label="Close">×</button>
        </div>
      </header>
      <div className="port-body">
        {(tab === 'market' || port.kind !== 'home') && <div className="market-wrap">
          {!fleet && <div className="muted small notice">Prices this season. Bring a fleet into port to trade.</div>}
          <table className="market">
            <thead>
              <tr><th>Good</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Trend</th>{fleet && <><th>Hold</th><th /></>}</tr>
            </thead>
            <tbody>
              {goods.map((g) => <MarketRow key={g} good={g} />)}
            </tbody>
          </table>
          {fleet && <div className="muted small">Hold space: {free} free. Every lot moves the price: spread big cargoes across ports.</div>}
        </div>}
        {port.kind === 'home' && tab === 'city' && <CityPanel cityId={port.id} />}
      </div>
    </section>
  );

  function MarketRow({ good }: { good: GoodId }) {
    const m = book[good]!;
    const have = fleet?.cargo[good] ?? 0;
    const buyQ = Math.max(1, Math.min(qty, Math.floor(m.stock), free));
    const sellQ = Math.max(1, Math.min(qty, have));
    const hist = m.history;
    return (
      <tr title={GOOD_INFO[good].blurb}>
        <td className="good"><GoodIcon good={good} />{GOOD_INFO[good].name}</td>
        <td className="num">{fmt(unitPrice(m) * 1.08)}</td>
        <td className="num">{fmt(unitPrice(m) * 0.92)}</td>
        <td className="num">{fmt(m.stock)}</td>
        <td className={hist.length > 1 && hist[hist.length - 1] < hist[hist.length - 2] ? 'down' : 'up'}><Sparkline values={hist} /></td>
        {fleet && (
          <>
            <td className="num">{have || '–'}</td>
            <td className="trade">
              <button disabled={free <= 0 || m.stock < 1} title={`Buy ${buyQ} for ${fmt(buyCost(m, buyQ))}`}
                onClick={() => void run({ kind: 'buy', fleet: fleet.id, good, qty })}>Buy {buyQ}</button>
              <button disabled={!have} title={have ? `Sell ${sellQ} for ${fmt(sellValue(m, sellQ))}` : ''}
                onClick={() => void run({ kind: 'sell', fleet: fleet.id, good, qty })}>Sell {sellQ}</button>
              <button disabled={!have} onClick={() => void run({ kind: 'sell', fleet: fleet.id, good, qty: have })}>All</button>
            </td>
          </>
        )}
      </tr>
    );
  }
}

function CityPanel({ cityId }: { cityId: string }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const city = game.cities[cityId];
  if (!city) return null;
  const p = city.project;
  const waiting = game.explorers.filter((e) => e.alive && e.waitingAt === cityId);
  const start = (project: ProjectKind) => void run({ kind: 'project', city: cityId, project });
  const projectName = (k: ProjectKind) => (k.kind === 'ship' ? `the ${SHIPS[k.ship].name.toLowerCase()}` : k.kind === 'port' ? 'the harbour works' : 'an explorer');
  const up = PORT_UPGRADE[city.port + 1];
  return (
    <div className="city">
      <h3>Port of {portById(world, cityId)?.name} · level {city.port}</h3>
      {p ? (
        <div className="project">
          Building {projectName(p)}: {p.turnsLeft} season{p.turnsLeft > 1 ? 's' : ''} left
          <div className="bar"><div style={{ width: `${((p.total - p.turnsLeft) / p.total) * 100}%` }} /></div>
        </div>
      ) : <div className="muted small">The yards are idle. Choose a project: each takes a few seasons.</div>}
      <div className="offers">
        {(Object.keys(SHIPS) as ShipType[]).map((t) => {
          const c = projectCost({ kind: 'ship', ship: t }, city.port);
          return (
            <div key={t} className="offer" title={SHIPS[t].blurb}>
              <ShipIcon type={t} size={56} />
              <div>
                <b>{SHIPS[t].name}</b> · {fmt(c.cost)} · {c.build} seasons
                <div className="muted small">Hold {SHIPS[t].cargo}, {SHIPS[t].moves} moves, food for {SHIPS[t].provisions} seasons, upkeep {SHIPS[t].upkeep}.</div>
                <button disabled={!!p || !c.allowed || game.treasury < c.cost} title={c.why ?? ''} onClick={() => start({ kind: 'ship', ship: t })}>
                  {c.allowed ? 'Build' : c.why}
                </button>
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
        <div className="offer">
          <div className="offer-mark" aria-hidden>✦</div>
          <div>
            <b>Recruit an explorer</b> · {fmt(projectCost({ kind: 'explorer' }, city.port).cost)} · 1 season
            <div className="muted small">Only fleets led by an explorer may sail into uncharted waters.</div>
            <button disabled={!!p || game.treasury < projectCost({ kind: 'explorer' }, city.port).cost} onClick={() => start({ kind: 'explorer' })}>Recruit</button>
          </div>
        </div>
      </div>
      {waiting.length > 0 && (
        <div className="muted small">Waiting in port: {waiting.map((e) => e.name).join(', ')}. Select a docked fleet to give them command.</div>
      )}
    </div>
  );
}
