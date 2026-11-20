import { useStore } from '../store';
import { TERRAIN_INFO } from '../data/terrain';
import { GRIDS } from '../sim/hex';
import { Fog, seasonOf } from '../sim/types';
import { deepPeril } from '../sim/game';
import { nationAt, moodOf } from '../sim/natives';
import { CROWNS } from '../data/rivals';
import { realmAt, realmSpec } from '../data/realms';
const RIVAL_NAME = Object.fromEntries(CROWNS.map((r) => [r.id, r.name])) as Record<string, string>;
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
  const realm = realmAt(m.realm[hex]);
  if (fog !== Fog.Unknown && realm) {
    const mine = realm === game.crown;
    parts.push(port ? `${mine ? 'your city' : `a city of ${realmSpec(realm).name}`}${port.inland ? ', inland' : ''}` : mine ? 'your realm' : `lands of ${realmSpec(realm).name}`);
  }
  if (fog !== Fog.Unknown && !isWater(m.terrain[hex])) {
    const r = m.resource[hex];
    if (game.surveyed[map][hex]) parts.push(r ? RESOURCES[RESOURCE_IDS[r - 1]].name : 'surveyed: nothing of note');
    else if (map === 'new' || g.lat(hex) < 30) parts.push('not surveyed: send a party ashore');
  }
  if (fog >= Fog.Explored && m.rumours.some((r) => r.hex === hex) && !game.rumoursDone[map].includes(hex)) parts.push('rumours of ruins: a party might go and see');
  if (fog !== Fog.Unknown && m.deep[hex]) parts.push(deepPeril(game) ? 'open ocean: no landmarks, stores spoil fast' : 'open ocean');
  const rc = fog !== Fog.Unknown ? game.rivalColonies.find((c) => c.map === map && GRIDS[map].distance(c.hex, hex) <= (c.level === 'outpost' ? 1 : 2)) : undefined;
  if (rc) parts.push(`${rc.hex === hex ? rc.name : `lands of ${rc.name}`}, a colony of ${RIVAL_NAME[rc.crown]}`);
  const nat = fog !== Fog.Unknown && !isWater(m.terrain[hex]) ? nationAt(world, map, hex) : undefined;
  if (nat && game.natives[nat.id]?.met) parts.push(`lands of the ${nat.people} (${moodOf(game.natives[nat.id])})`);
  if (fog >= Fog.Charted) {
    const KIND: Record<string, string> = { settlers: 'a ship with settlers', trader: 'a merchantman', supply: 'a supply ship', privateer: 'a privateer', raid: 'a troopship', army: 'soldiers on the march' };
    for (const x of game.rivalShips.filter((v) => v.map === map && v.hex === hex)) {
      const to = x.homeward ? 'bound for home' : x.kind === 'privateer' ? 'hunting your ships' : (() => { const c = [...game.colonies, ...game.rivalColonies].find((v) => v.map === map && v.hex === x.target); const p = m.ports.find((v) => v.hex === x.target); return c ? `making for ${c.name}` : p ? `making for ${p.name}` : 'making for an empty coast'; })();
      parts.push(`${x.kind === 'army' ? '' : `the ${x.name}, `}${KIND[x.kind]} of ${RIVAL_NAME[x.crown]}, ${to}`);
    }
    for (const r of game.rebels.filter((v) => v.map === map && v.hex === hex)) parts.push(`${r.name}, about ${r.strength} companies, marching on ${game.colonies.find((c) => c.map === map && c.hex === r.target)?.name ?? 'a colony'}`);
    const fs = game.freeStates.find((f) => f.map === map && f.hex === hex);
    if (fs) parts.push(`${fs.name}, a free state of ${fs.pop} people${fs.recognised ? ', recognised by you' : fs.by ? `, protected by ${RIVAL_NAME[fs.by]}` : ''}`);
  }
  if (m.portals.includes(hex)) parts.push(map === 'old' ? 'edge of the chart: the Mar Océano lies beyond' : 'edge of the chart: Europe lies beyond');
  return <div className="hover-line">{parts.join(' · ')}</div>;
}
