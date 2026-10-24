# Round 03 — M1: MVP rules and mechanics

**Deliverable owner:** agent M1. **Status:** proposal, awaiting the product director.

**Authority.** [`GAME_VISION.md`](../../GAME_VISION.md) §1–§6 is the design authority; [`VISUAL_DIRECTION.md`](../../VISUAL_DIRECTION.md) refines presentation. This is not a brief: it is a buildable *specification for the MVP*, and where it narrows the vision for MVP-only reasons it says so in place.

**How to read the numbers.** The brief states **no** M1 number. Therefore **every number in this document is an MVP default pending playtest**; none is settled. Existing `PROVISIONAL_` constants keep their names until the director ratifies a value into the brief — this spec names which constant each number belongs to, so the promote-and-rename change is mechanical.

**Engine assumption.** Designed against the current node-and-edge engine (`TransportMode = 'taxi' | 'bus' | 'underground' | 'special'`, see [`types.ts`](../../packages/game-core/src/types.ts)). Rules that change if the map becomes block-based are marked **[[MAP-ASSUMPTION]]** and collected in §15.

---

## 1. Scope

One Yard. One hidden **Fugitive**. Two **Agents**. Twenty-four turns. A hand-tuned node map. Five movement options — the four transit tiers, **on foot**, and the **electric scooter**. Deduction comes from the public ticket log and scheduled **Reveal Pulses**; capture is by occupying the Fugitive's node. Everything below makes those sentences precise.

### 1.1 Cut list — confirmed out of MVP

| Cut | Why it is out of MVP |
| --- | --- |
| Fugitive gadgets | Three consumables whose only job is to corrupt information; that cannot be balanced before the base deduction loop is proven. |
| Agent skills | Each adds a resolution step and a new hidden-information interaction; the base loop needs none. |
| Contraband missions | A second scoring axis; MVP has exactly one win axis per side, so the objective is never ambiguous on a phone. |
| Safe houses / extraction | Meaningful only with missions and scoring; with a turn limit, surviving to turn 24 *is* extraction. |
| Multi-Yard instances | One Yard per room; no city selection, no cross-room state, no matchmaking. |
| Spectating | The viewer-dependent rule already governs who sees what; a third viewer class multiplies the projection surface for no gameplay. |
| ~100 players per city | 3 seats, one map, ~60 nodes: the rendering and bandwidth problem is deferred, not solved. |

**Map-fixture consequence.** `validateGraph` errors on a board with no black-market and no safe-house node, because missions (`GAME_VISION.md` §4) require them. MVP rules use no facilities, so the MVP map carries one of each as **inert nodes** to keep that rule honest. Recommendation: do not weaken it for MVP.

---

## 2. Player count

**MVP default pending playtest: 3 seats — 1 Fugitive vs 2 Agents.** Two seats (1 vs 1) must be possible for the first playable (§13), but is a test harness, not the shipped configuration.

Capture needs an Agent to *end a turn* on a hidden node, so the Agents' only real weapon is coverage. With one Agent the Fugitive's candidate set and the Agent's single position rarely intersect — the Fugitive wins by drifting. With four or more, the candidate set collapses in the first pulseless stretch and the Fugitive is squeezed by arithmetic rather than by play; each extra seat is also another player to find and another phase to wait through on a phone.

| Configuration | Verdict |
| --- | --- |
| 1 vs 1 | First playable and load test only |
| **1 vs 2** | **MVP shipping configuration** |
| 1 vs 3 | Post-MVP variant: same rules, no new code paths |
| 1 vs 4+ | Not supported |
| Multi-Fugitive (2 vs 3+) | Not MVP; §9 is written to extend to it, nothing ships with it |

**Rejected:** 1 vs 4 (the full board-game spread). Failure: four Agent phases is four waits per turn on a phone, and four Agents on 60 nodes make the pre-pulse set intersect almost every turn, so the Reveal Pulse stops being the dramatic beat it exists to be.

