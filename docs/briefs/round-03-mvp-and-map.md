# Round 03 briefs — map system, MVP scope, validation

One file, four briefs. **Read §0 (shared context) first, then only your own
section.** Do not read the other agents' briefs; their outputs are separate
deliverables.

---

## §0 Shared context (every agent reads this)

### What X-Yard is

An asymmetric hidden-movement deduction game. One player is the hidden
**Fugitive**; the others are **Agents** who cooperate to catch them. Agents see
the *mode* of every Fugitive move but never the position, except on scheduled
**Reveal Pulse** turns. Capture happens by **occupying the Fugitive's location**.

- Rooms are isolated **Yards**. Transit tiers: **taxi** (short), **bus** (medium),
  **underground/metro** (long), **special/alleyway** (secret links).
- Authority: [`GAME_VISION.md`](../../GAME_VISION.md) §1–§6 (director-authored);
  [`VISUAL_DIRECTION.md`](../../VISUAL_DIRECTION.md) (visual decisions);
  [`AGENT_RULES.md`](../../AGENT_RULES.md) (process). Read the first two before
  writing.
- The engine in `packages/game-core` currently has: domain types, a validated
  transit graph, a ticket economy, a deterministic xorshift128+ RNG, and a
  scaffold fixture. **There is no turn machine, no capture resolution, and no
  state projection yet.** It is node-and-edge based.

### The director's newest directives (these override earlier ambition)

1. **MVP first.** The previous vision (gadgets, agent skills, contraband missions,
   safe houses, 100-player cities) is *visionary but not MVP*. Think about what is
   actually buildable and has balanced, logical gameplay.
2. **Stay close to the original Scotland Yard board game.** Extras are welcome
   where they earn their place — the director specifically names **on foot** and
   **electric scooter** as transport additions.
3. **Mobile-first.** The director does not see this as a desktop-only game and
   wants mobile play treated as primary, with richer detail added later for large
   screens. The MVP must be playable on a small screen.
4. **Minimal screens.** The current mockups depict "the most complex possible game
   screen, with lots of modal windows and options". Start from the minimum instead.
5. **Movement must follow streets.** In the mockups, legal-move lines cut
   diagonally across buildings and blocks. That is wrong. A move may only cut
   across the map if it is a genuine off-street mode — metro (underground) or a
   comparable special mode. Everything else follows the street network.
6. **An open question the director wants researched:** should the game field be
   based on **blocks/squares** with a parallel coordinate system, where diagonal
   streets are fitted inside a square block? Their stated motivation: it is easier
   to control how many characters occupy a square, and to decide whether a
   Fugitive is genuinely in the same square as an Agent (the capture test).

### House rules that bind your output

- Every number must either be stated by the brief, or be clearly marked as an
  **MVP default pending playtest**. Do not present a guess as settled.
- State the **rejected alternative** for any recommendation. A recommendation
  without its rejected alternative is not useful to a later session.
- Do not reintroduce withdrawn vocabulary: no "Mr. X", no cache nodes, no fixed
  `cold-drop`/`blitz`/`marathon` contracts, no black tickets, no shadow steps, no
  `ferry`. The current vocabulary is Fugitive / Agent / turn / Yard / underground /
  special.
- Write plainly for a solo, low-budget developer. Prefer a small number of
  well-argued decisions over an exhaustive enumeration of options.

### Deliverable conventions

- Write exactly the file your brief names. Create no others.
- Markdown only. Tables where they compress meaning.
- End every deliverable with a short **"Open questions for the director"** section,
  each with a recommended default.
- Keep to roughly the length your brief suggests. Depth over volume.

---

## §1 Brief — R: map system research

**Deliverable:** `docs/research/round-03-map-system.md` (target 120–200 lines)

**Question.** Should X-Yard's game field logic be based on **blocks/squares with a
coordinate system**, rather than the current **node-and-edge graph**?

**The director's reasoning, to take seriously and test:**

- It would make **occupancy** explicit — how many characters fit in a square.
- It would make the **capture test** unambiguous — are the Agent and the Fugitive
  in the same square?
- Diagonal streets remain possible, but are *fitted inside a square block*, so
  pathing still reads as streets rather than as lines across rooftops.

**Do light research** (web search is available) on how comparable games represent
their boards — hidden-movement and pursuit games, and node/grid/hex map
representations generally. Cite what you find with links. Keep this proportionate:
a handful of sources, not a literature review.

**Analyse, specifically for this game:**

1. Which representation makes **hidden-information deduction** clearer? Agents
   reason about the set of positions the Fugitive could occupy after a sequence of
   announced modes. Nodes give a discrete candidate set; squares give a spatial one.
2. Which makes **ticket economy** natural? Tickets in Scotland Yard are paid per
   *transport mode between stations*. In a block model, what does a ticket buy?
3. Which makes **street-following movement** easiest to guarantee and to render?
4. Which suits **procedural generation** of many city maps (the vision wants many
   Yards)?
5. Which preserves the **existing investment** in `packages/game-core` (the
   validated graph, ticket bag, RNG, determinism contract, tests)? Be honest about
   migration cost.
6. Does either representation block the long-term ambitions (≈100 players per
   city, many Yards, mobile rendering)?

**Required output shape:**

- A short summary and a single **clear recommendation**.
- A comparison table of the two (plus any third option worth naming, e.g. a hybrid
  where the graph stays authoritative and blocks exist only for rendering and
  occupancy).
