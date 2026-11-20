import { useStore } from '../store';
import { races } from '../sim/victory';
import { FAVOURS, VICTORY_NAME, type FavourId } from '../data/scenarios';
import { rivalSpec } from '../data/rivals';
import { FREE } from '../sim/empire';
import { SLAVERY } from '../data/slavery';
import { buysCaptives, groundOf, forbidden, enslavedCap } from '../sim/slavery';
import type { SeaReport } from '../sim/seafight';
import type { Colony, Fleet, PortDef } from '../sim/types';
import { yearOf } from '../sim/types';
import { fmt } from './format';

const pct = (x: number) => `${Math.min(100, Math.round(x * 100))}%`;

/** Court, Crowns: the three races beside the score, and the colonies that have broken away. */
export function Races() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const v = game.victory;
  return (
    <div className="races">
      <h4>Other ways to win</h4>
      <p className="muted small">Beside the score at the end of the age, the first crown to finish one of these races is remembered for it.
        {v && <> <b>{rivalSpec(v.crown).name} won {VICTORY_NAME[v.kind].name.toLowerCase()} in {yearOf(v.turn)}.</b></>}</p>
      <ul className="race-list">
        {races(world, game).map((r) => (
          <li key={r.kind}>
            <b>{r.name}</b>
            <div className="bar" title={`You: ${pct(r.me)}`}><div style={{ width: pct(r.me) }} /></div>
            <span className="small">You {pct(r.me)}{r.best ? ` · ${rivalSpec(r.best.crown).name} ${pct(r.best.share)}` : ''}</span>
          </li>
        ))}
      </ul>
      {game.freeStates.length > 0 && <>
        <h4>Colonies that broke away</h4>
        <ul className="race-list">
          {game.freeStates.map((f) => (
            <li key={f.id}>
              <b>{f.name}</b>
              <span className="small">{f.pop} people, free since {yearOf(f.since)}{f.recognised ? ` · recognised: it pays ${f.pop * FREE.trade} ducats a season in trade` : f.by ? ` · under the protection of ${rivalSpec(f.by).name}: to retake it means war` : ' · its example unsettles your colonies nearby'}</span>
              {!f.recognised && <button title={`Costs ${FREE.recognisePrestige} prestige. It will trade with you and stop unsettling its neighbours. A party beside it can still retake it instead.`} onClick={() => void run({ kind: 'recognise', free: f.id })}>Recognise</button>}
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}

/** Court, Dynasty: what prestige can buy. */
export function Favours() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  return (
    <>
      <h4>Favours <span className="muted small">{Math.floor(game.prestige)} prestige to spend</span></h4>
      <p className="muted small">Prestige also raises dowries, draws better petitioners to court and makes treaties easier to win.</p>
      <div className="favours">
        {(Object.keys(FAVOURS) as FavourId[]).map((id) => (
          <button key={id} disabled={game.prestige < FAVOURS[id].cost} title={FAVOURS[id].blurb} onClick={() => void run({ kind: 'favour', favour: id })}>{FAVOURS[id].name} · {FAVOURS[id].cost}</button>
        ))}
      </div>
    </>
  );
}

/** Markets: captives offered at an African trading ground, or wanted in a southern European port. */
export function CaptivesRow({ port, fleet, free }: { port: PortDef; fleet: Fleet | undefined; free: number }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const ground = groundOf(world, port);
  const buys = buysCaptives(port);
  const aboard = fleet?.captives ?? 0;
  if (!ground && !(buys && aboard > 0)) return null;
  const offered = ground ? Math.floor(game.natives[ground.id]?.captives ?? 0) : 0;
  if (ground && !offered && !aboard) return null;
  const banned = forbidden(game);
  return (
    <div className="notice captives">
      {ground
        ? <span><b>Captives.</b> The {ground.people} offer {offered} prisoners of their wars, at {SLAVERY.buy} ducats each. Each takes the room of {SLAVERY.hold} units of cargo; about one in ten dies each season at sea; their own people will remember whose ships took them.</span>
        : <span><b>Captives.</b> {aboard} aboard. They fetch {SLAVERY.sell} ducats each here.</span>}
      {banned ? <span className="muted small">Forbidden by your law of abolition.</span> : fleet && (
        <span className="row">
          {ground && [1, 5].map((q) => <button key={q} disabled={offered < q || free < q * SLAVERY.hold || game.treasury < q * SLAVERY.buy} onClick={() => void run({ kind: 'buyCaptives', fleet: fleet.id, qty: q })}>Buy {q}</button>)}
          {buys && aboard > 0 && <button onClick={() => void run({ kind: 'sellCaptives', fleet: fleet.id, qty: aboard })}>Sell {aboard}</button>}
        </span>
      )}
    </div>
  );
}

/** A colony's panel: the enslaved held there, and captives waiting aboard a fleet in its harbour. */
export function Enslaved({ colony }: { colony: Colony }) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const held = colony.enslaved ?? 0;
  const fleet = game.fleets.find((f) => f.at === colony.id && (f.captives ?? 0) > 0);
  if (!held && !fleet) return null;
  return (
    <div className="notice captives">
      {held > 0 && <span><b>{held} enslaved people</b> work the land here (room for {enslavedCap(colony)}). They are fed and nothing more. About one in fourteen dies each year, some flee, and where they far outnumber the settlers they will rise unless soldiers hold them down.</span>}
      {fleet && !forbidden(game) && <button onClick={() => void run({ kind: 'landCaptives', fleet: fleet.id })}>Put the {fleet.captives} captives of {fleet.name} to work here</button>}
    </div>
  );
}

/** A fight at sea, round by round. */
export function SeaReportView({ r }: { r: SeaReport }) {
  const side = (x: SeaReport['attacker']) => <th>{x.name[0].toUpperCase() + x.name.slice(1)}<div className="muted small">{fmt(Math.round(x.guns))} guns · {fmt(Math.round(x.crew))} crew</div></th>;
  return (
    <table className="market sea-report">
      <thead><tr><th />{side(r.attacker)}{side(r.defender)}</tr></thead>
      <tbody>
        {r.rounds.map((x) => <tr key={x.name}><td>{x.name}</td><td className={`num ${x.atk > x.def ? 'win' : ''}`}>{x.atk}</td><td className={`num ${x.def > x.atk ? 'win' : ''}`}>{x.def}</td></tr>)}
        <tr><td colSpan={3} className="small">{r.attackerWon ? 'The attacker has the better of it' : 'The defender has the better of it'}{r.escaped ? ', but the beaten side gets away.' : ', and the beaten side cannot get away.'}</td></tr>
      </tbody>
    </table>
  );
}