**Rejected:** 2 Fugitives vs 2 Agents as the MVP core. Failure: every log row must carry a `fugitiveId`, and with two hidden Fugitives using the same mode the log is ambiguous, which needs an attribution rule nobody has designed. One Fugitive first.

---

## 3. Movement must follow the streets (director priority #1)

This is a **data-layer invariant, not a rendering preference.** The mockups cross blocks because the renderer drew node-to-node straight lines; fixing only the renderer fixes the picture and leaves the bug.

- **R1 — Positions are nodes, moves are edges, and nothing else exists.** A move command names a destination node; the engine accepts it only if a payable edge incident on the current node joins them. There is no free-position, partial, or coordinate-based move. A player therefore *cannot* produce a straight-line path, because a path is never an input to the engine.
- **R2 — Diagonal-free rendering follows from edge geometry, not node coordinates.** Every edge carries a `geometry` polyline; the client draws a legal move by drawing that polyline. Straight node-to-node lines are permitted **only** for `underground` and `special` (R4). The client never interpolates between arbitrary nodes.
- **R3 — Adjacency is authored, never computed from proximity.** No "nearest node within radius", no Delaunay, no coordinate sorting. Coordinates are decoration; the edge list is the city. A distance query must never create a legal move.
- **R4 — Only genuine off-street modes may cut across the map.** `underground` may cross blocks, rivers and buildings; `special` (alleyway links) may too, since its whole value is not being a street. Every other mode, `foot` and `scooter` included, follows streets.
- **R5 — Validator error.** Every street-following edge (`taxi` and the walkable tier of §5) must have `geometry` covered by the map's street segment set within a small tolerance; an edge that leaves the street network is a **map bug** and fails `validateGraph`. This is the director's explicit rule, so it belongs in the error channel — unlike the provisional degree heuristics, which stay warnings.
- **R6 — The scooter's two-edge move is two edges** (§6): two consecutive street edges, rendered as the concatenation of their polylines.

**Rejected:** "keep the graph, improve the line rendering." Failure: the invariant is unenforced, so the next map generator silently reintroduces a diagonal edge and the director's complaint returns with no test to catch it. Rejected for the same reason: computing adjacency from coordinates to "snap" a nicer-looking path.

---

## 4. Movement options and the economy

| Option | Cost | Reach | Logged as | Fugitive | Agent |
| --- | --- | --- | --- | --- | --- |
| `taxi` | 1 taxi ticket | any taxi edge (1 edge) | `taxi` | yes | yes |
| `bus` | 1 bus ticket | any bus edge (1 edge) | `bus` | yes | yes |
| `underground` | 1 metro ticket | any metro edge (1 edge) | `underground` | yes | yes |
| `special` | 1 special ticket | any special edge (1 edge) | `special` | yes | no (0 tickets) |
| **on foot** | 1 foot step | 1 street-following (taxi-tier) edge | `foot` | yes | yes |
| **scooter** | 1 scooter charge | **2** consecutive street-following edges | `scooter` | yes | no (0 charges) |

Only `underground` and `special` may cross blocks (R4). Everything a player can choose is one row of this table.

### 4.1 Starting budgets — MVP defaults pending playtest

| Resource | Fugitive | Each Agent | Refill |
| --- | --- | --- | --- |
| taxi tickets | 8 | 10 | none |
| bus tickets | 4 | 5 | none |
| underground tickets | 3 | 3 | none |
| special tickets | 2 | 0 | none |
| foot steps | 8 | 6 | none |
| scooter charges | 3 | 0 | none |
| **total non-scooter moves** | **25** | **24** | — |

Twenty-four turns, one move per turn: the Fugitive has 25 paid-or-free moves for 24 turns (just enough, one to spare) and each Agent exactly 24. Nobody runs dry by accident; they run dry of the *fast* tiers. The Fugitive's fast budget is 4 bus + 3 metro + 2 special = **9 network moves** against 16 for two Agents. That asymmetry is the game: the Fugitive must spend fast moves to break the net, and each one narrows where they can be.

