export const fmt = (n: number) => Math.round(n).toLocaleString('en');

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const NAMES: Record<string, string> = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };

/** Compass point the wind blows FROM, given the map-space angle it blows toward. */
export function windFrom(angle: number): string {
  const bearing = Math.atan2(-Math.cos(angle), Math.sin(angle)); // radians, 0 = north, clockwise
  const deg = ((bearing * 180) / Math.PI + 360) % 360;
  return NAMES[POINTS[Math.round(deg / 45) % 8]];
}

export function windStrength(s: number): string {
  if (s < 0.3) return 'light and fickle';
  if (s < 0.6) return 'moderate';
  if (s < 0.85) return 'fresh';
  return 'strong';
}

export const latLabel = (lat: number) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}`;
export const lonLabel = (lon: number) => `${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}`;
