/** A colony's own window, and the colonial tax rate shown in the Cities screen. */
import { useStore } from '../store';
import { Enslaved } from './Late';
import { fmt } from './format';
import { GoodIcon } from './Icon';
import { GOODS, GOOD_INFO, NEEDS, LUXURIES, LUXURY_NEED, type GoodId } from '../data/goods';
import { LEVELS, territoryOf } from '../sim/colony';
import { GARRISON_FOOD } from '../data/colony';
import { moodOf, nationById, neighbours } from '../sim/natives';
import { loyaltyFactors, loyaltyTarget, colonyTaxes, TAX } from '../sim/empire';
import { cargoUsed, cargoCapacity } from '../sim/game';
import { getView } from './MapCanvas';
import { turnLabel } from '../sim/types';
import { ArmyRow } from './Battle';
import { Art } from './theme/Art';
import { spriteUrl } from '../render/assets';
import { colonyKind } from '../render/colonyKind';
import { WALLS } from '../data/army';

export function ColonyWindow({ colonyId }: { colonyId: string }) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const openWindow = useStore((s) => s.openWindow);
  const c = game.colonies.find((x) => x.id === colonyId)!;
  const L = LEVELS[c.level];
  const next = L.next ? LEVELS[L.next] : null;
  const docked = game.fleets.filter((f) => f.at === c.id);
  const garrison = game.units.filter((u) => u.colony === c.id);
  const lux = LUXURIES.reduce((t, g) => t + (c.stock[g] ?? 0), 0);
  const need = (g: GoodId, per: number) => ({ have: Math.floor(c.stock[g] ?? 0), want: Math.ceil(c.pop * per * 10) / 10 });
  const needs: [string, { have: number; want: number }, string][] = [
    ['Food', { have: Math.floor(c.stock.food ?? 0), want: Math.ceil((c.pop + c.newcomers) * NEEDS.food + garrison.length * GARRISON_FOOD) }, 'Settlers, newcomers and the garrison all eat. Without it, colonists starve and soldiers desert.'],
    ['Cloth', need('cloth', NEEDS.cloth), 'Without it, work slows and the colony stops growing.'],
    ['Wine', need('wine', NEEDS.wine), 'Without it, work slows and the colony stops growing.'],
  ];
  const stock = GOODS.filter((g) => (c.stock[g] ?? 0) >= 1);
  const produced = GOODS.filter((g) => (c.last.produced[g] ?? 0) > 0);
  const net = c.last.births - c.last.deaths;
  const perYear = Math.round(c.pop * net * 100) / 100;
  const siege = Object.entries(game.natives).find(([, st]) => st.siege?.colony === c.id);
  const world = useStore((s) => s.world)!;
  const besiegers = siege ? nationById(world, siege[0]) : undefined;
  return (
    <section className="colony-window">
      <header className="drawer-head window-head">
        <span className="ship-art"><img src={spriteUrl(`colonies/${colonyKind(game, c)}-${c.level}`)} alt="" height={64} /></span>
        <div>
          <h2>{c.name} <button className="link small" onClick={() => { const n = prompt('A new name for the colony', c.name); if (n && n.trim() !== c.name) void run({ kind: 'renameColony', colony: c.id, name: n }); }}>rename</button></h2>
          <div className="sub">{L.name} · {c.pop}/{L.cap} colonists · {territoryOf(c).length} hexes{c.last.hungry ? ' · hungry' : c.last.discontent ? ' · discontent' : ''}
            {' · '}<button className="link" onClick={() => { set({ drawer: null, windows: [] }); setTimeout(() => getView()?.focusHex(c.map, c.hex), 0); }}>show on the map</button></div>
        </div>
      </header>
        <div className="city-body">
          <Enslaved colony={c} />
          <div className="loyalty" title={loyaltyFactors(game, c).map((f) => `${f.label}: ${f.value > 0 ? '+' : ''}${f.value}`).join('\n')}>
            <span className="small">Loyalty <b>{Math.round(c.loyalty)}</b> → {Math.round(loyaltyTarget(game, c))}{c.unrest ? ' · unrest: work slows' : ''}{c.loyalty < 15 && c.pop >= 6 ? ' · talk of independence' : ''}</span>
            <div className="bar"><div className={c.loyalty < 30 ? 'bad' : ''} style={{ width: `${c.loyalty}%` }} /></div>
            <div className="row">
              {!c.charter && <button title="Loyalty rises for good; this colony pays half taxes" onClick={() => void run({ kind: 'charter', colony: c.id })}>Grant royal charter</button>}
              {c.charter && <span className="chip">Chartered</span>}
              <button disabled={game.treasury < 150 + c.pop * 40} onClick={() => void run({ kind: 'festival', colony: c.id })}>Festival · {fmt(150 + c.pop * 40)}</button>
              <span className="muted small">pays {colonyTaxes(game, c)} a season</span>
            </div>
          </div>
          {besiegers && <div className="notice bad"><b>Besieged by the {besiegers.people}</b> since {turnLabel(siege![1].siege!.since)}. No one works the fields; every season they try the palisade. Bring soldiers and food by sea, or make peace.</div>}
          <div className="small" title={`Births ${(c.last.births * 100).toFixed(1)}% a year, deaths ${(c.last.deaths * 100).toFixed(1)}% a year. Plenty of food, luxuries and friendly peoples nearby raise births; the tropics and sieges raise deaths.`}>
            Births {(c.last.births * 100).toFixed(1)}% · deaths {(c.last.deaths * 100).toFixed(1)}% a year:{' '}
            <b className={perYear < 0 ? 'bad' : ''}>{perYear >= 0 ? '+' : ''}{perYear} colonists a year</b>
            {c.newcomers > 0 ? ` · ${c.newcomers} newcomer${c.newcomers > 1 ? 's' : ''} seasoning` : ''}
            {c.pop + c.newcomers >= L.cap ? ' · full: raise it to grow further' : ''}
          </div>
          <div className="bar"><div className={c.growth < 0 ? 'bad' : ''} style={{ width: `${Math.min(100, Math.abs(c.growth) * 100)}%` }} /></div>
          <div className="small muted">Natural growth is slow. Settlers from home grow a colony faster: ship them over, and they work after a season ashore.</div>
          {(() => {
            const near = neighbours(world, game, c).filter((x) => x.st.met);
            return near.length > 0 && <div className="small">Neighbours: {near.map((x) => `the ${x.n.people} (${moodOf(x.st)})`).join(', ')}. Friendly peoples trade food and help the colony grow; hostile ones raid it, and furious ones besiege it.</div>;
          })()}

          <h4>Needs each season</h4>
          <div className="needs">
            {needs.map(([n, v, why]) => (
              <span key={n} className={`need ${v.have >= v.want ? 'ok' : 'short'}`} title={why}>{v.have >= v.want ? '✓' : '✗'} {n} {v.have}/{v.want}</span>
            ))}
            <span className={`need ${lux >= c.pop * LUXURY_NEED ? 'ok' : 'opt'}`} title="Sugar, tobacco or cacao: the colony grows half as fast again">{lux >= c.pop * LUXURY_NEED ? '✓' : '○'} Luxuries {Math.floor(lux)}</span>
          </div>

          <h4>Last season</h4>
          <div className="small">
            {c.last.worked.length} of {c.pop} colonists worked the land{c.pop > c.last.worked.length ? ` (${c.pop - c.last.worked.length} idle, foraging)` : ''}.
          </div>
          <div className="cargo">
            {produced.map((g) => <span key={g} className="chip" title={GOOD_INFO[g].name}><GoodIcon good={g} size={20} />+{Math.round((c.last.produced[g] ?? 0) * 10) / 10}</span>)}
            {!produced.length && <span className="muted small">Nothing yet: the first harvest comes next season.</span>}
          </div>

          <h4>Warehouse</h4>
          <div className="cargo">
            {stock.map((g) => <span key={g} className="chip" title={GOOD_INFO[g].name}><GoodIcon good={g} size={20} />{Math.floor(c.stock[g] ?? 0)}</span>)}
            {!stock.length && <span className="muted small">Empty.</span>}
          </div>

          <h4>Garrison and walls</h4>
          <ArmyRow units={garrison} />
          {(() => {
            const w = c.walls ?? 0;
            const next = WALLS[w + 1];
            return (
              <div className="row small walls-row">
                <span className="wall-art"><Art slot={`wall/${w}`} fallback={null} /></span>
                <span><b>{WALLS[w].name}</b>{w ? '' : ': only a fence of stakes'}.</span>
                {next && <span className="wall-art next" title={`Next: ${next.name}`}><Art slot={`wall/${w + 1}`} fallback={null} /></span>}
                {next && <button disabled={(w + 1 === 3 && c.level === 'outpost') || Object.entries(next.needs).some(([g, n]) => (c.stock[g as GoodId] ?? 0) < (n as number))}
                  title={`Walls make the defenders much harder to break; field guns breach them.${w + 1 === 3 && c.level === 'outpost' ? ' A star fort needs a town.' : ''}`}
                  onClick={() => void run({ kind: 'walls', colony: c.id })}>
                  Raise {next.name.toLowerCase()} · {Object.entries(next.needs).map(([g, n]) => `${n} ${GOOD_INFO[g as GoodId].name.toLowerCase()}`).join(', ')}
                </button>}
              </div>
            );
          })()}

          {next && (
            <>
              <h4>Raise to a {next.name.toLowerCase()}</h4>
              <div className="small">
                Needs {L.pop} colonists ({c.pop}) and {Object.entries(L.needs).map(([g, n]) => `${n} ${GOOD_INFO[g as GoodId].name.toLowerCase()} (${Math.floor(c.stock[g as GoodId] ?? 0)})`).join(', ')} in the warehouse.
                A {next.name.toLowerCase()} holds {next.cap} colonists{next.radius > L.radius ? ' and works land further out' : ''}.
              </div>
              <button disabled={c.pop < L.pop || Object.entries(L.needs).some(([g, n]) => (c.stock[g as GoodId] ?? 0) < n!)} onClick={() => void run({ kind: 'upgradeColony', colony: c.id })}>Raise to {next.name.toLowerCase()}</button>
            </>
          )}

          <h4>Ships in port</h4>
          {docked.length ? (
            <ul className="fleet-list lines">
              {docked.map((f) => (
                <li key={f.id}>
                  <button className="fleet-line bare" onClick={() => openWindow({ kind: 'fleet', id: f.id, tab: 'cargo' }, true)}>
                    <span className="fl-name"><b>{f.name}</b><span className="muted small">{f.ships.length} ship{f.ships.length > 1 ? 's' : ''} · {game.units.filter((u) => u.fleet === f.id).length} aboard</span></span>
                    <span className="fl-cell"><b>{cargoUsed(f)}/{cargoCapacity(f)}</b><span className="muted small">hold</span></span>
                    <span className="fl-where"><b>Load and unload</b><span className="muted small">opens her cargo</span></span>
                    <span className="fl-go" aria-hidden>›</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">No ship lies here. Ships bring food, cloth, wine and settlers from home.</p>}
        </div>
    </section>
  );
}

export function TaxRate() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  return (
    <div className="row small">
      Colonial taxes:
      <div className="maps tabs" role="radiogroup">
        {(['low', 'normal', 'high'] as const).map((r) => (
          <button key={r} role="radio" aria-checked={game.taxRate === r} className={game.taxRate === r ? 'on' : ''} title={`${TAX[r].per} ducats a colonist a season; loyalty ${TAX[r].loyalty >= 0 ? '+' : ''}${TAX[r].loyalty}`}
            onClick={() => void run({ kind: 'taxRate', rate: r })}>{r}</button>
        ))}
      </div>
      <span className="muted">Higher taxes fill the treasury and wear down loyalty.</span>
    </div>
  );
}
