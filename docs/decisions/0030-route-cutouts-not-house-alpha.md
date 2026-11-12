# 0030 — Route visibility is a narrow cutout, not whole-house alpha

**Status:** accepted — 2026-11-12

## Context

Decision 0028 made every house whose screen silhouette intersected a route
behind it 84% opaque. On the dense 576-station board most houses face a street
with a route, so almost every house looked semi-transparent, and the street and
ground under it showed through too. The director clarified the intent: **only the
coloured route should show through, not the street itself.**

## Decision

1. Render the buildings, landmarks, trees and furniture onto a **transparent
   layer** instead of directly onto the plate.
2. After the layer is drawn, stroke each visible route path with
   `globalCompositeOperation = 'destination-out'` and a narrow band as wide as the
   route casing. Use `PROVISIONAL_ROUTE_CUTOUT_ALPHA = 0.4`, so the route beneath
   shows at roughly 40% strength.
3. Composite the layer over the plate. The house, street and ground remain fully
   opaque everywhere except the narrow route band.
4. Remove `routeCrossed` per building, the whole-house alpha, and the
   behind-only segment test. The cutout is geometric and local, not an
   interpretation of which house is "touched".

The route cutout is applied in both the play tiles and the whole-city overview.
It is also applied to trees/landmarks on the same layer, so a route passing under
them stays followable without a broad transparency effect.

## Rejected alternatives

1. **Keep whole-house alpha.** Tried; dense maps faded almost all houses and let
   the street show through the walls.
2. **Only fade houses whose route is behind them.** The behind-only test reduced
   the count but still faded whole buildings; the director asked for the route
   line, not the house.
3. **Draw a low-alpha route on top of the roof.** Tried; it reads as a line
   painted on the roof, not a route seen through it.
4. **Erase the route band at full alpha.** The route would be as strong as on the
   street, not "a bit fainter", and the hole would look cut out of the plate.
5. **Per-pixel masks from every building silhouette.** It would duplicate the
   Canvas geometry in SVG and add far more work than one layer pass.

## Consequences

- Only a narrow band around the route is semi-transparent; houses keep their full
  mass and streets do not bleed through.
- Each plate render now needs one transparent layer canvas the size of the tile
  (or overview). The measured pan/zoom frame budget was unchanged.
- The visual effect is a route channel through the house at ~40% opacity; it is
  still an approximation, since the route is not depth-sorted with the buildings.
- This supersedes only decision 0028's house-transparency point. The plate routes,
  legal-move glow, shared route grammar and legend dashes from 0028 stand.
