import { useStore } from '../store';
import { spriteUrl } from '../render/assets';
import { getView } from './MapCanvas';
import { standings } from '../sim/empire';
import { portById } from '../sim/game';
import { crownSpec } from '../data/rivals';

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
  if (!ev) return null;
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
        <img className="event-art" src={spriteUrl(art)} alt="" />
        <h2>{ev.title}</h2>
        <p className="event-text">{ev.text}</p>
        {ev.kind === 'end' && <FinalStandings />}
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

export function Help() {
  const show = useStore((s) => s.showHelp);
  const set = useStore((s) => s.set);
  const game = useStore((s) => s.game);
  const world = useStore((s) => s.world);
  if (!show || !game || !world) return null;
  return (
    <div className="modal-back" onClick={() => set({ showHelp: false })}>
      <div className="modal help" role="dialog" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <h2>Your realm</h2>
        <p>It is 1492, and you rule {crownSpec(game.crown).name}. Two ships wait in {portById(world, crownSpec(game.crown).home)?.name}, with a colonist, a soldier, your court and a little gold. Every city of your realm is yours to build in. South lies the African coast beyond Cape Bojador, uncharted and different every voyage. West lies the open Mar Océano: pilots say no ship that sails far into it comes back.</p>
        <ol>
          <li><b>Form an expedition.</b> In <b>Fleets</b>, join the two ships. In <b>Court</b>, make your best navigator an explorer and choose who sails with them (colonists, infantry or missionaries). After two seasons, give them command of the fleet. The colonist and soldier waiting in port can go aboard too.</li>
          <li><b>Load cargo.</b> Iron tools are cheap in Europe, and the peoples of the coast may prize them.</li>
          <li><b>Go ashore.</b> Ships only chart coasts. Beside a shore, <b>Land party</b> puts your units and explorer ashore. On foot they survey the land for gold, silver, timber and fertile soil, and follow rumours of ruins (the red ?). Bring them back aboard from a ship beside them.</li>
          <li><b>Sail south.</b> Click the sea to plan a voyage: numbered markers show where each season’s sailing ends. Click again or press <kbd>Space</kbd>. The trade winds carry you down the coast; coming home is harder.</li>
          <li><b>Found colonies.</b> Train colonists in your cities and take them over with <b>timber</b> and <b>tools</b> in the hold. Land them on surveyed coast and choose <b>Found colony</b>. Each colonist works a hex: food first, then sugar, tobacco, furs, gold, silver… Colonists need food, <b>cloth</b> and <b>wine</b> every season; luxuries make them grow faster. Ship their goods home and sell them.</li>
          <li><b>The peoples.</b> Every coast belongs to someone. In <b>Court → Peoples</b>, send gifts, make alliances, or pay a people to turn on its rivals. Dock to build a trading post; land a missionary to found a mission. You can also conquer: a battle is a matter of numbers, and every people will remember it. Colonies on a people’s land anger them; angry peoples raid.</li>
          <li><b>Rival crowns.</b> The other Atlantic crowns race you for the same coasts: their ships appear on the map, their colonies claim land you can no longer settle, their trading posts thin out the native trade. Settle too close and they grow hostile; at war, their privateers hunt your ships. <b>Court → Crowns</b> shows the standings.</li>
          <li><b>The long game.</b> Eras pass, and colonies grow less loyal with every generation born overseas, with high taxes and when their needs go unmet. Charters, festivals and garrisons hold them; a disloyal city may break away. Stories ask for your decisions. The age ends at the year you chose; the crown with the highest score wins.</li>
          <li><b>Score</b> counts colonists, territory and the ducats your sales have earned.</li>
          <li><b>Research.</b> Your court studies one subject at a time (the scroll at the top). <i>Volta do mar</i>, long-distance navigation, makes the open ocean survivable. Before it, the darker open sea spoils food twice as fast. You can try the western crossing, but few come back.</li>
          <li><b>Mind wind and food.</b> Trade winds blow west in the south, westerlies blow east in the north (<kbd>V</kbd> shows them). Ships carry food for about 8 seasons; then scurvy kills the crew. Away from home, stores refill only to half: in foreign ports, from native traders, or by anchoring a whole season off a green coast.</li>
          <li><b>Find, meet, trade.</b> Only a fleet led by an explorer may enter uncharted waters. Trade tools with the peoples you meet for furs, tobacco, cacao, dyes and gold, and sell them in Europe while they are rare.</li>
          <li><b>Build and trade at home.</b> <b>Cities</b> have room for a few buildings (docks, barracks, church, university, market) and train colonists, infantry and missionaries; a governor with construction skill speeds them up. A merchant can run a fleet on a trade route between European ports by itself. People age, and new petitioners come to court each spring.</li>
        </ol>
        <p>There is no deadline: build the largest, richest realm you can before the age ends. Ships cost upkeep every season.</p>
        <h3>Controls</h3>
        <ul className="keys">
          <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows, drag, or rest the pointer at the screen edge to pan · <kbd>Wheel</kbd>/<kbd>Pinch</kbd> zoom</li>
          <li><kbd>Space</kbd> sail · <kbd>Enter</kbd> end season · <kbd>Tab</kbd> next fleet · <kbd>Esc</kbd> cancel or close · <kbd>M</kbd> switch map</li>
          <li><kbd>1</kbd> Cities · <kbd>2</kbd> Markets · <kbd>3</kbd> Fleets · <kbd>4</kbd> Court · <kbd>V</kbd> winds · <kbd>G</kbd> hex grid · hold <kbd>Alt</kbd> to highlight everything you can click</li>
        </ul>
        <button className="primary" autoFocus onClick={() => set({ showHelp: false })}>Set out</button>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return <div key={toast.id} className={`toast ${toast.bad ? 'bad' : ''}`} role="status">{toast.text}</div>;
}
