import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { dateLabel, type ChronicleEntry } from '../sim/types';

export const KIND_MARK: Record<ChronicleEntry['kind'], string> = {
  discovery: '✦', trade: '⚖', voyage: '⚓', peril: '☠', court: '♛',
};

export function Chronicle() {
  const game = useStore((s) => s.game)!;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [game.chronicle.length]);
  let lastTurn = -1;
  return (
    <aside className="panel chronicle">
      <h2>Chronicle</h2>
      <div className="entries">
        {game.chronicle.map((c, i) => {
          const head = c.turn !== lastTurn;
          lastTurn = c.turn;
          return (
            <div key={i}>
              {head && <div className="chron-date">{dateLabel(c.turn)}</div>}
              <p className={`entry ${c.kind}`}><span className="mark" aria-hidden>{KIND_MARK[c.kind]}</span>{c.text}</p>
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </aside>
  );
}
