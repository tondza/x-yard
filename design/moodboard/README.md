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
| 02 — the city | [`round-02-city/`](round-02-city/) | **Current.** Four city-based directions comparing art style and perspective. |

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
