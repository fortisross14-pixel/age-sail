import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, listSaves, SLOT_KEYS, type SaveInfo } from '../store';
import { KEYS, keyCaps, rebind, resetKeys } from './keys';
import { pref, setPref } from './prefs';
import { fmt } from './format';
import { sfx } from './sound';
import { Icon } from './theme/icons';
import { Gloss } from './Gloss';
import { TECHS, BRANCHES, BRANCH_NAMES, techById, type Tech, type TechId } from '../data/tech';
import { LAWS } from '../data/laws';
import { SHIPS } from '../data/ships';
import { UNIT_INFO } from '../data/court';
import { BUILDINGS, BUILDING_ORDER } from '../data/city';
import { has, techAvailable, basePoints, portById, cityTaxes, studyPath } from '../sim/game';
import { LEVELS } from '../sim/colony';
import { loyaltyTarget } from '../sim/empire';
import { rivalSpec } from '../data/rivals';
import type { UnitType } from '../sim/types';

// ---------- saves ----------

/** Three places to keep a voyage, the last few turns kept automatically, and a file to carry elsewhere. */
export function Saves() {
  const show = useStore((s) => s.showSaves);
  const game = useStore((s) => s.game);
  const set = useStore((s) => s.set);
  const saveSlot = useStore((s) => s.saveSlot);
  const loadKey = useStore((s) => s.loadKey);
  const exportSave = useStore((s) => s.exportSave);
  const importSave = useStore((s) => s.importSave);
  const [list, setList] = useState<SaveInfo[]>([]);
  const refresh = () => void listSaves().then(setList);
  useEffect(() => { if (show) refresh(); }, [show]);
  if (!show) return null;
  const line = (i: SaveInfo | undefined) => (i ? `${rivalSpec(i.crown).name}, ${i.year} · score ${fmt(i.score)} · saved ${new Date(i.at).toLocaleString()}` : 'Empty');
  const autos = list.filter((i) => i.key.includes(':auto:')).sort((a, b) => b.at - a.at);
  return (
    <div className="modal-back" onClick={() => set({ showSaves: false })}>
      <div className="modal saves" role="dialog" aria-label="Saved voyages" onClick={(e) => e.stopPropagation()}>
        <h2>Saved voyages</h2>
        <p className="muted">The game saves itself after every order. These are places to keep a voyage on purpose, and the last turns kept in case you want one back.</p>
        <h4>Your saves</h4>
        <ul className="save-list">
          {SLOT_KEYS.map((key, n) => {
            const info = list.find((i) => i.key === key);
            return (
              <li key={key}>
                <div><b>Place {n + 1}</b><div className="muted small">{line(info)}</div></div>
                {game && <button onClick={async () => { if (!info || window.confirm(`Write over place ${n + 1}?`)) { await saveSlot(n); refresh(); } }}>Save here</button>}
                <button disabled={!info} onClick={() => { if (!game || window.confirm('Leave this voyage and load that one?')) void loadKey(key); }}>Load</button>
              </li>
            );
          })}
        </ul>
        {autos.length > 0 && <>
          <h4>Kept automatically</h4>
          <ul className="save-list">
            {autos.map((i) => <li key={i.key}><div className="muted small">{line(i)}</div><button onClick={() => { if (!game || window.confirm('Leave this voyage and go back to that turn?')) void loadKey(i.key); }}>Load</button></li>)}
          </ul>
        </>}
        <h4>As a file</h4>
        <div className="row">
          {game && <button onClick={exportSave}>Save to a file</button>}
          <label className="file-btn">Load from a file<input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(importSave); e.target.value = ''; }} /></label>
        </div>
        <div className="row center"><button className="primary" autoFocus onClick={() => set({ showSaves: false })}>Close</button></div>
      </div>
    </div>
  );
}

// ---------- every city and colony in one table ----------

