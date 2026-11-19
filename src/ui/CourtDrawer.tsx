import { useState } from 'react';
import { useStore } from '../store';
import { SKILL_INFO, TRAIT_INFO, RANK_INFO, UNIT_INFO } from '../data/court';
import { TECHS, BRANCH_NAMES, techById, type Branch } from '../data/tech';
import { has, basePoints, techAvailable, portById } from '../sim/game';
import { ageOf, salary, hireCost } from '../sim/court';
import { SKILLS, dateLabel, yearOf, type Person, type UnitType } from '../sim/types';
import { fmt } from './format';
import { KIND_MARK } from './NewsFeed';
import { Tabs, Pips } from './Drawers';
import { getView } from './MapCanvas';
import { allNations, moodOf, envoy } from '../sim/natives';
import { RIVALS } from '../data/rivals';
import { rivalScore } from '../sim/rivals';
import { score } from '../sim/colony';
import { SKILL_INFO as SK } from '../data/court';

export function Court() {
  const game = useStore((s) => s.game)!;
  const tab = useStore((s) => s.courtTab);
  const set = useStore((s) => s.set);
  return (
    <>
      <Tabs value={tab} onChange={(t) => set({ courtTab: t })} tabs={[
        ['people', `People (${game.people.filter((p) => p.alive).length})`],
        ['petitioners', `Petitioners${game.petitioners.length ? ` (${game.petitioners.length})` : ''}`],
        ['peoples', `Peoples${Object.values(game.natives).filter((n) => n.met).length ? ` (${Object.values(game.natives).filter((n) => n.met).length})` : ''}`],
        ['crowns', 'Crowns'],
        ['research', 'Research'],
        ['chronicle', 'Chronicle'],
      ]} />
      {tab === 'people' && <People />}
      {tab === 'petitioners' && <Petitioners />}
      {tab === 'peoples' && <Peoples />}
      {tab === 'crowns' && <Crowns />}
      {tab === 'research' && <Research />}
      {tab === 'chronicle' && <Chronicle />}
    </>
  );
}

function Skills({ p }: { p: Person }) {
  return (
    <div className="skills">
      {SKILLS.map((k) => (
        <span key={k} className="skill" title={`${SKILL_INFO[k].name}: ${SKILL_INFO[k].blurb}`}>
          <span className="skill-name">{SKILL_INFO[k].short}</span><Pips n={p.skills[k]} />
        </span>
      ))}
    </div>
  );
}

function status(game: ReturnType<typeof useStore.getState>['game'], world: ReturnType<typeof useStore.getState>['world'], p: Person): string {
  if (!game || !world) return '';
  if (!p.alive) return `Died ${p.died != null ? yearOf(p.died) : ''}`;
  const where = p.city ? portById(world, p.city)?.name : '';
  if (p.fleet != null) return `Leading ${game.fleets.find((f) => f.id === p.fleet)?.name ?? 'a fleet'}`;
  const party = game.parties.find((x) => x.leader === p.id);
  if (party) return `Ashore, leading ${party.name}`;
  if (p.ready > 0) return `Preparing: ready in ${p.ready} season${p.ready > 1 ? 's' : ''}`;
  if (p.rank === 'governor') return `Governor of ${where}`;
  if (p.rank === 'courtier') return `At court in ${where}`;
  return `Ready in ${where}, waiting for a fleet`;
}

function People() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const [open, setOpen] = useState<number | null>(null);
  const order = { explorer: 0, merchant: 1, governor: 2, courtier: 3 };
  const people = [...game.people].sort((a, b) => Number(b.alive) - Number(a.alive) || order[a.rank] - order[b.rank]);
  return (
    <>
      <p className="muted small">Commission courtiers as explorers, merchants or governors. An explorer comes with one free unit. Click a person for their options.</p>
      <ul className="people">
        {people.map((p) => (
          <li key={p.id} className={`person ${p.alive ? '' : 'dead'} ${open === p.id ? 'open' : ''}`}>
            <button className="person-head" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} disabled={!p.alive}>
              <span className={`rank-badge ${p.rank}`}>{RANK_INFO[p.rank].name}</span>
              <span className="person-name">{p.name}</span>
              <span className="muted small">{p.alive ? `${ageOf(p, game.turn)} · ${TRAIT_INFO[p.trait].name}` : ''}</span>
              <span className="person-status small">{status(game, world, p)}{p.unitType && p.alive ? ` · with ${UNIT_INFO[p.unitType].name.toLowerCase()}` : ''}</span>
              <Skills p={p} />
            </button>
            {open === p.id && p.alive && <PersonActions p={p} />}
          </li>
        ))}
      </ul>
    </>
  );
}

