import { useStore } from '../store';
import { TERRAIN_INFO } from '../data/terrain';
import { GRIDS } from '../sim/hex';
import { Fog, seasonOf } from '../sim/types';
import { deepPeril } from '../sim/game';
import { RESOURCES, RESOURCE_IDS } from '../data/city';
import { isWater } from '../data/terrain';
import { latLabel, lonLabel, windFrom, windStrength } from './format';

/** One quiet line in the bottom-right corner about the hex under the pointer. */
export function HoverInfo() {
  const hover = useStore((s) => s.hover);
  const world = useStore((s) => s.world)!;
  const game = useStore((s) => s.game)!;
  if (!hover) return null;
  const { map, hex } = hover;
  const g = GRIDS[map];
  const m = world[map];
  const fog = game.fog[map][hex];
  const wind = m.wind[seasonOf(game.turn)];
  const port = m.ports.find((p) => p.hex === hex && (p.kind !== 'native' || game.discovered.includes(p.id)));
  const parts = [`${latLabel(g.lat(hex))} ${lonLabel(g.lon(hex))}`];
  if (fog === Fog.Unknown) parts.push('Uncharted');
  else {
    parts.push(port ? port.name : TERRAIN_INFO[m.terrain[hex] as keyof typeof TERRAIN_INFO].name + (fog === Fog.Charted ? ' (seen from afar)' : ''));
    parts.push(`wind from the ${windFrom(wind.angle[hex])}, ${windStrength(wind.strength[hex])}`);
  }
  if (fog !== Fog.Unknown && !isWater(m.terrain[hex])) {
    const r = m.resource[hex];
    if (game.surveyed[map][hex]) parts.push(r ? RESOURCES[RESOURCE_IDS[r - 1]].name : 'surveyed: nothing of note');
    else if (map === 'new' || g.lat(hex) < 30) parts.push('not surveyed: send a party ashore');
  }
  if (fog >= Fog.Explored && m.rumours.some((r) => r.hex === hex) && !game.rumoursDone[map].includes(hex)) parts.push('rumours of ruins: a party might go and see');
  if (fog !== Fog.Unknown && m.deep[hex]) parts.push(deepPeril(game) ? 'open ocean: no landmarks, stores spoil fast' : 'open ocean');
  if (m.portals.includes(hex)) parts.push(map === 'old' ? 'edge of the chart: the Mar Océano lies beyond' : 'edge of the chart: Europe lies beyond');
  return <div className="hover-line">{parts.join(' · ')}</div>;
}
