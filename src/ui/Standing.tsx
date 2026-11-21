/** A people's standing with you on a scale from −3 (will attack) to +3 (may join you). */
import { standing, STANDING } from '../sim/natives';
import type { NativeState } from '../sim/types';

export function Standing({ st, compact = false }: { st: NativeState; compact?: boolean }) {
  const v = standing(st);
  return (
    <span className={`np-standing s${v}`} title={`${STANDING[v].name}: ${STANDING[v].blurb}`}>
      <span className="scale" aria-hidden>
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => <i key={k} className={k === v ? 'on' : ''} />)}
      </span>
      <b>{v > 0 ? '+' : ''}{v}</b>{!compact && <span className="name">{STANDING[v].name}</span>}
    </span>
  );
}
