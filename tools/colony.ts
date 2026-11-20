import { newGame, endTurn, mergeFleets, promote, assignLeader, landParty, foundColony } from '../src/sim/game';
import { OLD } from '../src/sim/hex';
import { Fog } from '../src/sim/types';
for (const seed of [1492, 7, 42]) {
  const { world, state } = newGame(seed);
  mergeFleets(state, state.fleets[0].id, state.fleets[1].id);
  const f = state.fleets[0];
  const nav = [...state.people].sort((x, y) => y.skills.navigation - x.skills.navigation)[0];
  promote(state, nav.id, 'explorer', { unit: 'colonist' }); endTurn(world, state); endTurn(world, state); assignLeader(state, nav.id, f.id);
  state.units.push({ id: 999, type: 'colonist', fleet: f.id, city: null, party: null });
  f.cargo = { timber: 40, tools: 30, cloth: 10, wine: 10, food: 10 };
  const m = world.old;
  const shore = [...Array(OLD.N).keys()].find((h) => OLD.lat(h) < 20 && OLD.lat(h) > 8 && m.terrain[h] > 2 && m.mainland[h]
    && OLD.neighbors(h).some((j) => m.terrain[j] <= 1) && m.ports.every((p) => OLD.distance(p.hex, h) > 3))!;
  f.hex = OLD.neighbors(shore).find((j) => m.terrain[j] <= 1)!; f.at = null;
  for (const h of OLD.within(shore, 3)) state.fog.old[h] = Fog.Explored;
  landParty(world, state, f.id, shore, true);
  console.log(seed, foundColony(world, state, state.parties[0].id).ok);
  const c = state.colonies[0];
  const rows: string[] = [];
  for (let t = 0; t < 20; t++) {
    endTurn(world, state);
    rows.push(`${c.pop}${c.last.hungry ? 'H' : c.last.discontent ? 'D' : ''}`);
  }
  const stock = Object.entries(c.stock).filter(([, v]) => v! >= 1).map(([g, v]) => `${g}:${Math.floor(v!)}`).join(' ');
  console.log('  pop by turn (half-years):', rows.join(' '), '| stock after 10 years:', stock, `| births ${(c.last.births * 100).toFixed(1)}% deaths ${(c.last.deaths * 100).toFixed(1)}%`);
  for (const e of state.chronicle.filter((x) => x.kind === 'peril' && x.text.includes(c.name))) console.log('   ', e.turn, e.text);
}