These values replace `PROVISIONAL_FUGITIVE_STARTING_TICKETS` and `PROVISIONAL_AGENT_STARTING_TICKETS` (appendix C, Q1) — but keep those names until the director ratifies the values into `GAME_VISION.md` §3.

**Ticket refills: none.** One purse per mode, spent once. **Rejected:** scheduled refills at the pulses (turns 8 and 16). Failure: a refill turns the ticket clock — the only pressure that forces a Fugitive out of a safe corner — into a formality, and it erases the Agents' bus/metro starvation, which is their one real cost. **Rejected also:** refill a mode only when it hits zero, which rewards deliberately dumping a mode and is strictly more generous than never refilling.

**When a mode is exhausted:** it is simply not a legal move any more. The log names the mode chosen, so both sides see exhaustion — no hidden bookkeeping. An Agent out of bus and metro cannot follow the Fugitive across the map, which is the Fugitive's designed window. When *everything* is exhausted, including foot steps, see §10.

---

## 5. On foot — the trail decision (director priority #2)

**Decision: on foot DOES leave a trail. Every on-foot move appends a public log row `mode: 'foot'`.**

- **F1.** A foot move costs one *foot step*, not a ticket; steps do not refill. Foot is a **reserve**, not a second economy. Free unlimited foot would destroy the ticket clock — the player would simply never pay.
- **F2.** It traverses exactly one **street-following** (taxi-tier) edge; never bus, metro or special.
- **F3.** One foot move per turn, like every other option.
- **F4.** **Log invariant:** the public log has exactly one row per living Fugitive per turn — a move row (`taxi`/`bus`/`underground`/`special`/`foot`/`scooter`) or a forced `hold`. There are no silent turns. This is a test, and it is why the Agents' deduction is a search rather than a guess.

**Justification.** Silence is worth more than money. Silent foot would be strictly the best move whenever a street edge existed: free *and* invisible. Two things break. The mode choice degenerates — walk always, pay only when forced — so taxi and the tier-exhaustion logic go dead. Worse, the Agents' candidate set gains an unbounded silent branch: "they could have walked any street edge and we are not told that they did." The set then grows with street degree instead of being pruned by a named mode, and human deduction inside a 5–10 minute mobile session stops being tractable. A logged foot move is a **deliberate disclosure**: the Fugitive saves a ticket and tells the Agents they spent a turn on the slow network. That is a real trade, it keeps F4, and it makes running out of tickets *dangerous* rather than *invisible*. This also settles the open item in `VISUAL_DIRECTION.md` §3 ("is on-foot a `TransportMode` or a separate concept?").

**Rejected:** silent foot (free stealth). Failure: an unconstrained candidate branch per turn makes deduction unfalsifiable noise, and foot dominates every paid mode. **Rejected:** log foot as `'unknown'`. Failure: it destroys the mode information the log exists to carry, imposes no cost on the Fugitive, and burns the `'unknown'` value that `LoggedTransport` reserves for the (cut) counterfeit-identity concept. **Rejected:** unlimited free foot, still logged. Failure: the ticket clock disappears, the turn limit becomes the only end condition, and the Fugitive's whole strategy is "walk in a loop" — the Agents cannot starve them out, so Agent wins reduce to pulse luck.

---

## 6. Electric scooter

**Decision: the scooter buys tempo with visibility. One charge moves the Fugitive up to two consecutive street-following edges in one turn, appends the log row `scooter`, and immediately reveals the Fugitive's exact ending node to all Agents (`RevealReason: 'scooter'`). Fugitive: 3 charges per Yard. Agents: 0.**

| Want | Pay with | Option |
| --- | --- | --- |
| Reach the bus/metro network | a scarce ticket | `taxi` / `bus` / `underground` |
| Move quietly, spend little | one of 8 foot steps | on foot |
| **Move twice in one turn, now** | **your exact position** | **scooter** |

**It competes with `taxi`.** Taxi is the quiet, ticket-priced, network-reaching one-edge move; the scooter is a loud, free, street-locked two-edge burst. It also competes with on-foot, but not as a replacement: it does not consume foot steps, which is exactly why it must cost something other than budget — and that something is information. Because the endpoint is revealed but the intermediate node is not, the Agents learn "the Fugitive is at X and passed through one of X's street neighbours" — a strong narrowing. So the scooter is used to **break a closing net** (Agents positioned for a one-edge move) or to **reach a pulse turn somewhere unexpected**, not as routine travel.

