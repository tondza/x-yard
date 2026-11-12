# X-Yard — Design Moodboard

**Exploration, not specification.** Nothing here is production code, is imported
by an app, or affects `pnpm test` / `pnpm build`. It exists so the product
director can react to concrete examples and steer the art direction.

Settled decisions live in [`/VISUAL_DIRECTION.md`](../../VISUAL_DIRECTION.md).
Game design authority remains [`/GAME_VISION.md`](../../GAME_VISION.md).

---

## Rounds

| Round | Folder | Status |
| --- | --- | --- |
| 01 — abstract nodes | [`round-01-abstract-nodes/`](round-01-abstract-nodes/) | **Superseded.** Four art directions that drew the *graph* rather than the *city*. Kept as history; only **A — Transit Diagram** is carried forward, as the HUD / information-design reference. |
| 02 — the city | [`round-02-city/`](round-02-city/) | **Narrowed, not closed.** Four city-based directions comparing art style and perspective; the director kept **F** and **H** and dropped pixel-art. |
| 03 — mobile-first MVP | [`round-03-mobile/`](round-03-mobile/) | Completed for the MVP screen pass. Six scenarios from the *ratified MVP* at a real 390 × 844 phone viewport, plus one desktop enhancement. |
| 04 — illustrative city skins | [`round-04-city-visuals/`](round-04-city-visuals/) | **Superseded by 05.** Palette/detail passes that the director judged too illustrative (“children's drawing”). Kept as history. |
| 05 — RTS city skins | [`round-05-rts/`](round-05-rts/) | RTS-inspired directions; Iron/Night remain live developer skins. |
| 06 — Vintage Etching | [`round-06-vintage/`](round-06-vintage/) | **Current and applied.** Early-1900s sepia/ink isometric skin, paper HUD, coloured network; the default prototype skin. |
| 07 — city visuals | applied in the prototype | House/roof variety, materials and landmark kinds (see `docs/briefs/round-07-city-visuals.md`). Not a moodboard round. |
| 08 — Yard Board | [`round-08-board/`](round-08-board/) | **Applied as the default `board` skin (2026-11-12).** Re-draws the Cathedral Quarter with the board grammar of the original *Scotland Yard*: roof-first houses, paper streets, numbered discs with mode collars, keylined routes and landmark plaques. Vintage and Basic stay selectable. |

### Round 03 — why it looks so different

Rounds 01 and 02 drew **the most complex possible screen**. The director rejected
that as a starting point: the MVP must be minimal and playable on a phone. Round 03
therefore shows the *minimum* that works, built on
[`docs/mvp/README.md`](../../docs/mvp/README.md) rather than on the broad vision —
no modals, a 92 px top bar, a map, and a 176 px tray. Scenarios 2 and 5 are the
*same screen* in the two surviving art directions, so the F-versus-H choice can be
made on the real MVP screen instead of on a showcase.

### Round 08 — the board study

The director compared the live Vintage plate with a photo of the original
*Scotland Yard* board and asked what a closer match would look like. Round 08 is
that answer and is now the default skin: the same map, graph and routes, re-drawn
with the board's visual grammar — short roof-first terraces, paper streets with ink edges, one numbered
disc per station with a colour arc for bus/metro/special, thicker keylined route
ribbons, and printed landmark plaques. See
[`round-08-board/README.md`](round-08-board/README.md) for what is real data,
what is stand-in, and the questions it raises (new skin versus retuning Vintage,
retiring node-class colour, house density, landmark-compound budget).

### Round 06 — the 1900s etching pass

The director then suggested moving the era to the early 1900s — late enough for
the Underground, modern enough to drop the scooter — and trying the **Vintage
Etching** treatment: a monochrome/sepia city and paper menus, with only the
transit routes in colour. Round 06 is that study. It is deliberately a separate
lab route; the rules, Basic and the live RTS skins are unchanged.

### Round 05 — the RTS pass

The director rejected the round-04 illustrative direction as too childlike and
named the target: a dense, pre-rendered late-90s RTS city (“Red Alert 2 style”).
Round 05 therefore explores **Command City** (true isometric, lab only),
**Iron Quarter** (2.5D, live developer skin) and **Night Ops** (2.5D night, live
developer skin). Basic remains the default. The vector mocks are an approximation
of the pre-rendered look; a future sprite-based skin can replace the city renderer
behind the same switch.

### Why round 01 was superseded

Round 01 answered a real question — *how do we depict what the Agents do not
know?* — and each direction answered it differently (heatmap, radar, pencil
hatching, ghost trails). What it missed is that in this genre **the city is the
board**. Abstract circles and lines are not the game. Round 02 keeps the best of
round 01's information design and puts it inside an actual cityscape.

## Round 02 — what is being decided

The director has deferred exactly two decisions and asked to choose them from
examples:

- **Art style** — flat vector / pixel-art / painterly
- **Perspective** — pure orthographic top-down / slight 2.5D tilt

Everything else is **fixed and identical across all four mockups**: the same
fictional city (Yard-Meridian), the same 24 stations, the same game state, the
same HUD content, the same 1280×720 stage. That makes round 02 a **controlled
comparison** rather than four unrelated proposals:

| Mockup | Style | Perspective | Time |
| --- | --- | --- | --- |
| [`e-flat-topdown-day.html`](round-02-city/e-flat-topdown-day.html) | Flat vector | Pure top-down | Day |
| [`f-flat-2p5d-day.html`](round-02-city/f-flat-2p5d-day.html) | Flat vector | Slight 2.5D | Day |
| [`g-pixel-2p5d-day.html`](round-02-city/g-pixel-2p5d-day.html) | Pixel-art tile grid | Slight 2.5D | Day |
| [`h-painterly-topdown-night.html`](round-02-city/h-painterly-topdown-night.html) | Painterly / textured | Pure top-down | Night |

How to read the matrix:

- **E vs F** isolates **perspective** — same style, same palette, same time of day.
- **F vs G** isolates **style** — same perspective, same time of day.
- **H** covers the remaining style (painterly) and demonstrates the day-night
  requirement at night, which is the hardest legibility case.

The full shared specification each mockup obeys is
[`round-02-city/_BRIEF.md`](round-02-city/_BRIEF.md) — worth reading, because it
records the odd constraints that are easy to violate: ambient pedestrians and
cars must be visually incapable of being mistaken for players, and station
numbers and character icons must stay upright even when the ground plane is
tilted.

## Regenerating the screenshots

Tooling lives in `/workspaces/x-yard/.tools/screenshot/` and is **not** part of
the pnpm workspace. It needs Playwright's Chromium plus a few system libraries
that are absent from this image and cannot be installed (no root), so they are
unpacked into `.chromium-libs/` instead:

```bash
cd /workspaces/x-yard/.tools/screenshot
PLAYWRIGHT_BROWSERS_PATH=/workspaces/x-yard/.playwright-browsers \
LD_LIBRARY_PATH=/workspaces/x-yard/.chromium-libs/usr/lib/x86_64-linux-gnu \
node shoot.mjs
```

`shoot.mjs` walks this tree recursively, renders every mockup at 1280×720 into a
`shots/` folder beside its source, and fails loudly on page errors, console
errors, or `.stage` overflow — so a broken mockup is caught mechanically rather
than by eye. `index.html` files are contact sheets and are skipped.

`.tools/`, `.playwright-browsers/`, `.chromium-libs/` and `.apt/` are all
git-ignored.
