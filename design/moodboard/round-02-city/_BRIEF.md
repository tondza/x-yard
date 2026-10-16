# Round 02 shared brief — city-based look & feel

**This file is the shared specification for all four mockups in this folder.**
Each mockup's author receives this brief plus one delta (its style, perspective
and time of day). The city, the game state and the HUD content are **identical
across all four** so that only style and perspective vary.

Purpose: the director has deferred two decisions — **art style** and
**perspective** — and wants to choose from examples. This round is therefore a
controlled comparison, not four unrelated proposals.

---

## 1. Decisions already made (do not re-litigate)

| Decision | Answer |
| --- | --- |
| Route display | **Hybrid.** The city is a real cityscape. Stations are numbered markers. Route lines appear **only for the selected character's legal moves** — never permanently. |
| On-foot movement | **Node-to-node along street edges, free.** A fifth movement option alongside taxi / bus / metro / alleyway. Keeps the node-based engine and capture rule intact. |
| Map scale | ~600–900 stations for a full ~100-player city. Mockups show a small window of it. |
| Hidden Fugitives | **Viewer-dependent.** A Fugitive sees their own animated icon. Agents see only ghost / last-known markers plus probability shading. |
| SC2000 flavour | Dense illustrated rooftops **and** its palette; plus a living-city / day-night feel. **Not** chunky 1990s UI chrome — the HUD is modern. |
| Animation priority | Characters (idle, walk, arrest/reveal) and day-night. Ambient pedestrians and cars are **nice-to-have but deliberately minimal**. |
| City identity | **Fictional** city inspired by real ones. No real-world landmarks. |
| Camera | Mockups must show **both** a zoomed gameplay view **and** a full-city overview. |

### Why ambient actors must stay minimal

The director's note: pedestrians and cars are a problem because *the players are
also pedestrians and also use cars*. If ambient actors look like players, the
board becomes unreadable. Therefore:

- Player characters carry a **distinct coloured base ring** and cast a shadow.
- Ambient actors are **tiny, desaturated, unringed** and never overlap a station.
- A handful at most. **When in doubt, omit them.**

---

## 2. The city — identical in all four mockups

**Yard-Meridian.** A fictional river city, London/Berlin-flavoured. Do not depict
real landmarks.

World canvas for the zoomed view: **1600 × 1000** units. Render it into the map
area with `viewBox="0 0 1600 1000"` so the composition is identical everywhere.

Geography (fixed):

- **River** — a ~90-unit band crossing the district, entering near (0, 720) and
  leaving near (1600, 560). Two bridges: one at x ≈ 420, one at x ≈ 1080.
- **Park** — large green area, roughly x 150–520, y 180–430. Trees, paths, a pond.
- **Cathedral square** — around station 104.
- **Central Station** — a large terminal building at 107 (north bank).
- **South Terminal** — at 124 (south bank).
- **Stadium** — a circular landmark near (1430, 880), south-east.
- **Dense rooftops** — blocks of buildings filling everything else, with varied
  roof shapes, courtyards, chimneys, small gardens.
- Optional flavour: a rail viaduct, a market, a dock, allotments.

### Stations (24). Number them exactly like this.

| Id | x,y | Class | Notes |
| --- | --- | --- | --- |
| 101 | 210,120 | street | |
| 102 | 400,95 | street | F2 last known position |
| 103 | 560,150 | hub | bus stop |
| 104 | 700,250 | hub | cathedral square |
| 105 | 860,120 | street | |
| 106 | 1010,190 | street | |
| 107 | 1180,470 | terminal | Central Station — metro + bus |
| 108 | 1330,330 | street | |
| 109 | 1400,150 | street | |
| 110 | 120,380 | hub | park gate — bus |
| 111 | 330,300 | street | |
| 112 | 520,430 | street | |
| 113 | 650,520 | hub | riverside — bus |
| 114 | 900,420 | street | |
| 115 | 1050,560 | street | |
| 116 | 300,600 | street | south bank |
| 117 | 470,700 | hub | bus |
| 118 | 620,820 | street | |
| 119 | 790,900 | street | |
| 120 | 960,760 | street | |
| 121 | 1120,880 | street | |
| 122 | 1290,700 | hub | bus |
| 123 | 1430,820 | street | |
| 124 | 860,640 | terminal | South Terminal — metro + bus |

Movement network:

- **Taxi / streets** — a dense local mesh connecting visually adjacent stations.
  This street network is also the **on-foot** network. It is fine if the exact
  taxi edge set differs slightly between mockups; the station positions, river,
  park and landmarks must not.
- **Bus** — connects the hubs: 103, 104, 107, 110, 113, 117, 122, 124 (and may
  skip street stations). Draw as a medium-weight line distinct from taxi.
- **Metro** — connects the terminals: **107 ↔ 124** (crossing the river as a long
  jump), optionally 107 ↔ 122.
