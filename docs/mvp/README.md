# docs/mvp/ — the ratified MVP

The MVP re-stated **after** validation, because the validator's verdict changed
three things. This file is the short, authoritative summary; the three documents
below are the detail, and where they disagree with this file, **this file wins**
until the director rules otherwise.

| Document | Role |
| --- | --- |
| [`round-03-rules.md`](round-03-rules.md) | Rules and mechanics (agent M1) |
| [`round-03-product.md`](round-03-product.md) | Product surface and mobile UX (agent M2) |
| [`round-03-validation.md`](round-03-validation.md) | Adversarial playtest and rulings (agent V) |
| [`../research/round-03-map-system.md`](../research/round-03-map-system.md) | Map representation research (agent R) |

## Director rulings of 2026-10-16 — authoritative

These override the agent recommendations in §1–§5 wherever they conflict, and they
name what they invalidate.

1. **A prototype phase precedes the MVP.** Its stated purpose is to give the director
   a *feeling of success* and to validate what the game looks like. It is
   single-player: **5 seats, 1 human and 4 bots.** Bots need not be clever. The plan is
   [`docs/project-plan.md`](../project-plan.md) Part 1.
2. **The MVP is multiplayer, and larger than specified here.** It must support a map
   of **up to 20 players, 4 of them Fugitives** (4 Fugitives + up to 16 Agents), with a
   solo player filling the remaining seats with bots and **a human joining later able
   to take over a bot's seat.**
   → **This invalidates the 3-seat assumption.** M1's rules, M2's screen set and V's
   balance analysis were all written against *1 Fugitive vs 2 Agents*. §3 below still
   says "3 seats" and is **stale**. The 4-Fugitive model also changes the
   hidden-information problem: each Fugitive has their own position and log, so
   `projectState` must project **per viewer and per Fugitive**, not for one hidden
   player. These documents must be rewritten before implementation.
3. **No same-device sharing.** One device per seat. This confirms P0 #3 in §2.
4. **The map stays node-and-edge** for movement; the block/square proposal is
   **rejected**, so §4 below still stands. The **map generator is early work** — the
   prototype may use a small hand-authored map, but generator work starts before the
   MVP.
5. **Appearance dominance is accepted for now**, and the proposed cycle is adopted:
   **16 turns, appearances on 5 / 10 / 15.** **Starting separation ≥ 3 edges** between every
   Agent start and the Fugitive start is adopted.
   → This closes R13 and R15 and sets R14 aside as playtest tuning. The validator's
   candidate-set concern remains *true* — it saturates mid-interval — but it is **not a
   blocker** for the prototype.
6. **Faction assignment is random**, with a **testing/prototype override that always
   lets the director play as the Fugitive.**
7. **Each faction acts in its own TIMED CONCURRENT window: 30 seconds, all members
   moving at once.** Within the Agent window every Agent moves, and **a move is
   visible to the other Agents the moment it is made**, so a later mover acts on more
   information. The **Fugitive window then follows the same shape**, and **Fugitives
   see each other.** 30 s is explicitly a starting value to tune.
   → **This replaces sequential play.** M1's fixed `detectiveOrder` rotation is
   obsolete, and the ratified order (`fugitive-phase → reveal-pulse → agent-phase`) no
   longer matches: the ruling reads **Agents first, then Fugitives**.
   → **Faction-internal visibility supersedes the simpler rule** in
   `VISUAL_DIRECTION.md` decision 4: Agents see all Agents, Fugitives see all
   Fugitives, and neither faction sees the other except through a Appearance and the
   public mode log.
   → **Wall-clock still never decides *what* happens.** The timer lives in the server;
   a timeout reaches `game-core` as an event, so `submitCommand` stays pure. Because
   moves land in arrival order and are observable mid-window, that **order changes
   outcomes and must be recorded** — the append-only event log already does this, and
   replay must never re-sort it.
   → **Arithmetic caution, unresolved:** 16 turns × two 30 s windows is up to **16
   minutes**, against the 5–10 minute mobile target. Windows must therefore **close
   early once everyone has moved**, and the turn limit may need to come down.

   **Open sub-questions from ruling 7** (flagged, not decided):
   - Confirm the order is **Agents, then Fugitives** — it reverses the previous spec.
   - **Timeout behaviour:** does a player who runs out of time `hold`, or receive a
     pure `chooseAutoMove`? M1 has `hold` for the stuck case, but a timeout is not the
     same as being stuck.
   - Does the window **close early** the moment every member has moved? (Required, per
     the arithmetic above.)
   - **Where does the Appearance sit** now — before the Agent window, so Agents can
     act on it, or after the Fugitive window?
   - **Concurrent-move collisions:** two Agents reaching the same node, and an Agent
     and a Fugitive crossing paths inside one window.

