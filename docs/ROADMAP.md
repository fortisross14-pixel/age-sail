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

## Milestones

| # | Milestone | Status |
|---|---|---|
| v0.1 | Two boards, turn-based sailing, explorers, landfall, trade, home cities | done |
| M1 | HUD and controls: clean map, top HUD, 4 drawers (Cities, Markets, Fleets, Court), dismissible news, WASD and edge scrolling, steady winds, half-stores away from home, fleet merge/split/rename, price comparison | done |
| M2 | Near shore and research: procedural African coast and islands south of 30.5°N with coastal peoples (gold, pepper, dyes), sugar and pepper as goods, a deadly open ocean (stores spoil twice as fast, storms three times as likely, starving crews vanish), a first research tree of 7 subjects where *Volta do mar* opens the crossing | done |
| M3 | The court: 9 courtiers with ages, traits and five skills; petitioners each spring; ranks (explorer with a free colonist, infantry or missionary; merchant; governor) that take seasons to prepare; leaders command fleets; unit places on ships; aging and death; salaries; skill effects (navigation: moves, rationing, open-ocean storms; commerce and diplomacy: prices; construction: city projects); merchant trade routes; fleets grouped as expeditions, trade, idle; known European waters cost half movement | done |
| M4 | Units ashore and city buildings: barracks, docks, university, market; city-built units; landing and exploring on foot; hidden resources and rumours inland. Cities can specialise (a military city, a trading and navigation port) or do everything | next |
| M5 | Colonies (first playable): building materials, colonists' needs, founding and growth, production shipped home | |
| M6 | Native peoples: trading posts, missions, alliances, numbers-based combat, diplomacy | |
| M7 | Rival crowns: AI rivals racing for land, wars, later independence | |
| later | Old World depth (buildings, full research), events and characters' stories, eras, score and victory, Chronicle, iPad performance, an illustrator's cohesive art set | |
