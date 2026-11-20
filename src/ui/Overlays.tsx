import { useState } from 'react';
import { useStore } from '../store';
import { Frame } from './theme/Frame';
import { Icon } from './theme/icons';
import { sfx, setSound, soundOn, soundVolume } from './sound';
import { spriteUrl } from '../render/assets';
import { getView } from './MapCanvas';
import { standings } from '../sim/empire';
import { GuardSwitch } from './Guidance';
import { BattleReportView } from './Battle';
import { Art } from './theme/Art';
import { ReignHistory } from './Dynasty';
import { FAMILY_NAME } from '../data/stories/types';

function FinalStandings() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const st = standings(world, game);
  return (
    <table className="market standings">
      <thead><tr><th>Crown</th><th>Score</th><th>Colonists</th><th>Territory</th><th>Commerce</th></tr></thead>
      <tbody>{st.map((r, i) => <tr key={r.id} className={r.mine ? 'me' : ''}><td>{i + 1}. {r.name}</td><td className="num"><b>{r.total}</b></td><td className="num">{r.pop}</td><td className="num">{r.territory}</td><td className="num">{r.commerce}</td></tr>)}</tbody>
    </table>
  );
}

/** Big moments: the first landfall, meeting a people, an expedition lost. */
export function EventCard() {
  const ev = useStore((s) => s.game?.events[0]);
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  const [land, setLand] = useState('');
  if (!ev) return null;
  const naming = ev.kind === 'landfall' && !useStore.getState().game?.land;
  const art = ev.kind === 'landfall' || ev.kind === 'tech' || ev.kind === 'era' || ev.kind === 'end' ? 'ornaments/compass-large' : ev.kind === 'people' ? 'colonies/trading-post-outpost' : ev.kind === 'story' ? 'ornaments/cartouche' : 'ornaments/serpent';
  const close = async (look: boolean) => {
    await run({ kind: 'dismissEvent' });
    if (look) {
      set({ map: ev.map });
      setTimeout(() => getView()?.focusHex(ev.map, ev.hex), 50);
    }
  };
  return (
    <div className="modal-back">
      <div className={`modal event ${ev.kind}`} role="dialog" aria-label={ev.title}>
        {!ev.battle && (ev.family
          ? <span className={`event-art family family-${ev.family}`} title={FAMILY_NAME[ev.family]}><Art slot={`story/${ev.family}`} fallback={<img src={spriteUrl(art)} alt="" />} /></span>
          : <img className="event-art" src={spriteUrl(art)} alt="" />)}
        {ev.family && <div className="event-family">{FAMILY_NAME[ev.family]}</div>}
        <h2>{ev.title}</h2>
        {ev.battle && <BattleReportView r={ev.battle} />}
        <p className="event-text">{ev.text}</p>
        {ev.kind === 'end' && <FinalStandings />}
        {ev.kind === 'end' && <ReignHistory open />}
        {naming && (
          <form className="name-land" onSubmit={(e) => { e.preventDefault(); if (land.trim().length >= 2) void run({ kind: 'nameLand', name: land, map: ev.map, hex: ev.hex }); }}>
            <label>What shall this land be called?
              <input value={land} maxLength={28} placeholder="Leave it for the mapmakers" onChange={(e) => setLand(e.target.value)} />
            </label>
            <button disabled={land.trim().length < 2}>Name it</button>
          </form>
        )}
        {ev.choices ? (
          <div className="choices">
            {ev.choices.map((c, i) => (
              <button key={i} className={i === 0 ? 'primary' : ''} autoFocus={i === 0} onClick={() => void run({ kind: 'choose', index: i })}>
                {c.label}{c.hint && <span className="hint">{c.hint}</span>}
              </button>
            ))}
          </div>
        ) : (
        <div className="row center">
          {ev.kind !== 'lost' && ev.kind !== 'tech' && ev.kind !== 'era' && ev.kind !== 'end' && <button className="primary" autoFocus onClick={() => void close(true)}>{ev.kind === 'landfall' ? 'See the new lands' : 'Go there'}</button>}
          <button autoFocus={ev.kind === 'lost' || ev.kind === 'tech' || ev.kind === 'era' || ev.kind === 'end'} onClick={() => void close(false)}>{ev.kind === 'end' ? 'Play on' : 'Continue'}</button>
          {ev.kind === 'end' && <button onClick={async () => { await close(false); useStore.getState().quitToMenu(); }}>New voyage</button>}
        </div>
        )}
      </div>
    </div>
  );
}

