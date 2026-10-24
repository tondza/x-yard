# docs/project-plan.md — prototype, then MVP

**Status:** plan of record for the next two phases. Written 2026-10-16 against the
director rulings recorded in [`docs/mvp/README.md`](mvp/README.md) and decision
[0011](decisions/0011-prototype-before-multiplayer-mvp.md); those rulings override
the agent documents wherever they conflict.

**How to read the numbers.** The director stated the seat counts, the phase order,
the 16-turn limit, the pulse turns 5/10/15, starting separation ≥ 3 edges, random
faction assignment with a prototype override, one device per seat, node-and-edge
movement and "start the generator early". Every other number here is marked
**proposal, pending playtest**. None of it is settled, and none of it may be
ratified into `GAME_VISION.md` until the director says so.

**Authority.** [`GAME_VISION.md`](../GAME_VISION.md) is the design brief;
[`VISUAL_DIRECTION.md`](../VISUAL_DIRECTION.md) refines presentation.
[`TESTING_STRATEGY.md`](../TESTING_STRATEGY.md) and
[`AGENT_RULES.md`](../AGENT_RULES.md) govern process. The engine's own rules —
zero dependencies, determinism, the `PROVISIONAL_` prefix — are in
[`packages/game-core/AGENTS.md`](../packages/game-core/AGENTS.md) and are not
renegotiable here.

**There is no Part 3.** The director ruled that no planning beyond the MVP is
needed. This document stops at the end of Part 2 by design.

---

# Part 1 — the Prototype (the detailed part)

## 1.1 Why the prototype exists

Not to prove the loop is fun. To give the director **a feeling of success** and to
**validate what the game looks like**. Those are the director's words and they set
the bar: this is a look-and-feel and end-to-end-plumbing milestone, not a balance
milestone.

"Feeling of success" is deliberately concrete here. In one sitting the director
must be able to:

- start a session, be handed the Fugitive seat by the override, and win or lose
  it on merit within a single phone-length session;
- see the four transit tiers **and** the on-foot and scooter options drawn as
  moves that follow streets;
- see the Reveal Pulse fire on schedule and watch three bots visibly react to it;
- see the capture happen and the result screen name the winner and the reason;
- reach the end of a session with every rule visibly respected — no dead mode, no
  missing log row, no illegal move line.

**Explicitly NOT the goal:** proving the Reveal Pulse is not dominant. The
director has accepted pulse dominance for now ("adopted cycle", 16 turns with
pulses on 5/10/15). The prototype is the first instrument that can produce
evidence either way, but it is not required to settle it.

