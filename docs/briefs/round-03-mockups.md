# Round 03 mockup briefs — mobile-first MVP scenarios

Each mockup obeys this file plus one delta. Read the whole thing; it is short.

Authority: [`docs/mvp/README.md`](../mvp/README.md) (the ratified MVP) and
[`VISUAL_DIRECTION.md`](../../VISUAL_DIRECTION.md). Where they disagree with
anything you have seen elsewhere, they win.

## The MVP you are drawing

- **3 seats, one device per seat:** 1 Fugitive vs 2 Agents. Pass-and-play is *not*
  the ship mode.
- **16 turns.** Reveal Pulses on **5 / 10 / 15**. Turn order:
  fugitive-phase → **reveal-pulse** → agent-phase → capture-resolution.
- **Movement options:** `taxi`, `bus`, `underground` (metro), `special`, **on foot**,
  **electric scooter**. On-foot is **logged** (it leaves a public trail row) and
  costs one of a finite pool of foot steps — it is *not* silent and *not* free.
- **Capture:** an Agent and the Fugitive on the **same node** at capture resolution.
  Nodes are uncapped; co-location is a set, not a capacity.
- **Fugitive's kit:** 8 taxi / 4 bus / 3 metro / 2 special / **8 foot steps** /
  **3 scooter charges**.
- **Agent's kit (each):** 10 taxi / 5 bus / 3 metro / 0 special / **6 foot steps** /
  0 scooter.
- **Ticket log:** exactly one public row per living Fugitive per turn — the move row
  or a forced `hold`. Agents read this to deduce.

## The hard rules for these mockups

1. **Mobile-first, portrait.** Phone mockups are a `.stage` of exactly
   **390 × 844** (a real device viewport). Touch targets ≥ 48 px.
2. **Minimum UI.** Board screen = three slots only: a **top bar ≤ 92 px** (turn,
   next pulse, phase), the **map**, and a **bottom tray ≤ 176 px**. **No modals.**
   The previous rounds' many floating panels are explicitly rejected.
3. **Legal moves must follow the streets.** Draw each legal-move path along the
   street geometry — as a multi-segment polyline that visibly bends with the roads.
   **Never a straight line between two stations.** The only moves allowed to cross
   blocks are **metro** and **special**, and they should read as doing so.
4. **Viewer-dependent hidden information.**
   - *Fugitive view:* the Fugitive sees **their own icon** and **no** belief shading.
   - *Agent view:* Agents see **no Fugitive icon** — only a **ghost** at the
     last-known node, **belief shading** (a warm additive glow whose intensity encodes
     likelihood), and a **top-3 numeric badge**. **Never a candidate list.**
5. **Mode identity must survive colour-blindness:** distinguish the six movement
   options by **pattern and lightness and a glyph**, not colour alone.
6. **Self-contained HTML.** Inline `<style>` only. **No external resources** — no
   CDN, no web fonts, no images, no network. Must render offline from `file://`.
   System font stacks. No emoji, no lorem ipsum.

## Style delta A — "F" (the MVP-recommended look)

Flat vector, **slight 2.5D tilt** so building facades show, **daylight**. Clean
geometric shapes, flat fills, one consistent shadow direction. Palette: warm
sandstone and terracotta roofs, slate terminals, clear blue water, muted grey
streets — modern and slightly cartoonish. Station numbers and player icons stay
**upright** even though the ground plane is tilted. This look is the reason F was
chosen for MVP: it stays legible at 390 px.

## Style delta B — "H" (the alternative look)

Painterly, textured, **pure orthographic top-down**, **night**. Warm window light
pooling on streets, layered roof materials, lamplit river. **Do NOT add a fog or
haze layer** — the director rejected the fog in the original H mockup because it
implied a visibility mechanic that does not exist. Keep station numbers and
legal-move paths crisply legible against the dark ground: a light rim on markers
and a subtle dark backing pass under paths.

## Quality bar

A real, considered phone screen a player could use under time pressure. The single
test: **can you tell at a glance whose turn it is, where you may legally move, and
where the enemy might be?** If the city beauty fights that, legibility wins.

---

## Shared map and cast (identical in every mockup)

The local map covers a **9-station quarter**, drawn into the map slot. Coordinates
are in a **390 × 520** world box rendered with `viewBox="0 0 390 520"`.

| Station | Class | x,y |
| --- | --- | --- |
| n1 | street | 55,120 |
| n2 | street | 140,95 |
| n3 | street | 250,120 |
| n4 | hub | 330,175 |
| n5 | street | 95,225 |
| n6 | hub | 205,240 |
| n7 | terminal | 300,300 |
| n8 | street | 70,340 |
| n9 | street | 200,360 |
| n10 | terminal | 345,90 |

**Street edges** (taxi and on-foot both traverse these, so their paths must visibly
bend along the streets): n1-n2, n2-n3, n3-n4, n1-n5, n2-n6, n5-n6, n3-n6, n4-n7,
n6-n7, n5-n8, n6-n9, n8-n9, n9-n7.
**Bus** (hub↔hub / terminal): n4-n6, n4-n10, n10-n7.
**Metro** (terminal↔terminal, and the one service allowed to cross blocks): n7-n10.
**Special / alleyway** (secret link, may cross blocks): n2-n9.

**Cast:** the Fugitive is **"Vulture"**; the Agents are **"Falcon"** (A1) and
**"Harrier"** (A2).

Because the streets are not straight, **every legal-move path you draw must be a
polyline that follows the street bends** — for example n6→n2 must bend through the
street shape rather than being a single straight segment. This is the point of the
round.

### Legal moves implied by this map — check against this table, do not improvise

Derived from the edge lists above. **A move that is not in this table is a bug in the
mockup**, and stopping impossible moves from being drawn is precisely what this round
is for.

| From | on foot / taxi (street edges) | bus | metro | special |
| --- | --- | --- | --- | --- |
| **n5** (street) | **n1, n6, n8** | **none** — bus never serves a street node | none — not a terminal | none — no n2–n9 link |
| **n6** (hub) | **n2, n3, n5, n7, n9** | **n4** | none — not a terminal | none |

The rules the table encodes:

- **Bus and metro never serve a standard street node.** An Agent standing on a street
  node therefore has **no** bus or metro move at all. Show those tiles as
  unavailable ("no line at …"); never invent a route to make the screen look richer.
- **Metro connects terminals only** (n7, n10). **Special exists only on n2–n9.**
- On-foot and taxi traverse the **same** street edges; they differ in cost — a foot
  step versus a ticket — not in reach.

Scenario 1 places Vulture on **n6**, where the bus move to **n4** *is* legal; that is
the screen which demonstrates bus.