/** The guide, a page at a time: the objectives panel teaches the opening, this is the reference. */
const GUIDE: { id: string; name: string; items: [string, string][] }[] = [
  { id: 'start', name: 'First steps', items: [
    ['Form an expedition.', 'In Fleets, join the two ships. In Court, make your best navigator an explorer and choose who sails with them (a colonist, soldiers or a missionary). When they are ready, give them command of the fleet. The colonist and soldier waiting in port can go aboard too.'],
    ['Load cargo.', 'Iron tools are cheap in Europe, and the peoples of the coast may prize them.'],
    ['Sail south.', 'Click the sea to plan a voyage: numbered markers show where each season’s sailing ends. Click again or press Space. The trade winds carry you down the coast; coming home is harder.'],
    ['Go ashore.', 'Ships only chart coasts. Beside a shore, Land party puts your units and explorer ashore. On foot they survey the land for gold, silver, timber and fertile soil, and follow rumours of ruins (the red ?). Bring them back aboard from a ship beside them.'],
  ] },
  { id: 'sea', name: 'At sea', items: [
    ['Mind wind and food.', 'Trade winds blow west in the south, westerlies blow east in the north (V shows them). Ships carry food for about 8 seasons; then scurvy kills the crew. Away from home, stores refill only to half: in foreign ports, from native traders, or by anchoring a whole season off a green coast.'],
    ['Find, meet, trade.', 'Only a fleet led by an explorer may enter uncharted waters. Trade tools with the peoples you meet for furs, tobacco, cacao, dyes and gold, and sell them in Europe while they are rare.'],
    ['The open ocean.', 'Before your scholars master the Volta do mar (Research), the darker open sea spoils food twice as fast. You can try the western crossing, but few come back.'],
  ] },
  { id: 'colonies', name: 'Colonies', items: [
    ['Found colonies.', 'Train colonists in your cities and take them over with timber and tools in the hold. Land them on surveyed coast and choose Found colony.'],
    ['Work and needs.', 'Each colonist works a hex: food first, then sugar, tobacco, furs, gold, silver. Colonists need food, cloth and wine every season; luxuries make them grow faster. Ship their goods home and sell them.'],
    ['Loyalty.', 'Colonies grow less loyal with every generation born overseas, with high taxes and when their needs go unmet. Charters, festivals and garrisons hold them; a disloyal city may break away.'],
  ] },
  { id: 'others', name: 'Peoples and crowns', items: [
    ['The peoples.', 'Every coast belongs to someone. In Court, Peoples: send gifts, make alliances, or pay a people to turn on its rivals. Dock to build a trading post; land a missionary to found a mission. You can also conquer, and every people will remember it. Colonies on a people’s land anger them; angry peoples raid.'],
    ['Rival crowns.', 'The other Atlantic crowns race you for the same coasts: their ships appear on the map, their colonies claim land you can no longer settle, their trading posts thin out the native trade. Settle too close and they grow hostile; at war, their privateers hunt your ships. Court, Crowns shows the standings.'],
  ] },
  { id: 'realm', name: 'Your realm', items: [
    ['Build and trade at home.', 'Cities have room for a few buildings (docks, barracks, church, university, market) and train colonists, soldiers and missionaries; a governor with construction skill speeds them up. A merchant can run a fleet on a trade route between European ports by itself.'],
    ['The court.', 'People age, and new petitioners come to court each spring. Stories ask for your decisions.'],
    ['The long game.', 'Eras pass. The age ends at the year you chose; the crown with the highest score wins. Score counts colonists, territory and the ducats your sales have earned. Ships and wages cost upkeep every season.'],
  ] },
];

export function Help() {
  const show = useStore((s) => s.showHelp);
  const set = useStore((s) => s.set);
  const [tab, setTab] = useState('start');
  if (!show) return null;
  const page = GUIDE.find((g) => g.id === tab);
  return (
    <div className="modal-back" onClick={() => set({ showHelp: false })}>
      <div className="modal help" role="dialog" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <h2>The guide</h2>
        <div className="tabs" role="tablist">
          {[...GUIDE, { id: 'keys', name: 'Controls' }].map((g) => (
            <button key={g.id} role="tab" aria-selected={tab === g.id} className={tab === g.id ? 'on' : ''} onClick={() => { sfx('tab'); setTab(g.id); }}>{g.name}</button>
          ))}
        </div>
        <div className="help-page">
          {page ? (
            <dl>{page.items.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          ) : (
            <ul className="keys">
              <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows, drag, or rest the pointer at the screen edge to pan · <kbd>Wheel</kbd>/<kbd>Pinch</kbd> zoom</li>
              <li><kbd>Space</kbd> sail · <kbd>Enter</kbd> end the turn · <kbd>Tab</kbd> next fleet · <kbd>Esc</kbd> cancel or close · <kbd>M</kbd> switch map</li>
              <li><kbd>1</kbd> Cities · <kbd>2</kbd> Markets · <kbd>3</kbd> Fleets · <kbd>4</kbd> Court · <kbd>5</kbd> Research · <kbd>6</kbd> Chronicle</li>
              <li><kbd>V</kbd> winds · <kbd>G</kbd> hex grid · <kbd>N</kbd> next thing that needs you · <kbd>H</kbd> this guide · hold <kbd>Alt</kbd> to highlight everything you can click</li>
            </ul>
          )}
        </div>
        <button className="primary" autoFocus onClick={() => set({ showHelp: false })}>Close</button>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return <div key={toast.id} className={`toast ${toast.bad ? 'bad' : ''}`} role="status">{toast.text}</div>;
}

/** Settings from the gear in the HUD: sound for now. */
export function Settings() {
  const show = useStore((s) => s.showSettings);
  const set = useStore((s) => s.set);
  const [on, setOn] = useState(soundOn());
  const [vol, setVol] = useState(soundVolume());
  if (!show) return null;
  return (
    <Frame className="settings-pop" role="dialog" aria-label="Settings">
      <button className="adm-medal small adm-close" style={{ top: 10, right: 10 }} onClick={() => set({ showSettings: false })} aria-label="Close settings"><Icon name="close" size={16} /></button>
      <h3 style={{ margin: 0 }}>Settings</h3>
      <label>Sound
        <button className={on ? 'on' : ''} aria-pressed={on} onClick={() => { const v = !on; setOn(v); setSound(v, vol); if (v) sfx('toast'); }}>
          {on ? 'On' : 'Off'}
        </button>
      </label>
      <label>Volume
        <input type="range" min={0} max={1} step={0.05} value={vol} disabled={!on} onChange={(e) => { const v = Number(e.target.value); setVol(v); setSound(on, v); }} onPointerUp={() => sfx('select')} />
      </label>
      <GuardSwitch />
      <button onClick={() => set({ showSettings: false, showHelp: true })}>How to play</button>
    </Frame>
  );
}
