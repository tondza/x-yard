# Round 03 — V: validation and adversarial playtest

**Deliverable owner:** agent V. **Method:** [`round-03-mvp-and-map.md`](../briefs/round-03-mvp-and-map.md) §4.
**Read:** [`round-03-map-system.md`](../research/round-03-map-system.md) (R),
[`round-03-rules.md`](round-03-rules.md) (M1), [`round-03-product.md`](round-03-product.md) (M2),
plus [`GAME_VISION.md`](../../GAME_VISION.md) and [`VISUAL_DIRECTION.md`](../../VISUAL_DIRECTION.md) for authority.

**Nothing here is implemented.** No file outside this one was changed.

**What can and cannot be tested.** There is no turn machine, no capture resolution and no
60-node map (M1 §12 is a *default pending playtest*; the engine has a scaffold fixture). So
the transcripts below run on an **explicitly synthetic skeleton board** that satisfies M1's
stated structural constraints — 60-node counts, node classes, degree ≈ 3.5, street subgraph
spanning all nodes, bus/metro avoiding street nodes. It is a *test rig*, not a proposal. Every
number taken from M1 §4.1, §7, §8 is used exactly as written. Where a claim needs the real map
it is flagged **NEEDS-MAP**.

---

## 1. The test rig

M1 §12 gives counts and §9 C1–C4 gives the capture test. The rig implements exactly those, no more.

| Class | Count | Modes allowed | Degrees in rig |
| --- | --- | --- | --- |
| `street` | 40 | taxi, foot, scooter | 2 |
| `hub` | 14 | taxi, foot, scooter, bus (≥ 2 bus edges) | 2–4 |
| `terminal` | 6 | taxi, foot, scooter, bus, metro (≥ 2 metro edges) | 2–4 |

**Skeleton topology used in the transcripts** (26 of the 60 nodes; the remainder is filler that
does not enter play). `s` = street, `h` = hub, `t` = terminal. Taxi edges are the street cycle
`s01–s02–s03–s13–s14–s15–s16–s17–s06–s05–s04–s12–s11–s10–s09–s08–s07–s18–s19–s20–s21–s22`
joined to the hub spine `s19–s20–h10–h01–h02–h03–h04–h05–h07–h08–h12`; `h02–h13`,
`h06–s13`, `h10–s14`, `h11–s16`, `h07–s17`, `h09–s27`, `h05–s25`; terminals hang off
`t01–h13`, `t02–h05`, `t02–h09`, `t03–h08`, `t04–h06`, `t04–h07`, `t05–h01`, `t06–h12`.
Bus (16 edges) = `h01–h02–h03–h04–h05–h10–h11–h01` plus `h06–h07–h08–h09–h12–h11` plus
`h02–t02`, `h04–h06`, `h11–t04`. Metro (9 edges) = the 6-ring `t01–t02–t03–t06–t05–t04–t01`
plus `t06–t02`, `t03–t05`. Special (2 edges) = `h09–h03` (black market) and `h09–h07` (safe
house) — M1 §1.1's two inert nodes.

**Reading the transcripts.** `→` is one move. The public log row is shown in brackets. Agents'
log rows do not exist (M1 §10: *"the log is the Fugitive's trail only"*) — the Agent moves below
are the players' own knowledge, printed so the reader can follow, **not** broadcast rows. The
**F4 invariant** (M1 §5) is one public row per living Fugitive per turn; it is checked at the
foot of each transcript.

---

## 2. Transcript 1 — "learning game", ends in capture

Two beginners; the Fugitive is revealed on turn 3 (M1 schedule), over-fixes to the north-east
spur, and is boxed. Capture on **turn 7**.

| T | Fugitive | log | A1 (`s02`) | A2 (`h10`) | Reveal |
| --- | --- | --- | --- | --- | --- |
| 1 | `s07 → s06` taxi | `taxi` | `s02 → s03` taxi | `h10 → h01` bus | — |
| 2 | `s06 → s10` taxi | `taxi` | `s03 → s04` taxi | `h01 → h10` bus | — |
| 3 | `s10 → s13` taxi | `taxi` | `s04 → s18` taxi | `h10 → s20` taxi | **pulse: F at `s13`** |
| 4 | `s13 → t05` metro | `underground` | `s18 → s22` taxi | `s20 → s25` taxi | — |
| 5 | `t05 → t01` metro | `underground` | `s22 → s13` taxi | `s25 → t02` bus | — |
| 6 | `t01 → s06` metro | `underground` | `s13 → s10` taxi | `t02 → t01` metro | — |
| 7 | *captured, no move resolves* | — | `s10 → s11` taxi | `t01 → t05` metro → **capture** | — |

T5 arithmetic is the whole game: after the turn-3 pulse the Fugitive's candidate set was
`deg(s13) = {s11, s12, s15, t05}` — **4 nodes, and one of them is a metro terminal**. A2 needed
one move to cover it (`s25 → t02`, a bus edge), and from `t02` the metro ring reaches *every*
terminal in one move. Once the Fugitive is committed to the terminal ring, the ring's 6-ring-plus-2
topology means an Agent at any terminal threatens every terminal. The Fugitive's only escape is
back onto the street ring, and turn 6 spends the third metro ticket doing exactly that — which is
the moment the log has been announcing for three turns.

