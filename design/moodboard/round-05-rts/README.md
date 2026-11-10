# Round 05 — RTS city skins

**Status:** current exploration. The direction is not ratified; Basic remains the
prototype's default and fallback.

The director's feedback on round 04 was blunt: the illustrative/pastel skins still
looked “pretty much like a children's drawing”, and the target is the dense,
pre-rendered city look of late-90s RTS games (“Red Alert 2 style”). The secondary
requirement was operational: the basic prototype must remain available, and a
developer must be able to switch skins easily.

This round answers that with three **original** directions, all rendered from the
same generated 96-station Cathedral Quarter. No imported game art, no copied
buildings.

## The three directions

| # | Option | Projection | Effort | Status |
| --- | --- | --- | --- | --- |
| A | **Command City** | True 2:1 isometric | High | Lab only. The camera, labels, routes and tokens would all need re-projection. |
| B | **Iron Quarter** | Oblique 2.5D (map coordinates kept) | Medium | Live developer skin (`?skin=iron`). |
| C | **Night Ops** | Same 2.5D, night palette | Medium | Live developer skin (`?skin=nightops`). |

`Basic` is always the third selector entry and the default. It is the original
`CityPlate`, untouched.

### A — Command City

The closest to the reference. Buildings are extruded prisms with visible south/west
façades, window grids, roof equipment, awnings, billboards, smoke and cast
shadows; the whole map is re-projected into a 2:1 diamond. It is the strongest
look and the most expensive.

**Cost:** a separate camera/overlay projection pass. The graph, rules and
pathfinding do not change, but every screen-space overlay (station labels, routes,
tokens) has to be re-projected and re-tested for legibility.

The lab now has an **X-RAY** toggle: the inspected taxi route is drawn above the
buildings in pale cyan, so a route hidden behind a tall block is still readable.
A refinement pass also attached the shadows to the building bases, replaced the
truck-like roof boxes with AC units/vents/water tanks, and added setbacks, gable
roofs and annexes for more varied silhouettes.

### B — Iron Quarter

The same renderer language without the isometric re-projection: taller façades,
visible window grids, roof gear, concrete/asphalt textures, cars and street
lights, with the board still in its current map coordinates. It can be swapped in
as a city plate while the existing overlay stays put. This is the **recommended
first step**.

### C — Night Ops

The Iron Quarter geometry after dark: sodium lamps, lit windows, a darker board
and brighter route/station contrast. It keeps the same coordinates and overlay.

## What is held constant

- the same generated 96-station map;
- the same stations and transit network;
- the same permanent network, station inspector and last-appearance ghost;
- the same rules and game state.

Only the city plate changes. That is the point of the exercise.

## How to view / switch

- Lab: `http://localhost:5173/?rts`
- Iron skin: `http://localhost:5173/?skin=iron`
- Night skin: `http://localhost:5173/?skin=nightops`
- Basic: `http://localhost:5173/?skin=basic` (or clear the `skin` parameter)

In the dev prototype, the `SKIN` select in the header switches live. The choice is
saved in `localStorage['xyard.skin']` and written back to `?skin=` so it is easy to
share. The selector is developer-facing only.

## Screenshots

| File | Shows |
| --- | --- |
| `shots/rts-page.png` | The whole round-05 lab |
| `shots/command-city.png` | A — Command City, isometric |
| `shots/iron-quarter.png` | B — Iron Quarter, 2.5D |
| `shots/night-ops.png` | C — Night Ops, 2.5D night |
| `shots/prototype-iron-1440.png` | Iron Quarter live in the prototype |
| `shots/prototype-nightops-1440.png` | Night Ops live in the prototype |
| `shots/prototype-basic-1440.png` | Basic fallback |
| `shots/prototype-iron-390.png` | Iron Quarter on a 390 × 844 phone |

## Honest limit

These are **vector approximations** of a pre-rendered RTS look, not the real thing.
A true Red Alert 2-level skin needs isometric building sprites and texture
atlases produced in a 3D pipeline. The skin boundary is already in place: that
future skin can replace the city renderer while the map, rules and overlay stay
exactly where they are. Command City is the composition/lighting target for that
pipeline; Iron Quarter is the cheap, playable step toward it.
