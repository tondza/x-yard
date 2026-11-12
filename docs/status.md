# docs/status.md — current state

Edited **in place**. This is the answer to "where are things right now?"; it is
not a history. History lives in [`PROJECT_LOG.md`](../PROJECT_LOG.md), and unlike
that file this one is expected to be rewritten as reality changes.

Last updated: 2026-11-12.

## What works today

| Thing | State | Verified by |
| --- | --- | --- |
| Monorepo + tooling (pnpm workspaces, TS strict, Vitest) | ✅ done | `pnpm install` / `pnpm typecheck` |
| `game-core`: domain vocabulary, graph + validator, ticket economy, xorshift128+ RNG | ✅ done | 7 test files, 149 tests |
| `game-core`: street geometry on edges (`path`, `edgePath`) and the R5 street-coverage check (`validateStreetGeometry`) | ✅ done | `graph.test.ts` |
| `game-core`: zero runtime dependencies | ✅ enforced | `dependencies: {}` and `architecture.test.ts` |
| `game-core`: **local prototype loop** — 1 Fugitive vs N Agents, five movement options (taxi, bus, underground, special, foot), turn/appearance/capture/result, deterministic bots, explicit human-Agent orders, each Agent move returned in resolution order | ✅ first playable | 29 prototype tests |
| `map-generator`: seeded 24 / 60 / 96 / 576-station transit networks, class mix, facilities, close or farthest starts, street-following paths, sparse/standard/dense local route budgets, committed fixtures; large maps use a prefiltered A* / multi-source Prim path | ✅ first version | 18 generator tests; `maps/*.json` |
| `apps/web`: **interactive demo** over a 96-station prototype, plus a dev-only **576-station 6x rehearsal** (`?map=576`) — setup screen (existing fixture or generated map, size/route density/Agents/seed, total turns, ticket budgets, Fugitive or Agent side), **Yard Board** default with tiled Canvas city (paper plate, roof-first terraces, numbered discs with mode collars, keylined routes, landmark plaques; tile cache + whole-city overview), **Vintage Etching** and **Basic** selectable (Iron/Night RTS skins), projected stable-DOM overlay/camera, paper HUD, clickable public log/Agent focus, station inspector, sequential reveal, ghost, play/map camera; Agent Practice hides the true Fugitive and reveals its start | ✅ third playable | 1440 and 390 setup/game checks; 576 play/map runs; full suite |
| `apps/web`: **dev map lab** — seed/regenerate, schematic map, inspector, validation, JSON export | ✅ internal tool | `?lab` in dev, screenshots + interaction run |
| `apps/server`: boots, serves `/health` and `/board` | ✅ done | manual `curl`; no integration suite yet |
| `apps/web`: scaffold board on Canvas 2D | 🟡 scaffold only | `?board`, `pnpm build` |
| Governance: entry point, enforceable invariants, doc checks | ✅ done | `pnpm check:docs` |
| **Collaboration-ready** — `CONTRIBUTING.md` + `docs/setup.md`, CI gate + batch scope guard, pinned toolchain (`.devcontainer`/`packageManager`), proprietary `LICENSE`, screenshots purged from history | ✅ done | CI run #1 green; `git ls-remote` matches local |

The collaboration model is in [`docs/collaboration.md`](collaboration.md)
(asymmetric: contributor branches + PRs, maintainer owns `main`); candidate work
lives in [`docs/briefs/backlog.md`](briefs/backlog.md).

## Map generator — current shape

The generator produces the model; renderers are views. The first version is
deliberately schematic: a thinned, jittered street lattice with 24/60/96 stations,
a taxi spanning subgraph, boulevard bus corridors, a connected two-line metro
network with a shared interchange, one special shortcut, one Black Market and one
Safe House, and 1+4 starts at ≥ 3 edges. It emits `GraphEdge.path` polylines and passes `validateGraph` with no
errors and `validateStreetGeometry` clean. Every map carries the same **provisional
warning**: mean degree is below the `[4.5, 6.5]` heuristic, because a readable
transit map at this scale is sparser than that heuristic assumed. It is reported,
not hidden, and not promoted to an error.