**Rejected (the prototype's purpose):** "prove the loop is fun before building
anything." Failure: the loop's openness is the thing the director already ruled
acceptable for now, so that criterion would block the phase on the one question
it was exempted from.

## 1.2 What the prototype is

| Property | Value | Source |
| --- | --- | --- |
| Seats | **5** | director ruling |
| Humans | **1** | director ruling |
| Bots | **4** | director ruling |
| Multiplayer | **no** — single-player, local | director ruling |
| Faction assignment | random, with **prototype override: the director always plays the Fugitive** | director ruling |
| Session length | **16 turns** | director ruling |
| Reveal Pulses | turns **5, 10, 15** | director ruling ("adopted cycle") |
| Movement model | node-and-edge | director ruling (blocks rejected) |
| Device policy | not applicable locally; **one device per seat is the rule that governs the MVP**, not this phase | director ruling |
| Bot intelligence | "need not be clever" | director ruling |

**Faction mix — proposal, pending playtest.** The ruling fixes the seat *count*,
not the split. With the override the director is the only Fugitive, so the
proposal is **1 Fugitive (the director) + 4 Agents**. **Rejected:** 4 bots as 2
Fugitives and 2 Agents, which exercises multi-Fugitive play early but forces
per-Fugitive projection (MVP work) into the phase that exists to avoid it. The
4-Agent mix is knowingly lopsided — see §1.7.

## 1.3 Deliberately out of scope

The prototype must be cheap, so these are cut, not deferred-with-a-design:

| Cut | Why it is safe to cut now |
| --- | --- |
| Accounts, login, profiles | The prototype has exactly one human seat. |
| Persistence, save/resume | A session is one sitting. Seeded RNG makes replay reproducible without a database. |
| Matchmaking, lobbies, invite codes | One local seat. |
| Netcode, sockets, rooms | Single process. The MVP's authority rule is respected by keeping all views inside the same process, not by shipping a server. |
| The map generator | "The prototype may use a small hand-authored map" (ruling + decision 0011). |
| The mobile UI as specified in `round-03-product.md` | That document is written for 3 seats and a pass-the-device flow; both are invalidated. The prototype needs a legible screen, not S0–S3. |
| Art direction F or H | Still blocked on the director. The prototype informs that choice instead of waiting for it. |
| WebGL / interest management | 5 seats on one screen; a plain Canvas 2D board is enough for the prototype. |
| Gadgets, Agent skills, contraband, safe houses, spectating, replay scrubber, audio, localisation | Same cut list the MVP already carries, plus nothing new. |

The `demo-board.ts` fixture is **not** the prototype map — its own header says so.
The prototype needs its own hand-authored board.

## 1.4 The map the prototype needs — proposal, pending playtest

**Proposal:** one hand-authored map, **~24 nodes / ~40 edges**, node mix roughly
16 `street` / 6 `hub` / 2 `terminal` (ratio pending playtest), street-following
edges carrying authored polylines.

It must satisfy, as authoring constraints:

- every rule `validateGraph` already enforces as an **error** — connectivity,
  class/mode eligibility (bus and metro avoid `street` nodes), declared modes
  matching incident edge modes, one black-market and one safe-house node present
  as **inert** nodes (the MVP needs them only because the validator errors
  without them);
- the **taxi-only subgraph spans every node**, today a *warning*, because a
  player out of every mode must never hold forever with no legal move;
- **starting separation ≥ 3 edges between the Fugitive start and every Agent
  start** (director ruling). Note this is stated for one Fugitive; its
  multi-Fugitive extension is an open question (§2.5).
- authored `geometry` for every street-following edge, so the client draws
  streets rather than chords. Per-edge street geometry is the real fix for the
  diagonal complaint ([`round-03-map-system.md`](research/round-03-map-system.md) §4).

**Rejected:** reuse `DEMO_BOARD` (8 nodes, 21 edges) and add geometry. Failure: 8
nodes cannot hold a 16-turn chase with ≥ 3-edge separation, and reusing a fixture
as the first playable board hides exactly the map-authoring problems the
prototype is supposed to surface.

## 1.5 Bot behaviour spec (minimum viable, simple is fine)

One interface, two policies. A bot is **a seat that produces the same command a
human seat produces**, through the same validation path. That is a hard
requirement, not tidiness: mid-Yard human takeover (MVP, ruling 2) is impossible
later if bots bypass the command path now.

Both policies are **pure functions over state**, and both must be deterministic.
Random tie-breaks are permitted only from the injected `RngState`, never from
`Math.random`.

**Shared skeleton (proposal, pending playtest):**

1. Enumerate legal moves: every incident edge whose mode the seat can still pay
   for, plus a foot move if foot steps remain, plus a scooter move if a charge
   remains and a 2-edge street-following path exists.
2. If the list is empty, return no command; the engine records the forced `hold`.
3. Score each candidate with the faction policy below.
4. Return the highest-scoring candidate; break ties by **sorted destination node
   id**, so a seed reproduces the exact same Yard.

**Agent bot (minimum viable) — proposal, pending playtest.** Score a destination
by "does it reduce my distance to where the Fugitive might be":

- maintain a candidate set from the last Reveal Pulse plus every logged row since
  it, filtered by mode eligibility (the set `round-03-validation.md` §9 already
  reasons over);
- prefer a destination inside the candidate set;
- failing that, prefer a destination that reduces edge distance to the set;
- spend scarce tiers (bus/metro) only when the set is large, otherwise walk.
- **No coordination between the four Agents.** They do not share a plan and have
  no role assignment. Four independent Agents are more than enough for a 5-seat
  prototype and are the honest minimum.

**Fugitive bot (only needed if the override is off, or for headless soak runs).**
Score a destination by distance from the nearest Agent (maximise), with a small
penalty for spending a scarce tier. It must never see hidden Agent information it
could not have: with the override on, the human is the Fugitive, so this policy is
a test harness, not a shipping behaviour.

**Rejected:** a probability/heuristic Agent that models opponent intent.
Failure: it is a search problem with no ground truth until the loop is tuned, and
it would make bot behaviour a balance variable before the loop has been played
once. **Rejected:** a scripted Agent that follows a fixed patrol route. Failure:
it cannot react to the Reveal Pulse at all, so the one beat the prototype exists
to show would look broken.

## 1.6 What the director must be able to do in one end-to-end session

1. **Start** a Yard with a chosen seed and the Fugitive override on.
2. **Read** the board: own position, Agent positions (Agents are public among
   themselves; from the Fugitive's seat, Agents are visible — proposal, pending
   playtest), the turn strip with pulse turns marked, and the public log.
3. **Move**, every turn, by picking a mode and then a destination. Illegal modes
   are visibly disabled with the reason printed, because the UI is how a rule is
   learned.
4. **Watch** the four bots resolve their phases in seat order.
5. **See the pulse** on turns 5, 10 and 15: own node broadcast, marker and log
   row updated.
6. **Reach an end**: capture (Agent ends a turn on the Fugitive's node) or 16
   turns survived, with the result screen naming the winner.
7. **Restart** and reproduce the same Yard from the same seed.

## 1.7 "First playable" — definition

The first playable is the smallest slice that already exercises the whole spine:
**the 5-seat setup, the turn machine, the full six-option movement set, spending
and the public log, capture resolution, the three pulses, and both end screens**,
on the hand-authored map.

It is the same first-playable *intent* M1 §13 described, with three differences
forced by the rulings: it is **not** hot-seat (no same-device support), it is
**5 seats, not 2**, and it runs **16 turns, not 24**. M1 §13's "1v1 hot-seat
developer harness" is therefore **superseded** — nothing in this plan uses
pass-and-play, including for development.

**Rejected:** ship the six movement options incrementally (taxi + metro + foot
first, as M1 §13 proposed). Failure: the scooter and bus are the mechanics whose
*legibility on the map* is in question, and the prototype's stated purpose is to
validate what the game looks like — a look-validation build that omits two of the
five movement affordances validates the wrong screen.

## 1.8 Acceptance criteria — "prototype is done"

All of these must be true, and each must be demonstrated, not asserted.

| # | Criterion | How it is checked |
| --- | --- | --- |
| P1 | **5 seats, 1 human + 4 bots, one process, no network.** | The session runs with the server stopped. |
| P2 | **The whole spine is playable end-to-end** per §1.6. | One recorded session start → result. |
| P3 | **Determinism.** The same seed and the same command sequence produce an identical final state. | Two runs compared, field by field. |
| P4 | **The log invariant holds on every turn**, including the capture turn. | Exactly one row per living Fugitive per turn; the capture turn included. |
| P5 | **Capture is end-position equality only** — co-occupancy is legal, a clean swap is not a capture, the pulse is not a capture moment. | Unit tests over the resolution step. |
| P6 | **Pulses fire on turns 5, 10, 15 only**, and `reveal-pulse` resolves **before** the Agent phase. | Event log inspection. |
| P7 | **Movement follows streets.** Every drawn legal move is a street polyline except `underground` and `special`. | Visual check plus a test that a street-following edge without geometry is refused by authoring review. |
| P8 | **The override works every time**: with it on, the director is the Fugitive in 100 % of starts; with it off, assignment is random and seeded. | Seeded runs over many seeds. |
| P9 | **No illegal move, no unspent-ticket desync, no forced hold that should have been a move**, across a full session. | Session plus unit tests on the legal-move enumeration. |
| P10 | **`pnpm test` is green** across the repo (verified today: **5 test files, 93 tests**) and the prototype adds its own suites without weakening any existing one. | Full recursive suite. |
| P11 | **`game-core` still declares `"dependencies": {}`** and TypeScript strict mode is untouched. | `architecture.test.ts` and `tsconfig`. |
| P12 | **Every new number is a `PROVISIONAL_` constant** naming the open question it stands in for. | `grep -rn PROVISIONAL_` is the complete inventory. |

**Not acceptance criteria:** balance, win rate, session length, art quality, and
whether the pulse dominates. Those are playtest questions the prototype informs.

## 1.9 Technical approach, grounded in what exists today

Verified by reading the code, not by assumption.

**What exists now, and is directly reusable:**

| Asset | Where | What it gives the prototype |
| --- | --- | --- |
| Domain vocabulary | `packages/game-core/src/types.ts` | `NodeId`, `EdgeId`, `PlayerId`, `YardId`, `Role`, `Phase`, `TransportMode`, `LoggedTransport`, `CaptureKind`, `RevealReason`, `YardResult`, `TicketBag`, `TicketLogEntry`, `GraphNode`/`GraphEdge`/`TransitGraph`, and the brief-stated constants plus the `PROVISIONAL_*` defaults. |
| Validated transit graph | `packages/game-core/src/graph.ts` | `validateGraph` with an explicit error/warning split, `createGraph`, `graphStats`, `neighboursOf`, `modesFrom`, `hasRoute`, `degree`, `nodeById`, `nodesWithFacility`, `nodesWithinRadius`, `routeKey`. |
| Ticket economy + public log | `packages/game-core/src/tickets.ts` | `createTicketBag`, `spend` (returns `{ ok: false }`, never throws on an empty pocket), `refund`, `affordableModes`, `ticketCount`, `totalTickets`, `isEmpty`, `startingTicketsFor`, `ticketLogEntry`, `appendTicketLog`, `logForFugitive`, `applyTicketDelta`. |
| Deterministic RNG | `packages/game-core/src/rng.ts` | `seedRngState` (splitmix32-expanded), `nextRandom`, `randomInt`, `pickRandom`, `shuffleWith`, `isRngState` — pure, xorshift128+, JSON-serializable state. |
| Scaffold board | `packages/game-core/src/demo-board.ts` | A validated 8-node fixture — useful for wiring, **not** the prototype map. |
| Public API surface | `packages/game-core/src/index.ts` | The barrel the prototype and the MVP must extend, not bypass. |

**What genuinely does not exist** (confirmed: no `GameState`, no `submitCommand`,
no `applyEvent`, no `hashState`, no `projectState`, no `replay` anywhere in
`packages/` or `apps/`; `architecture.test.ts` asserts that `GameState` is still
absent and calls the serialization oracle "still owed", and
[`docs/status.md`](status.md) lists the same gaps):

- **no turn machine** — `Phase` is a union, not a sequence; nothing advances it,
  nothing orders it, and the union's current order (`fugitive-phase`,
  `agent-phase`, `capture-resolution`, `reveal-pulse`) does **not** match the
  adopted phase order;
- **no capture resolution** — `CaptureKind` exists, nothing implements it;
- **no state projection** — and therefore, by the server rule in
  [`AGENTS.md`](../AGENTS.md) ("hidden information is projected out inside
  `game-core`, never merely hidden by the client"), **no server code may send
  game state to a client** until it lands. The prototype does not send state over
  a wire at all, which is the cheapest way to respect that rule;
- **no seat abstraction**, no bot, no `GameState` serialization oracle,
  no server integration tests.

Verified today: `pnpm test` is green at **5 test files, 93 tests**
(`architecture.test.ts`, `graph.test.ts`, `rng.test.ts`, `spec-alignment.test.ts`,
`tickets.test.ts`).

## 1.10 Engine decisions the prototype forces (each with the rejected alternative)

| # | Decision (proposal unless marked) | Rejected alternative and its failure |
| --- | --- | --- |
| E1 | The turn machine is **pure and deterministic**, driven by returned values; ordinary conditions (`no_ticket`, `no_legal_move`, `yard_over`) return results, and only programming errors throw. | **Rejected:** throw on an illegal command. Failure: a phone client's predictable mis-tap would become an exception, and the server integration path needs a value to reject with. |
| E2 | **Do not widen `TransportMode`.** Add `MobilityOption = TransportMode \| 'foot' \| 'scooter'` and extend `LoggedTransport` to `TransportMode \| 'foot' \| 'scooter' \| 'hold' \| 'unknown'`. Keep `footSteps` and `scooterCharges` outside `TicketBag`. | **Rejected:** add `foot` to `TransportMode`. Failure: `TransportMode` indexes edges and `TicketBag`; widening it ripples into `TRANSPORT_MODES`, `affordableModes`, `createTicketBag` and the validator, and every paid-tier assumption becomes conditional for no gameplay gain. |
| E3 | **One log row per living Fugitive per turn, appended during the Fugitive phase unconditionally**, so the capture turn is reconstructible. | **Rejected:** write the row at end of turn. Failure: a capture inside `capture-resolution` ends the Yard before the row exists, which is the exact hole `round-03-validation.md` found on both capture transcripts. |
| E4 | `GraphEdge` gains optional authored geometry (`MapPoint { x, y }` + a polyline), with a pure fallback accessor for edges that lack it. | **Rejected:** derive the polyline from node coordinates at render time. Failure: it re-draws the chord across buildings — the bug that started this thread. |
| E5 | Capture: `agent.node === fugitive.node` at `capture-resolution`, **end positions only**; nodes are uncapped; moving onto an occupied node is legal; a clean swap is not a capture. | **Rejected:** a per-node capacity with a bump rule. Failure: a second movement rule layered on the first, needing its own ordering rule, to replace one equality test. |
| E6 | **`Phase` order changes** to `yard-start → fugitive-phase → reveal-pulse → agent-phase → capture-resolution → yard-end`. | **Rejected:** keep the current union order and resolve the pulse after capture resolution. Failure: Agents act on a pulse a full turn stale, and a capture on the pulse turn is impossible. |
| E7 | Faction assignment is **random from the injected RNG**, with a **prototype override that always gives the director the Fugitive seat**. | **Rejected:** client-assigned, never self-selected (the `round-03-validation.md` recommendation). Failure: it answers a different question (pass-and-play leak prevention) and contradicts the ruling, which is random assignment plus an override. |
| E8 | The **seat is the abstraction** from day one: a seat has a role, a position, a purse, and a controller that is either a human input or a bot policy. | **Rejected:** build human seats now, refactor bots in later. Failure: mid-Yard human takeover is a ruling, and retro-fitting it would mean rewriting the command path the prototype just proved. |
| E9 | The prototype runs **locally, with no server and no sockets**. | **Rejected:** stand up the Fastify server in the prototype. Failure: it front-loads the lobby, reconnect and projection surfaces the prototype exists to postpone — and `projectState` does not exist, so a server could not legally send state anyway. |

## 1.11 Build order (dependencies first)

| # | Step | Depends on | Rough size (proposal) |
| --- | --- | --- | --- |
| B1 | **Author the prototype map** (§1.4) with edge geometry; extend the validator with a street-following-geometry **warning**, never an error. | nothing | 1 session |
| B2 | **Add movement options and step/charge counters** (E2) as pure functions with unit tests. | B1 | 1 session |
| B3 | **`GameState` + `submitCommand` + `applyEvent` + the turn/phase machine** (E1, E3, E6), single-Fugitive, 5 seats. | B1, B2 | 2–3 sessions |
| B4 | **Capture resolution** (E5) plus the result screen's data. | B3 | 1 session |
| B5 | **The seat abstraction and the two bot policies** (§1.5). | B3 | 1–2 sessions |
| B6 | **The local board UI**: board, turn strip, mode tray, log strip, pulse reveal, end screens — deliberately not `round-03-product.md`'s S0–S3. | B3, B4 | 2 sessions |
| B7 | **`hashState` + replay oracle** so P3 is checkable, and `architecture.test.ts`'s owed serialization check is replaced by the real one. | B3 | 1 session |
| B8 | **Soak runs**: seeded multi-game runs asserting P4, P5, P6, P9 and no forced hold that should have been a move. | B3–B7 | 1 session |

Nothing in Part 1 requires a package install, a new dependency, or a change to
`game-core`'s `"dependencies": {}`.

---

# Part 2 — the MVP roadmap (lighter, sequenced)

## 2.1 What the MVP is

Per the director: **a map of up to 20 players, 4 of them Fugitives** (4 Fugitives
+ up to 16 Agents). A solo player fills the remaining seats with bots, and **a
human joining later takes over a bot's seat**. One device per seat. Faction
assignment is random; the prototype override is a testing affordance and does not
ship as a product feature. They continue to state no MVP plan beyond this.

## 2.2 Conflict register — what the rulings invalidate, and which file changes

| # | Conflict | Documents that must change | When |
| --- | --- | --- | --- |
| C1 | **Seat count.** `round-03-rules.md` §2, `round-03-product.md` §1/§3 and `round-03-validation.md` §5–§6 are all written for **1 Fugitive vs 2 Agents (3 seats)**; the MVP is up to 20 players with 4 Fugitives. `round-03-rules.md` §2 also states "1 vs 4+" is *not supported* and multiple Fugitives are *not MVP* — the ruling says the opposite. | `round-03-rules.md`, `round-03-product.md`, `round-03-validation.md` | **Before any MVP implementation, and in parallel with B1–B2.** In particular the 4-Fugitive model makes `projectState` per viewer **and per Fugitive**, and the validation's balance analysis does not transfer. |
| C2 | **Device policy.** `round-03-product.md` rejected alternative **R3** and its Open Question 2 recommend shipping **same-device pass-and-play**; ruling 3 rejects same-device sharing outright. R3 deleted the lobby surface on the grounds that pass-and-play needed none — so removing pass-and-play **restores the lobby, seat-join and reconnect surface** M2 was avoiding. `round-03-product.md` §10 ("same-device play needs no identity at all") is likewise invalid. | `round-03-product.md` (R3, its Open Question 2, §3 S0, §4 I1, §10) | Before the mobile UI step (M7). |
| C3 | **Faction assignment.** `docs/mvp/README.md` open question 4 and `round-03-rules.md` §17 leave "who becomes the Fugitive" unanswered; `round-03-validation.md` fix 12 recommends **assigned by the client, never self-selected**. Ruling 6 settles it as **random, with a prototype override** — which invalidates fix 12 and closes the open question. | `docs/mvp/README.md` (open questions), `round-03-rules.md` §17, `round-03-validation.md` fix 12 | With C1. |
| C4 | **Scooter and starting separation.** `docs/mvp/README.md` §3 (stale, by its own admission) still describes the scooter as buying tempo "with visibility" and does not state starting separation, while its §2 preamble already records the exact-reveal cut and the ≥ 3-edge separation adoption. The documents contradict **themselves**; the ruling's version wins. Separately, **starting separation ≥ 3 edges is stated for one Fugitive** and has no defined meaning with four. | `docs/mvp/README.md` §3 | Before the map generator's requirements are frozen (M1). |
| C5 | ~~**10-seat ceiling and pre-ruling turn/pulse numbers.**~~ **Resolved 2026-10-16** in `packages/game-core`: `MAX_FUGITIVES_PER_YARD = 4` + `MAX_AGENTS_PER_YARD = 16` = **20 seats**, `YARD_TURN_LIMIT = 16`, `REVEAL_PULSE_TURNS = [5, 10, 15]`, plus `MIN_START_SEPARATION_EDGES = 3`; the four `PROVISIONAL_` names are gone, with no compatibility alias. | `packages/game-core/src/types.ts`, `index.ts`, `spec-alignment.test.ts`, `apps/server/src/index.ts` | Done in the 2026-10-16 ratification change. |
| C6 | **The block/square question is closed.** `VISUAL_DIRECTION.md` §3 ("Map representation … No representation change is adopted until that lands") and §4 directive 6 are still open in the file even though ruling 4 rejects the block model. | `VISUAL_DIRECTION.md` §3, §4 | When the director next edits the visual file; not blocking. |

**[`docs/status.md`](status.md) needs no rewrite:** it already records the
prototype phase, the 20-player/4-Fugitive re-scope and the link to this document.
It does list "MVP scope" and "Phase order" under *Blocked on the director*; those
two are now ruled on, so status can move them to *What is next*.

## 2.3 Ordered steps from prototype to MVP

Roughly sized in sessions. Order is dependency order, not priority order.

| # | Step | Depends on | Rough size | Notes |
| --- | --- | --- | --- | --- |
| M1 | **Map generator** (`generateMap`-style, seeded, dev tooling with committed output) emitting node classes, transit tiers, **authored street geometry per street-following edge**, ≥ 3-edge starting separation, spanning taxi subgraph, and an inert black-market + safe-house. Output gated by `validateGraph`. | B1's geometry type (Part 1) | 3–5 sessions | Director: "start the generator early." It is a **component, not a late task** — the MVP's map scale is the generator's output, and no acceptance test can be written against a hand-authored board. **Rejected:** generate nodes only and let the client approximate streets. Failure: the diagonal defect returns with no test failing. |
| M2 | ~~**Ratify the adopted numbers** (`PROVISIONAL_` names → brief)~~ **Partially done 2026-10-16:** the 16-turn limit, pulses 5/10/15, seat counts (4 + 16) and ≥ 3-edge separation are ratified into constants and `spec-alignment.test.ts`. The **ticket/step budgets remain unratified** (appendix C.2, Q1). | director | 0.5 session for the rest | Remaining: the ticket/step economy at the 20-player scale. |
| M3 | **Multi-Fugitive turn machine**: 4 Fugitives, up to 16 Agents, per-Fugitive log rows, seat ordering, one capture check over all Agents and living Fugitives, last-living-Fugitive / turn-16 end conditions. | M1, B3 | 3–4 sessions | The rules makeover from C1 lands as code, not as prose. |
| M4 | **`projectState` per viewer and per Fugitive**: each viewer sees its own truth; every Agent sees the schedule reveals, the public log, and nothing about un-revealed Fugitives. | M3 | 2–3 sessions | This is the MVP's single most security-relevant function. **Rejected:** hide on the client. Failure: a hidden node in a payload is not hidden, and the server rule forbids it anyway. |
| M5 | **Candidate-set / belief solver inside `game-core`**, pure, as the input to Agent-side belief shading and to the real tractability test (`round-03-rules.md` §12's "median candidate set ≤ 12" must be measured, not hoped). | M4 | 2 sessions | Also the only honest instrument for the Reveal Pulse dominance question the director parked. |
| M6 | **Authoritative server**: Fastify + Socket.io rooms, seat join, command validation, per-viewer projected broadcasts, **interest management** (send a client only what is near it), reconnect. | M4 | 3–4 sessions | `apps/server` boots and serves `/health` and `/board` today; there is no integration suite yet. |
| M7 | **Bots and takeover on the server**: bot-controlled seats tick through the same command path; a human joining takes a bot's seat mid-Yard, inheriting position, purse and log; a seat whose human drops reverts to a bot after a grace period. | M6, M3 | 2–3 sessions | Tests the Part 1 seat abstraction for real. |
| M8 | **Mobile UI**: the M2 screen set re-derived for 20 seats and 4 Fugitives — per-seat join (C2), a log strip that does not confuse four trails, belief shading, the pulse beat, the capture result, the rotate prompt. | M4, M6 | 4–5 sessions | Also where the art direction F/H must finally be chosen; the prototype (§1.6) is the evidence base for that choice. |
| M9 | **End-to-end and load verification**: full-suite `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:docs`, plus a booted-server route exercise and a 20-seat Yard. | M1–M8 | 1–2 sessions | Per `AGENTS.md`, report what was actually run. |

**Total, proposal only:** roughly 20–30 sessions of agent work, exclusive of
director decisions. That is a sizing aid, not a commitment.

## 2.4 What the MVP deliberately still does not do

Gadgets, Agent skills, contraband missions, safe houses as mechanics, multi-Yard
cities, spectating, progression, audio, localisation, and the ~600–900-station /
~100-player city stay out. The generator (M1) produces one map per Yard; scale
beyond 20 seats is out of scope until the director asks.

## 2.5 Open questions this plan deliberately does not answer

1. **Starting separation with four Fugitives.** Is ≥ 3 edges measured from every
   Agent start to *every* Fugitive start, or only from each Agent to its nearest
   Fugitive? The ruling is stated in the singular.
2. **Whether the pulse still dominates at 20 seats and 4 Fugitives.** The
   director accepted it "for now"; the prototype and M5 are the evidence, and a
   design call follows, not an engineering one.
3. **Map scale for 20 seats.** The MVP map is still described by the invalidated
   3-seat documents. Proposal, pending playtest: the generator's node count must
   scale with seats; no number is adopted here.
4. **Bot competence at 16 Agents.** Fourteen solo seats filled by the §1.5 Agent
   policy will play badly. That may be acceptable for a first MVP, but it is a
   product decision, not a plan decision.

## 2.6 Stop line

The director ruled that **no planning beyond the MVP is needed**. This document
therefore ends here. Anything after the MVP — cities, gadgets, progression,
scaling past 20 seats, rankings — is out of scope for this plan and must not be
added to it without a new ruling.
