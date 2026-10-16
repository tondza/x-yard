# 0007 — Graph validation splits errors from warnings

**Status:** accepted (2026-10-15)

## Context

`validateGraph` checks two very different kinds of thing: requirements the brief
actually states (edge endpoints exist, edges are symmetric, bus/metro avoid
standard street nodes, the graph is connected, at least one Black Market and one
Safe House exist) and provisional playability heuristics (degree bounds, mean
degree, taxi-only reachability, node spacing) whose thresholds come from the
appendix's *recommendations*, not from the director.

## Decision

`validateGraph` returns `{ ok, errors, warnings, stats }`. `createGraph` rejects a
board **iff `errors` is non-empty**. Warnings never block a board.

## Rejected alternatives

- **One undifferentiated problem list.** A provisional heuristic could then block
  a valid map — an appendix recommendation would silently acquire design
  authority.
- **Promoting every heuristic to an error.** Would make the real map unshippable
  on numbers nobody ratified, and would force invented thresholds into the brief.

## Consequences

- The two channels encode different authority. **A warning must never be silently
  promoted to an error.** If a heuristic starts failing on the real map, that is a
  signal to ask the director, not to break the board.
- A malformed map still fails loudly; only judgement calls are advisory.
- `graph.test.ts` asserts the split explicitly, including that Warnings 8's
  cache-pool check is map-scale and reported as a warning on small fixtures.
