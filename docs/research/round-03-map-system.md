# Round 03 research — should the field be blocks/squares, or stay a graph?

Status: **research only**. Nothing here is implemented; no file outside this one
was changed. A change to map representation touches `game-core` and needs the
director's answer, not this document's.

---

## Summary

A block/square coordinate system does **not** solve the director's stated
problem, and it does not make occupancy or the capture test more unambiguous
than the current graph. It fixes a *rendering* symptom with a *rules-model*
change, and it costs most of the existing engine.

The director's worry splits into three questions, and only one of them is about
the map representation:

| The director's worry | Where it actually lives |
| --- | --- |
| Move lines cut diagonally across buildings | **Rendering** — how an edge is drawn, and how the art is made |
| "Is the Agent in the same square as the Fugitive?" | **Rules** — co-location, which the graph already decides exactly |
| "How many characters fit?" | **Rules, and not yet defined** — no capacity is stated anywhere |

### Single recommendation

**Keep the node-and-edge graph as the single source of truth for movement,
occupancy and capture. Do not build a parallel coordinate/block model.**

Add three things instead, in cost order:

1. **Per-edge street geometry** — a short polyline of waypoints in map-data
   space, authored by the map generator, used by the client to draw that edge as
   a street. Decision [`0010`](../decisions/0010-legal-moves-follow-streets.md)
   already rules that a legal move is an **edge sequence**, never an endpoint pair;
   but a single move is *one* edge, so the shape of that edge is still what decides
   whether the line crosses a building. Raw station coordinates are not enough —
   the generator must emit the street's shape too. This is 0010's missing half.
2. **Foot uses the same geometry**, so on-foot reads as walking along a street
   (`VISUAL_DIRECTION.md` decision 2 already makes on-foot node-to-node; foot can
   reuse the taxi street path).
3. **One explicit capture/co-location rule** and a testable engine function that
   answers §2's "Agent occupying the exact node" — see the section below.

If a visual block overlay is still wanted later, **derive** it from
`(x, y)` as presentation metadata. Never let it become movement authority.

---

## Why the block model does not deliver the director's motivation

**It does not disambiguate the capture test, because that test was never
ambiguous.** In a graph the question is `agent.node === fugitive.node` — one
exact comparison on discrete ids. A square gives `agent.square ===
fugitive.square` — also one exact comparison. What made the mockups read
ambiguously was two *continuous* screen positions compared by eye, a
drawing-legibility bug fixed by snapping tokens to stations and drawing a shared
ring — not by changing the state model.

**A grid is a strictly less expressive graph.** A lattice is a graph whose nodes
happen to share one node class, a uniform degree, and lattice coordinates.
X-Yard's nodes already carry `class` (`street` / `hub` / `terminal`) and irregular
degree, and `graph.ts` *enforces* mode-by-class (`CLASS_MODES`, and bus/metro
avoiding street nodes). A uniform lattice fights that hierarchy rather than
expressing it.

**Fitting diagonal streets inside squares still draws a diagonal.** Constraining
a street to a tile does not stop it from crossing whatever the art painted in
that tile unless the art is authored per tile. It converts a long diagonal into
several short diagonals, which is not a fix.

**"How many characters fit in a square" is not answered by a coordinate system.**
Capacity is a design rule: capacity-1 must still define what happens when a
second character arrives (block? queue? allow share?), and capacity-N still needs
a stacking limit. Blocks relocate the decision, they do not remove it. The graph
already supports either rule with one comparison.

**Scale already defuses occupancy.** `VISUAL_DIRECTION.md` §1 decision 3 sets
~600–900 stations for a ~100-player city: 6–9 players per station. Scotland
Yard itself is a 199-station **node-and-edge graph** where a station number is the
position and several characters sit on one station freely. Capacity is not a live
problem at our scale; it is a rule we have not written down.

