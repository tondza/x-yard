# Round 03 — M2: MVP product and mobile-first UX

**Deliverable:** X-Yard's MVP product surface — what the player sees and does on a phone,
portrait-first, in a 5–10 minute session. Refines
[`GAME_VISION.md`](../../GAME_VISION.md) and
[`VISUAL_DIRECTION.md`](../../VISUAL_DIRECTION.md), never overrides them. Rules are M1's
`round-03-rules.md`; map representation is R's `round-03-map-system.md`. **`MVP-DEFAULT`** =
playtest-tunable recommendation; **`ASSUMED`** = a rule owned by M1/R, stated inline; numbers
reaching code export under `PROVISIONAL_` names.

**Mandate.** The round-02 mockups
([`design/moodboard/round-02-city/`](../../design/moodboard/round-02-city/)) show eight HUD
panels, a nine-button action bar, a probability chart and a minimap. The director's
complaint: *"the most complex possible game screen"*. This designs the opposite.

## 1. Inline assumptions (rules consumed, not owned)

| # | Assumption | Owner | If wrong, what changes here |
| --- | --- | --- | --- |
| A1 | Turn limit **16**; pulses on turns **5, 10, 15** (`MVP-DEFAULT`) | M1 | Only §2's numbers — the turn strip renders whatever the rules return |
| A2 | **1 Fugitive vs 2–3 Agents** per Yard (`ASSUMED`) | M1 | Nothing structural; changes how often I1 (§4) appears |
| A3 | Every street edge **carries street geometry** (waypoint path) | R / generator | **Load-bearing.** Without it, moves cannot be drawn along streets (§6) and the diagonal defect is unfixable |
| A4 | Node-and-edge map; stations have stable numeric ids | R | If R picks blocks, the marker becomes a square and the hit target a block; bar, strip, tray, shading all survive |

## 2. Target session length and the turn limit that fits it

**Target: 5–10 minutes of phone-in-hand time.** One game = one session; no
suspend/resume. Budget on **~25 s per player-decision round** (`MVP-DEFAULT`):

| Phase | Time |
| --- | --- |
| Open → in-game (two taps) + first-run onboarding | 55 s |
| Play: 16 rounds × 25 s | 400 s |
| **Total** | **≈ 7 min 55 s** |

The window allows 10–22 rounds, so **16 turns** sits mid-window with margin; at interval 5
Reveal Pulses fall on **5, 10, 15** — three reveals, then turn 16 as a final "no more
information is coming" turn. This changes two then-unratified defaults
(`PROVISIONAL_YARD_TURN_LIMIT`, `PROVISIONAL_REVEAL_PULSE_TURNS`, since ratified
as `YARD_TURN_LIMIT` and `REVEAL_PULSE_TURNS`) — see Open Question 1 —
and **no UI may hard-code the schedule**. `MVP-DEFAULT`: **no hard per-turn timer** — the target
is a budget, not enforcement, because the deduction *is* the game and the player may be on a
bus; show a soft "waiting for A2" after 40 s.

## 3. The minimum screen set: four screens, three full-screen surfaces

| # | Screen | Its single job | Deliberately absent |
| --- | --- | --- | --- |
| **S0** | **Join & set up** | Pick seats and side in two taps; hand the phone to seat 1 | accounts, login, friends, leaderboard, chat, custom rules, loadout, settings beyond a haptics toggle |
| **S1** | **How to play** | Teach the loop in one screen, ≤ 40 s | multi-page tutorial, coach marks, tooltip tour |
| **S2** | **Board** | Play the entire game | *everything in the mockups* (§3.2) |
| **S3** | **Result** | Say who won and why; offer rematch | stats graph, replay scrubber, share card, XP |
| **—** | **Full-screen surfaces** (not screens) | Pass-device interstitial (§4), capture card (1.5 s), rotate prompt (§8) | — |

**The zero-modal rule.** The MVP board has **zero modal dialogs**; nothing is dismissible back
into a form. Surfaces covering the map are terminal (capture, result) or blocking by design
(pass-device, rotate prompt), and move confirmation happens **in the tray**. A modal on a 390 px
screen costs a fifth of the map plus a full tap of attention — and the mockups' gadget, skill and
mission panels are all modal-shaped (§10).

