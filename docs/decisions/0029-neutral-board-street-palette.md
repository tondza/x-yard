# 0029 — Board streets use a neutral pavement/road palette

**Status:** accepted — 2026-11-12

## Context

With the permanent routes moved into the plate, the Board streets and every route
keyline shared `theme.shadow` — the same near-black ink used for building
outlines. The result read as a hard black border around every street and route,
which was too harsh for the neutral 1925 board the director wanted. The request
was for pavement and road in different shades of grey/brown instead.

## Decision

1. **A separate street palette** on the theme: `streetEdge`, `streetPavement` and
   `streetFill`. Board uses a warm grey-brown edge (`#b7a68a`), a light pavement
   strip (`#e4d9c4`) and a mid grey-brown carriageway (`#cec2ac`).
2. **Three street passes** in the Board plate: edge, pavement strip, then
   carriageway. This keeps a readable curb without a black outline.
3. **A separate route keyline**: `routeCasing` (`#7f6f57`) instead of the ink
   shadow. Routes keep a keyline for legibility, but it no longer reads as a black
   border.
4. **Building ink stays ink.** `shadow` remains the dark building/landmark
   outline; only streets and route casings get the neutral palette.

The fields are optional, so Vintage, Basic and the RTS skins keep their existing
street grammar.

## Rejected alternatives

1. **Keep the black street outline.** It was the complaint; a heavy uniform ink
   line made every street read as a drawn border rather than a road.
2. **Reuse `shadow` for the route casing.** The route keyline would stay coupled
   to building ink and continue to read black.
3. **A single flat grey road.** It loses the pavement/kerb distinction and makes
   the road look like a ribbon rather than a street.
4. **Change every skin's streets.** Vintage's etched plate and Basic/RTS have
   their own grammar; this is a Board correction, not a global one.
5. **Remove the street edge entirely.** Roads then merge into the paper blocks
   and the board loses its street hierarchy.

## Consequences

- Board streets read as warm grey-brown pavement/road with a soft edge; the
  building/landmark ink remains the strong outline.
- Route ribbons keep a keyline, but in the softer route-casing tone.
- No map data, route geometry, or gameplay changes. The other skins are
  unchanged.
