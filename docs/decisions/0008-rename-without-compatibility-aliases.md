# 0008 — Vocabulary was renamed in place, with no compatibility aliases

**Status:** accepted (2026-10-15)

## Context

The director replaced the game vision wholesale: the single hidden player "Mr. X"
and role `detective` became plural **Fugitives** / **Agents**, public cache nodes
were replaced by contraband missions and Safe House extraction, fixed
`cold-drop`/`blitz`/`marathon`/`tutorial` contracts were replaced by multi-Yard
instances, `ferry` became `special`, and "round"/"match" became **turn**/**Yard**.

## Decision

Rename in place. Withdrawn names were removed from types, exports, and prose
immediately, and a guard in
[`spec-alignment.test.ts`](../../packages/game-core/src/spec-alignment.test.ts)
fails the suite if any of that vocabulary reappears in the public API. The
superseded concepts are documented in
[`GAME_VISION.appendix.md`](../../GAME_VISION.appendix.md) appendix B.

## Rejected alternative

**Keeping `mr-x` / `detective` / `ferry` aliases for a transition period.**
Rejected because aliases keep the withdrawn design alive in the public API: the
old vocabulary would still be importable, the guard would be meaningless, and a
later session reading the exports would have no way to tell which design was
current.

## Consequences

- The public API is unambiguous; there is exactly one live vocabulary.
- Renames are breaking and immediate, which is acceptable because nothing is
  published and the only consumers are in this repository.
- **Terminology is part of the contract.** Adding a withdrawn term to prose, a
  type, or an export is a red test, not a code-review discussion.
- The withdrawn list is currently a hardcoded array in the test. Extending the
  guard to read from a single exported source of truth is a tracked improvement.
