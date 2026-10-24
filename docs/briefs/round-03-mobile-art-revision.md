# Round 03 — mobile art revision brief

**The problem, stated plainly.** The round-03 mobile screens are **not cities**. They read
as a diagram: large flat coloured rectangles for buildings, plain grey ribbons for
streets, a flat blue band for water, and a few circles for trees. That is exactly the
"abstract nodes" failure the director already rejected once in round 01.

**Why it happened (so it is not repeated).** The original round-03 brief *described* the
art direction in prose — "flat vector, slight 2.5D, daylight" — and never pointed at a
finished example. Prose does not carry an art direction. The phrase **"minimum UI"** was
also misread as minimum *art*: the UI must be minimal, the **city must not be**.

**The fix.** Each rebuilt screen must match the illustrated city treatment of the
round-02 mockups the director approved. **Read the reference file and work from it, not
from this description.**

| Your style | Reference file to read first |
| --- | --- |
| **F** — flat vector, 2.5D, day | `design/moodboard/round-02-city/f-flat-2p5d-day.html` |
| **H** — painterly, top-down, night | `design/moodboard/round-02-city/h-painterly-topdown-night.html` |

Also worth a look for the information layer: `design/moodboard/round-02-city/index.html`.

## What "match it" means concretely

Study the reference and reproduce its **level of illustration**, not merely its palette:

- **Individual buildings, not blocks.** Each building is drawn as a **footprint plus a
  lifted roof face plus a visible near wall**, so it reads as a standing structure.
  Vary size, orientation and height. A block of buildings is a **cluster of separate
  roofs**, never one large rectangle.
- **Varied roof materials** across the city — clay tile, slate, terracotta, oxidised
  copper, gravel, glass — in the reference's flat-vector palette. Roof texture may be
  a few painted strokes or pattern lines, not a flat fill.
- **One consistent shadow direction** for the whole city (the reference uses a single
  NW-sun / SE-shadow convention). Depth comes from cast shadows and wall faces.
- **Streets as real streets**: kerbs, pavements, lane markings, crossings, a junction or
  two — not bare grey ribbons.
- **Water with banks**, a quay or embankment, and two bridges with structure (piers,
  railings, roadway) rather than plain rectangles across the blue.
- **Green space**: individual trees with canopies and shadows, hedges, planting beds,
  a park path, allotments.
- **Landmarks** that give the quarter identity, as the reference has: a cathedral or
  church with a tower, a large **station building** for the terminal, and a
  distinguishable hub building. If a stadium fits, include it.
- **Small life**: chimneys, courtyards, skylights, awnings, loading bays, a market stall.

The test to apply before you submit: **squint at the map. Does it look like a city seen
from above, or like a flowchart?** If it is the second, it is not finished.

## Animation — required this time, not optional

The director explicitly asked for animation and it is missing. Every rebuilt screen must
include, using CSS only:

- **Character idle animation** — a gentle bob or breathing on every player figure.
- **At least one ambient city animation** — river shimmer, a vehicle moving along a
  street, a tree swaying, or lamplight pulsing. More than one is welcome.
- **The Reveal Pulse expanding rings** on any screen where the pulse is firing.
- **The 30-second countdown** on the two window screens, still running.

Keep the motion calm and looping. This is a deduction game, not an arcade game.

## Hard constraints — unchanged

- **Stage exactly 390 × 844**, phone portrait. **Nothing may overflow in either axis.**
- **Three slots only**: top bar ≤ 92 px, the map, bottom tray ≤ 176 px. **No modals.**
- **Self-contained single file.** Inline `<style>` only. **No external resources** — no
  CDN, no web fonts, no images, no network fetch, no iframes. System font stacks. No emoji.
- **Keep every drawn move legal.** Street edges are the only ones a street node has:
  - From **n5** (street): on foot / taxi to **n1, n6, n8** only. **No bus, no metro.**
  - From **n6** (hub): on foot / taxi to **n2, n3, n5, n7, n9**; **bus to n4**.
  - **Bus and metro never serve a standard street node** (n1, n2, n3, n5, n8, n9).
  - **Metro** is terminal-to-terminal only (n7, n10). **Special** exists only on n2–n9.
  - Every drawn path is a **polyline that bends along the street geometry** — never a
    straight line between two non-adjacent stations.
- **Keep the map layout and game state exactly as they are** in the file you are
  replacing. This is an art revision: station positions, cast, turn number, log rows and
  kit numbers must not change.

## Also fix these known blemishes

If they exist in the file you are rebuilding, fix them while you are in there:

- A character's name plate placed away from its own token, so it reads as if the figure
  is somewhere else. Every plate must sit on, or point directly at, its own token.
- **Station numbers occluded** by character plates or tokens. Station numbers are the
  navigation aid; they win.
- **Stray "✗" / unavailable markers** floating on the map with nothing they obviously
  attach to. Either anchor them to a station or remove them.