function PersonActions({ p }: { p: Person }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const selectFleet = useStore((s) => s.selectFleet);
  const atHome = p.fleet == null && p.city != null && !game.parties.some((x) => x.leader === p.id);
  const fleetsHere = game.fleets.filter((f) => f.at === p.city && f.leader == null);
  const units: UnitType[] = ['colonist', 'infantry', 'missionary'];
  return (
    <div className="person-actions">
      <div className="muted small">Trait: <b>{TRAIT_INFO[p.trait].name}</b>. {TRAIT_INFO[p.trait].blurb} Salary {Math.round(salary(p))} a season.</div>
      {p.rank === 'courtier' && atHome && (
        <>
          <div className="action-group">
            <b>Explorer</b> · {RANK_INFO.explorer.cost} ducats, 2 seasons. Choose who sails with them:
            <div className="row">
              {units.map((u) => (
                <button key={u} disabled={game.treasury < RANK_INFO.explorer.cost} title={UNIT_INFO[u].blurb}
                  onClick={() => void run({ kind: 'promote', person: p.id, rank: 'explorer', unit: u })}>
                  <img src={`${import.meta.env.BASE_URL}sprites/${UNIT_INFO[u].sprite}.png`} alt="" height={26} /> {UNIT_INFO[u].name}
                </button>
              ))}
            </div>
          </div>
          <div className="action-group">
            <b>Merchant</b> · {RANK_INFO.merchant.cost} ducats, 1 season. Leads trade fleets and runs trade routes.
            <div className="row"><button disabled={game.treasury < RANK_INFO.merchant.cost} onClick={() => void run({ kind: 'promote', person: p.id, rank: 'merchant' })}>Make merchant</button></div>
          </div>
          <div className="action-group">
            <b>Governor</b> · free, at once. Construction {p.skills.construction}: projects {p.skills.construction * 5}% cheaper{p.skills.construction >= 2 ? `, ${Math.floor(p.skills.construction / 2)} season${p.skills.construction >= 4 ? 's' : ''} faster` : ''}.
            <div className="row">
              {Object.values(game.cities).map((c) => (
                <button key={c.id} disabled={c.governor != null} title={c.governor != null ? 'Already governed' : ''}
                  onClick={() => void run({ kind: 'promote', person: p.id, rank: 'governor', city: c.id })}>Govern {portById(world, c.id)?.name}</button>
              ))}
            </div>
          </div>
        </>
      )}
      {(p.rank === 'explorer' || p.rank === 'merchant') && atHome && p.ready === 0 && (
        <div className="action-group">
          <b>Give command</b> of a fleet in {portById(world, p.city!)?.name}:
          <div className="row">
            {fleetsHere.length ? fleetsHere.map((f) => (
              <button key={f.id} className="primary" onClick={async () => {
                if (await run({ kind: 'assignLeader', person: p.id, fleet: f.id })) { selectFleet(f.id); set({ drawer: 'fleets' }); }
              }}>{f.name}</button>
            )) : <span className="muted small">No fleet without a leader is in port. Merge or build one.</span>}
          </div>
        </div>
      )}
      {p.fleet != null && (
        <div className="row">
          <button onClick={() => {
            const f = game.fleets.find((x) => x.id === p.fleet);
            if (!f) return;
            selectFleet(f.id);
            set({ drawer: 'fleets' });
            setTimeout(() => getView()?.focusHex(f.map, f.hex), 0);
          }}>Show their fleet</button>
        </div>
      )}
      {p.rank !== 'courtier' && p.fleet == null && (
        <div className="row"><button onClick={() => void run({ kind: 'relieve', person: p.id })}>Return to court</button></div>
      )}
    </div>
  );
}

