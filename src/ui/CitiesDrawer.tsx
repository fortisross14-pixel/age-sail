import { useState } from 'react';
import { useStore } from '../store';
import { SHIPS, PORT_UPGRADE, type ShipType } from '../data/ships';
import { UNIT_INFO } from '../data/court';
import { portById, projectCost } from '../sim/game';
import { personById } from '../sim/court';
import type { ProjectKind } from '../sim/types';
import { fmt } from './format';
import { ShipIcon } from './Icon';

export function Cities() {
  const game = useStore((s) => s.game)!;
  return (
    <>
      <p className="muted small">Your cities build ships and enlarge their ports. Barracks, docks, universities and markets come in a later version. A governor with construction skill makes every project faster and cheaper.</p>
      {Object.keys(game.cities).map((id) => <CityCard key={id} cityId={id} />)}
    </>
  );
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
  const governor = personById(game, city.governor);
  const atCourt = game.people.filter((x) => x.alive && x.city === cityId && x.fleet == null);
  const units = game.units.filter((u) => u.city === cityId && u.fleet == null);
  const docked = game.fleets.filter((f) => f.at === cityId);
  const start = (project: ProjectKind) => void run({ kind: 'project', city: cityId, project });
  const projectName = (k: ProjectKind) => (k.kind === 'ship' ? `a ${SHIPS[k.ship].name.toLowerCase()}` : 'harbour works');
  const up = PORT_UPGRADE[city.port + 1];
  const upCost = projectCost({ kind: 'port' }, city.port, governor);
  return (
    <section className="city-card">
      <button className="city-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="city-name">{port.name}</span>
        <span className="muted small">port {city.port} · {p ? `building ${projectName(p)}, ${p.turnsLeft} season${p.turnsLeft > 1 ? 's' : ''} left` : 'yards idle'}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="city-body">
          {p && <div className="bar"><div style={{ width: `${((p.total - p.turnsLeft) / p.total) * 100}%` }} /></div>}
          <div className="small">
            Governor: {governor ? <b>{governor.name}</b> : <span className="muted">none</span>}
            {governor && <> (construction {governor.skills.construction})</>}
            {!governor && <> · <button className="link" onClick={() => set({ drawer: 'court', courtTab: 'people' })}>appoint one at court</button></>}
          </div>
          <div className="small">
            {docked.length ? <>In port: {docked.map((f) => f.name).join(', ')}. </> : <span className="muted">No fleets in port. </span>}
            {atCourt.length > 0 && <>People here: {atCourt.length}. </>}
            {units.length > 0 && <>Units waiting: {units.map((u) => UNIT_INFO[u.type].name).join(', ')}. </>}
            <button className="link" onClick={() => set({ drawer: 'markets', selectedPort: cityId })}>Market</button>
          </div>
          <div className="offers">
            {(Object.keys(SHIPS) as ShipType[]).map((t) => {
              const c = projectCost({ kind: 'ship', ship: t }, city.port, governor);
              return (
                <div key={t} className="offer" title={SHIPS[t].blurb}>
                  <ShipIcon type={t} size={52} />
                  <div>
                    <b>{SHIPS[t].name}</b> · {fmt(c.cost)} · {c.build} season{c.build > 1 ? 's' : ''}
                    <div className="muted small">Hold {SHIPS[t].cargo}, {SHIPS[t].slots} place{SHIPS[t].slots > 1 ? 's' : ''}, {SHIPS[t].moves} moves, food for {SHIPS[t].provisions} seasons, upkeep {SHIPS[t].upkeep}.</div>
                    <button disabled={!!p || !c.allowed || game.treasury < c.cost} title={c.why ?? ''} onClick={() => start({ kind: 'ship', ship: t })}>{c.allowed ? 'Build' : c.why}</button>
                  </div>
                </div>
              );
            })}
            <div className="offer">
              <div className="offer-mark" aria-hidden>⚓</div>
              <div>
                <b>Enlarge the port</b>{up ? ` · ${fmt(upCost.cost)} · ${upCost.build} seasons` : ''}
                <div className="muted small">{up ? up.blurb : 'The harbour is as large as it can be.'}</div>
                <button disabled={!!p || !up || game.treasury < upCost.cost} onClick={() => start({ kind: 'port' })}>Begin works</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
