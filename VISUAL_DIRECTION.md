# VISUAL_DIRECTION.md

Visual and presentation decisions for X-Yard, as answered by the product director
on **2026-10-15**.

**Authority:** this file *refines* `GAME_VISION.md`; it never overrides it. Where a
decision here changes a rule, `GAME_VISION.md` must be updated too. Two decisions
remain **open** (art style, perspective) and are being settled by comparison of
the mockups in `design/moodboard/round-02-city/`.

---

## 1. Settled decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | **Route display** | **Hybrid.** The city is a real illustrated cityscape. Stations are numbered markers. Route lines are drawn **only for the selected character's legal moves** — never permanently on the map. |
| 2 | **On-foot movement** | **Node-to-node along street edges, and free.** A fifth movement option alongside taxi / bus / metro / alleyway. Chosen specifically because it preserves the node-based engine, the capture rule and ticket-log deduction. |
| 3 | **Map scale** | **~600–900 stations** for a ~100-player city, **procedurally generated from a seed and then hand-tuned**. Chosen to keep many Yards (London, Berlin…) affordable for a solo developer. |
| 4 | **Hidden Fugitives** | **Viewer-dependent.** A Fugitive sees their own animated character icon. Agents and spectators see only ghost / last-known markers plus probability shading. |
| 5 | **SimCity 2000 flavour** | **Illustrated dense rooftops and its palette**, plus a **living-city / day-night** feel. The 1990s beveled UI chrome was explicitly **declined** — the HUD stays modern. |
| 6 | **Ambient life** | Pedestrians and cars are **nice-to-have but deliberately minimal** for now. |
| 7 | **Animation priority** | 1) Characters (idle, walk, arrest/reveal). 2) Day-night cycle. Everything else is secondary. |
| 8 | **City identity** | **Fictional cities inspired by real ones.** No real-world landmarks. |
| 9 | **Camera** | Both a **zoomed gameplay view** and a **full-city overview**. Mockups must show both. |
| 10 | **Art style** | **OPEN** — to be decided from mockups. |
| 11 | **Perspective** | **OPEN** — to be decided from mockups. |

### The ambient-actor rule (from decision 6)

The director's reasoning, recorded because it is easy to forget: *pedestrians and
cars are a problem because the players are also pedestrians and also use cars.*
Therefore:

- Player characters carry a **distinct coloured base ring** and cast a shadow.
- Ambient actors are **tiny, desaturated, unringed**, and never overlap a station.
- When in doubt, **omit them**.

## 2. Implications for the engine and the server

These decisions have consequences beyond art. They are listed here so an agent
session does not discover them halfway through an implementation.

1. **On-foot keeps the state machine intact — by design.** Because on-foot is
   node-to-node along street edges, capture ("an Agent occupying the exact node",
   `GAME_VISION.md` §2) still works, and ticket-log deduction still works. **Had
   on-foot been free-form continuous, capture, deduction and replay would all have
   needed redesign.** This was the deciding argument for the node-based option.
   - Consequence for `game-core`: movement now has **five** options. Expect either
     `'foot'` added to the movement modes, or a separate free-movement concept with
     `ticketCost: 0` over street edges. `TransportMode` currently has four values
     and does **not** include on-foot, so this is an open implementation detail —
     see §3.
   - Capture rule is unchanged. Good.
2. **~600–900 nodes × ~100 players forces two architectural decisions.**
   - **Rendering:** this scale will not be comfortable in plain Canvas 2D. Plan on
     WebGL (e.g. PixiJS) with instancing and level-of-detail. Decide *before*
     committing to an art style, because style constrains the asset pipeline.
   - **Bandwidth:** broadcasting every turn to 100 clients in one Socket.io room
     does not scale. Spatial **interest management** is required — send each client
     only what is near it. This also *enforces* decision 4 for free: you cannot
     leak a Fugitive you never send.
3. **Procedural generation is now a deliverable, not a nice-to-have.** ~600–900
   stations per city, hand-tuned, for multiple cities, solo. That means a map
   generator plus an authoring/review path — the withdrawn spec called this
   `generateMap(...)`, used as dev tooling with output committed after review.
4. **Game logic must guarantee reachable Fugitives.** The director requires the
   Agent:Fugitive ratio to be managed so Fugitives are always inside reachable
   range. This is a **matchmaking and spawn constraint**, not merely a design
   aspiration: a Yard cannot start, and must not drift into, a state where no
   Fugitive is reachable. It needs an explicit invariant with a test.
5. **Ambient actors are a legibility risk, not just an art task.** Any ambient
   pedestrian or vehicle must be visually incapable of being confused with a
   player. This is a hard constraint on the art, not a preference.

## 3. Open items

- **Art style** and **perspective** — being decided from
  `design/moodboard/round-02-city/` (mockups E–H: flat-vector top-down,
  flat-vector 2.5D, pixel-art 2.5D, painterly top-down night).
- **Is on-foot a `TransportMode` or a separate concept?** Affects the wire
  protocol and the ticket log (an on-foot move presumably leaves no ticket trail,
  which would make it a deduction-relevant stealth option — worth deciding
  deliberately, since that is a balance lever, not an implementation detail).
- **Do stations get in-world names**, or stay numbered (101, 102…)? The round-01
  paper dossier invented names ("Kentish Row"); the round-02 brief uses numbers.
- **Reveal Pulse interval** — still `PROVISIONAL_REVEAL_PULSE_INTERVAL` in code
  (`GAME_VISION.appendix.md` Q2).
- **Map scale numbers** (`GAME_VISION.appendix.md` Q7) are now partly answered: ~600–900 stations,
  ~100 players. Node classes (`street` / `hub` / `terminal`) remain provisional.
- Mobile and small viewports, accessibility (contrast and colour-blind safety for
  the mode colours), and motion-design budget all remain untouched.