function Petitioners() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  if (!game.petitioners.length) return <p className="muted">No one is asking for a place at court. New faces arrive each spring.</p>;
  return (
    <>
      <p className="muted small">People asking for a place at court. They arrive each spring; some lose patience and leave.</p>
      <ul className="people">
        {game.petitioners.map(({ person: p, cost }) => (
          <li key={p.id} className="person">
            <div className="person-head static">
              <span className="rank-badge courtier">Petitioner</span>
              <span className="person-name">{p.name}</span>
              <span className="muted small">{ageOf(p, game.turn)} · {TRAIT_INFO[p.trait].name}</span>
              <span className="person-status small">asks {fmt(cost)} ducats</span>
              <Skills p={p} />
            </div>
            <div className="person-actions">
              <div className="muted small">{TRAIT_INFO[p.trait].blurb}</div>
              <button disabled={game.treasury < cost} onClick={() => void run({ kind: 'hire', person: p.id })}>Welcome to court · {fmt(cost)}</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">A fair price for skills like these is about {fmt(hireCost(game.petitioners[0].person))} ducats.</p>
    </>
  );
}

function Research() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const r = game.research;
  const cur = r.current ? techById(r.current) : null;
  const learned = game.people.filter((p) => p.alive && p.trait === 'learned' && p.fleet == null).length;
  return (
    <div className="research">
      <div className="research-now">
        {cur ? (
          <>
            <div>Studying <b>{cur.name}</b>: {Math.floor(r.progress)} of {cur.cost}</div>
            <div className="bar"><div style={{ width: `${Math.min(100, (r.progress / cur.cost) * 100)}%` }} /></div>
          </>
        ) : <div>The scholars are idle. Choose a subject below.</div>}
        <div className="muted small">
          The court yields {basePoints(game) + learned} points a season{learned ? ` (${learned} from learned courtiers)` : ''}. New coasts, peoples and lands charted by your explorers add more.
        </div>
      </div>
      {(['navigation', 'commerce', 'state'] as Branch[]).map((b) => (
        <section key={b}>
          <h3>{BRANCH_NAMES[b]}</h3>
          <div className="techs">
            {TECHS.filter((t) => t.branch === b).map((t) => {
              const known = has(game, t.id);
              const open = techAvailable(game, t.id);
              const now = r.current === t.id;
              return (
                <div key={t.id} className={`tech ${known ? 'known' : open ? 'open' : 'locked'} ${now ? 'now' : ''}`}>
                  <div className="tech-head"><b>{t.name}</b><span className="muted small">{known ? 'known' : `${t.cost} points`}</span></div>
                  <div className="small">{t.effect}</div>
                  <div className="muted small"><i>{t.blurb}</i></div>
                  {!known && t.requires.length > 0 && <div className="muted small">Needs {t.requires.map((x) => techById(x).name).join(' and ')}.</div>}
                  {!known && open && !now && <button onClick={() => void run({ kind: 'research', tech: t.id })}>Study this</button>}
                  {now && <div className="small"><b>Being studied</b></div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Chronicle() {
  const game = useStore((s) => s.game)!;
  let lastTurn = -1;
  return (
    <div className="entries">
      {[...game.chronicle].reverse().map((c, i) => {
        const head = c.turn !== lastTurn;
        lastTurn = c.turn;
        return (
          <div key={i}>
            {head && <div className="chron-date">{dateLabel(c.turn)}</div>}
            <p className={`entry ${c.kind}`}><span className="mark" aria-hidden>{KIND_MARK[c.kind]}</span>{c.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function Peoples() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const met = allNations(world).filter((n) => game.natives[n.id]?.met);
  const e = envoy(game);
  if (!met.length) return <p className="muted">You have met no peoples yet. Their trading grounds lie along the coasts beyond Cape Bojador, and across the ocean.</p>;
  return (
    <>
      <p className="muted small">
        Deal with each people your own way: trade and trading posts, missions, alliances, setting rivals against each other, or conquest. Your envoy is
        {e ? <> <b>{e.name}</b> ({SK.diplomacy.name.toLowerCase()} {e.skills.diplomacy})</> : ' nobody'}; a better diplomat makes gifts go further and treaties likelier.
      </p>
      <ul className="people">
        {met.map((n) => {
          const st = game.natives[n.id];
          const mood = moodOf(st);
          const villages = [n.siteHex, ...n.villages].length - st.lost.length;
          const rivals = n.rivals.map((r) => allNations(world).find((x) => x.id === r)!).filter((r) => game.natives[r.id]?.met);
          return (
            <li key={n.id} className="person nation">
              <div className="person-head static">
                <span className={`rank-badge mood-${mood.split(' ')[0]}`}>{mood}</span>
                <span className="person-name">The {n.people}{n.empire ? <span className="muted small"> · an empire</span> : ''}</span>
                <span className="muted small">{n.map === 'old' ? 'African coast' : 'New World'}</span>
                <div className="attitude" title={`Attitude ${Math.round(st.attitude)}`}><div className="att-mid" /><div className="att-dot" style={{ left: `${(st.attitude + 100) / 2}%` }} /></div>
                <span className="person-status small">
                  About {st.warriors} warriors · {villages} village{villages === 1 ? '' : 's'}{st.epidemic ? ' · struck by sickness' : ''}
                  {st.post ? ' · trading post' : ''}{st.mission ? ` · mission (${Math.round(st.converted * 100)}% won over)` : ''}
                </span>
              </div>
              <div className="person-actions">
                <div className="row">
                  {st.relation !== 'war' && st.relation !== 'subject' && <>
                    <button disabled={game.treasury < 200} onClick={() => void run({ kind: 'gift', nation: n.id, ducats: 200 })}>Gifts · 200</button>
                    <button disabled={game.treasury < 600} onClick={() => void run({ kind: 'gift', nation: n.id, ducats: 600 })}>Rich gifts · 600</button>
                  </>}
                  {st.relation === 'peace' && <button disabled={st.attitude < 50} title={st.attitude < 50 ? 'They must be friendly first' : ''} onClick={() => void run({ kind: 'ally', nation: n.id })}>Propose alliance</button>}
                  {st.relation === 'war' && <button disabled={game.treasury < 500} onClick={() => void run({ kind: 'peace', nation: n.id })}>Make peace · 500</button>}
                  {st.converted >= 1 && st.relation !== 'subject' && <button className="primary" disabled={st.attitude < 40} onClick={() => void run({ kind: 'incorporate', nation: n.id })}>Invite them to join the Crown</button>}
                </div>
                {rivals.length > 0 && (st.relation === 'allied' || st.attitude >= 30) && (
                  <div className="row small">
                    Turn them against:
                    {rivals.map((r) => <button key={r.id} disabled={game.treasury < 400} title="400 ducats in gifts and arms. It may get out." onClick={() => void run({ kind: 'incite', nation: n.id, target: r.id })}>the {r.people}</button>)}
                  </div>
                )}
                <div className="muted small">
                  {rivals.length ? `Rivals: ${rivals.map((r) => `the ${r.people}`).join(', ')}. ` : ''}
                  {st.relation === 'peace' && st.attitude <= -40 ? 'They raid colonies and ambush parties near their land. ' : ''}
                  {st.relation === 'subject' ? 'They pay tribute every season; their land counts as yours.' : 'Trade, a trading post or a mission builds goodwill; colonies on their land and attacks on anyone wear it down.'}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Crowns() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const run = useStore((s) => s.run);
  const me = score(game, world);
  const rows = [
    { id: 'castile', name: 'Castile (you)', ...me, colonies: game.colonies.length, posts: Object.values(game.natives).filter((n) => n.post).length },
    ...RIVALS.map((r) => ({ id: r.id, name: r.name, ...rivalScore(game, r.id), posts: game.rivals[r.id].posts.length })),
  ].sort((a, b) => b.total - a.total);
  return (
    <>
      <p className="muted small">The crowns of Europe race for the same coasts. Their colonies claim the land around them; their trading posts take what the peoples have to sell. Score: colonists ×10, territory ×2, and every 200 ducats of trade.</p>
      <table className="market standings">
        <thead><tr><th>Crown</th><th>Score</th><th>Colonies</th><th>Colonists</th><th>Territory</th><th>Posts</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={r.id === 'castile' ? 'me' : ''}>
              <td>{i + 1}. {r.name}</td><td className="num"><b>{fmt(r.total)}</b></td><td className="num">{r.colonies}</td><td className="num">{r.pop}</td><td className="num">{r.territory}</td><td className="num">{r.posts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="people">
        {RIVALS.map((r) => {
          const st = game.rivals[r.id];
          const war = st.relation === 'war';
          const cost = 1000 + Math.max(0, -st.attitude) * 10;
          const mood = war ? 'at war' : st.attitude <= -40 ? 'hostile' : st.attitude < 0 ? 'wary' : 'cautious';
          return (
            <li key={r.id} className="person nation">
              <div className="person-head static">
                <span className={`rank-badge mood-${mood.split(' ')[0]}`}>{mood}</span>
                <span className="person-name">{r.name}</span>
                <span className="muted small">{r.blurb}</span>
                <div className="attitude" title={`Attitude ${Math.round(st.attitude)}`}><div className="att-mid" /><div className="att-dot" style={{ left: `${(st.attitude + 100) / 2}%` }} /></div>
              </div>
              <div className="person-actions">
                <div className="muted small">
                  {war ? 'Their privateers hunt your ships and they raid colonies near theirs. A party beside one of their colonies can storm it.' : 'Settling close to their colonies sours relations; below −50 they may declare war.'}
                  {r.id === 'portugal' && game.turn > 6 ? ' Under the Treaty of Tordesillas, they resent Castilian colonies on the African coast.' : ''}
                </div>
                <div className="row">
                  {war
                    ? <button disabled={game.treasury < cost} onClick={() => void run({ kind: 'rivalPeace', crown: r.id })}>Make peace · {fmt(cost)}</button>
                    : <button className="danger" onClick={() => { if (confirm(`Declare war on ${r.name}?`)) void run({ kind: 'declareWar', crown: r.id }); }}>Declare war</button>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
