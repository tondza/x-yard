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

---

## 2026-11-11 — Visual upgrade round opened: house & landmark variety, Vintage polish

**Context.** The director asked to step up the graphical side: the city should look
appealing, houses should be *varied* (pitched roofs the norm, not uniform "brick
boxes"), and landmarks should include stadium, city hall, parks, churches and more —
with the Vintage Etching skin as the priority. This round is planning only: the work is
persisted as a self-contained brief so a fresh session (e.g. a different model) can
continue it.

**What was decided**

1. **Sequenced by bang-for-buck, not ambition.** The highest-ROI items are pure renderer
   changes (`drawBuilding` / `drawLandmark` in `CanvasCity`, the `VINTAGE` palette):
   sloping roofs, wall-material variety, paper grain/ink, richer existing landmarks.
   These ship with **no generator, fixture or test churn**. The model change (new
   landmark kinds) and deeper geometry (row terraces, river/bridges) follow; the
   pre-rendered sprite / AI-texture pipeline is a later, director-gated phase.
2. **The data/renderer boundary is the whole plan.** Landmark *kinds* are map data
   (`LandmarkModel['kind']` in `map-generator`); house *types* are seeded presentation
   decoration in the client. Recorded as
   [decision 0021](docs/decisions/0021-building-and-landmark-variety.md).
3. **Era confirmed, not reopened.** The director questioned whether 1907 had metro; it
   did (London 1863 / 1890 / 1900, Paris 1900, Berlin 1902, New York 1904), so 1907
   remains correct and [decision 0019](docs/decisions/0019-1907-era-rules.md) stands.
4. **External assets approved as a later phase only.** AI image models and Blender/Voxel
   sprite pipelines are allowed in principle, but gated on director sign-off for anything
   paid, and they never enter `game-core` or `map-generator`.

**Persisted**

- [`docs/briefs/round-07-city-visuals.md`](docs/briefs/round-07-city-visuals.md) — the
  self-contained hand-off brief (fixed inputs, bang-for-buck-ordered delta, constraints,
  verification).
- [decision 0021](docs/decisions/0021-building-and-landmark-variety.md) — the boundary
  decision with its rejected alternatives.
- `docs/status.md` — "what is next" now leads with the round-07 visual upgrade.

**Not yet implemented.** No code changed in this round; it is a planning/documentation
round only. The numbered items in the brief are the work, in order.

---

## 2026-10-29 — Agent Practice and the side chooser

**Why this round exists.** The director wants to give feedback on the Agent side,
and asked to choose the side before the game starts. The prototype was a
single-player Fugitive table; an Agent view cannot be faked by handing the player
the Fugitive token and calling it Agent play.

**What was built**

1. **Side chooser.** The prototype now opens on **Fugitive** / **Agent Practice**
   cards. `Restart` keeps the chosen side; `Change side` returns to the chooser.
2. **Agent Practice.** The human commands Falcon (`agent-1`); the Fugitive is a
   deterministic bot, hidden from the UI, and the other three Agents remain bots.
   The Agent phase pauses for the human move and then resolves the rest.
3. **Public information only.** The true Fugitive token, route and trails are not
   rendered in Agent Practice. The player sees the ticket-mode log, appearances on
   5/10/15, the last-known ghost and the Agents' positions. An appearance is
   revealed before the human Agent moves.
4. **Engine support.** `resolveAgentPhase` accepts explicit human Agent `moves` or
   `holds`, validates them, and still resolves the bots/capture/turn. A separate
   `revealAppearance` transition makes a scheduled appearance public without
   resolving the Agent phase. `chooseFugitiveMove` is the deterministic
   distance-from-nearest-Agent bot. Five new prototype tests cover these.
5. **Camera/playback tuning.** Wheel zoom eases over 180 ms; general camera moves
   use 460 ms. Agent reveal steps are 900 ms with 220 ms lead-in and 200 ms gaps. A
   distant Agent no longer pulls the play camera away from its focus seat.

**Rejected alternatives**

1. **Agent spectator only.** No control, so it cannot test Agent choices.
2. **Full-info hotseat.** It would show the true Fugitive while pretending to be
   Agent play; rejected.
3. **Control all four Agents.** Rejected for this pass; one human seat + three bots
   exercises the view and phase without a second turn structure.
4. **New practice rules/numbers.** Rejected; the same table and numbers make the
   feedback transferable.
5. **Full server projection now.** Deferred; this is a local training table, and
   the real `projectState` remains required before any multiplayer.

**Verified**

- `pnpm test` — **7 files / 136 tests**, green (game-core 120, map-generator 16).
  New tests: human Agent orders, invalid/contradictory orders, holds, public
  appearance reveal, bot Fugitive policy.
- `pnpm typecheck` — all projects.
- `pnpm build` — exit 0; prototype excluded from production.
- `pnpm check:docs` — 58 markdown files; links/counts current.
- Browser: side chooser at 1440×900 and 390×844; Agent Practice first move,
  turn-5 appearance, ghost, no Fugitive token; Fugitive run still moves and shows
  the F token; no page/console errors.
- Camera: wheel zoom produces an intermediate eased view; far Agent steps no longer
  force a camera pull.

**Known limits**

The hidden projection is client-side for this local table; the true Fugitive lives
in state and the dev debug object. The bot Fugitive is a simple distance policy,
not a designed opponent. The real server projection, Agent skills and multi-Agent
coordination remain future work. The side chooser is set per session, not persisted.

---

## 2026-10-29 — Fix the Agent Practice legal path source and add public focus

**Symptom.** In Agent Practice the bright yellow legal-move lines radiated from a
single node, did not correspond to the taxi edges the player could actually use,
and looked like direct chords rather than street-following paths.

**Cause.** `PrototypeMap` drew every legal-move path from `seats[0]`, which is the
true hidden Fugitive seat. In Agent Practice the legal options belong to Falcon
(`agent-1`), so the overlay connected the hidden Fugitive's node to Falcon's legal
destinations. The permanent network was correct; the legal highlight was not. This
also leaked the hidden Fugitive's location through the line pattern.

**Fix.** The overlay now takes an explicit `moveSource` from the acting seat:
the human Agent in Agent Practice and the Fugitive in the Fugitive run. Legal
paths therefore use that seat's graph edges and their street-following `path`
polylines. Taxi/bus stay on streets; only the metro/special geometry may cross
blocks. No rules or edge data changed.

**Public information follow-ups**

- Agent Practice now reveals the **starting station** publicly (a `Vulture start`
  ghost and a `T1 · VULTURE START · nX` log row). Appearances replace it.
- Move rows now read `T1 · VULTURE · TAXI`; the transport mode is public, the
  destination is not.
- Public-log rows are clickable and centre the station; Agent rows are clickable
  too. A move row centres the current **last-known** position, never the true
  destination. An appearance row centres the announced node.
- The log header now says `MODE PUBLIC · ROUTE HIDDEN` rather than implying only
  the mode is public.

**Verified.** `pnpm typecheck`; `pnpm test` **7 files / 136 tests**; `pnpm build`;
`pnpm check:docs`. Browser: Agent Practice start ghost/log; legal paths begin at
Falcon `n7` and contain street vertices; clicking the move row centres `n8` and
opens the `Vulture start` card; clicking Harrier centres `n38` and opens the
station card; no true Fugitive token; no console errors.

---

## 2026-10-29 — Taxi legibility and parallel route lanes

**Symptom.** Even after the legal-path source fix, taxi links were still hard to
see: the permanent taxi stroke was 1.15 px at 50% opacity against the beige city.
Where taxi and bus shared a street they were painted on the same centreline, so
one covered the other.

**Fix.** Taxi now has a 1.7 px stroke at 82% opacity. Every transport mode is offset
by a fixed screen-pixel normal (taxi −2.4, bus +2.4, metro −4.9, special +4.9), and
the legal-move highlight uses the same mode offset, so it sits on the correct
parallel lane. Paths are canonicalised by endpoints before offsetting, which keeps
the two sides stable when the network edge and the legal path are stored in
opposite directions. Taxi/bus paths still follow their street polylines; the
offset is only a lane shift.

**Verified.** `pnpm typecheck`; `pnpm test` **7 files / 136 tests**; `pnpm build`;
`pnpm check:docs`. Browser: n8 shows its four taxi links on the start-station
focus; taxi is visible against the city; no console errors.

---

## 2026-11-11 — Round 07 city visuals: varied houses, civic landmarks, 1925 era

**Why.** The director's visual review asked for a Vintage Etching city that reads as
a city, not a field of brick boxes: pitched roofs as the norm, distinct landmarks,
and paper-and-ink polish. The round was planned in
[`docs/briefs/round-07-city-visuals.md`](docs/briefs/round-07-city-visuals.md) and
sequenced by bang-for-buck ([decision 0021](docs/decisions/0021-building-and-landmark-variety.md)).

**What was built (brief items)**

1. **House/roof variety.** `Building` now carries a seeded type, roof shape, ridge
   axis, pitch, dormers and chimney pots; pitched types are the majority.
   `CanvasCity` draws gable, hipped, mansard, flat + parapet and sawtooth roofs with
   ridges, dormers and pots, behind the existing `detail` LOD flag.
2. **Wall/roof materials.** Eight desaturated wall palettes and eight roof tones,
   picked per building from `hash(blockId + row + col) ^ map.seed`.
3. **Paper and ink.** A deterministic paper-grain `createPattern` on ground and
   blocks, denser hatching on shadow faces, stronger ink outlines, hatched cast
   shadows at play zoom, and a faint curb instead of a black street outline.
4. **Richer anchors.** Cathedral (nave/tower/spire/rose window/buttresses), station
   (train shed/barrel roof/clock tower), market (gabled hall/lantern/stalls) and
   square (fountain/obelisk).
5. **New landmark kinds.** `LandmarkModel['kind']` widened to thirteen; `grid.ts`
   adds a seeded civic subset (max six) beside the four anchors; `CanvasCity` draws
   each kind. Fixtures were regenerated; graph, starts, facilities and stats stayed
   byte-identical.
6. **Terraces and footprints.** Rows keep a shared roofline but now have alleys;
   after review, footprints mix one wide house, a pair, or three narrow/deep houses,
   with per-house width and depth jitter. The old fixed 2x2 split produced 28x9
   houses — wide and shallow.
7. **Furniture.** Sparse gas lamps, cabs, railings and bollards, filtered against
   every station (the ambient-actor rule).
8. **Not done:** river + bridges. **9 (deferred by the brief):** pre-rendered sprites.

**Era moved to 1925.** The director ruled 1907 anachronistic for a prominent taxi
mode; [decision 0023](docs/decisions/0023-era-1925.md) moves the presentation era to
1925 (interwar). The no-scooter and keep-special rules stand; mode names are
unchanged.

**Rejected alternatives**

1. **Keep 2x2 cells / long terraces with no gaps.** Rejected after the visual
   review: the result read as stacked boxes. Gaps and mixed footprints won.
2. **Keep solid black cast shadows and a thick street outline.** Rejected: they
   filled the alleys and made streets read as drawn borders. Hatched shadows and a
   faint curb keep the paper visible.
3. **Invent landmark geometry in the renderer.** Rejected: landmark kinds stay map
   data (decision 0021); only drawing is client-side.
4. **Change rules numbers with the era.** Rejected: 1925 is presentation; tickets,
   modes and the graph are untouched.

**Verified.** `pnpm install` (exit 0); `pnpm typecheck` (all workspaces); `pnpm test`
**7 files / 136 tests**; `pnpm build`; `pnpm check:docs` (59 markdown files; 7 test
files / 136 tests). Browser at 1440x900 and 390x844, `?skin=vintage` and
`?skin=basic`, fugitive and Agent Practice: a first taxi move advances turn 1 to 2
through the projected overlay; no console/page errors; no document overflow.
Fixtures were regenerated with `WRITE_MAPS=1`; graph and station positions were
unchanged.

**Known limits.** River/bridges and the sprite/texture phase remain open. The Canvas
detail pass is heavier than the culling-only plate; the play-view drag was not
re-benchmarked in this round. Basic uses a generic civic hall for the new kinds;
Iron/Night keep their generic market fallback.

---

## 2026-11-12 — Yard Board is the default city skin (round 08)

**The request.** The director put the live Vintage plate beside a photograph of
the original *Scotland Yard* board and asked for a closer match, then approved the
round-08 study's direction and asked for the implementation. The study's two
visible defects — ink edges running down the middle of streets ("pipes") and
floating gable-end triangles between houses — were study-renderer artifacts; the
live implementation deliberately does not copy the study's street or roof drawing.

**What was built.**

1. **A `board` skin and `BOARD` theme, now the default.** It renders through the
   existing `CanvasCity` and the true 2:1 projection. `vintage` stays selectable
   and `basic` stays the fallback; `MapStage` includes both Canvas skins in the
   iso projection and passes the active theme to the overlay.
2. **One station grammar for every skin.** The numbered disc is uniform with the
   number inside and an ink ring; bus/metro/special are a keylined colour arc on
   the rim in a fixed slot; node-class colour, the external `n11` label and the
   `B`/`M`/`S` letters are gone. Class and the mode list stay in the station card
   and `<title>`. Legal destinations are hollow rings, so they never cover the
   disc or its collar.
3. **Printed route ribbons.** Every permanent link uses the theme's route colour,
   a thicker core and an ink keyline instead of the cream halo; legal moves and
   the route key use the same colour table.
4. **Landmark plaques.** The overlay draws the real `LandmarkModel.label` names
   as plaques at a constant screen size, clamped to the viewport and reduced to
   the four anchors at whole-city zoom. Landmark anchors are projected by
   `projectMap` so they share the station projection. The Basic plate's own
   labels were removed; the overlay is the only source of names.
5. **Roof-first houses.** `city.ts` splits wide/deep footprints into 2–3 house
   terraces (`splitTerrace`), varying wall and roof per unit: 225 → 418 houses
   for the 96-station fixture. The Board plate lowers building massing, removes
   hatching, cast shadows, dormers, lane markings, paper grain and furniture, and
   uses a heavier uniform ink contour.
6. **Paper streets without the pipes.** `CanvasCity` draws every street's ink
   edge in a first pass, then every paper carriageway in a second. The per-street
   ink-then-paper loop is what put ink through junctions; the two-pass version
   merges cleanly.

**Why.** The board's information hierarchy is the opposite of the Vintage plate's:
the landmarks, numbered discs and routes are the strongest layers, and the
buildings are a quiet roofscape. The director's comparison made that the priority.

**Rejected alternatives.**

1. **Retune Vintage in place.** It would delete the approved etched plate and the
   side-by-side comparison that the decision needs; both skins now exist.
2. **Keep Board as a developer-only skin.** The request was to see the game in
   this direction, so it is the default; `?skin=vintage` and the dev selector
   still reach the etched skin.
3. **Copy the study's street/roof renderer.** Rejected on the director's own
   review: per-street ink passes create "pipes", and the simplified gable end
   leaves triangles. The live renderer uses the existing prism/roof faces and the
   two-pass streets.
4. **Print landmark names in the plate renderer.** Plate text scales with zoom
   and cannot be hidden by LOD; plaques belong in the overlay, which already has
   the map data.
5. **Change the projection to match the board's hand-drawn aerial view.**
   Rejected: the 2:1 projection is shared by plate, camera, overlay, tokens and
   ghost, and decision 0010 keeps routes on the streets.

**Verified.** `pnpm typecheck` (all workspaces); `pnpm test` 7 files / 136 tests;
`pnpm build`; `pnpm check:docs`. Live browser runs at 1440×900 and 390×844 with
`?skin=board`, `?skin=vintage` and `?skin=basic`: no page errors. A 1440×900
play-view drag measured ~18.2 ms/frame (p95 25.9) for Board and ~16.7 ms (p95
20.3) for Vintage; the 390 DPR 2 numbers were not re-taken.

**Known limits.** River and bridges (round-07 item 8) and the pre-rendered sprite
phase remain open. The play camera still clamps to the projected bounding box, not
the city parallelogram, so the north-east margin can show as empty paper — a
pre-existing composition issue. Landmark compounds are still house-scale. Basic
is denser after the terrace split. The node-class colour is retired from the
overlay by [decision 0024](docs/decisions/0024-yard-board-skin.md).

---

## 2026-11-12 — Board presentation pack: paper HUD, print pass, named streets, camera fill

**The request.** After the Yard Board skin shipped, the director asked for a
one-hour pack of improvements with a solid perceived upgrade, explicitly leaving
the river out. Four were applied; the fifth (a landmark lift) was rejected by the
director mid-pass.

**What changed.**

1. **Paper HUD for the Board skin.** `.proto.skin-board` now themes the header,
   side panel, kit cards, public log, map toolbar, legend, station card, result
   overlay and role chooser as paper-and-ink surfaces. The layout, sizes and
   interaction are unchanged, and the Vintage and Basic HUDs are untouched.
2. **Print pass.** The Board theme gained a pale-yellow `stationDisc`; station
   numerals and landmark plaques use a serif stack with wider tracking and a
   heavier plaque border. The whole-city view carries a printed cartouche,
   compass and scale bar, shown only in map view so it never covers play.
3. **Named streets.** Six roads at play zoom carry names derived from the nearest
   landmark (`Cathedral Road`, `Station Road`, `Museum Lane`, `Market Road`, …).
   The names are generated client-side from `CityStreet.rank` and the landmark
   kinds; they are presentation labels, not map data, and disappear below play
   zoom. The overlay projects `city.streets` in `projectMap` to draw them.
4. **Camera fill.** `clampCameraToPlate` shifts the play camera so its view
   rectangle sits inside the projected city parallelogram, with a focus-safe
   fallback that tries softer corrections until the Fugitive and legal
   destinations are at least 54 px from the frame edge. It runs only on stages at
   least 720×480: on a 390×844 phone the motion banner covers the top, and
   clamping pushed the Fugitive under it. The map view is unchanged.

**Rejected alternative — landmark lift.** Scaling the four anchors by 1.35× (and
raising their plaques) was implemented but reverted on the director's steer:
making landmarks taller to read is not scalable because they cover streets and
buildings. Presence should come from the plaque and, later, a compound footprint,
not from height. This is now recorded in `VISUAL_DIRECTION.md` decision 18 and in
the status known-deviations.

**Why.** The paper HUD was the largest screen-level gap: the map had become
board-like, but the dark chrome kept the whole screen reading as a web app. The
print pass and street names add authored detail without touching map data; the
camera clamp removes the empty plate corner on desktop.

**Verified.** `pnpm typecheck`; `pnpm test` 7 files / 136 tests; `pnpm build`;
`pnpm check:docs`. Live runs at 1440×900 and 390×844 for Board, Vintage and Basic
with no page errors. The play view now fills the frame at 1440 with the Fugitive
and all four legal destinations visible; the phone keeps the follow framing and
shows the Fugitive and destinations. The 390 clamp disable and the landmark
revert were re-shot.

**Known limits.** The map view still prints the plate on paper with its cartouche
(deliberate). Street names can repeat a landmark word with different suffixes. The
landmark compound footprint and the river remain open. The paper HUD is a Board
skin surface only; the other skins keep their own HUD.

---

## 2026-11-12 — Building correctness: closed gable ends, cathedral tower, parks-only trees

**The review.** On the latest Board screenshots the director flagged three
building-level defects: an empty triangle under some roofs (the gable end was an
opening), the cathedral tower appearing in the middle of the facade, and trees
appearing on top of houses or in random places. The landmark enlargement from the
presentation pack was also rejected: tall landmarks cover streets and buildings
and do not scale.

**What changed.**

1. **Gable ends are closed.** `drawGableRoof` now takes the wall colour and fills
   the near gable-end triangle in wall colour with the ink outline. The previous
   version drew only the two roof planes, so the gable end read as an empty
   triangle through to the paper. Dormers, houses, cathedral, market, church and
   university all use the same fix.
2. **The cathedral tower moved to the east end of the nave.** It was drawn at the
   nave centre, after the nave, so it covered the rose window and read as a tower
   in the middle of the facade. The rose window is now visible; the tower/spire
   sit at the end of the nave.
3. **Landmark layering.** The town-hall tower and the museum dome are drawn
   before their porticos, so the columns and pediment stay in front. The station
   clock tower is already at the east end of its shed.
4. **Trees are parks-only.** `treesForMap` no longer scatters a street tree at a
   random point inside a built block; that point could be a roof. Park trees
   remain. The close-up confirms no tree canopy on a house.
5. **The 1.35× anchor lift was reverted**, as the director asked. Landmark
   presence is the plaque and, later, a compound footprint; not height. Recorded
   in `VISUAL_DIRECTION.md` decision 18.

**Verified.** `pnpm typecheck`; `pnpm test` 7 files / 136 tests; `pnpm build`;
`pnpm check:docs`. Close-up screenshots at 1440×900:
`design/moodboard/round-08-board/live-board-roofs-close.png` (gable ends, no trees
on roofs) and `live-board-landmarks-close.png` (cathedral tower at the nave end,
station/town-hall layering). Board, Vintage and Basic re-shot with no page errors.

**Known limits.** Gable ends are filled but not windowed; a future detail pass can
add a gable window. The cathedral tower is at the nave end rather than a crossing
tower, which is a deliberate, safe silhouette. Landmark compound footprints and
the river remain open.

---

## 2026-11-12 — Tiled plate, stable overlay, and a 6x scale rehearsal

**The request.** The director asked for another performance pass: the game was
not unusable but should be smoother, routes and houses drifted slightly apart
while the map moved, and a new map 10x the current size should be tried — then
narrowed that to **6x for now**.

**What was measured first.** Two independent defects, not one:

1. The Canvas plate drew in `useEffect`, which runs after paint, while the SVG
   overlay's `viewBox` changed during the React commit. Instrumenting the canvas
   transform and comparing it with the overlay `viewBox` showed the plate up to
   ~20 CSS px behind during a drag. That was the route/house drift.
2. Every camera frame redrew the whole visible city, and the overlay rebuilt its
   culled network paths whenever its window changed. At 576 stations a tile
   rebuild cost 100–300 ms and a wheel zoom rebuilt on every scale change,
   producing 300–560 ms frames.

**What changed.**

1. **Paint before paint.** `CanvasCity` now draws in `useLayoutEffect`. The
   canvas/overlay probe reports **0 px mismatch** through a drag at both 96 and
   576 stations.
2. **Tiled static plate.** The city renders into 256 CSS-pixel tiles. Panning
   re-blits existing tiles and paints only newly exposed ones; a one-tile ring is
   prefetched at idle. The cache is bounded at 48 tiles. Spatial grids now cover
   blocks and streets as well as buildings and trees, so a tile queries only
   nearby geometry.
3. **Whole-city overview.** A low-resolution bitmap of the city is built once per
   map/theme. It is the free map view at fit zoom (no tiles) and sits under the
   play view, so zooming out never exposes blank paper.
4. **Deferred zoom rebuild.** Tiles keep their painted scale during a zoom; a
   rebuild happens at a 2.5x scale difference or once 180 ms after the camera
   settles when the difference exceeds 1.5x. A wheel zoom no longer rebuilds the
   plate every frame.
5. **Stable overlay DOM.** The permanent network and station layers render the
   whole graph and are memoised; culling is now used only by the street-label
   search. Their sizing uses a settled scale, so a zoom gesture scales them with
   the map and snaps to constant screen size when the camera stops, instead of
   rebuilding every route and disc per frame.
6. **Generator fast path.** Above 100 stations the generator prefilters candidate
   pairs by straight-line distance, routes with A*, builds the taxi tree with one
   multi-source Prim Dijkstra, and limits the special-shortcut search to the
   taxi candidate band. `validateStreetGeometry` now uses a spatial street index.
   Maps at 100 or fewer keep the original path, so the 24/60/96 fixtures are
   byte-identical.
7. **6x fixture.** `maps/prototype-576-seed-42.json` is committed:
   `targetNodes: 576`, `encircle`, world 2940x2205 (the same station density as
   the quarter), four Agents. `?map=576` loads it through a dev-only dynamic
   import; the production build does not include it. The prototype header now
   reads the real station count.

**Why.** The director could see the misalignment during camera movement, and the
6x rehearsal needed both a generator that finishes and a renderer that does not
re-render the whole city per frame. The tile cache alone was not enough for zoom;
the overview plus deferred rebuild is what removed the per-frame rebuild.

**Rejected alternatives.** (full reasoning in decisions
[0025](docs/decisions/0025-tiled-plate-and-stable-overlay.md) and
[0026](docs/decisions/0026-six-times-scale-fixture.md))

1. **Keep the full-canvas redraw.** ~34 ms/frame (p95 93) at 96 and unusable at
   576.
2. **One viewport-sized plate cache.** Tried first; pans re-rendered the whole
   margin (100 ms+ spikes at 576) and every 18% zoom rebuilt the plate.
3. **Keep overlay culling.** Tried after tiling; a cull-window change rebuilt
   1–6k path elements during a drag and produced 100–342 ms stalls at 576.
4. **Rebuild tiles on every zoom frame.** Measured at 300–560 ms/frame at 576.
5. **Go straight to 10x.** The director called it overkill for now and the stable
   overlay has only been validated at 6x; 10x needs Canvas/windowed routes first.
6. **Keep the 1200x900 world for 576 stations.** Station spacing collapses and
   many blocks fall below the minimum house footprint; that is a cramped board,
   not a scale test.

**Verified.** `pnpm install` (exit 0); `pnpm typecheck` (all workspaces);
`pnpm test` **7 files / 137 tests**; `pnpm build` (17 modules, 223 kB — the 576
fixture is not in the production bundle); `pnpm check:docs` (61 markdown files).
Browser runs at 1440×900 for Board and Vintage at 96 and 576, and at 390×844 for
576, with no page errors. A 576 Fugitive move advances turn 1 to 2. The
canvas/overlay transform probe is exact at both scales.

Performance at 1440×900 DPR 1 (Board): 96 play drag ~17.4 ms/frame (p95 29.5,
max 45.4); 576 play drag ~17.6 ms (p95 25.0, max 42.6); steady panning 16.4/17.0;
576 free map view 16.6/17.1. A 576 wheel zoom runs at ~31 ms/frame (p95 88) while
the gesture is active and returns to 60 fps after the 180 ms settle. Generator:
576 stations generate in ~0.5 s (was minutes); the 96 fixture is unchanged.

**Known limits.** The zoom gesture is still limited by the full SVG overlay DOM
(~6.6k elements at 576); 10x/50x needs Canvas or windowed routes. The free map
view is a bitmap at fit scale and softens if zoomed far past the overview
threshold. The first pan over uncached tiles and the settle rebuild after a zoom
are the remaining one-off costs. The 390 DPR 2 numbers and the Vintage 6x drag
were not re-taken.

---

## 2026-11-12 — Interactive demo setup: map, turns, tickets and side

**The request.** The director asked for an interactive demo to try different
parts of the game: choose an existing map or generate a new one (size, route
density, etc.), choose the total number of moves, choose how many tickets are
available, and choose whether to play as the Fugitive or the detective side.
Skins had to stay available.

**What was built.**

1. **A setup screen** at the prototype route, before the table. It offers:
   - **Map:** a committed fixture (24 / 60 / 96 / 576 stations) or a generated
     map with station count, local route density (sparse / standard / dense),
     Agent count (1–6), close/far starts and a seed (with a randomise button).
   - **Yard length:** 4–32 total turns. Appearances are derived from the same
     relative points as 5/10/15, so a 16-turn Yard is byte-identical in rules to
     the old table and a short Yard still has three appearances.
   - **Tickets:** per-role taxi, bus, metro, special and foot budgets, prefilled
     from the engine's provisional prototype defaults.
   - **Side:** Fugitive or Agent (`Falcon` on the Agent side), plus the skin
     selector. The game header keeps the skin selector and adds **Setup** so the
     config can be changed without reloading.
2. **Engine setup overrides.** `createPrototypeGame` accepts an optional
   `PrototypeSetup`; `PrototypeState` records `turnLimit` and
   `appearanceTurns`, and resolution/capture uses those instead of module
   globals. Defaults still come from the ratified constants.
3. **Generator route density.** `MapOptions.routeDensity` scales only the extra
   local taxi links and their reach. `standard` reproduces the existing graph;
   committed fixtures now record `params.routeDensity: 'standard'`.
4. **Generated map sizing.** The demo scales the world with the station count so
   a generated Yard keeps roughly the 96-quarter density instead of shrinking
   blocks below a readable footprint.
5. **Skins stay shared.** The skin picker is on the setup screen and in the game
   header, and the setup screen itself uses the active skin.
6. **Tests.** Four engine tests cover custom turns/appearances, custom ticket and
   foot budgets, ending at the configured limit, and invalid setups. One
   generator test covers sparse/standard/dense validity and ordering.

**Why.** The engine was the right place for the turn/ticket overrides: a demo
that hard-coded its own play table would drift from capture, appearances and
Agent Practice. The generator option is scoped to the local taxi extras because
that is the only route budget with a clean demo meaning; the bus/metro tiers and
the spanning tree stay the game's contract.

**Rejected alternatives.** (full reasoning in
[decision 0027](docs/decisions/0027-interactive-demo-setup.md))

1. **Hard-code demo presets in the client.** They would duplicate provisional
   numbers and go stale.
2. **Mutate the global turn/ticket constants at runtime.** It would break the
   `PROVISIONAL_` inventory and deterministic state; the setup is passed as
   state.
3. **Fork a second play table for the demo.** The reveal, capture and Agent
   Practice rules would drift.
4. **Put the demo config on the server.** There is no `projectState` yet and
   this is a local dev table.
5. **Offer 10x/50x sizes now.** The overlay is validated at 6x; larger maps need
   Canvas/windowed routes first.

**Verified.** `pnpm install`; `pnpm typecheck`; `pnpm test` **7 files / 142
tests**; `pnpm build` (17 modules, 223 kB — the demo, generator import and 576
fixture are not in the production bundle); `pnpm check:docs`. Browser runs at
1440×900 and 390×844 with no page errors: default 96 existing map; a generated
24-station sparse Yard with 3 Agents, 8 turns, custom tickets and the Agent side;
a generated 192-station dense Yard on the Fugitive side; the committed 576
rehearsal; and a skin switch from Board to Vintage inside the game. The 8-turn
header shows `/ 8` and appearances `3 5 8`; the Agent kit shows the configured
ticket counts.

**Known limits.** The demo is dev-only and the setup screen drops out of the
production build. Station counts stop at 576 because the stable SVG overlay is
the next scale limit. Generated maps are schematic districts, not authored
boards; route density only changes local taxi links. The setup screen adds no
server or wire protocol.

---

## 2026-11-12 — Routes under houses, legal-move glow, and dash grammar

**The review.** The director flagged three route-display problems: sometimes two
same-colour routes appeared side by side (e.g. two taxi lines), routes painted on
top of houses looked unnatural, and a green dotted route was unexplained.

**Diagnosis.**

1. The legal move was drawn as a cream-underlay ribbon plus a mode-colour ribbon
   over the permanent route. The geometry matched the network path exactly, but
   the pair read as a second same-colour route, especially where the permanent
   casing and the legal underlay met.
2. Every permanent route lived in the SVG overlay above the Canvas city, so it
   was painted on the roofs rather than printed on the streets.
3. Bus is green and dashed/dotted; special is purple dotted; foot is a fine
   dark dotted line. The legend used solid swatches, so the green dashed bus
   route looked like a new kind of line.

**What changed.**

1. **Shared route grammar.** Widths, offsets, colours, dashes and polyline
   offsets now live in `apps/web/src/prototype/routes.ts`, used by both the
   Canvas plate and the overlay.
2. **Plate routes for Board/Vintage.** Permanent routes are drawn after the
   streets and before the buildings: a house covers the route where it stands in
   front. A 10% trace pass after the buildings keeps the route followable over the
   roofs.
3. **Semi-transparent crossed houses.** A house is tested against the route grid
   in screen space; only a route behind it (lower unprojected `x + y`) marks it.
   That house is drawn at 84% alpha, so the route reads through the roof at low
   strength without making whole rows look like glass.
4. **Legal moves are a glow.** The cream underlay and second ribbon are gone; a
   13 px low-opacity mode-colour glow plus a 2.4 px centreline sits exactly on the
   permanent route.
5. **Dash grammar is aligned and visible.** Bus uses a 9/5 dash, special a 3/5
   dot, foot a 1.5/5 dot; the casing follows the same dash so the gaps show paper
   rather than solid ink. The map legend now draws each swatch with its real dash.
6. **Basic/RTS keep the overlay network.** They do not use the Canvas plate, so
   `PrototypeMap` renders the full network layer only for those skins.

**Rejected alternatives.** (full reasoning in
[decision 0028](docs/decisions/0028-routes-under-houses-and-legal-glow.md))

1. **Leave routes above the houses.** The core complaint would remain.
2. **Use one uniform faint route pass over every roof.** Tried first; it read as a
   line painted on the roof, not seen through the house.
3. **Make every house near a route translucent.** Tried; rows in front of the
   route washed out. The behind-only test plus 0.84 alpha keeps the mass.
4. **Depth-sort every route segment with the buildings.** More correct for routes
   in front, but it breaks dashes/caps at every segment and adds a large sort to
   every tile.
5. **Duplicate building silhouettes as SVG masks.** It would double the geometry
   and make the overlay heavier.

**Verified.** `pnpm install`; `pnpm typecheck`; `pnpm test` **7 files / 142
tests**; `pnpm build` (17 modules, 223.10 kB); `pnpm check:docs`. Browser runs at
1440×900 for Board and Vintage at 96 and 576, Basic/Iron/Night for fallback, and
390×844 for Board, with no page errors. The overlay DOM drops from ~1.2k to ~0.7k
elements at 96 and from ~6.6k to ~3.5k at 576. A 576 pan measures ~16.7 ms/frame
(p95 22.8); a 576 wheel zoom ~20 ms/frame (p95 47) while the gesture runs, back to
60 fps after the settle.

**Known limits.** The crossed-house effect fades the whole house, not a per-pixel
hole. Routes in front of a house still use the two-pass approximation. Basic and
the RTS skins still draw routes over houses; they remain fallback skins.

---

## 2026-11-12 — Neutral Board streets and route keyline

**The review.** The director said the Board streets had become ugly with strong
black borders and asked for neutral toning — pavement and road in different
shades of grey/brown.

**Cause.** The Board street edge and every route keyline used `theme.shadow`, the
same near-black ink as building outlines. Once the routes moved into the plate,
that shared ink made the whole street network read as black borders.

**What changed.**

1. **A Board street palette** on the theme: `streetEdge` (`#b7a68a`),
   `streetPavement` (`#e4d9c4`) and `streetFill` (`#cec2ac`). The plate draws the
   edge, then the pavement strip, then the carriageway.
2. **A separate route keyline**: `routeCasing` (`#7f6f57`) replaces the ink
   shadow for route ribbons. Routes stay keylined, but not black-edged.
3. **Building ink stays ink.** `shadow` remains the strong building/landmark
   outline. The fields are optional, so Vintage, Basic and the RTS skins keep
   their existing street grammar.

**Rejected alternatives.** Keeping the black street outline (the complaint),
reusing `shadow` for routes (couples the keyline to building ink), one flat grey
road (loses the pavement/kerb read), or changing every skin's streets (Vintage and
Basic/RTS have their own grammar). Full reasoning in
[decision 0029](docs/decisions/0029-neutral-board-street-palette.md).