**Landmarks are map data.** Every map keeps the four anchors — station, cathedral,
market, square — and adds a seeded civic subset from `sportsGround`, `townHall`,
`church`, `gardens`, `hospital`, `museum`, `university`, `theatre` and `gasworks`.
The count is a pair of `PROVISIONAL_` constants (six at most, one per five blocks);
the 96-station fixture carries ten landmarks total. Regenerating the committed
fixtures changed only `city.landmarks`: the graph, starts, facilities and stats
were byte-identical, so station positions and the board did not move.

Committed fixtures: [`maps/`](../maps/). The lab is dev-only; `?board` still opens
the old server-backed board.

## Prototype — current shape

The playable prototype is a **96-station Cathedral Quarter**, one human Fugitive
against four deterministic Agent bots, 16 turns, appearances on 5/10/15, five
movement options (no motor-scooter), capture and a result screen. The scale and desktop-first choice
are [decision 0014](decisions/0014-96-station-desktop-prototype.md). The 96 fixture uses
`startStrategy: 'encircle'`, so the Agents start 3–5 edges away and spread by
angle rather than ten edges away. The city is drawn from the generated model:
buildings, roofs, walls, shadows, streets, parks and landmarks; stations, routes
and tokens are a live overlay.

**City visuals (round 07).** The Vintage plate varies house type, footprint, roof
shape and material by `hash(blockId + row + col) ^ map.seed`: pitched gables are
the norm, with hipped, flat/parapet and sawtooth roofs as the minority; dormers
and chimney stacks sit on the pitched types. Row terraces keep shared rooflines
but have visible alleys, and footprints mix a wide house, a pair, or three
narrow/deep houses instead of every cell being wide and shallow. Walls and roofs
pick seeded material palettes; paper grain, denser hatch on shadow faces, hatched
cast shadows and a faint curb keep the plate reading as paper and ink rather than
flat sepia. Thirteen landmark kinds are drawn distinctly, and sparse period
furniture (lamps, cabs, railings, bollards) is filtered away from every station.
The river/bridges item and pre-rendered sprites remain open.

**Yard Board skin (round 08, default).** The director compared the Vintage plate
with the original *Scotland Yard* board and approved a board-grammar re-draw
([decision 0024](decisions/0024-yard-board-skin.md)). A new `BOARD` theme renders
through the same `CanvasCity`: paper streets between two ink edges (every ink
edge is drawn first, then every carriageway, so junctions do not show "pipe"
lines), short roof-first houses with no hatching or cast shadows, and no lane
markings or period furniture. `city.ts` splits wide footprints into 2-3 house
terraces (225 -> 418 houses for the 96-station fixture) with a varied wall and
roof per unit. The live overlay is now shared by every skin: one numbered disc
with the station number inside, a keylined colour arc on the rim for
bus/metro/special (fixed slot, so colour is not the only channel), thick keylined
route ribbons, and landmark plaques from the real `LandmarkModel.label` (hidden
below whole-city zoom except for the four anchors). `Vintage` keeps its etched
plate and `Basic` remains the fallback; their own landmark label drawing was
removed so the overlay is the only source of names.

