# Art requests for M10: the Admiralty interface

The interface is built and waiting for these sheets. Every picture has a named slot in the
game (`src/ui/theme/Art.tsx`); until a sheet arrives, the slot shows an ink sprite or a gold icon.

**For every prompt:** attach the Admiralty concept image (navy lacquer, gold-leaf frames, parchment
panels) as the style reference, and ask for a **transparent background**. Keep the grid exact
and the gaps wide and empty, so each picture can be cut out cleanly. No text, letters or numbers
anywhere. Save each sheet in `art/source/ui/` under the file name shown.

---

## 1. Icon set: `icons.png` (most needed)

> A sprite sheet of 24 game interface icons in a strict grid of 6 columns by 4 rows, each icon
> centred in its cell with wide empty gaps, on a transparent background. Style: the attached
> concept art — polished gold-leaf metal with a thin dark outline and a soft highlight, like
> engraved brass inlay, readable at 32 pixels, consistent stroke weight and lighting from the top
> left. No text, letters or numbers. In order:
> Row 1: a walled town with towers, wooden barrels with grain sacks, a galleon under sail, a royal
> crown, an open book with a glass flask, a rolled scroll with a wax seal.
> Row 2: a globe, a castle keep, a small ship with an arrow, three curving wind lines, a cluster
> of three hexagons, an open eye.
> Row 3: a stack of gold coins, a five-pointed star, a cogwheel, a question mark seal (no letters,
> just a curl and dot shape), a parchment scroll with a quill, two silhouettes of people.
> Row 4: an anchor, crossed swords, a church with a cross, a domed hall with a mortarboard shape,
> a market stall with scales, a hammer and chisel.

## 2. Building illustrations: `buildings.png`

> A sprite sheet of 12 building illustrations for a historical strategy game set in 1490–1650, in
> a strict grid of 4 columns by 3 rows with wide empty gaps, on a transparent background. Style:
> the attached concept art — richly painted, warm, detailed miniatures in three-quarter view from
> slightly above, each on a small patch of ground or quay, same scale and lighting from the top
> left. No text, letters, numbers, frames or labels. In order:
> Row 1: a small wooden dock with one crane (docks I), a stone dockyard with a ship on the slipway
> (docks II), a great royal dockyard with a galleon in frame and two cranes (docks III), a timber
> barracks with a drill yard and pikes (barracks I).
> Row 2: a stone barracks with towers, banners and soldiers drilling (barracks II), a stone church
> with a bell tower and friary (church), a cloistered college with a small dome (university I),
> a grand university with a dome, library and observatory tower (university II).
> Row 3: a covered market with striped awnings and stalls (market I), a stone exchange with
> arcades, warehouses and a crane (market II), a warehouse with barrels and a hoist (spare), a
> star-shaped stone fortress with cannon (spare).

## 3. City panoramas: `cities.png`

> A sheet of 8 wide panoramic city views, each 3 times as wide as it is tall, stacked in a single
> column with wide empty gaps, on a transparent background. Style: the attached concept art —
> a painted skyline under a pale sky with soft clouds, gently fading to transparent on the left
> edge, warm afternoon light. No text or labels. In order: Sevilla on the Guadalquivir with its
> cathedral tower and ships at the quay; Lisboa on the Tagus with the tower at Belém; London on
> the Thames with the bridge and the Tower; La Rochelle with its two harbour towers; Antwerpen on
> the Scheldt with the cathedral spire; a generic southern port city; a generic walled inland city
> on a hill; a small fishing town.

## 4. Coats of arms: `crests.png`

> A sheet of 15 heraldic shields in a strict grid of 5 columns by 3 rows with wide empty gaps, on
> a transparent background. Every shield the same shape and size (a rounded heater shield with a
> thin gold rim), painted in the attached concept's style, simplified so each reads at 40 pixels.
> No text or mottos. In order: Castile (red and gold, castle), Portugal (white with blue shields
> and a red border), England (red with gold lions), France (blue with gold fleurs-de-lis), the
> Netherlands (orange and blue with a lion); the Ottomans (green with a crescent), Morocco (red with
> a gold star knot), Venice (red with a gold winged lion), Genoa (white with a red cross), the
> Papal States (gold crossed keys on red); Naples (blue and gold), the Hanse (red and white halves
> with a ship), Denmark (red with a white cross), Scotland (blue with a white saltire), the Empire
> (gold with a black double-headed eagle).

## 5. Court portraits: `portraits.png`

> A square sprite sheet of 24 bust portraits for a historical strategy game set in 1490–1650, in a
> strict grid of 6 columns by 4 rows with wide empty gaps, on a transparent background. Style: the
> attached concept art — richly painted, warm light from the top left, like small oil portraits;
> every portrait the same framing (head and shoulders, three-quarter view, the same size), no frame,
> no text. People of a European royal court, each clearly different in age, face and dress: rows
> 1–2 men, rows 3–4 women; in each row, ages run from about 20 on the left to about 70 on the right.
> Mix the dress of Castile, Portugal, England, France and the Netherlands: a weathered sea captain,
> a navigator in a cap, an explorer in a morion helmet, a soldier in a breastplate, a merchant in a
> fur-trimmed coat, a Dominican friar, a bishop, a scholar with spectacles, a nobleman with a ruff,
> a grizzled admiral, a young courtier, a royal secretary; a noblewoman in a French hood, a
> merchant's widow, a lady-in-waiting, an abbess, a woman scholar, a Dutch burgher's wife in a white
> cap, an English lady with a ruff, a court physician, an elderly dowager, a young heiress, a
> cartographer, a diplomat.

## 6. Units and ships: `units.png`

> A sprite sheet of 10 painted figures in a strict grid of 5 columns by 2 rows with wide empty
> gaps, on a transparent background, in the attached concept's style, each standing on a small
> hexagonal base of ground or sea, same scale and lighting. No text. Row 1: a colonist with an axe
> and bundle, an infantryman with pike and morion, a musketeer, a friar with a cross, an explorer
> with a spyglass and cloak. Row 2: a merchant with a ledger, a caravel, a carrack, a galleon, a
> fluyt.

## 7. Title screen: `title.png`

> A wide painting, 16 by 9, for the title screen of a strategy game about the age of sail: a fleet
> of caravels and a galleon leaving a sunlit Iberian harbour at dawn toward an open ocean, an old
> chart and brass instruments in the foreground on a navy lacquer desk with gold inlay, in the
> attached concept's warm painted style. Leave the centre third calm and uncluttered for a title
> and buttons. No text.

---

### Where each sheet goes

| Sheet | Game slots |
|---|---|
| icons | `icon/cities` … `icon/chronicle` (dock), HUD and rail buttons, stats, building and skill marks |
| buildings | `building/docks` (I–III), `building/barracks`, `building/church`, `building/university`, `building/market` |
| cities | `city/seville`, `city/lisbon`, `city/london`, `city/larochelle`, `city/antwerp`, plus port, inland and town for the rest |
| crests | the HUD crest, city headers, the Crowns standings, the menu |
| portraits | court cards and courtier details |
| units | `unit/colonist`, `unit/infantry`, `unit/missionary`, `ship/caravel`, `ship/carrack`, `ship/galleon`, leaders |
| title | the menu background |
