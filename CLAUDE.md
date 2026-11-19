# Age of Sail

Turn-based colonisation game: Vite, React, TypeScript, PixiJS 8, rules in a Web Worker.

- Read `.claude/skills/age-sail-conventions/SKILL.md` before changing `src/`.
- Design decisions and milestones: `docs/ROADMAP.md`. Latest audit: `docs/AUDIT.md`.
- Verify with `npm test`, `npm run build` and `npx vite-node tools/seed-sweep.ts 100`.

## Art and style direction (from the owner)

- Aim for the best style the platform allows (a regular laptop browser, PixiJS + CSS), not the
  cheapest. The owner is happy to generate art grids with ChatGPT for any style: when a look needs
  painted art, write the grid prompt (exact rows and columns, transparent background, no text)
  in `art/PROMPTS.md` instead of settling for a plainer look.
- Screens (Cities, Markets, Fleets, Court, Research, Chronicle) open on top of everything, HUD
  included, over a dimmed map; closing returns to the plain map and HUD. Nothing else moves.
