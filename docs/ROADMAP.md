# Roadmap

Decisions agreed so far and the milestones toward a playable game. The game design document
(Claude Docs: "Age of Sail — Game Design Document") is the long-form vision; this file is the
working plan and wins where they differ.

## Design decisions

**Structure**
- Two boards, switched with a toggle. The **Old World** is fixed: your cities, building,
  research, trade between European ports; no wars at first. The **New World** is procedural:
  every game is a new discovery.
- **Near shore first (M2).** The game opens on a procedural near shore (an African-style coast
  and Atlantic islands) to explore and trade along. Crossing the Mar Océano is nearly hopeless
  at first: ships rarely come back. Researching long-distance navigation makes it hard but
  doable, and expansion west begins.
- Turn-based, one season per turn, Colonization-style movement points. Wind sets the cost of
  each hex. Winds are steady bands a player can learn.

**People and the court**
- The court is people: hired, aged, and mortal. Each has skills: **navigation** (more moves,
  stores last longer), **military** (battles), **commerce** (better prices, Patrician/Anno-style
  routes in the Old World), **construction** (faster, cheaper founding and building),
  **diplomacy** (dealing with native peoples).
- A person is promoted to a rank (explorer, merchant, missionary, soldier, colonist…). The rank
  comes with one free unit of that type after one or two seasons. All other units are produced in
  cities and loaded onto fleets.
- Missions: commercial missions across the Old World; exploring, founding and conquering
  missions in the New World.

**Ships, units, supplies**
- Unit slots: a caravel carries one unit, a galleon four. The leader takes a slot (two caravels:
  the leader in one, a unit in the other).
- Stores: only a home port fills them. Foreign ports, native traders, and anchoring a season off a
  green coast (an island will do) refill them to half.
- Finding goods and good land means exploring inland on foot; ships only chart coasts.

**Economy**
- Building materials: **timber, tools, stone** (stone for larger buildings and cities).
- Colonists' needs to survive: **food, cloth, drink** (wine, beer, rum). **Luxuries** (sugar,
  tobacco, cacao) let a colony grow beyond survival, so trade goods are also colony needs.
- Founding a town needs a colonist and materials.

**Native peoples** are central, not an afterthought. Several strategies, each with pros and cons:
trading posts and commerce (Dutch-style), settler colonies that push them out (English-style),
conquest and absorption into the kingdom (Spanish-style). Early combat is a matter of numbers:
a small advanced troop against twelve is not an easy win. Diplomacy can turn peoples against each
other. Later: wars with rival crowns for space, and independence wars against insurgents.

**Winning:** a score combining **population**, **commerce revenue** and **territory** (area).

## Balance notes (M2)

