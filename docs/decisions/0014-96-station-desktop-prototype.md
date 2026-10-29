# 0014 — The first playable prototype is 96 stations, desktop-first

**Status:** accepted — 2026-10-24. **Partially superseded by
[0015](0015-sequential-reveal-and-play-map-camera.md)** for the viewport and
label-LOD decision; the 96-station, desktop-first and close-start decisions stand.

## Context

The prototype plan originally proposed a ~24-node hand-authored map. The director
rejected that scale after seeing the mockups: a small map does not simulate a
realistic chase, and the future game must support many more stations and players.
The director set **96 stations as the minimum realistic prototype scale**, and
explicitly kept the 300+/600+ range for later.

At 96 stations the map no longer fits a 390 px phone screen with readable station
numbers, and four Agents starting 9–10 edges away never close on a Fugitive. Both
are consequences of the chosen scale, not bugs to hide.

## Decision

The first playable prototype is:

- **96 stations**, one human Fugitive and **four Agent bots**, 16 turns, pulses on
  5/10/15, all six movement options, capture and restart;
- **local and single-process** — no server, no sockets, no projection;
- **desktop-first at 1440×900**, because 96 station numbers need the room;
- **F-day** as the visual reference — a procedurally illustrated city plate
  (buildings, roofs, walls, shadows, streets, parks, landmarks) with a live
  station/route/token overlay;
- **Agent starts in the 3–5 edge `encircle` band**, spread by angle, instead of
  the four farthest stations;
- a reduced `PrototypeState` in `game-core/src/prototype/`, not the full
  `GameState`.

## Rejected alternatives

1. **Keep the 24- or 60-station map.** Rejected: it was the director's explicit
   objection. A chase on a small map is not evidence about the real game.
2. **Phone-first with pinch/zoom.** Rejected for this prototype: at 390 px, 96
   labels and a dense city need camera controls and label level-of-detail before
   the loop can be judged. That is a real future pass, not the first playable.
3. **Farthest Agent starts.** Rejected: the rule is “at least 3 edges”, not “as
   far as possible”. The farthest strategy made the 96 map a no-chase demo; the
   `encircle` strategy keeps the rule and makes capture possible.
4. **Build the full server and 20-player MVP first.** Rejected: projection,
   multi-Fugitive state, sockets and interest management would all precede any
   evidence that the 96-station chase and look are worth building.
5. **Wait for the 300-node renderer.** Rejected: the 96 prototype is the
   instrument that tells us what the 300-node renderer must preserve. The
   renderer interface takes a viewport so it can grow, but the first backend is
   the static SVG city plate.

## Consequences

- The architecture guard for the full `GameState` stays honest: the local loop is
  named `PrototypeState` and is not exported as `GameState`.
- 96 is **not the ceiling**. The generator still needs a derived grid, a
  k-nearest candidate graph and a faster pathfinder for 300+; the renderer needs a
  camera and level-of-detail. Those are the next scale rehearsal, not a rewrite of
  the prototype.
- The phone remains the product target. Mobile zoom/pan and label LOD are a later
  UI pass; the 96 desktop prototype validates the loop, the city and the data.
- The visual plate is a pure view of the generated model, so the 300-node
  renderer can replace the backend without touching the engine.
