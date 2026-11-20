import { useStore } from '../store';
import { REALMS, type RealmId } from '../data/realms';
import { DIPLOMACY as D, TREATY_INFO, CORSAIR_REALMS, type Treaty } from '../data/diplomacy';
import { regardOf, treatyOpen, warsOf, enemyOf, hasEnemy, corsairsHunt } from '../sim/europe';
import { lawOpen, lawPlaces, EXPEDITION } from '../sim/game';
import { LAWS, lawById } from '../data/laws';
import { rivalsOf } from '../data/rivals';
import { CROWN } from '../render/palette';
import { CrestArt } from './theme/Art';
import { fmt } from './format';

const NEXT: Record<Treaty, Exclude<Treaty, 'none'> | null> = { none: 'trade', trade: 'pact', pact: 'alliance', alliance: null };

/** Court, Europe: every other realm, how it regards you, what you have agreed, and the wars you may join. */
export function Europe() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const rivals = new Set(rivalsOf(game.crown).map((r) => r.id as string));
  const name = (id: string) => REALMS.find((r) => r.id === id)!.name;
  const enemy = hasEnemy(game);
  return (
    <div className="europe">
      <p className="muted small">Envoys and gifts win regard; regard wins treaties. A trade treaty means better prices in their ports, a pact that they will not attack you, an alliance that they help in your wars. Realms fight each other over old quarrels, and you may take a side.</p>

      {game.euroWars.length > 0 && <>
        <h4>Wars in Europe</h4>
        <ul className="wars">
          {game.euroWars.map((w) => (
            <li key={w.id} className="heir-card">
              <div>
                <b>{name(w.a)} against {name(w.b)}</b>, over {w.cause}
                <div className="muted small">{w.side ? `You fight beside ${name(w.side)}: ${D.joinCost} ducats a season, and the other side’s ports are closed to you.` : 'You stand aside.'}</div>
              </div>
              {!w.side && [w.a, w.b].map((side) => (
                <button key={side} title={`Costs ${D.joinCost} ducats a season until the peace. Winning brings ${D.winPrestige} prestige and ${D.winDucats} ducats.`}
                  onClick={() => { if (window.confirm(`Go to war beside ${name(side)}? The ports of ${name(side === w.a ? w.b : w.a)} will close to you.`)) void run({ kind: 'joinWar', war: w.id, side }); }}>Join {name(side)}</button>
              ))}
            </li>
          ))}
        </ul>
      </>}

      <label className="marque" title={`While you have an enemy, privateers bring ${D.marque[0]}–${D.marque[1]} ducats a season; now and then they take a neutral’s ship and its realm protests.`}>
        <input type="checkbox" checked={game.marque} onChange={(e) => void run({ kind: 'marque', on: e.target.checked })} />
        Letters of marque {game.marque ? (enemy ? '· your privateers are at sea' : '· no enemy to take prizes from') : ''}
      </label>

      <h4>The realms</h4>
      <ul className="realms">
        {REALMS.filter((r) => r.id !== game.crown).map((r) => {
          const st = game.europe[r.id];
          const regard = Math.round(regardOf(game, r.id));
          const next = NEXT[st.treaty];
          const open = next ? treatyOpen(game, r.id, next) : null;
          const atWar = enemyOf(game, r.id) || (rivals.has(r.id) && game.rivals[r.id as keyof typeof game.rivals].relation === 'war');
          const wars = warsOf(game, r.id);
          const wait = game.turn - st.envoy < D.envoyEvery;
          const corsair = CORSAIR_REALMS.includes(r.id as RealmId);
          return (
            <li key={r.id} className="heir-card realm">
              <CrestArt realm={r.id} size={38} fallback={<span className="crown-flag big" style={{ background: CROWN[r.id as keyof typeof CROWN]?.css ?? `#${r.color.toString(16).padStart(6, '0')}` }} aria-hidden />} />
              <div>
                <b>{r.name[0].toUpperCase() + r.name.slice(1)}</b>{rivals.has(r.id) && <span className="muted small"> · a rival crown</span>}
                <div className="attitude" title={`Regard ${regard}`}><div className="att-mid" /><div className="att-dot" style={{ left: `${(regard + 100) / 2}%` }} /></div>
                <div className="muted small">
                  {atWar ? 'At war with you' : st.treaty === 'none' ? 'No treaty' : TREATY_INFO[st.treaty].name}
                  {wars.map((w) => ` · at war with ${name(w.a === r.id ? w.b : w.a)}`).join('')}
                  {corsair && (corsairsHunt(game, r.id) ? ' · their corsairs hunt your ships near their ports' : ' · their corsairs leave you alone')}
                </div>
              </div>
              <div className="realm-acts">
                <button disabled={atWar || wait || game.treasury < D.envoyCost} title={wait ? 'Your last envoy has barely come home.' : 'A good diplomat at court wins more.'} onClick={() => void run({ kind: 'envoy', realm: r.id })}>Envoy · {D.envoyCost}</button>
                <button disabled={atWar || game.treasury < D.giftCost} onClick={() => void run({ kind: 'realmGift', realm: r.id })}>Gift · {D.giftCost}</button>
                {next && <button disabled={atWar || !open?.ok} title={open?.ok ? TREATY_INFO[next].blurb : open?.why} onClick={() => void run({ kind: 'treaty', realm: r.id, treaty: next })}>{TREATY_INFO[next].name}</button>}
                {st.treaty !== 'none' && <button className="danger" onClick={() => { if (window.confirm(`Break the treaty with ${r.name}? It costs ${D.breakPrestige} prestige.`)) void run({ kind: 'breakTreaty', realm: r.id }); }}>Break</button>}
                {corsair && <button className={st.tribute ? 'on' : ''} aria-pressed={st.tribute} title={`${D.tribute} ducats a season, and their corsairs leave your ships alone.`} onClick={() => void run({ kind: 'tribute', realm: r.id, on: !st.tribute })}>Tribute{st.tribute ? ' paid' : ''}</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Research: the laws of the realm and the scientific expedition. */
export function LawsAndExpedition({ show }: { show: 'laws' | 'expedition' }) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const e = game.expedition;
  return (
    <div className="laws">
      {show === 'expedition' && <section>
        <h3>A scientific expedition</h3>
        {e
          ? <p>In the field: {Math.floor(e.done)} of {e.need} points of discovery. Everything your explorers chart, meet and survey counts {EXPEDITION.multiplier} times until it is done; finishing it brings {EXPEDITION.bonus} research and {EXPEDITION.prestige} prestige.</p>
          : <p>Send cosmographers, a botanist and a draughtsman with your explorers. Until they have found enough, every coast charted, people met and land surveyed counts {EXPEDITION.multiplier} times for your scholars; finishing brings {EXPEDITION.bonus} research and {EXPEDITION.prestige} prestige.</p>}
        {!e && <button disabled={game.treasury < EXPEDITION.cost} onClick={() => void run({ kind: 'fundExpedition' })}>Fund an expedition · {fmt(EXPEDITION.cost)}</button>}
      </section>}
      {show === 'laws' && <section>
        <h3>Laws <span className="muted small">{game.laws.length} of {lawPlaces(game)} places</span></h3>
        <p className="muted small">Research opens laws; a realm keeps only a few, and one more for every three subjects of state mastered. Repealing a law costs prestige.</p>
        <div className="law-grid">
          {LAWS.map((l) => {
            const on = game.laws.includes(l.id);
            const open = lawOpen(game, l.id);
            return (
              <div key={l.id} className={`tech ${on ? 'known' : open.ok ? 'open' : 'locked'}`}>
                <div className="tech-head"><b>{l.name}</b><span className="muted small">{on ? 'in force' : `${fmt(l.cost)} ducats`}</span></div>
                <div className="small">{l.effect}</div>
                <div className="muted small"><i>{l.blurb}</i></div>
                {l.against && <div className="muted small">Cannot stand beside {lawById(l.against).name.toLowerCase()}.</div>}
                {on ? <button className="danger" onClick={() => void run({ kind: 'repealLaw', law: l.id })}>Repeal</button>
                  : open.ok ? <button onClick={() => void run({ kind: 'enactLaw', law: l.id })}>Enact</button>
                    : <div className="muted small">{open.why}</div>}
              </div>
            );
          })}
        </div>
      </section>}
    </div>
  );
}
