# 0025 — The city plate is tiled, with a whole-city overview and a stable overlay

**Status:** accepted — 2026-11-12

## Context

The 96-station board ran at roughly 18 ms/frame on a play-view drag but spiked to
90 ms, and the director reported that routes and houses drifted apart while the
camera moved. Two separate causes were measured:

1. **One-frame lag.** `CanvasCity` painted in `useEffect`, which runs after
   paint. The SVG overlay's `viewBox` changed during the React commit, so the
   plate was always one camera frame behind the routes and tokens. Replaying a
   drag and comparing the canvas transform with the overlay `viewBox` showed up
   to ~20 CSS px of drift.
2. **Rebuild cost.** Every camera frame redrew the whole visible city. The SVG
   overlay also rebuilt its network paths whenever its culling window changed.

A 576-station (6x) map made both problems much worse: a full-tile rebuild took
100–300 ms and a wheel zoom that rebuilt on every scale change produced 300–560 ms
frames.

## Decision

1. **Paint before paint.** `CanvasCity` draws in `useLayoutEffect`, so the plate
   and the overlay share the same committed camera frame.
2. **Tile the static plate.** The city is rendered into 256 CSS-pixel tiles.
   Camera pans re-blit existing tiles; only newly exposed tiles paint. A
   one-tile ring is warmed at idle so the first drag across a boundary normally
   blits. The cache is bounded (48 tiles, ~48 MB at DPR 2).
3. **Keep a whole-city overview bitmap.** A low-resolution image of the entire
   city is built once per map/theme. It is the free map view at fit zoom, and it
   sits under the play view so a zoom-out never exposes blank paper while
   tiles are rebuilding.
4. **Defer the sharpening rebuild.** Tiles keep the scale at which they were
   painted during a zoom. A rebuild happens when the scale differs by a factor
   of 2.5, or once 180 ms after the camera settles when the difference exceeds
   1.5. This removes per-frame rebuilds from a wheel zoom.
5. **Keep the overlay DOM stable.** The permanent network and station layers render
   the whole graph once and are memoised; the culling window is used only for the
   street-label search. Their on-screen sizing uses a *settled* scale: during a
   zoom gesture the layers scale with the map and snap to constant size once the
   camera stops, instead of rebuilding every route and disc each frame.
6. **Index city geometry.** Blocks and streets get spatial grids alongside the
   existing building/tree grids, so a tile queries only nearby geometry.

## Rejected alternatives

1. **Keep the full-canvas redraw.** It measured ~34 ms/frame (p95 93) at 96 and
   became unusable at 576. Caching is not a micro-optimisation here; it is the
   difference between a drag and a slideshow.
2. **A single viewport-sized plate cache.** Tried first. It removed most per-frame
   redraws but a pan re-rendered the whole margin (100 ms+ spikes at 576), and
   every 18% zoom rebuilt the entire plate. Tiles localise both costs.
3. **Keep overlay culling.** Tried after the tile cache. A cull-window change
   rebuilt 1–6k path elements in the middle of a drag, producing 100–342 ms
   stalls at 576. A stable DOM lets the browser clip and paint; a 6x graph is
   still small enough for that.
4. **Rebuild tiles on every zoom frame.** Measured at 300–560 ms/frame at 576.
   The overview and deferred rebuild exist specifically to avoid it.
5. **Move the plate or overlay to an `OffscreenCanvas` worker / pre-rendered
   sprites now.** Not rejected forever: it is the next step for a 10x or 50x
   map. It was too large a change for the 6x rehearsal and the sprite/texture
   phase remains director-gated ([decision 0021](0021-building-and-landmark-variety.md)).

## Consequences

- A 1440×900 DPR 1 board play drag measured ~17.4 ms/frame (p95 29.5) at 96 and
  ~17.6 ms (p95 25.0) at 576; continuous panning settles at 16.4/17.0 ms. The free
  map view is 16.6/17.1 ms because it is one overview draw.
- The first pan over uncached tiles and the 180 ms settle after a zoom are the
  remaining one-off costs. A wheel zoom runs at ~31 ms/frame during the gesture
  at 576 and returns to 60 fps after it settles; the overlay's full SVG DOM is
  the limiting layer.
- The map view is a bitmap at fit scale. It is sharp at fit; if the map view is
  zoomed in far past the overview threshold, the overview is upscaled until
  tiles take over.
- The stable full overlay is validated at 576 nodes (6x). A 10x map would render
  tens of thousands of SVG elements; permanent routes/discs need to move to
  canvas or a windowed layer before that.
- No game data changes: tiles, overview and overlay scale are presentation only.
