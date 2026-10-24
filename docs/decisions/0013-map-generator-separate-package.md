# 0013 — The map generator is a separate, model-first package

**Status:** accepted — 2026-10-24

## Context

The prototype needs a playable board, and the MVP needs a generator (M1 in
[`../project-plan.md`](../project-plan.md)). The first attempt reused the approved
round-03 mockup as a background plate. The director rejected it: the mockup is a
phone backdrop with ten labels on it, not a map. It has no street graph, no blocks,
no station data, no per-edge polylines, and no way to validate or scale to 24/60
nodes. That is the same "diagram of a city" mistake as round 01, one layer down.

At the same time, the rules engine must stay pure and free of authoring concerns.
`game-core` declares `"dependencies": {}`, and its architecture tests enforce the
one-way arrow.

## Decision

**Generate a data model, then render it.** The generator lives in a new pure
workspace package, `packages/map-generator`, which depends on `game-core` and is
never imported by `game-core`. It emits a `GeneratedMap`:

- city streets, blocks, parks and landmarks;
- a `TransitGraph` whose taxi/bus edges carry `GraphEdge.path` polylines;
- facilities, 1-Fugitive/4-Agent starts, stats and a validation report.

The map lab in `apps/web` is a **development-only** route (dynamic import, dev
default) that draws the model schematically and lets a person inspect seeds. It is
not the presentation renderer.

Street-following geometry is checked in `game-core` by a separate
`validateStreetGeometry(graph, streets)` function, because `validateGraph` does
not carry the city's street set. It is an error for taxi and bus edges to leave
the streets; metro and special are exempt by rule.

## Rejected alternatives

1. **Put the generator inside `game-core`.** Rejected: it mixes authoring with
   rules, and the engine is consumed as source in the browser. The generator is
   tooling; keeping it in its own package keeps `game-core`'s dependency list empty
   and its architecture test honest.

2. **Keep the mockup plate and hand-author over it.** Rejected: this is what
   failed. There is no street or station data to route, validate, seed or scale;
   every new map would be a new hand drawing, which is exactly the cost the
   generator exists to remove.

3. **Build the F-style city renderer first.** Rejected: the transit network is the
   blocker. A beautiful renderer over a graph that does not satisfy the movement
   and separation rules repeats the mockup mistake with more pixels. The schematic
   renderer is the review instrument; the art renderer is the next pass on the same
   model.

4. **Make `validateGraph` take a street set.** Rejected: the rules graph is
   deliberately independent of the city model. A separate check keeps the errors
   explicit and lets the engine's error/warning channels stay as they are
   ([0007](0007-two-validation-channels.md)).

5. **Generate fixtures at test time instead of committing them.** Rejected:
   committed JSON is reviewable, diffable, and is the exact input the playable
   prototype will load. A test regenerates each fixture and asserts equality, so
   the generator and the fixture cannot drift.

## Consequences

- The generator is pure, seeded and deterministic; the same seed reproduces the
  same map, with a recorded effective seed when a retry was needed.
- The lab shows provisional warnings (currently the mean-degree heuristic) instead
  of hiding them. Warnings are not failures.
- A presentation renderer can be replaced without touching the network logic.
- The city skeleton is deliberately schematic for now: a thinned, jittered street
  lattice. An irregular road graph, river/bridges and districts are the next
  generator step.
- The package adds a workspace but no runtime dependency; `pnpm install` links it
  and `game-core` keeps `"dependencies": {}`.