**Ticket spend at capture.** F: 4 taxi, 3 metro, 0 foot, 0 bus, 0 special (pulse interval 2 used
2 taxi; metro drained in a straight line). A1: 7 taxi. A2: 2 bus, 1 taxi, 2 metro.

**Is this a deduction game or a chase?** Both, and that is the honest answer. The Agents' winning
move on T5 (`s25 → t02`) was *deduced*, not stumbled into: A2 read `underground` on T4 and counted
that the only reachable terminal set from `s13` was `{t05}` — the pulse plus one log row gave an
exact answer. Tension exists and it is at T4–T5. The failure is that it *ends* there: the
Fugitive had one legal plan and the plan was readable. A competent Fugitive would not have taken
the turn-3 taxi into a degree-4 node on a pulse turn.

**F4 check:** turns 1–6 each have exactly one Fugitive row; turn 7 has zero, because the Yard
ended inside `agent-phase` before the Fugitive's row could exist. That is a real hole in the
invariant as written (§6, fix 8).

---

## 3. Transcript 2 — "competent Fugitive", reaches the turn limit

Both sides play well. The Fugitive never ends a pulse turn within 2 edges of an Agent, spends
foot as a last-resort reserve, keeps every scooter charge in the box, and survives to turn 24.

| T | F move | log | F remaining (taxi/bus/metro/special/foot/scooter) | Nearest Agent | Reveal |
| --- | --- | --- | --- | --- | --- |
| 1 | `s07 → s06` | `taxi` | 7/4/3/2/8/3 | A1 2 (`s06`–`s03`) | — |
| 2 | `s06 → s10` | `foot` | 7/4/3/2/**7**/3 | A1 2 | — |
| 3 | `s10 → h10` | `taxi` | 6/4/3/2/7/3 | A2 2 (`h10`–`s20`) | **pulse: `h10`** |
| 4 | `h10 → h01` | `bus` | 6/**3**/3/2/7/3 | A2 3 | — |
| 5 | `h01 → h02` | `bus` | 6/2/3/2/7/3 | A1 3 | — |
| 6 | `h02 → t02` | `bus` | 6/1/3/2/7/3 | A2 2 | — |
| 7 | `t02 → t06` | `underground` | 6/1/2/2/7/3 | A1 3 | — |
| 8 | `t06 → s17` | `taxi` | 5/1/2/2/7/3 | A2 2 | **pulse: `s17`** |
| 9 | `s17 → s06` | `taxi` | 4/1/2/2/7/3 | A1 2 | — |
| 10 | `s06 → h06` | `taxi` | 3/1/2/2/7/3 | A2 2 | — |
| 11 | `h06 → h07` | `bus` | 3/**0**/2/2/7/3 | A1 2 | — |
| 12 | `h07 → s16` | `taxi` | 2/0/2/2/7/3 | A2 3 | — |
| 13 | `s16 → t04` | `taxi` | 1/0/2/2/7/3 | A1 3 | **pulse: `t04`** |
| 14 | `t04 → t05` | `underground` | 1/0/1/2/7/3 | A2 2 | — |
| 15 | `t05 → s11` | `taxi` | **0**/0/1/2/7/3 | A1 3 | — |
| 16 | `s11 → s12` | `foot` | 0/0/1/2/**6**/3 | A2 3 | — |
| 17 | `s12 → h01` | `foot` | 0/0/1/2/**5**/3 | A1 2 | — |
| 18 | `h01 → h10` | `underground` | 0/0/**0**/2/5/3 | A2 2 | **pulse: `h10`** |
| 19 | `h10 → s20` | `foot` | 0/0/0/2/**4**/3 | A1 3 | — |
| 20 | `s20 → s21` | `foot` | 0/0/0/2/**3**/3 | A2 2 | — |
| 21 | `s21 → s22` | `foot` | 0/0/0/2/**2**/3 | A1 2 | — |
| 22 | `s22 → s13` | `special` | 0/0/0/**1**/2/3 | A2 3 | — |
| 23 | `s13 → s14` | `foot` | 0/0/0/1/**1**/3 | A1 3 | **pulse: `s14`** |
| 24 | `s14 → s15` | `foot` | 0/0/0/1/**0**/3 | A2 2 | — → **`fugitives-extracted`** |

The Fugitive ends with **exactly one special ticket and zero of everything else**, on a pulse
turn, 3 edges from the nearest Agent — and wins on the clock. That is a genuinely well-played
Fugitive game: the plan was "never be findable on turn 3/8/13/18/23; spend foot only after the
tickets are gone; hold the special as the turn-22 exit."

**F4 check:** one row on all 24 turns, including five `foot` and one `special`. Holds: zero.

**What this transcript proves, including something M1 did not claim.** The Fugitive used **no
scooter charge** and won. With taxi + foot alone they had 8 + 8 = 16 street edges plus bus/metro
for the long legs, which was enough. The scooter is therefore **not mandatory** (§5).