### 3.2 What died from the mockups

Mockup F's eight persistent panels consume ~100 % of a 390 × 844 viewport, so the map becomes
a postage stamp and the mockups' own quality bar — *"can you tell at a glance where you may
move and where the enemy might be?"* — fails outright.

| Mockup panel | Fate | Where its information went |
| --- | --- | --- |
| TURN + REVEAL PULSE; TICKET LOG | kept, merged / compressed | One segmented turn strip (which doubles as the pulse schedule) plus a 36 px one-line chip scroller |
| PROBABILITY chart, mission briefing, DAY CYCLE clock | **deleted** | Map shading + a top-3 numeric badge; no MVP mechanic reads the clock or contraband |
| ACTION BAR, TRANSPORT legend, VIEWING-AS toggle | **deleted** | Gadgets and skills are out (§10); the tray prints mode name and line sample; the client already knows the viewer |
| Selected-character panel, CITY OVERVIEW minimap | kept, compressed / demoted | One tray-header line `A1 · 2 taxi · 1 bus`; pinch out to a read-only city view (§4) |

Net: **eight panels and a nine-button bar → one 36 px strip and one tray.**

## 4. The board on a phone, in portrait

Reference viewport **390 × 844 CSS px** (iPhone 15 class), plus safe areas.

| Slot | Height | Contents | Why it earns the space |
| --- | --- | --- | --- |
| Top bar + log strip | 92 px | Segmented turn strip, pulse countdown, whose-turn badge; below it, ticket-log chips (newest left, scrollable, edge-faded) | The pulse turn is the most decision-relevant number, and the log is the Agents' only deduction input |
| **Map** | **~542 px (flex)** | The city, zoomed to a 1.5-screen neighbourhood | The game *is* the map; everything else is a caption |
| Tray | ≤ 176 px | ≤ 3 legal mode rows @ 48 px + one 24 px status line | The only interactive control; sits in the thumb zone |

That leaves the map **390 × 542 px**, showing **6–10 stations**.

**Top.** 16 segments — past filled, current ringed, pulse turns pip-marked, future hollow —
plus the countdown in words and a seat badge. **No sector label, clock or viewer toggle.**

**Middle.** Camera zoomed and centred on the selected character, 6–10 stations visible, **no
permanent route lines**, belief shading only. **No minimap**: a ~78 px inset at this width
conveys no usable geometry, so decision 9's full-city overview becomes a **pinch-out gesture** —
dimmed, read-only, no taps, zero pixels at rest — returning as an inset on desktop (§9).

