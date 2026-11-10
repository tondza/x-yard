# Round 06 — Vintage Etching

**Status:** design study, not ratified and not in the game. Basic and the RTS
skins are untouched.

The director's new steer: move the game toward the **early 1900s**, late enough
for the Underground to exist, and drop the modern scooter. The reference is a
monochrome, hand-etched city map with a paper HUD; the **transit routes are the
only saturated colour** on screen.

This round is a first try at that combination, not a rules change.

## What the mock shows

- An isometric sepia city: cream paper, ink outlines, cross-hatched façades,
  roofs, shadows and trees; chimneys/dormers/water tanks instead of AC units.
- Parchment HUD: serif type, double-ruled panels, a wax-seal mark, a compass and
  a 100-yard scale bar in the map.
- The permanent transit network in colour — gold taxi, green omnibus, red
  Underground, violet special — above the city so it is never hidden by a roof.
- An era-flavoured Fugitive kit: **Taxi cab, Omnibus, Underground, Special, On
  foot**. The motor-scooter is deliberately omitted from this 1907 study.
- A colour route key in the side panel, so the one chromatic layer has a legend.
- The darker paper/ink balance, restored after review; the lighter wash was rejected.

## What is deliberately *not* changed

- The rules, map, graph, station positions, appearances and turn count.
- `Basic`, `Iron` and `Night` remain exactly as they are. The vintage screen is a
  separate lab route; it is not a skin the game can select.
- No scooter is removed from the engine yet. That is a gameplay change and needs
  its own decision, tests and balance pass.

## Suggested steps to apply it

1. **Pick the projection.** The mock is isometric because it builds on Command
   City. A **2.5D vintage skin** would keep the current camera and overlay and is
   the cheap, live route; a **true isometric vintage skin** needs the camera and
   every overlay layer re-projected. Recommendation: try the 2.5D live skin first,
   keep this iso study as the art target.
2. **Skin-only pass.** Add the sepia/ink city palette, hatching, paper grain and
   period roof/street props behind the existing overlay. Keep Basic as the
   fallback and the developer switch. No rules change.
3. **Paper HUD pass.** Move the header, kit, log and legends to the parchment
   system; keep only the route colours and the character tokens chromatic. Test
   contrast and colour-blind readability.
4. **Period prop pass.** Remove modern glass/AC/neon/cars; add gables, chimneys,
   dormers, gas lamps, early cabs/omnibuses and a period station roof. This is the
   biggest art-content job; it can be grown skin-by-skin.
5. **Era rules pass (separate).** Remove the scooter, rename Taxi → Cab,
   Bus → Omnibus, Metro → Underground, keep Foot and Special (or decide to drop
   Special). Rebalance tickets and update tests; this is where the game actually
   changes, so it needs a director decision first.
6. **Readability test.** A sepia map with coloured routes must be checked for
   route/label contrast, colour-blind separation (add line styles or patterns) and
   small-screen legibility.

## How to view

- `http://localhost:5173/?vintage` — this screen study.
- `http://localhost:5173/?skin=basic` — the original prototype.
- `http://localhost:5173/?skin=iron` / `?skin=nightops` — the live RTS skins.

## Screenshots

| File | Shows |
| --- | --- |
| `shots/vintage-screen.png` | The full paper screen + map |
| `shots/vintage-map.png` | The map at a larger scale |
| `shots/vintage-phone.png` | The study stacked at 390 × 844 |

## Honest limit

This is a **vector approximation** of an etching, not a scanned engraving. The
linework is SVG hatching + paper texture. A more authentic result can push the
hatching, stippling and typography further, or eventually use pre-rendered
etching-style city tiles behind the same skin boundary.