- Without *Volta do mar*, about 1 in 5 attempted crossings reaches the New World and none come back
  (`tools/crossing.ts` simulates 20 seeds). With it, every test crossing succeeds: trained crossings
  should get harder in a later tuning pass (storms, mutiny, the leader's navigation skill).
- The court alone researches *Volta do mar* by about 1498; exploring the coast brings it earlier.
- M3: with the court's best navigator in command, about 4 in 20 untrained crossings come back; without one, almost
  none. Food rationing (navigation) does not work in the open ocean before *Volta do mar*.
- M3: European home waters (charted, not open ocean, north of Cape Bojador) cost half movement, so Sevilla to
  Antwerpen is about two seasons each way. Patrician-style routes work, but seasonal turns make them slow.

- M5: a colony started with 2 colonists and a season of cloth and wine reaches 4 colonists (a full outpost) in about
  3 years and stores 20–40 sugar. Growth and output are deliberately modest; tune once natives and rivals add pressure.

- M7: with no player action, Portugal has 3–5 colonies by 1507 (2–3 across the ocean), England 3–5, the Dutch 1 plus
  trading posts. Rival colonies grow one colonist every 5 seasons without needs, so they are steady rather than fast.

- M8: over 600 seasons with no player input, the three rivals settle about 38 colonies and level off as good coast runs
  out; England and Portugal reach scores near 10,000 by 1642. A player needs a handful of large, loyal colonies to compete.
  The whole simulation stays under a millisecond a season, and a save stays under 100 KB.

- M9: each crown's base city taxes are scaled toward 200 a season (between ×0.75 and ×1.6), so a
  big realm is richer but no crown starts broke. With no player orders for 200 seasons, treasuries
  end between about 8,000 (the Netherlands) and 27,000 (Castile). As AI rivals, Castile is strongest
  (15–17 colonies by 1542) and France and the Netherlands weakest (1–4): for the balance pass.
  A season costs under 0.6 ms with 35 markets; a save is about 150 KB.

## Milestones

| # | Milestone | Status |
|---|---|---|
| v0.1 | Two boards, turn-based sailing, explorers, landfall, trade, home cities | done |
| M1 | HUD and controls: clean map, top HUD, 4 drawers (Cities, Markets, Fleets, Court), dismissible news, WASD and edge scrolling, steady winds, half-stores away from home, fleet merge/split/rename, price comparison | done |
| M2 | Near shore and research: procedural African coast and islands south of 30.5°N with coastal peoples (gold, pepper, dyes), sugar and pepper as goods, a deadly open ocean (stores spoil twice as fast, storms three times as likely, starving crews vanish), a first research tree of 7 subjects where *Volta do mar* opens the crossing | done |
| M3 | The court: 9 courtiers with ages, traits and five skills; petitioners each spring; ranks (explorer with a free colonist, infantry or missionary; merchant; governor) that take seasons to prepare; leaders command fleets; unit places on ships; aging and death; salaries; skill effects (navigation: moves, rationing, open-ocean storms; commerce and diplomacy: prices; construction: city projects); merchant trade routes; fleets grouped as expeditions, trade, idle; known European waters cost half movement | done |
| M4 | City buildings with limited room (Sevilla 7 places, Cádiz 5): docks (ship types), barracks (infantry), church (missionaries), university (research), market (dues, better prices); base taxes; cities train colonists, infantry and missionaries; landing parties go ashore from a fleet, march overland at terrain cost, survey for hidden resources (gold, silver, fertile land, timber, furs, dyes, pepper; one rich region per board), follow rumours of ruins, lost cities and shrines, and board again | done |
| M5 | Colonies (first playable): new goods (timber, stone, food, cloth, wine, silver); found a colony with a party's colonists on surveyed coast and timber and tools from a fleet beside it; colonists work hexes (food first, then the most valuable crop or resource); needs each season (food; cloth and wine or work slows and growth stops; luxuries speed growth); outpost → town → city with materials; fleets dock, load and unload; merchant routes can serve colonies; score = colonists ×10 + territory ×2 + sales/200 | done |
| M6 | Native peoples: every trading ground is a people with inland villages, warriors and rivals, one empire per board; attitude from trade, gifts, posts, missions, encroaching colonies and attacks; trading posts (more trade), missions (conversion, then peaceful joining), alliances, inciting rivals, peace; numbers-based battles with terrain and allies; conquest makes subjects who pay tribute and whose land counts as territory; hostile peoples raid colonies and ambush parties; an epidemic some seasons after first contact | done |
| M7 | Rival crowns: Portugal, England and the Netherlands, each with its own pace, preferred coasts and taste for trade; their ships sail visibly to found colonies at the richest sites (blocking yours) and to open trading posts that thin native trade; their colonies grow; attitude sours when you settle near them (and, after the Tordesillas event, on Portugal's African coast); wars with privateers hunting your fleets (sea battles by guns), raids on colonies, storming and taking their colonies, paying for peace; standings in Court → Crowns and your rank in the HUD | done |
| M8 | The long game: five eras with cards; colonial loyalty drifting toward a target (taxes, generations overseas, era, size, distance, garrison, charter, needs, luxuries), unrest, independence risings decided by the garrison, free states that can be retaken; a colonial tax rate; royal charters and festivals; a dozen stories with choices (mutiny, plague, court quarrels, Genoese loans, a scholar, a pilot's secret, colony petitions, survivors at sea, native envoys, a marriage, the Armada, the price revolution); short, standard or full games ending in 1550, 1650 or 1750 with final standings and victory, and play on | done |
| Pass 1 | Best practices: game-dev skills in `.claude/skills/`, audit (`docs/AUDIT.md`), versioned saves, crash recovery, render on demand, lazy New World art, determinism tests | done |
| M9 | Your realm: play any of the five Atlantic crowns, each with a national edge; 53 named Old World cities in 15 realms (the five crowns plus the Ottomans, Morocco, Venice, Genoa, the Papal States, Naples, the Hanse, Denmark, Scotland and the Empire), at least one empty hex apart; realm borders and names on the chart; every city of your realm is yours to build in (inland ones train units that march to the nearest port); you are the Crown, with no charge or deadline; a plain start with two ships, a colonist and a soldier | done |
| M10 | GUI pass in the Admiralty look (navy lacquer, gold leaf, parchment): HUD with crest, map-tool rail, six-tile dock, minimap; every screen opens over the map and HUD with motion and synthesized sound; city screen (Overview, Buildings with slot tiles, detail card and a short picker with an info button, Economy, Recruitment); Court as portrait cards with a detail pane and commissions; Fleets and Markets as list and detail with visual goods rows; Research as three branch columns; Chronicle as a timeline. Waiting for the art sheets in `art/PROMPTS.md`; then a shorter, visual help and title screen | base done |
| M11 | Colonies and natives: turns of half a year until 1550, then a year (seasons still pass one by one underneath); colonies grow by births over deaths (slow; the tropics are deadly), so settlers come from home and spend a season "seasoning" before they work; soldiers and friars eat from the warehouse or desert; peoples remember why they feel as they do (gifts, trade, posts, missions, settlers on their land, attacks, sickness); friendly peoples trade food to nearby colonies and raise births; furious ones besiege a colony (no fields worked, an assault each season) and can burn it | done |
| M12 | Armies: pikemen, swordsmen, crossbowmen, arquebusiers, lancers and field guns (barracks II for the last three), each with fire, melee, toughness and pursuit; parties ashore are armies under a general, carrying food (a small band forages, an army starves without supply, and restocks beside a colony); automatic battles in three rounds (fire, melee, pursuit) decided by morale, with terrain (horse and guns poor in rough country, defenders stronger there), firearms frightening peoples who have never met them, assault or steady stance, and a battle report; colony walls (palisade, stone walls, star fort) that field guns breach; veterans; native raids, sieges and ambushes, rival raids and storms, and retaking free states all fought the same way | done |
| M13 | A living market: rival merchants, regional demand, shocks, colonial demand; your trading posts (factories) in any European city to buy and sell where it pays most; saturation and price drops | |
| M14 | The Mediterranean front (corsairs, the Ottomans, Venice and Genoa) and European treaties | |
| M15 | Knowledge: research from research buildings and funded scientific expeditions (a scientific explorer completes one in the New World); a tree of about 30 subjects that unlock ships, units, buildings and laws | |
| Pass 3 | Balance: tuning numbers in one place, autoplay harness, retune for five crowns | |
| later | Scenarios with goals (the old Crown's charge belongs here), Mediterranean powers as playable nations | |
| later | Rival AI depth (real fleets and economies, rival-native alliances), Old World depth (buildings, full research), events and characters' stories, eras, score and victory, Chronicle, iPad performance, an illustrator's cohesive art set | |

## M9: Your realm (plan)

Decided with the player after M8:

- **Five playable crowns**: Castile, Portugal, England, France and the Netherlands, chosen on the
  menu. Each has its own home cities, coast, starting ships and a national edge (Castile: more
  colonists and missionaries; Portugal: a head start in navigation research; England: privateers
  and cheaper guns; France: a larger court and diplomacy; Netherlands: commerce and cheaper
  cargo ships). The four you don't pick are the AI rivals.
- **The Old World fills out**: about 40 named cities across Europe and the Maghreb, at least one
  empty hex between any two (Cádiz moves away from Sevilla). Every city belongs to a realm: the
  five crowns, plus non-playable powers with their own cities (Ottomans, Morocco, Venice, Genoa,
  the Hanse, the Papal States). Realm borders are drawn on the chart as a thin ink line and a
  light wash; cities are shown plainly with their names.
- **All your mainland cities are yours** from the start. Each has building slots by size, and its
  role comes from what you build there: a market makes a trade centre (better prices for its sea),
  barracks a military centre, docks a seaport and shipyard, a university a research seat. Convoys
  can run between your own cities, or you can centralise everything in one. Foreign cities trade.
- **You are the Crown.** Messages come from your advisers and your treasury, never from "the
  Crown". No charge or deadline: the base game is a sandbox scored on population, commerce and
  territory. Scenarios with goals come later.
- **A plain start**, as in other strategy games: a couple of ships in your main port, a colonist and
  a soldier ready, and your court.

## Systems decisions (from the systems review)

- **Exploration** stays slow and dangerous: many voyages fail before they reach a coast. First you
  discover, then send another expedition with materials, found a colony with no troops, send troops
  and the food to feed them, and the natives may ravage it before it stands.
- **Trade** is about the edge: open posts in Sevilla, Venice, Paris or anywhere, buy and sell within
  Europe, and bring goods from the Indies to wherever pays most. Flood a market and the price falls.
- **Colonies** grow slowly on their own (births and deaths); most settlers are trained at home,
  shipped, and season for a turn. Size is capped by level; raising it takes materials from home.
- **Research** comes from research buildings and from scientific expeditions you fund.
- **Turns** are half a year, then a year from 1550.
- **Battles** are automatic with a high-level report: this is Civilization, not Europa Universalis.
- **Slavery** is left out for now.

## M10: GUI pass (plan)

"This is not a text game": an indie game with quality.

- **City screen with tabs.** *Buildings*: a grid of slots, limited by city size; an empty slot opens
  a picker showing each building's icon, name, cost and one line, with an info button for the
  details. *Economy*: what the city makes, uses and pays, as icons and bars. *Recruitment*: unit
  cards with cost and time.
- **The court as portraits**: a card per courtier with a portrait, age and skill pips; text only in
  the detail view.
- **Icons and numbers first** in the HUD, drawers and news; prose moves to tooltips and info
  panels. Readable sizes (no text under 14 px), Escape closes anything, reduced motion honoured.
- Art requests for portraits and building icons: `art/PROMPTS.md`.