**Bottom — the tray, two states, one height**, which keeps the screen count at four.
*Choose mode:* one 48 px row per **legal** mode — `[line sample] [mode name] [cost] [n
destinations]`; non-legal modes collapse into one 24 px dimmed line, `Metro — needs a
terminal`, since **the UI teaches a rule by refusing an action**. *Choose destination:* tapping a
row draws **only that mode's** edges, rings its destinations, and swaps the rows for `Taxi → tap
a station`, `Cancel`, disabled **Move** — **two-step commit is deliberate**, since single-tap
lets a thumb slip spend a ticket on the wrong station.

**I1 — pass device.** Between seats an opaque `Pass to A2 — Falcon` card appears, and the next
viewer's projection is built **only after a 1-second press-and-hold**, not a tap: a glance
while the Fugitive is on screen would destroy the game.

**Not on the board at all:** roster of other Agents, any modal, any candidate-station list, any
chart, the mission briefing, gadgets and skills, chat, a full-city view. **The ticket log is the
only list in the MVP.**

## 5. Hidden information on the small screen

Decision 4 is viewer-dependent, and on a phone it must be **visual, never a list** — a candidate
list is the mockup disease. An Agent sees four tiers:

- **Mine / other Agents** — solid ringed icons, camera-centred, the others seat-badged and
  always visible.
- **Revealed this pulse** — solid icon, expanding ring, camera auto-pans for ~2 s: the one
  unasked camera move.
- **Last known** — ghost at 30 % opacity in a dashed ring tagged `T3`; tap for the detail.
- **Unknown** — no icon: a translucent **belief halo** whose opacity tracks probability, plus a
  numeric badge on the **top 3 stations only** and the ranked list in the log-chip popover. The
  cap is deliberate: more numbers is confetti at 390 px.

The Fugitive's view is the same screen under a different projection (own icon solid, Agents solid,
no belief shading), so **viewer-dependence costs zero extra screens**. Never shown to an Agent: the
exact node between pulses, ticket counts, or the mode before it is committed.

## 6. Legal moves that visibly follow streets

The complaint — legal-move lines cutting diagonally across buildings — is **not an art bug
but a data bug**: the mockup edges carry no street geometry, so the renderer draws chords.

**One mode at a time.** Never draw all legal moves at once: five overlapping line styles are
the "complex screen" being rejected, and at 390 px they are indistinguishable anyway.
Default: no lines; arming a mode draws only that mode.

**Street-following is a data requirement, not a styling choice.** Taxi and on-foot are
node-to-node along street edges (decision 2), so every such edge must carry a **waypoint path** —
`edge.geometry: [x,y][]`, ≥ 2 points, following the road. Drawing a move = stroking that path; if
R recommends **blocks**, the block boundary is the geometry source instead. The requirement in
spirit is unchanged — *the visible line between two playable positions must be a street, not a
chord*. Metro and alleyway are the **only** genuine crossing moves, styled so the exception reads
as one: metro as a cased tunnelled line, alleyway as a fine dotted line.

**Touch spacing.** Destination hit targets ≥ **44 px** even when the marker draws at 20 px; if two
are closer than that at current zoom the map steps one zoom level in. Arming a mode also nudges
the camera so every destination falls in the bottom two-thirds — never out of thumb reach.

## 7. Onboarding in under a minute

One screen (S1), ≤ 40 words, three beats, dismissed by a single **Start**: (1) You move along
the coloured lines; every move spends a ticket of that colour. (2) Fugitive: never share a
station with an Agent. Agents: share the Fugitive's. (3) The pulse shows the Fugitive — watch
the countdown. The rules then keep teaching themselves through locked affordances: an
unavailable mode is visibly disabled with its reason printed on it, so a player who never reads
S1 still learns the terminal rule in turn one. The same screen opens from a `?` in the tray header.
(Rejected: a scripted tutorial — too much state and UI for three sentences.)

## 8. Accessibility

### 8.1 Colour-blind safety for the mode colours

**The test, stated so it can be checked:** screenshot the map and the tray, desaturate to
greyscale, and the five modes must still be tellable apart — **pattern + lightness + glyph**,
never hue alone, carry it.

| Mode | Hue (`MVP-DEFAULT`) | Lightness | Pattern | Glyph | Cost label |
| --- | --- | --- | --- | --- | --- |
| On foot | neutral grey | light | dotted 1 px | boot | free |
| Taxi | amber `#E8A33D` | light | solid 2 px | car | 1 taxi |
| Bus | blue `#2E6FD9` | mid | solid 3 px + ticks | bus | 1 bus |
| Metro | near-black casing, white core | dark | solid 4 px, double-stroked | tunnel portal | terminal only |
| Alleyway / special | violet `#8B5CF6` | mid-dark | long-dash 2 px | keyhole | secret link only |

This survives deuteranopia and protanopia and degrades into five distinct signatures under
tritanopia and greyscale.

### 8.2 Contrast, and the specific risk of visual direction H

Body text ≥ **4.5:1**, large numerals ≥ **3:1**. Text on the map is never drawn straight onto
the cityscape — every label gets a near-opaque plate or halo. A painterly **night** city
(direction H) is the danger case: it swallows dark UI text and collides with dark belief
shading, so if H is chosen, **(a)** a ≥ 80 % opacity scrim under top bar and tray, **(b)** a 2 px
light rim on every player ring and station halo, and **(c)** belief shading as a *warm additive
glow* are non-negotiable.

### 8.3 Touch, motion, scale, orientation

- **48 px** minimum for tray rows and map hit targets, **8 px** between adjacent targets — above
  the 44 px platform floors, because a mis-tap here is irreversible. Nothing interactive in the
  top 44 px or bottom 34 px (notch, gesture bar).
- **`prefers-reduced-motion`** reduces the reveal ring and the day-night tint to instant static
  changes, losing nothing since no mechanic reads the cycle. **200 % OS text scale** must not
  cause horizontal scroll (canvas map labels are the documented exception).
