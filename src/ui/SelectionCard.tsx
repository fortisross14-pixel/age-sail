import { useStore } from '../store';
import { provisionsMax, maxMoves, leaderOf, slotsUsed, slotsMax, isPortal, canCross, portById, cargoUsed, cargoCapacity, provisionCost } from '../sim/game';
import { fmt } from './format';
import { GRIDS } from '../sim/hex';
import { isWater } from '../data/terrain';
import { UNIT_INFO } from '../data/court';
import { partyMaxMoves, partyUnits } from '../sim/land';
import { personById } from '../sim/court';
import { canFound, foundingNeeds } from '../sim/colony';
import { nationOfSite, partyStrength, defenceOf, alliedHelp, odds } from '../sim/natives';
import { rivalColonyDefence } from '../sim/rivals';
import { CROWN } from '../render/palette';
import { GOOD_INFO, type GoodId } from '../data/goods';
import { ShipIcon } from './Icon';

/** A compact card for the selected fleet: what it has, and what it can do next. */
export function SelectionCard() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const map = useStore((s) => s.map);
  const selected = useStore((s) => s.selectedFleet);
  const preview = useStore((s) => s.preview);
  const run = useStore((s) => s.run);
  const confirm = useStore((s) => s.confirmPreview);
  const set = useStore((s) => s.set);
  const landing = useStore((s) => s.landing);
  const partyId = useStore((s) => s.selectedParty);
  const party = game.parties.find((p) => p.id === partyId && p.map === map);
  if (party) return <PartyCard partyId={party.id} />;
  const fleet = game.fleets.find((f) => f.id === selected && f.map === map);
  if (!fleet) return null;
  const g = GRIDS[fleet.map];
  const shoreNear = [fleet.hex, ...g.neighbors(fleet.hex)].some((h) => !isWater(world[fleet.map].terrain[h]) && game.fog[fleet.map][h] > 0);
  const aboard = game.units.filter((u) => u.fleet === fleet.id).length;
  const leader = leaderOf(game, fleet);
  const port = fleet.at ? portById(world, fleet.at, game) : undefined;
  const lowFood = fleet.supplies <= 2;
  return (
    <div className="selection" role="region" aria-label={`Selected fleet ${fleet.name}`}>
      <ShipIcon type={fleet.ships[0].type} size={54} />
      <div className="sel-main">
        <div className="sel-title">
          <b>{fleet.name}</b>
          <span className="muted small">{leader ? `led by ${leader.name}, ${leader.rank}` : 'no one in command'}{port ? ` · at ${port.name}` : ''}</span>
        </div>
        <div className="sel-stats">
          <span title="Movement left this season">⛵ {fleet.moves}/{maxMoves(fleet, game)}</span>
          <span title="Seasons of food and water" className={lowFood ? 'bad' : ''}>🍞 {fleet.supplies}/{provisionsMax(fleet, game)}</span>
          <span title="Crew">⚓ {fleet.crew}</span>
          <span title="Hold">▣ {cargoUsed(fleet)}/{cargoCapacity(fleet)}</span>
          <span title="Places aboard for people and units">☺ {slotsUsed(game, fleet)}/{slotsMax(fleet)}</span>
          <span title="Ships">{fleet.ships.length} ship{fleet.ships.length > 1 ? 's' : ''}</span>
        </div>
        {landing ? (
          <div className="sel-plan"><b>Choose the shore</b> highlighted beside the fleet. Esc cancels.</div>
        ) : preview && preview.fleet === fleet.id ? (
          <div className="sel-plan">
            <b>{preview.turns > 1 ? `${preview.turns} seasons` : 'This season'}</b>{preview.cross ? ', then across the ocean' : ''}
            <span className="muted"> · storm risk {Math.round(preview.risk * 100)}%{preview.provision ? ` · provisions ${fmt(preview.provision)}` : ''}</span>
            {preview.turns > fleet.supplies && !fleet.at && <span className="bad"> · food runs out on the way</span>}
            {preview.crossBlocked && <span className="bad"> · needs an explorer in command</span>}
            {preview.deep > 0 && <span className="bad"> · open ocean: stores spoil twice as fast and storms are fiercer</span>}
          </div>
        ) : fleet.order ? (
          <div className="sel-plan muted">Under orders{fleet.order.cross ? ' to cross the ocean' : ''}: {fleet.order.path.length - 1} hexes to go.</div>
        ) : (
          <div className="sel-plan muted">Click the sea or a port to plan · Space to sail · right-click sails at once</div>
        )}
      </div>
      <div className="sel-actions">
        {preview && preview.fleet === fleet.id && (
          <>
            <button className="primary" disabled={preview.crossBlocked} onClick={() => void confirm()}>Sail</button>
            <button onClick={() => set({ preview: null })}>Cancel</button>
          </>
        )}
        {!preview && fleet.order && <button onClick={() => void run({ kind: 'cancelOrder', fleet: fleet.id })}>Stop</button>}
        {isPortal(world, fleet) && !preview && (
          <button className="primary" disabled={fleet.moves <= 0 || !canCross(game, fleet)} onClick={() => void run({ kind: 'cross', fleet: fleet.id })}>
            {fleet.map === 'old' ? 'Cross ⟵' : 'To Europe ⟶'}
          </button>
        )}
        {port && !preview && <button onClick={() => set(port.kind === 'colony' ? { drawer: 'cities', selectedColony: port.id } : { drawer: 'markets', selectedPort: port.id })}>{port.kind === 'colony' ? 'Colony' : 'Trade'}</button>}
        {port && !preview && provisionCost(world, fleet, game) > 0 && (
          <button onClick={() => void run({ kind: 'provision', fleet: fleet.id })}>Provision · {fmt(provisionCost(world, fleet, game))}</button>
        )}
        {!preview && shoreNear && (aboard > 0 || leaderOf(game, fleet)?.rank === 'explorer') && !landing && (
          <>
            <button className="primary" title="Put the units aboard ashore, with the explorer" onClick={() => set({ landing: { leader: leaderOf(game, fleet)?.rank === 'explorer' } })}>Land party</button>
            {leaderOf(game, fleet) && aboard > 0 && <button title="Units go ashore; the leader stays with the ships" onClick={() => set({ landing: { leader: false } })}>Land units only</button>}
          </>
        )}
        {!preview && port?.kind === 'native' && (() => {
          const n = nationOfSite(world, port.id);
          const st = n ? game.natives[n.id] : undefined;
          if (!n || !st) return null;
          const hasMissionary = game.units.some((u) => u.fleet === fleet.id && u.type === 'missionary');
          return (
            <>
              {!st.post && <button title="Needs 20 timber and 10 tools in the hold, and a people who are not wary" onClick={() => void run({ kind: 'tradingPost', fleet: fleet.id })}>Trading post</button>}
              {!st.mission && hasMissionary && <button onClick={() => void run({ kind: 'mission', fleet: fleet.id })}>Found mission</button>}
              <button onClick={() => set({ drawer: 'court', courtTab: 'peoples' })}>The {n.people}</button>
            </>
          );
        })()}
        {!preview && <button onClick={() => set({ drawer: 'fleets' })}>Details</button>}
      </div>
      <button className="x" onClick={() => useStore.getState().selectFleet(null)} aria-label="Deselect">×</button>
    </div>
  );
}

