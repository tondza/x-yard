# PROJECT_LOG.md

Append-only record of design decisions, state-machine revisions, and
architectural progress for X-Yard.

**Rules for this file:** never edit or delete an existing entry. Corrections are
new entries that reference the old one. Every entry is dated and states what
changed and *why*. Design decisions record the alternative that was rejected.

---

## 2026-10-15 — Bootstrap: monorepo, tooling, governance

**Done**

- Initialised a native pnpm-workspaces monorepo (deliberately **no** Turborepo or
  Nx, per the director's instruction). `pnpm-workspace.yaml` globs `apps/*` and
  `packages/*`.
- Created the four workspaces:
  - `apps/web` — Vite + React + Canvas 2D. Renders the board; no rules.
  - `apps/server` — Fastify + Socket.io. Owns authoritative state; no rules.
  - `packages/game-core` — pure TypeScript engine. `"dependencies": {}`.
  - `packages/shared-types` — wire DTOs. Types only, no runtime rules.
- Installed the root toolchain: `vitest@5`, `typescript@7`, `@types/node`.
- Wired the single mandated command: root `pnpm test` runs
  `pnpm -r --if-present run test`, so every package that defines a `test` script
  is enrolled automatically.
- Seeded the engine with its foundation: domain types, xorshift128+ RNG, transit
  graph + validator, ticket economy, and a scaffold board. 79 tests passing.
- Verified end-to-end: `pnpm install`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` all exit 0; the server boots and serves `/health` and `/board`.

**Decisions**

1. **Vitest is a root devDependency only.** `packages/game-core` declares no
   devDependencies at all, which keeps the purity rule trivially auditable.
   Verified that a package with no `node_modules` still resolves `vitest` from
   the root by Node's upward resolution. **Rejected:** per-package vitest, which
   would put a tool dependency inside the package the director wants pristine.
2. **Workspaces are consumed as TypeScript source** (`"main": "./src/index.ts"`)
   rather than built to `dist`. For a solo, low-budget project this removes an
   entire build-orchestration layer. Consequence: the apps' tsconfigs set
   `noEmit` and omit `rootDir`, because a `rootDir` rejects files pulled in from
   sibling packages (TS6059). **Revisit** if we ever publish a package.
3. **`shared-types` imports its vocabulary from `game-core`** instead of
   re-declaring `TransportMode`, `Role`, and `MatchResult`. This creates a
   type-only dependency `shared-types → game-core`. **Rejected:** duplicating the
   unions, which would let the wire protocol silently drift from the rules — the
   exact failure mode the governance files exist to prevent. Invariant kept:
   `game-core` never imports `shared-types`.
4. **The demo board satisfies every applicable `validateGraph` invariant.** The
   validator was not weakened to accept a small fixture. Reaching a mean degree
   of 4.5 requires at least 8 nodes, so the fixture is 8 nodes / 20 edges
   (16 taxi, 3 bus, 1 underground), which passes connectivity and the degree
   distribution honestly.
5. **The RNG API is pure functions over an explicit state**, not a closure.
   GAME_VISION.md §2 requires `rngState` to live inside `GameState` so replay can
   reconstruct it from the log; a stateful closure would hide the very state that
   must be serialised. Golden vectors are locked in `rng.test.ts`.

**Environment findings (measured, not assumed)**

- `$HOME` is read-only in the agent sandbox, so pnpm's default store and cache
  are unwritable and every install fails with `EROFS`. Fixed with a committed
  `.npmrc` redirecting `store-dir`/`cache-dir` into the repo (git-ignored).
- `/tmp` is a **fresh tmpfs on every shell invocation**. Nothing durable may be
  staged there. Recorded in AGENT_RULES.md §5.
- pnpm 12 blocks dependency build scripts and exits non-zero
  (`ERR_PNPM_IGNORED_BUILDS`). Fixed declaratively with
  `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`. Note the key is
  pnpm 12's `allowBuilds`; the older pnpm 10 spelling is `onlyBuiltDependencies`.
- There is no root: the sandbox sets `NO_NEW_PRIVS`, which disables setuid, so
  `sudo` cannot work and `apt-get` is unavailable. Toolchains must install into
  the workspace.

**Deviations from GAME_VISION.md (deliberate, to be reconciled)**

1. **Module layout.** The spec cites `src/types/graph.ts` and
   `src/map/generate.ts`. The code currently uses flat modules (`types.ts`,
   `graph.ts`, `tickets.ts`, `rng.ts`, `demo-board.ts`). Names and shapes inside
   match the spec; only the file split differs. To be revisited when the state
   machine lands.
2. **`demo-board.ts` is not the shipped map.** GAME_VISION.md §4 specifies
   *Meridian Central* (156 nodes, 438 edges, 4096×3072) checked in as JSON. The
   scaffold fixture exists so the server, the canvas, and the validator can be
   wired end-to-end first.
3. **Invariant 8 is not enforced.** The "cache-candidate pool ≥ 40" check is
   map-scale; it is reported as a warning on small fixtures and must be enforced
   when the real map lands.
4. **Spec §4's "each underground line is a simple path" is not enforced.** The
   graph model has no line/route-group identity, so the check has nothing to
   read. Needs a `line` field or a separate lines table.
5. **A `spec-alignment.test.ts` was added** that the spec does not list. It locks
   the spec's economy and contract numbers so code cannot drift from the spec
   silently.

**Not yet started (tracked so it cannot be forgotten)**

- `GameState`, `submitCommand`, `applyEvent`, and the phase machine (§2).
- `hashState` and `replay` — the replay oracle (§8).
- `projectState` — secret projection on the wire (§8). Until it exists, **no
  server code may send `GameState` to a client.**
- Caches, pins, ledger, black tickets, shadow steps, captures, contracts as
  runnable scenarios.
- Postgres persistence, reconnect/resume, spectating (§7).
- Playwright and the 90% coverage gate (TESTING_STRATEGY.md §6).

**Open questions for the director**

Carried into `GAME_VISION.md` §10; not resolved by this bootstrap.

---

## 2026-10-15 — Vision replaced: asymmetric MMO pursuit

**Context**

The product director replaced the game vision. The previous brief is
**superseded in full** and the old entry above is retained only as history.
`GAME_VISION.md` now describes an asymmetric MMO pursuit game: multiple
**Fugitives** (collectively "Subject X") versus **Agents**, in isolated game-room
instances called **Yards**, designed to scale to ~1,000 parallel players. Code,
tests, and the other governance files were refactored to match it.

**Withdrawn — do not reintroduce without a new director decision**

- the single hidden player "Mr. X" and the role names `mr-x` / `detective`
  (replaced by plural **Fugitives** / **Agents**; roles `fugitive` / `agent`);
- public **cache nodes** as a second win axis (replaced by contraband missions and
  Safe House extraction);
- the fixed `cold-drop` / `blitz` / `marathon` / `tutorial` **contracts** and the
  24-round match (replaced by the multi-Yard instance model);
- **black tickets** (double move) and **shadow steps** (free taxi leg) (replaced by
  Fugitive gadgets: Decoy Ping, Counterfeit Identity, Alleyway Sprint);
- scheduled **ticket refills** at R8/R12/R16/R20 (replaced by "tickets never
  refill mid-Yard", a provisional default — GAME_VISION.appendix.md Q1);
- the **`ferry`** transport mode (replaced by **Special Transport / Alleyway**,
  `special`);
- the **accusation** mechanic;
- "round" and "match" terminology, and the grid-coordinate authoring scale
  (4096×3072 Meridian Central) — map scale is now undefined (GAME_VISION.appendix.md Q7).

**Refactor performed**

- **Vocabulary rename.** `TransportMode` is now
  `taxi | bus | underground | special`; `Role` is `fugitive | agent`; identifiers
  renamed throughout `types.ts`, `graph.ts`, `tickets.ts`, `demo-board.ts`,
  `index.ts`, `shared-types`, and the server. `YardId`, `YardResult`, `Phase`,
  `CaptureKind`, `RevealReason`, and `LoggedTransport` entered the domain. Time is
  measured in turns; a game room is a Yard.
- **Special transport replaces ferry.** `special` is a first-class tier (secret or
  specialised links usable with gear). It is exempt from node-class eligibility:
  an alleyway or boat link may attach to any node.
- **Facilities added to nodes.** `GraphNode.facilities` carries
  `'black-market' | 'safe-house'`, and `nodesWithFacility` exposes them.
  `validateGraph` **fails** a map with no Black Market or no Safe House, because
  Fugitives could otherwise neither accept contraband runs nor extract (§4).
- **Mission, gadget, and skill vocabulary added (types only).** `ContrabandRun`,
  `RiskTier` (light/heavy/arms), `MissionId`, `Facility`, `Gadget`, `AgentSkill`,
  `GADGETS`, `AGENT_SKILLS`, and `SENSOR_SWEEP_RADIUS = 2`. No mission lifecycle,
  payout, or skill resolver is implemented yet.
- **Refill schedules and contracts deleted.** `startingTicketsFor(role)` now reads
  provisional per-role bags and no refill path exists; ticket-log rows are tagged
  by turn, not round.
- **Ticket-log semantics for the two log-attacking gadgets.**
  `ticketLogEntry(turn, fugitiveId, mode, concealment)` returns `'unknown'` for
  Counterfeit Identity and `null` (no ticket, no trail) for Alleyway Sprint. This
  is the single place the rules for what Agents may see are encoded, so a detector
  and the server cannot disagree.
- **Graph validation split into errors vs warnings.** Requirements the brief
  states are errors; provisional playability heuristics (degree bounds, mean
  degree, taxi-only reachability, node spacing) are warnings and `createGraph`
  rejects only on errors.
- **The `PROVISIONAL_` convention.** Every number the brief does not state is now
  exported under a `PROVISIONAL_` name with an appendix cross-reference
  (ticket bags, reveal-pulse turns and interval, turn limit, mission payouts,
  logoff grace, seat counts, heavy-cargo restriction, arms noise-ping cadence).
  `grep -rn PROVISIONAL_` is the complete inventory. `NodeClass`
  (`street`/`hub`/`terminal`) is likewise a provisional taxonomy from Q7.
- **New alignment test.** `spec-alignment.test.ts` locks the brief's stated facts,
  the `PROVISIONAL_` naming convention, and the absence of the withdrawn
  vocabulary. Its withdrawn-vocabulary guard exists specifically so the old design
  cannot creep back: any `MR_X_*` / `DETECTIVE_*` / contract / cache export, or a
  `ferry` mode, now fails the suite instead of passing review.

**Decisions**

1. **Rename in place, no compatibility aliases.** The withdrawn names were removed
   from types, exports, and prose. **Rejected:** keeping `mr-x` / `detective` /
   `ferry` aliases for a transition period — aliases keep the withdrawn design
   alive in the public API and make the guard meaningless.
2. **`special` replaces `ferry` rather than sitting beside it.** One secret-link
   tier covers Alleyway Sprint and Boat. **Rejected:** retaining `ferry` as a fifth
   mode, which would preserve a withdrawn concept and split identical semantics.
3. **Facilities are node fields and a validation error.** **Rejected:** a separate
   facilities table, and a cache-node-style separate entity — both allow a board to
   validate while being unplayable, which is the failure the old cache design had.
4. **Add mission/gadget/skill vocabulary now, lifecycle later.** Types plus the
   stated constants landed; behaviour did not, so the wire and the engine share one
   vocabulary. **Rejected:** deferring all naming until the turn machine exists
   (guarantees a large mechanical rename later) and implementing mission
   resolution now (the brief states the framework, not the lifecycle).
5. **Delete contracts and refills outright.** **Rejected:** keeping the
   `cold-drop`/`blitz`/`marathon`/`tutorial` set as optional scenarios, which the
   director withdrew, and inventing a replacement refill schedule with no brief
   basis.
6. **Encode concealment in `game-core`, not the wire.** **Rejected:** letting the
   server decide what to redact per message, which would duplicate the rule and let
   the deduction surface drift.
7. **Two validation channels.** **Rejected:** one undifferentiated problem list
   (a provisional heuristic could block a valid map) and promoting every heuristic
   to an error (would make the real map unshippable on numbers nobody ratified).
8. **`PROVISIONAL_` prefix per constant, not a central defaults object.**
   **Rejected:** inline magic numbers (invisible to grep) and one `DEFAULTS` map
   (grep reports one symbol, not the individual unratified numbers).
9. **A dedicated alignment test.** **Rejected:** relying on code review and prose,
   which had already failed to stop drift in the previous vision.

**Verification (measured)**

- `pnpm install`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all exit 0.
- 4 test files, 83 tests, all passing: `rng.test.ts` (20), `graph.test.ts` (33),
  `tickets.test.ts` (21), `spec-alignment.test.ts` (9).
- `apps/server` boots and serves `/health` and `/board`; it rejects every game
  message explicitly as "not implemented".
- `packages/game-core` still declares `"dependencies": {}` (zero runtime deps).

**Not yet started (tracked so it cannot be forgotten)**

- The turn/phase machine: `GameState`, `submitCommand`, `applyEvent`, and the
  Fugitive Phase → Agent Phase → Capture Resolution sequence (§2).
- Capture Resolution (occupation arrest) and end-of-Yard handling.
- Reveal Pulse scheduling and Decoy Ping falsification.
- Mission lifecycle: accept at a Black Market, deliver, payout, risk-tier side
  effects (heavy restricts transport, arms emits noise pings).
- Gadget and Agent-skill resolution (Targeted Roadblock, Sensor Sweep, Rapid
  Deployment).
- Safe House Extraction logging and the AI shadow decoy left by logging off
  elsewhere.
- `hashState` and `replay` — the replay oracle.
- `projectState` — secret projection on the wire. Until it exists, **no server
  code may send `GameState` to a client.**
- Persistence, reconnect/resume, spectating, multi-Yard instance management, and
  matchmaking.
- Playwright and the 90% coverage target (TESTING_STRATEGY.md §6).

**Open questions for the director**

Recorded in the `GAME_VISION.md` appendix (Q1–Q12) with recommended defaults; none
is director-approved. The provisional constants above are the code's encoding of
those recommendations.

---

## 2026-10-15 — Design exploration round 1: look-and-feel moodboard

**Done**

- Produced four deliberately different art directions for the same game screen, so
  the director can steer by example rather than by description. Living in
  `design/moodboard/`:
  - **A Transit Diagram** — light, Swiss, functional; unknowns drawn as a
    quantitative heatmap.
  - **B Night Ops / Surveillance** — dark, technical; unknowns drawn as radar
    range rings, contact blips and a growing search radius.
  - **C Paper Dossier** — warm, analog, noir; unknowns drawn as pencil hatching,
    circled nodes and torn notes.
  - **D Neon Metro** — saturated, competitive; unknowns drawn as decaying ghost
    trails and probability halos.
- Every mockup renders the **same** board and state (same 8-node/21-edge graph,
  turn 6/24, pulse fired T3 / next T8, F1 revealed, F2 and F3 hidden, the same
  five ticket-log rows, the same 40/25/20/15% spread) so only the art direction
  varies. Each is one self-contained HTML file with no external assets.
- Added `design/moodboard/index.html` (side-by-side contact sheet with the decision
  list) and `README.md` (what is compared, the ten open look-and-feel questions,
  known gaps, and how to regenerate the images).

**Decisions**

1. **Four genuinely different directions, not four variants.** A moodboard whose
   options share a palette teaches the director nothing. **Rejected:** showing one
   direction in four colour schemes.
2. **One shared game state across all four.** Otherwise a difference in perceived
   clarity could be caused by different content rather than different design.
3. **The hidden-information treatment is treated as the primary axis**, because
   rendering what the Agents do not know is this game's defining UI problem. Each
   direction solves it differently and deliberately.
4. **Design artifacts live outside the pnpm workspace** (`design/` is not matched
   by `apps/*` or `packages/*`), so `pnpm test`, `pnpm typecheck` and `pnpm build`
   cannot be affected by or slowed by them.
5. **Screenshot tooling is isolated and git-ignored** (`.tools/screenshot/`,
   `.playwright-browsers/`, `.chromium-libs/`, `.apt/`). Chromium's system
   libraries are absent from this image and cannot be installed without root, so
   they are unpacked locally and reached via `LD_LIBRARY_PATH`. **Rejected:**
   adding Playwright to the project's dependency graph for a screenshot job.

**Verification**

- All four mockups measured at exactly 1280×720 with **zero overflow in either
  axis** and **no page or console errors**, checked mechanically by
  `.tools/screenshot/shoot.mjs` rather than by eye. Four real layout defects were
  found and fixed this way (A's transport legend clipped below the fold; B's
  clipped telemetry readout; C's 39px horizontal overflow plus label collisions;
  D's text pile-up and two skill buttons clipped invisibly inside an
  `overflow:hidden` panel).
- `pnpm typecheck` and `pnpm test` still pass (4 files, 83 tests) — the design
  round touched no package.

**Status: awaiting director feedback.** No look-and-feel decision has been made.
The ten questions are listed in `design/moodboard/README.md` §3 and repeated on the
contact sheet. Whatever is decided should land in a new `VISUAL_DIRECTION.md` and
then in `apps/web` — not in this folder, which is exploration.

---

## 2026-10-15 — Design exploration round 2: the city, and ten director decisions

**Director feedback that forced this round**

- Round 1's mockups **failed a fundamental test**: none represented the feel of the
  board game, where "the actual environment where everything is happening is a city
  environment". They drew the *graph*, not the *place*. The director supplied a
  photograph of the Scotland Yard board as the reference for the target: a dense
  illustrated city map (~200 numbered stations, coloured taxi/bus/metro lines,
  character pins on a real cityscape).
- Requirements added: modern and slightly cartoonish, **top view, no 3D**; a
  **SimCity 2000 vibe** with animation; **characters as animated icons**; maps
  **much larger** — at least **100 players on one city**; and a new **on-foot**
  movement option for much greater freedom of movement.

**Ten decisions recorded** (full detail in [`VISUAL_DIRECTION.md`](VISUAL_DIRECTION.md))

Settled: hybrid route display (city + numbered stations, route lines only for the
selected character's legal moves) · **on-foot is node-to-node along street edges,
and free** · ~600–900 stations per ~100-player city, procedurally generated then
hand-tuned · hidden Fugitives are **viewer-dependent** (own icon for the Fugitive,
ghosts and probability for Agents) · SimCity rooftops and palette plus a day-night
living-city feel, but **no 1990s beveled UI chrome** · ambient pedestrians and cars
**deliberately minimal** · animation priority is characters then day-night ·
**fictional** cities inspired by real ones · mockups must show **both** a zoomed
view and a full-city overview.

Deliberately **deferred to the mockups**: art style, and perspective.

**Decisions and rejected alternatives**

1. **Round 2 is a controlled comparison, not four proposals.** The same fictional
   city (Yard-Meridian), the same 24 stations and the same game state are held
   constant, and only style and perspective vary — so that E vs F isolates
   perspective, and F vs G isolates style. **Rejected:** letting each mockup invent
   its own city, which would make a style difference indistinguishable from a
   layout difference.
2. **On-foot stays node-to-node.** This was the deciding argument, and it is worth
   preserving: free-form continuous movement would have invalidated the capture
   rule ("occupying the exact node"), ticket-log deduction, and replay. The
   node-based option keeps the entire deterministic engine.
3. **Only mockup A survives from round 1**, as the HUD and information-design
   reference. **Rejected:** keeping B/C/D, which are the same abstract-node idea in
   different palettes.
4. **Round 1 was archived, not deleted** — into
   `design/moodboard/round-01-abstract-nodes/`. Design history is preserved without
   cluttering the current round.
5. **`VISUAL_DIRECTION.md` was created rather than editing `GAME_VISION.md`.** The
   director-authored §1–§6 prose is left untouched; the new file records the
   answers and is explicitly authoritative to *refine*, never to override, the
   vision. **Rejected:** rewriting the director's brief on my own initiative.
6. **`shoot.mjs` was made recursive** so each round's mockups are discovered and
   rendered automatically instead of needing the script edited per round.

**New consequences surfaced for the engine and server** (recorded in
`VISUAL_DIRECTION.md` §2 so a later session does not trip over them)

- On-foot becomes a **fifth movement option**, but `TransportMode` currently has
  four values and does not include it — an open implementation detail, and possibly
  a balance lever, since an on-foot move presumably leaves no ticket trail.
- ~600–900 nodes × ~100 players forces **WebGL rendering** (Canvas 2D will not
  hold) and **spatial interest management** on the server. The latter is not only a
  performance fix: it enforces hidden-Fugitive secrecy for free, because you cannot
  leak state you never send.
- **Procedural map generation is now a deliverable**, not a nice-to-have.
- "Every Yard must contain a reachable Fugitive" becomes a **matchmaking/spawn
  invariant that needs a test**, per the director's ratio requirement.
- Ambient pedestrians and cars are a **legibility risk**, not just an art task.

**Status: awaiting mockup review** to settle art style and perspective.


---

## 2026-10-16 — Governance architecture: entry point, enforced invariants, durable records

**Context**

The governance *content* was strong but its information architecture was not. 63 KB
of root documents had to be read in full or not at all, because DSH auto-loads only
`AGENTS.md`/`CLAUDE.md` and this repository had neither. Nothing checked the
documents, so claims had already drifted: three files cited a `GAME_VISION.md §8`
that no longer existed after the vision was replaced, and four documents asserted
"4 test files, 83 tests" while the suite had grown.

**Done**

- **`AGENTS.md` added at the root and in `packages/game-core/`.** The root file is
  a router (non-negotiables, authority order, a "what to read when" table,
  environment facts, verification) and the nested one carries the engine's purity
  and determinism contract. Both are now injected automatically before a session's
  first request; the nested one loads when a session first touches the engine.
- **`GAME_VISION.md` split at the authority boundary** into the director-authored
  brief (§1–§6) and `GAME_VISION.appendix.md` (derived A–C). All cross-references
  updated.
- **`docs/lessons.md`** — seven measured environment facts in
  symptom → cause → fix → *enforced by* form, so the next session checks there
  instead of rediscovering the read-only `$HOME` or the `allowBuilds` requirement.
- **`docs/status.md`** — current state, edited in place, so re-entry does not
  require scanning an append-only log.
- **`docs/decisions/`** — nine records in the house format whose most valuable
  field is the *rejected alternative*; extracted from this log so a single decision
  is addressable without reading a whole round.
- **`.dsh/skills/`** — two discovered-on-demand skills: a governance pre-flight
  check and a decision-record how-to. They cost no context until loaded.
- **`docs/briefs/_TEMPLATE.md`** and **`archive/README.md`** — the delegation-brief
  format that made round 02 work, generalized, and the archive convention, whose
  `WHY_SUPERSEDED.md` requirement `check:docs` enforces.
- **Enforcement, which is the actual point:**
  - `architecture.test.ts` (5 tests) locks `game-core`'s zero-dependency contract,
    forbids framework/Node/`shared-types` imports, and bans `Math.random`,
    `Date.now`, `performance.now`, `new Date`, and `require()` in engine source.
  - `scripts/check-docs.mjs` fails on dead relative links, stale documented test
    counts, and dangling `GAME_VISION.md §N` references.
  - Vitest's JSON report is the single source of truth for test counts, so
    `check:docs` verifies the documents against a real run rather than a hand count.

**Decisions**

1. **Split the appendix into its own file rather than keep one document with a
   banner comment.** **Rejected:** relying on an HTML comment for authority, which
   is what the §-reference rot already disproved. Full record:
   [0009](docs/decisions/0009-derived-appendix-split-from-the-brief.md).
2. **`game-core`'s `types: []` was widened to `["node", "vitest/globals"]`.** The
   architecture test needs `node:fs`/`node:path`/`node:url` to scan the engine's own
   sources, and `AGENT_RULES.md` §9 forbids `.js` source files, so a JavaScript
   check was not an option. The purity rule is about *runtime imports*, and
   `architecture.test.ts` enforces exactly that — the tsconfig change does not
   relax it.
3. **Documented counts are verified, not trusted.** **Rejected:** hand-maintaining
   the numbers, which is precisely how they drifted to "83 tests".
4. **`PROJECT_LOG.md` is exempt from count checking.** It is append-only, so an old
   entry claiming "83 tests" was true when written; correcting it is forbidden.
   Living documents are checked, history is not.
5. **`game-core` runs `vitest run --no-isolate`.** Measured: ~0.9–1.1 s → ~0.28 s.
   Safe because every suite is a pure-function test with no cross-file module
   state. **Rejected:** `isolate: false` globally in the root config, which would
   silently apply to suites that have not established that property.

**Corrected during this work**

The architecture test's `Map`/`Set` rule was nearly written as a blanket ban. The
engine legitimately uses `Map`/`Set` for transient computation (adjacency maps in
`graph.ts`); only *state* is banned. A blanket check would have been a false
invariant, so the real serialization oracle is explicitly deferred, with its
replacement test named, until `GameState` exists.

**Verification (measured)**

- `pnpm test` — 5 files, 88 tests, all passing, ~0.24 s.
- `pnpm typecheck` — every workspace exits 0, including the four apps and packages.
- `pnpm check:docs` — 29 markdown files scanned; all links resolve, all counts
  current.
- `pnpm check:docs` caught, in the act of writing them: a wrong relative path in
  `archive/README.md`, a `§8` reintroduced by decision 0009 while describing the
  §8 rot, and both skills' links being one directory too shallow.

**Not yet started (tracked so it cannot be forgotten)**

- `withdrawn-vocabulary.ts` as a single exported source of truth for appendix B,
  replacing the hardcoded array in `spec-alignment.test.ts`.
- The state-serialization oracle (`JSON.parse(JSON.stringify(state))` equality and
  `hashState(replay(init, log))`), once `GameState` exists.
- The first real `archive/` entry. `design/moodboard/round-01-abstract-nodes/` was
  considered and **deliberately left in place**: `design/` is already the archive
  for design history, the round is already marked superseded with its reasoning
  recorded, and moving it would add link churn without adding information. The
  concrete future entry is `packages/game-core/src/demo-board.ts` when the real map
  lands.
- Wiring `pnpm verify` into any CI, and Playwright behind `pnpm test:e2e`.

---

## 2026-10-16 — Round 03 opens: MVP scope, map representation, mobile-first

The director reviewed the four city mockups (E–H) and reset the project's centre
of gravity from *vision* to *viable minimum*.

**Director feedback**

- **Style narrowed to two:** F (flat vector, 2.5D tilt) and H (painterly, pure
  top-down, night). Pixel-art (G) is out. Both are liked *together with their own*
  perspective, so neither axis is settled on its own.
- **The fog in H questioned.** Read as an implied visibility mechanic.
  **Investigated and confirmed decorative:** H draws three `gFog` ellipses at
  opacity .55–.70 that no game state drives. Recommendation recorded — remove it,
  or reduce to a vignette; real fog-of-war must be data-driven.
- **Diagonal movement lines rejected.** *"Movement lines drawn diagonally over
  buildings and streets ... it should not be possible! Possible movement paths
  should mostly follow streets!"* Only genuine off-street modes may cross blocks.
- **Block/square field proposed.** A block-based field with a parallel coordinate
  system, so occupancy per square and the "same square?" capture test are
  unambiguous, with diagonal streets fitted inside a square block. The director
  asked for this **researched**, not assumed.
- **MVP, not vision.** The existing breadth (gadgets, agent skills, contraband,
  safe houses, ~100 players) is "good and visionary" but not MVP. Stay close to the
  original Scotland Yard; **on foot** and **electric scooter** are the named extras.
- **Mobile-first and minimum UI.** Mockups are rejected as a UI starting point —
  "the most complex possible game screen with lots of modal windows". Mobile is
  primary; desktop is the later enhancement.

**Decisions**

1. **Legal-move paths follow the street network.** **Rejected:** straight
   origin-to-destination lines — the exact defect the director saw, which renders
   travel the city geometry forbids. Recorded as
   [0010](docs/decisions/0010-legal-moves-follow-streets.md).
2. **The map-representation change is gated on research.** Node-and-edge stays
   authoritative meanwhile. **Rejected:** adopting blocks immediately on the
   director's suggestion — they asked for research precisely because they are
   unsure, and the migration would touch the validated graph, ticket economy, RNG
   determinism and the test suite.
3. **Style shortlist recorded, not closed.** **Rejected:** declaring a winner from
   the existing desktop-oriented, panel-heavy mockups, which depict a game we have
   now decided not to build first.
4. **The game-rule half of the street rule is left for the director to promote**
   into `GAME_VISION.md` §2/§3, since that brief is director-authored.
   **Rejected:** editing the director's brief on my own initiative.

**Work opened (delegated, three parallel briefs in `docs/briefs/round-03-mvp-and-map.md`)**

- **R — map system research**, `docs/research/round-03-map-system.md`: node-and-edge
  vs block/square, with migration cost, a comparison table, and a recommended
  rejected alternative.
- **M1 — MVP rules**, `docs/mvp/round-03-rules.md`: turn structure, ticket economy,
  reveal schedule, capture including swaps, on-foot and scooter trade-offs, win
  conditions, explicit cuts, and a "first playable" definition.
- **M2 — MVP product**, `docs/mvp/round-03-product.md`: mobile-first minimum screen
  set, portrait layout, hidden-information presentation on a small screen,
  onboarding, accessibility, and the desktop enhancement path.
- **V — validator**, `docs/mvp/round-03-validation.md`, to run after the three:
  three concrete turn-by-turn transcripts, a verdict, and prioritised fixes.

**Verification**

- `pnpm verify` exit 0 and `pnpm test` 5 files / 88 tests, re-measured at the start
  of this round after the governance-consolidation commits (`7e3da2e`, `0ed23cb`).
- An earlier observation in this session that `pnpm typecheck` failed has been
  **superseded**: the governance round widened `game-core`'s `types` to
  `["node", "vitest/globals"]`, with the reasoning that purity concerns *runtime*
  imports and `architecture.test.ts` enforces that contract directly. That argument
  is sound and the repo is green; the suggested alternative (moving the check out of
  the package) is not needed.

---

## 2026-10-16 — Round 03 validated: the MVP as specified is not yet interesting

Four delegated workstreams ran from one brief
([`docs/briefs/round-03-mvp-and-map.md`](docs/briefs/round-03-mvp-and-map.md)):
R (map research), M1 (rules), M2 (product), then V (adversarial validator). Their
deliverables and the ratified re-statement are indexed in
[`docs/mvp/README.md`](docs/mvp/README.md).

**The headline finding**

> **"Worth building only if three things change."** As specified the game reduces to
> *"don't be adjacent to an Agent at the pulse, be adjacent at the pulse"* — the
> Reveal Pulse **is** the game, and everything else is bookkeeping around three to
> five one-turn windows.

This is the most valuable output of the round. It is not "the MVP is bad"; it is
that the loop must be fixed **before** implementation rather than discovered after.

**Research disagreed with the director's hypothesis — and that is the point**

The director proposed a block/square field expecting it to make occupancy and the
same-square capture test unambiguous. R recommended **against** it, and the argument
is recorded in `docs/mvp/README.md` §4:

- Capture is **already** one exact discrete comparison (`agent.node === fugitive.node`).
  A square gives the same single comparison. The mockups *read* ambiguously because
  two **continuous screen positions** were compared by eye — a **rendering bug, not a
  representation bug**.
- A uniform lattice would make mode stop constraining *where* a move lands and only
  say how far, so bus/metro degenerate into "long taxi" and the four-tier ticket
  economy collapses. It also explodes the Agent's candidate set from tens of nameable
  stations to hundreds of interchangeable squares.
- The real fix is **authored per-edge street geometry**: a move is an edge sequence
  and a single move is exactly one edge, so
  [0010](docs/decisions/0010-legal-moves-follow-streets.md) is **not sufficient on
  its own** — without waypoint geometry, drawing that one edge straight still crosses
  buildings.

**Three P0 changes (applied in `docs/mvp/README.md`)**

1. **16 turns, pulses 5/10/15** — M1's 24 turns is wrong (11 min 35 s on M2's own
   25 s/player-round model, outside the 5–10 min phone target; M1's turn-23 pulse
   also left a five-turn unpruned interval followed by a one-turn climax).
2. **The scooter's exact-position reveal is cut.** M1 revealed the ending node before
   the Agent phase while capture is an end-position test, so any Agent within one move
   captured with no counterplay — and with 25 non-scooter moves for 24 turns the
   scooter's tempo was never needed anyway. Validation won a transcript to the limit
   spending zero charges. **Rejected fix:** giving Agents scooter charges, which
   doubles the asymmetry.
3. **Pass-and-play is not the ship mode** — one device per seat. M2 proposed hot-seat
   to delete the whole lobby/reconnect surface, but it leaks hidden information three
   ways: the Fugitive's move is visible to Agents alongside, three hand-offs per turn
   is 48 transfers (~96 s) against a 25 s budget, and press-and-hold hides a glance,
   not an unattended device. **Rejected:** shipping hot-seat and deferring netcode;
   the compromise if the director insists is 12 turns with pulses 4/8/12.

**Other findings worth keeping**

- **On-foot is logged, and M2 was wrong** to default it to "no trail": silent foot
  creates an unbounded silent branch in the Agent's candidate set, making deduction
  unfalsifiable, and dominates every paid mode.
- **The candidate set saturates mid-interval** (≥ 14 and up to 40 nodes before a
  pulse, against a ≤ 12 target), so the pulse interval needs shortening and M1 §12's
  bound should become a real solver test rather than an estimate.
- **Starting separation must be ≥ 3 edges** — with both Agents two edges from the
  Fugitive's start, validation captured the Fugitive on turn 2 with no play.
- **Seat assignment** has no rule yet, and a near-complete metro terminal graph lets
  one terminal Agent threaten every terminal.
- **The log invariant is under-specified on the capture turn** (zero rows).

**Corrected in our own records**

The validator caught that `VISUAL_DIRECTION.md` still described on-foot as
**"free" and silent**, contradicting M1's rules. Corrected there, along with the
related claim that on-foot might widen `TransportMode` — it does not; the MVP
introduces `MobilityOption = TransportMode | 'foot' | 'scooter'`.

**Verification**

- `pnpm test` — 5 files, 88 tests, passing.
- `pnpm check:docs` — 34 markdown files, all links resolve, counts current.
- `pnpm verify` — exit 0 before this round's document work began.

---

## 2026-10-16 — Director rulings: prototype phase, 20-player MVP, graph confirmed

**The rulings, all applied to the records**

1. **A prototype precedes the MVP:** 5 seats, **1 human + 4 bots**, single-player.
   Its purpose is explicitly a *feeling of success* and validating what the game looks
   like. Bots need not be clever.
2. **The MVP is multiplayer at up to 20 players, 4 of them Fugitives.** A solo player
   fills the remaining seats with bots, and **a human joining later takes over a bot's
   seat.**
3. **No same-device sharing.** One device per seat.
4. **The map stays node-and-edge**; the block/square proposal is rejected. The **map
   generator is a component to start early.**
5. **Reveal Pulse dominance is accepted for now**, the proposed cycle is adopted (**16
   turns, pulses 5 / 10 / 15**), and **starting separation ≥ 3 edges** is adopted.
6. **Faction assignment is random**, with a prototype/testing override that always
   lets the director play as the Fugitive.

**Decisions and rejected alternatives**

1. **Prototype before MVP.** **Rejected:** building the MVP directly — nothing is
   playable until the turn machine, projection, capture, sockets and UI all land, so
   there is no early evidence the game is worth building. Recorded as
   [0011](docs/decisions/0011-prototype-before-multiplayer-mvp.md).
2. **Keep the prototype single-player.** **Rejected:** a multiplayer prototype, which
   front-loads sockets, rooms, reconnect and interest management *before* the loop and
   the look are validated. **Also rejected:** pass-and-play as a shortcut, which the
   director ruled out outright.
3. **Re-scope the MVP from 3 seats to 20 players / 4 Fugitives.** **Rejected:**
   keeping the validated 3-seat MVP, which contradicts the director's requirement that
   the MVP be multiplayer.
4. **Record the rulings without rewriting the director's §1–§6 prose.** The rulings
   live in [`docs/mvp/README.md`](docs/mvp/README.md), each resolution **strikes the
   matching entry** in [`GAME_VISION.appendix.md`](GAME_VISION.appendix.md), and the
   legacy 3-seat documents are marked invalidated rather than quietly edited.
   **Rejected:** editing the brief's own text on our own initiative, and
   **rejected:** silently rewriting the agent documents to match, which would destroy
   the evidence of what was actually validated.

**What this invalidates**

`round-03-rules.md`, `round-03-product.md` and `round-03-validation.md` were all
written for **1 Fugitive vs 2 Agents** and are now stale. The 4-Fugitive model also
changes the hidden-information problem: `projectState` must project **per viewer and
per Fugitive**, not for a single hidden player. Bot seats must be **interchangeable
with human seats** in the engine, or mid-Yard takeover will be impossible later.

**Verification**

- `pnpm test` — 5 test files, 88 tests, passing.
- `pnpm check:docs` — 37 markdown files, all links resolve, documented counts current.
- `shoot.mjs` — all 14 mockups across three rounds render with no page or console
  errors. Four round-03 mockups were corrected after a legality bug in our own brief:
  they had drawn a **bus move from a standard street node** and a walk between
  non-adjacent stations. The brief now carries a derived legality table, and
  [L11](docs/lessons.md) records the trap.

---

## 2026-10-16 — Turn model clarified: timed concurrent windows per faction

**The ruling**

Each faction acts inside its own **30-second window with every member moving at
once**. A move is **visible to the rest of that faction the moment it is made**, so a
later mover acts on more information. **Agents go first, then Fugitives**, and
**Fugitives see each other.** 30 s is explicitly a starting value.

**Decisions and rejected alternatives**

1. **Timed concurrent windows replace sequential turns.** **Rejected:** the fixed
   `detectiveOrder` rotation the rules currently specify — with up to 20 seats a
   rotation means waiting for up to 19 other players before you may act, which is
   unplayable inside a 5–10 minute phone session, and it removes the read-the-room
   tension the director is asking for. Recorded as
   [0012](docs/decisions/0012-timed-concurrent-turn-windows.md).
2. **Moves are observable mid-window.** **Rejected:** simultaneous submission with
   everything revealed together at the end — explicitly not what the director wants.
3. **The timer lives in the server, not the engine.** **Rejected:** putting wall-clock
   time inside `game-core`, which is banned from the clock. A timeout arrives at the
   engine as an event, so *what* happens stays independent of *when*.
4. **Arrival order is recorded and replay never re-sorts it.** **Rejected:** replaying
   in sorted or arbitrary order — once moves are observable mid-window, order changes
   outcomes. The append-only event log already carries it.

**Consequences recorded, and deliberately not resolved unilaterally**

- **Capture resolution has no rule for concurrent collisions:** two Agents reaching the
  same node, and an Agent and a Fugitive crossing inside one window.
- **Timeout behaviour is undefined.** `hold` is not obviously right — a player who ran
  out of time is not the same as one with no legal move.
- **The session arithmetic does not close:** 16 turns × two 30 s windows is up to
  **16 minutes** against a 5–10 minute target. Windows must close early once everyone
  has moved, and the turn limit may need to come down.
- **Every mobile screen now needs a countdown and a "waiting for others" state**, which
  the round-03 mockups do not show. Two new screens are being built for it.
- `VISUAL_DIRECTION.md` decision 4 (viewer-dependent hidden information) is
  **superseded within a faction**: Agents see all Agents, Fugitives see all Fugitives,
  and only the other faction stays hidden.

**Verification**

- `pnpm test` — 5 test files, 93 tests, passing.
- `pnpm check:docs` — 39 markdown files, all links resolve, counts current.

---

## 2026-10-16 — Mobile art revision: the city was lost, and why

**The director's rejection**

> "I don't like the mobile 'city map' mockups at all. They are not resembling the
> earlier design options I said I liked (with actual buildings / city rooftop view and
> some animations)."

Correct, and it was our failure, not a matter of taste. Round 02's approved F and H
screens are **illustrated cities** — individual buildings with roof faces and visible
facades, one consistent shadow direction, kerbs and crossings, bridges with piers,
trees, a cathedral, a station. The round-03 mobile screens degraded into large flat
coloured rectangles and grey ribbons: a **diagram of a city**. That is the same
"abstract nodes" mistake the director had already rejected in round 01, reintroduced one
round later.

**Root cause — a process failure, recorded as [L12](docs/lessons.md)**

The round-03 mockup brief **described the style in prose** ("flat vector, slight 2.5D,
daylight") and never **pointed at a finished example**. Adjectives do not transmit
illustration density. Compounding it, the phrase **"minimum UI"** was read as permission
to draw minimum *art*. The fix is structural: a delegated visual task must be pointed at
a specific approved artifact and required to read it, with a fidelity test the author
applies before submitting — *squint at it: does it read as a city, or as a flowchart?*
The revision brief now carries both the reference paths and that test.

**Decisions and rejected alternatives**

1. **Re-brief against the artifact, not the adjectives.** The revision brief names
   `round-02-city/f-flat-2p5d-day.html` and `h-painterly-topdown-night.html` as the
   references and requires them to be read first, alongside an already-rebuilt sibling.
   **Rejected:** writing a longer prose description — that is what failed the first time.
2. **Rebuild a representative set before rolling out.** Four screens were rebuilt first
   (both factions' views, the timed window, and the H comparison) so a second mismatch
   would cost four rebuilds, not eight. **Rejected:** rebuilding all eight blind.
3. **Keep the game state byte-identical.** This is an art revision: station positions,
   cast, turn numbers, log rows and kit figures must not move. **Rejected:** taking the
   opportunity to restage the scenes, which would have made the art change impossible to
   judge independently of the content change.
4. **Clean the agents' scratch output.** The tooling directory had accumulated crop
   images and scratch scripts from the mockup authors; removed. It is git-ignored, so
   this was hygiene rather than a repository problem.

**Also corrected in passing**

The prototype viewer came up blank in the harness preview. Cause: it switched screens
with `display:none`, and the preview inlines only the resources it can see at load, so
every hidden screen had no usable image. Rebuilt with **no hidden elements, no
JavaScript, no iframes and no outbound links** — all eight screens laid out on one
scrolling page with a sticky sidebar index. Verified in a real browser: 8 images, all
loaded, 0 hidden, 0 scripts, 0 errors. The screenshot tool now skips it, since a
scrolling document has no `.stage`.

**Verification**

- `pnpm test` — 5 test files, 93 tests, passing.
- `pnpm check:docs` — 41 markdown files, all links resolve, counts current.
- `shoot.mjs` — all eight round-03 mockups render at the correct stage sizes with no
  page or console errors.
- Rebuilt screens inspected as rendered PNGs, not merely asserted: `s2` reads as a day
  city and `s5` as a night city, with station numbers and legal-move paths legible.






---

## 2026-10-24 — Map generator v1: the transit network comes before the art

**Why this round exists.** The previous attempt to get a playable map by reusing
the approved round-03 mockup as a background plate failed review: the mockup is a
phone backdrop with ten labels on it, not a map. It has no street graph, blocks,
station data or per-edge polylines, and cannot be validated or scaled. The director
redirected the work to a proper generator, transit network first, simple UI.

**What was built**

1. **`game-core` geometry contract.** `MapPoint` and `StreetSegment` types;
   optional `GraphEdge.path`; `edgePath(graph, edgeId)` with a chord fallback; and
   `validateStreetGeometry(graph, streets)`, a separate pure check for R5.
   Taxi and bus paths must lie on the street network; metro and special are exempt.
   This is a separate function because `validateGraph` does not carry the city's
   street set.
2. **`packages/map-generator`.** A new pure workspace package (depends only on
   `game-core`) that generates from a seed: a thinned jittered street lattice,
   blocks/parks/landmarks, 24/60/96 stations with a proportional class mix, a taxi
   spanning subgraph plus local extras, boulevard bus corridors, terminal-pair metro
   lines, one special shortcut, one Black Market and one Safe House, and 1+4 starts
   at >= 3 edges. Output is a `GeneratedMap` with a validation report and stats.
   Failed layouts retry on a derived seed; the effective seed and attempt count are
   recorded.
3. **Committed fixtures.** `maps/prototype-24-seed-42.json`, `prototype-24-seed-7.json`,
   `mvp-60-seed-42.json`, `mvp-60-seed-7.json`. The test suite regenerates every
   fixture and asserts equality, so the fixture cannot drift from the generator.
4. **Dev map lab** at the Vite dev root (`apps/web`, dynamic import, dev-only):
   seed/station controls, regenerate/random, schematic SVG map, station inspector,
   stats, validation (including the provisional warning), JSON export, and URL
   state. `?board` keeps the old server-backed scaffold.

**Decisions and rejected alternatives**

1. **The generator is a separate package, model-first.** Recorded as
   [0013](docs/decisions/0013-map-generator-separate-package.md). **Rejected:**
   putting it inside `game-core` (mixes authoring with rules and the engine is
   consumed as source in the browser); **rejected:** hand-drawing over the mockup
   plate (the failure that started this round); **rejected:** building the F-style
   renderer first (a graph that cannot be validated is still the blocker, and art
   over it would repeat the mockup mistake).
2. **Street coverage is a separate `game-core` check.** **Rejected:** widening
   `validateGraph` to take a street set; the rules graph is deliberately independent
   of the city model, and the separate check keeps error/warning channels explicit
   (0007).
3. **Fixtures are committed and regenerated by tests.** **Rejected:** generating
   fixtures at test time, which is slower and not reviewable as data.
4. **Schematic UI first.** The lab is an internal review instrument, not the
   presentation client. **Rejected:** waiting for the F/H art choice before any
   playable board exists.

**Verified**

- `pnpm install` — exit 0; the new workspace links cleanly.
- `pnpm test` — **6 test files, 117 tests**, all passing (5 game-core files / 102
  tests, 1 map-generator file / 15 tests).
- `pnpm typecheck` — exit 0 for every workspace.
- `pnpm build` — exit 0; the production client builds (the dev lab is a separate
  lazy chunk and is never routed to in production).
- `pnpm check:docs` — 43 markdown files, links resolve, counts current.
- Browser: the lab rendered a 24-node and a 60-node map at 1440x960 and 390x844
  with zero page or console errors; clicking a station opened its inspector;
  changing the station count and seed regenerated the map and updated the URL.
  The 96-node path is covered by the unit suite.
- Generated maps: `validateGraph` has **zero errors** and the only warning is the
  expected provisional mean-degree warning (3.3–3.6 against the [4.5, 6.5]
  heuristic). `validateStreetGeometry` is clean for every taxi/bus path.

**Known limits**

The city skeleton is a thinned lattice, not an irregular road graph; there is no
river, bridge, distinct district geometry or building renderer yet. Bus corridors
are limited to the four boulevards. Starts are 1 Fugitive + 4 Agents only; the
4-Fugitive/16-Agent layout and its separation rule are MVP work. The playable
prototype (`PrototypeState`, turn order, capture, pulses) is the next step and
will read `maps/prototype-24-seed-42.json`.

---

## 2026-10-24 — Metro is a connected network, not disjoint chords

**The problem.** The first generator paired terminals symmetrically — for six
terminals, three separate metro chords. That is not how a metro network works: the
lines crossed on the drawing but shared no station, so the network was three
disconnected routes. The director caught it from the lab.

**The fix.** The metro is now two lines that share one interchange terminal. The
interchange is the terminal nearest the map centre; the other terminals are split
by angle into two arcs, and each arc is ordered by nearest-neighbour from the
interchange. Every terminal is on a line, every line starts at the interchange,
and the metro subgraph is a tree with `terminals - 1` edges. At 60 nodes that is
five metro edges over six terminals; at 24 nodes there are two terminals and one
edge, which is already connected.

**Rejected alternative:** keep the disjoint pairs and only make them cross
visually. Failure: a crossing that does not share a station is still two
disconnected routes, and the user's complaint is about the topology, not the
drawing.

**Verified**

- `pnpm test` — 6 files / 117 tests, all passing. The generator tests now assert
  `terminals - 1` metro edges and run a BFS over the metro subgraph to prove it is
  connected, on every generated map.
- Fixtures regenerated: 24-node maps now have 1 metro edge; 60-node maps have 5
  (the 60-node map's mean degree rises to 3.67–3.70, still with only the expected
  provisional density warning).
- Browser at 60 nodes: five metro paths render and meet at the interchange; zero
  page or console errors. `maps/shots/mvp-60-seed-42.png` refreshed.

---

## 2026-10-24 — First playable: a 96-station Cathedral Quarter

**What was built**

1. **96-station generator target.** `MapOptions` now has `startStrategy`
   (`farthest` | `encircle`) and `agentCount`; the 96 fixture uses `encircle`, so
   the four Agents start 3–4 edges from the Fugitive and spread by angle instead
   of starting 9–10 edges away. The generator asserts the placed station count
   equals `targetNodes` rather than silently returning a smaller map. The 96
   fixture is committed at `maps/prototype-96-seed-42.json`.
2. **F-style city plate.** A pure renderer turns the generated blocks into
   building footprints, roof faces, near walls, windows, chimneys, one
   south-east shadow and a warm clay/slate palette. Streets get casing, asphalt
   and markings; parks get trees and ponds; cathedral, station, market and square
   are drawn as landmarks. The plate is static; stations, legal routes, tokens
   and the pulse ring are a live overlay.
3. **Prototype loop.** `game-core/src/prototype/` now holds `PrototypeState`:
   one Fugitive plus N Agents, six movement options (taxi, bus, metro, special,
   foot, scooter), pulses on 5/10/15, scooter exact-node reveal, capture on
   end-position equality, 16-turn survival, public mode-only log. Agent bots are
   deterministic BFS pursuit that surrounds the last known node.
4. **Desktop prototype screen** at the Vite dev root: 1440×900, illustrated map,
   turn strip with pulse markers, six-mode kit, public log, Agent positions,
   hold, result overlay and restart. `?lab` keeps the schematic map lab;
   `?board` keeps the old scaffold.

**Decisions and rejected alternatives**

1. **96 stations, desktop-first, F-day, local.** Recorded as
   [0014](docs/decisions/0014-96-station-desktop-prototype.md). **Rejected:** the
   24/60 map (the director's original objection — not a realistic chase);
   **rejected:** phone-first without zoom (96 labels and a dense city are not
   legible at 390 px); **rejected:** building the server/20-player MVP first (no
   evidence the loop or look is worth carrying into projection and sockets).
2. **Close, encircling Agent starts.** **Rejected:** the previous farthest
   selection — it kept the separation rule but made the 96-node map a no-chase
   demo.
3. **Static city plate + live overlay.** **Rejected:** re-rendering the buildings
   on every turn; the city is static and the overlay is the only changing layer.
4. **A reduced `PrototypeState`.** **Rejected:** calling this the full
   `GameState`; the projection, 4-Fugitive and event-log contracts are still
   owed.

**Verified**

- `pnpm test` — **7 test files, 129 tests**, all passing (game-core 113,
  map-generator 16).
- `pnpm typecheck` — exit 0 for all five projects.
- `pnpm build` — exit 0; the dev prototype is a statically excluded lazy chunk,
  so the production bundle contains only the client entry.
- `pnpm check:docs` — 45 markdown files, links and counts current.
- Browser at 1440×900: the 96 station labels, city plate, kit, log and Agents
  render with zero page or console errors. A destination click applied the
  Fugitive move, resolved the Agent phase, and advanced the turn. A full autoplay
  session reached a pulse and a capture on turn 5, with the result overlay naming
  Falcon.
- Screenshots are captured in `maps/shots/` (the 96 schematic and the prototype
  frames are separate artifacts).

**Known limits**

The first city plate is dense at 96 stations and deliberately desktop-only; a
phone camera and label LOD are a later pass. The river/bridges are not in the
generator yet, and the bus network is not guaranteed connected (only metro is).
The prototype is one Fugitive and four Agents: no 4-Fugitive projection, no
server, no persistence. The 300-node scale rehearsal — derived grid, k-nearest
taxi graph, camera renderer — is the next architecture step.

---

## 2026-10-29 — Second playable: sequential reveal and a real viewport

**Why this round exists.** The director played the first 96-station prototype and
gave two pieces of feedback:

1. Movement was too sudden. Tokens jumped, and all four Agents moved in one
   frame. The player could not understand *how* the others were moving. The
   request: smooth movement from place to place, one mover at a time, no longer
   than 2 seconds and preferably around 1.
2. Fitting the whole map on screen is unrealistic. The request: zoom/viewport
   logic that works on different screen sizes, plus a separate **map view** for
   inspecting places away from the player's own location.

The engine was already deterministic and atomic. This round changes how a turn is
*revealed*, not what a turn *does*.

**What was built**

1. **The engine reports the moves it applied.** `resolveAgentPhase` now returns
   `agentMoves` — one `{ seatId, from, to, mode }` per Agent in resolution
   order. The client animates exactly that list instead of re-running the bot or
   guessing the edge. Two unit tests cover the contract: a Fugitive command
   returns no Agent moves, and every reported move matches the seat's before/after
   node and a legal move for that seat.
2. **A one-mover-at-a-time reveal.** Each mover gets a 170 ms camera lead-in. The
   Fugitive's route then runs ~850 ms, a pulse or scooter reveal holds 1.15 s, and
   each Agent runs 700 ms with a 150 ms beat. Every token travels its real street/transit polyline; the active route
   is highlighted with a direction arrow; completed moves leave a dashed trace
   for the rest of the turn. The banner names the mover, mode and stations, and
   `Skip` jumps to the final state. The result overlay waits for the reveal.
3. **A play/map camera.** `Play` follows the Fugitive and frames the active
   mover's route so an Agent that starts off-screen is brought into view. `Map`
   is a free pan/zoom view; `Expand` fills the screen. Camera moves are eased, and
   the map view stays put while moves play out. A wheel, drag, two-finger pinch,
   `+`/`-`, `F` (recentre) and `M` (expand) all work.
4. **Screen-space overlay + label LOD.** Station numbers, tokens, rings, route
   widths and facility labels are drawn at constant screen size using the camera
   scale; the city plate zooms normally. Street numbers drop out below a zoom
   threshold while terminals, hubs, facilities, legal destinations and the active
   move stay labelled.
5. **Responsive layout.** The map frame is measured with a `ResizeObserver`; the
   kit/side panel rearrange at 880 px and 560 px, with a landscape-phone rule.
   Checked at 390×844, 768×1024, 844×390, 1024×768, 1280×720, 1440×900 and
   1920×1080 with no horizontal/vertical overflow and no toolbar/banner overlap.
6. **Committed review frames.** The current seven frames live in `maps/shots/`
   (`prototype-96-play-1440.png`, `-agent-1440`, `-map-1440`, `-pulse-1440`,
   `-result-1440`, `-play-390`, `-map-390`). The first-playable frames remain for
   comparison.

**Decisions and rejected alternatives**

1. **Sequential reveal is presentation, not a rules change.** Recorded as
   [0015](docs/decisions/0015-sequential-reveal-and-play-map-camera.md).
   **Rejected:** animating all Agents at once (the director's complaint);
   **rejected:** re-simulating Agent moves in the client (it could draw a
   different edge than the engine charged); **rejected:** an unskippable reveal
   (a pulse turn would lock 6–7 seconds of motion).
2. **Two cameras, screen-space overlay.** **Rejected:** one fitted viewBox for
   every screen (unreadable on phones and reads as a diagram); **rejected:**
   scaling labels and tokens with the city (microscopic at overview, oversized at
   play zoom).
3. **Map view on portrait uses a cover crop, not a whole-city thumbnail.**
   **Rejected:** shrinking 1200×900 into 390 px and losing every label. The whole
   city remains reachable by zooming out and panning; a minimap or rotated
   overview is a later addition.

**Verified**

- `pnpm install` — exit 0.
- `pnpm typecheck` — exit 0 for all five projects.
- `pnpm test` — **7 test files, 131 tests**, all passing (game-core 115,
  map-generator 16). The prototype suite is 13 tests.
- `pnpm build` — exit 0; the dev prototype is still a statically excluded lazy
  chunk.
- `pnpm check:docs` — links and counts current.
- Browser at 1440×900: a move started the Fugitive animation, then the four
  Agents entered `activeStep` one at a time at ~1.0 s, 1.9 s, 2.7 s and 3.6 s,
  each with its own banner and route; trails ended at 5 (Fugitive + 4), the turn
  advanced, and the result overlay did not appear while `pending` was true. A
  brute-forced turn-5 run captured the Reveal Pulse, and the subsequent capture
  showed the result overlay only after the last Agent's reveal.
- Phone at 390×844: the play view, kit, log and Agents fit without document
  overflow; `Expand` fills the screen and centres the map on the Fugitive. Tablet,
  landscape phone, 1024, 1280 and 1920 widths were checked the same way.
- Zero page errors or console errors in every checked viewport.

**Known limits**

The engine still resolves the Agent phase simultaneously; only the reveal is
sequential. On a portrait phone the expanded map is a moving crop, not the whole
city at once. SVG is comfortable at 96 stations but the 300-node scale rehearsal
still needs a faster renderer and the same camera/LOD contract. Browser checks
are an ad-hoc script outside the repository; there is still no committed
`pnpm test:e2e`.

---

## 2026-10-29 — Network legibility, last appearance, and “appearance”

**Why this round exists.** The second playtest found that the map only
highlighted transport from the current node. The full taxi/bus/metro/special
network was effectively hidden, so the player could not see that a destination
was a bus stop, trace “1 bus + 2 taxis”, or reason about what an opponent could
reach. The director also asked for a persistent marker at the Agents' last-known
node, and rejected the term “pulse”: in Scotland Yard / Mr. X vocabulary the
Fugitive makes an **appearance**.

The director then stopped the route-planning direction before it went further:
*“I don't want any special plan mode. Planning should happen inside the head of
the player. That's where the beauty lies.”* The problem is legibility, not
calculation.

**What was built**

1. **A permanent transit map.** Every taxi, bus, metro and special edge is drawn
   at all times: taxi thin gold, bus green, metro red, special purple dashed. The
   selected mode's legal moves are brighter on top; they no longer replace the
   network. Stations carry `B` / `M` / `S` badges where they are stops.
2. **A station inspector, not a planner.** Hovering a legal destination (desktop)
   or clicking any station opens a card listing each mode's destinations from
   that station and who is standing there. On touch, the first tap on a
   destination previews it and a second tap on the same ring moves, so phone
   players get the same information without hover. It is a lookup: it computes
   no path, cost or reachability.
3. **The last-appearance ghost.** The Agents' `lastKnown` node is a
   semi-transparent red fugitive ghost with a dashed ring, labelled `F<node>`
   (e.g. `F18`). It persists after the Agents move away and is replaced at the
   next appearance. It is hidden while the real Fugitive is on that node. The
   station card notes “Last appearance · F18” when the station is opened.
4. **Terminology: Appearance.** The player-facing term is now Appearance
   (`APPEARANCES`, `APPEARANCE` log row and banner, “appears on 5, 10 and 15”).
   The prototype state/log and the shared constant are renamed:
   `lastAppearanceTurn`, `pendingAppearance`, `kind: 'appearance'`,
   `APPEARANCE_TURNS`, and the scaffold `/health` field `appearanceTurns`.
   The unimplemented full-game `Phase 'reveal-pulse'` and `RevealPulseMessage`
   are deliberately left for the turn-machine rename ([decision
   0016](docs/decisions/0016-appearance-terminology.md)).
5. **The planner was removed.** A first cut of Plan mode — seat selector, 1–3
   step reachability, shortest-route/cost card — was built and then deleted. It
   is not in the tree or the demo. Recorded as [decision
   0017](docs/decisions/0017-always-visible-network-and-last-appearance.md).

**Decisions and rejected alternatives**

1. **Planning stays in the player's head.** **Rejected:** Plan mode,
   reachability overlays and route-cost calculators. Failure: they turn deduction
   into arithmetic and remove the part of the game that is the point.
2. **The network is always visible.** **Rejected:** only the selected mode's
   legal moves (the original complaint); **rejected:** hiding the network behind
   an optional layer (default must show the real map).
3. **The ghost is `lastKnown`, not the true position.** **Rejected:** a marker at
   the true position (it would lie about what the Agents know); **rejected:**
   drawing it while the real Fugitive stands there (ambiguous double-draw).
4. **Appearance, not pulse.** **Rejected:** keeping “pulse” as the UI term;
   **rejected:** renaming only the UI while the state/log still say pulse;
   **rejected:** aliasing both names (decision 0008); **rejected:** renaming the
   unimplemented full-game wire contract piecemeal.

**Verified**

- `pnpm install` — exit 0.
- `pnpm typecheck` — exit 0 for all five projects.
- `pnpm test` — **7 test files, 131 tests**, all passing (game-core 115,
  map-generator 16). The planner tests are gone with the planner; the prototype
  suite is back to 13 tests.
- `pnpm build` — exit 0.
- `pnpm check:docs` — 48 markdown files, links and counts current.
- Browser at 1440×900: the all-mode network and station badges render; hovering a
  legal destination opens `STATION PREVIEW n11` with `Taxi n20 · n8`, not a move;
  the header reads `APPEARANCES 5 10 15`; the public log reads
  `T5 · APPEARANCE · n18`; after the turn-5 appearance and a move on turn 6 the
  ghost `F18` is present at n18 while the real token is at n15.
- Touch at 390×844: the first tap on `n11` selects it and shows the station card
  with “Tap the ringed station again to move here”; the second tap starts the
  move. No page/console errors.
- Responsive checks at 390×844, 768×1024, 844×390, 1024×768, 1280×720,
  1440×900 and 1920×1080: no document overflow, no toolbar/banner overlap, no
  console errors.

**Known limits**

The full-game `Phase 'reveal-pulse'` and `RevealPulseMessage` still use the old
name; they are unimplemented and will be renamed once with the MVP turn machine.
Historical log entries and old decision records keep “pulse” as written. The
ghost is the Agents' last-known marker, not a prediction. There is deliberately
no route planner. The network is dense on a phone; labels drop out at low zoom.
The 300-node renderer still needs the next scale rehearsal.

---

## 2026-10-29 — RTS city skins and the developer skin switch

**Why this round exists.** The illustrative city pass (round 04: pastel card, night
and rain themes) did not land. The director's verdict was that it still looked
“pretty much like a children's drawing” and that the target is the dense,
pre-rendered city look of late-90s RTS games — explicitly “Red Alert 2 style”.
They also restated the operational requirement: the current basic prototype is
fine as a fallback, and a developer should be able to switch skins very easily;
the choice does not need to exist for end users.

The previous round's mistake was treating the problem as a palette swap. This
round changes the **city renderer**: isometric/2.5D blocks, visible façades,
window grids, roof equipment, concrete/asphalt, industrial detail and cast
shadows.

**What was built**

1. **A skin boundary.** The city plate is now a developer-switchable skin. The
   live overlay (network, stations, labels, tokens, ghost) and the rules stay in
   `PrototypeMap` / `game-core`; a skin renders only the city. This is the
   mechanism the director asked for.
2. **`basic` is still the default and fallback.** The original `CityPlate` is
   untouched and loads by default. The `SKIN` control lists `Basic`, `Iron`, and
   `Night`; the last two are the RTS skins. The choice is saved in
   `localStorage['xyard.skin']` and mirrored to `?skin=iron` / `?skin=nightops`
   for sharing. It is dev-only; there is no end-user selector.
3. **Iron Quarter (2.5D RTS).** Taller façades and a slight oblique roof shift,
   window grids, roof gear, billboards, smoke, awnings, cars, streetlights and
   concrete/asphalt textures — while keeping the current board coordinates,
   camera and overlay. This is the cheap, playable step.
4. **Night Ops (2.5D RTS, night).** The same geometry and coordinates after dark:
   sodium lamps, lit windows and a darker plate. Route/station contrast was kept
   deliberately high.
5. **Command City (true isometric).** A lab-only study that re-projects the whole
   map into a 2:1 isometric diamond with extruded buildings and a re-projected
   station/route overlay. It is the closest to the target and the most expensive:
   the camera and every overlay layer would need a projection pass. It is not in
   the game selector.
6. **The RTS lab** is at `?rts`, with the three options and their costs. The old
   pastel lab remains at `?visuals` as history; it is no longer in the game
   selector. Round 05 is documented in
   [`design/moodboard/round-05-rts/README.md`](design/moodboard/round-05-rts/README.md);
   the skin mechanism is [decision 0018](docs/decisions/0018-developer-switchable-city-skins.md).

**Rejected alternatives**

1. **Keep iterating the pastel palette.** Rejected by the director: wrong family
   of look; palette work cannot turn block footprints into an RTS city.
2. **Replace Basic with the new skin / make the RTS skin the only renderer.**
   Rejected: Basic is the working prototype and the agreed fallback.
3. **End-user skin picker.** Rejected: not a player feature; the game should have
   one authored look. The selector is developer-facing only.
4. **Make Command City the live skin immediately.** Rejected for now: it needs a
   camera/overlay re-projection, which is a separate, testable change.
5. **Move straight to pre-rendered RA2-style sprites.** Rejected as the first
   step: it needs a 3D asset pipeline. The vector RTS skins establish the
   composition, detail budget and switch first; sprite atlases can replace the
   city renderer later behind the same boundary.

**Verified**

- `pnpm install` — exit 0.
- `pnpm typecheck` — exit 0 for all five projects.
- `pnpm test` — **7 test files / 131 tests**, all passing (game-core 115,
  map-generator 16). No rules changed.
- `pnpm build` — exit 0; production bundle stays at ~223 kB and excludes the
  dev prototype/labs.
- `pnpm check:docs` — 52 markdown files; links and counts current.
- Browser, 1440×900: Basic, Iron and Night all load with no page or console
  errors; the dev selector switches live, writes `?skin=`, and a reload restores
  the stored choice. The RTS plate renders under the unchanged overlay.
- Browser, 390×844: Iron skin loads with no horizontal overflow; the header
  reflows to two rows and the compact skin selector remains usable. The `?rts`
  lab renders all three cards without overflow.
- `?visuals` still boots as historical lab material; it is not in the selector.

**Known limits**

These are **vector approximations** of the RTS look, not pre-rendered sprites. A
true Red Alert 2-level skin still needs a 3D building pipeline and texture
atlases. Command City remains lab-only until the camera/overlay projection is
approved. Night Ops is harder to read than daylight and needs extra contrast
testing on small screens. The 300-node renderer and the final art direction are
still open.

---

## 2026-10-29 — Vintage Etching study and the early-1900s steer

**Why this round exists.** After the RTS pass, the director suggested moving the
game to the **early 1900s** — late enough for the Underground to exist, and a good
reason to drop the modern scooter, which was proving too complex. The visual
reference is a **Vintage Etching** treatment: a monochrome/sepia city map and
paper game menus, with the transit routes as the only saturated colour. The
director then preferred the darker of the two paper/ink balances.

This is a design study, not a rules change.

**What was built**

1. **A separate `?vintage` screen study.** It combines the isometric city with a
   parchment HUD: serif type, double-ruled panels, a seal, a compass, a scale bar
   and a colour route key. The city is sepia with ink outlines, cross-hatching,
   stippled trees and hatched shadows. No production route or rules path uses it.
2. **The network is the only colour.** Taxi gold, omnibus green, Underground red
   and special violet are drawn above the etched city, so they remain readable
   even when a tall building would hide them. Station labels and the city stay
   ink/sepia; the fugitive token keeps a small oxblood accent.
3. **Period cues, not a full period pass.** Modern AC units, billboards, antennas
   and cars are suppressed; chimneys, pitched roofs, water tanks and a sepia
   station roof are used instead. The kit reads **Taxi cab, Omnibus, Underground,
   Special, On foot**; the motor-scooter is omitted from the mock.
4. **The darker balance was restored** after review: darker roofs/walls, stronger
   hatching and the warmer paper ground. The lighter wash was rejected.

**Proposed steps to apply it**

1. Choose the projection. The study is isometric (the Command City renderer); a
   2.5D vintage skin would keep the current camera/overlay and is the cheap live
   path. The iso version needs the camera and overlay projection pass.
2. Skin-only implementation: city palette/textures behind the existing overlay;
   Basic remains the fallback; no rules change.
3. Paper HUD pass: parchment panels, serif type, route legend; keep contrast and
   colour-blind separation.
4. Period prop pass: gables/chimneys/dormers/gas lamps/early cabs; remove modern
   glass, neon and cars.
5. Era rules pass (separate): remove the scooter; rename Taxi → Cab, Bus →
   Omnibus, Metro → Underground; decide whether to keep Foot and Special; rebalance
   and test. This is the gameplay change, not the skin.

**Verified**

- `pnpm typecheck` — all projects pass.
- `pnpm test` — **7 test files / 131 tests**, all passing. No rules changed.
- `pnpm build` — exit 0; the `?vintage` study stays out of the production bundle.
- `pnpm check:docs` — links and counts current.
- Browser at 1600×1052: the vintage screen renders with no page or console errors
  and no document overflow; map, paper HUD, route key and compass are visible.

**Known limits**

The study is a vector approximation of an etching, not a scanned engraving. It is
not a selectable skin; the projection choice and scooter removal are still open.
The current map generator has no river/bridges or period-specific landmarks; the
period prop pass would need them.

---

## 2026-10-29 — Isometric Vintage skin applied; the 1907 rules lose the scooter

**Why this round exists.** The director chose the **isometric Vintage Etching**
direction over the 2.5D shortcut and asked for the era rules at the same time:
no motor-scooter, special kept. The prototype therefore needed a real projection
pass, a paper HUD and a rules change — not just another city plate.

**What was built**

1. **A shared isometric projection.** The 2:1 projection (`x = (x-y)*0.9`,
   `y = (x+y)*0.5`, translated into 0-based camera bounds) is applied to the city,
   the play/map camera, station labels, the permanent network, legal paths, tokens,
   trails, the appearance ring and the last-appearance ghost. The overlay gets a
   projected copy of the map; the rules continue to use map coordinates.
2. **Vintage is the default skin.** The isometric sepia city is the live city
   plate. **Basic** remains the fallback; Iron and Night remain developer skins.
   The selector is still dev-only and `?skin=`/localStorage still work.
3. **Paper HUD.** The header, kit, log, legends, map toolbar and station card use
   the parchment/ink system with serif type and coloured route accents. The city is
   monochrome; the transit network is the only saturated layer.
4. **Era rules.** The motor-scooter is removed from `MobilityOption`,
   `LoggedTransport`, `RevealReason`, the prototype seat/command/log types, the
   engine, motion, map overlay, kit and tests. Five modes remain: taxi, bus,
   underground, special, foot. Special stays. The internal paid-mode names are
   unchanged; presentation-only renaming is deferred.
5. **Camera/overlay integration.** Play follows the projected mover; Map fits the
   whole isometric city; dragging/zoom/labels are projected and the paper frame
   replaces the old dark stage. The Command City lab remains as a comparison.

**Rejected alternatives**

1. **Ship only the 2.5D Vintage skin.** Rejected by the director: the isometric
   look was the chosen one, despite the projection cost.
2. **Keep the scooter but hide it in the vintage HUD.** Rejected: the era rules
   were part of the request; an invisible modern option is worse than removing it.
3. **Remove special too.** Rejected: the director explicitly kept special.
4. **Rename taxi/bus/underground to cab/omnibus/underground in this change.**
   Rejected for scope: it touches wire vocabulary and historical tests; a
   presentation-only label pass can follow.
5. **Replace Basic with Vintage.** Rejected: Basic is the working fallback and
   the developer switch must stay.

**Verified**

- `pnpm typecheck` — all projects pass.
- `pnpm test` — **7 test files / 131 tests**, green after removing the scooter
  assertion and scooter paths (game-core 115, map-generator 16).
- `pnpm build` — exit 0; production bundle excludes the dev prototype and the
  vintage/RTS labs.
- `pnpm check:docs` — 54 markdown files; links and counts current.
- Browser, default `/`: Vintage loads with the projected city/overlay, paper HUD
  and five-mode kit at 1440×900; no page or console errors.
- A full first move plays through the projected Fugitive and Agent routes; the
  camera follows the projected mover; no errors.
- Turn-5 appearance renders in the projected overlay (`APPEARANCE · Vulture seen
  at n11`) and the result overlay is paper; no errors. (The playthrough captured
  the Fugitive that turn, so the ghost was not separately reached.)
- Map view fits the whole isometric city; station inspector, hover and touch
  preview still work.
- 390×844: Vintage loads with no horizontal overflow; header reflows, five-mode
  kit and paper HUD remain usable.
- `?skin=basic` and `?skin=iron` still load with the original projection and five
  modes; no scooter references remain in code.

**Known limits**

The period prop pass is partial (no river/bridges, still some generic roof/street
furniture). The full 96-station map is dense in isometric view; label LOD and
colour-blind route testing are the next polish items. The full-game/MVP documents
that described the scooter are historical and marked superseded by decision 0019;
the internal mode names were not renamed.

---

## 2026-10-29 — City rendering moved to culled Canvas for scale

**Why this round exists.** The isometric Vintage skin worked but performed poorly.
Profiling the live prototype found **81,601 SVG elements and 8.7 MB of city
markup** for the 96-station city. The camera updates the SVG `viewBox` on every
animation frame, so the whole city tree was reconciled and repainted during each
pan, zoom and follow. At 1440×900 a map drag averaged ~50 ms/frame (~20 fps) and
Map-transition frames reached 240 ms. That cannot support a city 10–50× larger,
especially on mobile.

**What was built**

1. **Canvas city plate.** `CanvasCity` draws the Vintage city with Canvas 2D from
   the same generated model and projection. It builds a spatial grid in projected
   space and draws only buildings/trees intersecting the camera plus a margin.
2. **Zoom LOD.** Play zoom draws façades, windows, hatching and simple gables;
   map zoom draws simplified blocks. Device pixel ratio is capped at 2. The canvas
   is redrawn only when the camera/stage changes; there is no city DOM.
3. **Overlay culling.** The SVG overlay receives the camera viewBox and renders
   only visible stations/edges/trails/tokens. Labels are limited by zoom and
   importance; at large whole-city zooms taxi edges drop out of the overview while
   bus/metro/special remain. Hit-testing and interaction are unchanged.
4. **Measured result.** At 1440×900 the Canvas city drag is ~16–17 ms/frame
   (~58–60 fps) rather than ~50 ms; Map transition is ~28–34 ms; at 390×844 with
   DPR 2 it is ~16.2 ms/frame. The city DOM count is **0** (was 81,601).
5. **The SVG path remains** for Basic/Iron/Night and the `?rts` comparison; those
   skins are detail/reference paths, not the scalable one. The rules and map data
   are unchanged.

**Rejected alternatives**

1. **Keep micro-optimising the SVG** (memoise, cull a few buildings, cap windows).
   Rejected: even a lean 96 city still has thousands of nodes and a full SVG
   repaint; it does not reach 10–50×.
2. **WebGL / PixiJS now.** Rejected for this pass: a new runtime dependency and
   asset pipeline. Canvas proves the culling/LOD/scene boundary first.
3. **Rasterise the whole city once.** Rejected: a 10–50× city at play zoom needs a
   huge texture; tiles or GPU rendering are the next step.
4. **Move the overlay to Canvas immediately.** Deferred: viewport culling keeps
   the visible overlay bounded for play. The whole-city overlay at 10–50× is the
   next scale step.
5. **Use the SVG city as the default and add Canvas only for large maps.**
   Rejected: the default 96 prototype was already visibly lagging, and the
   scalable path must be the one exercised every day.

Recorded as [decision 0020](docs/decisions/0020-canvas-city-renderer-for-scale.md).

**Verified**

- `pnpm install` — exit 0.
- `pnpm typecheck` — all projects.
- `pnpm test` — **7 files / 131 tests**, green.
- `pnpm build` — exit 0; Canvas/prototype code excluded from production.
- `pnpm check:docs` — 55 markdown files; links/counts current.
- 1440×900: Vintage loads in ~1.8 s; no page/console errors; first turn and Agent
  playback work through the Canvas city + projected overlay; Map view works;
  station inspector works.
- 390×844 DPR 2: no overflow; ~16.2 ms/frame drag; five-mode kit.
- Basic and Iron still load; overlay culling reduces their SVG overlay too, but
  their city plates remain SVG and are not the scalable path.

**Known limits**

The Canvas city is visually simpler than the SVG etching (limited hatching and
façade detail; no SVG pattern textures). The whole-city overlay is still SVG and
will remain the hardest case at 10–50×; a Canvas/WebGL overlay or map tiles is the
next scale step. Large generated fixtures and a 10×/50× benchmark are still
needed. The SVG city is retained as a reference/comparison path.