**Board presentation pass (2026-11-12).** The board skin now has a **paper HUD**
(header, kit, log, map toolbar, legend and role chooser), **pale-yellow station
discs** with lettered numerals, serif landmark plaques, and **six generated
street names** (`Cathedral Road`, `Station Road`, `Museum Lane`, …) drawn along
the roads at play zoom. The names come from the nearest landmark at render time;
they are presentation labels, not map data, and are hidden below play zoom. The
map view carries a printed cartouche, compass and scale bar. On stages at least
720×480 the play camera is clamped to the projected city parallelogram (with a
focus-safe fallback), so the view fills the frame instead of showing the empty
plate corner; phones keep the follow framing, where clamping could push the
Fugitive under the motion banner. **Landmark scale-up was explicitly rejected by
the director:** taller landmarks cover streets and buildings and do not scale, so
landmarks stay house-scale with plaques until a compound footprint is designed.
Gable roofs close their near gable end in wall colour (they previously read as an
empty triangle), the cathedral tower sits at the east end of the nave instead of
covering the rose window, the town-hall tower and museum dome are drawn before
their porticos, and trees are **parks-only** because a street tree placed at a
random block point could land on a roof. Permanent routes are painted into the
plate: strong on streets and under houses. The building layer is cut along the
route path, so only a narrow band of the route shows through a house at ~40%
strength; houses and streets stay opaque everywhere else. Legal moves are a soft
glow plus a thin centreline, not a second ribbon, and the legend swatches show the
bus/special/foot dashes.
Board streets use a neutral warm grey-brown edge/pavement/carriageway palette and
a separate route keyline, so the street network no longer reads as black borders
([decision 0029](decisions/0029-neutral-board-street-palette.md)). House and
landmark linework uses a softened `outline` / `outlineScale` on Board and Vintage;
cast shadows, labels and route keylines keep their own tones ([decision
0031](decisions/0031-softer-house-outline-ink.md)).

**Delivery jobs (prototype).** The Fugitive can take **Smuggling jobs** at
landmark-adjacent stations and deliver them anywhere. One offer appears at the
start of turns 1, 6, 11, … and an unclaimed offer expires after five turns; only
one job can be active, it never expires, and it cannot be abandoned. **Collect**
and **Deliver** are explicit actions that consume the Fugitive's turn. The pickup
is public — a log row and a marker — while the destination and delivery stay
private. A delivery pays £10 into a per-Yard cash total; cash spending and the
Run rule are deliberately deferred. The bot Fugitive also takes jobs. The
Fugitive-only Smuggling jobs panel shows the active job and offers, clicking a
job reveals the destination marker, and the map carries shipment badges at
pickups. The £10, five-turn cadence and five-turn offer lifetime are
`PROVISIONAL_` ([decision 0032](decisions/0032-delivery-jobs-prototype.md)).

**Turn reveal.** The engine still resolves a turn atomically; the client now
plays the resolution back one mover at a time, each with a 0.17 s camera
lead-in — the Fugitive's route (~0.85 s), then any appearance (1.15 s hold), then each Agent in engine order (0.9 s route + a 0.2 s beat). Every mover follows its real polyline and leaves a
thin trace for the turn. The whole reveal is skippable, and the result overlay
waits for it. `resolveAgentPhase` returns the exact `agentMoves` so the view never
re-simulates a bot or guesses an edge. Recorded as [decision
0015](decisions/0015-sequential-reveal-and-play-map-camera.md).

**Viewport.** A play camera follows the Fugitive and frames the active mover's
route; **Map** is a free pan/zoom view, expandable to fill the screen. Station
labels and tokens are drawn at a constant screen size, while the city plate
zooms; street numbers drop out at low zoom and facility/terminal labels stay.
The layout is responsive (ResizeObserver plus CSS breakpoints) and has been
checked at 390×844, 768×1024, 844×390, 1024×768, 1280×720, 1440×900 and
1920×1080. On a portrait phone the map view uses a cover crop centred on the
Fugitive rather than shrinking the whole 4:3 city into 390 px; panning and
zooming reach the rest.

**Network legibility.** The permanent transit map now draws every taxi, bus,
metro and special link (legal moves are brighter on top), marks bus/metro/special
stops with a keylined colour arc on the station rim, and opens a station card on
hover (for a legal destination) or click (any station) listing each mode's
destinations and who is standing there. There is deliberately **no Plan mode, reachability overlay or
route calculator**: the director ruled that planning stays in the player's head
([decision 0017](decisions/0017-always-visible-network-and-last-appearance.md)).
The Agents' last-known node is shown as a semi-transparent `F<node>` ghost with a
dashed ring; it persists until the next appearance and is hidden while the real
Fugitive stands there.