## 1. The validator's verdict

> **"Worth building only if three things change."** As specified, the game reduces
> to *"don't be adjacent to an Agent at the appearance, be adjacent at the appearance"* — the
> Appearance **is** the game, and everything else is bookkeeping around three to
> five one-turn windows.

That is a serious finding and it is the single most important input in this round.
It is **not** the same as "the MVP is bad" — it means the loop as written is not
yet interesting, and must be fixed before implementation, not after.

**Director ruling (2026-10-16):** accepted for the beginning. The appearance-dominant loop
is a known limitation to revisit after the prototype, not a blocker.

## 2. The three P0 changes (applied here)

1. **Turn limit 16, not 24.** Appearances on **5 / 10 / 15** (M2's numbers; M1's
   24-turn schedule is wrong). Arithmetic on M2's own 55 s + n×25 s model: 24 turns
   = 11 min 35 s, outside the 5–10 min phone target; 16 turns = 7 min 55 s. M1's
   turn-23 appearance also left a five-turn unpruned interval followed by a one-turn
   "climax" — two uncompensated endgames.
2. **The scooter's exact-position reveal is cut.** M1 revealed the scooter's ending
   node *before* the Agent phase, while capture is an end-position test — so any
   Agent within one move of the revealed endpoint captured with no deduction and no
   counterplay. It was also unnecessary: 25 non-scooter moves for a 24-turn game
   means the scooter's tempo is never required (validation transcript 2 reaches the
   limit with zero charges spent). **The scooter keeps its `scooter` log row and
   visible remaining charges; the reveal is deleted.** Fixing this by giving Agents
   scooter charges was rejected — it doubles the asymmetry.
3. **One device per seat. Pass-and-play is not the ship mode.** M2 proposed
   same-device hot-seat to delete the entire lobby/reconnect surface. It leaks
   hidden information three ways: the Fugitive's move is physically visible to
   Agents sitting alongside; three hand-offs per turn is 48 transfers over 16 turns
   (~96 s of pure hand-over, ~32 s/turn against a 25 s budget); and a press-and-hold
   hides a glance, not an unattended device between two Agents. **Hot-seat stays as
   M1's first-playable developer harness only.** If the director insists on avoiding
   netcode, the defensible cheaper variant is **12 turns with appearances 4 / 8 / 12**.

## 3. The MVP in one page

- **Seats:** up to **20 players — 4 Fugitives and up to 16 Agents** (ratified
  2026-10-16), one device per seat, bots filling empty seats, and a human joining
  later able to take over a bot's seat. **This replaces the earlier "3 seats — 1
  Fugitive vs 2 Agents"**, which is what `round-03-rules.md`,
  `round-03-product.md` and `round-03-validation.md` were written against and are
  therefore now stale.
- **Length:** 16 turns. Target 5–10 minutes on a phone.
- **Turn order:** fugitive-phase → **reveal-pulse** → agent-phase →
  capture-resolution. The appearance deliberately runs *before* the Agent phase so Agents
  can act on it the same turn.
- **Modes:** `taxi`, `bus`, `underground`, `special`, plus **on foot** and
  **electric scooter**. Do **not** widen `TransportMode`; add
  `MobilityOption = TransportMode | 'foot' | 'scooter'` and
  `LoggedTransport | 'hold'`.
- **On foot:** street edges only, **logged** (leaves a public trail row), costs one
  of 8 finite foot steps — a reserve, not a second economy. Silent foot was
  rejected: it creates an unbounded silent branch in the Agents' candidate set, so
  deduction becomes unfalsifiable, and it dominates every paid mode.
- **Scooter:** 1 charge = 2 consecutive street-following edges in one turn, logged
  `scooter`, **no reveal**. Competes with `taxi` on tempo vs quietness. 3 charges
  for the Fugitive, 0 for Agents.
