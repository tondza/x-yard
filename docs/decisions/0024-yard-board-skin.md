# 0024 — The Yard Board skin is the default city presentation

**Status:** accepted — 2026-11-12

## Context

The director compared the live prototype with a photograph of the original
*Scotland Yard* board and asked for a closer match. The gap was not palette but
graphic grammar:

- the board's stations are one numbered disc, not a class-coloured ring plus a
  floating `n11` label and `B`/`M`/`S` letters;
- its routes are thick, keylined ribbons, not thin lines with a cream halo;
- its houses are short and roof-first, and its streets are paper corridors;
- its landmarks are large compounds with printed names.

A round-08 study (`design/moodboard/round-08-board/`) re-drew the real Cathedral
Quarter in that grammar. The director approved the direction and asked for the
implementation. The study also exposed two drawing defects that the live
renderer must not inherit: per-street ink passes left ink lines down the middle
of streets at junctions ("pipes"), and the study's simplified gable ends left
floating triangles between houses.

## Decision

Add a **`board` skin** rendered by the existing `CanvasCity` with a new `BOARD`
theme, and make it the **default** prototype skin. `vintage` (etched sepia) stays
selectable, and `basic` stays the fallback. The board look is:

1. **Stations.** One paper disc with the station number inside and a uniform ink
   ring. Bus/metro/special become a keylined colour arc on the rim, in a fixed
   slot; taxi is universal, so a plain disc is the norm. Node-class colour and
   the `B`/`M`/`S` letters are gone; class remains in the station card.
2. **Routes.** Thick ribbons with an ink keyline and no cream halo. The
   permanent network and legal moves share the same colour table as the kit.
3. **Houses.** Short, roof-first massing; wider generated footprints are split
   into 2–3 house terraces in `city.ts` (225 → 418 houses) with varied wall and
   roof tones. No dormers, hatching or cast shadows in the board renderer.
4. **Ground.** Paper streets with two-pass ink edges — every ink edge is drawn
   before every carriageway, which removes the junction "pipes".
5. **Landmarks.** The plates keep their geometry; names are printed as overlay
   plaques from the real `LandmarkModel.label`, so they stay constant on screen
   and are hidden below whole-city zoom except for the four anchors.

The overlay grammar is shared by every skin. Vintage's plate still renders its
etched city, but its nodes, routes and labels use the same clearer language.

## Rejected alternatives

1. **Retune Vintage in place.** Rejected: it would delete the director-approved
   etched plate and remove the side-by-side comparison that the decision needs.
2. **Keep Board as a developer-only skin.** Rejected: the request was to see the
   game in this direction. A skin hidden behind a dev selector does not deliver
   that, and the director can still switch back to Vintage.
3. **Copy the study's street and roof drawing.** Rejected on the director's own
   review: per-street ink-then-paper leaves ink in the middle of junctions, and
   the simplified gable-end triangles float between rows. The live renderer uses
   the prism/roof faces and one ink pass followed by one paper pass.
4. **Put landmark names in the plate renderer.** Rejected: plate text scales
   with zoom and cannot be hidden by level of detail. Plaques belong in the
   overlay, where they are constant-size and already have the map data.
5. **Change the projection to match the board's hand-drawn aerial view.**
   Rejected: the 2:1 isometric projection is shared by the plate, camera,
   overlay, tokens and ghost; changing it would re-break alignment and
   [decision 0010](0010-legal-moves-follow-streets.md).

## Consequences

- `DEFAULT_SKIN` is `board`; `?skin=vintage` and the dev selector still reach the
  etched skin. A stored `localStorage['xyard.skin']` may keep an old choice; the
  URL wins.
- `city.ts` now emits 418 houses for the 96-station fixture (was 225). The Canvas
  renderer culls them; the Basic SVG plate is denser and its own landmark labels
  were removed to avoid doubling the overlay plaques.
- The node-class ring and the `B`/`M`/`S` letters are no longer rendered. The
  station card and `<title>` still expose class and modes, so no information is
  lost.
- Remaining visual gaps to the reference: the river and bridges (open item 8),
  the play camera can still expose the plate's north-east margin, and landmark
  compounds are still house-scale rather than board-scale.
