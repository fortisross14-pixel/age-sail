import { useState } from 'react';
import { useStore, newsKey } from '../store';
import { Icon } from './theme/icons';
import { sfx } from './sound';
import { pref, setPref } from './prefs';
import { fmt } from './format';
import { ObjectivesBody, objectivesTitle } from './Guidance';
import { KIND_MARK } from './NewsFeed';
import { portById, provisionsMax } from '../sim/game';
import { BUILDINGS } from '../data/city';
import { SHIPS } from '../data/ships';
import { UNIT_INFO } from '../data/court';
import { rivalSpec } from '../data/rivals';
import { dateLabel, turnLabel, turnStride, type ChronicleEntry, type GameState, type LedgerLine, type World } from '../sim/types';
import type { Target } from './attention';

// ---------- the outliner ----------

type Row = { key: string; name: string; state: string; tone?: 'bad' | 'warn' | 'idle'; go: Target };

function rows(game: GameState, world: World) {
  const fleets: Row[] = game.fleets.map((f) => {
    const where = f.at ? `in ${portById(world, f.at, game)?.name ?? 'port'}` : f.map === 'new' ? 'across the ocean' : 'at sea';
    const doing = f.route?.active ? 'on a trade route' : f.order ? `under sail, ${f.order.path.length - 1} hexes to go` : f.at ? 'in port' : 'no orders';
    const low = !f.at && f.supplies <= 2;
    const hurt = f.ships.some((x) => x.hull < 50);
    return {
      key: `f${f.id}`, name: f.name, go: { fleet: f.id },
      state: `${f.ships.length} ship${f.ships.length > 1 ? 's' : ''} ${where} · ${doing} · food ${Math.max(0, f.supplies)}/${provisionsMax(f, game)}${hurt ? ' · damaged' : ''}`,
      tone: low ? 'bad' : hurt ? 'warn' : !f.at && !f.order && !f.route?.active ? 'idle' : undefined,
    };
  });
  const parties: Row[] = game.parties.map((p) => {
    const n = game.units.filter((u) => u.party === p.id).length;
    return { key: `p${p.id}`, name: p.name, go: { party: p.id }, state: `${n} compan${n === 1 ? 'y' : 'ies'} ashore · ${p.order ? 'marching' : 'no orders'} · ${Math.floor(p.food)} rations`, tone: p.food < 2 ? 'bad' : !p.order ? 'idle' : undefined };
  });
  const colonies: Row[] = game.colonies.map((c) => {
    const flags = [c.last.besieged ? 'besieged' : '', c.last.hungry ? 'hungry' : '', c.unrest ? 'unrest' : '', c.last.discontent ? 'discontent' : ''].filter(Boolean);
    return {
      key: c.id, name: c.name, go: { drawer: 'cities', colony: c.id },
      state: `${c.pop} colonists · loyalty ${Math.round(c.loyalty)}${flags.length ? ` · ${flags.join(', ')}` : ''}`,
      tone: c.last.besieged || c.last.hungry ? 'bad' : c.loyalty < 30 || c.unrest ? 'warn' : undefined,
    };
  });
  const cities: Row[] = Object.values(game.cities).filter((c) => c.project || c.buildings.docks > 0 || c.buildings.barracks > 0).map((c) => {
    const p = c.project;
    const what = !p ? 'nothing in hand' : p.kind === 'ship' ? `building a ${SHIPS[p.ship].name.toLowerCase()}` : p.kind === 'unit' ? `training ${UNIT_INFO[p.unit].name.toLowerCase()}` : `building ${BUILDINGS[p.building].name.toLowerCase()}`;
    return { key: c.id, name: portById(world, c.id)?.name ?? c.id, go: { drawer: 'cities' }, state: p ? `${what} · ${p.turnsLeft} season${p.turnsLeft > 1 ? 's' : ''}` : what, tone: p ? undefined : 'idle' };
  });
  const threats: Row[] = [
    ...game.rebels.map((r) => ({ key: `r${r.id}`, name: r.name, go: { drawer: 'cities' as const, colony: game.colonies.find((c) => c.hex === r.target && c.map === r.map)?.id }, state: `marching on ${game.colonies.find((c) => c.hex === r.target && c.map === r.map)?.name ?? 'a colony'}`, tone: 'bad' as const })),
    ...game.rivalShips.filter((x) => (x.kind === 'raid' || x.kind === 'army') && !x.homeward && game.fog[x.map][x.hex] > 0).map((x) => ({ key: `x${x.id}`, name: `Soldiers of ${rivalSpec(x.crown).name}`, go: { drawer: 'cities' as const, colony: game.colonies.find((c) => c.hex === x.target && c.map === x.map)?.id }, state: `${x.kind === 'army' ? 'marching on' : 'sailing for'} ${game.colonies.find((c) => c.hex === x.target && c.map === x.map)?.name ?? 'a colony'}`, tone: 'bad' as const })),
    ...game.freeStates.filter((f) => !f.recognised).map((f) => ({ key: f.id, name: f.name, go: { drawer: 'court' as const, courtTab: 'crowns' as const }, state: `a free state${f.by ? `, protected by ${rivalSpec(f.by).name}` : ''}`, tone: 'warn' as const })),
  ];
  return { threats, fleets, parties, colonies, cities };
}

