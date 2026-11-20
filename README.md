# Age of Sail

A turn-based strategy game about the Age of Discovery, for the browser (laptop and iPad).
You lead the Crown of Castile from 1492: grow your home ports in a fixed Old World,
send explorers west across the Mar Océano, and discover a New World that is generated
fresh every game.

## Now playing: v0.19

Phase 5, interface depth (first part): keyboard handling rebuilt on one table, so keys act on what is in front of you and never behind it; a Realm tab beside the map listing every fleet, party, colony and threat; a ledger that accounts for every ducat of the turn; one card for the turn's news; a Diplomacy screen for peoples, rival crowns and Europe; and a hover line that says what a foreign ship or army is and where it is going.

From v0.18, depth (second half): slavery as the period had it, with its costs and a law that ends it; three races to win beside the score; three scenarios with a goal and a year; favours bought with prestige; fights at sea in three rounds with a report; five more buildings at home; and a late game in which colonies that break away must be recognised, retaken or lost to a rival's protection. A fourth scenario begins in 1690 with an empire to hold together; free states form leagues and send militia against your colonies; and an ally at war asks you to choose.

From v0.17, depth (first half): a research tree of 32 subjects in four branches that unlock ships, soldiers, the star fort, laws and alliances; nine laws, of which a realm keeps only a few; funded scientific expeditions; and Europe as a place to act in (Court, Europe): envoys, gifts, trade treaties, pacts and alliances with fourteen realms, their wars to join or stand aside from, letters of marque, corsairs and tribute, and a Levant spice trade that an Ottoman war can cut.

From v0.16, stories and dynasty: 114 stories written as data, with choices that come back years later and three historical set pieces for each crown; a ruling house with heirs, regencies, successions and royal marriages (Court, Dynasty); courtiers who remember what you did, want things, and can be tempted away by a rival; eras that open with a choice of path; a land you name; and the history of your reign told back in the Chronicle. Also the last of Phase 2: armies that march overland, rival ships you can attack, rivals who pay to learn the ocean crossing, and pacts between peoples.

From v0.15, a world that pushes back: rival crowns have a treasury, ships that sail out and come home, colonies that live on convoys, and plans they choose and save for; they go to war with each other; native peoples judge every crown and fight wars of their own; at war, enemy soldiers come by sea where you can see them. Court shows what each crown is doing.

From v0.14, the first hour: a first voyage in eight steps and advisers' ambitions with rewards, an objectives panel with "Show me", a short welcome and a tabbed guide in place of the help wall, End Turn reminders with `N` for the next thing that needs you, a ring on the map for the step in hand, openings written for each crown, news of the first rival sail, and three difficulty levels (Squire, Captain, Admiral). The plan from here, item by item: [docs/ROADMAP.md](docs/ROADMAP.md#production-plan); the audit behind it: [docs/PRODUCTION-AUDIT.md](docs/PRODUCTION-AUDIT.md).

From v0.13, a living market: factories in any European port that sell slowly at fair prices and buy cheap; regional tastes; shocks; rival merchants; tools that wear out in the colonies.

From v0.12, armies: six kinds of soldiers, armies that need food, battles in three rounds with a report, walls and guns, veterans.

From v0.11, colonies and natives: turns of half a year (a year from 1550); colonies that grow slowly by births and need settlers from home, who season a turn before they work; garrisons that must be fed; native peoples who remember what you did, feed their friends and besiege their enemies.

From v0.10, the Admiralty interface: navy lacquer and gold, screens that open over the map with motion and sound, a city screen with building places, a portrait court.

From v0.9, your realm: play Castile, Portugal, England, France or the Netherlands, in an Old World of 53 cities and 15 realms.

From v0.8: the long game: eras, colonial loyalty and independence, stories with choices, and an end date (1550,
1650 or 1750) with final standings. From v0.7: rival crowns race you for coasts, trade and score; wars bring
privateers and raids, and their colonies can be stormed. From v0.6: native peoples with villages, rivals and moods: trade with them, build trading posts, send missions,
make alliances, set rivals against each other, or conquer. And from v0.5: a court of people with skills who age and die; cities with buildings that train units; landing parties
that explore on foot and find hidden resources and ruins; colonies that must be fed, clothed and given
wine, grow, and ship their goods home; a score of colonists, territory and commerce. Crossing the
Mar Océano is near-hopeless until the court masters *Volta do mar*. See [docs/ROADMAP.md](docs/ROADMAP.md).

## v0.1: the discovery slice

- **Two boards.** The Old World (Europe and the Mediterranean fixed; the African coast south of
  Morocco generated per game) and the New World (procedural: continents, island arcs,
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
sail at once. `Enter` ends the turn (and asks first if something urgent is undone), `1`–`7` open Cities, Markets,
Fleets, Court, Diplomacy, Research and Chronicle, `L` the ledger, `N` the next thing that needs you,
`H` the guide (its Controls page lists every key), `M`
switches map, `V` shows winds, `Tab` cycles fleets, `Esc` closes, hold `Alt` to highlight
everything you can click.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the agreed design, the milestones and the production plan,
[docs/PRODUCTION-AUDIT.md](docs/PRODUCTION-AUDIT.md) for the review against the leaders of the genre, and
[docs/AUDIT.md](docs/AUDIT.md) for the engineering audit.

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
