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
| Phase 2 | **A world that pushes back** (v0.15): rivals with a treasury, ships that sail out and home, colonies that live on convoys, and plans chosen by what they want and can afford; crowns that fight each other; peoples who judge every crown and fight their own wars; soldiers that come by sea where you can see them. Items P2-01 to P2-15 below | 12 of 15 done |
| Phase 3 | Stories and dynasty: a hundred stories in data, chains, a monarch and heirs, crown-specific text | next |
| Phase 4 | Depth: the research tree (was M15), European diplomacy and the Mediterranean (was M14), victory paths, scenarios | |
| Phase 5 | Interface depth: outliner, nested tooltips, ledger, turn summary, map modes, save slots | |
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
| 2 | A world that pushes back | 15 | 12 |
| 3 | Stories and dynasty | 14 | 0 |
| 4 | Depth | 17 | 1 |
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
| P2-13 | Peoples make alliances with each other and migrate when beaten or crowded out (left over from P2-11) | M6 | open |
| P2-14 | Rival armies that march overland to a colony, and your fleets able to intercept a rival ship at sea before it lands (left over from P2-12) | D2 | open |
| P2-15 | Rivals learn the ocean crossing by research they pay for, instead of on the fixed `volta` season | D2 | open |

### Phase 3: Stories and dynasty

Goal: a reign that reads like a story, with people the player cares about, and no repeated card in
one game.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P3-01 | Move stories to data (`src/data/stories/`, one file per family) with a small engine in `src/sim/stories.ts`: conditions by tags, weights, effects from a fixed vocabulary | N1 | open |
| P3-02 | Crown-specific text: remove every hard-coded Castilian name (Toledo, Sevilla, Salamanca, "the King") from `marriage`, `pilot`, `scholar`, `bankers` and `charter_plea`; draw cities, houses and titles from the crown's own data | N5 | open |
| P3-03 | Volume: 100 stories, in steps of 40, 70 and 100. By family: at sea 20, court 20, colonies 20, peoples 15, rival crowns 10, Europe 10, eras 5 | N1 | open |
| P3-04 | Chains: story flags in the game state, follow-ups that fire seasons later because of an earlier choice (a ransom remembered, a loan called in, a marriage that produces an heir) | N2 | open |
| P3-05 | Courtiers with memory: an opinion of you with reasons (as peoples have), and relationships between courtiers (rival, friend, kin) that stories read and write | N3 | open |
| P3-06 | A monarch: a named ruler with age, traits and skills, who dies; an heir, a succession event, and a regency when the heir is a child | N4 | open |
| P3-07 | Royal marriages with the other realms of Europe: a consort, in-laws, claims and alliances (feeds P4-04) | N4, M2 | open |
| P3-08 | Courtier ambitions and loyalty: a courtier wants a rank, a fleet or a governorship; ignored long enough, they leave for a rival crown and take what they know | N3 | open |
| P3-09 | Three historical set pieces per crown, on the model of the Armada for Castile | N7 | open |
| P3-10 | Pacing rule: stories weighted by how much they concern what the player is doing; none repeats in a game while unseen ones remain | N1 | open |
| P3-11 | Tell the reign back: an end-of-game history written from the chronicle (discoveries, wars, rulers), and a short biography for each explorer | N9 | open |
| P3-12 | A picture slot per story family on the event card, with the grid prompts written in `art/PROMPTS.md`. Painting them is P7-04 | N8 | open |
| P3-13 | Era cards with a choice: each new era offers two or three paths that set an ambition for the age | N10 | open |
| P3-14 | Naming: the player names the lands they discover and the colonies they found, and the map and chronicle use the names | N9 | open |

### Phase 4: Depth

Goal: enough to decide for a 200-turn game, and more than one way to win it.

| Id | Action item | Answers | Status |
|---|---|---|---|
| P4-01 | Research tree of about 30 subjects in four branches (navigation, commerce, state, war) unlocking ships, units, buildings and laws (was M15) | D5 | open |
| P4-02 | Research from buildings and from funded scientific expeditions that a scientific explorer completes overseas (was M15) | D5 | open |
| P4-03 | Laws: lasting policies unlocked by the state branch (charters, monopolies, tolerance, conscription), each with a cost and a consequence | D5, M2 | open |
| P4-04 | European diplomacy: an attitude for each of the fifteen realms, envoys, and treaties (trade, non-aggression, alliance) (was M14) | M2 | open |
| P4-05 | European wars: wars between realms that close ports, move markets and can be joined; letters of marque for privateers | M2 | open |
| P4-06 | The Mediterranean front: corsairs, the Ottomans, and Venice and Genoa as trading rivals (was M14) | M2 | open |
| P4-07 | Victory paths beside the score: trade hegemony, empire and prestige, each with a visible race in Court, Crowns | D7, G2 | open |
| P4-08 | Scenarios with goals: three to start (the old Crown's charge of 20,000 ducats by 1502, a spice race, an independence crisis) | G2 | open |
| P4-09 | Give prestige a use: it opens better petitioners, royal marriages and treaties, and is spent on favours | G6 | open |
| P4-10 | Sea battles on the three-round model of land battles (gunnery, boarding, pursuit), with a report | M3 | open |
| P4-11 | More to build at home: five more Old World buildings, and buildings that depend on each other | M4 | open |
| P4-12 | Decide how the game treats slavery and the plantation economy. **Decided: it is in**, as a hybrid of a good and a unit (see "Systems decisions") | M5 | done (decision) |
| P4-13 | A late game worth reaching: independence wars as a campaign, and objectives for the last two eras | G2 | open |
| P4-14 | Enslaved people in the game state: counted in a fleet's hold and in a colony (not a named unit, not a plain cargo), with a price in the markets that deal in them and food to be found for them aboard and ashore | M5 | open |
| P4-15 | How they are acquired: bought at trading grounds on the African coast and from other crowns' ports, and taken as captives in battles and when a village or colony falls | M5 | open |
| P4-16 | How they are used: put to work on a colony's hexes beside colonists (plantation goods first), without the settlers' needs for cloth, wine and luxuries, and sold on in colonial and European markets | M5 | open |
| P4-17 | What it costs: deaths at sea and in the fields, flight and risings in colonies where they outnumber the settlers, what it does to the peoples they were taken from and to your standing with them, and, in the later eras, laws that restrict or end the trade (P4-03). No objective or ambition rewards it; the game states what happens and leaves the judgment to the player | M5 | open |

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