**Rejected:** two edges for one charge, logged as `scooter`, no reveal. Failure: that is on-foot with double tempo for free, so foot is dead on any turn a charge exists and taxi is dead in the common case; the map collapses to "ride whenever charged, walk otherwise". **Rejected:** scooter as a fourth purchasable ticket tier. Failure: another currency in the same purse with the same texture, a line added to a table rather than a decision — and a ticket for two edges is a strictly stronger bus. **Rejected:** Agents get charges too. Failure: two Agents with a burst each box a revealed Fugitive with no counterplay. If playtest shows the Fugitive winning too often, Agent charges (2 each) are the *second* knob to turn, after the pulse interval (§14).

---

## 7. Turn structure and phase order

A Yard is 24 turns, numbered 1…24. Each turn resolves these phases in this exact order:

1. **`yard-start`** — turn counter increments (once per Yard on turn 1).
2. **`fugitive-phase`** — each living Fugitive, in seat order, submits one move (`mobility` + `to`). Validate (§4, R1), spend tickets or step charges, append the log row immediately. **No capture is ever evaluated here.**
3. **`reveal-pulse`** — resolves if this is a pulse turn (§8), or if a scooter move happened this phase. Positions become public *before* the Agents move.
4. **`agent-phase`** — each Agent, in seat order, submits one move under the same validation and spend rules.
5. **`capture-resolution`** — one capture test over all Agents and living Fugitives, on **end positions only** (§9).
6. **`yard-end`** — if turn 24 completed, or the last living Fugitive was captured, the Yard ends (§11); otherwise back to step 1.

**The pulse is before the Agent phase, deliberately.** The existing `Phase` union lists `reveal-pulse` after `capture-resolution`; this spec moves it earlier. If the pulse resolved at end of turn, the Agents' first chance to act on it is the next turn — a full turn stale — and a capture on the pulse turn itself is impossible. Revealing immediately after the Fugitive moves makes the pulse a turn the Agents can actually play.

**Command model.** The only command a player submits is a move. A hold is never a command — it is the engine's forced resolution when no legal move exists (§10). A *voluntary* hold would let a Fugitive stall out the turn clock in a dense corner and win by surviving.

**Seat order is not a balance factor in MVP.** Nodes are uncapped (§9) and capture is a pure end-state test, so resolving Agent A before Agent B cannot change the outcome; seat order is for determinism only.

**Turn limit: 24 turns.** Matches the then-provisional `PROVISIONAL_YARD_TURN_LIMIT` and fits a mobile session; the M2 product spec owns the session-length argument. **Superseded 2026-10-16:** ratified as `YARD_TURN_LIMIT = 16` (see [`README.md`](README.md) §2); this proposal's 24-turn arithmetic is stale.

---

## 8. Reveal Pulse

**Schedule — MVP default pending playtest: turns 3, 8, 13, 18, 23.** First pulse on turn 3, then a fixed interval of 5 (matches the then-provisional `PROVISIONAL_REVEAL_PULSE_TURNS` plus `PROVISIONAL_REVEAL_PULSE_INTERVAL`, both since removed). The turn-23 pulse lands one turn before the limit — a deliberate final-turn beat. **Superseded 2026-10-16:** ratified as `REVEAL_PULSE_TURNS = [5, 10, 15]`; the separate interval constant was dropped as redundant.

**What it reveals, exactly:** for every living Fugitive, `{ fugitiveId, node }` as of the end of that turn's `fugitive-phase`, broadcast to every player permanently as a `RevealEvent`. **What it does not reveal:** tickets or steps remaining (with one Fugitive these are already derivable from the log, since every row names its mode), the next move, or any Agent intent.

