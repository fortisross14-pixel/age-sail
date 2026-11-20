import type { ReactNode } from 'react';

/**
 * Painted art slots. Each slot names a picture from the art sheets in art/PROMPTS.md; until a
 * sheet is cut into public/sprites/art/, the slot shows its fallback (an ink sprite or a gold icon).
 * When a sheet arrives, add its slot names here.
 */
const ICONS = ['cities', 'markets', 'fleets', 'court', 'research', 'chronicle', 'globe', 'home', 'next', 'wind', 'grid', 'eye',
  'coins', 'star', 'settings', 'help', 'quill', 'people', 'docks', 'barracks', 'church', 'university', 'market', 'construction'];
/** art/source/ui/icons.png, cut into round medallions */
export const PAINTED = new Set<string>([...ICONS.map((n) => `icon/${n}`)]);

export const artUrl = (slot: string) => (PAINTED.has(slot) ? `${import.meta.env.BASE_URL}sprites/art/${slot}.webp` : null);

export function Art({ slot, fallback, alt = '' }: { slot: string; fallback: ReactNode; alt?: string }) {
  const url = artUrl(slot);
  return url ? <img src={url} alt={alt} draggable={false} /> : <>{fallback}</>;
}

/** A painted gold-on-navy medallion for an icon name, or the fallback until it exists. */
export function Medal({ name, size, fallback }: { name: string; size: number; fallback: ReactNode }) {
  const url = artUrl(`icon/${name}`);
  return url ? <img className="medal-img" src={url} width={size} height={size} alt="" draggable={false} /> : <>{fallback}</>;
}
