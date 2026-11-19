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

export function Court() {
  const game = useStore((s) => s.game)!;
  const tab = useStore((s) => s.courtTab);
  const set = useStore((s) => s.set);
  return (
    <>
      <Tabs value={tab} onChange={(t) => set({ courtTab: t })} tabs={[
        ['people', `People (${game.people.filter((p) => p.alive).length})`],
        ['petitioners', `Petitioners${game.petitioners.length ? ` (${game.petitioners.length})` : ''}`],
        ['research', 'Research'],
        ['chronicle', 'Chronicle'],
      ]} />
      {tab === 'people' && <People />}
      {tab === 'petitioners' && <Petitioners />}
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