**Scooter reveals** (§6) use the same event with `reason: 'scooter'` and resolve inside the `fugitive-phase`, not on the schedule; a pulse turn plus a scooter move can produce two reveals in one turn, the later superseding the earlier.

**Rejected:** no pulse, log-only deduction. Failure: the candidate set grows faster than a human can prune on a phone and the game becomes a spreadsheet; the pulse is the guaranteed reset that keeps deduction tractable. **Rejected:** a pulse every 3 turns. Failure: a 3-turn leash kills the escape value of the fast tiers, and Agents win by schedule rather than by inference.

---

## 9. Capture

- **C1 — The test.** At `capture-resolution`, if `agent.node === fugitive.node`, that Fugitive is captured (`CaptureKind: 'occupation'`). One test, once per turn, end positions only. No path-based or passing test exists.
- **C2 — Co-occupancy is uncapped.** Any number of players may occupy a node; occupancy is a set and capture is an equality test. Nodes never block movement. **Rejected:** a per-node capacity with a bump rule. Failure: a second movement rule layered on the first that needs its own ordering rule, and the original board game has nothing like it; equality is testable in one line.
- **C3 — Moving onto an occupied node is legal and can be a self-capture.** If the Fugitive moves onto an Agent's node and the Agent stays, C1 captures the Fugitive. The Fugitive is **not** forbidden from entering an Agent's node. **Rejected:** forbidding that move. Failure: a second capture-like code path, and Agents become movable walls — a different game.
- **C4 — Crossing / swap: no capture.** Fugitive at `X`, Agent at `Y`, adjacent. In the same turn the Fugitive moves `X→Y` and the Agent moves `Y→X`. At `capture-resolution` they are at `Y` and `X`: no co-occupancy, **no capture**. Same for an Agent moving onto the node the Fugitive just vacated. Paths are not part of the state — only nodes are — so a crossing rule needs history of who passed through what, and "who passed whom first" has no fair answer when players move in sequence. End-position capture is also what the original game does and is trivially replayable from the event log. **Rejected:** capture on a path crossing. Failure: ambiguous, needs path history in state, and produces captures the Fugitive cannot see coming or avoid.
- **C5 — Capture is evaluated on pulse turns too**, by the same test, only after the Agent phase. Never during the `fugitive-phase`.
- **C6 — Multiple Agents.** Two Agents on the Fugitive's node produce one capture event, same result; no "first Agent" credit.

**One Fugitive in MVP:** a capture ends the Yard immediately as `agents-win` (§11). Appendix C Q12 recommends the Yard continue after a capture; that applies only to the multi-Fugitive configuration. Records stay per-Fugitive, so 2 v 2 is not blocked later.

---

## 10. No legal move: the forced hold

A player has **no legal move** when every incident edge needs a ticket they do not hold, they have no foot steps left, and no scooter charge plus a two-edge street path.

**Rule:** the phase auto-resolves a **hold**. The player stays put and spends nothing; the log receives `hold` for a Fugitive (`mode: 'hold'`). A holding Agent produces no row, because the log is the Fugitive's trail only. A hold is never submitted as a command (§7); it is the floor of the system — `submitCommand` always has a defined resolution and the turn clock always advances.

**Trap-node requirement (map authoring, not a validator promotion).** A player out of everything at a node with no street-following edge would hold forever. So the MVP map must satisfy: **the street-following (taxi) subgraph spans every node.** The validator already *warns* about this ("taxi-only subgraph does not reach every node"); per `AGENT_RULES.md` a warning is never silently promoted to an error, so the MVP generator satisfies it as an authoring requirement and promoting it is an open question (§17).

---

## 11. Win and lose

| Outcome | Trigger | `YardResult` |
| --- | --- | --- |
| **Agents win** | A Fugitive is captured at `capture-resolution` (C1) | `agents-win` |
| **Fugitive wins** | The Fugitive is alive when turn 24 completes | `fugitives-extracted` |
| Abandoned | All human players left | `abandoned` — server concern, unreachable in MVP rules |

Exactly one win axis per side: no scoring, no points, no partial victory. The loop must be provably binary before a second axis is added.

