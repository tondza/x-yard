# AGENT_RULES.md

Binding rules for every agent session working on X-Yard. Read this file and
`GAME_VISION.md` before writing code.

---

## 1. The director's non-negotiables

These three rules are set by the product director and are not negotiable:

> **1. Always run `pnpm test` before declaring a task complete.**
>
> **2. Never pollute `packages/game-core` with framework or UI dependencies.**
>
> **3. Write self-documenting code with TypeScript strict mode enabled (`"strict": true`).**

Rule 1 means the full recursive suite from the repository root, not a single
package's tests. A task is not complete while any workspace test fails.

Rule 2 is absolute: `packages/game-core/package.json` must keep
`"dependencies": {}`. React, Fastify, Socket.io, Node built-ins, and browser APIs
are all forbidden there. `game-core` must run unmodified in a browser, in Node,
and in a test runner — GAME_VISION.md §6 requires a decoupled, framework-agnostic
engine, and a Yard must replay identically wherever it is evaluated.

Rule 3 is already configured centrally: `tsconfig.base.json` sets `"strict": true`
plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, and `exactOptionalPropertyTypes`. Never weaken these
to make an error go away; fix the code.

## 2. Authority order

1. `GAME_VISION.md` — authoritative for game design, numbers, and naming.
2. `VISUAL_DIRECTION.md` — director-set visual and presentation decisions (camera,
   route display, character rendering, art direction). It *refines*
   `GAME_VISION.md` and never overrides it; where a visual decision changes a rule,
   `GAME_VISION.md` must be updated too.
3. `TESTING_STRATEGY.md` and this file — authoritative for process.
4. The code.

`GAME_VISION.md` has two layers. Sections §1–§6 are the director-authored brief.
The appendix (A–C) is derived engineering bookkeeping: implementation status,
withdrawn concepts, and open questions. The appendix carries **no design
authority**; an open question is not a decision. When the director answers one,
the answer moves into the brief and the appendix entry is struck through, never
deleted.

When the brief and the code disagree, the code is the bug. Facts the brief states
are locked by `packages/game-core/src/spec-alignment.test.ts`; numbers it leaves
open are locked to the `PROVISIONAL_` naming convention (§4). If you change a
stated constant, update the brief and that test in the same change.

Terminology is part of the contract. Players are **Fugitives** and **Agents**
(roles `fugitive` / `agent`), a Fugitive is not singular and is not "Mr. X", time
advances in **turns**, and an isolated game room is a **Yard** (`YardId`). The
withdrawn vocabulary in appendix B must not reappear in prose, types, or exports.

## 3. Architecture boundaries

```
packages/game-core   pure rules engine      (depends on nothing)
packages/shared-types wire DTOs             (depends on game-core, types only)
apps/server          Fastify + Socket.io    (depends on both)
apps/web             Vite + React + Canvas  (depends on both)
```

- Dependency direction is one-way: `game-core` ← `shared-types` ← apps.
  **`game-core` must never import `shared-types`.**
- `shared-types` re-uses the engine's vocabulary (`TransportMode`, `Role`,
  `YardResult`, `NodeId`, ...) by importing it. Never re-declare a union that
  already exists in `game-core` — that is how the wire drifts from the rules.
- The server is authoritative. Never trust a client claim about its own position,
  tickets, or role.
- Hidden information is projected out inside `game-core` (`projectState`), never
  merely hidden by the client. **Not yet implemented** — see PROJECT_LOG.md.
- **Yards are isolated.** A Yard is one game-room instance (`YardId`, e.g.
  `yard-london`) with its own map, seed, seats, and turn clock. The target is
  ~1,000 parallel players spread across many Yards, so no rule may reach across
  Yard boundaries (GAME_VISION.md §6).

## 4. The PROVISIONAL_ rule

