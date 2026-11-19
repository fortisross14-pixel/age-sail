# Age of Sail

A turn-based strategy game about the Age of Discovery, for the browser (laptop and iPad).
You lead the Crown of Castile from 1492: grow your home ports in a fixed Old World,
send explorers west across the Mar Océano, and discover a New World that is generated
fresh every game.

## v0.1: the discovery slice

- **Two boards.** The Old World (fixed: Iberia, France, Britain, the Low Countries, the
  Mediterranean, North Africa) and the New World (procedural: continents, island arcs,
  mid-ocean islands, rivers, biomes by latitude). Sail off the western edge of the Old World
  to reach the eastern ocean of the New World at the same latitude, and back.
- **Turn-based movement.** Each season, ships get movement points. Wind sets the cost of each
  hex: trade winds carry you west in the south, westerlies bring you home in the north.
  Plans show numbered markers where each season's sailing ends. Standing orders carry on.
- **Explorers.** Only a fleet led by an explorer may enter uncharted water. The New World
  view unlocks when one crosses. The first landfall is credited to them.
- **Danger.** Ships carry food for about 8 seasons, then scurvy takes the crew. Storms
  (North Atlantic gales, hurricanes) damage and sink ships. Anchoring off a green coast
  for a season lets the crew forage.
- **Trade.** Six goods (furs, tobacco, cacao, dyes, gold, tools), a Patrician-style price
  model, two home markets (Sevilla, Cádiz), four foreign ones (Lisboa, Antwerpen, London,
  Genova), and native trading grounds in the New World. New goods are dear until Europe gets
  used to them.
- **Home cities.** Sevilla and Cádiz build ships, enlarge their ports and recruit explorers.
  Projects take seasons.
- **The Crown's charge:** 20,000 ducats in the treasury by spring 1502.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # simulation tests (Vitest)
npm run build      # production build in dist/
```

Controls: WASD, the arrow keys, dragging, or resting the pointer at a screen edge pans; wheel or
pinch zooms. Click the sea or a port to plan, click again or press `Space` to sail, right-click to
sail at once. `Enter` ends the season, `1`–`4` open Cities, Markets, Fleets and Court, `M`
switches map, `V` shows winds, `Tab` cycles fleets, `Esc` closes, hold `Alt` to highlight
everything you can click.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the agreed design and the milestones.

## How it is built

- `src/sim/`: the deterministic game core (no DOM). Seeded RNG, hex grids, map generation,
  wind-aware pathfinding, markets, turn resolution. Runs in a Web Worker via Comlink.
- `src/render/`: PixiJS map. Static map art (ink coastlines with water-lining, watercolour
  washes, stamped terrain symbols) is drawn once to canvases. Fog is a parchment veil with
  holes where the chart is known.
- `src/ui/`: React panels on top of the map. State in Zustand, saves in IndexedDB.
- `art/source/`: approved concept sheets. `npm run sprites` (Python, needs numpy, scipy,
  Pillow) cuts them into the transparent sprites in `public/sprites/`.

## Deploying

`.github/workflows/deploy.yml` tests, builds and deploys `main` to GitHub Pages. Enable it once in
the repository settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
