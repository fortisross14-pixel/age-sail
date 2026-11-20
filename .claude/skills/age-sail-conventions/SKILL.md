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
- **Time.** `state.turn` is a season clock. A player's turn (`endTurn`) runs `seasonTick` for each
  season it covers: two until 1550, four after (`turnStride`, `turnLabel` in `types.ts`). Write rules
  per season; never assume one `endTurn` is one season (tests of a single season call `seasonTick`).
- **Colonies and natives** tune in `src/data/colony.ts` (births and deaths, seasoning, garrison food,
  siege thresholds). Change a people's attitude with `remember(s, st, why, delta)` so the player can
  see the reason, never by writing `attitude` directly.
- **Battles** go through `fight()` in `src/sim/battle.ts` with `Force`s (`partyForce`, `colonyForce`,
  `nativeForce`, `rivalForce`, `freeForce`); unit numbers live in `src/data/army.ts`. Player-ordered
  battles push a `kind: 'battle'` event with the report. Check odds with `tools/battles.ts`.
  Count soldiers with `isMilitary(type)`, never `type === 'infantry'`.
- **Stories are data.** A new story is an entry in its family's file under `src/data/stories/`
  (types and the list of text variables in `types.ts`): `about` binds its subjects, `when` its
  conditions, each choice has `effects` from the fixed vocabulary, and optionally a `roll` with an
  `else`. Never write a realm's own place or family names in a story: use `{capital}`, `{house}`,
  `{school}`, `{bankers}`, `{saint}`, `{ruler}` (crown data in `src/data/dynasty.ts`); only the
  `history` family may. A follow-up is `chained: true` and reached with `['later', id, seasons]`.
  A new effect or condition is a case in `carry` or `holds` in `src/sim/stories.ts` plus its type.
  `stories.test.ts` tells every story with every choice for every crown: keep it passing.
- **What helps the realm goes through `realmMods(s)`** (`src/sim/dynasty.ts`): the ruler's gift, the
  era's path, every subject known and every law in force, added up. A subject or a law that
  changes a number carries `mods` (the keys are in `Mods`, `src/data/tech.ts`); a new key needs
  one line in `add()` and one read at the rule it affects. `knowledgeMods(s)` is the same without
  ruler and age. A subject that makes something possible lists it in `unlocks`, and the rule that
  allows it asks `techFor` or `wallsTech`.
- **Slavery** (`src/sim/slavery.ts`, numbers in `src/data/slavery.ts`) is in the game by the owner's
  decision, as a count of captives in a hold and of enslaved people in a colony. Keep the rule the
  file's header states: nothing in it feeds the score, `s.revenue`, an objective or an ambition, and
  text states what happens without praise or lecture. `late.test.ts` checks the objectives.
- **Fights at sea** go through `seaFight()` (`src/sim/seafight.ts`) and put a `sea` report on a
  battle card, as land battles put a `battle` report.
- **Europe** (`src/sim/europe.ts`, numbers in `src/data/diplomacy.ts`): a realm's regard for you is
  read with `regardOf` (a rival crown's lives in `s.rivals`, the rest in `s.europe`); treaties with
  `treatyWith`, `pacted`, `enemyOf`. A new quarrel is a line in `QUARRELS`.
- **Courtiers** remember through `recallDeed(s, p, amount, why)` (in `court.ts`), which moves their
  loyalty and shows the reason; never write `loyalty` directly.
- **Rival crowns** (`src/sim/rivals.ts`, numbers in `RIVAL_ECON`): each has a treasury, hulls and a
  plan. A new thing a rival can do is an `Option` in `options()` with a want (`u`), a cost and a
  `run`; `decide` picks. Every ship must come from a hull (`spawn`) and return it (`reachHome`) or
  be lost (`loseShip`): `hulls + ships at sea === built` is tested. Change a people's regard for a
  crown through `st.crowns[crown]`; show what a rival does through `rivalDoing`.
- **Markets** move in `seasonTick`: `src/sim/trade.ts` adds regional taste and shocks to consumption
  (`demandFactor`), and factories (`factorySeason`); rival cargoes arrive with their ships; numbers in `src/data/trade.ts`.
- **Objectives** (the first voyage, advisers' ambitions): words, order and rewards in
  `src/data/objectives.ts`, conditions in `src/sim/objectives.ts` (`MET`, one function per id).
  A first-voyage step can carry `inScreen` (the hint shown inside the screen it opens) and `point`
  (where the map ring sits); what differs by crown goes in `OPENINGS`.
  `checkObjectives` runs after every order (in the worker) and every season; it pays once and
  logs to the chronicle. A new objective is a data entry plus a condition; never pay a reward
  anywhere else.
- **Difficulty** (`state.difficulty`): read levers through `difficultySpec(s.difficulty)` from
  `src/data/difficulty.ts`. Captain must leave every number as it was; add a lever there rather
  than branching on the level in rules.
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
- **What needs the player** is one list, `attention()` in `src/ui/attention.ts` (pure, no rules):
  End Turn's reminder, the count on its button and any future outliner read it. A new kind of
  reminder goes there, with a stable id so the player is asked once. Jump to things with
  `store.goTo(target)`.
- Per-player choices that are not part of a voyage (reminders on or off, a folded panel) go in
  `src/ui/prefs.ts` (localStorage), never in `GameState`.
- Screens (the `Drawer`) open centred over everything, HUD included, on a dimmed backdrop; a
  click outside or Escape closes them. Nothing on the map moves when one opens.
- Overlays opened from inside a screen must portal to `.game`: the panel's transform traps
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
4. Bump the README "Now playing" line when a phase lands, and in `docs/ROADMAP.md` set the status
   of each action item you finish (ids like P1-16) and the phase's done count. Why an item exists
   is in `docs/PRODUCTION-AUDIT.md`.

## Gotchas

- `tsconfig` is strict with `noUnusedLocals`/`noUnusedParameters`: the build fails on them.
- Pages builds use base `/age-sail/` when `GITHUB_PAGES` is set; reference assets through
  `import.meta.env.BASE_URL`, never a leading `/`.
- The two grids are pointy-top odd-r hexes with different sizes and lat/lon mappings
  (`src/sim/hex.ts`); don't assume one grid's dimensions in the other.
