import { useStore } from '../store';
import { GIFT_INFO, HOUSES } from '../data/dynasty';
import { realmSpec, type RealmId } from '../data/realms';
import { ERAS } from '../data/eras';
import { styled, royalAge, eraProgress, GOAL_WORD } from '../sim/dynasty';
import { reignHistory } from '../sim/history';
import { biography, COURT } from '../sim/court';
import { rivalSpec } from '../data/rivals';
import { yearOf, type Person, type Royal } from '../sim/types';
import { Art } from './theme/Art';
import { fmt } from './format';

/** A painted face for one of the royal house, by sex and age. */
function RoyalFace({ r, turn }: { r: Royal; turn: number }) {
  const n = Math.max(0, Math.min(11, Math.round(((royalAge(r, turn) - 20) / 50) * 11)));
  return <span className="portrait card"><Art slot={`portrait/${r.sex === 'f' ? 'women' : 'men'}-${n + 1}`} fallback={<span className="royal-initial">{r.name[0]}</span>} alt={r.name} /></span>;
}

/** Court, Dynasty: who rules, who follows, whom to marry, and what the age has been promised. */
export function Dynasty() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const d = game.dynasty;
  const h = HOUSES[game.crown];
  const year = yearOf(game.turn);
  const era = eraProgress(world, game);
  const eraName = game.eraPath ? ERAS.find((e) => e.id === game.eraPath!.era)?.name : null;
  const heirs = [...d.heirs].sort((a, b) => a.born - b.born);
  return (
    <div className="dynasty">
      <section className="detail-card royal">
        <RoyalFace r={d.ruler} turn={game.turn} />
        <div>
          <h3>{styled(game.crown, d.ruler)}</h3>
          <div className="muted">House of {d.house} · {royalAge(d.ruler, game.turn)} years · reigning since {d.reigns[d.reigns.length - 1]?.from}</div>
          {d.regency
            ? <p><b>A regency.</b> A regent governs until {d.ruler.name} is of age: taxes come in slower and the colonies are less sure of you. The ruler’s gift counts for nothing yet.</p>
            : <p><b>{GIFT_INFO[d.ruler.gift].name}.</b> {GIFT_INFO[d.ruler.gift].blurb}</p>}
          <p className="muted small">
            {d.consort ? <>Married to {d.consort.name}{d.consort.from ? ` of ${realmSpec(d.consort.from as RealmId).name}` : ''}, {royalAge(d.consort, game.turn)}.</> : 'Unmarried.'}
            {d.ties.length > 0 && <> Bound by marriage to {d.ties.map((t) => realmSpec(t as RealmId).name).join(' and ')}: their crown is slow to quarrel with you.</>}
          </p>
        </div>
      </section>

      <h4>The succession</h4>
      {heirs.length === 0 && <p className="muted">No heir. If {d.ruler.name} dies now, a cousin will be acclaimed, and the realm will pay for the doubt in prestige and loyalty.</p>}
      <ul className="heirs">
        {heirs.map((x, i) => (
          <li key={x.id} className="heir-card">
            <RoyalFace r={x} turn={game.turn} />
            <div>
              <b>{x.sex === 'm' ? 'Prince' : 'Princess'} {x.name}</b>{i === 0 && <span className="rank-badge"> heir</span>}
              <div className="muted small">{year - x.born} years · {GIFT_INFO[x.gift].name.toLowerCase()}{year - x.born < 16 ? ' · would need a regent' : ''}</div>
            </div>
          </li>
        ))}
      </ul>

      {d.offers.length > 0 && <>
        <h4>Offers of marriage</h4>
        <p className="muted small">A consort brings a dowry, prestige, heirs, and a tie to their house. Offers come every two years while {d.ruler.name} is unmarried; prestige raises the dowries.</p>
        <ul className="heirs">
          {d.offers.map((o) => (
            <li key={o.id} className="heir-card">
              <div>
                <b>{o.name} of {realmSpec(o.realm as RealmId).name}</b>
                <div className="muted small">{year - o.born} years · {GIFT_INFO[o.gift].name.toLowerCase()} · dowry {fmt(o.dowry)} ducats{rivalSpec(o.realm as never) && o.realm !== game.crown ? ' · a rival crown: they will think much better of you' : ''}</div>
              </div>
              <button onClick={() => void run({ kind: 'marry', offer: o.id })}>Marry</button>
            </li>
          ))}
        </ul>
      </>}

      <h4>The path of the age</h4>
      {era && eraName
        ? <p><b>{era.path.name}</b> ({eraName}). {era.path.blurb} Goal: {fmt(Math.min(era.have, era.need))} of {fmt(era.need)} more {GOAL_WORD[era.path.goal.kind]} before the age ends.</p>
        : <p className="muted">No path has been chosen yet. Each new age offers three.</p>}

      <h4>Reigns</h4>
      <p className="muted small">{d.reigns.map((r) => `${r.name}, ${r.from}–${r.to ?? ''}`).join(' · ')}</p>
      <p className="muted small">Great houses of the realm: {h.houses.join(', ')}.</p>
    </div>
  );
}

/** How a courtier stands with you, and why; what they want; who their rivals, friends and kin are; their life. */
export function CourtierStanding({ p }: { p: Person }) {
  const game = useStore((s) => s.game)!;
  const mood = p.loyalty <= COURT.leaving ? 'ready to leave' : p.loyalty < 40 ? 'discontented' : p.loyalty < 70 ? 'content' : 'devoted';
  const bonds = p.bonds.map((b) => ({ b, o: game.people.find((x) => x.id === b.with && x.alive) })).filter((x) => x.o);
  const life = biography(game, p);
  return (
    <div className="standing">
      {p.alive && <>
        <div className="loyalty-line"><span>Loyalty</span><div className="attitude" title={`${p.loyalty} of 100`}><div className="att-mid" /><div className="att-dot" style={{ left: `${p.loyalty}%` }} /></div><b>{mood}</b></div>
        {p.memory.length > 0 && <ul className="reasons">{[...p.memory].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 4).map((m) => <li key={m.why} className={m.amount < 0 ? 'bad' : 'good'}>{m.amount > 0 ? '+' : '−'}{Math.abs(Math.round(m.amount))} {m.why}</li>)}</ul>}
        {p.want && <p className="small"><b>Wants</b> {p.want.kind === 'rank' ? 'a commission: explorer, merchant or governor' : 'a fleet to lead'}, since {yearOf(p.want.since)}. Kept waiting, they will hold it against you.</p>}
        {bonds.length > 0 && <p className="small">{bonds.map(({ b, o }) => `${b.kind === 'rival' ? 'Rival of' : b.kind === 'friend' ? 'Friend of' : 'Kin to'} ${o!.name}`).join(' · ')}. Raising one of them pleases friends and kin, and galls rivals.</p>}
      </>}
      {life.length > 1 && <details className="life"><summary>Their life</summary>{life.map((l, i) => <p key={i} className="small">{l}</p>)}</details>}
    </div>
  );
}

/** The reign told back, for the Chronicle and the end of the age. */
export function ReignHistory({ open = false }: { open?: boolean }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  return (
    <details className="reign-history" open={open}>
      <summary>The history of your reign</summary>
      {reignHistory(world, game).map((t, i) => <p key={i}>{t}</p>)}
    </details>
  );
}
