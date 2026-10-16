---
name: x-yard-governance-check
description: Pre-flight checklist for any X-Yard change that touches the rules engine, game numbers, wire types, tests, or documentation. Use before designing or implementing a change, when adding or altering a number, when adding a type or export, or when unsure which governance rule applies. Points to the settled decisions and past environment failures so the same mistakes are not repeated.
---

# X-Yard governance pre-flight

Run through this before designing a change. It is the compressed form of the
rules that bind this repository; the authoritative sources are linked, but you
should not need to load them to know whether a change is allowed.

## 1. Which of the three non-negotiables does this touch?

1. `pnpm test` from the repository root must pass before the task is complete.
2. `packages/game-core` keeps `"dependencies": {}` — no framework, UI library,
   `shared-types`, or Node built-in.
3. Strict mode stays on. Never weaken `tsconfig.base.json`; fix the code.

## 2. Is a number involved?

- **Stated in the brief?** It may not change without the director. Facts like the
  Sensor Sweep radius are locked by
  [`spec-alignment.test.ts`](../../../packages/game-core/src/spec-alignment.test.ts).
- **Not stated?** It must be a `PROVISIONAL_`-prefixed named constant citing its
  open question in
  [`GAME_VISION.appendix.md`](../../../GAME_VISION.appendix.md) appendix C. One
  constant per number; never inline it.
- **Never** silently promote a provisional value or a validation *warning* into a
  ratified number or an *error*.

See decision [0006](../../../docs/decisions/0006-provisional-prefix-per-constant.md)
and [0007](../../../docs/decisions/0007-two-validation-channels.md).

## 3. Does this add a type, union, or export?

- If the union already exists in `game-core`, import it. Never re-declare it —
  that is how the wire protocol drifts from the rules
  ([0004](../../../docs/decisions/0004-shared-types-imports-engine-vocabulary.md)).
- The dependency arrow is one-way: `game-core` ← `shared-types` ← apps. The engine
  never imports `shared-types`.
- Adding a *withdrawn* term is a red test. Appendix B lists what is banned; the
  guard enforces it ([0008](../../../docs/decisions/0008-rename-without-compatibility-aliases.md)).

## 4. Does this run inside `game-core`?

Determinism is a contract, not a style: no `Math.random`, `Date.now`,
`performance.now`, `crypto`, filesystem, `process.env`, or network. Randomness
comes only from the injected `RngState`. Never mutate an input. Nothing in *state*
may be a `Map`, `Set`, `Date`, class instance, function, or `undefined` — though
`Map`/`Set` are fine as transient local working memory, as `graph.ts` does.

## 5. Where does the test go?

If a pure function can decide it, it is tested in `game-core` at the unit layer —
not through the browser. Seed anything random and print the seed on failure. Use
golden vectors where the output is part of a stored replay's contract. Assert on
returned values, not thrown exceptions.

## 6. Have I checked the durable records?

Before debugging an environment or tooling failure, read
[`docs/lessons.md`](../../../docs/lessons.md) — it records measured facts (read-only
`$HOME`, volatile `/tmp`, `allowBuilds`, no root) that have already cost time
once.

Before proposing a new approach to something already decided, check the
[decision index](../../../docs/decisions/README.md). Those records carry the
*rejected* alternative and the failure mode it would have caused — which is
usually the reason your idea was already declined.

## 7. Before declaring done

```bash
pnpm verify        # install, typecheck, check:docs, build
pnpm test          # the mandated gate, from the repository root
```

Report what you actually ran and what the output was. Never claim a check passed
that you did not execute.

- A decision with a rejected alternative belongs in `docs/decisions/`
  ([how](../../../docs/decisions/README.md)).
- A measured environment fact belongs in `docs/lessons.md`.
- Progress and history belong in the append-only [`PROJECT_LOG.md`](../../../PROJECT_LOG.md).
- Current state belongs in [`docs/status.md`](../../../docs/status.md).
