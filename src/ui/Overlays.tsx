import { useStore } from '../store';
import { dateLabel } from '../sim/types';
import { GOAL } from '../sim/game';
import { fmt } from './format';
import { KIND_MARK } from './Chronicle';
import { spriteUrl } from '../render/assets';
import { getView } from './MapCanvas';

/** Big moments: the first landfall, meeting a people, an expedition lost. */
export function EventCard() {
  const ev = useStore((s) => s.game?.events[0]);
  const run = useStore((s) => s.run);
  const set = useStore((s) => s.set);
  if (!ev) return null;
  const art = ev.kind === 'landfall' ? 'ornaments/compass-large' : ev.kind === 'people' ? 'colonies/trading-post-outpost' : 'ornaments/serpent';
  const close = async (look: boolean) => {
    await run({ kind: 'dismissEvent' });
    if (look) {
      set({ map: ev.map, dispatch: null });
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
          {ev.kind !== 'lost' && <button className="primary" autoFocus onClick={() => void close(true)}>{ev.kind === 'landfall' ? 'See the new lands' : 'Go there'}</button>}
          <button autoFocus={ev.kind === 'lost'} onClick={() => void close(false)}>Continue</button>
        </div>
      </div>
    </div>
  );
}

export function Dispatch() {
  const dispatch = useStore((s) => s.dispatch);
  const hasEvent = useStore((s) => !!s.game?.events.length);
  const game = useStore((s) => s.game)!;
  const set = useStore((s) => s.set);
  if (!dispatch || hasEvent) return null;
  return (
    <div className="modal-back" onClick={() => set({ dispatch: null })}>
      <div className="modal dispatch" role="dialog" aria-label="Dispatch" onClick={(e) => e.stopPropagation()}>
        <h2>Dispatch</h2>
        <div className="muted">News reaching the court, {dateLabel(game.turn)}</div>
        {dispatch.map((c, i) => (
          <p key={i} className={`entry ${c.kind}`}><span className="mark" aria-hidden>{KIND_MARK[c.kind]}</span>{c.text}</p>
        ))}
        <button className="primary" autoFocus onClick={() => set({ dispatch: null })}>Continue</button>
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
        <p>It is 1492. The Crown of Castile has given {explorer} two ships in Sevilla and a little gold. West of the known world lies the open Mar Océano and, perhaps, new lands. No chart shows what is there.</p>
        <ol>
          <li><b>Load cargo.</b> Iron tools are cheap in Europe, and peoples across the sea may prize them.</li>
          <li><b>Sail west.</b> Click the sea to plan a voyage: numbered markers show where each season’s sailing ends. Click again or press <kbd>S</kbd>. Sail to the western edge of the chart to cross into the Mar Océano.</li>
          <li><b>Mind wind and food.</b> Trade winds blow west in the south, westerlies blow east in the north (<kbd>W</kbd> shows them). Ships carry food for about 8 seasons; then scurvy kills the crew. Anchoring a whole season off a green coast lets boats go ashore for water and game.</li>
          <li><b>Find, meet, trade.</b> Only a fleet led by an explorer may enter uncharted waters. Trade tools with the peoples you meet for furs, tobacco, cacao, dyes and gold, and sell them in Europe while they are rare.</li>
          <li><b>Build at home.</b> Sevilla and Cádiz can build ships, enlarge their ports and recruit explorers. Each project takes some seasons.</li>
        </ol>
        <p>The Crown asks for <b>{fmt(GOAL.treasury)} ducats</b> by {dateLabel(GOAL.turn)}. Ships cost upkeep every season.</p>
        <h3>Controls</h3>
        <ul className="keys">
          <li><kbd>Drag</kbd> pan · <kbd>Wheel</kbd>/<kbd>Pinch</kbd> zoom · <kbd>M</kbd> switch map</li>
          <li><kbd>Enter</kbd> end season · <kbd>Tab</kbd> next fleet · <kbd>Esc</kbd> cancel</li>
          <li><kbd>W</kbd> winds · <kbd>G</kbd> hex grid · <kbd>C</kbd> chronicle · hold <kbd>Alt</kbd> to highlight everything you can click</li>
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
