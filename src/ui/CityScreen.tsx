import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { SHIPS, type ShipType } from '../data/ships';
import { UNIT_INFO } from '../data/court';
import { BUILDINGS, BUILDING_ORDER, UNIT_SPECS, type BuildingId } from '../data/city';
import { crownSpec } from '../data/rivals';
import { GOOD_INFO, GOODS } from '../data/goods';
import { realmSpec } from '../data/realms';
import { portById, projectCost, citySlots, slotsUsedIn, cityTaxes, mainPort, spreadFor } from '../sim/game';
import { personById } from '../sim/court';
import { unitPrice } from '../sim/market';
import type { City, ProjectKind, UnitType } from '../sim/types';
import { spriteUrl } from '../render/assets';
import { CROWN } from '../render/palette';
import { fmt } from './format';
import { Tabs } from './Drawers';
import { ColonyCard, TaxRate } from './CitiesDrawer';
import { Art, Medal } from './theme/Art';
import { Frame } from './theme/Frame';
import { Icon, Crest, type IconName } from './theme/icons';
import { sfx } from './sound';

const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const SIZE_NAME = { 3: 'Great city', 2: 'City', 1: 'Town' } as const;
/** ink sprites that stand in for the painted building art */
const BUILDING_SPRITE: Record<BuildingId, string> = {
  docks: 'colonies/port-town', barracks: 'colonies/fort-town', church: 'colonies/mission-town', university: 'colonies/mission-city', market: 'colonies/trading-post-town',
};
const ROLE: Record<BuildingId, string> = { docks: 'Shipyard', barracks: 'Military centre', church: 'Mission seat', university: 'Seat of learning', market: 'Trade centre' };
const ROLE_LONG: Record<BuildingId, string> = { docks: 'a shipyard', barracks: 'a military centre', church: 'a mission seat', university: 'a seat of learning', market: 'a trade centre' };

const buildingArt = (b: BuildingId) => <Art slot={`building/${b}`} fallback={<img src={spriteUrl(BUILDING_SPRITE[b])} alt="" />} />;
const unitArt = (u: UnitType) => <Art slot={`unit/${u}`} fallback={<img src={spriteUrl(UNIT_INFO[u].sprite)} alt="" />} />;
const shipArt = (t: ShipType) => <Art slot={`ship/${t}`} fallback={<img src={spriteUrl(`ships/${t}`)} alt="" />} />;

type CityTab = 'overview' | 'buildings' | 'economy' | 'recruit';

/** The Cities panel: one of your cities at a time, or the list of all of them and your colonies. */
export function Cities() {
  const game = useStore((s) => s.game)!;
  const selectedPort = useStore((s) => s.selectedPort);
  const selectedColony = useStore((s) => s.selectedColony);
  const [list, setList] = useState(() => !!selectedColony && selectedPort === selectedColony);
  const cityId = selectedPort && game.cities[selectedPort] ? selectedPort : mainPort(game);
  if (list) return <CityList onPick={(id) => { useStore.getState().set({ selectedPort: id }); setList(false); sfx('page'); }} />;
  return <CityScreen key={cityId} cityId={cityId} onList={() => { setList(true); sfx('page'); }} />;
}

function ordered(cities: Record<string, City>, main: string) {
  return Object.values(cities).sort((a, b) => Number(b.id === main) - Number(a.id === main) || b.size - a.size || Number(a.inland) - Number(b.inland));
}

function CityScreen({ cityId, onList }: { cityId: string; onList: () => void }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const [tab, setTab] = useState<CityTab>('buildings');
  const city = game.cities[cityId];
  const port = portById(world, cityId)!;
  const all = ordered(game.cities, mainPort(game));
  const k = all.findIndex((c) => c.id === cityId);
  const go = (d: number) => { sfx('page'); set({ selectedPort: all[(k + d + all.length) % all.length].id }); };
  const colours = CROWN[game.crown];
  const kind = [SIZE_NAME[city.size], city.inland ? 'inland' : 'port', `${citySlots(city)} places`, `+${cityTaxes(city)} / season`].join(' · ');
  return (
    <>
      <header className="drawer-head city-head">
        <div className="vignette"><Art slot={`city/${cityId}`} fallback={<img src={spriteUrl(city.inland ? 'colonies/fort-city' : 'colonies/port-city')} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'right center', opacity: .9 }} />} /></div>
        <Crest primary={colours.css2} secondary={colours.css} size={52} />
        <div>
          <h2>{port.name}</h2>
          <div className="sub">{kind}</div>
          <div className="city-nav">
            <button className="adm-medal small" onClick={() => go(-1)} aria-label="Previous city" title="Previous city"><Icon name="prev" size={18} /></button>
            <button className="adm-medal small" onClick={() => go(1)} aria-label="Next city" title="Next city"><Icon name="nextArrow" size={18} /></button>
            <button className="link" onClick={onList}>All cities and colonies ({all.length + game.colonies.length})</button>
          </div>
        </div>
      </header>
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['buildings', 'Buildings'], ['economy', 'Economy'], ['recruit', 'Recruitment']]} />
      <div className="tab-pane" key={tab}>
        {tab === 'overview' && <Overview city={city} />}
        {tab === 'buildings' && <Buildings city={city} />}
        {tab === 'economy' && <Economy city={city} />}
        {tab === 'recruit' && <Recruitment city={city} />}
      </div>
    </>
  );
}

