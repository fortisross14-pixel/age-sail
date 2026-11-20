import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY } from '../data/glossary';

/** A chain of open tooltips: resting on a word inside a tooltip keeps the ones before it open. */
const Chain = createContext<{ hold: () => void; drop: () => void } | null>(null);

const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FIND = new RegExp(`\\b(${TERMS.map(esc).join('|')})\\b`, 'i');
const keyOf = (word: string) => TERMS.find((t) => t.toLowerCase() === word.toLowerCase())!;

/** A word with a meaning: rest the pointer on it (or focus it) to read it; the meaning may hold more such words. */
export function Term({ term, children }: { term: string; children: ReactNode }) {
  const parent = useContext(Chain);
  const [at, setAt] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const el = useRef<HTMLSpanElement>(null);
  const hold = () => { window.clearTimeout(timer.current); parent?.hold(); };
  const drop = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setAt(null), 200); parent?.drop(); };
  const show = (now = false) => {
    hold();
    timer.current = window.setTimeout(() => {
      const r = el.current?.getBoundingClientRect();
      if (!r) return;
      const up = r.bottom + 180 > window.innerHeight;
      setAt({ x: Math.max(12, Math.min(window.innerWidth - 352, r.left)), y: up ? r.top - 6 : r.bottom + 6, up });
    }, now ? 0 : 260);
  };
  return (
    <span ref={el} className="term" tabIndex={0} onMouseEnter={() => show()} onMouseLeave={drop} onFocus={() => show(true)} onBlur={drop}>
      {children}
      {at && createPortal(
        <Chain.Provider value={{ hold, drop }}>
          <span className={`term-tip ${at.up ? 'up' : ''}`} role="tooltip" style={{ left: at.x, top: at.y }} onMouseEnter={hold} onMouseLeave={drop}>
            <b>{term[0].toUpperCase() + term.slice(1)}</b>
            <Gloss text={GLOSSARY[term]} skip={term} />
          </span>
        </Chain.Provider>,
        document.body,
      )}
    </span>
  );
}

/** Text in which the game's own words can be opened for their meaning. Each word is marked once. */
export function Gloss({ text, skip }: { text: string; skip?: string }) {
  const out: ReactNode[] = [];
  const done = new Set<string>(skip ? [skip] : []);
  let rest = text, n = 0;
  while (rest) {
    const m = FIND.exec(rest);
    if (!m) { out.push(rest); break; }
    const term = keyOf(m[1]);
    out.push(rest.slice(0, m.index));
    out.push(done.has(term) ? m[1] : <Term key={n++} term={term}>{m[1]}</Term>);
    done.add(term);
    rest = rest.slice(m.index + m[1].length);
  }
  return <>{out}</>;
}