**Verified.** `pnpm install`; `pnpm typecheck`; `pnpm test` **7 files / 142
tests**; `pnpm build` (17 modules, 223.10 kB); `pnpm check:docs`. Browser shots at
1440×900 for Board 96/576 (play, map, close), Vintage 96/576, Basic/Iron/Night
fallback and Board 390, with no page errors. The Board streets now read as warm
grey-brown pavement and carriageway instead of paper with a black outline; route
ribbons keep a soft keyline.

---

## 2026-11-12 — Route cutouts replace whole-house alpha

**The correction.** The director saw that almost every house had become
semi-transparent after the route-occlusion pass. The intent was only to see the
coloured route where it passes behind a house — not to fade the house or let the
street show through.

**Why it happened.** The first implementation marked a whole house as translucent
when any route crossed its screen silhouette. On a dense board most houses back
onto a routed street, so most of the city was faded. The 84% house alpha also let
the street and ground beneath show through the walls.

**What changed.**

1. The building/tree/landmark scene is drawn to a transparent **layer**.
2. The visible route paths are stroked into that layer with
   `destination-out` and `PROVISIONAL_ROUTE_CUTOUT_ALPHA = 0.4`, using a band the
   width of the route casing.
3. The layer is composited over the plate. Only that narrow route band is
   semi-transparent; the house, street and ground stay opaque everywhere else.
