# docs/lessons.md — measured environment and tooling facts

Check here **before debugging** an environment or tooling failure. These are
measured facts about this machine and this repository, not preferences. Each
entry gives the symptom you will actually see, the cause, the fix, and where the
fix is enforced so it cannot be silently undone.

If a failure here is not covered, fix it, then **add an entry in the same change**
that fixed it. An entry that is not enforced by a file or a check will rot.

Last updated: 2026-10-16.

---

## L1 — `pnpm install` fails with `EROFS`

**Symptom.** Every install exits non-zero with `EROFS: read-only file system`,
naming a path under `$HOME`.

**Cause.** `$HOME` is read-only in this sandbox, and pnpm's default store and
cache live under it (`~/.local/share/pnpm`, `~/.cache/pnpm`).

**Fix.** `.npmrc` redirects `store-dir` and `cache-dir` inside the repository.
pnpm resolves the relative paths under `node_modules/`, which is already
git-ignored.

**Enforced by.** [`.npmrc`](../.npmrc). **Never remove it.**

---

## L2 — `pnpm install` exits non-zero with `ERR_PNPM_IGNORED_BUILDS`

**Symptom.** Install completes the resolution phase and then fails, naming a
package whose build script was blocked.

**Cause.** pnpm 12 blocks dependency build scripts by default. `esbuild` (pulled
in by both Vite and `tsx`) needs its postinstall to place its native binary.

**Fix.** Declarative allow-list in `pnpm-workspace.yaml`:
`allowBuilds: { esbuild: true }`.

**Note the key name.** pnpm 12 spells it `allowBuilds`; the older pnpm 10 spelling
is `onlyBuiltDependencies`.

**Enforced by.** [`pnpm-workspace.yaml`](../pnpm-workspace.yaml). Add an entry only
after establishing *why* that package must run code at install time.

---

## L3 — `/tmp` does not survive between commands

**Symptom.** A file written to `/tmp` in one shell invocation is missing in the
next; `mktemp` output vanishes.

**Cause.** `/tmp` is a **fresh tmpfs on every shell invocation**.