- **Alleyway / special** — 2–3 secret links, e.g. 113 ↔ 115 and 111 ↔ 101.

---

## 3. Game state to depict — identical in all four

- **Turn 6 of 24.** Last Reveal Pulse fired on turn 3. Next pulse on turn 8.
- **You are an Agent**, `A1 "Falcon"`, standing at **113**, and your character is
  the selected one.
- **Visible Agents (always drawn):** A1 at 113 (yours, selected), A2 at 107,
  A3 at 120.
- **Fugitives:**
  - `F1 "Vulture"` — **revealed this turn** by the pulse, at **104**. Draw as a
    real character icon with a reveal effect around it.
  - `F2 "Kestrel"` — hidden since turn 3, last known at **102**.
  - `F3 "Magpie"` — hidden, carrying **heavy contraband**, believed near **112**.
- **Probability spread for F2:** 102 40%, 111 25%, 103 20%, 105 15%.
- **Ticket log (newest first):** `T6 F1 Bus ticket` · `T6 F2 Unknown Transport` ·
  `T5 F3 Taxi ticket` · `T5 F1 Taxi ticket` · `T4 F3 Metro ticket`.

### Legal moves for the selected character A1 (this is the hybrid display)

Because A1 is selected, this is the **only** place route lines appear. Show:

- **On foot** → 112 and 114 (free; drawn as thin dotted light lines along streets).
- **Taxi** → 2 adjacent stations (own styling).
- **Bus** → 2 hub stations (own styling).
- **Metro** → unavailable, because A1 is not standing on a terminal. Show the
  affordance visibly disabled — this teaches the rule.
- **Alleyway / special** → unavailable unless a special link touches 113.

Give each of the five movement options a distinct line treatment **and** a
matching entry in the transport legend. Reachable stations should also be
highlighted (e.g. an outer ring).

---

## 4. Required screen elements

The HUD is **modern, floating over the map** — like a contemporary game, not a
1990s beveled panel set and not round 01's split columns. It must contain:

1. **Turn counter** — `TURN 6 / 24`.
2. **Reveal Pulse** — countdown (`NEXT PULSE IN 2 TURNS · T8`) and which turn last
   fired.
3. **Ticket log** — the five rows above, newest first, with `Unknown Transport`
   visually flagged as concealed.
4. **Probability panel** for F2 "Kestrel" — the four stations with percentages.
5. **Action bar** — three Fugitive gadgets (Decoy Ping, Counterfeit Identity,
   Alleyway Sprint) and three Agent skills (Targeted Roadblock, Sensor Sweep,
   Rapid Deployment). At least one visibly selected/armed.
6. **Transport legend** — taxi, bus, metro, alleyway/special, **and on foot**.
7. **Faction / viewer indicator** — showing you are viewing as an Agent (make the
   viewer-dependence legible: the screen would look different as a Fugitive).
8. **Minimap overview** — an inset showing the **whole city** with the wider
   network and roughly **100 player markers**, plus a rectangle marking the
   currently zoomed area. This is what proves the map scales to ~100 players.
   Label it as a sector of a larger city (e.g. `SECTOR 7 / 24 — 618 STATIONS`).
9. **Selected-character panel** — name, role, tickets or stamina remaining, and
   the contraband/mission status where relevant.

## 5. Rendering constraints

- **One self-contained HTML file.** Inline `<style>`. **No external resources of
  any kind** — no CDN, no web fonts, no images, no network fetch. It must render
  correctly offline from `file://`.
- **Fixed stage:** `body{margin:0}` and one `.stage` element exactly
  **1280 × 720** with `overflow:hidden`. **Nothing may overflow in either axis.**
- **System font stacks only.**
- Vanilla JS is allowed but keep it minimal; CSS animation is preferred.
- No emoji, no lorem ipsum, no placeholder boxes.

## 6. Animation

Required (subtle, CSS-only, looping):

- **Character idle animation** — a gentle bob/breath on the player icons.
- **Reveal effect** on F1 (the pulse reveal) — e.g. an expanding ring.
- **Day-night character** — see your delta. If your mockup is daytime, include a
  small but visible day-night affordance (e.g. a time-of-day control or a dusk
  gradient at one corner) so the feature is legible; if it is night, make the
  city genuinely read as night (lit windows, pools of lamplight, cooler palette).
- Optional and deliberately sparse: one vehicle moving, river shimmer.

Keep total motion calm. This is a deduction game, not an arcade game.

## 7. Quality bar

This must look like a **real, considered game screen at 1280×720**: a believable
city with depth and detail, a legible hierarchy between city, network and
characters, and a HUD that a player could actually use. The single most important
test: **can you tell, at a glance, where you may move, and where the enemy might
be?** If the city beauty fights that, the legibility wins.