type Col = { id: string; label: string; num?: boolean };
/** Cities and colonies side by side: click a heading to sort, a row to go there. */
export function CompareTable() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const [sort, setSort] = useState<{ col: string; desc: boolean }>({ col: 'name', desc: false });
  const by = (col: string) => setSort((s) => ({ col, desc: s.col === col ? !s.desc : col !== 'name' }));
  const order = <T extends Record<string, string | number>>(rows: T[]) => [...rows].sort((a, b) => { const x = a[sort.col] ?? '', y = b[sort.col] ?? ''; const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return sort.desc ? -d : d; });
  const head = (cols: Col[]) => <thead><tr>{cols.map((c) => <th key={c.id} className={c.num ? 'num' : ''}><button className="link" onClick={() => by(c.id)}>{c.label}{sort.col === c.id ? (sort.desc ? ' ▾' : ' ▴') : ''}</button></th>)}</tr></thead>;
  const colonies = order(game.colonies.map((c) => {
    const top = Object.entries(c.last.produced).filter(([g]) => g !== 'food').sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    return { id: c.id, name: c.name, level: LEVELS[c.level].name, pop: c.pop, room: LEVELS[c.level].cap - c.pop, loyalty: Math.round(c.loyalty), toward: Math.round(loyaltyTarget(game, c)), food: Math.round(c.stock.food ?? 0), makes: top ? `${top[0]} ${Math.round(top[1] ?? 0)}` : 'food only', garrison: game.units.filter((u) => u.colony === c.id).length, state: [c.last.besieged ? 'besieged' : '', c.last.hungry ? 'hungry' : '', c.unrest ? 'unrest' : '', c.last.discontent ? 'discontent' : ''].filter(Boolean).join(', ') || '·' };
  }));
  const cities = order(Object.values(game.cities).map((c) => {
    const p = c.project;
    return { id: c.id, name: portById(world, c.id)?.name ?? c.id, size: c.size, taxes: cityTaxes(c), built: BUILDING_ORDER.filter((b) => c.buildings[b] > 0).map((b) => `${BUILDINGS[b].name}${c.buildings[b] > 1 ? ` ${c.buildings[b]}` : ''}`).join(', ') || '·', doing: !p ? 'nothing in hand' : `${p.kind === 'ship' ? SHIPS[p.ship].name : p.kind === 'unit' ? UNIT_INFO[p.unit].name : BUILDINGS[p.building].name}, ${p.turnsLeft} season${p.turnsLeft > 1 ? 's' : ''}` };
  }));
  const C: Col[] = [{ id: 'name', label: 'Colony' }, { id: 'level', label: 'Size' }, { id: 'pop', label: 'Colonists', num: true }, { id: 'room', label: 'Room', num: true }, { id: 'loyalty', label: 'Loyalty', num: true }, { id: 'toward', label: 'Heading for', num: true }, { id: 'food', label: 'Food', num: true }, { id: 'makes', label: 'Makes' }, { id: 'garrison', label: 'Garrison', num: true }, { id: 'state', label: 'State' }];
  const H: Col[] = [{ id: 'name', label: 'City' }, { id: 'size', label: 'Size', num: true }, { id: 'taxes', label: 'Taxes a season', num: true }, { id: 'built', label: 'Built' }, { id: 'doing', label: 'In hand' }];
  return (
    <div className="compare">
      {colonies.length > 0 && (
        <table className="market">
          {head(C)}
          <tbody>{colonies.map((r) => <tr key={r.id} className="row-link" onClick={() => set({ selectedColony: r.id, selectedPort: r.id })}>{C.map((c) => <td key={c.id} className={`${c.num ? 'num' : ''} ${c.id === 'loyalty' && r.loyalty < 30 ? 'bad' : ''}`}>{r[c.id as keyof typeof r]}</td>)}</tr>)}</tbody>
        </table>
      )}
      <table className="market">
        {head(H)}
        <tbody>{cities.map((r) => <tr key={r.id} className="row-link" onClick={() => set({ selectedPort: r.id, selectedColony: null })}>{H.map((c) => <td key={c.id} className={c.num ? 'num' : ''}>{r[c.id as keyof typeof r]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------- the research tree ----------

const UNIT_ICON = (u: string) => `${import.meta.env.BASE_URL}sprites/${UNIT_INFO[u as UnitType]?.sprite}.png`;
/** What a subject opens, as small pictures and tags. */
function Unlocks({ t }: { t: Tech }) {
  const u = t.unlocks;
  if (!u) return null;
  return (
    <div className="unlocks">
      {u.ships?.map((s) => <span key={s} className="chip" title={`Opens the ${SHIPS[s].name.toLowerCase()}`}><img src={`${import.meta.env.BASE_URL}sprites/ships/${s}.png`} alt="" height={20} />{SHIPS[s].name}</span>)}
      {u.units?.map((x) => <span key={x} className="chip" title={`Opens ${UNIT_INFO[x as UnitType].name.toLowerCase()}`}><img src={UNIT_ICON(x)} alt="" height={20} />{UNIT_INFO[x as UnitType].name}</span>)}
      {u.walls && <span className="chip" title="Opens the star fort"><Icon name="barracks" size={16} tone="ink" />Star fort</span>}
      {u.laws?.map((l) => <span key={l} className="chip law" title="Opens a law">{LAWS.find((x) => x.id === l)?.name}</span>)}
      {u.treaties?.map((x) => <span key={x} className="chip law" title="Opens a kind of treaty">Alliances</span>)}
    </div>
  );
}

/** The subjects as a tree: a column for each branch, a line from each subject to what rests on it, and a queue. */
export function TechTree() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.run);
  const r = game.research;
  const queue = r.queue ?? [];
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ d: string; on: boolean; key: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const depth = (id: TechId): number => { const t = techById(id); return t.requires.length ? 1 + Math.max(...t.requires.map(depth)) : 0; };
  const measure = () => {
    const root = box.current;
    if (!root) return;
    const R = root.getBoundingClientRect();
    const at = (id: string) => { const e = root.querySelector<HTMLElement>(`[data-tech="${id}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left - R.left, y: b.top - R.top, w: b.width, h: b.height }; };
    const out: { d: string; on: boolean; key: string }[] = [];
    for (const t of TECHS) for (const req of t.requires) {
      const a = at(req), b = at(t.id);
      if (!a || !b) continue;
      const same = Math.abs(a.x - b.x) < 4;
      const x1 = same ? a.x + a.w / 2 : a.x < b.x ? a.x + a.w : a.x, y1 = same ? a.y + a.h : a.y + a.h / 2;
      const x2 = same ? b.x + b.w / 2 : a.x < b.x ? b.x : b.x + b.w, y2 = same ? b.y : b.y + b.h / 2;
      const d = same ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
      out.push({ d, on: has(game, req), key: `${req}-${t.id}` });
    }
    setLines(out);
    setSize({ w: root.scrollWidth, h: root.scrollHeight });
  };
  useLayoutEffect(measure, [r.known.length, r.current, queue.length]);
  useEffect(() => { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); });
  const cur = r.current ? techById(r.current) : null;
  const learned = game.people.filter((p) => p.alive && p.trait === 'learned' && p.fleet == null).length;
  const rate = Math.max(1, basePoints(game) + learned + Object.values(game.cities).reduce((t, c) => t + c.buildings.university * 2 + (c.buildings.observatory ?? 0) * 3, 0));
  return (
    <>
      <div className="research-now">
        {cur ? <><div>Studying <b>{cur.name}</b>: {Math.floor(r.progress)} of {cur.cost} · about {Math.max(1, Math.ceil((cur.cost - r.progress) / rate))} seasons</div><div className="bar"><div style={{ width: `${Math.min(100, (r.progress / cur.cost) * 100)}%` }} /></div></> : <div>The scholars are idle. Choose a subject below.</div>}
        <div className="muted small">About {rate} points a season from the court, universities and observatories{learned ? ` (${learned} from learned courtiers)` : ''}; discoveries add more.{queue.length > 0 && <> <b>Next:</b> {queue.map((q) => techById(q).name).join(', then ')}.</>}</div>
      </div>
      <div className="tech-tree" ref={box}>
        <svg className="tech-lines" width={size.w} height={size.h} aria-hidden>{lines.map((l) => <path key={l.key} d={l.d} className={l.on ? 'on' : ''} />)}</svg>
        {BRANCHES.map((b) => (
          <section key={b}>
            <h3><Icon name={b === 'navigation' ? 'navigation' : b === 'commerce' ? 'commerce' : b === 'war' ? 'military' : 'court'} size={22} tone="ink" />{BRANCH_NAMES[b]}</h3>
            <div className="techs">
              {TECHS.filter((t) => t.branch === b).sort((x, y) => depth(x.id) - depth(y.id)).map((t) => {
                const known = has(game, t.id), open = techAvailable(game, t.id), now = r.current === t.id, q = queue.indexOf(t.id);
                const path = known ? [] : studyPath(game, t.id);
                return (
                  <div key={t.id} data-tech={t.id} className={`tech ${known ? 'known' : open ? 'open' : 'locked'} ${now ? 'now' : ''}`}>
                    <div className="tech-head"><b>{t.name}</b><span className="muted small">{known ? 'known' : `${t.cost} points`}</span></div>
                    <div className="small">{t.effect}</div>
                    <Unlocks t={t} />
                    <div className="muted small"><i>{t.blurb}</i></div>
                    {!known && t.requires.some((x) => !has(game, x)) && <div className="muted small">Rests on {t.requires.filter((x) => !has(game, x)).map((x) => techById(x).name).join(' and ')}.</div>}
                    {now && <div className="small"><b>Being studied</b></div>}
                    {!known && !now && (
                      <div className="row">
                        {open && <button onClick={() => void run({ kind: 'research', tech: t.id })}>Study now</button>}
                        <button className={q >= 0 ? 'on' : ''} title={q >= 0 ? 'Take it off the list' : path.length > 1 ? `Adds ${path.map((x) => techById(x).name).join(', then ')}` : 'Study it when the present subject is done'} onClick={() => void run({ kind: 'queueResearch', tech: t.id })}>{q >= 0 ? `Queued · ${q + 1}` : 'Queue'}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// ---------- first-time hints, keys, the size of things ----------

const HINTS: Record<string, string> = {
  diplomacy: 'Everyone outside your realm is here. Peoples are the nations you meet overseas; Rival crowns are the four you race; Europe is the other realms, with their regard for you, your treaties and their wars.',
  dynasty: 'Your ruler’s gift helps the realm, unless a regency holds. Keep an heir: a throne with none costs prestige and loyalty. Offers of marriage come every two years while the ruler is unmarried. Prestige buys the favours below.',
  laws: 'Research opens laws. A realm keeps only a few, some cannot stand together, and repealing one costs prestige, so choose what kind of realm this is.',
  expedition: 'A funded expedition triples what your explorers find until it has found enough. It needs an explorer in the field: send one where no chart reaches.',
  ledger: 'Every ducat of the last turn is on one of these lines. The figure under the treasury in the top bar is what a turn brings before you act.',
};
/** A line of explanation the first time a screen or a tab is opened; closing it is remembered. */
export function FirstHint({ id }: { id: string | null }) {
  const [seen, setSeen] = useState(pref('hintsSeen'));
  if (!id || !HINTS[id] || seen.includes(`first-${id}`)) return null;
  const close = () => { const v = [...seen, `first-${id}`]; setSeen(v); setPref('hintsSeen', v); };
  return (
    <div className="step-hint" role="note">
      <Icon name="help" size={18} />
      <div><Gloss text={HINTS[id]} /></div>
      <button className="x" onClick={close} aria-label="Close this hint">×</button>
    </div>
  );
}

/** The Controls page of the guide: every key, from the table the game itself reads, and a way to change them. */
export function KeysEditor() {
  const [waiting, setWaiting] = useState<string | null>(null);
  const [, redraw] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const take = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopImmediatePropagation();
      const k = e.key.toLowerCase();
      if (k !== 'escape') { const err = rebind(waiting, k); setNote(err); if (!err) sfx('select'); }
      setWaiting(null);
    };
    window.addEventListener('keydown', take, true);
    return () => window.removeEventListener('keydown', take, true);
  }, [waiting]);
  return (
    <div className="key-table">
      {(['The map', 'Turns and orders', 'Screens', 'Cards'] as const).map((group) => (
        <section key={group}>
          <h4>{group}</h4>
          {KEYS.filter((k) => k.group === group).map((k) => (
            <p key={k.id}>
              <span className="key-caps">{waiting === k.id ? <i>press a key…</i> : keyCaps(k).map((c) => <kbd key={c}>{c}</kbd>)}</span>
              <span>{k.label}</span>
              {!k.fixed && <button className="link" onClick={() => { setNote(null); setWaiting(k.id); }}>change</button>}
            </p>
          ))}
        </section>
      ))}
      <p className="muted small">{note ?? 'Keys do nothing while you type in a field. With a screen open, Enter and Space belong to the button that has the focus, so a turn is never ended behind a screen.'} <button className="link" onClick={() => { resetKeys(); setNote('Keys are as they came.'); redraw((n) => n + 1); }}>Reset all keys</button></p>
    </div>
  );
}

const SCALES: [number, string][] = [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Largest']];
export const applyScale = (v: number) => document.documentElement.style.setProperty('--ui', String(v));
/** How large the interface is drawn; the map itself is not changed. */
export function ScaleSetting() {
  const [v, setV] = useState(pref('uiScale'));
  return (
    <label>Size of text and panels
      <span className="scale-btns">{SCALES.map(([n, name]) => <button key={n} className={v === n ? 'on' : ''} aria-pressed={v === n} onClick={() => { setV(n); setPref('uiScale', n); applyScale(n); }}>{name}</button>)}</span>
    </label>
  );
}

/** What the map is showing, when it is not the plain chart. */
export function MapModeChip() {
  const mode = useStore((s) => s.mapMode);
  if (mode === 'realms') return null;
  const TEXT = { finds: 'Finds: what your surveyors found, and the land still to survey', peoples: 'Peoples: their lands, by how they regard you (red to green)', loyalty: 'Loyalty: your colonies’ lands, by how loyal they are (red to green)' } as const;
  return <div className="mode-chip" role="status">{TEXT[mode]} <span className="muted">· O for the next</span></div>;
}
export { Fragment };