- **Orientation locked to portrait** — landscape shows a rotate prompt (§11, R1). **Haptics**
  pulse on your own reveal and on capture. **No audio in MVP at all** — no assets, no
  permission prompt, no silent-switch bug.

## 9. Desktop enhancement

The board is a **column flexbox with three slots** — bar / map / tray — that swaps to a **grid at
≥ 900 px** with the tray as a right-hand rail. That single primitive is the escape hatch. On a
large screen, *added and only added*: the persistent full-city overview inset (decision 9,
unparked); probability as a sortable **list** beside the map — the form mobile cannot afford; the
ticket log as a fixed table; two-turn move preview on hover; and keyboard control (`1`–`5` arm a
mode, arrows cycle destinations, `Enter` commits, full `:focus-visible`). Hard rules: **nothing is
drag-only, nothing depends on hover, no phone layout is a cropped desktop layout.**

**On directions F and H:** the layout above is **identical under both**. F (flat vector, 2.5D,
day) reads streets immediately, needs a scrim and little else, and is cheap across 600–900
procedural stations. H (painterly, top-down, night) is the most atmospheric but needs §8.2 (a)(b)(c)
or the belief layer vanishes at phone size. **Product recommendation, not an art decision: ship F.**

## 10. What the MVP explicitly does not do

- **Chat, voice, emotes, friend lists; accounts, login, profiles; matchmaking, MMR, rankings,
  leaderboards** — same-device play needs no identity at all. Also out: **spectating**, **replay
  viewer / turn-history scrubber** (the log-chip popover is the minimum viable history), and
  **tutorials beyond one screen**, coach marks, tooltip tours.
- **Gadgets and Agent skills** — the nine-button action bar: the single largest UI deletion in
  the mockups, and the one the director asked for. Also **contraband missions, safe houses,
  black markets, progression, XP, cosmetics**, and **day-night as a *mechanic*** (ambient tint
  only, and only if it costs no more than a tint).
- **The ~100-player, 600–900-station city as a playable view** (MVP sessions are four seats),
  **multiple Yards / city selection**, **landscape layout**, **ambient pedestrians and cars**
  (decision 6), audio, push notifications, reconnect/resume, and localisation (English-only).

## 11. Rejected alternatives

| # | Recommendation | Rejected | Concrete failure mode |
| --- | --- | --- | --- |
| **R1** | **Portrait-first** | Landscape-first | Landscape halves the vertical map field while the tray still needs the bottom thumb zone, fights both OS gesture bars, and forces a rotation. The mockups are 1280 × 720, so carrying that aspect ratio into the phone carries the panel-stacking disease with it |
| **R2** | Minimal HUD: one 36 px strip + one tray | The mockups' 8-panel HUD | At 390 × 844 the eight panels exceed the viewport; the map becomes a ~40 mm square and the mockups' own quality bar fails |
| **R3** | MVP ships **same-device pass-and-play**; online in v1.1 | Online-only with a lobby at MVP | Lobby, waiting, reconnect, invite code and chat add 3–5 screens and unbounded scope *before* the loop is proven fun, and a solo developer cannot test online play alone. Online at MVP instead costs **+2 screens** and turns I1 into a reconnect flow |

## Open questions for the director

1. **Turn limit 16, not 24; pulses 5 / 10 / 15.** *Default: yes* — the only way the 5–10 min
   session closes without cutting deduction quality. **Ratified 2026-10-16** as `YARD_TURN_LIMIT`
   and `REVEAL_PULSE_TURNS`; at 40 s per round it drops to 10.
2. **Same-device pass-and-play, or online from day one?** *Default: pass-and-play* — it
   removes the lobby/waiting/reconnect surface and lets a solo developer test alone (R3).
3. **Can the generator guarantee per-edge street geometry?** (A3) *Default: it must* —
   without it the diagonal defect is unfixable. R's brief should be answered first.
4. **Are numeric percentages shown on the map?** *Default: top 3 stations only*; if none,
   the shading must carry more.
5. **F or H?** *Default from the product side: F for the MVP* (§9).
6. **Does on-foot leave a ticket-log trail?** (VISUAL_DIRECTION §3) *Default: no trail* — the UI
   renders either way, but the Agent's chip label depends on it. M1 owns the ruling.
