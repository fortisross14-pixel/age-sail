# Art requests: the Admiralty interface

**How to use these.** One prompt makes one image: paste one at a time, each in a new message.
Attach the Admiralty concept image and `icons.png` (the medallion sheet) as style references
every time. Save each result in `art/source/ui/` under its file name and I'll cut it in.

**Why they look like this.** The icon sheet came out best when every item sat in its own framed
cell on a plain background. So every prompt asks for a strict grid of framed tiles on flat navy:
easy for ChatGPT to draw, easy for me to cut, no transparency needed.

Every prompt starts with the same style paragraph, so the sheets match:

> **Style:** painted game-interface art for a historical strategy game, matching the attached
> references: deep navy enamel, polished gold leaf with a soft top-left light, warm parchment,
> rich but clean detail, crisp edges. No text, letters, numbers or labels anywhere.

---

## Done

- **1. `icons.png`**: the 24 gold-on-navy medallions. Cut and in the game (dock, rail, HUD,
  stats, screen headers, city roles).

## 2. `buildings.png`

> Style: painted game-interface art for a historical strategy game, matching the attached
> references: deep navy enamel, polished gold leaf with a soft top-left light, warm parchment,
> rich but clean detail, crisp edges. No text, letters, numbers or labels anywhere.
>
> A landscape image with a strict grid of 4 columns and 3 rows of square tiles, all the same
> size, separated by even gaps of flat plain navy. Each tile has a light parchment background and
> a thin gold border, and shows one building of 1500s Europe as a small painted miniature in
> three-quarter view, centred, on a little patch of ground or quay, the same scale in every tile:
> 1 small wooden dock with a crane · 2 stone dockyard with a ship on the slipway · 3 great royal
> dockyard with a galleon being built · 4 timber barracks with pikes ·
> 5 stone barracks with towers and banners · 6 stone church with a bell tower · 7 small college
> with a cloister · 8 grand university with a dome ·
> 9 market with striped awnings · 10 stone exchange with arcades and a crane · 11 warehouse with
> barrels · 12 star-shaped fortress with cannon.

## 3. `crests.png`

> Style: (the same paragraph)
>
> A landscape image with a strict grid of 5 columns and 3 rows on flat plain navy, evenly
> spaced. Each cell holds one heraldic shield, all the same shape and size (a rounded heater
> shield with a thin gold rim), simple and bold so each reads when small:
> Castile (red and gold, a castle) · Portugal (white with small blue shields, red border) ·
> England (red, gold lions) · France (blue, gold fleurs-de-lis) · the Netherlands (orange, a
> lion) ·
> the Ottomans (green, a crescent) · Morocco (red, a gold star knot) · Venice (red, a gold
> winged lion) · Genoa (white, a red cross) · the Papal States (red, crossed gold keys) ·
> Naples (blue and gold) · the Hanse (red and white halves, a ship) · Denmark (red, a white
> cross) · Scotland (blue, a white saltire) · the Empire (gold, a black double-headed eagle).

## 4. `portraits-men.png`

> Style: (the same paragraph)
>
> A landscape image with a strict grid of 4 columns and 3 rows on flat plain navy. Each cell
> holds one oval portrait in a thin gold frame, all the same size: head and shoulders,
> three-quarter view, a painted miniature with warm light. Men of a European royal court around
> 1500–1600, ages rising from about 20 (top left) to about 70 (bottom right): a young courtier ·
> a navigator in a cap · an explorer in a morion helmet · a soldier in a breastplate ·
> a merchant in a fur-trimmed coat · a Dominican friar · a scholar with spectacles · a nobleman
> with a ruff ·
> a sea captain · a royal secretary · a bishop · a grizzled old admiral.

## 5. `portraits-women.png`

> Style: (the same paragraph)
>
> A landscape image with a strict grid of 4 columns and 3 rows on flat plain navy. Each cell
> holds one oval portrait in a thin gold frame, all the same size: head and shoulders,
> three-quarter view, a painted miniature with warm light. Women of a European royal court
> around 1500–1600, ages rising from about 20 (top left) to about 70 (bottom right): a young
> heiress · a lady-in-waiting · a cartographer · a Dutch burgher's wife in a white cap ·
> a noblewoman in a French hood · a woman scholar · a merchant's widow · an English lady with a
> ruff ·
> a court physician · a diplomat · an abbess · an elderly dowager.

## 6. `units.png`

> Style: (the same paragraph)
>
> A landscape image with a strict grid of 5 columns and 2 rows of square tiles, all the same
> size, separated by even gaps of flat plain navy. Each tile has a light parchment background and
> a thin gold border, and shows one painted miniature, centred, the same scale in every tile:
> a colonist with an axe and bundle · a pikeman in a morion · a musketeer · a friar holding a
> cross · an explorer with a spyglass and cloak ·
> a merchant with a ledger · a caravel at sea · a carrack at sea · a galleon at sea · a Dutch
> fluyt at sea.

## 7. `cities.png`

> Style: (the same paragraph)
>
> A landscape image with a strict grid of 2 columns and 4 rows of wide panels, each panel three
> times as wide as it is tall, all the same size, separated by even gaps of flat plain navy, no
> frames. Each panel is a painted city skyline across water under a pale sky with soft clouds:
> Sevilla with its cathedral tower and ships at the quay · Lisboa on the river with a fortified
> tower · London with a long bridge and a white castle · La Rochelle with two harbour towers ·
> Antwerpen with a tall cathedral spire · a sunny southern port · a walled inland city on a hill ·
> a small fishing town.

## 8. `title.png`

> Style: (the same paragraph)
>
> A wide 16:9 painting for a game's title screen: caravels and a galleon leaving a sunlit
> Iberian harbour at dawn for the open ocean; in the foreground, the edge of a navy-lacquered desk
> with gold inlay, an old sea chart, a brass astrolabe and a compass. Keep the middle third calm
> and empty for the title and buttons.

---

### Where each sheet goes

| Sheet | In the game |
|---|---|
| icons (done) | dock, rail, HUD buttons and stats, screen headers, city roles |
| buildings | city building places, the building card, the build list (docks I–III, barracks I–II, church, university I–II, market I–II; 11–12 spare) |
| crests | your arms in the HUD and city headers, the crown picker, Crowns standings, map realm labels |
| portraits | court cards and the courtier detail (men and women, by age) |
| units | recruitment cards, explorer commissions, fleet lists |
| cities | the picture in each city screen's header (capitals; the rest by kind) |
| title | the menu background |
