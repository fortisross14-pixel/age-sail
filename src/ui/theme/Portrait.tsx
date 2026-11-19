import type { Person } from '../../sim/types';
import { ageOf } from '../../sim/court';
import { Art } from './Art';

/**
 * A courtier's portrait. The painted sheet (art/PROMPTS.md, portraits.png) has men in rows 1–2 and
 * women in rows 3–4, ages 20 to 70 across; a person keeps the same picture as they age within a
 * decade. Until the sheet arrives, a drawn bust on a lacquer medallion stands in.
 */
export function portraitSlot(p: Person, turn: number) {
  const col = Math.max(0, Math.min(5, Math.floor((ageOf(p, turn) - 20) / 10)));
  const row = p.id % 2;
  return `portrait/${row * 6 + col + 1}`;
}

const HATS = ['', 'M26 30c0-10 9-15 19-14 10-1 17 5 17 13-4-3-9-4-18-4s-14 2-18 5z', 'M22 28c2-9 14-13 25-12 11 1 18 6 18 11-7-2-15-3-23-2-8 0-14 2-20 3z',
  'M18 31c6-1 10-2 12-2 1-9 7-14 14-14s13 5 14 14c2 0 6 1 12 2-6 2-14 3-26 3s-20-1-26-3z'];

function Bust({ p }: { p: Person }) {
  const hat = HATS[p.id % 4];
  const beard = p.id % 3 !== 0;
  return (
    <svg className="bust" viewBox="0 0 88 100" aria-hidden>
      <path className="coat" d="M12 100c2-20 14-30 32-30s30 10 32 30z" />
      <path className="collar" d="M32 72c4 5 20 5 24 0l-2 8c-6 3-14 3-20 0z" />
      <path className="skin" d="M38 62h12v9c-2 2-10 2-12 0z" />
      <ellipse className="skin" cx="44" cy="42" rx="15" ry="18" />
      {!hat && <path className="hair" d="M28 34c-1-10 6-17 16-17s17 7 16 17c-3-5-7-8-16-8s-13 3-16 8z" />}
      {beard && <path className="hair" d="M33 46c1 9 5 14 11 14s10-5 11-14c-3 3-6 4-11 4s-8-1-11-4z" />}
      {hat && <path className="hat" d={hat} />}
      <path className="line" d="M38 41h3M47 41h3M43 46l-1 4h3M40 54c2 1 6 1 8 0" />
    </svg>
  );
}

export function Portrait({ p, turn, size = 'card' }: { p: Person; turn: number; size?: 'card' | 'large' }) {
  return (
    <span className={`portrait ${size}`}>
      <Art slot={portraitSlot(p, turn)} fallback={<Bust p={p} />} alt={p.name} />
    </span>
  );
}
