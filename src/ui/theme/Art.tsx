import type { ReactNode } from 'react';

/**
 * Painted art slots. Each slot names a picture from the art sheets in art/PROMPTS.md; until a
 * sheet is cut into public/sprites/art/, the slot shows its fallback (an ink sprite or a gold icon).
 * When a sheet arrives, add its slot names here.
 */
export const PAINTED = new Set<string>([]);

export const artUrl = (slot: string) => (PAINTED.has(slot) ? `${import.meta.env.BASE_URL}sprites/art/${slot}.webp` : null);

export function Art({ slot, fallback, alt = '' }: { slot: string; fallback: ReactNode; alt?: string }) {
  const url = artUrl(slot);
  return url ? <img src={url} alt={alt} draggable={false} /> : <>{fallback}</>;
}
