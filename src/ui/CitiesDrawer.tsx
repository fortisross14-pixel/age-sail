import { useState } from 'react';
import { useStore } from '../store';
import { SHIPS, type ShipType } from '../data/ships';
import { UNIT_INFO } from '../data/court';
import { BUILDINGS, BUILDING_ORDER, CITY_SPACE, UNIT_SPECS, type BuildingId } from '../data/city';
import { portById, projectCost, citySlots, slotsUsedIn } from '../sim/game';
import { personById } from '../sim/court';
import type { ProjectKind, UnitType } from '../sim/types';
import { fmt } from './format';
import { ShipIcon } from './Icon';

export function Cities() {
  const game = useStore((s) => s.game)!;
  return (
    <>
      <p className="muted small">
        Each city has room for a few buildings: every level takes one place. Make one a military port and another a trading city, or spread everything thin.
        Cities pay taxes every season; a governor with construction skill makes their projects faster and cheaper. One project at a time per city.
      </p>
      {Object.keys(game.cities).map((id) => <CityCard key={id} cityId={id} />)}
    </>
  );
}

const ICON: Record<BuildingId, string> = { docks: '⚓', barracks: '⚔', church: '✝', university: '📜', market: '⚖' };

function CityCard({ cityId }: { cityId: string }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [open, setOpen] = useState(cityId === 'seville');
  const city = game.cities[cityId];
  const port = portById(world, cityId)!;
  const p = city.project;
  const governor = personById(game, city.governor);
  const units = game.units.filter((u) => u.city === cityId && u.fleet == null && u.party == null);
  const docked = game.fleets.filter((f) => f.at === cityId);
  const start = (project: ProjectKind) => void run({ kind: 'project', city: cityId, project });
  const projectName = (k: ProjectKind) =>
    k.kind === 'ship' ? `a ${SHIPS[k.ship].name.toLowerCase()}` : k.kind === 'unit' ? UNIT_INFO[k.unit].name.toLowerCase() : `${BUILDINGS[k.building].name.toLowerCase()}`;
  const income = (CITY_SPACE[cityId]?.taxes ?? 30) + city.buildings.market * 60;
  const used = slotsUsedIn(city), max = citySlots(city);
  const Btn = ({ k, label }: { k: ProjectKind; label?: string }) => {
    const c = projectCost(k, city, governor);
    return (
      <button disabled={!!p || !c.allowed || game.treasury < c.cost} title={c.why ?? (p ? 'The city is busy with another project.' : '')} onClick={() => start(k)}>
        {c.allowed ? `${label ?? 'Build'} · ${fmt(c.cost)} · ${c.build} s.` : c.why}
      </button>
    );
  };
  return (
    <section className="city-card">
      <button className="city-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="city-name">{port.name}</span>
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
            {' · '}<button className="link" onClick={() => set({ drawer: 'markets', selectedPort: cityId })}>market</button>
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
            {BUILDING_ORDER.map((b) => {
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
        </div>
      )}
    </section>
  );
}
