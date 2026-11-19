// Can a fleet cross the Mar Océano without long-distance navigation? Try many seeds, both ways.
import { newGame, endTurn, moveFleet, crossOcean } from '../src/sim/game';
import { OLD, NEW } from '../src/sim/hex';
for (const volta of [false, true]) {
  let reached = 0, died = 0, back = 0;
  const N = 20;
  for (let seed = 1; seed <= N; seed++) {
    const { world, state } = newGame(seed);
    if (volta) state.research.known.push('portolan', 'lateen', 'astrolabe', 'volta');
    const f = state.fleets[0];
    const edge = world.old.portals.reduce((b, h) => (Math.abs(OLD.lat(h) - 36) < Math.abs(OLD.lat(b) - 36) ? h : b));
    moveFleet(world, state, f.id, edge);
    let landed = false;
    for (let t = 0; t < 30 && state.fleets.includes(f); t++) {
      if (f.map === 'old' && !f.order && f.moves > 0 && !landed) crossOcean(world, state, f.id);
      if (f.map === 'new' && !f.order && !landed) {
        const site = [...world.new.ports].sort((a, b) => NEW.distance(f.hex, a.hex) - NEW.distance(f.hex, b.hex))[0];
        moveFleet(world, state, f.id, site.hex);
      }
      if (f.at && f.map === 'new' && !landed) {
        landed = true; reached++;
        // provision to half and head home along the westerlies
        moveFleet(world, state, f.id, world.new.portals.reduce((b, h) => (Math.abs(NEW.lat(h) - 44) < Math.abs(NEW.lat(b) - 44) ? h : b)));
      }
      if (landed && f.map === 'new' && !f.order && f.moves > 0) crossOcean(world, state, f.id);
      if (landed && f.map === 'old') { back++; break; }
      endTurn(world, state);
    }
    if (!state.fleets.includes(f)) died++;
  }
  console.log(volta ? 'with volta do mar' : 'without        ', `reached New World ${reached}/${N}, came back to European waters ${back}/${N}, lost ${died}/${N}`);
}
// how soon can the court research the crossing?
const { world, state } = newGame(1492);
let t = 0;
while (!state.research.known.includes('volta') && t < 80) { endTurn(world, state); t++; }
console.log('volta do mar with no discoveries at all: turn', t, `(${1492 + Math.floor(t / 4)})`);
