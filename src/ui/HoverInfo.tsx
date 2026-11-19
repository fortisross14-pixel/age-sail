import { useStore } from '../store';
import { TERRAIN_INFO } from '../data/terrain';
import { GRIDS } from '../sim/hex';
import { Fog, seasonOf } from '../sim/types';
import { latLabel, lonLabel, windFrom, windStrength } from './format';

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
  const portal = m.portals.includes(hex);
  return (
    <div className="hover-info">
      <div className="muted small">{latLabel(g.lat(hex))} {lonLabel(g.lon(hex))}</div>
      {fog === Fog.Unknown ? (
        <div>Uncharted</div>
      ) : (
        <>
          <div>{port ? <b>{port.name}</b> : TERRAIN_INFO[m.terrain[hex] as keyof typeof TERRAIN_INFO].name}{fog === Fog.Charted ? ' (sighted from afar)' : ''}</div>
          <div className="small">Wind from the {windFrom(wind.angle[hex])}, {windStrength(wind.strength[hex])}</div>
        </>
      )}
      {portal && <div className="small"><b>{map === 'old' ? 'Edge of the chart: sail on to cross the Mar Océano' : 'Edge of the chart: sail on to reach Europe'}</b></div>}
    </div>
  );
}