**At the turn limit:** during turn 24 the Fugitive still moves and the Agents still move, and `capture-resolution` still runs. If the Fugitive is uncaptured, the Yard ends `fugitives-extracted` at `yard-end`. Turn 24 is a real turn, and the turn-23 pulse plus the turn-24 chase is the designed climax. **Rejected:** "uncaptured at the start of turn 24 is a win." Failure: the last turn's tension disappears and the turn-23 pulse becomes pointless.

---

## 12. Map size — MVP defaults pending playtest

| Metric | MVP value | Notes |
| --- | --- | --- |
| Stations (nodes) | **60** | hand-authored for the first playable, generated-and-tuned later |
| Node mix | 40 `street`, 14 `hub`, 6 `terminal` | bus/metro may not touch a `street` node — already a validator error |
| Edges | taxi ≈ 78, bus ≈ 16, underground ≈ 9, special 2 | ≈ 105 edges, average degree ≈ 3.5 |
| Street-following subgraph | = the taxi edges | must span all 60 nodes (§10) |
| **Blocks** [[MAP-ASSUMPTION]] | **60 blocks, 12 × 5 grid**, one station marker per block | if §1's research adopts a block model |

**Deduction budget (a testable constraint).** Logged modes narrow the Agents' candidate set by node eligibility — a `bus` row can only originate at a hub, a `metro` row only at a terminal, `foot`/`scooter` only on the street subgraph. Requirement: with the shipped map, the **median candidate-set size at the last turn before a pulse must be ≤ 12 nodes.** That must be a solver test over the real map, not a hope.

