# 0002 — Vitest is a root dev dependency only

**Status:** accepted (2026-10-15)

## Context

`packages/game-core` must be pure and auditable: the director's rule is that it
never gains a framework or tool dependency, and `"dependencies": {}` is the
mechanically checkable expression of that. But the engine is also where most tests
live, and those tests need a runner.

## Decision

Vitest is declared **once**, as a root `devDependency`. `packages/game-core`
declares no `devDependencies` at all and does not have its own `node_modules`.
A package with no `node_modules` still resolves `vitest` from the root by Node's
upward module resolution.

## Rejected alternative

**Per-package vitest.** Rejected because it would put a tool dependency inside the
package the director wants pristine, and it would make the purity rule something
you have to read past rather than something a glance at `package.json` confirms.

## Consequences

- The purity audit stays trivial: `dependencies: {}` and no `devDependencies`.
  [`architecture.test.ts`](../../packages/game-core/src/architecture.test.ts)
  asserts the first half mechanically.
- A root [`vitest.config.ts`](../../vitest.config.ts) is picked up by the nested
  run; per-package deviations happen in that package's `test` script instead
  (`game-core` passes `--no-isolate`).
- Adding a package that needs a genuinely different test tool means either
  accepting a root devDependency or mounting a second runner — worth noticing
  rather than doing by accident.
