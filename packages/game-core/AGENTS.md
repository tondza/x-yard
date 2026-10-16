# AGENTS.md — `packages/game-core`

The pure rules engine. This file loads automatically when a session first
reads or edits a file in this directory. Its rules are stricter than the root
[`AGENTS.md`](../../AGENTS.md), and they are not stylistic preferences — they are
the properties that make a Yard replayable from seed + event log.

Full rationale: [`AGENT_RULES.md`](../../AGENT_RULES.md) §1–§6.

## Purity

`package.json` must keep `"dependencies": {}`. Zero runtime dependencies. This
package must run unmodified in a browser, in Node, and in a test runner.

**Forbidden imports here:** `shared-types`, React, Fastify, Socket.io, any Node
built-in (`node:fs`, `node:crypto`, `node:process`, …), any browser API.

`shared-types` imports *from* this package. The reverse never happens.

## Determinism

**Banned outright:** `Math.random`, `Date.now`, `performance.now`, `crypto`, the
filesystem, `process.env`, any network call.

Randomness comes only from the injected `RngState` (`rng.ts`). Wall-clock time
may decide *when* something happens, never *what* happens — a timeout produces a
`CommandTimedOut` event carrying a move computed by a pure `chooseAutoMove(state)`.

**Never mutate an input argument.** Transitions return new state.

**Banned inside state:** `Map`, `Set`, `Date`, class instances, functions, and
`undefined`. `GameState` must survive `JSON.parse(JSON.stringify(...))` — that is
what makes `hashState` unambiguous, and why `Map`/`Set` are out (their iteration
order is not part of the JSON contract).

## Numbers

Every number the brief does not state is a `PROVISIONAL_`-prefixed export citing
the open question it stands in for. Never inline a magic number; never fold a
provisional value into a differently named constant; never let one reach the wire
layer unlabelled. `grep -rn PROVISIONAL_` must stay the complete inventory.

When the director answers a question: promote the number into
[`GAME_VISION.md`](../../GAME_VISION.md) §1–§6, rename the constant out of
`PROVISIONAL_`, strike the appendix entry, and update
[`spec-alignment.test.ts`](src/spec-alignment.test.ts) — **in one change**.

## Tests

Test placement rule: **if it can be decided by a pure function, it must be tested
here at the unit layer**, not through the browser.

- Headless and fast: Vitest, default `node` environment. No DOM, no network, no
  filesystem, no clock.
- Deterministic: inject a seed, assert exact values. A randomised test must be
  seeded and must print its seed on failure.
- Golden vectors where exact output is part of a stored replay's contract —
  `rng.test.ts` is the reference example.
- Value-based failures: assert on `{ ok: false, reason: … }`, not on a throw.
- Test names state the rule: *"rejects a one-way edge, which MVP forbids"* beats
  *"validateGraph works"*.
- Never snapshot the whole `GameState` blob — assert on the specific field.

Forbidden in these tests: real timers, real network, file reads/writes, asserting
on `console.log`, fixed `sleep`.

## Layout note

Modules are currently flat (`types.ts`, `graph.ts`, `tickets.ts`, `rng.ts`,
`demo-board.ts`). The brief cites a nested layout (`src/types/graph.ts`,
`src/map/generate.ts`); the divergence is recorded in
[`PROJECT_LOG.md`](../../PROJECT_LOG.md) and is to be revisited when the turn
machine lands. `demo-board.ts` is a **fixture**, not the shipped map.
