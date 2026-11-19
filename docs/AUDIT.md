# Best-practices audit (after v0.8)

Checked against the project skills in `.claude/skills/` (save-systems, performance-optimization,
pixijs-rendering, procedural-gen, game-ai, game-ui-ux). Numbers come from the scripts in
`tools/` run in this repo on 2026-11-19, headless on a cloud container. GPU and frame-time numbers
still need a real laptop.

## Measured

| What | Result |
|---|---|
| Map generation, 100 seeds (`tools/seed-sweep.ts`) | 100 distinct, 100 deterministic, 0 failures; 42 ms median, 110 ms max |
| Per seed | 10 nations, 8–9 Old World native ports, 40–44 % land in the New World, 133–220 hidden resources |
| Game state over 200 seasons (`tools/audit-perf.ts`) | 69 KB → 84 KB; structured clone 1.5 ms; `endTurn` 0.4 ms avg, 3.6 ms p95 |
| World data (sent to the UI once) | 2.9 MB |
| Map art on the GPU (`tools/audit-tex.ts`) | ~260 MB RGBA: ink 207 MB, veils 46 MB, wash 6 MB; both maps built at startup |
| JS bundle | main 605 KB (React + Pixi + UI), worker 125 KB, Pixi renderers split |
| Fonts | 30 of 57 build assets are Greek, Cyrillic and Vietnamese subsets we never render |
| Tests | 57 passing, strict TypeScript clean |

## What is already right

- The rules are a deterministic, seeded simulation with no `Math.random` or clock reads, off the
  main thread in a worker. This is the hardest thing to retrofit, and it's done.
- Saves are plain data (ids, numbers, the seed), not objects. The world is rebuilt from the seed.
- Map layers rebuild only when a key of their inputs changes; Pixi v8 is used idiomatically
  (async `init`, `destroy` on teardown, listeners removed).
- State crossing the worker boundary is small (under 100 KB), so copying the whole state per
  command is fine. No need for diffs.
- CI runs the tests and the type-checked build before every deploy.

## Findings, most important first

### High

1. **Saves break silently on every update.** There is no `version` field: each shape change
   bumps the key (`age-sail:save:v9`), so the old save simply disappears from the menu and stays
   in IndexedDB forever. Worse, the world is regenerated from the seed on load. Any change
   to `mapgen.ts` puts an old save's fleets on a different map with no warning.
   *Fix:* store `{ saveVersion, genVersion, state }`, migrate step by step where cheap, refuse
   with a message (and offer a new game) when not, delete stale keys, and add a round-trip test.

2. **A worker error locks the game.** `endTurn` sets `busy: true` without `try/finally`. If the
   worker throws, End Turn stays disabled until reload. A rejected `run()` is unhandled, and
   there is no React error boundary, so a render error blanks the screen.
   *Fix:* `try/finally` on every worker call with a toast on failure, plus an error boundary
   offering "reload last save".

3. **The map redraws 60 times a second even when nothing moves.** On the target laptop
   (integrated graphics, battery), an idle turn-based game shouldn't keep the GPU busy.
   *Fix:* render on demand. Run the ticker only while a fleet animates, the camera scrolls or
   zooms, or input arrives; render once after each update.

### Medium

4. **GPU memory: ~260 MB of map textures, with matching canvases kept in RAM.** The New World
   is drawn at startup before anyone has crossed. *Fix:* build each map's art on first view,
   release the ink and wash canvases after upload, and measure on a real laptop before trying a
   lower ink resolution.
5. **Every store change re-runs the map update**, including hover moves (each hex crossed).
   That re-sums two 6,000-cell fog arrays and redraws routes. *Fix:* subscribe with a selector
   on the fields the map uses, and skip hover-only changes.
6. **Balance numbers are scattered.** About 430 inline tuning literals across `src/sim/`
   (game.ts 141, natives 78, rivals 63, empire 49, colony 43, land 33, court 27). Hard to tune
   and impossible to review as a set. *Fix for the balance pass:* collect them in
   `src/data/balance.ts`, then add a headless autoplay harness that plays N seeds with a simple
   bot and reports score curves, bankruptcies and colony growth.
7. **Test gaps:** no save round-trip test, no test pinning the first outputs of `mulberry32`
   (a refactor could change every seed), and the seed sweep isn't in CI. *Fix:* add those
   tests, plus a 25-seed sweep as a Vitest case.
8. **Accessibility and readability** (for the GUI pass): Escape closes only the Help card, not
   drawers or event cards. 18 CSS rules set text at 13 px or less. Nothing honours
   `prefers-reduced-motion`. There's no UI scale setting. Event cards already focus their
   first button; drawers don't.
9. **Fonts ship every script subset.** Import the `latin-*` CSS from `@fontsource` only. That
   drops 30 files from the build and the offline cache.

### Low

10. The worker's `newGame` defaults to 1750 while the store defaults to 1650. Take both from
    `GAME_LENGTHS`.
11. `game.ts` (1,206 lines) and `MapView.ts` (1,093) are getting big. Split commands by domain
    (fleets, court, colonies, diplomacy) when next touched; not urgent.
12. There's no linter. ESLint with `typescript-eslint` and `react-hooks` would catch stale
    closures in effects, the main bug class TypeScript misses here.
13. Splitting Pixi into its own chunk (`manualChunks`) would let browsers keep it cached across
    deploys. A nice-to-have.

## Proposed Pass 1 scope

Fix 1, 2, 3, 5, 7, 9, 10 and 12 now (robustness, battery, tests, tooling). Do 4 after a laptop
measurement. Leave 8 for the GUI pass and 6 for the balance pass.
