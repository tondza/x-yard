# 0026 — The scale rehearsal is a committed 576-station map, dev-loaded with `?map=576`

**Status:** accepted — 2026-11-12

## Context

The director asked for a new map 10x the current 96-station prototype, then
narrowed the target to 6x for now. Two things had to be true for that to be a
useful test:

- generating 576 stations had to stop taking minutes (the all-pairs street
  routing was the blocker);
- the board had to keep the 96-station *density*, otherwise the renderer would be
  tested on cramped blocks that no real map would use.

## Decision

Commit `maps/prototype-576-seed-42.json`: `targetNodes: 576`,
`startStrategy: 'encircle'`, `worldWidth: 2940`, `worldHeight: 2205`, four
Agents. The world grows by ~2.45x on each axis so the station and building
density stays close to the shipped 96-station quarter. Load it in dev with
`?map=576`; the normal prototype remains the 96-station map and the 1.9 MB
fixture is a dev-only dynamic import, not part of the production bundle. The
generator test regenerates and validates the fixture like every other map.

## Rejected alternatives

1. **Go straight to 10x (960 stations).** Rejected for now: the director called it
   overkill, and the stable SVG overlay has only been validated at 6x. 10x needs
   the canvas/windowed overlay work first.
2. **Keep the 1200x900 world for 576 stations.** Rejected: station spacing and
   block sizes collapse, many blocks fall below the minimum house footprint, and
   the result is a cramped board rather than a scale test of the real city.
3. **Regenerate the 96-station fixture at the new scale.** Rejected: the shipped
   board would move. The 96 fixture stays byte-identical.
4. **Make 576 the default prototype.** Rejected: it is a scale rehearsal, not a
   design decision. The 96-station map remains the playable target.

## Consequences

- `pnpm --filter @x-yard/map-generator test` generates 576 stations in ~0.5 s
  instead of minutes. The generator keeps its original route path for 100
  stations or fewer so the committed 24/60/96 fixtures do not move; above that it
  uses a spatial candidate prefilter, A* and a multi-source Prim tree.
- The 576 fixture is 1.9 MB of JSON. It is only fetched with `?map=576`; the
  production build does not include it.
- The 6x board is a smoke test, not a new default: the turn loop, reveals and
  Agent Practice still use it, and the map/lab routes are unchanged.