function projectLabel(p: ProjectKind) {
  return p.kind === 'ship' ? SHIPS[p.ship].name : p.kind === 'unit' ? UNIT_INFO[p.unit].name : BUILDINGS[p.building].name;
}

function Overview({ city }: { city: City }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const governor = personById(game, city.governor);
  const units = game.units.filter((u) => u.city === city.id && u.fleet == null && u.party == null);
  const docked = game.fleets.filter((f) => f.at === city.id);
  const roles = BUILDING_ORDER.filter((b) => city.buildings[b] > 0);
  const p = city.project;
  const port = portById(world, city.id)!;
  return (
    <>
      <div className="sec">What {port.name} is</div>
      <div className="roles">
        {city.id === mainPort(game) && <span className="role-chip"><Medal name="court" size={26} fallback={<Icon name="court" size={18} tone="ink" />} />Capital and main port</span>}
        {roles.map((b) => <span key={b} className="role-chip"><Medal name={b} size={26} fallback={<Icon name={b as IconName} size={18} tone="ink" />} />{ROLE[b]} {ROMAN[city.buildings[b]]}</span>)}
        {!roles.length && <span className="muted">Nothing built yet. What you build here decides what it becomes.</span>}
      </div>
      <div className="sec">At a glance</div>
      <div className="facts">
        <div className="fact"><Icon name="taxes" tone="ink" /><b>+{cityTaxes(city)}</b><span>ducats a season</span></div>
        <div className="fact"><Icon name="docks" tone="ink" /><b>{city.inland ? 'Inland' : city.buildings.docks ? `Docks ${ROMAN[city.buildings.docks]}` : 'Quay only'}</b><span>{city.inland ? 'units march to the nearest port' : `${docked.length} fleet${docked.length === 1 ? '' : 's'} in port`}</span></div>
        <div className="fact"><Icon name="construction" tone="ink" /><b>{p ? projectLabel(p) : 'Idle'}</b><span>{p ? `${p.turnsLeft} season${p.turnsLeft === 1 ? '' : 's'} to go` : 'no project under way'}</span></div>
        <div className="fact"><Icon name="units" tone="ink" /><b>{governor ? governor.name : 'No governor'}</b><span>{governor ? `construction ${governor.skills.construction}` : <button className="link" onClick={() => set({ drawer: 'court', courtTab: 'people' })}>appoint one at court</button>}</span></div>
      </div>
      {units.length > 0 && <>
        <div className="sec">Waiting for a ship <span className="count">{units.length}</span></div>
        <div className="roles">{units.map((u) => <span key={u.id} className="role-chip">{UNIT_INFO[u.type].name}</span>)}</div>
      </>}
    </>
  );
}