**City skins.** The **Yard Board** skin is the default: paper plate, roof-first
terraces, numbered discs with mode collars and keylined routes. **Vintage
Etching** remains selectable: the sepia/ink city with hatching and tall massing.
`Basic` is the fallback, and `Iron`/`Night` remain developer skins
([decision 0018](decisions/0018-developer-switchable-city-skins.md)). Board and
Vintage share the true 2:1 projection, which is also used by the camera, stations,
routes, tokens and ghost, so the overlay stays aligned ([decision
0024](decisions/0024-yard-board-skin.md)). The 1925 presentation era
([decision 0023](decisions/0023-era-1925.md)) keeps the motor-scooter removed and
special in place; the mode names are unchanged ([decision
0019](decisions/0019-1907-era-rules.md)). The RTS skins are vector approximations,
not pre-rendered sprite assets.

**Scale/performance.** Both Canvas plates (Board and Vintage) are now a **tiled**
static cache (256 CSS-pixel tiles, one-tile idle prefetch), with spatial grids for
blocks, streets, buildings and trees. A low-resolution **whole-city overview**
bitmap is the free map view at fit zoom and sits under the play view, so a
zoom-out never shows blank paper. Tiles keep their painted scale through a zoom
and sharpen in one deferred rebuild after the camera settles. The canvas draws in
`useLayoutEffect`, which removes the one-frame lag that made routes and houses
drift during a camera move. The overlay's station layer
renders the whole graph once and is memoised; its sizing uses a settled scale, so
a zoom does not rebuild every disc. Board and Vintage paint the permanent network
in the plate, which halves the overlay DOM ([decision
0025](decisions/0025-tiled-plate-and-stable-overlay.md)). Routes sit under the
houses; the building layer is cut along the route path so only the route band
shows through at ~40%, while houses and streets stay opaque. Legal moves are a
glow plus a thin centreline. The legend swatches show the
bus/special/foot dash grammar ([decision
0028](decisions/0028-routes-under-houses-and-legal-glow.md)).

At 1440×900 DPR 1, a Board play-view drag measures ~16.6 ms/frame (p95 23.1, max
30.2) at 96 stations and ~16.7 ms (p95 22.8, max 26.1) at 576; steady panning is
16.4/17.0 ms and the free map view is 16.6/17.1 ms because it is one overview draw.
A wheel zoom is the remaining cost: ~20 ms/frame average (p95 47) at 576 while the
gesture runs, returning to 60 fps within 180 ms of it settling. The 390×844 DPR 2
numbers and the Vintage 6x drag were not re-taken. Basic/RTS still use SVG and
remain detail comparisons, not the scalable path.

The generator now proves the 6x scale: `maps/prototype-576-seed-42.json` is a
committed 576-station map at the same density as the quarter (2940×2205 world),
dev-loaded with `?map=576` ([decision
0026](decisions/0026-six-times-scale-fixture.md)). It regenerates in ~0.5 s; maps
above 100 stations use a spatial candidate prefilter, A*, a multi-source Prim
tree and an indexed street-coverage check, while 100 stations or fewer keep the
original path so the 24/60/96 fixture graphs stay identical. A 10×/50× fixture and
a faster overlay for much larger graphs are the next scale work ([decision
0020](decisions/0020-canvas-city-renderer-for-scale.md)).

