import { useStore, newsKey } from '../store';
import { dateLabel, type ChronicleEntry } from '../sim/types';

export const KIND_MARK: Record<ChronicleEntry['kind'], string> = {
  discovery: '✦', trade: '⚖', voyage: '⚓', peril: '☠', court: '♛',
};

/** How many cards sit over the map at once; the rest wait in the Chronicle. */
const NEWS_AT_ONCE = 2;

/** Recent news in the corner. Each item can be waved away; old news fades by itself. */
export function NewsFeed() {
  const game = useStore((s) => s.game)!;
  const dismissed = useStore((s) => s.dismissed);
  const set = useStore((s) => s.set);
  const gone = new Set(dismissed);
  const fresh = game.chronicle.filter((c) => !gone.has(newsKey(c)));
  const items = fresh.slice(-NEWS_AT_ONCE).reverse();
  const more = fresh.length - items.length;
  if (!items.length) return null;
  const dismiss = (keys: string[]) => set({ dismissed: [...dismissed, ...keys] });
  return (
    <div className="news" aria-live="polite">
      {items.map((c) => (
        <div key={newsKey(c)} className={`news-item ${c.kind}`}>
          <span className="mark" aria-hidden>{KIND_MARK[c.kind]}</span>
          <div>
            <div className="news-date">{dateLabel(c.turn)}</div>
            {c.text}
          </div>
          <button className="x" onClick={() => dismiss([newsKey(c)])} aria-label="Dismiss">×</button>
        </div>
      ))}
      <div className="news-foot">
        {more > 0 && <button className="news-clear" onClick={() => set({ drawer: 'chronicle' })} title="Read them in the Chronicle">and {more} more</button>}
        {fresh.length > 1 && <button className="news-clear" onClick={() => dismiss(game.chronicle.map(newsKey))}>Dismiss all</button>}
      </div>
    </div>
  );
}
