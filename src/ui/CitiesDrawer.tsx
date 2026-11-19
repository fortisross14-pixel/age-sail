import { useState } from 'react';
import { useStore } from '../store';
import { SHIPS, type ShipType } from '../data/ships';
import { UNIT_INFO } from '../data/court';
import { BUILDINGS, BUILDING_ORDER, UNIT_SPECS, type BuildingId } from '../data/city';
import { crownSpec } from '../data/rivals';
import { portById, projectCost, citySlots, slotsUsedIn, cityTaxes, mainPort } from '../sim/game';
import { personById } from '../sim/court';
import type { ProjectKind, UnitType } from '../sim/types';
import { fmt } from './format';
import { GoodIcon } from './Icon';
import { GOODS, GOOD_INFO, NEEDS, LUXURIES, LUXURY_NEED, type GoodId } from '../data/goods';
import { LEVELS, GROWTH_STEP, territoryOf } from '../sim/colony';
import { loyaltyFactors, loyaltyTarget, colonyTaxes, TAX } from '../sim/empire';
import { cargoUsed, cargoCapacity } from '../sim/game';
import { getView } from './MapCanvas';
import { ShipIcon } from './Icon';

export function Cities() {
  const game = useStore((s) => s.game)!;
  return (
    <>
      <p className="muted small">
        Each city has room for a few buildings: every level takes one place. Make one a military port and another a trading city, or spread everything thin.
        Cities pay taxes every season; a governor with construction skill makes their projects faster and cheaper. One project at a time per city.
      </p>
      {Object.values(game.cities)
        .sort((a, b) => Number(b.id === mainPort(game)) - Number(a.id === mainPort(game)) || b.size - a.size || Number(a.inland) - Number(b.inland))
        .map((c) => <CityCard key={c.id} cityId={c.id} />)}
      <h3 className="section">Colonies <span className="muted small">{game.colonies.length || ''}</span></h3>
      {game.colonies.length > 0 && <TaxRate />}
      {game.colonies.length ? game.colonies.map((c) => <ColonyCard key={c.id} colonyId={c.id} />) : (
        <p className="muted small">None yet. Land a party with colonists on surveyed coast, with a fleet beside it carrying timber and tools, and choose <b>Found colony</b>.</p>
      )}
    </>
  );
}

const ICON: Record<BuildingId, string> = { docks: '⚓', barracks: '⚔', church: '✝', university: '📜', market: '⚖' };