**Agent Practice.** The start screen asks **Fugitive** or **Agent Practice**.
Agent Practice puts the human on Falcon (`agent-1`), with a hidden bot Fugitive and
three bot Agents. The Fugitive moves first in secret; only the ticket mode, the
public log and appearances (5/10/15) are visible. The Agent phase pauses for the
human Agent's move and then resolves the remaining bots. The true Fugitive token
is not rendered. The starting station is public in Agent Practice and appears as
`Vulture start` with a ghost; the public-log rows and Agent rows are clickable and
centre the station card. Move rows name the transport mode only; destinations stay
hidden. Taxi links are stronger and parallel modes are offset into adjacent lanes
so a bus and taxi on the same street are both readable ([decision
0022](decisions/0022-agent-practice-local-mode.md)). The Fugitive run is unchanged.

**Interactive demo.** The prototype route now opens on a **setup screen**. It
offers a committed fixture (24, 60, 96 or the 576-station rehearsal) or a freshly
generated map with station count, local route density (sparse/standard/dense),
Agent count, start policy and seed; a total-turn setting (4–32; appearances are
scaled to the same relative points as 5/10/15); per-role ticket budgets for taxi,
bus, metro, special and foot; and the Fugitive or Agent side. Skins stay
available on the setup screen and in the game header. The engine accepts a
`PrototypeSetup` override and records `turnLimit`/`appearanceTurns` in state; the
generator records `params.routeDensity`. Defaults still come from the ratified
16 turns and the existing ticket constants, so playing without touching the
setup is the same table as before ([decision
0027](decisions/0027-interactive-demo-setup.md)). The demo is dev-only and the
production build drops it.

The loop lives in `game-core/src/prototype/` as `PrototypeState`. It is **not**
the full `GameState`: no server projection, no 4-Fugitive model, no missions or
gadgets. The architecture guard for the real state machine is unchanged.

## What is next (in order)

The interactive demo is ready for feedback: try a generated short Yard, a sparse
or dense route budget, and both sides before tuning any numbers.

1. **Agent Practice feedback** — play Falcon, then tune the hidden bot Fugitive,
   Agent information density and the Agent phase before changing numbers.
2. **Yard Board follow-ups.** The default skin and its paper HUD/print pass are
   in ([decision 0024](decisions/0024-yard-board-skin.md)). Next: **landmark
   compound footprints** (not scale — scaling was rejected), a denser block plan,
   and **river + bridges** (round-07 item 8, new generator geometry and fixture
   regeneration), the largest remaining gap to the reference board. The
   pre-rendered sprite/texture phase stays director-gated. See
   [`docs/briefs/round-07-city-visuals.md`](briefs/round-07-city-visuals.md) and
   [decision 0021](decisions/0021-building-and-landmark-variety.md).
3. **Playtest the 96 prototype** — the first feedback (sudden/simultaneous
   movement, no viewport), the second (network, ghost, “pulse”), the third
   (isometric Vintage + era rules), the round-07 visual review and the round-08
   board review are addressed; tune Agent starts/bot pathing before changing any
   ruled number.
4. **Scale past 6x** — the 576-station map is committed and panning holds 60 fps.
   The next step is a 10×/50× fixture and a faster permanent overlay: the stable
   SVG graph is ~6.6k elements at 576, so routes and station discs need to move to
   Canvas or a windowed layer before 10×. The generator already derives its grid
   from `targetNodes` and keeps density by scaling the world; zoom smoothness
   (currently ~31 ms/frame at 576) is the other target.
5. **Four-Fugitive / sixteen-Agent starts** and the separation rule for them.
6. `hashState` / `replay` — the replay oracle for the full state.
7. `projectState` — secret projection. **Until it exists no server code may send
   state to a client.**
8. Server integration tests, then persistence, reconnect/resume, multi-Yard.

## Blocked on the director (and what is now ruled)

Items marked **RULED** are recorded for context. They no longer block anything.

- **Art style and perspective** — **RULED 2026-10-29:** the playable prototype
  uses an isometric 1925 paper/ink city. **Updated 2026-11-12:** the default skin
  is now **Yard Board** ([decision
  0024](decisions/0024-yard-board-skin.md)); Vintage Etching remains selectable
  and `Basic` remains the fallback. The wider 600–900-node/100-player renderer
  decision is still separate.