function PartyCard({ partyId }: { partyId: number }) {
  const game = useStore((s) => s.game)!;
  const preview = useStore((s) => s.preview);
  const run = useStore((s) => s.run);
  const confirm = useStore((s) => s.confirmPreview);
  const set = useStore((s) => s.set);
  const world = useStore((s) => s.world)!;
  const p = game.parties.find((x) => x.id === partyId)!;
  const g = GRIDS[p.map];
  const leader = personById(game, p.leader);
  const units = partyUnits(game, p);
  const ships = game.fleets.filter((f) => f.map === p.map && (f.hex === p.hex || g.neighbors(p.hex).includes(f.hex)));
  return (
    <div className="selection" role="region" aria-label={`Selected party ${p.name}`}>
      <img src={`${import.meta.env.BASE_URL}sprites/${units[0] ? UNIT_INFO[units[0].type].sprite : 'units/scout'}.png`} alt="" height={54} />
      <div className="sel-main">
        <div className="sel-title">
          <b>{p.name}</b>
          <span className="muted small">{leader ? `led by ${leader.name}` : 'no leader'} · ashore</span>
        </div>
        <div className="sel-stats">
          <span title="Movement left this season">🥾 {p.moves}/{partyMaxMoves(game, p)}</span>
          {units.map((u) => <span key={u.id}>{UNIT_INFO[u.type].name}</span>)}
        </div>
        {preview && preview.party === p.id ? (
          <div className="sel-plan"><b>{preview.turns > 1 ? `${preview.turns} seasons` : 'This season'}</b> on foot</div>
        ) : p.order ? (
          <div className="sel-plan muted">Marching: {p.order.length - 1} hexes to go.</div>
        ) : (
          <div className="sel-plan muted">
            {units.some((u) => u.type === 'colonist') && !canFound(world, game, p).ok ? `To found a colony: ${canFound(world, game, p).why} ` : ''}
            Click land to march · they survey as they go, and follow rumours (?)
          </div>
        )}
      </div>
      <div className="sel-actions">
        {preview && preview.party === p.id && (
          <>
            <button className="primary" onClick={() => void confirm()}>March</button>
            <button onClick={() => set({ preview: null })}>Cancel</button>
          </>
        )}
        {!preview && p.order && <button onClick={() => void run({ kind: 'stopParty', party: p.id })}>Halt</button>}
        {!preview && game.rivalColonies.filter((c) => c.map === p.map && (c.hex === p.hex || g.neighbors(p.hex).includes(c.hex))).map((c) => {
          const o = odds(partyStrength(game, p), rivalColonyDefence(c));
          return (
            <button key={c.id} className="danger" title={`Your strength ${partyStrength(game, p).toFixed(1)} against ${rivalColonyDefence(c)}. ${game.rivals[c.crown].relation === 'war' ? '' : 'This means war.'}`}
              onClick={() => void run({ kind: 'storm', party: p.id, colony: c.id })}>Storm {c.name} ({CROWN[c.crown].name}) · {Math.round(o * 100)}%</button>
          );
        })}
        {!preview && world[p.map].nations.flatMap((n) => [n.siteHex, ...n.villages].filter((h) => (h === p.hex || g.neighbors(p.hex).includes(h)) && !game.natives[n.id].lost.includes(h)).map((h) => ({ n, h }))).slice(0, 2).map(({ n, h }) => {
          const st = game.natives[n.id];
          if (st.relation === 'subject') return null;
          const a = partyStrength(game, p) + alliedHelp(world, game, n);
          const o = odds(a, defenceOf(world, n, st, h));
          return (
            <span key={h} className="row" style={{ margin: 0 }}>
              {units.some((u) => u.type === 'missionary') && !st.mission && <button onClick={() => void run({ kind: 'mission', party: p.id })}>Mission to the {n.people}</button>}
              <button className="danger" title={`Your strength ${a.toFixed(1)} against about ${defenceOf(world, n, st, h).toFixed(0)}. War with them; every people will resent it.`}
                onClick={() => void run({ kind: 'attack', party: p.id, hex: h })}>Attack the {n.people} · {Math.round(o * 100)}%</button>
            </span>
          );
        })}
        {!preview && units.some((u) => u.type === 'colonist') && (() => {
          const chk = canFound(world, game, p);
          const needs = Object.entries(foundingNeeds(game, p)).map(([g, n]) => `${n} ${GOOD_INFO[g as GoodId].name.toLowerCase()}`).join(', ');
          return (
            <button className="primary" disabled={!chk.ok} title={chk.ok ? `Uses ${needs} from the fleet beside you` : chk.why}
              onClick={async () => { if (await run({ kind: 'found', party: p.id })) { const st = useStore.getState(); const c = st.game?.colonies.at(-1); st.set({ drawer: 'cities', selectedColony: c?.id ?? null }); } }}>
              Found colony
            </button>
          );
        })()}
        {!preview && ships.map((f) => (
          <button key={f.id} onClick={async () => {
            if (await run({ kind: 'boardParty', party: p.id, fleet: f.id })) useStore.getState().selectFleet(f.id);
          }}>Board {f.name}</button>
        ))}
      </div>
      <button className="x" onClick={() => useStore.getState().selectParty(null)} aria-label="Deselect">×</button>
    </div>
  );
}
