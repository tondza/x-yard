# 0020 — Canvas city renderer with culling and LOD for scale

**Status:** accepted — 2026-10-29

## Context

The Vintage Etching city plate was implemented as SVG. Profiling found:

- **81,601 SVG elements / 8.7 MB of markup** for the 96-station city.
- The camera changes the SVG `viewBox` on every animation frame, so the whole
  tree was reconciled/repainted during every pan, zoom and follow animation.
- At 1440×900, a map drag averaged ~50 ms/frame (~20 fps) and the Map transition
  reached 240 ms frames.
- The target is **10–50× larger cities** and smooth mobile play. Culling a few
  windows or memoising a subtree cannot bridge that gap: the approach has to
  change.

## Decision

1. **The Vintage city plate is Canvas 2D, not SVG.** `CanvasCity` draws the same
   generated model with the same 2:1 projection. Only buildings/trees whose
   projected bounds intersect the camera (plus a margin) are drawn.
2. **A spatial grid culls the city.** Buildings and trees are indexed in
   projected-space cells; the camera query returns only the visible set.
3. **Zoom LOD.** At play zoom the renderer draws windows, hatching and simple
   gables; at map zoom it draws simplified blocks with no façade detail. Landmark
   labels are only drawn at map zoom, where they are useful.
4. **The SVG overlay is viewport-culled and LOD-limited.** Only stations/edges
   whose projected bounds intersect the camera are rendered; labels are limited by
   zoom/importance; at very large zooms taxi edges drop out of the whole-city
   overview while bus/metro/special remain. The live rules and interaction stay
   in the existing overlay.
5. **Device pixel ratio is capped at 2** for the canvas, keeping mobile fill-rate
   bounded. The canvas is redrawn only when the camera or stage changes.
6. **Basic and the RTS skins keep their SVG paths.** They are comparison/fallback
   skins, not the scalable path. The rules and map data are unchanged.

## Rejected alternatives

1. **Keep optimising the SVG** (memoise the city, cull buildings, remove windows).
   Rejected: it improved the 96 map but still leaves tens of thousands of DOM
   nodes and a full-surface SVG repaint; it does not reach 10–50×.
2. **WebGL/PixiJS now.** Rejected for this 90-minute pass: another runtime
   dependency, a new asset/rendering pipeline and a larger integration risk. The
   Canvas renderer proves culling/LOD and the scene boundary first.
3. **Rasterise the whole city once.** Rejected: a 10–50× city at play zoom needs a
   huge texture; tiles or a GPU renderer are the next step.
4. **A Canvas overlay too.** Deferred: the overlay is viewport-culled now; moving
   routes/labels/hit-testing to Canvas is the next scale step once city rendering
   is stable.
5. **Only render the current viewport once and freeze it.** Rejected: camera
   movement would show blanks or stale geometry.

## Consequences

- The 96-station Canvas city has no city DOM. Measured at 1440×900: play drag
  ~16–17 ms/frame (~58–60 fps), map transition ~28–34 ms/frame; at 390×844 DPR 2,
  ~16.2 ms/frame. This is a large improvement from the SVG (~50 ms drag / 240 ms
  map frames).
- The Canvas city is visually simpler than the SVG etching (solid facets, limited
  hatching, no SVG pattern textures). Basic/RTS remain the high-detail SVG
  comparison; the Canvas LOD is the scalable default.
- The overlay still contains SVG paths/components for the visible set. At 10–50×
  the whole-city view remains the hardest case; the next step is a Canvas/WebGL
  overlay or map tiles.
- The map generator's large-scale fixtures and the 10×/50× browser benchmark are
  still needed; the architecture is culling/LOD-based so visible city counts do
  not grow linearly with the map.
