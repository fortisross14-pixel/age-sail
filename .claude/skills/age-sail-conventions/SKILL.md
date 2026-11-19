---
name: age-sail-conventions
description: >
  House rules for the Age of Sail codebase: deterministic simulation in a worker, the
  sim/render/ui split, save versioning, balance numbers, and the verify loop (tests, seed sweep,
  headless screenshots). Use before changing anything in src/, adding a game system, touching
  saves or the map art, or tuning balance.
---

# Age of Sail conventions

A turn-based, seasonal colonisation game. Vite + React + TypeScript, PixiJS 8 for the map,
Zustand for UI state, the rules in a Comlink Web Worker. Load the generic skills alongside this
one: `pixijs-rendering` (map), `save-systems` (saves), `procedural-gen` (mapgen),
`game-ai` (rivals, natives, routes), `game-ui-ux` (HUD, drawers), `performance-optimization`.

## Layers and what may import what

| Layer | Path | May import | Never |
|---|---|---|---|
| Data | `src/data/` | nothing but other data | logic, DOM |
| Simulation | `src/sim/` | `src/data/` | DOM, Pixi, React, `Math.random`, `Date.now` |
| Worker | `src/sim/worker.ts` | sim | UI state |
| Render | `src/render/` | sim types, data | mutating game state |
| UI | `src/ui/`, `src/store.ts` | everything above, through the store | rules logic (ask the worker) |

- **Every rule lives in `src/sim/` and runs in the worker.** The UI sends a `Command`
  (`src/sim/worker.ts`) and gets back `{ result, state }`. New player actions are a new
  `Command` kind plus a pure function in `game.ts` (or its domain module) that returns
  `CommandResult`.
- **Determinism.** All randomness goes through `mulberry32(hashSeed(seed, turn, ...))` from
  `src/sim/rng.ts`, keyed by stable ids, so one seed replays one game. A new random roll gets
  its own key; never reuse a stream another system draws from.
- **The player's crown** (`state.crown`, `world.crown`) decides which Old World cities are home:
  `generateWorld(seed, crown)` marks them `kind: 'home'`. Never hard-code Castile or Sevilla: use
  `mainPort(s)`, `crownSpec(s.crown)` and `rivalsOf(s.crown)`. Messages speak to the player as the
  ruler ("your realm"), never about "the Crown" as someone else.
- **Cities** come from `CITIES` in `src/data/europe.ts` (largest first; placement keeps an empty hex
  between any two). Inland cities have no market or docks; their units march to the nearest port.
- **The world is regenerated from the seed on load**, not saved. Any change to `mapgen.ts`
  output changes every existing save's map: bump the generator version (see Saves).

## Saves

- Saved to IndexedDB through `idb-keyval` (`src/store.ts`), wrapped by `src/save.ts` as
  `{ saveVersion, genVersion, state }`. Shape change: bump `SAVE_VERSION` and add a migration.
  Map generation change: bump `GEN_VERSION` in `src/sim/version.ts` and the pinned digest in
  `src/sim/determinism.test.ts`.
- Changing the shape of `GameState` or the output of map generation requires a save version
  bump and, where cheap, a migration. Players must be told when a save can't be loaded.
- Never put class instances, functions or typed arrays that cannot survive structured clone in
  `GameState`.

## Rendering

- The map art (ink, wash, fog veils) is drawn once to canvases and uploaded as textures. Fog is
  paper veils with holes, not Pixi masks: masks overflow the GPU texture limit at high zoom.
- Layers rebuild only when a key string of their inputs changes (`syncColonies`, `syncRivals`).
  Keep that pattern; don't rebuild a layer on every store change.
- Map text and colours come from `src/render/palette.ts`; game objects use crown colours and
  plates so they read apart from the printed map.

## Interface (the Admiralty look)

- Theme in `src/ui/theme/admiralty.css` (tokens on `:root`), loaded after `styles.css`. Lacquer and
  gold outside, parchment and ink inside. Wrap panels and modals in `Frame`; use `Icon` (gold line
  icons) and `Art` slots for painted pictures (`src/ui/theme/Art.tsx`, list in `art/PROMPTS.md`).
- Sounds go through `sfx()` in `src/ui/sound.ts` (synthesized, no files). Game orders get their
  sound in `store.run`; panels, tabs and pickers play their own.
- Overlays opened from inside a sliding panel must portal to `.game`: the panel's transform traps
  `position: fixed`.

## Balance

- Tuning numbers belong in `src/data/` (goods, ships, tech, city, rivals, eras), not inline in
  `src/sim/`. When you touch an inline number, move it out.
- Check balance headlessly with the scripts in `tools/` (`rivals.ts`, `voyage.ts`, `colony.ts`,
  `crossing.ts`, `seed-sweep.ts`, `audit-perf.ts`), run with `npx vite-node tools/<file>.ts`.
  Report numbers before and after a change.

## Verify loop

1. `npm test` (Vitest over `src/sim/sim.test.ts`) and `npm run build` (runs `tsc -b`).
2. `npx vite-node tools/seed-sweep.ts 100`: zero failures, distinct maps equal to seeds.
3. For anything visible: `npm run dev`, then Playwright with Chromium
   (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`).
   In dev the page exposes `window.__store` (Zustand) and `window.__view` (the MapView) for
   driving and inspecting the game. Screenshot at 1440×900 and 1280×720.
4. Bump the README "Now playing" line and `docs/ROADMAP.md` when a milestone or pass lands.

## Gotchas

- `tsconfig` is strict with `noUnusedLocals`/`noUnusedParameters`: the build fails on them.
- Pages builds use base `/age-sail/` when `GITHUB_PAGES` is set; reference assets through
  `import.meta.env.BASE_URL`, never a leading `/`.
- The two grids are pointy-top odd-r hexes with different sizes and lat/lon mappings
  (`src/sim/hex.ts`); don't assume one grid's dimensions in the other.