function CityCard({ cityId }: { cityId: string }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [open, setOpen] = useState(() => cityId === mainPort(useStore.getState().game!));
  const city = game.cities[cityId];
  const port = portById(world, cityId)!;
  const p = city.project;
  const governor = personById(game, city.governor);
  const units = game.units.filter((u) => u.city === cityId && u.fleet == null && u.party == null);
  const docked = game.fleets.filter((f) => f.at === cityId);
  const start = (project: ProjectKind) => void run({ kind: 'project', city: cityId, project });
  const projectName = (k: ProjectKind) =>
    k.kind === 'ship' ? `a ${SHIPS[k.ship].name.toLowerCase()}` : k.kind === 'unit' ? UNIT_INFO[k.unit].name.toLowerCase() : `${BUILDINGS[k.building].name.toLowerCase()}`;
  const income = cityTaxes(city);
  const used = slotsUsedIn(city), max = citySlots(city);
  const Btn = ({ k, label }: { k: ProjectKind; label?: string }) => {
    const c = projectCost(k, city, governor, crownSpec(game.crown).edge);
    return (
      <button disabled={!!p || !c.allowed || game.treasury < c.cost} title={c.why ?? (p ? 'The city is busy with another project.' : '')} onClick={() => start(k)}>
        {c.allowed ? `${label ?? 'Build'} · ${fmt(c.cost)} · ${c.build} s.` : c.why}
      </button>
    );
  };
  return (
    <section className="city-card">
      <button className="city-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="city-name">{port.name}{city.inland && <span className="muted small"> · inland</span>}</span>
        <span className="muted small">{used}/{max} places · +{income} a season · {p ? `${projectName(p)}, ${p.turnsLeft} s. left` : 'idle'}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="city-body">
          {p && <div className="bar"><div style={{ width: `${((p.total - p.turnsLeft) / p.total) * 100}%` }} /></div>}
          <div className="small">
            Governor: {governor ? <b>{governor.name}</b> : <span className="muted">none</span>}
            {governor && <> (construction {governor.skills.construction})</>}
            {!governor && <> · <button className="link" onClick={() => set({ drawer: 'court', courtTab: 'people' })}>appoint one at court</button></>}
            {!city.inland && <>{' · '}<button className="link" onClick={() => set({ drawer: 'markets', selectedPort: cityId })}>market</button></>}
          </div>
          <div className="small">
            {docked.length ? <>In port: {docked.map((f) => f.name).join(', ')}. </> : <span className="muted">No fleets in port. </span>}
            {units.length > 0 && <>Waiting for a ship: {units.map((u) => UNIT_INFO[u.type].name).join(', ')}.</>}
          </div>

          <h4>Buildings</h4>
          <div className="slot-bar" aria-label={`${used} of ${max} building places used`}>
            {Array.from({ length: max }, (_, i) => <i key={i} className={i < used ? 'on' : ''} />)}
          </div>
          <div className="buildings">
            {BUILDING_ORDER.filter((b) => !(city.inland && b === 'docks')).map((b) => {
              const lv = city.buildings[b];
              const spec = BUILDINGS[b];
              const top = lv >= spec.levels.length - 1;
              return (
                <div key={b} className={`building ${lv ? 'built' : ''}`} title={spec.blurb}>
                  <span className="b-icon" aria-hidden>{ICON[b]}</span>
                  <div>
                    <b>{spec.name}</b> <span className="muted small">{lv ? `level ${lv}` : 'none'}</span>
                    <div className="small muted">{lv ? spec.effect[lv] : spec.blurb}</div>
                    {!top && <div className="small">Next: {spec.effect[lv + 1]}</div>}
                  </div>
                  {!top && <Btn k={{ kind: 'building', building: b }} label={lv ? 'Enlarge' : 'Build'} />}
                </div>
              );
            })}
          </div>

          <h4>Train units</h4>
          <div className="offers">
            {(['colonist', 'infantry', 'missionary'] as UnitType[]).map((u) => (
              <div key={u} className="offer">
                <img src={`${import.meta.env.BASE_URL}sprites/${UNIT_INFO[u].sprite}.png`} alt="" height={46} />
                <div>
                  <b>{UNIT_INFO[u].name}</b> <span className="muted small">upkeep {UNIT_SPECS[u].upkeep}</span>
                  <div className="muted small">{UNIT_INFO[u].blurb}</div>
                  <Btn k={{ kind: 'unit', unit: u }} label="Train" />
                </div>
              </div>
            ))}
          </div>

          {city.inland && <p className="muted small">Units trained here march to the nearest of your ports to wait for a ship.</p>}
          {!city.inland && <>
          <h4>Build ships</h4>
          <div className="offers">
            {(Object.keys(SHIPS) as ShipType[]).map((t) => (
              <div key={t} className="offer" title={SHIPS[t].blurb}>
                <ShipIcon type={t} size={52} />
                <div>
                  <b>{SHIPS[t].name}</b>
                  <div className="muted small">Hold {SHIPS[t].cargo}, {SHIPS[t].slots} place{SHIPS[t].slots > 1 ? 's' : ''}, {SHIPS[t].moves} moves, food for {SHIPS[t].provisions} seasons, upkeep {SHIPS[t].upkeep}.</div>
                  <Btn k={{ kind: 'ship', ship: t }} />
                </div>
              </div>
            ))}
          </div>
          </>}
        </div>
      )}
    </section>
  );
}