/** Everything you own and its state, a line each: click to go there. */
export function Outliner() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const goTo = useStore((s) => s.goTo);
  const set = useStore((s) => s.set);
  const r = rows(game, world);
  const net = game.ledger.last?.total;
  const group = (title: string, list: Row[]) => list.length > 0 && (
    <section key={title}>
      <h4 className="obj-sub">{title} <span className="muted">{list.length}</span></h4>
      <ul className="out-list">
        {list.map((x) => (
          <li key={x.key}><button className={`out-row ${x.tone ?? ''}`} onClick={() => goTo(x.go)}><b>{x.name}</b><span>{x.state}</span></button></li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="outliner">
      <button className="out-row money" onClick={() => { sfx('open'); set({ showLedger: true }); }}>
        <b>Treasury {fmt(game.treasury)}</b>
        <span>{net == null ? 'The ledger opens after your first turn' : `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} last turn · see the ledger (L)`}</span>
      </button>
      {group('Threats', r.threats)}
      {group('Fleets', r.fleets)}
      {group('Parties ashore', r.parties)}
      {group('Colonies', r.colonies)}
      {group('Shipyards and barracks', r.cities)}
    </div>
  );
}

/** The panel on the right of the map: what to do next, or what you own. Folds to its title. */
export function SidePanel() {
  const game = useStore((s) => s.game)!;
  const tab = useStore((s) => s.sideTab);
  const set = useStore((s) => s.set);
  const [folded, setFolded] = useState(pref('objectivesFolded'));
  const fold = () => { const v = !folded; setFolded(v); setPref('objectivesFolded', v); sfx(v ? 'close' : 'open'); };
  const pick = (t: 'goals' | 'realm') => { sfx('tab'); setPref('sideTab', t); set({ sideTab: t }); if (folded) fold(); };
  const title = objectivesTitle(game);
  return (
    <aside className={`objectives ${folded ? 'folded' : ''}`} aria-label="Goals and realm">
      <div className="side-head">
        <button className={`side-tab ${tab === 'goals' ? 'on' : ''}`} onClick={() => pick('goals')} aria-pressed={tab === 'goals'}><Icon name="chronicle" size={16} />{title.name}<span className="obj-tally">{title.tally}</span></button>
        <button className={`side-tab ${tab === 'realm' ? 'on' : ''}`} onClick={() => pick('realm')} aria-pressed={tab === 'realm'}><Icon name="cities" size={16} />Realm</button>
        <button className="side-fold" onClick={fold} aria-expanded={!folded} title={folded ? 'Open' : 'Fold away'} aria-label={folded ? 'Open the panel' : 'Fold the panel away'}>{folded ? '▾' : '▴'}</button>
      </div>
      {!folded && <div className="obj-scroll">{tab === 'goals' ? <ObjectivesBody /> : <Outliner />}</div>}
    </aside>
  );
}

// ---------- the ledger ----------

export const LEDGER_LINES: [LedgerLine, string, string][] = [
  ['taxes', 'Taxes and dues', 'Your cities, their markets and warehouses, and your colonies.'],
  ['routes', 'Merchants on their routes', 'What your merchant-led fleets bought and sold by themselves.'],
  ['factories', 'Factories', 'What your factors sold and bought, less their wages and dues.'],
  ['peoples', 'The peoples', 'Tribute from subject peoples.'],
  ['empire', 'Loans and free states', 'Repayments on loans; trade with free states you have recognised.'],
  ['europe', 'Europe', 'Tribute to corsairs, wars you have joined, allies’ subsidies, privateers’ prizes.'],
  ['sea', 'War at sea', 'Prizes taken from privateers.'],
  ['events', 'Stories and rewards', 'What your choices on cards cost or brought, and rewards for goals met.'],
  ['upkeep', 'Ships and soldiers', 'The upkeep of every ship and every company.'],
  ['wages', 'The court', 'Salaries of your courtiers.'],
  ['interest', 'Interest', 'What the bankers charge while the treasury is in debt.'],
  ['orders', 'Your own orders', 'Everything you bought, sold, built, hired, gave and paid for by hand.'],
];
const RECURRING: LedgerLine[] = ['taxes', 'routes', 'factories', 'peoples', 'empire', 'europe', 'upkeep', 'wages', 'interest'];
/** What a turn brings in before you do anything, going by the last one. */
export const forecast = (game: GameState) => (game.ledger.last ? RECURRING.reduce((t, k) => t + (game.ledger.last!.lines[k] ?? 0), 0) : null);

export function Ledger() {
  const show = useStore((s) => s.showLedger);
  const game = useStore((s) => s.game);
  const set = useStore((s) => s.set);
  if (!show || !game) return null;
  const last = game.ledger.last;
  const money = (n: number) => <td className={`num ${n < 0 ? 'bad' : n > 0 ? 'good' : ''}`}>{n === 0 ? '·' : `${n > 0 ? '+' : '−'}${fmt(Math.abs(Math.round(n)))}`}</td>;
  const f = forecast(game);
  return (
    <div className="modal-back" onClick={() => set({ showLedger: false })}>
      <div className="modal ledger" role="dialog" aria-label="The ledger" onClick={(e) => e.stopPropagation()}>
        <h2>The ledger</h2>
        {!last ? <p className="muted">Nothing to account for yet: end a turn and the treasurer will draw up the first account.</p> : (
          <>
            <p className="muted">{turnLabel(last.turn)}: what came in and what went out over the {turnStride(last.turn) === 2 ? 'half year' : 'year'}.</p>
            <table className="market">
              <tbody>
                {LEDGER_LINES.filter(([k]) => last.lines[k]).map(([k, name, about]) => <tr key={k} title={about}><td><b>{name}</b><div className="muted small">{about}</div></td>{money(last.lines[k]!)}</tr>)}
                <tr className="total"><td><b>The turn, all told</b></td>{money(last.total)}</tr>
              </tbody>
            </table>
            {f != null && <p><b>Next turn, before you do anything: {f >= 0 ? '+' : '−'}{fmt(Math.abs(Math.round(f)))} ducats</b> <span className="muted">(taxes, trade and upkeep as they stood last turn; your own orders and the luck of the sea are not in it).</span></p>}
          </>
        )}
        <div className="row center"><button className="primary" autoFocus onClick={() => set({ showLedger: false })}>Close</button></div>
      </div>
    </div>
  );
}

// ---------- what happened this turn ----------

const GROUPS: [ChronicleEntry['kind'], string][] = [['peril', 'Perils'], ['discovery', 'Discoveries'], ['voyage', 'Voyages'], ['trade', 'Trade'], ['court', 'Court and realm']];
const PER_GROUP = 2;

/** One card for the turn that has just passed: its news in groups, the treasury's change, and the way to the rest. */
export function TurnSummary() {
  const game = useStore((s) => s.game)!;
  const dismissed = useStore((s) => s.dismissed);
  const set = useStore((s) => s.set);
  const [open, setOpen] = useState(false);
  const gone = new Set(dismissed);
  const shown = pref('news');
  const fresh = game.chronicle.filter((c) => !gone.has(newsKey(c)) && shown[c.kind] !== false);
  if (!fresh.length) return null;
  const last = game.ledger.last;
  const dismiss = () => set({ dismissed: [...dismissed, ...game.chronicle.map(newsKey)] });
  return (
    <div className="news summary" aria-live="polite">
      <div className="sum-card">
        <div className="sum-head">
          <b>{last ? `Since ${turnLabel(last.turn)}` : dateLabel(game.turn)}</b>
          {last && <button className="sum-money" title="Open the ledger (L)" onClick={() => set({ showLedger: true })}>{last.total >= 0 ? '+' : '−'}{fmt(Math.abs(Math.round(last.total)))} ducats</button>}
          <button className="x" onClick={dismiss} aria-label="Dismiss the news">×</button>
        </div>
        {GROUPS.map(([kind, title]) => {
          const items = fresh.filter((c) => c.kind === kind).reverse();
          if (!items.length) return null;
          return (
            <div key={kind} className={`sum-group ${kind}`}>
              <div className="sum-title"><span className="mark" aria-hidden>{KIND_MARK[kind]}</span>{title}{items.length > 1 && <span className="muted"> · {items.length}</span>}</div>
              {(open ? items : items.slice(0, PER_GROUP)).map((c) => <p key={newsKey(c)}>{c.text}</p>)}
              {!open && items.length > PER_GROUP && <button className="link" onClick={() => setOpen(true)}>and {items.length - PER_GROUP} more</button>}
            </div>
          );
        })}
        <div className="sum-foot">
          <button className="news-clear" onClick={() => set({ drawer: 'chronicle' })}>Chronicle</button>
          <button className="news-clear" onClick={dismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
