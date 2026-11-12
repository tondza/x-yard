# VISUAL_DIRECTION.md

Visual and presentation decisions for X-Yard, as answered by the product director
on **2026-10-15** and **2026-10-16**.

**Authority:** this file *refines* `GAME_VISION.md`; it never overrides it. Where a
decision here changes a rule, `GAME_VISION.md` must be updated too. On 2026-10-16
the art style was **narrowed to two directions** and the screen-first, minimum-UI
and street-following directives were added — see §1 decisions 10–15 and §4.

---

## 1. Settled decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | **Route display** | **Hybrid.** The city is a real illustrated cityscape. Stations are numbered markers. Route lines are drawn **only for the selected character's legal moves** — never permanently on the map. |
| 2 | **On-foot movement** | **Node-to-node along street edges.** *Revised 2026-10-16:* on-foot **is logged** — it leaves a public trail row — and costs one of a finite pool of foot steps, **not** a ticket. The earlier "free / silent" phrasing in this file was **wrong** and contradicted the MVP rules; see `docs/mvp/README.md`. |
| 3 | **Map scale** | **~600–900 stations** for a ~100-player city, **procedurally generated from a seed and then hand-tuned**. Chosen to keep many Yards (London, Berlin…) affordable for a solo developer. |
| 4 | **Hidden Fugitives** | **Viewer-dependent.** A Fugitive sees their own animated character icon. Agents and spectators see only ghost / last-known markers plus probability shading. |
| 5 | **SimCity 2000 flavour** | **Illustrated dense rooftops and its palette**, plus a **living-city / day-night** feel. The 1990s beveled UI chrome was explicitly **declined** — the HUD stays modern. |
| 6 | **Ambient life** | Pedestrians and cars are **nice-to-have but deliberately minimal** for now. |
| 7 | **Animation priority** | 1) Characters (idle, walk, arrest/reveal). 2) Day-night cycle. Everything else is secondary. |
| 8 | **City identity** | **Fictional cities inspired by real ones.** No real-world landmarks. |
| 9 | **Camera** | Both a **zoomed gameplay view** and a **full-city overview**. Mockups must show both. |
| 10 | **Art style** | **Narrowed to two (2026-10-16): F — flat vector**, and **H — painterly**. Pixel-art (G) is out. Both are liked *with their own* perspective, so this is not yet a single choice. |
| 11 | **Perspective** | **Narrowed to two (2026-10-16): 2.5D tilt (F)** and **pure top-down (H)**. Not yet resolved independently of art style. |
| 12 | **Movement path display** | **Paths follow the street network.** Straight lines across blocks are forbidden except for genuine off-street modes (metro / special) — see [decision 0010](docs/decisions/0010-legal-moves-follow-streets.md). |
| 13 | **Screen-first** | **Mobile-first, portrait-primary.** The MVP must be playable on a phone in a ~5–10 minute session; richer detail is added for large screens later. |
| 14 | **Screen complexity** | **Minimal.** The round-02 mockups are explicitly rejected as an MVP starting point — they are "the most complex possible game screen with lots of modal windows and different options". |
| 15 | **MVP scope** | **Close to the original Scotland Yard**, plus **on foot**. The electric scooter was removed in the 1925 era pass ([decision 0019](docs/decisions/0019-1907-era-rules.md)). Gadgets, agent skills, contraband missions, safe houses, multi-Yard instances and ~100-player cities are **not MVP**. |
| 16 | **Prototype skin (2026-10-29)** | **Isometric Vintage Etching** is the default prototype skin: 1925 interwar sepia/ink city, paper HUD, transit routes in colour. Basic remains the fallback; no motor-scooter. |
| 17 | **Default skin (2026-11-12)** | **Yard Board** (`board`) is the default prototype skin: paper plate, short roof-first terraces, one numbered station disc with a mode collar, keylined route ribbons, landmark plaques. **Vintage Etching** and **Basic** remain selectable. See [decision 0024](docs/decisions/0024-yard-board-skin.md). |
| 18 | **Landmark scale (2026-11-12)** | Do **not** scale landmarks up to make them read. Tall landmarks cover streets and buildings and do not scale; keep them house-scale with plaques until a compound footprint is designed. |

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

