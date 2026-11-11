# 0021 — Building & landmark variety: the data/renderer boundary

**Status:** accepted — 2026-11-11

## Context

The playable prototype's Vintage Etching city reads as a field of identical
flat-roofed boxes, and every generated map carries the same four landmarks
(cathedral, station, market, square). The director asked for a visual upgrade:
varied houses with pitched roofs as the norm, and a wider set of city landmarks
(sports ground, city hall, church, gardens, …). Two rules decide *where* that
variety must live:

- `packages/map-generator/src/types.ts` states **"the model is authority, the
  renderer is a view"** — streets, blocks and landmarks are data, and *"no drawing
  code may invent geometry."*
- Buildings, by contrast, are already **seeded presentation decoration** in the
  client (`apps/web/src/prototype/city.ts`), generated deterministically from the
  block id and map seed, and are not part of the rules model.

## Decision

1. **Landmark variety is a model change.** New landmark kinds are added to
   `LandmarkModel['kind']` in `map-generator`, selected by a seeded strategy in
   `grid.ts`, and the committed `maps/*.json` fixtures are regenerated. The renderer
   draws only declared kinds.
2. **House/roof variety is a presentation change.** A `roof`/`type` field is added to
   the client's `Building` decoration in `city.ts`, assigned deterministically from
   `hash(blockId + row + col) ^ seed`, with pitched roofs the majority. The renderer
   (`CanvasCity.drawBuilding`) gains a roof-shape renderer. No `GeneratedMap` or fixture
   change is required.
3. **The work is sequenced by bang-for-buck.** Pure-renderer quick wins (roof shapes,
   wall tints, paper grain, richer existing landmarks) come first; the model change and
   deeper geometry (row terraces, river/bridges) follow; pre-rendered sprites and AI
   textures are a later, director-gated phase.

## Rejected alternatives

1. **Invent landmark geometry in the renderer.** Rejected: it violates "the model is
   authority, the renderer is a view" and would let the game screen disagree with the
   map lab and validator about what exists in the city.
2. **Put building footprints/types in the map data.** Rejected: buildings are
   decoration, not rules; it would bloat `GeneratedMap` and force a fixture regeneration
   for every purely visual iteration.
3. **Start with the highest-fidelity assets (pre-rendered sprites / AI textures).**
   Rejected: it front-loads a paid/3D pipeline before the cheap vector pass that already
   solves the visible problem; the vector city must reach its ceiling first so the sprite
   boundary has a target to match.

## Consequences

- Quick wins (brief items #1–#4) ship without touching `map-generator`, fixtures or
  tests — pure renderer changes.
- The landmark expansion (brief item #5) is the only item that changes the map model; it
  is the one place the union is widened and fixtures regenerated.
- Building variety stays deterministic and adds no new state, so culling and LOD are
  unaffected.
- The skin boundary ([0018](0018-developer-switchable-city-skins.md)) is preserved: any
  future sprite/texture renderer can replace the city plate behind the same switch
  without touching rules or overlay.