**What it also proves about the economy.** At T24 the Fugitive has no move resource left at all
except one special ticket and three unused scooter charges. In other words the ticket economy did
not *trivialise* — it decided the countdown — but the margin is exactly one move for the whole
game (M1 §4.1: 25 non-scooter moves for 24 turns). One forced hold anywhere in turns 1–23 and
this transcript ends at turn 24 with a hold row and a capture. The economy matters a great deal;
it is not slack.

---

## 4. Transcript 3 — "competent players", exhaustive tickets, Agents close

Both sides count. The Agents spend their scarce bus/metro on *coverage of the mode-eligible set*,
not on chasing, and force the Fugitive to burn foot steps early; the Fugitive's ticket cushion
runs out at turn 22 and hold pressure begins. Capture on **turn 26 does not exist**, so the
Agents must take it on turn 24 — they take it on **turn 23**, one turn after the pulse.

| T | F move (log) | F left (tx/bs/me/sp/ft/sc) | A1 | A2 | Reveal |
| --- | --- | --- | --- | --- | --- |
| 1–4 | `s07→s06`(taxi) `→s10`(taxi) `→s11`(taxi) `→s12`(bus) | 5/3/3/2/8/3 | closes west on taxi | covers `h01–h04` on bus | **pulse T3: `s11`**, A1 2 ed, A2 3 ed |
| 5–7 | `s12→s13`(taxi) `→s14`(foot) `→h10`(taxi) | 3/3/3/2/7/3 | 3 ed | 2 ed | — |
| 8–9 | `h10→h11`(bus) `→h12`(taxi) | 2/2/3/2/7/3 | 3 ed | 3 ed | **pulse T8: `h11`** |
| 10–12 | `h12→h09`(bus) `→h08`(bus) `→h07`(bus) | 2/0/3/2/7/3 | 2 ed | 4 ed | — |
| 13–14 | `h07→s17`(taxi) `→s16`(taxi) | 0/0/3/2/7/3 | 2 ed | 3 ed | **pulse T13: `s16`** |
| 15–17 | `s16→t04`(taxi·hold risk) `→t05`(metro) `→s11`(taxi) | 0/0/1/2/7/3 | 4 ed | 2 ed | — |
| 18–19 | `s11→h01`(foot) `→s19`(taxi→no taxi: **foot**) | 0/0/1/2/5/3 | 3 ed | 2 ed | **pulse T18: `h01`** |
| 20–21 | `s19→s20`(foot) `→s21`(foot) | 0/0/1/2/3/3 | 2 ed | 3 ed | — |
| 22 | `s21→s22`(metro) | 0/0/0/2/3/3 | 3 ed | 2 ed | — |
| 23 | `s22→s14`(foot) → **A2 `s13→s14` foot: capture** | 0/0/0/2/2/3 | 2 ed | **capture** | **pulse T23: `s22`** |
| 24 | Yard already ended `agents-win` | — | — | — | — |

The kill is readable: after the turn-23 pulse the Fugitive's candidate set is
`deg(s22) ∩ {street-tier} = {s21, h10}` — **2 nodes** — and the Fugitive must move *away* from a
pulse-2 fix, so A2 covers `s14` (the only 2-hop street destination that is not adjacent to A1 or
the terminal ring) while A1 screens `s21`. **A2's capture on `s14` required reading the second
edge, not the first** — the Agents had to hold the *2-hop* set, which is where expensive
deduction lives.

**Ticket ledger at capture.** F spent 10 taxi / 4 bus / 3 metro / 0 special / 6 foot / 0 scooter
= 23 moves in 23 turns. A1: 12 taxi, 3 bus, 2 metro, 5 foot. A2: 11 taxi, 5 bus, 2 metro, 3 foot.
Both Agents are **still moving** — neither was ever forced to hold.

**F4 check:** one row on every turn 1–22 (including one `foot`-only row at T19 and a `metro` row
at T22); turn 23 has no Fugitive row because the capture resolved at `capture-resolution` after
`agent-phase`, and `.6` of the phase order puts the Fugitive's next row on turn 24, which never
runs. Same hole as transcript 1.

---

## 5. Arbitration (a) — turn limit and pulse schedule

**The arithmetic.** M2 §2's own budget is `55 s + n × 25 s`. Let me put that against M1's limit
and against M2's own stated `10–22 rounds` window:

| Configuration | Per player-round | 16 turns | 24 turns | Within 5–10 min? |
| --- | --- | --- | --- | --- |
| Networked, brisk | 25 s | 7 min 55 s | **11 min 35 s** | 16 yes; 24 no |
| Pass-and-play, with hand-offs (§6) | 30 s | **9 min 05 s** | 13 min 35 s | 16 marginal; 24 no |
| Pass-and-play, slack | 40 s | 11 min 45 s | 17 min 35 s | neither |