4. The per-building `routeCrossed` flag, behind-depth test and 84% whole-house
   alpha are gone. This supersedes only [decision 0028](docs/decisions/0028-routes-under-houses-and-legal-glow.md)'s
   house-transparency point; the plate routes, legal glow, route grammar and dash
   legend stand ([decision 0030](docs/decisions/0030-route-cutouts-not-house-alpha.md)).

**Rejected.** Whole-house alpha (the complaint), behind-only whole-house alpha
(still fades the building), low-alpha route on top of the roof (looks painted on),
full-alpha cutout (too strong), or per-pixel SVG silhouette masks (duplicates the
building geometry).

**Verified.** `pnpm typecheck`; `pnpm test` **7 files / 142 tests**; `pnpm build`
(17 modules, 223.10 kB); `pnpm check:docs`. Board and Vintage screenshots at 96
and 576, close-up and map; the route channel through houses is now narrow, houses
keep their mass, and no street/ground bleeds through. Panning stayed at
~16.6 ms/frame (p95 24) and the 576 wheel zoom at ~20 ms/frame while moving.

---

## 2026-11-12 — Softer house and landmark outlines

**The review.** The director said the house outlines still looked too strong and
dark on both Board and Vintage.

**Cause.** Every house, roof and landmark stroke used `theme.shadow`, the
near-black ink shared with labels and Vintage's cast shadows. The new neutral
streets made the remaining black house outlines more conspicuous.

