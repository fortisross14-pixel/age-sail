import { useStore } from '../store';
import { dateLabel } from '../sim/types';
import { GOAL } from '../sim/game';
import { fmt } from './format';
import { spriteUrl } from '../render/assets';
import { getView } from './MapCanvas';

/** Big moments: the first landfall, meeting a people, an expedition lost. */
export function EventCard() {
  const ev = useStore((s) => s.game?.events[0]);
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  if (!ev) return null;
  const art = ev.kind === 'landfall' || ev.kind === 'tech' ? 'ornaments/compass-large' : ev.kind === 'people' ? 'colonies/trading-post-outpost' : 'ornaments/serpent';
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
        <div className="row center">
          {ev.kind !== 'lost' && ev.kind !== 'tech' && <button className="primary" autoFocus onClick={() => void close(true)}>{ev.kind === 'landfall' ? 'See the new lands' : 'Go there'}</button>}
          <button autoFocus={ev.kind === 'lost' || ev.kind === 'tech'} onClick={() => void close(false)}>Continue</button>
        </div>
      </div>
    </div>
  );
}

export function Help() {
  const show = useStore((s) => s.showHelp);
  const game = useStore((s) => s.game);
  const set = useStore((s) => s.set);
  if (!show) return null;
  const explorer = game?.explorers[0]?.name ?? 'your explorer';
  return (
    <div className="modal-back" onClick={() => set({ showHelp: false })}>
      <div className="modal help" role="dialog" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <h2>Your charter</h2>
        <p>It is 1492. The Crown of Castile has given {explorer} two ships in Sevilla and a little gold. South lies the African coast beyond Cape Bojador, uncharted and different every voyage. West lies the open Mar Océano: pilots say no ship that sails far into it comes back.</p>
        <ol>
          <li><b>Load cargo.</b> Iron tools are cheap in Europe, and the peoples of the coast may prize them.</li>
          <li><b>Sail south.</b> Click the sea to plan a voyage: numbered markers show where each season’s sailing ends. Click again or press <kbd>Space</kbd>. The trade winds carry you down the coast; coming home is harder.</li>
          <li><b>Research.</b> Your court studies one subject at a time (the scroll at the top). <i>Volta do mar</i>, long-distance navigation, makes the open ocean survivable. Before it, the darker open sea spoils food twice as fast. You can try the western crossing, but few come back.</li>
          <li><b>Mind wind and food.</b> Trade winds blow west in the south, westerlies blow east in the north (<kbd>V</kbd> shows them). Ships carry food for about 8 seasons; then scurvy kills the crew. Away from home, stores refill only to half: in foreign ports, from native traders, or by anchoring a whole season off a green coast.</li>
          <li><b>Find, meet, trade.</b> Only a fleet led by an explorer may enter uncharted waters. Trade tools with the peoples you meet for furs, tobacco, cacao, dyes and gold, and sell them in Europe while they are rare.</li>
          <li><b>Build at home.</b> Open <b>Cities</b> to build ships and enlarge ports, <b>Court</b> to recruit explorers, <b>Fleets</b> to merge, split and give command. Each project takes some seasons.</li>
        </ol>
        <p>The Crown asks for <b>{fmt(GOAL.treasury)} ducats</b> by {dateLabel(GOAL.turn)}. Ships cost upkeep every season.</p>
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
