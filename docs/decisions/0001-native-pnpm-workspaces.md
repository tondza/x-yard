# 0001 — Native pnpm workspaces, no task runner

**Status:** accepted (2026-10-15)

## Context

X-Yard is a four-workspace monorepo (`apps/web`, `apps/server`,
`packages/game-core`, `packages/shared-types`), solo-developed and low-budget,
maintained largely by autonomous agent sessions that must be able to run the full
suite with one command.

## Decision

Use native pnpm workspaces with exactly two globs — `apps/*` and `packages/*`.
Adding a workspace means adding a directory, not editing a build graph.

## Rejected alternative

**Turborepo, Nx, or Lerna.** Rejected for three reasons: a task-runner config is
another artifact an agent session can corrupt or misunderstand; the dependency
graph is four nodes and one-way, so there is no scheduling problem to solve; and
the director chose native workspaces deliberately.

## Consequences

- `pnpm test` / `typecheck` / `build` are `pnpm -r --if-present run <script>`, so a
  new package is enrolled in every gate by having the script, and skipped if not.
- **No caching, no affected-only runs, no remote cache.** Every gate runs
  everything. With `game-core` at ~0.3 s that is currently a feature: the gate is
  cheap enough to run repeatedly mid-task.
- If the repository ever grows past a handful of packages, this decision is the
  first thing to revisit — and the cost of revisiting is low precisely because
  nothing depends on a task-runner API.