**Street-following is guaranteed by geometry, not by the container.** The
authoritative source here is blunt that you should *"Start by pathfinding on the
game world representation you already use"* and that for street networks
*"each intersection will be a node in the graph, and each road will be an edge"*
— a road graph, not a grid ([Amit's Thoughts on Pathfinding — Map
Representations](https://theory.stanford.edu/~amitp/GameProgramming/MapRepresentations.html)).
So the diagonal problem is solved by (a) a generator that produces a road graph,
and (b) drawing edges as polylines rather than straight chords.

---

## Comparison

| | A. Node-and-edge graph + authored edge geometry **(recommended)** | B. Full block/square coordinate model (authoritative) | C. Hybrid: graph authoritative + derived block labels |
| --- | --- | --- | --- |
| **1. Deduction clarity** | Exact discrete candidate set; after a Reveal Pulse plus 2–3 logged modes the set is typically tens of nodes. Already the model Scotland Yard uses. | Exact set, but candidates are lattice cells — thousands of visually identical squares on 600–900-station scale. *Worse for a human under time pressure.* | Identical to A for reasoning; blocks add nothing but optional shading. |
| **2. Ticket economy** | Natural: **one ticket = one edge, annotated with its mode.** Already implemented (`GraphEdge.mode`, `ticketCost: 1`). | Tickets must buy a *square step*, which encodes distance, not transport tier. To keep taxi/bus/metro distinct you must bolt mode onto cell-to-cell rules — i.e. rebuild the graph inside the grid. | Natural, unchanged. |
| **3. Street-following** | Achievable: `0010`'s edge-sequence routing plus authored per-edge geometry. One optional field on one type, plus generator work. | Not guaranteed. Only guaranteed if the generator emits a street network *and* the art matches the lattice; a lattice generator yields grid streets. | Same as A; the client may draw a block grid but paths need not follow it. |
| **4. Procedural generation** | A road-graph generator (planar, irregular, hierarchical, seeded) — the right tool for believable cities; the engine's `validateGraph` already gates the output. | A lattice generator is simpler to write and produces monotonous, grid-like cities; making it not-look-gridded costs more than the road generator. | Road-graph generator, as A. |
| **5. Preserved investment** | Almost all. `types.ts`, `graph.ts` (394 lines, 13 exports), `tickets.ts`, `rng.ts`, `demo-board.ts` and **33 graph tests** survive. | Most of it is discarded or rewritten. Every traversal/validation export changes meaning; `demo-board.ts` and `graph.test.ts` are largely invalidated. | All of it survives. Cost = the derived block pass only, and it is disposable. |
| **6. Long-term ambitions** | No blocker. Rendering is a client concern; ~100 players is a scaling/interest-management concern (`VISUAL_DIRECTION.md` §2.2); many Yards are cheap because the generator is seeded and the artifacts are data. | No *hard* blocker, but it raises cost on both ends: 600–900 stations becomes ~10⁴–10⁵ cells to generate, author, review and stream. | No blocker. |
| **7. Effort (this session's model, no implementation done)** | **1–2 sessions.** One optional geometry field/map key, one pure accessor, a warning, plus co-location and capture tests. | **4–8 sessions**, plus map-artifact rework and a new generator, plus re-deriving the transit tiers inside the grid. | **2–3 sessions**: A plus a derived block-label pass and its test — and the pass is deletable. |

The third option is named because the brief asks for it, but note what it buys:
occupancy shading and a tile-friendly render path, at the cost of a second
spatial notion that will drift out of sync with the authoritative one. **Do not
adopt C unless a visual need for a grid overlay shows up in the mockups.**

---

## Rejected alternative, and the concrete failure mode

**REJECTED: Option B — a block/square coordinate system as the authoritative
movement model.** (More narrowly, a **pure uniform lattice with one node per
street intersection and no transit tiers**, sometimes proposed for
"street-following for free".)

**Concrete failure mode it would cause:** X-Yard's central deduction mechanic
stops constraining the search. Agents reason from *"the Fugitive used a bus"* —
in the current model, "bus" means "an edge whose `mode === 'bus'` with endpoints
that must be `hub`/`terminal`, never `street`" (`CLASS_MODES`,
`MODES_AVOIDING_STREET`). In a uniform lattice every cell has the same
neighbours, so mode no longer restricts *where a move can land*, only how far. A
bus move stops implying "landed on a hub or terminal" and implies "is two cells
away", so after a Reveal Pulse plus three logged modes the Agent's candidate set
goes from **a few dozen named stations they can enumerate and reason about on a
phone** to **hundreds of interchangeable squares** — the exact opposite of what
the director wants, and it deletes the `graph.ts` validation that makes mode
informative in order to do so. Second-order: bus/metro stop being distinguishable
from "long taxi" except by distance, so the ticket economy collapses toward one
distance-priced currency, contradicting §3's four named tiers and `special`
secret links.

---

## What would change in `game-core` if the recommendation is adopted

Small, additive, and none of it is a rebuild. **No implementation done here.**

| File | Change | Rough size |
| --- | --- | --- |
| `packages/game-core/src/types.ts` | Add an optional `path?: readonly MapPoint[]` field to `GraphEdge` (or a separate optional `GraphEdgeGeometry` keyed by `EdgeId`, which is easier for a generator to write and keeps `GraphEdge` lean). Add a `MapPoint { x, y }` type. **Optional and absent in tests**, so determinism and JSON round-trips are unaffected. | ~10–20 lines |
| `packages/game-core/src/graph.ts` | A pure `edgePath(graph, edgeId)` accessor returning the authored polyline or falling back to the straight `a → b` segment, so the renderer has one call regardless of map-data quality. A **warning** (never an error, per decision 0007) when a long non-metro edge has no authored path — the one place the diagonal bug is visible from the engine. | ~20–30 lines |
| `packages/game-core/src/types.ts` (movement modes) | Foot. Recommend `'foot'` as a fifth `TransportMode` with `ticketCost: 0` over street edges rather than a separate concept, because every existing consumer (`neighboursOf`, `modesFrom`, `hasRoute`, `spend`, the log) then keeps working. This is already an open question in `VISUAL_DIRECTION.md` §3; it needs a director decision. | ~10 lines + `TicketBag`/`TicketLogEntry` review |
| `packages/game-core/src/graph.ts` (validation) | The `ticketCost !== 1` error must become mode-aware if foot is added (foot costs 0). Per decision 0007 this is an error channel change, so it needs care: state the rule, then test both directions. | ~15 lines |
| `packages/game-core/src/graph.test.ts` | **Add**, do not rewrite: (a) a long edge without an authored path warns and does not error; (b) `edgePath` falls back to the straight segment; (c) `edgePath` is pure and does not mutate the graph. | ~40 lines |
| new tests for capture | These belong to whatever change adds capture resolution (there is **no turn machine and no capture resolution yet** — see the brief's §0). Write them when that lands, not now: co-location is symmetric; co-location is not sufficient if the rule requires the Agent to have *moved*; a swap must be decided deliberately rather than falling out of implementation order. | — |

Total: **~1–2 sessions**, no wire-protocol break, no new dependency,
`"dependencies": {}` untouched, `pnpm test` green throughout. Standing constraints
respected: decision [`0007`](../decisions/0007-two-validation-channels.md) (warnings
are never promoted to errors) and
[`0006`](../decisions/0006-provisional-prefix-per-constant.md) (any new heuristic
must be a `PROVISIONAL_` export citing its question).

### Capture and co-occupancy: the decision the block question was standing in for

"Unambiguous capture" cannot be delegated to the map representation, so state it:

- **Co-location is legal.** The graph has no capacity notion and none is stated.
  Multiple characters may share a node; this is Scotland Yard's behaviour and it
  is what lets an Agent occupy a Fugitive's station at all.
- **Capture test:** at `capture-resolution`, for each Fugitive, if any Agent's
  node equals that Fugitive's node → `CaptureKind: 'occupation'`. One comparison,
  total, order-independent. **Reveal Pulse is not a capture moment**: a pulse says
  where the Fugitive *was*, and per `GAME_VISION.md` §2 capture is evaluated at
  the end of the Agent Phase.
- **Swaps/crossings need an explicit rule.** If the Agent and Fugitive exchange
  nodes in one turn, end-of-phase co-location is false and no capture occurs.
  Either outcome is defensible; it being decided by iteration order is not.
  **Recommend: no capture on a clean swap** — they were never in the same place
  at the same time under §2's staggered ticks.

---

## Open questions for the director

1. **Is a straight-line edge ever acceptable for a non-metro move?** If not, the
   generator must emit geometry for every taxi/bus/special edge and `validateGraph`
   should warn on any long one that lacks it. *Recommended default: **no** — require
   authored paths for taxi/bus/special; allow straight chords for `underground`
   only, since metro legitimately cuts under the city (the brief's §5 exception).*
2. **Derived grid or block label: does the engine hold one at all?** Needed for
   occupancy shading or "which district is the Fugitive in?"; wanted anyway if the
   settled art style turns out tile-based. *Recommended default: **derive at render
   time** from `(x, y)`; if the engine must hold one, an optional integer `blockId`
   on `GraphNode`, computed by map tooling, never consulted for movement.*
3. **Capture on a crossing/swap: yes or no?** *Default: **no** on a clean swap.*
4. **`MIN_NODE_DISTANCE` units.** `graph.ts` warns when two nodes sit within
   `PROVISIONAL_MIN_NODE_DISTANCE = 20`. To stop route polylines from overlapping
   buildings, the generator must know whether that is 20 pixels at the full-city
   overview zoom or 20 world units. *Recommended default: keep 20 and define the
   world as the full-city overview extent; confirm once a real board exists.*
5. **Map scale.** `VISUAL_DIRECTION.md` says ~600–900 stations; this research
   assumes that. Scotland Yard ships 199 ([scotland-yard-data
   README](https://github.com/AlexElvers/scotland-yard-data)). *Recommended default:
   target ~600 for the first Yard, so hand-tuning stays affordable.*
