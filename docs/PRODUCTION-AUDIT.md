# Production audit (after v0.13)

A production lead's review of the game against the leaders of the genre: Europa Universalis,
Crusader Kings, Total War, Civilization, Old World and Humankind. It asks what a player would feel
is missing, area by area. The engineering review is a separate document, [AUDIT.md](AUDIT.md).

Every finding below points at the action items that answer it. The items, their status and their
order live in [ROADMAP.md](ROADMAP.md#production-plan); this file is the reasoning and does not
change as work lands, except for the corrections at the end.

## How it was done

- Read `docs/ROADMAP.md`, `docs/AUDIT.md`, and the story, rival, research, objectives-relevant and
  turn-loop code (`src/sim/stories.ts`, `rivals.ts`, `game.ts`, `src/data/tech.ts`).
- Played six turns in a headless browser at 1440×900 as Castile on the standard length, and opened
  the menu, the map, Cities, Markets, Fleets and Court.
- **Not seen in play:** the Research and Chronicle screens, battles, colonies, native diplomacy and
  anything after 1494. Judgments on those come from the code and the roadmap, and are marked
  "from code" below.
- The scores are a reviewer's judgment out of 10, not measurements.

## Scorecard

| Area | Now | Indie target | Closest benchmark |
|---|---|---|---|
| Storytelling and narrative | 3 | 7 | Old World, Crusader Kings |
| Gameplay and fun | 5 | 8 | Civilization |
| Difficulty, depth and engagement | 3 | 7 | Europa Universalis, Old World |
| Game mechanics | 6 | 8 | Europa Universalis, Colonization |
| GUI and navigation | 6 | 8 | Old World, Civilization |
| Art, fonts and visuals | 7 | 8 | Humankind, Total War |

**Verdict.** The game has a real identity (a deadly ocean, supplies, the *Volta do mar* as the gate
west) and is unusually broad for its stage. What separates it from the games above is not breadth:
it is onboarding, opposition and narrative volume. The plan therefore puts the first hour first,
then the rivals and the stories, before adding more systems.

## 1. Storytelling and narrative (3 → 7)

What the leaders do: Old World ships thousands of events tied to characters with memory; Crusader
Kings makes the ruler and the dynasty the emotional core; both chain events so one choice returns
later.

| # | Finding | Evidence | Answered by |
|---|---|---|---|
| N1 | There are 12 story events, with a 30 % chance each season. Repeats will show within one game. | `STORIES` in `src/sim/stories.ts`; `maybeStory` | P3-03, P3-10 |
| N2 | Events stand alone: no chains, no flags, no memory of earlier choices. | Each story's `apply` changes numbers and ends | P3-04 |
| N3 | Courtiers have skills, a trait and an age, but no relationships, opinions or ambitions. | `Person` in `src/sim/types.ts` | P3-05, P3-08 |
| N4 | You are a faceless Crown: no ruler, heir or succession. | No monarch in `GameState` | P3-06, P3-07 |
| N5 | Story text is written for Castile whichever crown you play: "a great house of Toledo", "the taverns of Sevilla", "a scholar from Salamanca", chests that "arrive in Sevilla", bells rung "for the King". | `marriage`, `pilot`, `scholar`, `bankers`, `charter_plea` | P3-02 |
| N6 | "Survivors at sea" chose among Portugal, England and the Netherlands without excluding the player's own crown. | `survivors` in `stories.ts` | P1-14 (fixed) |
| N7 | Only Castile has a historical set piece (the Armada). | `armada` | P3-09 |
| N8 | Story cards show an empty cartouche where a picture should be. | `EventCard` uses `ornaments/cartouche` | P3-12, P7-04 |
| N9 | The Chronicle records, but the game never tells your reign back to you. | From code: a flat timeline | P3-11 |
| N10 | Era changes are cards to dismiss, not decisions. | `kind: 'era'` events have no choices | P3-13 |

## 2. Gameplay and fun (5 → 8)

What the leaders do: Civilization always has something about to finish and something to decide;
Old World gives ambitions that turn a sandbox into a string of short goals.

| # | Finding | Evidence | Answered by |
|---|---|---|---|
| G1 | The opening is empty. Six turns ended with both ships idle in port: nothing prompted, pushed back or set a goal. | Play session | P1-01 to P1-10 |
| G2 | The game is a sandbox on one score formula, with "no charge or deadline" by design. The short-term loop is thin. | Roadmap, M9 decisions | P1-03, P4-07, P4-08 |
| G3 | Onboarding was a 13-paragraph modal opened at the start. | `Help` in `src/ui/Overlays.tsx` | P1-06, P1-07 |
| G4 | The core fantasy works and should be protected: the ocean kills, stores run out, winds matter. | Roadmap balance notes | (keep) |
| G5 | Turns are half a year, so a trade route takes a turn or more each way and feedback is slow. | Roadmap balance notes (M3) | P5-04, P6-08 |
| G6 | Prestige rises and falls but buys nothing. | No reader of `s.prestige` in `src/sim/` | P4-09 |

## 3. Difficulty, depth and engagement (3 → 7)

What the leaders do: Europa Universalis and Old World field opponents that play the same game as
you; all of them offer difficulty levels and several ways to win.

| # | Finding | Evidence | Answered by |
|---|---|---|---|
| D1 | There was no difficulty setting. | Menu | P1-11, P6-04 |
| D2 | Rivals are scripted: an expedition on a timer, colonies that gain a settler every few seasons without needs, no treasury, no persistent fleets. | `rivalsSeason`, `RIVAL_SETTLERS_EVERY`, the header of `rivals.ts` | P2-01 to P2-04 |
| D3 | Rivals only relate to the player: not to each other, and not to native peoples beyond trading posts. | `RivalState` holds one attitude, toward you | P2-05, P2-07 |
| D4 | As AI, Castile reaches 15–17 colonies by 1542 while France and the Netherlands reach 1–4. | Roadmap balance notes (M9) | P6-03 |
| D5 | Research has 7 subjects and the key one is done by about 1498, in a game that can run to 1750. | `src/data/tech.ts`; roadmap balance notes | P4-01, P4-02 |
| D6 | About 430 tuning numbers are inline, and there is no autoplay harness to balance against. | AUDIT.md, finding 6 | P6-01, P6-02 |
| D7 | There is one way to win: the score at the end date. | `standings`, `score` | P4-07 |

## 4. Game mechanics (6 → 8)

| # | Finding | Evidence | Answered by |
|---|---|---|---|
| M1 | Breadth is a strength: court, colonies, natives with remembered grievances, three-round battles, living markets, colonial loyalty. | Milestones M3 to M13 | (keep) |
| M2 | Europe is scenery: ten of the fifteen realms do nothing, and there are no treaties, alliances or European wars. | Roadmap, M14 "next" | P4-04, P4-05, P4-06 |
| M3 | Sea battles are decided by guns alone, while land battles have three rounds, morale and a report. | `seaBattle` in `rivals.ts` | P4-10 |
| M4 | Old World cities have five building types. | `src/data/city.ts` | P4-11 |
| M5 | Slavery is "left out for now". For a game about this period that is a design decision to make on purpose, not to leave open. | Roadmap, systems decisions | P4-12 |
| M6 | Native peoples react to the player; from code, they do not act among themselves unless incited. | `nativesSeason` | P2-11 |

## 5. GUI and navigation (6 → 8)

What the leaders do: Old World's nested tooltips and Civilization's "next thing that needs you"
button mean the player never has to hunt for what to do or what a word means.

| # | Finding | Evidence | Answered by |
|---|---|---|---|
| U1 | The Admiralty look is coherent and the screens are legible; the city building screen is the best in the game. | Play session | (keep) |
| U2 | End Turn never asked about idle fleets, unspent leaders or idle scholars. | Play session | P1-08, P1-09, P1-10 |
| U3 | There is no outliner or ledger: no single place that shows everything you own and its state. | Play session | P5-01, P5-03 |
| U4 | Terms (stores, seasoning, loyalty) are explained only in the help text. | Play session | P5-02 |
| U5 | News stacks up to four cards over the map each turn. | Play session, 1280×720 | P5-04, P5-05 |
| U6 | The help listed keys 1 to 4 only. | `Help` | P1-07 |
| U7 | The fleet panel showed one "Embark colonist" button per waiting unit, so two identical buttons. | Play session | P1-12 |
| U8 | On the minimap, the uncharted south was drawn almost black and read as an empty box. | Play session | P1-13 |
| U9 | A chosen option on the menu turned pale with pale text under the pointer. | Play session | P1-23 |
| U10 | One save slot, no undo. | `src/store.ts` | P5-08, P5-09 |

## 6. Art, fonts and visuals (7 → 8)

| # | Finding | Evidence | Answered by |
|---|---|---|---|
| A1 | The title painting, building art, crests and typography are at commercial indie level. | Play session | (keep) |
| A2 | Portraits repeat: several of the nine starting courtiers share a face. | Court screen | P7-03 |
| A3 | The map is handsome but static: no moving water, wakes or seasons. | Play session | P7-05 |
| A4 | There is no music; sound is synthesized effects only. | `src/ui/sound.ts` | P7-01, P7-02 |
| A5 | Colonists and missionaries are still ink figures beside painted soldiers. | `art/PROMPTS.md` | P7-06 |

## Corrections to the first read

Three things said in the first summary of this audit were wrong, and were found while fixing them:

- **Hotkeys.** All six screens already had number keys (1 to 6). Only the help text was out of
  date. The item became "document the keys" (P1-07).
- **Embark buttons.** The two identical buttons were two colonists waiting, not a duplicate. The
  fix groups units by kind and shows the count (P1-12).
- **Minimap.** The lower half was not empty: it was uncharted Africa drawn in a colour close to the
  frame. The fix draws the unknown as chart paper (P1-13).
