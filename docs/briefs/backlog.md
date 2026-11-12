# docs/briefs/backlog.md — workstreams & improvement epics

A living list of high-level **epics** — multi-batch workstreams — owned by **both**
the maintainer and the contributor. Anyone may add, refine, claim, or retire a row.
This is the pool that batches are drawn from, not a plan and not a commitment.

**How an epic becomes work:**

1. Pick an epic below and agree its first slice.
2. Turn that slice into a brief using [`_TEMPLATE.md`](_TEMPLATE.md):
   `batch-NN-<slug>.md`, including the `paths:` scope lock.
3. Work on a `batch-NN-<slug>` branch; CI enforces the scope lock
   ([`../collaboration.md`](../collaboration.md) §3–§4).
4. When an epic lands — wholly, or "by accident" while doing other work — move it
   to **Done** and strike it.

**Keep this current.** Any agent session that starts, finishes, or retires a piece
of work updates this file in the same change: mark an epic **in progress** when a
batch starts, move it to **Done** (with the batch/PR) when it lands, strike a
superseded idea, and add a new row when a new direction emerges. Never delete a
Done row — strike it so the record stays.

**Sizes:** S = a weekend, M = a few sessions, L = a multi-week effort.
**Status:** *idea* → *in progress* → *done* (strike the title when done).

---

## Visual & presentation

### Map & board improvements
**Background.** The city is the game's whole surface, and today it is a schematic
scaffold: a thinned street lattice with empty lots, a limited building/landmark
palette, plain parks, and no water. The reference *Scotland Yard* board has
rivers, bridges, denser blocks and distinct landmarks. This epic folds in the
"empty lots / more variety / nicer parks" ideas, water (rivers, ponds) and
bridges, a denser block plan, and landmark **compound footprints** — the director
approved compounds after rejecting a simple scale-up.
**Seam.** `packages/map-generator/src/**`, `maps/*.json`, `apps/web/src/prototype` (renderer).
**Size.** L · **Status.** idea

### Player character visuals
**Background.** Players are flat 2D discs; identity is colour plus a mode collar.
This epic explores making them readable characters — 3D button / statue-like
tokens, or even animated figures — without losing the top-down legibility the
deduction depends on. Presentation only; it does not touch the rules.
**Seam.** `apps/web/src/prototype` (tokens) + `design/moodboard` + `VISUAL_DIRECTION.md`.
**Size.** M · **Status.** idea

### Day/night cycle
**Background.** A new atmospheric layer: lighting and palette shifting across
turns. As presentation it stays in the renderer; if it ever affects rules (e.g.
visibility), the phase must come from the seeded game state, never wall-clock
time, to keep the determinism contract.
**Seam.** `apps/web/src/prototype` (renderer + skins).
**Size.** M · **Status.** idea

### Renderer at scale
**Background.** The Canvas plate + culled overlay hold at 96 stations
(~18 ms/frame); the 576-station fixture is the first rehearsal. This epic pushes
to 300 → 600–900 nodes: a whole-city overview, 10×/50× fixtures, a k-nearest taxi
graph so generation does not explode, and the camera/LOD contract carried forward
(decision 0020).
**Seam.** `apps/web` renderer + `packages/map-generator` (routing).
**Size.** L · **Status.** idea

## Interface & mobile

### HUD & interface clarity
**Background.** The paper HUD exists but information is dense: the public/action
log, missions and turn state compete for attention. The delivery-jobs prototype
already draws mission markers, so this epic is about surfacing them intuitively —
a clearer action log, an obvious mission readout, and a HUD that shows "what just
happened, what can I do next" at a glance.
**Seam.** `apps/web/src/prototype` (HUD, PrototypeMap, log, missions).
**Size.** M · **Status.** idea

### Mobile playability
**Background.** On a phone the HUD dominates and the map gets little space; the
motion banner covers the top of a 390×844 frame. The layout was checked at
390×844 but has known gaps. This epic makes the game genuinely phone-first:
map-first layout, a collapsed HUD, and controls within thumb reach.
**Seam.** `apps/web/src/prototype` (layout, `prototype.css`, camera).
**Size.** M · **Status.** idea

## Rules engine

### The real turn machine
**Background.** The playable loop is a reduced `PrototypeState` — one Fugitive,
four Agents, no projection. The full `GameState` (turn/phase machine, capture
resolution, appearance scheduling, and the 4-Fugitive / 16-Agent seat model) is
the engine's next big step and the honest replacement for the prototype loop
(appendix A marks these "not started").
**Seam.** `packages/game-core/src`.
**Size.** L · **Status.** idea

### Secret projection (`projectState`)
**Background.** Hidden information is only "hidden" today because everything is
local. `projectState` projects per viewer and per Fugitive, and is the security
gate: until it exists, no server code may send game state to a client
(AGENT_RULES §3).
**Seam.** `packages/game-core/src`.
**Size.** L · **Status.** idea

### Replay & determinism oracle
**Background.** The determinism contract already makes a Yard reproducible;
`hashState` + replay turns that into a tool — a bug report becomes a seed plus an
event log, and reconnect/anti-cheat become affordable.
**Seam.** `packages/game-core/src`.
**Size.** M · **Status.** idea

## Game systems

### Missions, gadgets & skills
**Background.** The brief's §4–§5 systems are "types only" today: contraband runs,
Safe House extraction, Decoy Ping / Counterfeit Identity / Alleyway Sprint, and
Roadblock / Sensor Sweep / Rapid Deployment. This epic implements them as rules,
and later surfaces them in the HUD (linking to the HUD epic).
**Seam.** `packages/game-core/src`, then `apps/web`.
**Size.** L · **Status.** idea

## Online

### Online play prototype (proof of concept)
**Background.** The director ruled a timed-concurrent turn model — 30-second
faction windows, all members moving at once (decision 0012) — which is an online
concern. This PoC proves the hard parts (turn timer, simultaneous moves, sockets,
an authoritative room) as a **separate surface** that reuses `game-core` and
leaves the locally playable prototype untouched.
**Seam.** `apps/server` + `packages/shared-types` (+ a small web surface).
**Size.** L · **Status.** idea

## Balance

### Core-loop & balance validation
**Background.** The validator's verdict was "worth building only if three things
change": as specified the game reduces to "don't be adjacent at the Appearance,
be adjacent at the Appearance." The director parked this. A candidate-set/belief
solver plus playtests are the instrument to settle it, alongside ratifying the
ticket/step economy at the 20-player scale.
**Seam.** `packages/game-core` (solver) + playtest briefs.
**Size.** L · **Status.** idea

---

## Done

| Epic | Batch / PR | Merged |
| --- | --- | --- |
| — | *(none yet)* | |
