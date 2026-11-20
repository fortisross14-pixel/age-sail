import type { ReactNode } from 'react';

/**
 * Painted art slots. Each slot names a picture from the art sheets in art/PROMPTS.md; until a
 * sheet is cut into public/sprites/art/, the slot shows its fallback (an ink sprite or a gold icon).
 * When a sheet arrives, add its slot names here.
 */
const ICONS = ['cities', 'markets', 'fleets', 'court', 'research', 'chronicle', 'globe', 'home', 'next', 'wind', 'grid', 'eye',
  'coins', 'star', 'settings', 'help', 'quill', 'people', 'docks', 'barracks', 'church', 'university', 'market', 'construction'];
/** cut from the sheets in art/source/ui (icons, buildings, units, cities, portraits, crests, walls) */
export const PAINTED = new Set<string>([
  ...ICONS.map((n) => `icon/${n}`),
  ...['barracks-1', 'barracks-2', 'church-1', 'docks-1', 'docks-2', 'docks-3', 'fortress-1', 'market-1', 'market-2', 'university-1', 'university-2', 'warehouse-1'].map((n) => `building/${n}`),
  ...['archer', 'cannon', 'cavalry', 'colonist', 'explorer', 'infantry', 'missionary', 'mortar', 'musketeer', 'swordsman'].map((n) => `unit/${n}`),
  ...['0', '1', '2', '3'].map((n) => `wall/${n}`),
  ...['camp', 'wagon', 'gun'].map((n) => `misc/${n}`),
  ...['caravel', 'carrack', 'galleon', 'warship'].map((n) => `ship/${n}`),
  ...['antwerp', 'inland', 'larochelle', 'lisbon', 'london', 'port', 'seville', 'town'].map((n) => `city/${n}`),
  ...['men-1', 'men-10', 'men-11', 'men-12', 'men-2', 'men-3', 'men-4', 'men-5', 'men-6', 'men-7', 'men-8', 'men-9', 'women-1', 'women-10', 'women-11', 'women-12', 'women-2', 'women-3', 'women-4', 'women-5', 'women-6', 'women-7', 'women-8', 'women-9'].map((n) => `portrait/${n}`),
  ...['denmark', 'empire', 'england', 'france', 'genoa', 'hanse', 'morocco', 'naples', 'netherlands', 'ottoman', 'papacy', 'portugal', 'scotland', 'spain', 'venice'].map((n) => `crest/${n}`),
]);

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

/** The painted picture of a building at a level, or the nearest lower level that has one. */
export function buildingSlot(b: string, lv: number): string | null {
  for (let l = Math.max(1, lv); l >= 1; l--) if (PAINTED.has(`building/${b}-${l}`)) return `building/${b}-${l}`;
  return null;
}

/** A city's header picture: its own view for the capitals, otherwise one by kind. */
export function cityViewSlot(id: string, inland: boolean, size: number): string {
  if (PAINTED.has(`city/${id}`)) return `city/${id}`;
  return inland ? 'city/inland' : size === 1 ? 'city/town' : 'city/port';
}

/** A realm's painted coat of arms, or the fallback. */
export function CrestArt({ realm, size, fallback }: { realm: string; size: number; fallback: ReactNode }) {
  const url = artUrl(`crest/${realm}`);
  return url ? <img className="crest-img" src={url} height={size} alt="" draggable={false} /> : <>{fallback}</>;
}
