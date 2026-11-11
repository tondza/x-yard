# docs/status.md — current state

Edited **in place**. This is the answer to "where are things right now?"; it is
not a history. History lives in [`PROJECT_LOG.md`](../PROJECT_LOG.md), and unlike
that file this one is expected to be rewritten as reality changes.

Last updated: 2026-11-11.

## What works today

| Thing | State | Verified by |
| --- | --- | --- |
| Monorepo + tooling (pnpm workspaces, TS strict, Vitest) | ✅ done | `pnpm install` / `pnpm typecheck` |
| `game-core`: domain vocabulary, graph + validator, ticket economy, xorshift128+ RNG | ✅ done | 7 test files, 136 tests |
| `game-core`: street geometry on edges (`path`, `edgePath`) and the R5 street-coverage check (`validateStreetGeometry`) | ✅ done | `graph.test.ts` |
| `game-core`: zero runtime dependencies | ✅ enforced | `dependencies: {}` and `architecture.test.ts` |
| `game-core`: **local prototype loop** — 1 Fugitive vs N Agents, five movement options (taxi, bus, underground, special, foot), turn/appearance/capture/result, deterministic bots, explicit human-Agent orders, each Agent move returned in resolution order | ✅ first playable | 18 prototype tests |
| `map-generator`: seeded 24 / 60 / 96-station transit networks, class mix, facilities, close or farthest starts, street-following paths, committed fixtures | ✅ first version | 16 generator tests; `maps/*.json` |
| `apps/web`: **96-station prototype** — side chooser (Fugitive or Agent Practice), **isometric Vintage Etching** default with Canvas city (spatial culling + zoom LOD; Basic fallback; Iron/Night RTS skins), projected and viewport-culled overlay/camera, paper HUD, network badges, station inspector, sequential reveal, ghost, play/map camera; Agent Practice hides the true Fugitive | ✅ second playable | 1440 and 390 role/Agent checks; full suite |
| `apps/web`: **dev map lab** — seed/regenerate, schematic map, inspector, validation, JSON export | ✅ internal tool | `?lab` in dev, screenshots + interaction run |
| `apps/server`: boots, serves `/health` and `/board` | ✅ done | manual `curl`; no integration suite yet |
| `apps/web`: scaffold board on Canvas 2D | 🟡 scaffold only | `?board`, `pnpm build` |
| Governance: entry point, enforceable invariants, doc checks | ✅ done | `pnpm check:docs` |

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
stops with `B` / `M` / `S` badges, and opens a station card on hover (for a legal
destination) or click (any station) listing each mode's destinations and who is
standing there. There is deliberately **no Plan mode, reachability overlay or
route calculator**: the director ruled that planning stays in the player's head
([decision 0017](decisions/0017-always-visible-network-and-last-appearance.md)).
The Agents' last-known node is shown as a semi-transparent `F<node>` ghost with a
dashed ring; it persists until the next appearance and is hidden while the real
Fugitive stands there.

**City skins.** The **isometric Vintage Etching** skin is the default: sepia/ink
city, paper HUD, and the transit network as the only saturated colour. The true
2:1 projection is shared by the city, camera, station labels, routes, tokens and
ghost, so the overlay stays aligned. `Basic`, `Iron` and `Night` remain selectable
developer skins ([decision 0018](decisions/0018-developer-switchable-city-skins.md)).
The 1907 rules remove the motor-scooter; special stays
([decision 0019](decisions/0019-1907-era-rules.md)). The RTS skins are vector
approximations, not pre-rendered sprite assets.

**Scale/performance.** The Vintage city plate is now Canvas 2D with a spatial
grid and zoom LOD, and the SVG overlay is viewport-culled. On the 96-station map
the Canvas city drag measured ~16–17 ms/frame at 1440×900 and ~16.2 ms at
390×844 DPR 2, versus ~50 ms for the old SVG city. Basic/RTS still use SVG and
remain detail comparisons, not the scalable path. The whole-city overlay and
10×/50× fixture are the next scale work ([decision
0020](decisions/0020-canvas-city-renderer-for-scale.md)).

**Agent Practice.** The start screen asks **Fugitive** or **Agent Practice**.
Agent Practice puts the human on Falcon (`agent-1`), with a hidden bot Fugitive and
three bot Agents. The Fugitive moves first in secret; only the ticket mode, the
public log and appearances (5/10/15) are visible. The Agent phase pauses for the
human Agent's move and then resolves the remaining bots. The true Fugitive token
is not rendered ([decision
0022](decisions/0022-agent-practice-local-mode.md)). The Fugitive run is unchanged.

The loop lives in `game-core/src/prototype/` as `PrototypeState`. It is **not**
the full `GameState`: no server projection, no 4-Fugitive model, no missions or
gadgets. The architecture guard for the real state machine is unchanged.

## What is next (in order)

1. **Agent Practice feedback** — play Falcon, then tune the hidden bot Fugitive,
   Agent information density and the Agent phase before changing numbers.
2. **City visuals upgrade (round 07)** — the director wants the game to look
   appealing: varied houses with **pitched roofs as the norm**, distinct landmarks
   (sports ground, town hall, church, gardens, …), and a richer Vintage Etching
   treatment. Work is sequenced by bang-for-buck in
   [`docs/briefs/round-07-city-visuals.md`](briefs/round-07-city-visuals.md): pure-renderer
   quick wins (roof shapes, wall tints, paper grain, richer landmarks) first, then the
   landmark model change + fixtures, then row terraces, furniture and river/bridges.
   Recorded as [decision 0021](decisions/0021-building-and-landmark-variety.md).
4. **Playtest the 96 prototype** — the first feedback (sudden/simultaneous
   movement, no viewport), the second (network, ghost, “pulse”), and the third
   (isometric Vintage + 1907 rules) are addressed; tune Agent starts/bot pathing
   before changing any ruled number, then continue the Canvas scale work
   (whole-city overlay, 10×/50× fixtures) before more city polish.
5. **Scale rehearsal at 300 nodes** — derive the grid from `targetNodes`,
   replace the all-pairs taxi routing with a k-nearest candidate graph, and carry
   the prototype's camera/LOD contract into a faster renderer. This proves the
   20-player MVP scale before committing.
6. **Four-Fugitive / sixteen-Agent starts** and the separation rule for them.
7. `hashState` / `replay` — the replay oracle for the full state.
8. `projectState` — secret projection. **Until it exists no server code may send
   state to a client.**
9. Server integration tests, then persistence, reconnect/resume, multi-Yard.

## Blocked on the director (and what is now ruled)

Items marked **RULED** are recorded for context. They no longer block anything.

- **Art style and perspective** — **RULED 2026-10-29:** the playable prototype
  uses the **isometric Vintage Etching** skin by default (early 1900s, sepia/ink
  city, paper HUD, coloured transit). `Basic` remains the fallback. The wider
  600–900-node/100-player renderer decision is still separate.
- **RULED 2026-10-16 — MVP scope.** Drafted and validated, then **re-scoped by the
  director** the same day. The ratified re-statement is [`docs/mvp/README.md`](mvp/README.md),
  whose top section lists the six rulings and what they invalidate. Three P0 changes
  are applied there: **16 turns with appearances 5/10/15**, the **scooter's exact-position
  reveal cut**, and **pass-and-play rejected** in favour of one device per seat.
  **Superseded 2026-10-29:** the scooter is removed entirely in the 1907 era rules
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
