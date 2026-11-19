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

## Milestones

| # | Milestone | Status |
|---|---|---|
| v0.1 | Two boards, turn-based sailing, explorers, landfall, trade, home cities | done |
| M1 | HUD and controls: clean map, top HUD, 4 drawers (Cities, Markets, Fleets, Court), dismissible news, WASD and edge scrolling, steady winds, half-stores away from home, fleet merge/split/rename, price comparison | done |
| M2 | Near shore and research: procedural near shore with coastal peoples, a deadly deep ocean, first research tree (navigation branch; long-distance navigation opens the crossing) | next |
| M3 | The court: people who age and die, five skills, ranks with a free unit, leaders on fleets, merchant trade routes | |
| M4 | Units ashore: city-built units, unit slots on ships, landing, exploring on foot, hidden resources and rumours inland | |
| M5 | Colonies (first playable): building materials, colonists' needs, founding and growth, production shipped home | |
| M6 | Native peoples: trading posts, missions, alliances, numbers-based combat, diplomacy | |
| M7 | Rival crowns: AI rivals racing for land, wars, later independence | |
| later | Old World depth (buildings, full research), events and characters' stories, eras, score and victory, Chronicle, iPad performance, an illustrator's cohesive art set | |