**Fix.** Never stage build output, caches, fixtures, or scratch files in `/tmp`.
Use a path inside the workspace. *(This was re-confirmed the hard way while
writing these docs — a stray `> /tmp/...` redirect failed with "Read-only file
system".)*

**Enforced by.** The workspace file sandbox; and the rule "the workspace is the
only durable writable location" in [`AGENT_RULES.md`](../AGENT_RULES.md) §7.

---

## L4 — `sudo`, `apt-get`, and system installs are impossible

**Symptom.** `sudo` fails even for a harmless command; `apt-get install` cannot
acquire anything.

**Cause.** There is no root. The DSH sandbox sets `NO_NEW_PRIVS`, which disables
the setuid bit, so privilege escalation cannot work at all.

**Fix.** Install toolchains **into the workspace**: Python venvs, a local
`npm install`, `cargo`/`go` builds. Do not plan a task around a system package.

**Enforced by.** The platform. See [`AGENT_RULES.md`](../AGENT_RULES.md) §7.

---

## L5 — Only the workspace is writable

**Symptom.** A write outside `/workspaces/x-yard` is denied; some paths are
read-only bind mounts.

**Cause.** The file policy in the runtime context (`workspace-write` by default).

**Fix.** Work inside the workspace. If a task genuinely needs wider access, say so
and let the approval flow decide — **do not route around a denial by another
mechanism.**

**Enforced by.** The DSH file sandbox.

---

## L6 — Chromium system libraries are absent (screenshot tooling)

**Symptom.** The screenshot script's browser fails to launch, reporting missing
shared objects.

**Cause.** Chromium's system libraries are not installed in this image and cannot
be installed without root (L4).

**Fix.** They are unpacked into `.chromium-libs/` and reached via
`LD_LIBRARY_PATH`, with browsers under `.playwright-browsers/`. Full invocation
is in [`design/moodboard/README.md`](../design/moodboard/README.md).

**Enforced by.** `.gitignore` keeps `.tools/`, `.playwright-browsers/`,
`.chromium-libs/`, and `.apt/` out of the repository; the tooling stays outside the
pnpm workspace so it cannot affect `pnpm test` or `pnpm build`.

---

## L7 — Playwright must not download into `$HOME`

**Symptom.** A future `pnpm test:e2e` install fails on a read-only `~/.cache`.

**Cause.** Playwright's default browser path is `~/.cache/ms-playwright` (L1).

**Fix.** Set `PLAYWRIGHT_BROWSERS_PATH` to a workspace path (e.g.
`/workspaces/x-yard/.playwright-browsers`) and keep browser tests on their own
`pnpm test:e2e` script so the mandated `pnpm test` stays a pure headless unit run.

**Enforced by.** Planned; recorded in [`TESTING_STRATEGY.md`](../TESTING_STRATEGY.md) §6.

---

## L8 — This renderer silently drops SVG filter output

**Symptom.** A layer drawn with `filter="url(#shadow)"` disappears **entirely** — not
a wrong shadow, a missing graphic — with no console error and no failed request.

**Cause.** The headless Chromium used by the screenshot tooling drops
`feDropShadow` / `feDisplacementMap` results instead of approximating them: it emits
the filter with no source graphic, so the whole layer vanishes. Round 02's night
mockup lost its entire roofs layer this way.

**Fix.** Draw shadows and texture as *painted* geometry — offset duplicate shapes for
shadows, layered gradients and repeating patterns for grain. Never rely on an SVG
filter for anything that must survive.

**Enforced by.** Nothing mechanical, and it fails silently. If a whole layer goes
missing in a rendered PNG, suspect this before suspecting the markup.

## L9 — A CSS animation on an SVG `<g>` overrides its `transform` attribute

**Symptom.** A positioned SVG group — a player token, a marker — jumps to the
top-left corner or off-screen as soon as an animation is applied to it.

**Cause.** A `@keyframes` rule that sets `transform` **replaces** the element's
`transform` attribute for the duration of the animation; the two do not compose. The
placement translate is discarded.

**Fix.** Split the element: keep the placement `translate(...)` on an outer `<g>` and
animate an inner `<g>`. Hit while building the round-03 capture screen, where it
collapsed both Agent tokens onto the origin.

**Enforced by.** Nothing mechanical. Verify token positions in a rendered PNG.

## L10 — The mockup renderer needs a fixed measurement viewport

**Symptom.** A mockup renders at the wrong width — round 01's neon mockup came out
800 px wide instead of 1280 — with no error and no overflow reported.

**Cause.** That mockup's `.stage` is *fluid* rather than a fixed size, so measuring it
reports whatever the browser viewport happens to be. Fixed-size stages (the 390 × 844
phone mockups) are immune, which makes the bug look random.

**Fix.** Measure every stage from the 1280 × 720 design baseline, *then* resize to the
measured box and screenshot the `.stage` element rather than the viewport.

**Enforced by.** The render script prints each measured size, so an unexpected width
is visible in its output.

## L11 — A mockup can draw a move the map does not allow

**Symptom.** A legal-move line that looks entirely plausible but that no edge
supports. Round 03 shipped four mockups drawing a **bus move from a standard street
node** and a **walk between two non-adjacent stations**.

**Cause.** The author reasoned about visual plausibility instead of reading the edge
list — and the brief it was handed specified the illegal move. Bus and metro never
serve a standard street node, so a character on a street node has **no** bus or metro
move at all.

**Fix.** Derive each mockup's legal set from the edge list and check the drawing
against it; [`briefs/round-03-mockups.md`](briefs/round-03-mockups.md) now carries the
derived table for the shared map. Show an unavailable mode as unavailable — never
invent a route to make a screen look richer.

**Enforced by.** Nothing yet, and that is the real gap: an impossible move is visually
indistinguishable from a legal one. [Decision
0010](decisions/0010-legal-moves-follow-streets.md) records that the guard belongs
with the client renderer as a path test, and no such test exists.

---

## L12 — A prose style description does not carry an art direction

**Symptom.** Delegated mockups come back with the right *palette* and the wrong
*fidelity*: large flat coloured rectangles where an illustrated city had already been
approved. The director rejects them — "not resembling the earlier design options I
liked" — and the work has to be redone.

**Cause.** The brief described the target in **adjectives** ("flat vector, slight 2.5D,
daylight") and never pointed at a finished example. Adjectives do not transmit
illustration density: how many buildings, how small, how many roof materials, whether
walls and cast shadows are drawn at all. The phrase **"minimum UI"** was additionally
read as permission to draw minimum *art*.

**Fix.** For any delegated visual task, **point at a specific approved artifact and
require it to be read first** — "match the level of illustration in
`design/moodboard/round-02-city/f-flat-2p5d-day.html`, not merely its palette" — and
hand the author a fidelity **test** to self-apply before submitting: *squint at it — does
it read as a city, or as a flowchart?* State separately that UI minimalism is not art
minimalism.

**Enforced by.** Nothing mechanical. The revision brief
([`briefs/round-03-mobile-art-revision.md`](briefs/round-03-mobile-art-revision.md)) now
carries the reference paths and the squint test; every future visual brief should.
