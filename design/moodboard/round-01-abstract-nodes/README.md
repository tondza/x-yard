# X-Yard — Design Moodboard 01: Look & Feel

**Status: exploration, not specification.** Nothing in this folder is production
code, is imported by any app, or affects `pnpm test` / `pnpm build`. It exists so
the product director can react to concrete examples and steer the art direction.

GAME_VISION.md remains the only authority on game design. If a decision here gets
made, it belongs in a new `VISUAL_DIRECTION.md` (not yet created) and then in the
client code — not in this folder.

---

## 1. What is being compared

Four deliberately *different* art directions, not four variations of one idea.
Every mockup renders **the same game state** so the comparison is fair:

- the same 8-node / 21-edge scaffold graph (16 taxi, 3 bus, 1 metro, 1 special),
- Safe House at `s7`, Black Market at `s6`,
- Turn 6 of 24, last Reveal Pulse at turn 3, next at turn 8,
- F1 "Vulture" revealed at `s3`; F2 "Kestrel" hidden since turn 3; F3 "Magpie"
  hidden carrying heavy contraband,
- Agents A1@s7, A2@s4, A3@s8,
- the same five ticket-log rows, including one `Unknown Transport`,
- the same probability spread for F2: s2 40%, s3 25%, s8 20%, s6 15%.

Each mockup is a single self-contained HTML file: no build step, no external
assets, opens straight from disk.

| # | Direction | File | Mood |
| --- | --- | --- | --- |
| A | Transit Diagram | `a-transit-diagram.html` | Light, Swiss, functional. A precision instrument. |
| B | Night Ops / Surveillance | `b-night-ops.html` | Dark, technical, tense. A operations-room feed. |
| C | Paper Dossier | `c-paper-dossier.html` | Warm, analog, noir. A case file on a corkboard. |
| D | Neon Metro | `d-neon-metro.html` | Saturated, energetic, premium. An esports lobby. |

Rendered screenshots are in `shots/`. Open `index.html` for a side-by-side
contact sheet.

## 2. The core visual problem

X-Yard's defining UI challenge is **representing what the Agents do not know**.
Every direction solves it differently, and this is probably the single most
consequential decision in this round:

| Direction | Hidden-information treatment |
| --- | --- |
| A | Quantitative **heatmap + bar chart**: suspect nodes tinted on one hue, explicit percentages. Reads as data. |
| B | **Radar / sensor metaphor**: concentric range rings from the last known position, contact blips, growing search radius, entropy and confidence readouts. |
| C | **Hand-drawn deduction**: pencil-hatched "possible position" zones, circled nodes, question marks, a torn note, grease-pencil crosses. |
| D | **Ghost trails**: fading luminous trails per turn since the last fix, plus glowing probability halos and a fog-of-war gradient. |

## 3. Decisions this round is asking for

Reply by direction letter (e.g. "A's map, C's ticket log, but darker"). Mixing is
welcome — these are axes, not packages.

1. **Light or dark?** A is light-neutral, C is light-warm, B and D are dark. This
   affects perceived tone more than any other choice.
2. **Tone.** Competent tool (A) / surveillance thriller (B) / analog investigation
   (C) / competitive esports (D). Which is X-Yard?
3. **How hidden information is drawn** — see the table in §2. Also: how much
   *math* should be on screen? B shows entropy in bits and confidence percentages;
   A shows percentages; C shows pencil estimates. More telemetry reads as
   simulator, less reads as board game.
4. **Density.** A is spacious and instantly legible; B is dense with telemetry and
   scales to expert play; C is layered and collaged; D is bold and graphic. Dense
   screens reward mastery but raise the learning cliff.
5. **Typography.** Sans (A) / monospace-forward (B) / serif + typewriter (C) /
   heavy geometric sans (D).
6. **Map rendering.** Flat transit diagram (A) / glowing grid (B, D) / paper chart
   (C). How far should the map depart from a literal transit diagram?
7. **Transport-mode colour strategy.** Should mode colours be quiet and functional
   (A) or a loud part of the identity (B, D)? Note all four chose *different*
   colours for the same four modes — the mapping is still open.
8. **Faction-specific views.** A toggles `FUGITIVE / AGENT`, B has `VIEWING AS`,
   D labels `FACTION · YOURS`. Decision: does the UI genuinely differ per faction
   (the Fugitive sees more, the Agent sees probabilities), or is it one screen
   with an overlay?
9. **Node identity.** The mocks label nodes `s1`…`s8`. C additionally invented
   in-world names ("Kentish Row", "Aldgate Spur", "Dockside"). Decision: do nodes
   get real place names? That is a world-building choice as much as a UI one — and
   it interacts with §6 of the vision, where Yards are named cities
   (Yard-London, Yard-Berlin).
10. **Reveal Pulse prominence.** A and B give it a header slot with a countdown;
    C stamps it as paper bookkeeping; D shows a grid-certainty meter. How loud
    should the pulse be, given it is the game's heartbeat?

## 4. Known gaps in these mockups

These are quick directional sketches, not final screens. Deliberately not yet
covered: mobile/small viewports, accessibility (contrast, colour-blind safety for
mode colours), hover/focus/disabled states, animation and motion design, the
lobby and matchmaking flow, end-of-Yard summary, spectating, and how the board
behaves at the ~150-node scale the vision implies (all four show 8 nodes).

## 5. Regenerating the screenshots

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

`shoot.mjs` renders every `*.html` in this folder at 1280x720, writes `shots/`,
and fails loudly on page errors, console errors, or `.stage` overflow — so a
broken mockup is caught mechanically rather than by eye.

All of `.tools/`, `.playwright-browsers/`, `.chromium-libs/` and `.apt/` are
git-ignored.