function Buildings({ city }: { city: City }) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const tiles: { b: BuildingId; lv: number }[] = [];
  for (const b of BUILDING_ORDER) for (let lv = 1; lv <= city.buildings[b]; lv++) tiles.push({ b, lv });
  const building = city.project?.kind === 'building' ? city.project : null;
  const slots = citySlots(city);
  const empty = Math.max(0, slots - tiles.length - (building ? 1 : 0));
  const [sel, setSel] = useState<BuildingId | null>(tiles.length ? tiles[tiles.length - 1].b : null);
  const [picking, setPicking] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const governor = personById(game, city.governor);
  const edge = crownSpec(game.crown).edge;
  const start = async (k: ProjectKind) => {
    const ok = await run({ kind: 'project', city: city.id, project: k });
    if (ok && k.kind === 'building') { setPicking(false); setSel(k.building); setFresh(k.building); }
  };
  const selCost = sel ? projectCost({ kind: 'building', building: sel }, city, governor, edge) : null;
  const lvSel = sel ? city.buildings[sel] : 0;
  return (
    <>
      <div className="buildings-split">
      <div>
      <div className="sec">Building places <span className="count">({slots})</span></div>
      <div className="tiles">
        {tiles.map((t) => (
          <button key={`${t.b}${t.lv}`} className={`tile ${sel === t.b && t.lv === city.buildings[t.b] ? 'selected' : ''}`}
            onClick={() => { sfx('select'); setSel(t.b); }} aria-label={`${BUILDINGS[t.b].name} level ${t.lv}`}>
            <span className="art">{buildingArt(t.b)}</span>
            <span>{BUILDINGS[t.b].name} {ROMAN[t.lv]}</span>
            <span className="level">{ROMAN[t.lv]}</span>
          </button>
        ))}
        {building && (() => {
          const c = 2 * Math.PI * 44, done = (building.total - building.turnsLeft) / building.total;
          return (
            <button className={`tile busy ${fresh === building.building ? 'fresh' : ''}`} onClick={() => { sfx('select'); setSel(building.building); }}
              aria-label={`${BUILDINGS[building.building].name} under construction, ${building.turnsLeft} seasons left`}>
              <svg className="ring" viewBox="0 0 100 100" aria-hidden><circle className="bg" cx="50" cy="50" r="44" /><circle className="fg" cx="50" cy="50" r="44" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.06, done))} /></svg>
              <span className="art" style={{ opacity: .55 }}>{buildingArt(building.building)}</span>
              <span>{building.turnsLeft} season{building.turnsLeft === 1 ? '' : 's'}</span>
              <span className="level">{ROMAN[city.buildings[building.building] + 1]}</span>
            </button>
          );
        })()}
        {Array.from({ length: empty }, (_, i) => (
          <button key={`e${i}`} className="tile empty" onClick={() => { if (city.project) { sfx('error'); useStore.getState().say(`${projectLabel(city.project)} first: one project at a time.`, true); return; } setPicking(true); }} aria-label="Empty place: choose a building">
            <span className="art"><Icon name="plus" tone="ink" /></span>
            <span>Add</span>
          </button>
        ))}
      </div>
      <p className="muted small">Each level of a building takes one place. {slotsUsedIn(city) + (building ? 1 : 0)} of {slots} used. One project at a time.</p>
      </div>
      {sel && selCost ? (
        <div className="detail-card" key={sel}>
          <span className="art">{buildingArt(sel)}</span>
          <h3>{BUILDINGS[sel].name} {lvSel ? ROMAN[lvSel] : ''}</h3>
          <div>{BUILDINGS[sel].blurb}</div>
          <div className="effects">
            {lvSel > 0 && <div><Icon name={sel as IconName} size={20} tone="ink" />{BUILDINGS[sel].effect[lvSel]}</div>}
            {BUILDINGS[sel].effect[lvSel + 1] && <div className="muted"><Icon name="nextArrow" size={20} tone="ink" />Level {ROMAN[lvSel + 1]}: {BUILDINGS[sel].effect[lvSel + 1]}</div>}
          </div>
          <div className="foot" style={{ gridColumn: '1 / -1' }}>
            {selCost.allowed
              ? <button className="adm-gold-btn" disabled={!!city.project || game.treasury < selCost.cost} onClick={() => void start({ kind: 'building', building: sel })}
                  title={city.project ? 'One project at a time' : ''}>
                  {lvSel ? 'Enlarge' : 'Build'} · <span className="cost-tag">{fmt(selCost.cost)} <img src={spriteUrl('goods/gold')} alt="ducats" /></span> · {selCost.build} seasons
                </button>
              : <span className="muted">{selCost.why}</span>}
          </div>
        </div>
      ) : <div className="detail-card"><span className="muted">Choose a building to see what it does, or an empty place to add one.</span></div>}
      </div>
      {picking && <BuildPicker city={city} onClose={() => setPicking(false)} onBuild={(b) => void start({ kind: 'building', building: b })} />}
    </>
  );
}

