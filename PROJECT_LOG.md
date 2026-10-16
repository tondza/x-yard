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
