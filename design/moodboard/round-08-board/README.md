# Round 08 — Yard Board (proposed)

**Status: applied 2026-11-12 as the default `board` skin.** This round answers a
director question — what would the prototype look like if its city were drawn with
the visual grammar of the original *Scotland Yard* board? It keeps the Cathedral
Quarter map, graph, station positions, routes and landmark data, and re-draws only
how they are presented. The study below is kept as the design record; the live
implementation is recorded in
[decision 0024](../../../docs/decisions/0024-yard-board-skin.md).

Renders are local work artifacts and are not committed; see
[`design/moodboard/README.md`](../README.md) and [Re-render](#re-render). The
study's renders are `proposed-1440.png`, `proposed-detail.png` and
`compare.png` (the live Vintage plate beside the proposal). The **applied**
result is `live-board-1440.png`, `live-board-390.png`,
`live-board-map-1440.png` and `compare-live.png`.

---

## What the study changes

| Layer | Current Vintage Etching | Yard Board study |
| --- | --- | --- |
| **Houses** | Tall two-face prisms, hatched shadow faces, dormers, five roof shapes, one wide house per cell | Short, roof-first houses; each wide footprint split into a 2–3 house terrace with a different wall tint and roof colour per unit; one ink contour, two window marks, no hatching, no cast shadow |
| **Ground** | Tan block fill and asphalt streets with a dashed lane line | Paper ground; streets are a paper carriageway between two ink edges; block fill is the same paper, so open land reads as unbuilt, not as a field |
| **Nodes** | Three class-coloured rings, external `n11` label, `B`/`M`/`S` letter badges | One uniform paper disc, station number inside, external labels removed; non-taxi modes become a keylined colour arc on the rim ("mode collar") in a fixed slot. Taxi is universal, so 67 of 96 discs stay plain |
| **Routes** | Thin lines with a cream casing | Thicker ribbons with an ink keyline, no cream halo; taxi gold, bus green, metro red, special violet/dashed |
| **Landmarks** | 13 kinds drawn at house scale, no names in the Vintage skin | Landmarks stay map data; they are drawn as distinct compounds with a printed plaque (`CENTRAL STATION`, `CITY MUSEUM`, `OLD SQUARE`, …) using the real `LandmarkModel.label` |
| **Composition** | A diamond of city on a cream sheet at map zoom; a close play camera | Plate fills the window; a printed cartouche, a route key and a 1.9× play camera |

## What the implementation changed from the study

Two defects in the study were not carried over:

1. **Street "pipes".** The study drew each street as an ink stroke followed by a
   narrower paper stroke. At a junction, a later street's ink ran down the middle
   of an earlier street's paper. `CanvasCity` now draws **every ink edge first,
   then every carriageway**, so the junction is a clean merge.
2. **Floating roof triangles.** The study's simplified gable end could leave two
   triangles between rows. The live renderer uses the existing prism and roof
   faces, which enclose every face and cannot float.

The live version also differs in three deliberate ways: the overlay's legal
destination is a hollow ring rather than a filled pad (so it never covers the
station disc or its mode collar), landmark labels are clamped to the viewport and
reduced to the four anchors at whole-city zoom, and the house split now lives in
`city.ts` for every skin instead of being a draw-time trick.

## Follow-up presentation pack (2026-11-12)

After the first live review, four presentation improvements were applied and one
was rejected:

1. **Paper HUD.** The Board skin now turns the header, kit, log, map toolbar,
   legend and role chooser into paper-and-ink surfaces while keeping the modern
   layout and sizes. Scoped with `.proto.skin-board`; Vintage and Basic are
   untouched.
2. **Print pass.** Pale-yellow station discs, serif lettering on the station
   numerals and landmark plaques, and a printed cartouche with a compass and
   scale bar in the whole-city view. The cartouche is map-view only so it never
   covers the play view.
3. **Named streets.** Six roads carry generated names derived from the nearest
   landmark (`Cathedral Road`, `Station Road`, `Museum Lane`, …). They are
   presentation labels, not map data, and are hidden below play zoom.
4. **Camera fill.** On stages at least 720×480 the play camera is clamped to the
   projected city parallelogram, with a focus-safe fallback so the Fugitive and
   legal destinations stay on screen. Phones keep the follow framing because the
   motion banner covers the top of a 390×844 frame.
5. **Rejected — landmark lift.** Scaling the four anchors by 1.35× was tried and
   reverted: the director ruled that making landmarks taller to read is not
   scalable, because they cover streets and buildings. Landmark presence must
   come from the plaque and, later, a compound footprint.
6. **Building correctness.** Gable roofs now fill their near gable-end triangle
   in wall colour (they previously showed an empty triangle through to the
   paper); the cathedral tower moved from the nave centre to the east end so it
   no longer covers the rose window; the town-hall tower and museum dome are
   drawn before their porticos; street trees were removed because a random point
   inside a built block could be a roof. Close-ups:
   `live-board-roofs-close.png` and `live-board-landmarks-close.png`.

The follow-up screenshots are `live-board-1440.png`, `live-board-390.png`,
`live-board-map-1440.png`, `live-board-role-1440.png` and
`live-board-station-1440.png`.

## What is real and what is stand-in

- **Real:** the `maps/prototype-96-seed-42.json` map, every station position, every
  edge path and ticket mode, the ten landmarks and their labels, and the house
  footprints generated by the real `apps/web/src/prototype/city.ts` (bundled into
  `city-bundle.js`).
- **Stand-in (study only):** in the study, each generated wide footprint is split
  into 2–3 terrace units at draw time. The **live implementation** moved that
  split into `city.ts` (`splitTerrace`), so the generator itself emits 418 houses
  instead of 225. Neither changes the map, the block plan or the streets. The
  landmark illustrations are simplified drawings at the real coordinates.
- **Deliberately absent:** the river and bridges (a real generator change, already
  open item 8), final landmark-compound art, ambient furniture, and a mobile
  layout. The river is the single largest remaining gap to the board reference.

## Files

Sources are committed; renders are local work artifacts listed here for reference.

| File | Role |
| --- | --- |
| `mockup.html` / `mockup.js` | The study's page, layout and renderer (plain SVG) |
| `city-bundle.js` | Generated: `apps/web/src/prototype/city.ts` bundled with esbuild |
| `mock-data.js` | Generated: the committed 96-station map as `window.__MAP__` |
| `compare.html` / `compare.png` | Now-versus-proposed contact sheet (local artifact, not committed) |
| `compare-live.html` / `compare-live.png` | Vintage-versus-Board comparison of the live app (local artifact) |
| `proposed-1440.png` | Full 1440 × 900 screen at 2× device pixel ratio |
| `proposed-detail.png` | 1:1 crop for judging houses, nodes, routes and a plaque |
| `live-board-1440.png`, `live-board-map-1440.png`, `live-board-390.png`, `live-board-map-390.png` | The applied skin at play and whole-city zoom, desktop and phone |
| `live-vintage-1440.png`, `live-basic-1440.png` | The retained skins after the overlay change |
| `live-board-role-1440.png`, `live-board-station-1440.png` | The paper role chooser and the paper HUD during a resolved move |
| `live-board-roofs-close.png`, `live-board-landmarks-close.png` | Building correctness: closed gable ends, parks-only trees, cathedral tower at the nave end |

## Re-render

```bash
# 1. regenerate the two data inputs (only needed if the map or city generator changes)
/workspaces/x-yard/node_modules/.pnpm/@esbuild+linux-x64@0.28.2/node_modules/@esbuild/linux-x64/bin/esbuild \
  --bundle --format=iife --global-name=XYCITY \
  --outfile=design/moodboard/round-08-board/city-bundle.js \
  apps/web/src/prototype/city.ts

node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('maps/prototype-96-seed-42.json','utf8'));fs.writeFileSync('design/moodboard/round-08-board/mock-data.js','window.__MAP__='+JSON.stringify(m)+';')"

# 2. render
cd .tools/screenshot
PLAYWRIGHT_BROWSERS_PATH=/workspaces/x-yard/.playwright-browsers \
LD_LIBRARY_PATH=/workspaces/x-yard/.chromium-libs/usr/lib/x86_64-linux-gnu \
node round08-mockup.mjs
```

The camera and all visual constants are at the top of `mockup.js` (`VIEW`, palette,
route widths, node radii), so a re-shoot is cheap.

To re-shoot the **live** skin and the Vintage/Board comparison sheet:

```bash
cd .tools/screenshot
PLAYWRIGHT_BROWSERS_PATH=/workspaces/x-yard/.playwright-browsers \
LD_LIBRARY_PATH=/workspaces/x-yard/.chromium-libs/usr/lib/x86_64-linux-gnu \
node round08-live.mjs
```

It needs `pnpm --filter @x-yard/web dev` on `http://127.0.0.1:5173` and writes the
`live-*.png` files and `compare-live.png` in this folder.

## Resolved by the implementation

1. **New skin or retune Vintage?** A new `board` skin, now the default; Vintage
   stays selectable (decision 0024).
2. **Node-class colour.** Retired. The ring is uniform ink; the rim arc carries
   the real service colour. Class stays in the station card and `<title>`.
3. **House density.** The 2–3 house terrace split moved into `city.ts`, so the
   generated city emits 418 houses instead of 225 for the 96-station fixture.

## Still open

1. **Landmark compound footprints.** The board's landmarks are compounds
   (courtyards, walls, towers). The implementation keeps the current 13 kinds and
   adds plaques; making four of them four- to six-house compounds is a separate
   art task. Scaling them up was rejected (see the follow-up pack) because tall
   landmarks cover streets and buildings.
2. **The map-view margin.** The desktop play view now fills its frame; the
   whole-city view still prints the plate on paper with a cartouche. That is a
   deliberate board presentation, not a cropped city.
3. **River and bridges.** The largest remaining difference from the reference and
   already open item 8 in the round-07 brief.
