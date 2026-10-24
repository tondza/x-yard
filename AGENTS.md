# AGENTS.md — X-Yard entry point

Read this file first. It is the map, not the territory: it routes you to the
authoritative document for the task in front of you so you never have to load
the whole governance corpus to start work.

X-Yard is an asymmetric hidden-movement deduction game (multiple **Fugitives**
vs **Agents**) on node-based transit networks. Game rooms are isolated **Yards**.
Solo-developed, low-budget, and built to be maintained largely by autonomous
agent sessions — which is why the rules engine is a pure, deterministic,
serializable state machine and why these governance files exist.

## The three non-negotiables

Set by the product director. Not negotiable, not contextual:

1. **Always run `pnpm test` before declaring a task complete** — the full
   recursive suite from the repository root, not one package's tests.
2. **Never pollute `packages/game-core`.** It declares `"dependencies": {}` and
   must keep them. No framework, UI library, `shared-types`, or Node built-in.
3. **TypeScript strict mode stays on.** Never weaken `tsconfig.base.json` to make
   an error go away — fix the code.

## Authority order

1. [`GAME_VISION.md`](GAME_VISION.md) — authoritative for game design, numbers, naming.
2. [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) and [`AGENT_RULES.md`](AGENT_RULES.md) — authoritative for process.
3. The code. When the brief and the code disagree, **the code is the bug.**

`GAME_VISION.appendix.md` is derived engineering bookkeeping with **no design
authority**. An open question there is not a decision.

## What to read, when

| You are about to… | Read |
| --- | --- |
| Start any session, any task | This file, then the most recent [`PROJECT_LOG.md`](PROJECT_LOG.md) entry |
| Touch the rules engine | [`packages/game-core/AGENTS.md`](packages/game-core/AGENTS.md) — loads automatically once you read/edit in that directory |
| Change game behaviour, numbers, or vocabulary | [`GAME_VISION.md`](GAME_VISION.md) §1–§6 |
| Write or change tests | [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) |
| Make a design or process decision | [`AGENT_RULES.md`](AGENT_RULES.md), then record it in [`PROJECT_LOG.md`](PROJECT_LOG.md); reuse a settled one from [`docs/decisions/`](docs/decisions/) |
| Hit an environment or tooling failure | [`docs/lessons.md`](docs/lessons.md) — measured facts, check here before debugging |
| Touch the client's look and feel | [`VISUAL_DIRECTION.md`](VISUAL_DIRECTION.md) (refines the vision, never overrides) |
| Work on art exploration | [`design/moodboard/README.md`](design/moodboard/README.md) — `design/` is not production code |

## Architecture (enforced, not aspirational)

```
packages/game-core       pure rules engine      (depends on nothing)
packages/shared-types    wire DTOs              (depends on game-core, types only)
packages/map-generator   seeded city + transit  (dev tooling; depends on game-core)
apps/server              Fastify + Socket.io    (depends on both)
apps/web                 Vite + React + Canvas  (depends on both; dev-only map lab uses the generator)
```

One-way only: `game-core` ← `shared-types` ← apps, and `game-core` ←
`map-generator`. **`game-core` must never import `shared-types` or the map
generator.** Never re-declare a union that already exists in `game-core` — that is
how the wire drifts from the rules.

`apps/server` is authoritative. Hidden information is projected out inside
`game-core` (`projectState`), never merely hidden by the client.

## Rules that are easy to get wrong

- **The `PROVISIONAL_` rule.** Every number the brief does not state must be a
  named constant prefixed `PROVISIONAL_`, citing the open question it stands in
  for. `grep -rn PROVISIONAL_` must stay the complete inventory of unratified
  defaults. Never inline a magic number.
- **Determinism is a contract.** In `game-core`: no `Math.random`, `Date.now`,
  `performance.now`, `crypto`, filesystem, `process.env`, or network. No mutating
  inputs. No `Map`/`Set`/`Date`/class/function/`undefined` in state — `GameState`
  must survive `JSON.parse(JSON.stringify(...))`.
- **Withdrawn concepts stay withdrawn.** `GAME_VISION.appendix.md` appendix B
  lists them; a guard test fails if that vocabulary reappears. Never reintroduce
  one without a new director decision.
- **Errors vs warnings in graph validation.** A warning must never be silently
  promoted to an error. If a heuristic starts failing on the real map, ask the
  director.
- **Ask before assuming**, when a change would alter a brief-stated number, add a
  dependency to `game-core`, break the wire protocol, or require paid
  infrastructure.

## Environment facts (measured, not preferences)

- **The workspace is the only durable writable location.** `$HOME` is read-only;
  `/tmp` is a fresh tmpfs on **every** shell invocation. Never stage anything in
  `/tmp`.
- **Never remove `.npmrc`** (`store-dir`/`cache-dir` inside the repo) or the
  `allowBuilds: { esbuild: true }` entry in `pnpm-workspace.yaml`. Removing
  either breaks every install. Details and error signatures:
  [`docs/lessons.md`](docs/lessons.md).
- **There is no root.** No `sudo`, no `apt-get`. Toolchains install into the
  workspace.
- **Respect the file policy** reported in the runtime context. Do not route
  around a denial by another mechanism; if a task needs wider access, say so.

## Verification before declaring any task complete

```bash
pnpm install        # must exit 0 (no ERR_PNPM_IGNORED_BUILDS)
pnpm typecheck      # every workspace: tsc --noEmit
pnpm test           # every workspace: vitest run
pnpm build          # where a build script exists
pnpm check:docs     # markdown links resolve; documented counts match reality
```

When touching the server, additionally boot it and exercise a route:

```bash
pnpm --filter @x-yard/server start &
curl -s localhost:3001/health
curl -s localhost:3001/board
```

Report what you actually ran and what the output was. **Never claim a check
passed that you did not execute.**

## Code conventions (short form)

TypeScript only, no `.js` source. `import type` for workspace types. Comments
explain *why*, not *what*. Ordinary game conditions are **returned as values**,
not thrown; throw only for programming errors. No `console.log` in `game-core`.
Use the brief's vocabulary — `fugitive`, `agent`, `turn`, `Yard`, `underground`,
`special` — never a withdrawn term.

## Where the rest lives

| Document | Role |
| --- | --- |
| [`AGENT_RULES.md`](AGENT_RULES.md) | Binding process rules §1–§11 — the full version of everything above |
| [`GAME_VISION.md`](GAME_VISION.md) | Director-authored design brief §1–§6 |
| [`GAME_VISION.appendix.md`](GAME_VISION.appendix.md) | Derived: implementation status, withdrawn concepts, open questions |
| [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) | Test layers, required suites, coverage gate, forbidden test patterns |
| [`PROJECT_LOG.md`](PROJECT_LOG.md) | Append-only chronological record — new entries only, never edit a past one |
| [`docs/lessons.md`](docs/lessons.md) | Measured environment and tooling facts |
| [`docs/decisions/`](docs/decisions/) | Settled decisions with the rejected alternative |
| [`docs/briefs/`](docs/briefs/) | Self-contained briefs for delegated work |
| [`docs/status.md`](docs/status.md) | Current state, edited in place — read this instead of scanning the log |
| `archive/` | Superseded approaches, kept with a `WHY_SUPERSEDED.md` |