- **Capture:** end-position equality only (`agent.node === fugitive.node`).
  Co-location is a **set**, not a capacity — nodes are uncapped. Moving onto an
  occupied node is legal and can be a self-capture. **A crossing/swap is not a
  capture** (under staggered ticks they were never co-located). Appearance is not
  a capture moment.
- **Log invariant:** exactly one public row per living Fugitive per turn — the move
  row or a forced `hold`. No silent turns. *Known gap:* pin this to the turn
  sequence **unconditionally**; the validation found the capture turn currently has
  zero rows.
- **Map:** 60 stations (≈40 street / 14 hub / 6 terminal, ~105 edges), median Agent
  candidate set target ≤ 12 nodes just before an appearance. **Proposal, pending review at
  the 20-player scale** — it was sized for 1 Fugitive vs 2 Agents.
- **Starting separation:** **≥ 3 edges** between every Agent start and every Fugitive
  start (ratified 2026-10-16). Currently stated for a single Fugitive; the four-Fugitive
  case still needs defining.
- **Map representation:** **node-and-edge stays authoritative** — ratified 2026-10-16,
  see §4.
- **Cut from MVP:** gadgets, agent skills, contraband missions, safe houses,
  multi-Yard instances, spectating, ~100-player cities.

## 4. The map decision — research disagreed with the hypothesis

The director proposed a block/square field with a parallel coordinate system,
expecting it to make occupancy and the "same square?" capture test unambiguous.
**The research recommends against it**, and the reasoning is worth keeping:

- **A block model does not make capture more unambiguous.** Capture is already one
  exact discrete comparison (`agent.node === fugitive.node`); a square gives the
  same single comparison. The mockups *read* ambiguously because two **continuous
  screen positions** were compared by eye — that is a **rendering/legibility bug,
  not a representation bug.**
- **It would collapse the transport tiers.** Mode stops constraining *where* a move
  lands and only says how far. On a uniform lattice every cell has identical
  neighbours, so after an appearance plus three logged modes an Agent's candidate set goes
  from tens of nameable stations to hundreds of interchangeable squares — and
  bus/metro degenerate into "long taxi", destroying the four-tier ticket economy.
- **The real fix is per-edge street geometry.** A move is an *edge sequence*, and a
  single move is exactly one edge, so decision
  [0010](../decisions/0010-legal-moves-follow-streets.md) is **not sufficient on
  its own**: without authored waypoint geometry for each street edge, drawing that
  one edge straight still crosses buildings. Every street edge needs
  `geometry: [x,y][]` (≥ 2 points); only `underground` and `special` may cross
  blocks.
- **Honest weakness of this recommendation:** it leaves "does this line cross a
  building?" answered in *map art data*, with nothing yet enforcing it. A generator
  can emit a thin straight edge and the diagonal bug returns with no test failing.
  The guard belongs with the client renderer and is **not yet written**.

## 5. Open questions for the director

1. **The core loop is the real question.** Fixing the three P0s does not by itself
   answer the validator's finding that the Appearance dominates. Options:
   (a) ship the corrected 16-turn MVP and accept it as a **thin loop to validate
   the pipeline**, not a finished game; (b) **restore tension by scale** —
   more Agents (1v3) and/or a larger map — which costs more seats and more netcode;
   (c) **change the loop** — give Agents a second lever between appearances (a
   search/sweep action) so the appearance is not the only real decision.
   *Recommended default:* (a) for the first playable, with (b) as the first
   post-MVP experiment, because a thin loop is still enough to prove the pipeline
   and the deduction UI. But this is a **design call, not an engineering one.**
2. **Appearance interval.** V ruled 5/10/15 (for 16 turns), then separately
   recommended interval 4 (4/8/12/16) because the candidate set saturates to
   ≥ 14–40 nodes mid-interval. **These conflict.** *Recommended default:*
   4 / 8 / 12 / 16, and run M1 §12's candidate-set bound as a real solver test over
   the shipped map rather than trusting the estimate.
3. **Starting separation ≥ 3 edges** is a new map-authoring requirement: with both
   Agents 2 edges from the Fugitive's start, validation captured the Fugitive on
   turn 2 with no play at all.
4. **Seat assignment** — who becomes the Fugitive — has no rule yet.
5. **Metro topology.** A near-complete terminal graph lets a single terminal Agent
   threaten every terminal, which turned one transcript into a free kill.