- **RULED 2026-10-16 — MVP scope.** Drafted and validated, then **re-scoped by the
  director** the same day. The ratified re-statement is [`docs/mvp/README.md`](mvp/README.md),
  whose top section lists the six rulings and what they invalidate. Three P0 changes
  are applied there: **16 turns with appearances 5/10/15**, the **scooter's exact-position
  reveal cut**, and **pass-and-play rejected** in favour of one device per seat.
  **Superseded 2026-10-29:** the scooter is removed entirely in the 1925 era rules
  ([decision 0019](decisions/0019-1907-era-rules.md)).
- **RULED 2026-10-16 — phase order: prototype before MVP.** The director added a
  **prototype phase** (5 seats: 1 human + 4 bots, single-player, simple bots) whose
  purpose is to give a feeling of success and validate the look. The **MVP is
  multiplayer at up to 20 players with 4 Fugitives**, bots filling empty seats and
  humans able to take over a bot's seat mid-Yard. Recorded as [decision
  0011](decisions/0011-prototype-before-multiplayer-mvp.md); the plan is
  [`docs/project-plan.md`](project-plan.md).
- **RULED 2026-10-16 — turn model: timed concurrent windows.** Each faction acts in a
  **30-second window with all members moving at once**; a move is visible to the rest
  of the faction as soon as it is made. Agents first, then Fugitives, and Fugitives see
  each other. This **replaces sequential play** — M1's `detectiveOrder` and the
  ratified `fugitive-phase → reveal-pulse → agent-phase` order both need rewriting, and
  every mobile screen now needs a countdown and a "waiting for others" state. Recorded
  as [decision 0012](decisions/0012-timed-concurrent-turn-windows.md).
- **Open sub-questions from the turn-model ruling:** confirm Agents-then-Fugitives;
  timeout behaviour (`hold` vs a pure `chooseAutoMove`); early window close (required —
  16 turns × two 30 s windows is up to 16 minutes against a 5–10 minute target); where
  the Appearance now sits; and concurrent collisions (two Agents to one node, an
  Agent and a Fugitive crossing in one window).
- **Invalidated by the re-scope.** `round-03-rules.md`, `round-03-product.md` and
  `round-03-validation.md` were all written for **1 Fugitive vs 2 Agents** and must be
  rewritten for the 20-player, 4-Fugitive model. With four Fugitives, `projectState`
  must project per viewer **and per Fugitive**.
- **The core loop — the real blocker.** The validator's verdict is *"worth building
  only if three things change"*: as specified the game reduces to
  *"don't be adjacent at the appearance, be adjacent at the appearance"* — the Appearance is
  the only real decision and the rest is bookkeeping around 3–5 one-turn windows.
  The three P0s are necessary but may not be sufficient. Options are in
  [`docs/mvp/README.md`](mvp/README.md) §5: ship the thin loop to validate the
  pipeline, restore tension by scale (1v3 and/or a larger map), or add a second
  Agent lever between appearances. **This is a design call for the director.**
- **Map representation — researched, recommendation recorded.** Node-and-edge stays
  authoritative. A block/square field was **rejected**: it does not make capture more
  unambiguous (capture is already one exact discrete comparison) and it would
  collapse the four transport tiers into "how far". The real fix for the
  diagonal-drawing complaint is **authored per-edge street geometry**. See
  `docs/research/round-03-map-system.md` and [`docs/mvp/README.md`](mvp/README.md) §4.
- **Mobile-first MVP mockups — complete, not integrated.** Eight round-03 screens
  (phone portrait plus one desktop enhancement) are rebuilt and verified under
  `design/moodboard/round-03-mobile/`. They remain static; the F-versus-H choice is
  still open, and the playable prototype will read the generated map, not a mockup
  plate.
