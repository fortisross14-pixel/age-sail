// Estimates GPU texture memory for the map art of both boards.
import { GRIDS } from '../src/sim/hex';
import { INK_RES, WASH_SCALE, VEIL_SCALE } from '../src/render/mapArt';
let total = 0;
for (const id of ['old', 'new'] as const) {
  const g = GRIDS[id]; const ink = g.pxW * g.pxH * INK_RES ** 2 * 4, wash = g.pxW * g.pxH * WASH_SCALE ** 2 * 4, veil = 2 * g.pxW * g.pxH * VEIL_SCALE ** 2 * 4;
  total += ink + wash + veil;
  console.log(id, `${g.pxW.toFixed(0)}x${g.pxH.toFixed(0)} px`, 'ink MB', (ink / 2 ** 20).toFixed(0), 'wash MB', (wash / 2 ** 20).toFixed(0), 'veils MB', (veil / 2 ** 20).toFixed(0));
}
console.log('total GPU RGBA MB ~', (total / 2 ** 20).toFixed(0));