- **Art style and perspective** — shortlisted to **F** (flat vector, 2.5D tilt) and
  **H** (painterly, pure top-down, night) in `design/moodboard/round-02-city/`.
  New mobile-first mockups are being built before this is closed.
  **Update 2026-11-12:** the playable default is now the **Yard Board** skin
  (decision 17/0024), derived from the original *Scotland Yard* board grammar.
  This does not settle the wider F-versus-H art direction for the 600–900-node
  renderer; it is the prototype's presentation choice.
- **The fog layer in H.** H renders three large soft `gFog` ellipses at opacity
  .55–.70. It is purely decorative — **nothing in the game state drives it** — and
  the director read it as an implied visibility mechanic, which is the problem.
  Recommended: remove it, or reduce it to a faint vignette. Any genuine fog-of-war
  must be data-driven from what a viewer has actually observed.
- **Map representation — closed 2026-10-16.** The research
  (`docs/research/round-03-map-system.md`) recommends against a block/square field and
  the director **confirmed node-and-edge** for movement. The block/square question is
  no longer open; see §4 directive 6.
- **Is on-foot a `TransportMode` or a separate concept?** *Answered 2026-10-16:*
  neither — do **not** widen `TransportMode`. The MVP rules introduce
  `MobilityOption = TransportMode | 'foot'` and
  `LoggedTransport | 'hold'`, leaving the four transport tiers intact. The
  motor-scooter was removed in the 1925 era pass (decision 0019). On-foot is
  **logged**, so the "silent stealth option" framing that used to be here was
  wrong.
- **Do stations get in-world names**, or stay numbered (101, 102…)? The round-01
  paper dossier invented names ("Kentish Row"); the round-02 brief uses numbers.
- **Appearance interval — ratified 2026-10-16.** Now `APPEARANCE_TURNS = [5, 10, 15]`
  in code, with `YARD_TURN_LIMIT = 16`. The old `PROVISIONAL_REVEAL_PULSE_INTERVAL`
  constant was removed as redundant once the cycle became a fixed list.
- **Map scale numbers** (`GAME_VISION.appendix.md` Q7) are now partly answered: ~600–900 stations,
  ~100 players. Node classes (`street` / `hub` / `terminal`) remain provisional.
- Accessibility (contrast and colour-blind safety for the mode colours) and
  motion-design budget remain untouched. Small viewports are **no longer** an open
  item — see §4 directive 3.

## 4. Directives of 2026-10-16

Recorded because they change what "done" means for the next rounds.

1. **MVP before vision.** The broad vision — gadgets, agent skills, contraband
   missions, safe houses, ~100-player cities — is *good but not MVP*. Work now
   targets a buildable, balanced MVP with logical mechanics.
2. **Stay close to the original Scotland Yard**, adding only what earns its place.
   The director names **on foot**; the electric scooter was removed in the 1925 era pass.
3. **Mobile-first.** Mobile play is treated as primary and desktop is the later
   enhancement — not the reverse. The MVP must work on a small screen.
4. **Start from the minimum screen.** The round-02 mockups are rejected as an MVP
   UI starting point: they represent the most complex possible screen.
5. **Movement follows streets** — recorded as
   [decision 0010](docs/decisions/0010-legal-moves-follow-streets.md). This was the
   director's sharpest visual objection, and it is both a rendering rule and a game
   rule. The game-rule half still needs promoting into `GAME_VISION.md` §2/§3 by
   the director.
6. **Map representation — resolved 2026-10-16: node-and-edge stays.** The
   block/square proposal was researched and rejected: it does not make capture more
   unambiguous (capture is already one discrete comparison) and it would collapse the
   four transport tiers into "how far". The **map generator is confirmed as early
   work** — the prototype may use a small hand-authored map, but generator work starts
   before the MVP.