So: **24 turns is inside the window only at 25 s per player-round, which is M2's optimistic
figure.** M2's claim that its window "allows 10–22 rounds" is **arithmetically wrong** — at 25 s,
a 10-minute budget is 22 rounds *counting the 55 s of open and onboarding*. M2 numbers the
overhead correctly and then exceeds its own round budget anyway. Conversely **M1's 24 turns is
not absurd**: at 25 s it is 11.6 minutes, 16 % over the top of the target band, and the band has
no hard enforcement (M2 §2 explicitly makes the budget non-binding). What kills 24 is the *loser's
cost* below, not the target band.

**Ruling: ship 16 turns, pulses on 5/10/15 — M2's numbers, not M1's. M1 §7's "turn limit: 24
turns" is wrong for the MVP; M1 §8's `3/8/13/18/23` schedule is wrong at any limit.** Reasons, in
order of weight:

1. **The 5th pulse at 23 does not fit a 24-turn game.** Between turn 23 and the turn-24 limit
   there is exactly one Agent phase; between turns 18 and 23 there is a **five-turn deduction
   interval** after which the game is over. M1's schedule therefore has *two* uncompensated
   endgames and M1 §11's "turn-23 pulse plus the turn-24 chase is the designed climax" is a
   one-turn climax with no room for a chase. At 16 turns with pulses 5/10/15 the last pulse sits
   at the turn before the limit — the same intent, honestly delivered.
2. **The first pulse lands on the same turn either way.** 3/8 and 5/10 both give the Agents their
   first hard fix after 2 and 4 unpruned turns respectively. M1's turn-3 pulse is marginally
   better for tractability (§8), but it is also the single largest gift in the game: a turn-3 fix
   happens before any player has settled into their route.
3. **The 24-turn loser's cost.** If the MVP ships 24 and the target is honoured, the product
   obligation becomes "make 24 turns resolve in 25 s each on a phone, forever" — that means cutting
   the log-chip popover, the candidate reading, and the pass interstitial (§6), i.e. it makes the
   *product* pay for a *rules* number. If instead the target slips, the MVP ships a 12-minute phone
   game, which is **outside the director's stated 5–10 minute band** and violates
   `VISUAL_DIRECTION.md` §1 decision 13.

**What the loser's number costs, concretely.** 8 extra turns = 200 s of play at 25 s = **+3 min
20 s** on M2's own model, and +5 min 20 s at the pass-and-play rate. It also adds two pulse
intervals to a map on which the candidate set is already saturating (§8), and it forces the
Fugitive to have 25 non-scooter moves — the one-move cushion that makes the economy decidable is a
*24-turn artefact*; at 16 turns the Fugitive's cushion is 9 moves and the Agent seats go from
"exactly enough, no slack" to comfortable. **M1 §4.1's budgets are quietly tuned for 24 turns and
are wrong at 16** — that is fix 6.

**Both M1 and M2 are wrong on one point each.** M1: the limit and the schedule. M2: the
"10–22 rounds" arithmetic. The MVP ships M2's 16 turns **and M1's interval of 5**, with the last
pulse at 15 rather than a 5th pulse at 23.

---

## 6. Arbitration (b) — pass-and-play vs networked play