function ColonyCard({ colonyId }: { colonyId: string }) {
  const game = useStore((s) => s.game)!;
  const selected = useStore((s) => s.selectedColony);
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const c = game.colonies.find((x) => x.id === colonyId)!;
  const open = selected === c.id || game.colonies.length === 1;
  const L = LEVELS[c.level];
  const next = L.next ? LEVELS[L.next] : null;
  const docked = game.fleets.filter((f) => f.at === c.id);
  const garrison = game.units.filter((u) => u.colony === c.id);
  const lux = LUXURIES.reduce((t, g) => t + (c.stock[g] ?? 0), 0);
  const need = (g: GoodId, per: number) => ({ have: Math.floor(c.stock[g] ?? 0), want: Math.ceil(c.pop * per * 10) / 10 });
  const needs: [string, { have: number; want: number }, string][] = [
    ['Food', need('food', NEEDS.food), 'Without it, colonists starve.'],
    ['Cloth', need('cloth', NEEDS.cloth), 'Without it, work slows and the colony stops growing.'],
    ['Wine', need('wine', NEEDS.wine), 'Without it, work slows and the colony stops growing.'],
  ];
  const stock = GOODS.filter((g) => (c.stock[g] ?? 0) >= 1);
  const produced = GOODS.filter((g) => (c.last.produced[g] ?? 0) > 0);
  return (
    <section className={`city-card colony ${open ? 'open' : ''}`}>
      <button className="city-head" onClick={() => { set({ selectedColony: open ? null : c.id }); if (!open) setTimeout(() => getView()?.focusHex(c.map, c.hex), 0); }} aria-expanded={open}>
        <span className="city-name">{c.name}</span>
        <span className="muted small">{L.name} · {c.pop}/{L.cap} colonists · {territoryOf(c).length} hexes{c.last.hungry ? ' · hungry' : c.last.discontent ? ' · discontent' : ''}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="city-body">
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
          <div className="small">Growth {Math.floor(c.growth)}/{GROWTH_STEP}{c.last.luxuries ? ' · luxuries: growing faster' : ''}{c.pop >= L.cap ? ' · full: raise it to grow further' : ''}</div>
          <div className="bar"><div style={{ width: `${Math.min(100, (c.growth / GROWTH_STEP) * 100)}%` }} /></div>

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

          {garrison.length > 0 && <div className="small">Stationed here: {garrison.map((u) => UNIT_INFO[u.type].name).join(', ')}.</div>}

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

          {docked.map((f) => {
            const free = cargoCapacity(f) - cargoUsed(f);
            const goods = GOODS.filter((g) => (f.cargo[g] ?? 0) > 0 || (c.stock[g] ?? 0) >= 1);
            const colonists = game.units.filter((u) => u.fleet === f.id && u.type === 'colonist').length;
            return (
              <div key={f.id} className="dock">
                <h4>{f.name} in port <span className="muted small">· hold {cargoUsed(f)}/{cargoCapacity(f)}</span></h4>
                {colonists > 0 && <button className="primary" onClick={() => void run({ kind: 'settle', fleet: f.id })}>Settle {colonists} colonist{colonists > 1 ? 's' : ''} here</button>}
                <table className="market">
                  <thead><tr><th>Good</th><th>Colony</th><th>Ship</th><th /></tr></thead>
                  <tbody>
                    {goods.map((g) => (
                      <tr key={g}>
                        <td className="good"><GoodIcon good={g} />{GOOD_INFO[g].name}</td>
                        <td className="num">{Math.floor(c.stock[g] ?? 0)}</td>
                        <td className="num">{f.cargo[g] ?? '–'}</td>
                        <td className="trade">
                          <button disabled={!f.cargo[g]} onClick={() => void run({ kind: 'colonyTransfer', fleet: f.id, good: g, qty: -(f.cargo[g] ?? 0) })}>Unload all</button>
                          <button disabled={free <= 0 || (c.stock[g] ?? 0) < 1} onClick={() => void run({ kind: 'colonyTransfer', fleet: f.id, good: g, qty: Math.floor(c.stock[g] ?? 0) })}>Load all</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaxRate() {
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