**Rejected:** 150 nodes (appendix C Q7's recommended default). Failure: on 60 nodes the set already saturates before the first pulse; at 150 it saturates in two turns, so between pulses the Agents are guessing and the game is decided by pulse luck. **Rejected:** 24 nodes: too small for the fast tiers or the scooter to have reach, so every decision is local and the pulse is redundant. The 600–900 figure in `VISUAL_DIRECTION.md` §1 is for a ~100-player city and is explicitly not the MVP scale (§1.1).

---

## 13. First playable (the smallest slice that is already fun)

**Hot-seat, one device, 1 Fugitive vs 1 Agent, 24-node map.** No server, no accounts, no rooms — pass-and-play with a "pass the phone" interstitial before the Fugitive's turn only.

In scope: the turn machine, taxi + underground + on foot with the §4 numbers, the public log with the F4 invariant, capture by occupation, pulses at 3/8/13/18, turn limit 24, both end screens. Out of scope: `bus`, `special`, the scooter, the second Agent, the server, persistence.

Why it is already fun: *move in secret → read a log row → prune → get one exact answer every five turns → close or break the net.* Those five elements are the game; everything else here is tuning or reach. If the first playable is not tense, no amount of bus network will make it tense.

---

## 14. Balance sanity check

**Why the Fugitive does not trivially win.** Every escape hatch is costed: foot is a finite 8-step reserve and is logged; each of 3 scooter charges publishes the exact node; the fast tiers total 9 network moves for the whole Yard. The map is 60 nodes against two Agents — the tight setting — and a pulse every 5 turns resets the Agents' uncertainty at a fixed cost to the Fugitive. Camping is a `hold` row, and the net only has to close once.

**Why the Fugitive does not trivially lose.** The Agents' fast budget is also finite (5 bus + 3 metro each) and is spent on *coverage*, not on the target: two Agents cannot be in two places, and every bus/metro row spent on the wrong half of the map is a turn the Fugitive keeps. The Fugitive moves first each turn, so an Agent's move always answers a position that has already changed. The scooter exists precisely to break a correctly built net.

**Residual risk, stated honestly.** Whether 2 Agents cover 60 nodes tightly enough is an arithmetic question this document cannot settle on paper. It is the first thing playtest must answer, which is why §13 is deliberately 1 vs 1: measure net-closing, not assume it.

**Target win rates — MVP default pending playtest: Agents 45–60%.** Outside that band, turn three knobs in order: (1) pulse interval (5 → 4 harder for the Fugitive, 6 easier); (2) Agent scooter charges (0 → 2 harder); (3) Fugitive foot steps (8 → 6 harder). The Agent count is the last resort, because it changes the product spec, not just a number.

---

## 15. If the map becomes block-based, what changes

Everything above is written against node-and-edge. If §1's research recommends blocks, these rules need revisiting — no others do:

1. **R1** becomes "positions are blocks; moves cross a shared boundary through a typed street edge". Movement through a block's interior is the new default and must be authored, not interpolated.
2. **R2/R5** become the block's internal street set: diagonal streets are fitted inside a block and the renderer draws a legal move through the block's own geometry. The invariant survives; its unit changes.
3. **§5 F2** (foot = one street-following edge) becomes "one street edge inside the block, or one boundary crossing on foot" — needs a re-decision.
4. **§6** (scooter = two consecutive street edges) becomes "two blocks' worth of street movement", which is where the block model is genuinely simpler.
5. **§9 C1** (capture = same node) becomes "same block" — the director's stated motivation. But co-occupancy then needs the capacity rule C2 deliberately rejects, so C2 must be re-argued, not carried over.
6. **§8** (pulse reveals an exact node) becomes "reveals a block" — strictly less precise, so the pulse interval and the §12 tractability budget both need re-tuning.
7. **§12** is already expressed in blocks; the node mix and the `street`/`hub`/`terminal` taxonomy become per-block properties.
8. **§10** (trap node) becomes a connectivity requirement on the block street graph.
9. **Unchanged:** the ticket economy, the log vocabulary and trail decision, the pulse schedule, the win conditions, the first playable, and the scooter's reveal cost — those are representation-independent, which is why they were decided first.

---

## 16. Specification impact on `game-core` (shape only)

- `MobilityOption = TransportMode | 'foot' | 'scooter'`. **Do not add `foot` or `scooter` to `TransportMode`**: it indexes edges and `TicketBag`, and widening it ripples into `TRANSPORT_MODES`, `affordableModes`, `createTicketBag` and the validator for no gain.
- `LoggedTransport = TransportMode | 'foot' | 'scooter' | 'hold' | 'unknown'`; add `RevealReason: 'scooter'`.
- New per-player counters `footSteps`, `scooterCharges` — keep them out of `TicketBag`, which is the four paid modes.
- `GraphEdge` gains a street-following flag and `geometry` so R5 is checkable.
- `Phase` reordered so `reveal-pulse` precedes `agent-phase` (§7).
- Rules needing named unit tests: R3 (no coordinate-derived adjacency), R5 (street-following edge leaves the street network), F4 (exactly one log row per living Fugitive per turn), C4 (a swap is not a capture), §10 (a player with nothing left holds rather than erroring).

---

## 17. Open questions for the director

Each with a recommended default.

1. **Promote the taxi-subgraph requirement to a validator error?** It is a structural trap, not a playability heuristic. *Recommend:* promote. **Until answered:** keep it a warning and treat it as a map-authoring requirement (§10).
2. **Do Agents get scooter charges?** *Recommend:* no for MVP; 2 each is the first balance knob if the Fugitive wins too often.
3. **Is the scooter's exact-position reveal too harsh?** It is the only thing stopping the scooter from being on-foot-with-double-tempo, but it may make the scooter dead in practice. *Recommend:* keep it for the first playtest and measure how often the scooter is used at all; the fallback is a plain `scooter` log row with no reveal.
4. **Ratify the §4.1 ticket and step numbers into `GAME_VISION.md` §3?** They live only as `PROVISIONAL_` constants. *Recommend:* ratify, so the economy stops being four guesses inside the engine.
5. **Does 60 nodes hold up, or does the MVP need the appendix's 150?** *Recommend:* build the first playable at 24 and the MVP at 60, and let the §12 tractability test decide whether 150 is ever needed.
6. **Confirm the 24-turn limit and the 3/8/13/18/23 pulse schedule.** Both are MVP defaults here and the M2 product spec owns session length. *Recommend:* confirm as-is, tune from playtest.