**What changed.**

1. `RtsTheme` gained optional `outline` and `outlineScale`.
2. Canvas building, roof, landmark, tree and furniture linework now uses
   `ink(theme) = theme.outline ?? theme.shadow`.
3. Board uses `#806e55` at 0.75× line width; Vintage uses `#5c4833` at 0.8×.
4. Cast shadows still use `shadow`, labels/station rings still use `label`, route
   keylines still use `routeCasing`, and Board street edges keep the neutral
   street palette. Basic/Iron/Night fall back to `shadow` unchanged.

**Rejected.** Keeping `shadow` (the complaint), lightening `shadow` globally
(would weaken labels and cast shadows), removing outlines (roof planes lose
definition), or changing only one skin (both had the same ink).
[Decision 0031](docs/decisions/0031-softer-house-outline-ink.md).

**Verified.** `pnpm typecheck`; `pnpm test` **7 files / 142 tests**; `pnpm build`
(17 modules, 223.10 kB); `pnpm check:docs`. Board and Vintage screenshots at 96
and 576 (play, map, close) show softer brown-sepia linework while labels, discs,
shadows and route keylines keep their contrast. No page errors.

---

## 2026-11-12 — Delivery jobs (prototype)

**The request.** Give the Fugitive a second goal beyond survival: pick up a
shipment at a public place and deliver it for cash. The director set the shape:
jobs at random public places (not one Black Market), one active job at a time,
public pickup and private delivery, explicit Collect/Deliver actions that consume
the turn, no cargo restrictions or job time limits yet, and £10 per delivery in a
per-Yard cash total.

