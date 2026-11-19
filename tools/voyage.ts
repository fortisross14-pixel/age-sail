import { newGame, endTurn, buy, moveFleet, crossOcean, mergeFleets, promote, assignLeader } from '../src/sim/game';
import { OLD, NEW } from '../src/sim/hex';
const { world, state } = newGame(Number(process.argv[2] ?? 1492));
mergeFleets(state, state.fleets[0].id, state.fleets[1].id);
const f = state.fleets[0];
const nav = [...state.people].sort((x, y) => y.skills.navigation - x.skills.navigation)[0];
promote(state, nav.id, 'explorer', { unit: 'infantry' }); endTurn(world, state); endTurn(world, state); assignLeader(state, nav.id, f.id);
buy(world, state, f.id, 'tools', 100);
const edge = world.old.portals.reduce((b, h) => (Math.abs(OLD.lat(h) - 30) < Math.abs(OLD.lat(b) - 30) ? h : b));
console.log('edge lat', OLD.lat(edge), 'move ok', moveFleet(world, state, f.id, edge));
for (let t = 0; t < 16; t++) {
  const g = f.map === 'old' ? OLD : NEW;
  console.log(`T${state.turn} ${f.map} hex ${f.hex} lat ${g.lat(f.hex).toFixed(0)} lon ${g.lon(f.hex).toFixed(0)} moves ${f.moves} sup ${f.supplies} crew ${f.crew} order ${f.order?.path.length ?? '-'} at ${f.at} alive ${state.fleets.includes(f)}`);
  if (!state.fleets.includes(f)) break;
  if (f.map === 'old' && !f.order && f.moves > 0) console.log(' cross', crossOcean(world, state, f.id));
  if (f.map === 'new' && !f.order && !f.at) {
    const site = [...world.new.ports].sort((a, b) => NEW.distance(f.hex, a.hex) - NEW.distance(f.hex, b.hex))[0];
    console.log(' to', site.name, moveFleet(world, state, f.id, site.hex));
  }
  if (f.at && f.map === 'new') break;
  endTurn(world, state);
}
console.log(state.chronicle.slice(-8).map((c) => c.text).join('\n'));