The brief pins some numbers down (Sensor Sweep's 2-node radius) and leaves many
open (ticket counts, reveal-pulse interval, turn limit, payout scale, seat
counts). Every number the brief does **not** state must be exposed as a named
constant whose identifier begins with `PROVISIONAL_`, with a comment citing the
open question it stands in for.

- `grep -rn PROVISIONAL_` is therefore the complete inventory of unratified
  defaults. Keep it complete: do not inline a magic number, do not fold a
  provisional value into a differently named constant, and do not let one escape
  into the wire layer unlabelled.
- `spec-alignment.test.ts` enforces the convention in both directions: each
  expected `PROVISIONAL_` export must exist, and no ticket, turn, grace, or
  payout constant may exist without the prefix.
- Do not add a number to `game-core` without either a brief citation or the
  `PROVISIONAL_` prefix plus an appendix cross-reference.
- When the director answers a question, promote the number into the brief (§1–§6),
  rename the constant out of `PROVISIONAL_`, strike the appendix entry, and update
  the alignment test — in one change.

## 5. Graph validation: errors vs warnings

`validateGraph` returns `{ ok, errors, warnings, stats }`, and the split is a hard
rule, not a formatting choice:

- **Errors** are requirements the brief states: edge endpoints exist, edges are
  symmetric and cost one ticket, bus and metro avoid standard street nodes, a
  node's declared modes match its incident edges, and the graph is connected.
  A map **must** contain at least one `black-market` node and at least one
  `safe-house` node or validation fails — without them Fugitives cannot accept
  contraband runs or extract (GAME_VISION.md §4). `createGraph` rejects a board
  iff `errors` is non-empty.
- **Warnings** are provisional playability heuristics: degree bounds, mean-degree
  range, taxi-only reachability, and node spacing. Their thresholds are appendix
  recommendations, not brief requirements. **A warning must never be silently
  promoted to an error.** If a heuristic starts failing on the real map, that is a
  signal to ask the director, not to break the board.

## 6. Determinism contract

Inside `packages/game-core`:

- **Banned:** `Math.random`, `Date.now`, `performance.now`, `crypto`, reading the
  filesystem, `process.env`, and any network call. Randomness comes only from the
  injected `RngState`.
- **Banned:** mutating an input argument. Transitions return new state.
- **Banned in state:** `Map`, `Set`, `Date`, class instances, functions, and
  `undefined`. `GameState` must survive `JSON.parse(JSON.stringify(...))`.
- Wall-clock time may decide *when* something happens (a timeout), never *what*
  happens. A timeout produces a `CommandTimedOut` event carrying a move computed
  by a pure `chooseAutoMove(state)`.

This is an engineering decision, not a brief statement: it is what makes a Yard
replayable from seed + event log and what makes reconnect and anti-cheat
affordable. It is also why no framework dependency may enter the engine.

## 7. Environment rules for this Codespace

These are measured facts about this machine, not preferences.

- **The workspace is the only durable writable location.** `$HOME` is read-only
  and `/tmp` is a fresh tmpfs on **every** shell invocation, so anything written
  to `/tmp` is gone by the next command. Never stage build output, caches, or
  fixtures in `/tmp`.
- **The pnpm store is redirected inside the repo.** `.npmrc` sets
  `store-dir=.pnpm-store` and `cache-dir=.pnpm-cache` because pnpm's defaults
  live under the read-only `$HOME` and every install would otherwise fail with
  `EROFS`. pnpm resolves the relative store under `node_modules/`, which is
  already git-ignored. Do not remove `.npmrc`, and do not commit the store.
- **Dependency build scripts must be allow-listed explicitly.** pnpm 12 blocks
  them by default. `pnpm-workspace.yaml` has `allowBuilds: { esbuild: true }`.
  Without it every install exits non-zero with `ERR_PNPM_IGNORED_BUILDS`. Only
  add a package here after establishing why it needs to run code at install time.
- **There is no root.** `sudo` cannot work: the DSH sandbox sets `NO_NEW_PRIVS`,
  which disables the setuid bit. `apt-get` and other system installs are
  impossible from an agent shell. Toolchains must install into the workspace
  (Python venvs, local `npm install`, `cargo`/`go` builds).
- **Only the workspace can be modified.** Everything outside
  `/workspaces/x-yard` is a read-only bind mount. A write outside it is denied.
- **Respect the file policy.** The current policy is reported in the runtime
  context (`workspace-write` by default). Do not attempt to route around a
  denial by another mechanism; if a task genuinely needs wider access, say so and
  let the approval flow decide.

## 8. Verification protocol

Run these from the repository root before declaring any task complete:

```bash
pnpm install        # must exit 0 (no ERR_PNPM_IGNORED_BUILDS)
pnpm typecheck      # every workspace: tsc --noEmit
pnpm test           # every workspace: vitest run
pnpm build          # where a build script exists
```

Additionally, when touching the server: boot it and exercise a route.

```bash
pnpm --filter @x-yard/server start &
curl -s localhost:3001/health
curl -s localhost:3001/board
```

Expected state today: 4 test files and 83 tests, all passing. The server serves
`/health` and `/board` and rejects every game message explicitly as
"not implemented" — it does not pretend to play. Report what you actually ran and
what the output was. Do not claim a check passed that you did not execute.

## 9. Code conventions

- TypeScript only. No `.js` source files.
- Import workspace types with `import type { ... }` (enforced by
  `verbatimModuleSyntax`).
- Export types and values separately in barrel files.
- Prefer pure functions and explicit `readonly` data.
- Comments explain *why*, not *what*. Every module has a short header stating its
  responsibility.
- Ordinary game conditions (no tickets, illegal move) are **returned as values**,
  not thrown. Throw only for programming errors and malformed input.
- No `console.log` in `game-core`. The server may log.
- Use the brief's vocabulary in identifiers and comments: `fugitive`, `agent`,
  `turn`, `Yard`, `underground`, `special`. Never `round`, `match`, `contract`,
  `detective`, `Mr. X`, or any other withdrawn term.

## 10. What not to do

- Do not add a monorepo task runner (Turborepo, Nx, Lerna). The director chose
  native pnpm workspaces deliberately.
- Do not add a `test` script that silently passes (for example `exit 0`).
- Do not delete or weaken a test to make a suite green. Fix the code, or change
  the brief and the test together with a PROJECT_LOG.md entry.
- Do not invent game numbers. If the brief is silent, apply the `PROVISIONAL_`
  rule (§4) and record or update the open question in the vision appendix rather
  than guessing silently.
- Do not reintroduce a withdrawn concept (vision appendix B). The
  withdrawn-vocabulary guard in `spec-alignment.test.ts` exists to make that a red
  test rather than a code review.

## 11. When to ask the director

Ask, rather than assume, when a change would:

- alter a number the brief pins down,
- add a dependency to `game-core`,
- change the wire protocol in a breaking way,
- require paid infrastructure.
