import { useState } from 'react';
import { useStore } from '../store';
import { SKILL_INFO, TRAIT_INFO, RANK_INFO, UNIT_INFO } from '../data/court';
import { TECHS } from '../data/tech';
import { portById } from '../sim/game';
import { ageOf, salary, hireCost } from '../sim/court';
import { SKILLS, dateLabel, yearOf, type Person, type UnitType } from '../sim/types';
import { fmt } from './format';
import { KIND_MARK } from './NewsFeed';
import { Tabs } from './Drawers';
import { Icon } from './theme/icons';
import { Art, CrestArt } from './theme/Art';
import { Portrait } from './theme/Portrait';
import { sfx } from './sound';
import { getView } from './MapCanvas';
import { allNations, moodOf, envoy } from '../sim/natives';
import { rivalsOf, crownSpec } from '../data/rivals';
import { rivalScore, rivalDoing, friendOf } from '../sim/rivals';
import { Dynasty, CourtierStanding, ReignHistory } from './Dynasty';
import { Europe, LawsAndExpedition } from './Europe';
import { TechTree } from './More';
import { Races } from './Late';
import { RIVAL_ECON, rivalSpec } from '../data/rivals';
import { score } from '../sim/colony';
import { CROWN } from '../render/palette';
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
        ['dynasty', `Dynasty${game.dynasty.offers.length ? ` (${game.dynasty.offers.length})` : ''}`],
      ]} />
      {tab === 'people' && <People />}
      {tab === 'petitioners' && <Petitioners />}
      {tab === 'dynasty' && <Dynasty />}
    </>
  );
}

/** Everyone outside your realm: the peoples overseas, the rival crowns, and the realms of Europe. */
export function Diplomacy() {
  const game = useStore((s) => s.game)!;
  const tab = useStore((s) => s.diploTab);
  const set = useStore((s) => s.set);
  const met = Object.values(game.natives).filter((n) => n.met).length;
  return (
    <>
      <Tabs value={tab} onChange={(t) => set({ diploTab: t })} tabs={[
        ['peoples', `Peoples${met ? ` (${met})` : ''}`],
        ['crowns', 'Rival crowns'],
        ['europe', `Europe${game.euroWars.length ? ` (${game.euroWars.length} at war)` : ''}`],
      ]} />
      {tab === 'peoples' && <Peoples />}
      {tab === 'crowns' && <Crowns />}
      {tab === 'europe' && <Europe />}
    </>
  );
}

const RANK_TONE: Record<Person['rank'], string> = { courtier: 'court', explorer: 'sea', merchant: 'gold', governor: 'blood' };
const topSkills = (p: Person) => [...SKILLS].sort((a, b) => p.skills[b] - p.skills[a]).slice(0, 2);

function SkillBars({ p }: { p: Person }) {
  return (
    <div className="skillbars">
      {SKILLS.map((k) => (
        <div key={k} className="skillbar" title={SKILL_INFO[k].blurb}>
          <Icon name={k} size={20} tone="ink" />
          <span>{SKILL_INFO[k].name}</span>
          <span className="track" aria-label={`${p.skills[k]} of 5`}>{[1, 2, 3, 4, 5].map((v) => <i key={v} className={v <= p.skills[k] ? 'on' : ''} />)}</span>
          <b>{p.skills[k]}</b>
        </div>
      ))}
    </div>
  );
}

