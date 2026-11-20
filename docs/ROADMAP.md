# Roadmap

Decisions agreed so far, the milestones that built the game, and the production plan that takes it from here
(every action item, with its status, under [Production plan](#production-plan)). The game design document
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

- Phase 2: with no player orders, the four rivals hold 5–8 colonies between them by 1512 (it was 8–14 between
  three before they had purses) and about 42 by 1642, with 6–15 wars among themselves in 150 years. Their
  treasuries run to hundreds of thousands of ducats late on, because trading posts pay for ever and there is
  little left to buy: for Phase 6. France now plants colonies; the Netherlands still starts last. A season
  costs about 4 ms with rivals routing ships out and home (it was under 1 ms): for Phase 7.

- Phase 3: in two full games played with no orders and every card answered in turn, about 170 stories were
  told in 158 years, 37 of the 114 distinct, because most stories need fleets at sea, colonies or peoples met;
  a playing game binds far more. Castile had ten reigns in that time and England six. With nobody hired, the
  court dies out. A season costs about 5 ms. Story frequency against story count is P6-07.

- Phase 4: the whole tree costs about 2,700 research points; the court alone, choosing subjects in order, knew 14
  of 32 by 1522. Subjects already gate arquebusiers, lancers, field guns, galleons and the star fort, which
  were open from the start before: the opening is a little poorer in soldiers until the war branch is begun.
  Treaty thresholds (20, 40, 60) and the price of envoys and wars are first guesses.

- Phase 4, second half: with no player, the Netherlands' trade passed 200,000 ducats by about 1575 in three
  games, so the trade race is set at 520,000 for a standard game and the empire race at 260 colonists and 420
  hexes (rivals reach about 0.4 to 0.7 of that by 1650). Whether a player's sales are on the same scale as a
  rival's is not known: for P6-09. Slavery's prices and death rates are first numbers. A season costs about 6 ms.

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
| M13 | A living market: factories in any European port (yours or foreign, with dues abroad) that hold your goods, sell them slowly at fair prices and buy what you need while it is cheap; regional tastes (wine and spices in the North, silver and sugar in Italy, no wine in the Maghreb); shocks that move a region's demand for a few years (bad harvests, plague, war, a royal wedding, a fashion, a good peace); rival merchants who ship their colonies' sugar, tobacco and furs into their home ports and buy tools and cloth there; colonies wear out tools and work slower without them; glut and scarce markers. Paris trades through Rouen | done |
| Phase 1 | **The first hour** (v0.14): objectives (a first voyage of eight steps, then advisers' ambitions with rewards), an objectives panel with "Show me", a short welcome in place of the help wall, a tabbed guide, End Turn reminders with a count on the button, three difficulty levels, and small interface fixes. Items P1-01 to P1-23 below | 22 of 23 done; P1-20 (watching new players) needs people |
| Phase 2 | **A world that pushes back** (v0.15): rivals with a treasury, ships that sail out and home, colonies that live on convoys, and plans chosen by what they want and can afford; crowns that fight each other; peoples who judge every crown and fight their own wars; soldiers that come by sea where you can see them. Items P2-01 to P2-15 below | done |
| Phase 3 | **Stories and dynasty** (v0.16): 114 stories as data with chains, written for any crown; a ruling house with heirs, regencies, successions and royal marriages; courtiers who remember, want and can be lost to a rival; three historical set pieces per crown; eras that open with a choice of path; the land and colonies named by the player; the reign told back. Items P3-01 to P3-14 below | done |
| Phase 4 | **Depth** (v0.18): a research tree of 32 subjects, ten laws, scientific expeditions; European diplomacy, wars to join, corsairs and the Levant trade; slavery, with what it costs and a law that ends it; three races to win beside the score; three scenarios; uses for prestige; fights at sea in three rounds; five more buildings; free states to recognise or retake, and ambitions for the later ages. Items P4-01 to P4-20 below | 17 of 20 done |
| Phase 5 | Interface depth: outliner, nested tooltips, ledger, turn summary, map modes, save slots | next |
| Phase 6 | Balance (was Pass 3): numbers in one place, autoplay harness, retune the five crowns. Deliberately late | deferred |
| Phase 7 | Technical and visual polish: music, portraits, event paintings, a living map, the open engineering items. Deliberately last | deferred |

The phases come from the production audit ([PRODUCTION-AUDIT.md](PRODUCTION-AUDIT.md)) and replace
the old "M14, M15, Pass 3, later" tail of this table. Every action item is listed under
[Production plan](#production-plan) at the end of this file.

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
- **Slavery is in the game** (owner's decision after the production audit; it replaces "left out
  for now"). Enslaved people are a hybrid of a good and a unit: they are bought and sold in
  markets, taken in wars and battles, carried in a fleet's hold, and put to work in your colonies.
  Built in Phase 4 (P4-14 to P4-17).

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

## Production plan

Where the game goes from v0.13, as action items. The reasoning behind each is the production audit
([PRODUCTION-AUDIT.md](PRODUCTION-AUDIT.md)); the "Answers" column names the finding there
(N narrative, G gameplay, D difficulty, M mechanics, U interface, A art).

**How to use this list.** Each item has an id that never changes. Status is one of **done**,
**open**, or **deferred** (parked on purpose until its phase). When an item lands, set its status
here and update the count in the milestones table. New ideas get the next free number in their
phase; nothing is renumbered.

**Order.** Phases 1 to 5 are worked in order. Balance (Phase 6) and technical and visual polish
(Phase 7) come last by the owner's decision: until then, new numbers are provisional and go in
`src/data/`, and new looks use what the theme already has.

| Phase | Theme | Items | Done |
|---|---|---|---|
| 1 | The first hour | 23 | 22 |
| 2 | A world that pushes back | 15 | 15 |
| 3 | Stories and dynasty | 14 | 14 |
| 4 | Depth | 20 | 17 |
| 5 | Interface depth | 13 | 0 |
| 6 | Balance (deferred) | 10 | 0 |
| 7 | Technical and visual polish (deferred) | 14 | 0 |

### Phase 1: The first hour

Goal: a new player always knows what to do next, is told when they forget something, and can pick
how hard the world pushes. Done when a first-time player reaches a first colony without opening
the guide.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P1-01 | Objectives as a rule system: conditions over the game state in `src/sim/objectives.ts`, checked after every order and every season, each paid once and written in the chronicle; words, order and rewards in `src/data/objectives.ts` | G1, G2 | done |
| P1-02 | The first voyage: eight steps (commission an explorer, load goods, give them a fleet, sail beyond the known coast, meet a people, sell a cargo, send a party ashore, found a colony). Any step can be done out of order | G1 | done |
| P1-03 | Ambitions: twelve goals asked by named advisers (treasurer, pilot major, chancellor, governor), each waiting on earlier ones, three pressed at a time | G2 | done |
| P1-04 | Objectives panel on the right of the map: the next step open with how to do it, the reward, progress where it counts, and "Show me" that opens the right screen or selects the fleet. Folds away, and remembers that | G1, G3 | done |
| P1-05 | A toast and a chime when an objective is met, saying what it paid | G1 | done |
| P1-06 | A short welcome card at the start of a voyage (who you are, what you have, where the first voyage is listed) in place of the 13-paragraph help | G3 | done |
| P1-07 | The guide as a reference in six tabs (First steps, At sea, Colonies, Peoples and crowns, Your realm, Controls), listing keys 1 to 6 | G3, U6 | done |
| P1-08 | An attention list (`src/ui/attention.ts`): no explorer, idle scholars, leaders without a fleet, fleets adrift, parties without orders, colonies hungry or besieged (urgent); low stores, idle ships in port, idle shipyards, petitioners (worth a look) | U2 | done |
| P1-09 | End Turn asks first when something urgent is undone: each line jumps to the thing, each thing is asked about once, and Settings can turn the reminders off | U2 | done |
| P1-10 | The End Turn button shows how many things need you, and lists them in its tooltip | U2 | done |
| P1-11 | Difficulty on the menu: Squire, Captain, Admiral (`src/data/difficulty.ts`). Four levers: starting treasury, the rivals' pace, storms, objective rewards. Captain is the game as it was | D1 | done (numbers provisional: P6-04) |
| P1-12 | Fleets: one Embark button per kind of unit waiting, with the count, instead of one per unit | U7 | done |
| P1-13 | Minimap: uncharted hexes drawn as chart paper so the unknown does not read as an empty box | U8 | done |
| P1-14 | "Survivors at sea" picks only among the crowns you are not playing | N6 | done |
| P1-15 | Save version 15: older voyages become Captain and tick what they have already achieved without paying for it; tests for objectives, difficulty, reminders and the migration | - | done |
| P1-16 | Point at the map for the current step: a pulsing ring on your main port or on the edge of the known coast, resting at the screen's edge when that place is out of view | G1 | done |
| P1-17 | First-time hints inside screens: when Court, Markets or Fleets open for the step in hand, one line says which control to use; closing it is remembered | G3 | done |
| P1-18 | `N` and a button beside End Turn jump to the next thing that needs you, round the attention list, without ending the turn | U2 | done |
| P1-19 | Openings per crown (`OPENINGS` in `src/data/objectives.ts`): a line on the welcome card about what the crown is good at, and the voyage south reworded for Portugal, England, France and the Netherlands | G1 | done |
| P1-20 | Watch three people who have never played reach their first colony; write down where each stalls and add an item for each stall | G1 | open (needs people) |
| P1-21 | News feed at the start of a turn: no more than two cards over the map, the rest behind "and 3 more" | U5 | done |
| P1-22 | The first rival sail is an event ("Rival sails", with "Go there" to the ship), inside the first ten turns for every crown | G1, D2 | done |
| P1-23 | A chosen option on the menu or in Settings keeps its dark look under the pointer | U9 | done |

### Phase 2: A world that pushes back

Goal: rivals play the same game as the player, and the world acts without waiting to be poked.
Systems only: the numbers stay provisional until Phase 6.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P2-01 | Each rival has a treasury: the realm's allowance, trading posts and the profit of cargoes brought home; ships cost upkeep, and every venture has a price (`RIVAL_ECON` in `src/data/rivals.ts`). A crown sails when it can afford to, and otherwise saves for what it wants | D2 | done |
| P2-02 | Rival colonies live on stores from home: a convoy fills them and lands a settler; supplied, they grow by births; unsupplied, they produce less, shrink and are abandoned in the end | D2 | done |
| P2-03 | Rival ships persist: each crown owns named hulls that sail out, do their errand and sail home before they can be used again; ships are lost to storms and to your guns, and new ones are built for money, more as the crown's colonies multiply | D2 | done |
| P2-04 | A plan per rival by utility scoring (`options` and `decide` in `src/sim/rivals.ts`): supply, settle, trade, build, and at war privateers and landings, weighted by each crown's taste for trade and for war | D2 | done |
| P2-05 | Peoples judge every crown, not only yours (`NativeState.crowns`): trading posts win them, settlers on their land anger them, angry peoples raid and burn rival colonies, and a people friendly to a crown at war with you speaks against you | D3 | done |
| P2-06 | Rivals answer what you do: they favour trading grounds you have found or hold a post at, hurry to coasts where your surveyors found riches, and send an ambassador to protest when you settle beside them (pay, promise or refuse) | D2, D3 | done |
| P2-07 | The crowns you do not play have relations with each other: grudges, wars that cost them money, colonies and ships, and peaces; the enemy of your enemy warms to you | D3 | done |
| P2-08 | Show intent: news when a rival sends settlers or soldiers, and a line per crown in Court, Crowns saying what it is doing, how many ships it has, how full its treasury is and whom it is fighting; Court, Peoples shows each people's friends, grudges and wars | D2, U3 | done |
| P2-09 | Difficulty changes behaviour, not only numbers: an `aggression` lever scales how readily rivals declare war, land soldiers, and contest what you have found | D1 | done |
| P2-10 | Rival cargoes are real: a colony's produce waits for a ship, sails home in it and is sold in the home market, where the convoy's tools, cloth and wine were bought. The abstract `rivalMerchants` flow is gone | D2 | done |
| P2-11 | Peoples go to war with their rivals without being incited: skirmishes, a deciding battle, and warriors too busy to raid you meanwhile | M6 | done |
| P2-12 | At war, a rival's soldiers are a ship on the map: they embark at their nearest colony, you are told where they are bound, and they land at your colony when they arrive (raids used to be an unseen roll) | D2 | done |
| P2-13 | Peoples with a common enemy swear pacts (an ally's warriors count for half in their wars), and a people beaten badly, or crowded by settlers it is too weak to fight, abandons a village and moves away | M6 | done |
| P2-14 | At war, a rival's soldiers march overland when your colony is within nine hexes by land, as an army on the map that one of your parties can meet in the field; and a fleet beside any rival ship can attack her (it is war if it was not already) | D2 | done |
| P2-15 | Rivals learn the ocean crossing by paying their pilots season by season (`RIVAL_ECON.study`); a crown without money does not learn it, and a navigator who leaves your court for theirs brings it sooner | D2 | done |

### Phase 3: Stories and dynasty

Goal: a reign that reads like a story, with people the player cares about, and no repeated card in
one game.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P3-01 | Stories are data (`src/data/stories/`, one file per family) read by a small engine in `src/sim/stories.ts`: subjects bound by filters, conditions, effects and uncertain outcomes from a fixed vocabulary, and hints written from the effects | N1 | done |
| P3-02 | No story outside the set pieces names a particular realm's places: cities, great houses, a seat of learning, bankers, a saint and the ruler's title come from the crown's own data (`src/data/dynasty.ts`). A test enforces it | N5 | done |
| P3-03 | 114 stories: at sea 17, the court 17, colonies 17, peoples 14, rival crowns 10, Europe 10, the age 5, the dynasty 6, history 18. The three largest families are three short of the 20 first aimed at | N1 | done |
| P3-04 | Chains: story flags and follow-ups in the game state; nine follow-ups arrive seasons later because of an earlier choice (a ransom repaid in kind, a refused petition that returns, a guest prince who goes home, guns that change a war) | N2 | done |
| P3-05 | Courtiers remember: a loyalty that follows what they hold for and against you, with the reasons shown; rivals, friends and kin at court, so that raising one person galls or pleases others | N3 | done |
| P3-06 | A monarch: the house each crown had in 1492, a ruler with an age and a gift that helps the realm, a consort, heirs born and lost, death, succession by the eldest heir, a regency for a child, and a costly crisis when there is no heir (Court, Dynasty) | N4 | done |
| P3-07 | Royal marriages: offers from the other realms every two years while the ruler is unmarried; a consort brings a dowry (larger with prestige), heirs, and a tie that keeps a rival crown from declaring war. Claims and alliances are left to P4-04 | N4, M2 | done |
| P3-08 | Courtiers want a commission or a command; kept waiting they resent it, and a courtier whose loyalty runs out is offered a place by a rival crown: pay to keep them, let them go with what they know, or arrest them | N3 | done |
| P3-09 | Three set pieces for each crown at about their years, told once and only to that crown (Granada, the Comuneros and the Armada; the road to India, Morocco and the union of crowns; Cabot, the break with Rome and the Armada's defeat; Naples, Verrazzano and the wars of religion; the towns' charters, the breaking of the images and the great company) | N7 | done |
| P3-10 | Pacing: a story never told comes before any that has been; stories about what you are doing (fleets at sea, colonies, peoples met, wars) are likelier; when only old stories fit, they return half as often | N1 | done |
| P3-11 | The reign told back: a history written from the chronicle, the dynasty and the standings, in the Chronicle and at the end of the age; and a short life of each courtier in Court | N9 | done |
| P3-12 | A picture slot for each story family on the card, with the family named under it, and the 3 × 3 grid prompt in `art/PROMPTS.md`. Until the sheet is painted (P7-04) the card shows the cartouche | N8 | done |
| P3-13 | Each new era opens with three paths: the one chosen gives a lasting advantage while the era lasts and sets a goal, judged when the era ends (30 prestige if met) | N10 | done |
| P3-14 | Naming: the first landfall asks what the land shall be called, and the name goes on the map, into the chronicle and the stories; colonies can be renamed | N9 | done |

### Phase 4: Depth

Goal: enough to decide for a 200-turn game, and more than one way to win it.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P4-01 | A research tree of 32 subjects in four branches (navigation 10, commerce 8, state 7, war 7), in `src/data/tech.ts`: each gives the realm something (`mods`) or unlocks something (galleons, arquebusiers, lancers, field guns, the star fort, laws, alliances) | D5 | done |
| P4-02 | Research comes from the court, universities, learned courtiers, the ruler and the age, and from the field; a funded scientific expedition makes everything your explorers chart, meet and survey count three times until it has found enough, then pays a reward | D5 | done |
| P4-03 | Nine laws (`src/data/laws.ts`), each opened by a subject: a realm keeps two, and one more for every three subjects of state; some cannot stand together; enacting costs ducats, repealing costs prestige | D5, M2 | done |
| P4-04 | European diplomacy (Court, Europe): every other realm has a regard for you, moved by envoys, gifts, marriages and what you do; regard wins a trade treaty (better prices in their ports), a pact (they will not attack you) and an alliance (a rival crown fights your enemies overseas, another realm pays toward your wars) | M2 | done |
| P4-05 | The realms of Europe go to war over old quarrels and make peace; a war raises prices where it is fought, and you may take a side: the other side's ports close to you, it costs money each season, and the winner's friends share the indemnity. Letters of marque bring prize money while you have an enemy, and now and then a protest | M2 | done |
| P4-06 | The Mediterranean: corsairs out of Ottoman and Moroccan ports take ships that pass near them, until you pay tribute, win a pact or win their regard; Venice and Genoa keep Italy's spice markets full, and an Ottoman war with either makes pepper scarce there | M2 | done |
| P4-07 | Three races beside the score (`src/sim/victory.ts`): mastery of trade, an empire overseas, the first court of Europe. The first crown to finish one is remembered for it, you or a rival; the game goes on. Progress shows in Court, Crowns | D7, G2 | done |
| P4-08 | Three scenarios chosen on the menu, each a goal and a year: the treasurer's charge (20,000 ducats by 1502), the spice race (30,000 ducats of sales by 1515), beyond the ocean (a colony across the Mar Océano by 1510). Won or lost, the voyage goes on as a free game. The independence crisis first planned as the third is P4-18 | G2 | done |
| P4-09 | Prestige has uses: it raises dowries, draws better petitioners, makes treaties easier to win, and is spent on three favours (summon a renowned captain, a day of honours, a grand embassy) in Court, Dynasty | G6 | done |
| P4-10 | Fights at sea in three rounds (gunnery, boarding, the chase) with a report on the card, for privateers that attack you and for ships you attack; the chase decides whether the beaten side is taken or gets away battered | M3 | done |
| P4-11 | Five more buildings at home, each resting on an older one: warehouses (market), arsenal (docks II), fortress (barracks), observatory (university), cathedral (church) | M4 | done |
| P4-12 | Decide how the game treats slavery and the plantation economy. **Decided: it is in**, as a hybrid of a good and a unit (see "Systems decisions") | M5 | done (decision) |
| P4-13 | The late game: a colony that has broken away unsettles its neighbours until you recognise it (it then trades with you) or retake it; left alone, a rival crown takes it under protection, and retaking it means war. Six ambitions wait for the later ages (laws, treaties, a city overseas, twenty subjects, an age's promise kept, a hundred colonists). Free states that arm and band together are P4-19 | G2 | done |
| P4-14 | Enslaved people in the game state: a count of captives in a fleet's hold (each takes the room of two units of cargo) and a count of enslaved people in a colony, up to twice the settlers its size allows; they are fed and given nothing else | M5 | done |
| P4-15 | How they are acquired: bought at trading grounds on the African coast, which offer the prisoners of that people's own wars (more while it is at war), and taken when one of your parties storms a village | M5 | done |
| P4-16 | How they are used: put ashore at a colony, where they work its land beside the colonists, or sold in the ports of Iberia, Italy and the Maghreb. The money goes to the treasury and is not counted as commerce | M5 | done |
| P4-17 | What it costs: about one in ten dies each season at sea and one in fourteen each year in the fields; some flee; where they far outnumber the settlers they rise unless soldiers hold them down; the peoples they were taken from remember it. The law of abolition (natural philosophy) forbids the trade and frees everyone, half of whom stay as settlers. No objective, ambition or score counts any of it, and a test says so | M5 | done |
| P4-18 | A fourth scenario that starts late: an empire in 1690 with restless colonies, to be held together (needs a way to start a game from a prepared state) | G2 | open |
| P4-19 | Free states that raise armies, band together and carry a war of independence to your loyal colonies | G2 | open |
| P4-20 | An ally's call to war that matters: answering it or refusing it changes the alliance | M2 | open |

### Phase 5: Interface depth

Goal: the player never hunts for what they own, what a word means, or what happened last turn.
Function only: looks are Phase 7.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P5-01 | Outliner: a foldable list of fleets, parties and colonies with one line of state each, click to go there | U3 | open |
| P5-02 | Nested tooltips: game terms in any text (stores, seasoning, loyalty, spread) open a tooltip that can itself be hovered | U4 | open |
| P5-03 | Ledger: income and spending by line for the last turn and a forecast, and the HUD treasury showing the change per turn | U3 | open |
| P5-04 | Turn summary: after End Turn, one card grouping what happened (voyages, trade, court, perils) in place of stacked news | U5, G5 | open |
| P5-05 | News settings: choose which kinds of news appear on the map and which only in the Chronicle | U5 | open |
| P5-06 | Trade help: profit per hold at each known port for the cargo aboard, and a preview of a route's yearly profit before it is set | G5 | open |
| P5-07 | Map modes: realms, resources found, peoples' attitudes, colonial loyalty | U3 | open |
| P5-08 | Undo for the last order when nothing random came of it, and a confirmation for orders that cannot be taken back | U10 | open |
| P5-09 | Three save slots, the last five autosaves, and export and import of a voyage as a file | U10 | open |
| P5-10 | Accessibility left from AUDIT.md finding 8: a UI scale setting, no text under 14 px, focus moved into a screen when it opens | - | open |
| P5-11 | Keys: rebinding, and a key list that reads from the same table the game uses | U6 | open |
| P5-12 | Compare cities and colonies in one table (people, output, loyalty, needs), sortable | U3 | open |
| P5-13 | Standing fleet orders: explore by itself, go home and resupply, patrol a coast | G5 | open |

### Phase 6: Balance (deferred)

Parked until the systems above exist. Until then, record observations under "Balance notes" and
keep new numbers in `src/data/`.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P6-01 | Collect the inline tuning numbers of `src/sim/` (about 430) into `src/data/` (AUDIT.md finding 6) | D6 | deferred |
| P6-02 | Autoplay harness: a simple bot plays N seeds headlessly and reports score curves, bankruptcies, colony growth and game length | D6 | deferred |
| P6-03 | Retune the five crowns as AI rivals: today Castile reaches 15–17 colonies by 1542 and France and the Netherlands 1–4 | D4 | deferred |
| P6-04 | Tune the difficulty levers of P1-11 with the harness | D1 | deferred |
| P6-05 | Tune objective rewards so the first voyage helps without funding the game | G1 | deferred |
| P6-06 | The crossing after *Volta do mar*: every test crossing succeeds today; add storms, mutiny and the leader's skill | G4 | deferred |
| P6-07 | Story frequency and cooldowns against the story count of P3-03 | N1 | deferred |
| P6-08 | Pace of a standard game: time per turn and decisions per turn across the eras | G5 | deferred |
| P6-09 | Score weights (colonists ×10, territory ×2, sales ÷200) against the victory paths of P4-07 | D7 | deferred |
| P6-10 | Colony growth and needs once rivals and natives press (the M5 note: "deliberately modest") | - | deferred |

### Phase 7: Technical and visual polish (deferred)

Last by the owner's decision. Art that needs painting gets its grid prompt in `art/PROMPTS.md`
when its item starts.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P7-01 | Music: a licensed or commissioned period soundtrack, with tracks by era and a volume setting | A4 | deferred |
| P7-02 | Ambient sound: sea, harbour, market and court beds under the synthesized effects | A4 | deferred |
| P7-03 | Portraits: a set large enough that no two courtiers at one court share a face, varied by age, role and crown | A2 | deferred |
| P7-04 | Paintings for the story families of P3-12, and for eras and endings | N8 | deferred |
| P7-05 | A living map: moving water, wakes behind ships, a seasonal tint | A3 | deferred |
| P7-06 | Painted colonist and missionary figures, and ships and armies that read at map scale | A5 | deferred |
| P7-07 | The shorter, visual help and title screen planned in M10 | G3 | deferred |
| P7-08 | An illustrator's cohesive pass over every sheet | A1 | deferred |
| P7-09 | An end-of-game screen worth the 200 turns: standings, the history of P3-11, portraits of the reign | N9 | deferred |
| P7-10 | AUDIT.md finding 4: GPU memory of the map art, measured on a real laptop | - | deferred |
| P7-11 | AUDIT.md findings 11 to 13: split `game.ts` and `MapView.ts` by domain, add ESLint, give Pixi its own chunk | - | deferred |
| P7-12 | Frame times and battery use measured on the target laptop and on an iPad | - | deferred |
| P7-13 | Motion and sound for objectives, reminders and the turn summary in the Admiralty manner | - | deferred |
| P7-14 | Readability pass at 1280×720 and on a tablet for every screen added since M10 | - | deferred |