/** The short list of what can go in an empty place, with the details one click away. */
function BuildPicker({ city, onClose, onBuild }: { city: City; onClose: () => void; onBuild: (b: BuildingId) => void }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const [info, setInfo] = useState<BuildingId | null>(null);
  const [leaving, setLeaving] = useState(false);
  const governor = personById(game, city.governor);
  const edge = crownSpec(game.crown).edge;
  const close = () => { sfx('close'); setLeaving(true); setTimeout(onClose, 220); };
  useEffect(() => {
    sfx('open');
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const free = citySlots(city) - slotsUsedIn(city);
  const name = portById(world, city.id)!.name;
  // portalled to the game screen: the sliding panel's transform would otherwise trap the overlay inside it
  return createPortal(
    <div className={`adm-modal-back ${leaving ? 'leave' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <Frame className="adm-modal" role="dialog" aria-modal="true" aria-label={`Build in ${name}`}>
        <button className="adm-medal adm-close" onClick={close} aria-label="Close"><Icon name="close" size={20} /></button>
        <header><h2>Build in {name}</h2><p>{free} of {citySlots(city)} places free · one project at a time</p></header>
        <div className="list">
          {BUILDING_ORDER.map((b) => {
            const lv = city.buildings[b] + 1;
            const c = projectCost({ kind: 'building', building: b }, city, governor, edge);
            const top = !BUILDINGS[b].levels[lv];
            return (
              <div key={b} className={`choice ${top ? 'done' : ''}`}>
                <span className="art">{buildingArt(b)}</span>
                <span className="t"><b>{BUILDINGS[b].name}{lv > 1 && !top ? ` ${ROMAN[lv]}` : ''}</b><span>{top ? 'As large as it can be' : c.allowed ? BUILDINGS[b].effect[lv] : c.why}</span></span>
                <span className="cost-tag">{!top && c.allowed && <>{fmt(c.cost)} <img src={spriteUrl('goods/gold')} alt="ducats" /> · {c.build} s.</>}</span>
                <button className="info" aria-expanded={info === b} aria-label={`More about ${BUILDINGS[b].name}`} onClick={() => { sfx('page'); setInfo(info === b ? null : b); }}>i</button>
                <button className="adm-gold-btn" disabled={top || !c.allowed || game.treasury < c.cost} onClick={() => onBuild(b)}>Build</button>
                {info === b && (
                  <div className="more">
                    {BUILDINGS[b].blurb} Building it makes {name} {ROLE_LONG[b]}.
                    <dl>{BUILDINGS[b].levels.slice(1).map((l, i) => <Fragment key={i}><dt>Level {ROMAN[i + 1]}</dt><dd>{BUILDINGS[b].effect[i + 1]} · {fmt(l.cost)} ducats, {l.build} seasons{i + 1 <= city.buildings[b] ? ' · built' : ''}</dd></Fragment>)}</dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Frame>
    </div>,
    document.querySelector('.game') ?? document.body,
  );
}

function Economy({ city }: { city: City }) {
  const game = useStore((s) => s.game)!;
  const set = useStore((s) => s.set);
  const base = city.taxes, dues = city.buildings.market * 60, research = city.buildings.university * 2;
  const book = game.markets[city.id];
  const sp = spreadFor(game);
  return (
    <>
      <div className="sec">Each season</div>
      <div className="ledger">
        <div className="line"><Icon name="taxes" tone="ink" /><span>Taxes <span className="muted small">({SIZE_NAME[city.size].toLowerCase()} of {realmSpec(game.crown).name})</span></span><span className="amount plus">+{base}</span></div>
        <div className="line"><Icon name="market" tone="ink" /><span>Market dues <span className="muted small">(market {ROMAN[city.buildings.market] || 'none'})</span></span><span className="amount plus">+{dues}</span></div>
        {research > 0 && <div className="line"><Icon name="university" tone="ink" /><span>Scholars <span className="muted small">(research points)</span></span><span className="amount">+{research}</span></div>}
        <div className="line total"><span /><span>Total</span><span className="amount plus">+{base + dues} ducats</span></div>
      </div>
      {book && <>
        <div className="sec">Prices here <button className="link" style={{ marginLeft: 'auto' }} onClick={() => set({ drawer: 'markets', selectedPort: city.id })}>open the market</button></div>
        <div className="ledger">
          {GOODS.filter((g) => book[g]).slice(0, 10).map((g) => {
            const m = book[g]!; const p = unitPrice(m);
            return (
              <div className="line" key={g}>
                <img src={spriteUrl(GOOD_INFO[g].icon)} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <span>{GOOD_INFO[g].name}</span>
                <span className="amount">{Math.round(p * (1 - sp))} <span className="muted small">sell</span> · {Math.round(p * (1 + sp))} <span className="muted small">buy</span></span>
              </div>
            );
          })}
        </div>
      </>}
      {city.inland && <p className="muted">An inland city has no market of its own: its merchants trade through the nearest port.</p>}
    </>
  );
}

function Recruitment({ city }: { city: City }) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const governor = personById(game, city.governor);
  const edge = crownSpec(game.crown).edge;
  const p = city.project;
  const offer = (k: ProjectKind) => projectCost(k, city, governor, edge);
  return (
    <>
      {p && <div className="detail-card" style={{ gridTemplateColumns: '1fr' }}><b>Under way: {projectLabel(p)}</b><span className="muted">{p.turnsLeft} season{p.turnsLeft === 1 ? '' : 's'} to go. One project at a time.</span></div>}
      <div className="sec">Units</div>
      <div className="offer-cards">
        {(['colonist', 'infantry', 'missionary'] as UnitType[]).map((u) => {
          const c = offer({ kind: 'unit', unit: u });
          return (
            <div key={u} className={`offer-card ${c.allowed ? '' : 'locked'}`} title={UNIT_INFO[u].blurb}>
              {unitArt(u)}
              <b>{UNIT_INFO[u].name}</b>
              <span className="meta">{fmt(c.cost)} · {c.build} season{c.build > 1 ? 's' : ''} · upkeep {UNIT_SPECS[u].upkeep}</span>
              {c.allowed ? <button className="adm-gold-btn" disabled={!!p || game.treasury < c.cost} onClick={() => void run({ kind: 'project', city: city.id, project: { kind: 'unit', unit: u } })}>Train</button>
                : <span className="meta">{c.why}</span>}
            </div>
          );
        })}
      </div>
      {!city.inland && <>
        <div className="sec">Ships</div>
        <div className="offer-cards">
          {(Object.keys(SHIPS) as ShipType[]).map((t) => {
            const c = offer({ kind: 'ship', ship: t });
            return (
              <div key={t} className={`offer-card ${c.allowed ? '' : 'locked'}`} title={SHIPS[t].blurb}>
                {shipArt(t)}
                <b>{SHIPS[t].name}</b>
                <span className="meta">{fmt(c.cost)} · {c.build} seasons · hold {SHIPS[t].cargo}</span>
                {c.allowed ? <button className="adm-gold-btn" disabled={!!p || game.treasury < c.cost} onClick={() => void run({ kind: 'project', city: city.id, project: { kind: 'ship', ship: t } })}>Build</button>
                  : <span className="meta">{c.why}</span>}
              </div>
            );
          })}
        </div>
      </>}
      {city.inland && <p className="muted">Units trained here march to the nearest of your ports to wait for a ship.</p>}
    </>
  );
}

/** Every city of your realm, then your colonies overseas. */
function CityList({ onPick }: { onPick: (id: string) => void }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const all = ordered(game.cities, mainPort(game));
  return (
    <>
      <header className="drawer-head">
        <span className="adm-medal" aria-hidden><Medal name="cities" size={60} fallback={<Icon name="cities" size={26} />} /></span>
        <div><h2>Your cities</h2><div className="sub">{all.length} cities of {realmSpec(game.crown).name} · {game.colonies.length} colon{game.colonies.length === 1 ? 'y' : 'ies'}</div></div>
      </header>
      <div className="tiles">
        {all.map((c) => (
          <button key={c.id} className="tile" onClick={() => onPick(c.id)} title={`${SIZE_NAME[c.size]}${c.inland ? ', inland' : ''} · +${cityTaxes(c)} a season`}>
            <span className="art"><Art slot={`city/${c.id}`} fallback={<img src={spriteUrl(c.inland ? (c.size === 1 ? 'colonies/fort-outpost' : 'colonies/fort-town') : c.size === 1 ? 'colonies/port-outpost' : 'colonies/port-town')} alt="" />} /></span>
            <span>{portById(world, c.id)!.name}</span>
            <span className="level">{c.size === 3 ? 'III' : c.size === 2 ? 'II' : 'I'}</span>
          </button>
        ))}
      </div>
      <div className="sec">Colonies <span className="count">{game.colonies.length || ''}</span></div>
      {game.colonies.length > 0 && <TaxRate />}
      {game.colonies.length ? game.colonies.map((c) => <ColonyCard key={c.id} colonyId={c.id} />) : (
        <p className="muted">None yet. Land a party with colonists on surveyed coast, with a fleet beside it carrying timber and tools, and choose <b>Found colony</b>.</p>
      )}
    </>
  );
}
