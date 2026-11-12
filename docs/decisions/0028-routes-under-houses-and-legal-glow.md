# 0028 — Permanent routes are painted in the plate; legal moves are a glow

**Status:** accepted — 2026-11-12; house-transparency point superseded by [0030](0030-route-cutouts-not-house-alpha.md)

## Context

The board's routes were still messy after the camera/tile work:

- a route always sat on top of every house, so the network looked painted on the
  roofs rather than printed on the streets;
- a legal move was drawn as a cream-underlay ribbon plus a mode-colour ribbon on
  top of the permanent route. Even when the two paths matched, the pair read as
  two routes of the same colour, and a legal move was confused with a second
  taxi/bus line;
- the green dashed route was not explained by the legend, because the legend
  showed solid colour swatches while bus/special/foot use different dash patterns.

## Decision

1. **Shared route grammar.** `routes.ts` owns the mode order, widths, parallel
   offsets, colours, dashes and polyline offsetting. The Canvas plate and the SVG
   overlay cannot drift onto different sides of a street.
2. **Board/Vintage paint permanent routes in the city plate.** The strong pass
   runs after the streets and before the buildings, so a house occludes the route
   naturally. A second pass at 10% opacity runs after the buildings to keep the
   route followable over roofs.
3. **Houses crossed by a route are semi-transparent.** A building is checked
   against the route grid in screen space; only a route whose segment is behind
   the house (lower unprojected `x + y`) marks it. That house is drawn at 84%
   alpha, so the route beneath reads through the roof without making every
   visible house look like glass.
4. **Legal moves are a glow, not a ribbon.** A wide low-opacity mode-colour glow
   plus a thin 2.4 px centreline sits exactly on the permanent route. The cream
   underlay is gone, so a legal move cannot be mistaken for a second same-colour
   route.
5. **Bus, special and foot dash patterns are aligned** between the permanent
   network, the legal-move kit and the legend. The legend swatches now draw the
   actual dash, not a solid colour block.
6. **Basic/RTS keep the overlay network.** They do not use the Canvas plate, so
   `PrototypeMap` renders the full `NetworkLayer` only when the plate is not
   drawing routes.

## Rejected alternatives

1. **Keep every route in the SVG overlay above the houses.** The route remains
   painted on the roofs; the city never looks like a printed plate.
2. **Use one uniform faint overlay for all routes.** Tried. It made a route on a
   roof look like a coloured line drawn on the roof, not a line seen through the
   house; crossed-house alpha is the more natural read.
3. **Make every house with any nearby route semi-transparent.** Tried. It
   washed out rows of houses that were in front of the route. Restricting the
   mark to routes behind the house and raising the alpha to 0.84 kept the mass.
4. **Depth-sort every route segment with the buildings.** It would be more
   correct for routes in front of a house, but it breaks dashes/caps at every
   segment and adds a large sort to each tile. The two-pass plate plus
   crossed-house alpha is the affordable approximation.
5. **Build SVG masks from every building silhouette.** It duplicates the Canvas
   building geometry in the overlay and makes the overlay heavier, not lighter.
6. **Keep the legal cream-underlay ribbon.** It was the visible cause of the
   same-colour side-by-side pair.

## Consequences

- Board/Vintage permanent routes are now part of the static plate cache. The
  overlay DOM for the 96 map drops from ~1.2k to ~0.7k elements, and the 576 map
  from ~6.6k to ~3.5k; a 576 wheel zoom improves from roughly 31 ms/frame to
  ~20 ms/frame while the gesture runs.
- Basic and the RTS skins still draw routes over houses. They are fallback/detail
  skins, not the scalable path.
- A house is either fully opaque or 84% opaque; the effect is not a per-pixel
  mask. It is deliberately subtle and only applies where a route is behind it.
- The route legend now shows bus as dashed green, special as dotted purple and
  foot as a fine dotted line, matching the map grammar.
- No game data changes: this is drawing and legend only.