**What changed.**

1. **Engine.** `PrototypeState` now carries `jobs`, `activeJobId`, `cash`,
   `jobsDelivered` and the normalised public `jobPickups`. One offer spawns at
   the start of turns 1, 6, 11, … and expires after five unclaimed turns. A job
   is collected only at its pickup, delivered only at its destination, and only
   one can be active; Collect/Deliver end the Fugitive turn. Pickup appends the
   only public job log row; delivery adds no public row. Delivery pays £10 once.
2. **Generation.** Pickups are landmark-adjacent stations passed in from the
   map; destinations are any other station. Titles/icons come from a seeded
   catalogue; the offer is deterministic from the Yard seed and turn.
3. **UI.** A Fugitive-only **Smuggling jobs** panel shows the active job and
   offers (pickup, drop, prize, expiry), with Collect/Deliver buttons. Clicking a
   job reveals its destination marker. The map draws shipment badges at pickup
   stations and a flag/ring at the selected or active drop. Agents see only the
   public pickup marker; delivery stays private. The result screen shows cash,
   deliveries and a lost-shipment note.
4. **Bot.** The bot Fugitive collects the earliest expiring reachable offer and
   heads for the drop, then falls back to evasion.
5. **Tests.** Cadence, expiry, pickup location, explicit turn-consuming actions,
   one active job, public pickup/private delivery, payout and the bot commands
   are covered in `prototype.test.ts`.

**Rejected.** A fixed Black Market source (jobs are at random public places),
free Collect/Deliver (the turn cost is the risk), a public drop or delivery (it
would let Agents camp), multiple active jobs (future multi-Fugitive work), job
deadlines, and implementing ticket-buying/persistent cash in this slice. Full
reasoning: [decision 0032](docs/decisions/0032-delivery-jobs-prototype.md).

**Verified.** `pnpm install`; `pnpm typecheck`; `pnpm test` **7 files / 148
tests**; `pnpm build` (17 modules, 223.10 kB); `pnpm check:docs`. Browser checks:
the Smuggling jobs panel and map markers render on the 96 and Agent Practice
setups with no page errors; selecting a job adds its destination marker; on the
24-station fixture the Fugitive reached a pickup, used Collect, produced the
public pickup row and entered the Agent phase (the test run was then captured at
the pickup). Delivery and payout are covered by the engine tests; the browser
flow does not claim a completed drop.

---

## 2026-11-12 — Delivery jobs: final verification

After the entry above, one more engine test was added for the bot's path toward a
reachable pickup. The current suite is **7 test files / 149 tests**, and
`pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
`pnpm check:docs` all pass. No further code changes followed that run.