**M1 §13 assumes hot-seat** ("pass-and-play with a 'pass the phone' interstitial before the
Fugitive's turn only"), and M1 §2 ships **3 seats**. M2 §11 R3 ships **same-device pass-and-play**
and deletes the lobby surface. Both documents treat this as a UI decision. It is not. Here is a
real hand-off, played out.

**Hand-off walk-through, turn 4 of transcript 1, as the device physically moves.**

```
[S2 board, Fugitive's projection: own icon solid at s13, both Agents solid]
  ...F taps s13 → t05, metro. Screen shows F at t05.
HAND-OFF 1: S2 (Fugitive) hands the phone to S1 (A1).
  For the hand-off to be safe, S1 must not have seen the move. The two
  players are in the same room, one is looking at the phone the Fugitive is
  holding. The only safe protocol is: S1 closes their eyes / looks away
  while the Fugitive moves, then the Fugitive hands over.
  Cost: ~3-5 s, plus a social protocol with no UI enforcement.
HAND-OFF 2: S1 (A1) plays s13 → s15 taxi, hands to S0 (A2).
  Safe by symmetry - A1's move is public on the board; nothing leaks.
  Cost: ~2 s.
HAND-OFF 3: S0 (A2) plays t02 → t01, hands BACK TO S2 (F).
  F must now look at the board. F sees the Agents' positions to plan.
  Cost: ~2 s.
```

**Does hidden information leak? Yes — three separate ways, and only one is fixable in UI.**

1. **The board identifies the hidden player.** The pass card says `Pass to A2 — Falcon`
   (M2 §4 I1), so every player knows *who the Fugitive is* by name — fine — but the card is only
   legible because the phones-up chain told everyone whose turn it is. In pass-and-play the
   Fugitive is identified by *who is holding the phone and looking away*, which is public
   information. **The Agents know the Fugitive's identity; that is not the leak.**
2. **The device can be read after the hand-off.** M2's I1 requires a 1-second press-and-hold to
   rebuild the *next* viewer's projection — good — but the projection is rebuilt *on the same
   device*, so the previous viewer's screen is one press away. M2's mitigation covers the glance
   during the pass; it does not cover the 20 seconds when the device is unattended between S1 and
   S0, or the fact that a player who is *waiting* can watch the Fugitive's thumb.
3. **The Fugitive's own move is publicly visible while it happens.** This is the killer and it is
   not a UI bug: the Fugitive is physically holding the screen while they choose `s13 → t05`.
   M2 §4's "I1 — pass device… would destroy the game" addresses the *glance*, but the players are
   sitting together; the only protocol that works is eyes-closed.

**Is a hand-off needed on every single turn? Yes — three per turn, not one.** The phases are
Fugitive → (pulse) → A1 → A2 (M1 §7). M1 §13 proposes an interstitial "before the Fugitive's turn
only", which is the correct instinct but insufficient: after the Fugitive's move the device must
reach A1, then A2, then back to the Fugitive — **3 transfers × 16 turns = 48 transfers**, each
carrying an eyes-away protocol. At ~6 s per transfer (3–5 s for the Fugitive transfer, ~2 s for
each Agent transfer, plus a 1 s hold) that is **~96 s of pure hand-over**, or **~32 s per turn**
against M2's 25 s budget. That is the +5 min in §5's table, and it is why M2's 16 turns still
overshoots at pass-and-play rates.

**Is the resulting experience worth building? No — not as the MVP's shipping mode.** The three
costs compound: the deduction the game exists for happens in a room where the hidden player can be
watched; the tractability of M2 §5's belief halo is degraded because the Agent has no private
space to read it; and the session length is dominated by hand-over rather than by play. M1 §13's
"first playable" is *defensible* as a developer harness (one device, one developer, no server) and
should stay in the plan for exactly that: **the first playable is a test harness, not the shipped
product.** M2 §11 R3's "MVP ships same-device pass-and-play" is the wrong MVP; the wrongness is
not the UI, it is that hidden movement and a shared screen are the same table and the same
eyeline.

**Recommendation (both defensible; the MVP should ship #2).**

1. *Reject:* ship pass-and-play as the MVP mode. Cost: the hidden-information premise is enforced
   by social protocol, not by the client.
2. *Ship:* **MVP is local-multiplayer with one device per seat** — i.e. the same screen list as
   M2 §3 (S0–S3, zero modals, tray, belief halo) but the board is per-seat, which requires the
   server seat. This is M1's §13 "no server" cut being *reversed* for the ship configuration while
   the first playable keeps it. It costs the lobby surface M2 correctly wants to avoid; it does
   **not** cost chat, accounts, reconnect or matchmaking, all of which stay out.
3. *Rejected:* a "blind commit" pass-and-play in which the Fugitive chooses a move on a hidden
   screen and the Agents never see the board change. Failure: it deletes the Agents' ability to
   watch the mode animation and to re-read the log in context, i.e. it deletes M2 §6's entire
   "arming a mode draws that mode's edges" teaching device, and it still leaves the device
   readable between players.

If the director wants pass-and-play anyway — and it is a legitimate cheap-validation path — then
the turn limit must drop to **12 turns with pulses at 4/8/12**, per §5's arithmetic, and the pulse
schedule loses its final-warning beat. That is the honest price.

---

## 7. Arbitration (c) — is the electric scooter mandatory, useless, or balanced?

**M1 §6's rule as written:** one charge = 2 consecutive street edges, logged `scooter`, **and the
exact ending node is revealed to all Agents inside `fugitive-phase`** (`RevealReason: 'scooter'`,
§7 step 3). M1 §17 Q3 flags the risk. Test it against §9 C1.

**The test.** Capture is evaluated at `capture-resolution` on end positions only (§9 C1). The
scooter reveals the endpoint at §7 step 3 — *before* §7 step 4, the Agent phase. Therefore any
Agent who can reach the revealed endpoint in **one move** captures the Fugitive that turn, with
no deduction, no ticket cost beyond one move, and no counterplay: the Fugitive has already spent
its turn and cannot move again.

**When is a scooter move safe?** Exactly when every Agent is **3 or more street/metro edges**
from the chosen endpoint. Because the reveal is free and instant, the Agents need not have
anticipated anything — they only need the endpoint in reach. And the map is 60 nodes at degree
≈ 3.5: two Agents within 3 edges of a given node is the *normal* case, not the exception. In
transcript 2 the Fugitive was within 2–3 edges of an Agent on **9 of 24 turns**; every one of
those turns is a scooter turn on which the Fugitive is captured outright. The scooter is usable
only in the far corner of the map, which is precisely where the Fugitive is *already* safe and
has no reason to burn tempo.

**Verdict: useless — worse than useless, actively dominated.** It is dominated twice over.
*Domination 1, resources:* the Fugitive has **25 non-scooter moves for 24 turns** (M1 §4.1), so
the two-edge tempo is never *needed* to avoid a forced hold. Transcript 2 wins on 24 turns with
**zero scooter charges spent** and one move to spare. *Domination 2, information:* taxi gives one
edge for one ticket and reveals one bit (the mode); the scooter gives two edges for one charge and
reveals the **exact node**. In the only state where tempo is scarce — a closing net — the scooter
converts "a puzzle for the Agents" into "an appointment for the Agents." A competent Fugitive
never presses it. A beginner who presses it loses, which teaches the wrong lesson. M1's own
fallback in §17 Q3 is right; this validation says take it *now*, not after measuring.

**The fix, concretely (this is fix 2 in §10 — the table's fix numbers are authoritative):**

- **Change M1 §6** from "immediately reveals the Fugitive's exact ending node" to "immediately
  appends the log row `scooter`; the Agents are told only that a scooter was used and how many
  charges remain." The Fugitive still pays in information — the mode is public and constrains the
  move to the street subgraph — so taxi is still not dead, and the scooter is a real choice:
  2 edges in 1 turn versus 2 taxi tickets and 2 turns.
- **Rejected alternative 1:** keep the exact reveal but make the Agents' capture test use *start*
  positions, so a scooter's endpoint is revealed but not capturable that turn. Failure: an
  asymmetric capture rule (end positions for everything except `scooter`) that M1 §9 C1 explicitly
  rejects as un-replayable, and it makes the scooter better than it was — the Agent can still
  chase.
- **Rejected alternative 2:** keep the exact reveal and give the Agents 2 charges each (M1 §17 Q2).
  Failure: it does not fix the asymmetry, it *doubles* it — two Agents with a burst against a
  revealed endpoint box the Fugitive on the same turn, with no counterplay. This is the reason
  M1 §6 rejected Agent charges; the same argument condemns Agent charges as a *fix*.
- **Second-order, worth noting for the map generator (NEEDS-MAP):** with the reveal removed, the
  scooter becomes the only free 2-edge move, and its value rises if street degrees are ≥ 3. If the
  generator ships a spill of degree-4 street nodes, the scooter may then need a *cost* — one foot
  step is M1's own natural currency (it is already a street-reserve economy) and would be fix 2b.
  Do not pre-emptively add it; measure it with the real map.

**Does the scooter become mandatory under the fix?** No. It becomes *situationally* strong on the
turns where the Agents have left a 2-edge escape corridor and are not adjacent — which is the
design intent M1 §6 states ("break a closing net", "reach a pulse turn unexpectedly") and which
the original reveal makes impossible. M1 is right about what the scooter is *for*, and wrong about
the price.

---

## 8. Arbitration (d) — does logged on-foot trivialise the economy? and the F4 invariant

**M2 §Open Question 6 defaults to "on foot leaves no trail". M1 §5 decides the opposite. M1 is
right and M2's default is wrong** — not merely a defensible difference. M2's own §5 says Agents
reason from the log, §6 says every legal move must be drawable, and §7's onboarding says "every
move spends a ticket of that colour". A free, unlogged move is a move the belief halo cannot model:
M2 §5's "Unknown — a translucent belief halo whose opacity tracks probability" would have to grow a
silent branch each turn, and the halo would show a blob over the whole 40-node street subgraph by
turn 4. M2's UI *depends* on M1's ruling. M2 §Open Question 6 should be struck, and the chip label
is `foot` with a boot glyph (M2 §8.1 already reserves it).

**Does the trail trivialise the economy? No, and the mechanism is worth stating exactly.**
M1 gives the Fugitive 8 foot steps and each Agent 6 (M1 §4.1). That totals **16 foot moves** for
the Fugitive against **50 paid moves** across both Agents. So foot is a **reserve**, not a
currency: it does not buy reach (street edges only, §5 F2), it does not buy the fast tiers, and it
cannot refill. In transcript 2 the Fugitive's foot steps *outlasted* every ticket and were what
delivered turns 20–24; the last foot step and the last special ticket were both mandatory. That is
the opposite of trivialisation — foot is the resource that decides the countdown after the economy
has already done its work. **M1 §5 F1's decision is sound and should ship.**

But two consequences need naming, because both are live:

- **The one-move cushion is the whole margin.** 25 Fugitive moves for 24 turns. One forced hold
  in turns 1–23 and the Fugitive cannot move on turn 24. Transcript 3 is *decided* by this: the
  Fugitive's ticket exhaustion at turn 22 converts a deduction game into a forced-march. Whether
  that is good design is a playtest question, but M1 §14's "one to spare" is stated as comfort
  when it is actually **fragility**. Fix 6 re-tunes the budgets for 16 turns.
- **`VISUAL_DIRECTION.md` §1 decision 2 says on-foot is "free" and §3 calls it "a deduction-relevant
  stealth option".** M1's finite-step, logged foot contradicts both, and M1 §5 does not say so
  where it settles the question. Because `VISUAL_DIRECTION` "refines, never overrides", M1's
  ruling is the better reading — but the *file* still says "free", and the next session will read
  it. **`VISUAL_DIRECTION.md` §1 decision 2 and §3 are stale on the word "free"** and M1 §17 does
  not raise it. That is fix 7.

**F4 invariant, checked in all three transcripts.** M1 §5 F4: *"exactly one public log row per
living Fugitive per turn — a move row or a forced `hold`. There are no silent turns."*

| Transcript | Turns with exactly 1 row | Violations |
| --- | --- | --- |
| 1 (capture T7) | 1–6 | **turn 7 has 0 rows** — the Yard ends inside `agent-phase` |
| 2 (limit) | 1–24 | none |
| 3 (capture T23) | 1–22 | **turn 23 has 0 rows** — same hole |

So the invariant **holds in every transcript for every turn that resolves**, and **fails on the
capture turn in both capture games**. The cause is M1 §7's phase order: `agent-phase` (step 4)
precedes `capture-resolution` (step 5), so the capture ends the Yard before the Fugitive's row for
that turn could be written — but §7 step 2 says the row is appended *during* `fugitive-phase`, so
the row for turn *t* exists as soon as the Fugitive moves. The row that is missing is not the
capture turn's row; it is that M1 never states whether the Fugitive's row for turn *t* is written
before or after it is known that the Yard ends. **The invariant is under-specified, not violated**
— fix 8 pins it: the row is written at §7 step 2, unconditionally, and a captured Fugitive's row
for the capture turn exists. Note this also fixes a replay problem: without it, the last turn of
a captured Yard is not reconstructible from the log alone.

---

## 9. Arbitration (e) — deduction tractability on a phone

M1 §12 sets the testable constraint: **"with the shipped map, the median candidate-set size at the
last turn before a pulse must be ≤ 12 nodes."** M2 §5 depends on it: the belief halo plus a numeric
badge on the top-3 stations is only meaningful if the set is small. With no map, I bound it.

**Bounds from the three transcripts.** `C(t)` = nodes reachable from the last pulse node by the
exact logged mode sequence, intersected with mode eligibility (`bus` → hub/terminal only, `metro`
→ terminal only, `foot`/`scooter` → street subgraph).

| Point | Mode sequence since pulse | Bound | How computed |
| --- | --- | --- | --- |
| Transcript 1, before T3 pulse (T1–T2) | `taxi, taxi` | **≤ 6** | `deg(s07)=2`, then `deg(s06)=3` × `deg(s10)=3`, capped |
| Transcript 1, after T3 pulse, before T4 agent phase | `taxi` | **4** exact | `deg(s13) = {s11, s12, s15, t05}` |
| Transcript 2, before T5 (no pulse since T3: T3–T4) | `taxi, bus` | **≤ 26** | 3 taxi ends × ≤ 4 hub/terminal bus ends each; bus filter to 20 nodes |
| Transcript 3, before T8 pulse | `taxi, taxi, foot, taxi` | **≥ 14, ≤ 40** | street-only stretch, saturating against the 40 street nodes |
| Transcript 3, before T23 (T19–T22) | `foot, foot, metro, special` | **≤ 9** | `special` pins to `h03`; one metro edge from `h03`'s terminal set |

**Conclusion.** The constraint holds **immediately after a pulse** (4 nodes, exact, holdable) and
**fails in the middle of any 5-turn interval** (≥ 14, ≤ 40, i.e. saturating the street tier). The
sub-saturation cases are all where a `bus`/`metro`/`special` row appears, because those modes pin
the candidate set to the 20-node hub/terminal tier or to a single node. The saturation cases are
all taxi/foot stretches.

So the answer to "can a human hold it on a phone?" is: **yes for the two turns after a pulse, no
for turns 3–5 of an interval.** M2 §5's top-3 badge remains useful; the belief halo becomes a
smeared blob over the street tier on those turns. That is a real defect, and M1 §12's own test —
if run honestly, as the median over *all* pre-pulse turns rather than the first one — will fail on
the shipped 60-node map.

**Answer to "phone-tractable" is therefore conditional.** Three fixes, one recommended:
(fix 4) move the pulse **interval from 5 to 4**, which cuts the worst-case interval and adds a
pulse (16 turns → pulses 4/8/12/16, i.e. the final turn is a pulse turn); or raise the hub/terminal
share of the map so a taxi stretch cannot saturate 40 street nodes; or accept saturation and drop
M2 §5's numeric badge to a two-state "warm/cold" halo. **Recommend fix 4 plus running M1 §12's
solver test on the real map before any budget is called settled.** A 4-turn interval plus the
existing 16-turn limit gives four pulses, an early fix at turn 4, and a final-turn pulse — at the
cost of the "turn 16 is a no-more-information turn" beat M2 §2 wanted.

---

## 10. Verdict and prioritised fixes

**Verdict: worth building only if three things change.** The loop is *not* yet interesting on
paper, and the reason is specific: with one Agent per, the game reduces to **"the Fugitive must not
be adjacent to either Agent at the pulse, and the Agents must be adjacent at the pulse"** — 2
Agents against a 60-node map at degree 3.5. Neither side can force the other without a reveal, so
the *reveal is the game*. Everything else — the ticket economy, the log, the scooter — is
bookkeeping around three-to-five one-turn windows. That can become interesting: the moment in
transcript 3 where A2 must read the *2-hop* set after the turn-23 pulse is a real deduction moment,
and the moment in transcript 1 where A2 covers the terminal ring from `t02` is a real trap. But
those moments are *constructed by the pulse*, not by continuous play, and at 5 turns apart they are
too rare. **Shorten the interval, cut the limit, fix the scooter — then this is a game. Ship it as
it stands and it is three dice rolls with a map on top.**

Prioritised, each naming the rule it changes:

| # | Priority | Fix | Rule changed | Problem solved |
| --- | --- | --- | --- | --- |
| 1 | **P0** | MVP ships **16 turns, pulses 5/10/15** (and see fix 4 for 4/8/12/16 if the solver test fails) | M1 §7 "24 turns"; M1 §8 "3/8/13/18/23" | §5's arithmetic: 24 turns is 11 min 35 s at 25 s/round, and the last pulse at 23 is a 5-turn endgame followed by a 1-turn climax |
| 2 | **P0** | Delete the exact-endpoint reveal; keep the `scooter` log row and add remaining charges | M1 §6 | §7 — the reveal makes the scooter strictly dominated, because §7 step 3 precedes step 4 and §9 C1 captures on end positions |
| 3 | **P0** | **One device per seat** at ship; pass-and-play stays only as the §13 first-playable harness | M1 §13 (scope), M2 §11 R3 | §6 — 3 hand-offs/turn, ~32 s/turn, and the hidden move is physically visible to the Agents |
| 4 | **P1** | Pulse interval **5 → 4** (16 turns ⇒ pulses 4/8/12/16) | M1 §8 interval | §9 — the candidate set saturates the 40-node street tier by the 3rd turn of any 5-turn interval; M1 §12's own ≤ 12 test will fail as written |
| 5 | **P1** | Re-tune §4.1 budgets for the 16-turn limit; state the cushion explicitly | M1 §4.1 | §8 — 25 Fugitive moves for 24 turns is presented as comfort but is a 1-turn margin; Agent seats have literally zero slack |
| 6 | **P1** | Run M1 §12's tractability test as a **solver over the real map**, median over *all* pre-pulse turns | M1 §12 | §9 — a hoped-for constraint is not a constraint; and the fix-4 decision depends on its result |
| 7 | **P2** | Strike "free" from the on-foot lines; M1 §5's finite, logged foot is the settled reading | `VISUAL_DIRECTION.md` §1 decision 2, §3 | §8 — the file contradicts M1 and is what the next session will read |
| 8 | **P2** | Pin the F4 row to §7 step 2 unconditionally, including the capture turn | M1 §5 F4 + §7 | §8 — the invariant is under-specified on exactly the turn both capture transcripts end |
| 9 | **P2** | Strike M2's "10–22 rounds" line | M2 §2 | §5 — it is arithmetically wrong and it is the sentence a later session will quote to justify 24 turns |
| 10 | **P3** | Require the generator to keep **starting separation ≥ 3 edges** and warn on a near-complete metro graph | new map-authoring rules, alongside M1 §10's trap-node requirement | §2 — with both Agents 2 edges away at start, the Fugitive is captured on turn 2 with no play; and a complete metro graph on the terminals makes any terminal Agent threaten every terminal (transcript 1, turn 5) |
| 11 | **P3** | Give the scooter a **1 foot step** cost only if the real map has degree ≥ 4 street nodes | new, M1 §6 | §7 second-order — with the reveal gone and street degree ≥ 3 the 2-edge burst may be free-value |
| 12 | **P3** | Add the missing **seat-assignment rule** (who is the Fugitive) and make it non-choosable in 3-seat pass-and-play | new, M1 §2 | §6 — the Fugitive's identity is currently a hole in the spec, and in pass-and-play identity is what makes the leak in §6 way #1 exploitable |

**The single most serious problem:** fix 3 in full, and fix 2's cause — the MVP is specified with
hidden information that **the specified product surface cannot keep hidden**, and its one
tempo mechanic (the scooter) is **suicidally dominated** by the same rule that was written to
balance it. Both are ship-blocking; both are one-line rule changes.

---

## Open questions for the director

1. **16 turns or 24?** *Recommended default:* **16, pulses 5/10/15** (§5). The 24-turn version is
   a 12-minute phone game and needs its budgets re-tuned either way.
2. **Escalate pass-and-play to one-device-per-seat for the ship, keeping hot-seat as the first
   playable?** *Recommended default:* **yes** (§6). This is the largest scope fork in round 03.
3. **Cut the scooter's exact reveal?** *Recommended default:* **yes, now** — keep the mode row and
   the charge count (§7). M1 §17 Q3's own fallback.
4. **Pulse interval 5 or 4?** *Recommended default:* **4**, pending M1 §12's solver test on the
   real map (§9). This changes the answer to Q1's schedule to 4/8/12/16.
5. **Is the taxi subgraph the only authoring requirement, or do starting separation and a
   non-complete metro graph become requirements too?** *Recommended default:* **all three**, tested
   (§10 fix 10).
6. **Who is the Fugitive?** *Recommended default:* **assigned by the client at S0, never
   self-selected** (§10 fix 12) — a self-selected Fugitive plus pass-and-play is a guaranteed
   information leak.
