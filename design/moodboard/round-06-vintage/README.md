# Round 06 — Vintage Etching

**Status:** applied as the **default** prototype skin on 2026-10-29. Basic is the
fallback; Iron and Night remain developer skins.

The director's new steer: move the game toward the **early 1900s**, late enough
for the Underground to exist, and drop the modern scooter. The reference is a
monochrome, hand-etched city map with a paper HUD; the **transit routes are the
only saturated colour** on screen.

This round is the first implementation of that combination, including the era rules.

## What the mock shows

- An isometric sepia city: cream paper, ink outlines, cross-hatched façades,
  roofs, shadows and trees; chimneys/dormers/water tanks instead of AC units.
- Parchment HUD: serif type, double-ruled panels, a wax-seal mark, a compass and
  a 100-yard scale bar in the map.
- The permanent transit network in colour — gold taxi, green omnibus, red
  Underground, violet special — above the city so it is never hidden by a roof.
- An era-flavoured Fugitive kit: **Taxi cab, Omnibus, Underground, Special, On
  foot**. The motor-scooter is removed from the rules, not just this mock.
- A colour route key in the side panel, so the one chromatic layer has a legend.
- The darker paper/ink balance, restored after review; the lighter wash was rejected.

## What is deliberately *not* changed

- The rules, map, graph, station positions, appearances and turn count.
- `Basic`, `Iron` and `Night` remain exactly as they are. The vintage screen is a
  separate lab route; it is not a skin the game can select.
- The scooter **has** now been removed from the prototype rules, state, log,
  tests and UI under [decision 0019](../../../docs/decisions/0019-1907-era-rules.md).
  Special stays. The paid-mode internal names are unchanged.

## Suggested steps to apply it

1. **Projection (done).** The prototype now runs the true isometric projection:
   the city, camera, station labels, routes, tokens and ghost are all projected
   together. Basic and the RTS skins stay on the existing map projection.
2. **Skin-only pass (done).** The sepia/ink city, hatching, paper grain and paper
   HUD are live behind the existing game overlay. Basic remains the fallback.
3. **Paper HUD pass (done, first version).** Header, kit, log, legends and map
   toolbar use the parchment system; route colours and character tokens remain
   chromatic. More contrast/colour-blind testing is still worthwhile.
4. **Period prop pass (partial).** AC units, billboards, antennas and cars are
   suppressed; gables, chimneys, roof tanks, gas lamps and a sepia station roof
   are in. A full pass would add more period street furniture and a river/bridges.
5. **Era rules pass (done for the scooter).** The scooter is gone; Special and
   Foot stay. The internal mode names are unchanged; presentation labels can be
   renamed separately without touching the wire.
6. **Readability test.** Desktop, map overview and 390×844 have been checked; a
   full colour-blind pass and a turn-5 appearance/ghost check are still useful.

## How to view

- `http://localhost:5173/` — the Vintage skin by default.
- `?skin=basic` — the original prototype fallback.
- `?skin=iron` / `?skin=nightops` — the live RTS skins.
- `?vintage` — the standalone paper screen study.

## Screenshots

| File | Shows |
| --- | --- |
| `shots/vintage-screen.png` | The full paper screen + map |
| `shots/vintage-map.png` | The map at a larger scale |
| `shots/vintage-phone.png` | The study stacked at 390 × 844 |
| `shots/prototype-vintage-1440.png` | The live prototype, Vintage skin |
| `shots/prototype-vintage-map-1440.png` | Whole-city isometric map view |
| `shots/prototype-vintage-moving-1440.png` | Projected overlay during an Agent reveal |
| `shots/prototype-vintage-after-1440.png` | After the first turn |
| `shots/prototype-vintage-appearance-1440.png` | Turn-5 appearance in the vintage overlay |
| `shots/prototype-vintage-result-1440.png` | Vintage result overlay |
| `shots/prototype-vintage-390.png` | The live Vintage skin at 390 × 844 |

## Honest limit

This is a **vector approximation** of an etching, not a scanned engraving. The
linework is SVG hatching + paper texture. A more authentic result can push the
hatching, stippling and typography further, or eventually use pre-rendered
etching-style city tiles behind the same skin boundary. The full 96-station map
is dense in isometric view, and the period prop pass is only partial.