- **Open questions Q1–Q12** in
  [`GAME_VISION.appendix.md`](../GAME_VISION.appendix.md) appendix C. Each has a
  recommended default already encoded as a `PROVISIONAL_` constant, so nothing is
  blocked in practice.

## Known deviations from the brief

Tracked here so a session does not rediscover them (full detail in the log):

- `game-core` module layout is flat; the brief cites nested paths. The new
  `map-generator` is nested. Revisit `game-core` when the turn machine lands.
- `demo-board.ts` is a fixture, **not** the shipped map. Generated fixtures live
  in [`maps/`](../maps/).
- Node classes (`street`/`hub`/`terminal`) are a provisional taxonomy (Q7).
- The generator's street skeleton is a thinned, jittered lattice. It is a
  schematic scaffold, not the final road graph; an irregular road graph, river and
  bridges are the next generator step.
- Every generated map emits the **provisional** mean-degree warning. The warning
  is reported in the lab and not promoted to an error.
- `GraphEdge.path` is optional so hand-made fixtures still load; `edgePath` falls
  back to a chord. The generator always writes it for taxi and bus edges, and
  `validateStreetGeometry` rejects a missing taxi/bus path.
- The map lab is dev-only: it is loaded by a dynamic import and the dev default
  route. `?board` keeps the old server-backed scaffold.
- `TransportMode` has four values and does **not** include on-foot movement,
  which `VISUAL_DIRECTION.md` §1 decision 2 makes a fifth movement option. This
  affects the wire protocol and the ticket log, so it needs a deliberate decision.
- Playwright is not installed; `pnpm test:e2e` does not exist yet. The labs and
  skin screenshots were verified with an ad-hoc Playwright script outside the
  pnpm workspace.
- The RTS city skins are vector approximations. A true late-90s RTS / “Red Alert 2”
  look needs pre-rendered isometric sprites and texture atlases; the skin boundary
  can accept that renderer later. Command City is lab-only until the camera and
  overlay projection are budgeted.
- The desktop play camera is clamped to the projected plate, but phones keep the
  follow framing: the map banner covers the top of a 390×844 frame, and clamping
  there pushed the Fugitive under it. The whole-city map view still shows the
  plate as a printed sheet on paper, with the plate cartouche; that is deliberate,
  not a cropped board.
- Street names are generated client-side from the nearest landmark. They are
  presentation labels, not `CityStreet` data, and disappear below play zoom.
- Landmarks are not scaled up. The director ruled scaling them is not scalable
  (2026-11-12): tall landmarks cover streets and buildings. Presence comes from
  the plaque until a compound footprint exists.
- Node class no longer has a colour on the map. The disc rim carries transport
  availability instead; class and the full mode list remain in the station card
  and the station `<title>`.
- The free map view at fit zoom is a single whole-city overview bitmap. It is
  sharp at fit; if the map view is zoomed in far past the overview threshold, the
  bitmap is upscaled until the tiles take over.
- The stable full overlay is validated at 576 stations (6×). A 10× map would
  render tens of thousands of SVG elements; the permanent routes and discs need a
  Canvas or windowed layer before that.
- The 576-station map is a **dev-only scale rehearsal**, not the shipped board.
  The playable prototype remains the 96-station quarter; `?map=576` loads the
  1.9 MB fixture through a dynamic import that the production build drops.
- The demo's generated maps scale the world with the station count so density
  stays near the 96 quarter; they are not authored districts. `routeDensity`
  changes only the extra local taxi links, not the bus/metro/special tiers or the
  spanning tree.
- Board and Vintage paint permanent routes in the Canvas plate. Basic and the RTS
  skins still draw the network in the SVG overlay above the houses; they remain
  fallback/detail skins rather than the scalable path.
- Route visibility through a house is a narrow layer cutout, not per-pixel
  transparency. The route band shows at ~40% strength; the building and street
  remain opaque around it.
- The setup screen and the generated-map path are dev-only. The server, the real
  `GameState`, and the production bundle are unchanged; the demo is a local
  table.
