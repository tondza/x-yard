# 0003 — Workspaces are consumed as TypeScript source, not built to `dist`

**Status:** accepted (2026-10-15) — **revisit if a package is ever published**

## Context

`apps/server` and `apps/web` both consume `packages/game-core` and
`packages/shared-types`. The conventional monorepo arrangement builds each library
to `dist/` and points consumers at the build output, which requires an ordering
layer (`tsc -b` references, or a task runner with a dependency graph).

## Decision

Each package's `main` and `exports` point straight at `./src/index.ts`. Consumers
are bundled or executed by tooling that transpiles TypeScript directly (`tsx` for
the server, Vite for the web app).

## Rejected alternative

**Build-then-consume.** Rejected because for a solo, low-budget project it adds an
entire build-orchestration layer — plus a stale-`dist` failure mode where a
consumer silently tests last week's engine — in exchange for a publishable
artifact nothing currently needs.

## Consequences

- No build step, no `dist` staleness, and no inter-package ordering to get wrong.
- **`rootDir` must stay out of the apps' tsconfigs**, or TypeScript rejects files
  pulled in from sibling packages (TS6059). This is why the apps' configs set
  `noEmit` and omit `rootDir`.
- The `game-core` tsconfig does set `rootDir`/`outDir` for its own `--noEmit`
  typecheck, but declares no `build` script, so `pnpm build` is a no-op for it.
  Do not read "`pnpm build` passed" as "the engine compiled to `dist`".
- **Revisit trigger:** publishing any package, or wanting consumers outside this
  repository.
