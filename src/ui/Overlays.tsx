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
import { SeaReportView } from './Late';
import { FAMILY_NAME } from '../data/stories/types';
import { KeysEditor, ScaleSetting } from './More';
import { Gloss } from './Gloss';
import { pref, setPref } from './prefs';

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
        {!ev.battle && !ev.sea && (ev.family
          ? <span className={`event-art family family-${ev.family}`} title={FAMILY_NAME[ev.family]}><Art slot={`story/${ev.family}`} fallback={<img src={spriteUrl(art)} alt="" />} /></span>
          : <img className="event-art" src={spriteUrl(art)} alt="" />)}
        {ev.family && <div className="event-family">{FAMILY_NAME[ev.family]}</div>}
        <h2>{ev.title}</h2>
        {ev.battle && <BattleReportView r={ev.battle} />}
        {ev.sea && <SeaReportView r={ev.sea} />}
        <p className="event-text"><Gloss text={ev.text} /></p>
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
    ['Load cargo.', 'Iron tools are cheap in Europe, and the peoples of the coast may prize them. What you buy in your own city waits in its stores (the city’s Stores tab); open the ship and choose Load and unload to take it aboard. In a foreign port or a trading ground you trade straight from a ship’s hold.'],
    ['Windows.', 'Every fleet, person, city and colony has its own window. Open it from its screen (Fleets, Court, Cities) or from the map: click a selected ship again, or click your city. Back returns to the window underneath; Esc or a click outside closes it.'],
    ['Sail south.', 'Click the sea to plan a voyage: numbered markers show where each season’s sailing ends. Click again or press Space. The trade winds carry you down the coast; coming home is harder.'],
    ['Go ashore.', 'Ships only chart coasts. Beside a shore, Land party puts your units and explorer ashore. On foot they survey the land for gold, silver, timber and fertile soil, and follow rumours of ruins (the red ?). Bring them back aboard from a ship beside them.'],
  ] },
  { id: 'sea', name: 'At sea', items: [
    ['Mind wind and food.', 'Trade winds blow west in the south, westerlies blow east in the north (V shows them). Ships carry food for about 8 seasons; then scurvy kills the crew. Away from home, stores refill only to half: in foreign ports, from native traders, or by anchoring a whole season off a green coast.'],
    ['Find, meet, trade.', 'Only a fleet led by an explorer may enter uncharted waters. Trade tools with the peoples you meet for furs, tobacco, cacao, dyes and gold, and sell them in Europe while they are rare.'],
    ['The open ocean.', 'Before your scholars master the Volta do mar (Research), the darker open sea spoils food twice as fast. You can try the western crossing, but few come back. Once it is mastered, a crossing still meets a storm now and then: mend your hulls in a European port, and never cross with fewer than three seasons of stores, or the crew may refuse.'],
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
  { id: 'world', name: 'Europe and the dynasty', items: [
    ['Diplomacy.', 'The Diplomacy screen holds everyone outside your realm: the peoples overseas, the rival crowns, and the realms of Europe. Envoys and gifts win regard; regard wins a trade treaty (better prices in their ports), a pact (they will not attack you) and an alliance.'],
    ['Wars in Europe.', 'Realms fight over old quarrels. You may take a side: the other side’s ports close to you and it costs money each season. An ally at war will ask you to choose. Corsairs out of Ottoman and Moroccan ports take ships near them until you pay tribute or win a pact.'],
    ['The dynasty.', 'Court, Dynasty shows your ruler, whose gift helps the realm, the heirs, and offers of marriage. A child on the throne means a regency; no heir means a costly succession. Prestige buys favours there.'],
    ['Courtiers.', 'They remember what you do, want commissions and commands, have rivals and friends, and can be tempted away by another crown when their loyalty runs out.'],
  ] },
  { id: 'learning', name: 'Research and law', items: [
    ['Subjects.', 'Research has four branches. Some subjects improve the realm; others open ships, soldiers, the star fort, laws and alliances. Universities and observatories speed your scholars.'],
    ['Expeditions.', 'A funded scientific expedition makes everything your explorers chart, meet and survey count three times until it has found enough.'],
    ['Laws.', 'Research opens laws. A realm keeps only a few, and some cannot stand together. Enacting costs ducats; repealing costs prestige.'],
    ['The ages.', 'Each new age offers three paths: a lasting advantage and a goal, judged when the age ends.'],
  ] },
  { id: 'empire', name: 'Empire', items: [
    ['Ways to win.', 'The highest score when the age ends wins, and beside it there are three races: trade, empire and prestige (Diplomacy, Rival crowns). A scenario adds a goal and a year.'],
    ['Free states.', 'A disloyal colony may break away. A free state unsettles its neighbours until you recognise it or retake it; two or more form a league and send militia against you; left alone, a rival crown takes it under protection.'],
    ['Captives.', 'Trading grounds on the African coast sell prisoners of their wars, and your soldiers take captives when a village falls. They can be put to work in a colony or sold. Many die; some flee; they may rise; the peoples they came from remember. The law of abolition ends it.'],
    ['The ledger and the Realm tab.', 'L opens the ledger: what came in and went out last turn, line by line. The Realm tab beside the map lists every fleet, party and colony with its state; click one to go there.'],
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
            <dl>{page.items.map(([t, d]) => <div key={t}><dt>{t}</dt><dd><Gloss text={d} /></dd></div>)}</dl>
          ) : (
            <KeysEditor />
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
      <NewsSwitches />
      <ScaleSetting />
      <button onClick={() => set({ showSettings: false, showSaves: true })}>Saved voyages</button>
      <button onClick={() => set({ showSettings: false, showHelp: true })}>How to play</button>
    </Frame>
  );
}

const NEWS_KINDS: [string, string][] = [['peril', 'Perils'], ['discovery', 'Discoveries'], ['voyage', 'Voyages'], ['trade', 'Trade'], ['court', 'Court and realm']];
/** Which kinds of news the turn's card shows; the Chronicle keeps everything. */
function NewsSwitches() {
  const [news, setNews] = useState(pref('news'));
  return (
    <div className="news-switches">
      <b>News on the map</b>
      {NEWS_KINDS.map(([k, name]) => (
        <label key={k}><input type="checkbox" checked={news[k] !== false} onChange={(e) => { const v = { ...news, [k]: e.target.checked }; setNews(v); setPref('news', v); useStore.getState().set({ dismissed: [...useStore.getState().dismissed] }); }} />{name}</label>
      ))}
    </div>
  );
}