function CourtierCard({ p, selected, onPick, note }: { p: Person; selected: boolean; onPick: () => void; note?: string }) {
  const game = useStore((s) => s.game)!;
  return (
    <button className={`courtier tone-${RANK_TONE[p.rank]} ${selected ? 'selected' : ''} ${p.alive ? '' : 'dead'}`} onClick={() => { sfx('select'); onPick(); }} aria-pressed={selected}>
      <span className="rank-ribbon">{note ?? RANK_INFO[p.rank].name}</span>
      <Portrait p={p} turn={game.turn} />
      <b>{p.name.replace(/ (de|van) /, ' $1\u00a0')}</b>
      <span className="meta">{p.alive ? `${ageOf(p, game.turn)} · ${TRAIT_INFO[p.trait].name}` : `died ${p.died != null ? yearOf(p.died) : ''}`}</span>
      <span className="top-skills">{topSkills(p).map((k) => <span key={k} title={SKILL_INFO[k].name}><Icon name={k} size={16} tone="ink" />{p.skills[k]}</span>)}</span>
    </button>
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
  const order = { explorer: 0, merchant: 1, governor: 2, courtier: 3 };
  const people = [...game.people].sort((a, b) => Number(b.alive) - Number(a.alive) || order[a.rank] - order[b.rank]);
  const [sel, setSel] = useState<number | null>(people[0]?.id ?? null);
  const p = people.find((x) => x.id === sel) ?? people[0];
  return (
    <div className="court-split">
      <div className="courtiers">{people.map((x) => <CourtierCard key={x.id} p={x} selected={x.id === p?.id} onPick={() => setSel(x.id)} />)}</div>
      {p && <PersonDetail key={p.id} p={p} />}
    </div>
  );
}

function PersonDetail({ p }: { p: Person }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  return (
    <aside className="courtier-detail detail-card">
      <div className="who">
        <Portrait p={p} turn={game.turn} size="large" />
        <div>
          <span className={`rank-ribbon tone-${RANK_TONE[p.rank]}`}>{RANK_INFO[p.rank].name}</span>
          <h3>{p.name}</h3>
          <div className="muted">{p.alive ? `${ageOf(p, game.turn)} years · ${TRAIT_INFO[p.trait].name} · ${Math.round(salary(p))} a season` : ''}</div>
          <div className="status">{status(game, world, p)}{p.unitType && p.alive ? ` · with a ${UNIT_INFO[p.unitType].name.toLowerCase()}` : ''}</div>
        </div>
      </div>
      <SkillBars p={p} />
      <p className="trait"><b>{TRAIT_INFO[p.trait].name}.</b> {TRAIT_INFO[p.trait].blurb}</p>
      <CourtierStanding p={p} />
      {p.alive && <PersonActions p={p} />}
    </aside>
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
  const ungoverned = Object.values(game.cities).filter((c) => c.governor == null);
  const [city, setCity] = useState(ungoverned[0]?.id ?? '');
  const units: UnitType[] = ['colonist', 'infantry', 'missionary'];
  const [unit, setUnit] = useState<UnitType>('colonist');
  const [post, setPost] = useState(String(fleetsHere[0]?.id ?? ''));
  // commissioned for a fleet: back to that fleet, where the promise shows
  const commission = async (rank: 'explorer' | 'merchant') => {
    const fleet = post && fleetsHere.some((f) => String(f.id) === post) ? Number(post) : undefined;
    if (await run({ kind: 'promote', person: p.id, rank, ...(rank === 'explorer' ? { unit } : {}), ...(fleet != null ? { fleet } : {}) }) && fleet != null) { selectFleet(fleet); set({ drawer: 'fleets', fleetOpen: fleet }); }
  };
  return (
    <div className="commissions">
      {p.rank === 'courtier' && atHome && (
        <>
          <div className="sec">Commission</div>
          {fleetsHere.length > 0 && (
            <label className="row post-to">
              <span>Then take command of</span>
              <select value={post} onChange={(e) => setPost(e.target.value)} aria-label="Fleet to command when ready">
                {fleetsHere.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                <option value="">no fleet yet</option>
              </select>
            </label>
          )}
          <div className="commission">
            <div className="c-head"><Icon name="navigation" size={22} tone="ink" /><b>Explorer</b><span className="cost-tag">{fmt(RANK_INFO.explorer.cost)} · 2 seasons</span></div>
            <div className="muted small">Leads a fleet into unknown waters. One unit comes with them, free: choose which.</div>
            <div className="unit-choice">
              {units.map((u) => (
                <button key={u} className={`offer-card mini ${unit === u ? 'selected' : ''}`} aria-pressed={unit === u} title={UNIT_INFO[u].blurb} onClick={() => setUnit(u)}>
                  <Art slot={`unit/${u}`} fallback={<img src={`${import.meta.env.BASE_URL}sprites/${UNIT_INFO[u].sprite}.png`} alt="" />} />
                  <span>{UNIT_INFO[u].name}</span>
                </button>
              ))}
            </div>
            <button className="adm-gold-btn" disabled={game.treasury < RANK_INFO.explorer.cost} onClick={() => commission('explorer')}>Make explorer, with {UNIT_INFO[unit].name.toLowerCase()}</button>
          </div>
          <div className="commission">
            <div className="c-head"><Icon name="commerce" size={22} tone="ink" /><b>Merchant</b><span className="cost-tag">{fmt(RANK_INFO.merchant.cost)} · 1 season</span></div>
            <div className="muted small">Leads trade fleets and runs trade routes on their own.</div>
            <button className="adm-gold-btn" disabled={game.treasury < RANK_INFO.merchant.cost} onClick={() => commission('merchant')}>Make merchant</button>
          </div>
          <div className="commission">
            <div className="c-head"><Icon name="construction" size={22} tone="ink" /><b>Governor</b><span className="cost-tag">free · at once</span></div>
            <div className="muted small">Projects {p.skills.construction * 5}% cheaper{p.skills.construction >= 2 ? `, ${Math.floor(p.skills.construction / 2)} season${p.skills.construction >= 4 ? 's' : ''} faster` : ''} in the city they govern.</div>
            {ungoverned.length ? (
              <div className="row">
                <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City to govern">
                  {ungoverned.map((c) => <option key={c.id} value={c.id}>{portById(world, c.id)?.name}</option>)}
                </select>
                <button className="adm-gold-btn" onClick={() => void run({ kind: 'promote', person: p.id, rank: 'governor', city })}>Appoint</button>
              </div>
            ) : <span className="muted small">Every city has a governor.</span>}
          </div>
        </>
      )}
      {(p.rank === 'explorer' || p.rank === 'merchant') && atHome && p.ready > 0 && (
        <div className="commission">
          <div className="c-head"><Icon name="fleets" size={22} tone="ink" /><b>Command when ready</b><span className="muted small">in {p.ready} season{p.ready > 1 ? 's' : ''}</span></div>
          <div className="row">
            {p.posted != null && game.fleets.some((f) => f.id === p.posted)
              ? <><span>Promised {game.fleets.find((f) => f.id === p.posted)!.name}.</span><button className="small-btn" onClick={() => void run({ kind: 'post', person: p.id, fleet: null })}>Take it back</button></>
              : fleetsHere.length ? fleetsHere.map((f) => <button key={f.id} className="adm-gold-btn" onClick={() => void run({ kind: 'post', person: p.id, fleet: f.id })}>{f.name}</button>)
              : <span className="muted small">No fleet without a leader is in port.</span>}
          </div>
        </div>
      )}
      {(p.rank === 'explorer' || p.rank === 'merchant') && atHome && p.ready === 0 && (
        <div className="commission">
          <div className="c-head"><Icon name="fleets" size={22} tone="ink" /><b>Give command</b><span className="muted small">in {portById(world, p.city!)?.name}</span></div>
          <div className="row">
            {fleetsHere.length ? fleetsHere.map((f) => (
              <button key={f.id} className="adm-gold-btn" onClick={async () => {
                if (await run({ kind: 'assignLeader', person: p.id, fleet: f.id })) { selectFleet(f.id); set({ drawer: null }); setTimeout(() => getView()?.focusHex(f.map, f.hex), 0); }
              }}>{f.name}</button>
            )) : <span className="muted small">No fleet without a leader is in port. Merge or build one.</span>}
          </div>
        </div>
      )}
      <div className="row">
        {p.fleet != null && (
          <button onClick={() => {
            const f = game.fleets.find((x) => x.id === p.fleet);
            if (!f) return;
            selectFleet(f.id);
            set({ drawer: null });
            setTimeout(() => getView()?.focusHex(f.map, f.hex), 0);
          }}>Show their fleet</button>
        )}
        {p.rank !== 'courtier' && p.fleet == null && <button onClick={() => void run({ kind: 'relieve', person: p.id })}>Return to court</button>}
      </div>
    </div>
  );
}

function Petitioners() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const [sel, setSel] = useState<number | null>(game.petitioners[0]?.person.id ?? null);
  if (!game.petitioners.length) return <p className="muted">No one is asking for a place at court. New faces arrive each spring.</p>;
  const pick = game.petitioners.find((x) => x.person.id === sel) ?? game.petitioners[0];
  const p = pick.person;
  return (
    <div className="court-split">
      <div className="courtiers">{game.petitioners.map(({ person, cost }) => <CourtierCard key={person.id} p={person} selected={person.id === p.id} onPick={() => setSel(person.id)} note={`asks ${fmt(cost)}`} />)}</div>
      <aside className="courtier-detail detail-card" key={p.id}>
        <div className="who">
          <Portrait p={p} turn={game.turn} size="large" />
          <div>
            <span className="rank-ribbon tone-court">Petitioner</span>
            <h3>{p.name}</h3>
            <div className="muted">{ageOf(p, game.turn)} years · {TRAIT_INFO[p.trait].name}</div>
            <div className="status">A fair price for skills like these is about {fmt(hireCost(p))} ducats.</div>
          </div>
        </div>
        <SkillBars p={p} />
        <p className="trait"><b>{TRAIT_INFO[p.trait].name}.</b> {TRAIT_INFO[p.trait].blurb}</p>
        <button className="adm-gold-btn" disabled={game.treasury < pick.cost} onClick={() => void run({ kind: 'hire', person: p.id })}>Welcome to court · {fmt(pick.cost)} ducats</button>
      </aside>
    </div>
  );
}

export function Research() {
  const game = useStore((s) => s.game)!;
  const r = game.research;
  const tab = useStore((s) => s.researchTab);
  const set = useStore((s) => s.set);
  return (
    <div className="research">
      <Tabs value={tab} onChange={(t) => set({ researchTab: t })} tabs={[['subjects', `Subjects (${r.known.length} of ${TECHS.length})`], ['laws', `Laws (${game.laws.length})`], ['expedition', `Expedition${game.expedition ? ' (in the field)' : ''}`]]} />
      {tab !== 'subjects' && <LawsAndExpedition show={tab} />}
      {tab === 'subjects' && <TechTree />}
    </div>
  );
}

export function Chronicle() {
  const game = useStore((s) => s.game)!;
  let lastTurn = -1;
  return (
    <div className="entries">
      <ReignHistory />
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
      <ul className="realm-cards">
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
                  {(() => { const foe = st.feud ? allNations(world).find((x) => x.id === st.feud!.with) : undefined; return foe ? ` · at war with the ${foe.people}` : ''; })()}
                  {(() => { const f = friendOf(st); return f ? ` · friends of ${rivalSpec(f).name}` : ''; })()}
                  {(() => { const a = st.pact ? allNations(world).find((x) => x.id === st.pact) : undefined; return a ? ` · sworn to the ${a.people}` : ''; })()}
                  {(Object.entries(st.crowns) as [typeof game.crown, number][]).filter(([, a]) => a <= RIVAL_ECON.peopleAngry).map(([c]) => ` · angry with ${rivalSpec(c).name}`).join('')}
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
                  {st.converted >= 1 && st.relation !== 'subject' && <button className="primary" disabled={st.attitude < 40} onClick={() => void run({ kind: 'incorporate', nation: n.id })}>Invite them to join your realm</button>}
                </div>
                {rivals.length > 0 && (st.relation === 'allied' || st.attitude >= 30) && (
                  <div className="row small">
                    Turn them against:
                    {rivals.map((r) => <button key={r.id} disabled={game.treasury < 400} title="400 ducats in gifts and arms. It may get out." onClick={() => void run({ kind: 'incite', nation: n.id, target: r.id })}>the {r.people}</button>)}
                  </div>
                )}
                {st.memory.length > 0 && (
                  <ul className="memory" aria-label="What they remember">
                    {st.memory.map((m) => (
                      <li key={m.why} className={m.amount > 0 ? 'good' : 'bad'}><b>{m.amount > 0 ? '+' : '−'}{Math.round(Math.abs(m.amount))}</b> {m.why}</li>
                    ))}
                  </ul>
                )}
                {st.siege && <div className="notice bad small">Their warriors are besieging {game.colonies.find((c) => c.id === st.siege!.colony)?.name}.</div>}
                <div className="muted small">
                  {rivals.length ? `Rivals: ${rivals.map((r) => `the ${r.people}`).join(', ')}. ` : ''}
                  {st.relation === 'peace' && st.attitude <= -40 ? (st.attitude <= -60 ? 'Furious: they raid, ambush, and may besiege a colony. ' : 'They raid colonies and ambush parties near their land. ') : ''}
                  {st.relation === 'peace' && st.attitude >= 40 ? 'Friendly: they trade food to your colonies nearby, and the settlers prosper. ' : ''}
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
    { id: game.crown, name: `${crownSpec(game.crown).name} (you)`, mine: true, ...me, colonies: game.colonies.length, posts: Object.values(game.natives).filter((n) => n.post).length },
    ...rivalsOf(game.crown).map((r) => ({ id: r.id, name: r.name, mine: false, ...rivalScore(game, r.id), posts: game.rivals[r.id].posts.length })),
  ].sort((a, b) => b.total - a.total);
  return (
    <>
      <p className="muted small">The crowns of Europe race for the same coasts. Their colonies claim the land around them; their trading posts take what the peoples have to sell. Score: colonists ×10, territory ×2, and every 200 ducats of trade.</p>
      <table className="market standings">
        <thead><tr><th>Crown</th><th>Score</th><th>Colonies</th><th>Colonists</th><th>Territory</th><th>Posts</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={r.mine ? 'me' : ''}>
              <td><CrestArt realm={r.id} size={24} fallback={<span className="crown-flag" style={{ background: CROWN[r.id].css, borderColor: CROWN[r.id].css2 }} aria-hidden />} /> {i + 1}. {r.name}</td><td className="num"><b>{fmt(r.total)}</b></td><td className="num">{r.colonies}</td><td className="num">{r.pop}</td><td className="num">{r.territory}</td><td className="num">{r.posts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Races />
      <ul className="realm-cards">
        {rivalsOf(game.crown).map((r) => {
          const st = game.rivals[r.id];
          const war = st.relation === 'war';
          const cost = 1000 + Math.max(0, -st.attitude) * 10;
          const mood = war ? 'at war' : st.attitude <= -40 ? 'hostile' : st.attitude < 0 ? 'wary' : 'cautious';
          return (
            <li key={r.id} className="person nation">
              <div className="person-head static">
                <span className={`rank-badge mood-${mood.split(' ')[0]}`}>{mood}</span>
                <span className="person-name"><CrestArt realm={r.id} size={30} fallback={<span className="crown-flag" style={{ background: CROWN[r.id].css, borderColor: CROWN[r.id].css2 }} aria-hidden />} /> {r.name}</span>
                <span className="muted small">{r.blurb}</span>
                <div className="attitude" title={`Attitude ${Math.round(st.attitude)}`}><div className="att-mid" /><div className="att-dot" style={{ left: `${(st.attitude + 100) / 2}%` }} /></div>
              </div>
              <div className="person-actions">
                <div className="muted small">
                  <b>{rivalDoing(game, r.id)}.</b> {st.built} ship{st.built === 1 ? '' : 's'}, {st.hulls} in port · treasury {st.treasury < 200 ? 'thin' : st.treasury < 1200 ? 'sound' : 'full'}
                  {st.wars.length ? ` · at war with ${st.wars.map((c) => rivalSpec(c).name).join(' and ')}` : ''}
                  {st.volta ? ' · their pilots know the ocean crossing' : ' · their pilots are still learning the ocean crossing'}.{' '}
                  {war ? 'Their privateers hunt your ships, and their soldiers sail from their colonies to land at yours: watch for their ships. A party beside one of their colonies can storm it.' : 'Settling close to their colonies sours relations; below −50 they may declare war.'}
                  {r.id === 'portugal' && game.turn > 6 ? ' Under the Treaty of Tordesillas, they resent colonies on the African coast.' : ''}
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
