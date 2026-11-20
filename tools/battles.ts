/** Battle odds for typical armies against typical foes: run with npx vite-node tools/battles.ts */
import { battleOdds, fight, type Force } from '../src/sim/battle';
import { mulberry32 } from '../src/sim/rng';
import { T } from '../src/data/terrain';
import type { UnitType } from '../src/sim/types';
const army = (name: string, ...types: UnitType[]): Force => ({ name, units: types.map((type) => ({ type, vet: 0 })) });
const natives = (w: number, empire = false): Force => ({ name: 'natives', units: [], warriors: w, natives: true, empire });
const armies = [
  army('2 colonists', 'colonist', 'colonist'),
  army('1 pike + colonist', 'infantry', 'colonist'),
  army('3 pikes', 'infantry', 'infantry', 'infantry'),
  army('2 pikes + 2 crossbows', 'infantry', 'infantry', 'archer', 'archer'),
  army('2 pikes + 2 arquebus', 'infantry', 'infantry', 'musketeer', 'musketeer'),
  army('4 swords + 2 arquebus + 2 lancers', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'musketeer', 'musketeer', 'cavalry', 'cavalry'),
  army('6 swords + 3 arquebus + 2 lancers + 2 guns', ...Array(6).fill('swordsman'), 'musketeer', 'musketeer', 'musketeer', 'cavalry', 'cavalry', 'cannon', 'cannon'),
];
for (const [label, foe, terrain] of [['10 warriors, plains', natives(10), T.Plains], ['15 warriors, forest', natives(15), T.Forest], ['30 imperial warriors, plains (walls)', { ...natives(30, true), walls: 1 }, T.Plains]] as [string, Force, number][]) {
  console.log(label);
  for (const a of armies) {
    const o = battleOdds(a, foe, terrain, 'assault', 300);
    const r = fight(mulberry32(7), a, foe, terrain);
    console.log(`  ${a.name.padEnd(40)} win ${(o * 100).toFixed(0).padStart(3)}%   sample losses: mine ${(r.atkLoss * 100).toFixed(0)}%, theirs ${(r.defLoss * 100).toFixed(0)}%`);
  }
}
const garrison = (walls: number): Force => ({ ...army('3 pikes + 4 settlers', 'infantry', 'infantry', 'infantry', 'colonist', 'colonist', 'colonist', 'colonist'), walls });
console.log('Storming 3 pikes + 4 settlers');
for (const w of [0, 1, 2]) for (const a of [army('6 pikes', ...Array(6).fill('infantry')), army('5 pikes + 2 guns', ...Array(5).fill('infantry'), 'cannon', 'cannon')])
  console.log(`  walls ${w} ${a.name.padEnd(20)} ${(battleOdds(a, garrison(w), T.Plains, 'assault', 300) * 100).toFixed(0)}%`);
console.log('Natives attacking a colony (attacker win %)');
for (const w of [0, 1, 2]) for (const [label, foe] of [['raid of 6', natives(6)], ['siege assault of 12', natives(12)]] as [string, Force][]) {
  for (const def of [army('3 settlers', 'colonist', 'colonist', 'colonist'), army('1 pike + 3 settlers', 'infantry', 'colonist', 'colonist', 'colonist'), army('2 pikes + 1 arquebus + 4 settlers', 'infantry', 'infantry', 'musketeer', 'colonist', 'colonist', 'colonist', 'colonist')])
    console.log(`  walls ${w} ${label.padEnd(22)} vs ${def.name.padEnd(34)} ${(battleOdds(foe, { ...def, walls: w }, T.Forest, 'assault', 300) * 100).toFixed(0)}%`);
}