- **Rejected alternative**, with the concrete failure mode it would cause.
- What would change in `game-core` if the recommendation is adopted — files,
  types, and tests — and a rough sense of effort.
- Open questions.

**Do not** implement anything. Do not modify `game-core` or any other file.

---

## §2 Brief — M1: MVP rules and mechanics

**Deliverable:** `docs/mvp/round-03-rules.md` (target 200–320 lines)

Define the MVP's **rules and mechanics** as a spec an implementer can build from.
Stay close to Scotland Yard; add only **on foot** and **electric scooter**.

**Must define:**

- Player counts (Fugitive(s) vs Agents) for MVP, and why.
- **Turn structure and phase order**, explicitly. What happens in a turn, who acts
  when, and when capture is evaluated.
- **Ticket economy**: per-mode starting counts for both sides, whether tickets
  refill, and what happens when a mode is exhausted. Concrete numbers, marked as
  MVP defaults pending playtest.
- **Reveal Pulse** schedule and what exactly it reveals.
- **Capture rules**, including the co-occupancy test and what happens on a
  crossing/swap (two players exchanging positions in one turn).
- **On foot**: cost, speed, limits, whether it leaves a trail in the ticket log.
  This matters — if on-foot leaves no trail it becomes a stealth tool, which is a
  balance lever, not a detail.
- **Electric scooter**: what it buys the player. It must not be strictly better
  than an existing mode or the others become dead choices. Propose the specific
  trade-off and say which other mode it competes with.
- **Win and lose conditions**, plus what happens at the turn limit.
- What a Fugitive does when they cannot afford any legal move.
- **Map size** expressed both ways: how many stations, and (if the block model
  gains traction) how many blocks.

**Must explicitly cut, with one line each on why:** gadgets, agent skills,
contraband missions, safe houses, multi-Yard instances, spectating, ~100 players.
Confirm they are out of MVP.

**Also include:** a **"first playable" definition** — the smallest slice that is
already fun — and a balance sanity check (why the Fugitive does not trivially win
or lose).

**Rejected alternatives** for at least: player count, the scooter's trade-off, and
the ticket-refill question.

Where a rule depends on the map-system question (§1) being settled, say so and
state your assumption rather than silently guessing.

---

## §3 Brief — M2: MVP product and mobile-first UX

**Deliverable:** `docs/mvp/round-03-product.md` (target 150–250 lines)

Define the **product surface**: what the player sees and does, mobile-first.

**Must define:**

- **Target session length** for a mobile session, and the turn limit that fits it.
- **The minimum screen list.** The current mockups have many panels; the MVP should
  not. Name each screen, its single job, and what is deliberately absent.
- **The primary gameplay screen on a phone in portrait**, described spatially: what
  occupies the top, the middle, the bottom, and what is *not* shown at all. Be
  concrete about what has to be cut for a small screen.
- How **hidden information** is presented to an Agent on a small screen, given the
  Viewer-Dependent rule (a Fugitive sees their own icon; Agents see ghosts and
  probability).
- **How legal moves are indicated** so that paths visibly follow streets, on a
  small screen, without the diagonal-across-buildings problem.
- **Onboarding**: how a new player learns the rules in under a minute.
- **Accessibility**: colour-blind safety for the transport-mode colours, contrast,
  and touch target sizing.
- The **desktop enhancement** — what is added on a large screen later, so the
  mobile-first choice does not paint us into a corner.

**Also include:** what the MVP explicitly does **not** do (chat, accounts,
spectating, replay viewer, tutorials beyond one screen, etc.).

**Rejected alternatives** for at least: portrait-first vs landscape-first, and
minimal HUD vs the panel-heavy mockups.

---

## §4 Brief — V: validator / adversarial playtest

**Run this only after §1, §2 and §3 exist.** Read all three, then try to break the
MVP before a player does. **Deliverable:** `docs/mvp/round-03-validation.md`
(target 150–250 lines)

**Method — do this concretely, not in the abstract:**

Write **three short game transcripts**, turn by turn, with real positions, real
ticket spends, and the reveal schedule. Something like:

```
T1  Fugitive: taxi  → n_14   (log: taxi)
T1  Agent A: taxi → n_09     Agent B: bus → n_22
...
```

At least one transcript must end in a capture, at least one must reach the turn
limit, and at least one must be a competent-player game (not two beginners).

**Then judge, honestly and specifically:**

- Is it **interesting**? Name the moment of tension, if there is one. If there
  isn't, say so plainly — that is the most valuable thing you can report.
- Is it **balanced**? Who is favoured and by how much?
- Try to **degenerate** it: can the Fugitive camp? Can Agents turtle and win by
  doing nothing? Can ticket starvation decide the game before skill does? Does the
  scooter become mandatory or useless? Does on-foot trivialise the ticket economy?
  Can a swap/crossing produce an ambiguous or unfair capture?
- Does it **work on a phone** in a 5–10 minute session, given §3?
- Does **deduction stay tractable** for a human under time pressure, or does the
  candidate set explode?

**Required output:** the transcripts, then a verdict ("worth building", "worth
building only if X changes", "not yet interesting"), then a **prioritised list of
concrete fixes** — each naming the rule it changes and the specific problem it
solves. End with open questions.

Being critical is the job. A validator that approves everything has failed.
