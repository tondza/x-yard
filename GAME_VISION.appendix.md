# GAME_VISION.md — Appendix (derived)

**Not director-authored. No design authority.**

**Terminology note (2026-10-29).** The director renamed the player-facing
"Reveal Pulse" to **Appearance** (next / previous appearance). The brief,
prototype and shared constant use the new term; older entries below and
historical records may still quote the former name. The rule and the 5 / 10 / 15
schedule are unchanged — see [decision 0016](docs/decisions/0016-appearance-terminology.md).

Engineering bookkeeping split out of [`GAME_VISION.md`](GAME_VISION.md), which
holds the director-authored brief (§1–§6). Everything here is maintained by
agent sessions:

- **Appendix A** — implementation status. Update it in place; it describes the
  present, so unlike `PROJECT_LOG.md` it is not append-only.
- **Appendix B** — superseded concepts. A guard test fails if this vocabulary
  reappears in the public API. Never delete an entry.
- **Appendix C** — open design questions, each with a recommended default so
  implementation is never blocked. **An open question is not a decision.**

**When the director answers a question:** the answer moves INTO the brief
(`GAME_VISION.md` §1–§6), the entry here is struck through — never deleted — and
the matching `PROVISIONAL_` constant is renamed out of its provisional name with
`spec-alignment.test.ts` updated in the same change. See
[`AGENT_RULES.md`](AGENT_RULES.md) §4.

---

## Appendix A. Implementation status (derived)

Last updated: 2026-10-15.

| Area | State |
| --- | --- |
| Monorepo, tooling, test gate | ✅ done |
| `game-core`: graph traversal + validation | ✅ done |
| `game-core`: ticket spend/refund + ticket log types | ✅ done |
| `game-core`: seeded RNG (xorshift128+) | ✅ done |
| `game-core`: mission, facility, gadget, skill vocabulary | ✅ types only |
| `game-core`: turn/phase machine | ⏳ not started |
| `game-core`: capture resolution | ⏳ not started |
| `game-core`: appearance scheduling | ⏳ not started |
| `game-core`: probability/shadow-set projection | ⏳ not started |
| Server: yard instances, sockets, matchmaking | ⏳ not started (scaffold only) |
| Client: canvas map rendering | 🟡 scaffold only |
| Persistence, logoff/extraction, shadow decoy | ⏳ not started |

## Appendix B. Superseded concepts (derived)

The following appeared in the previous vision document and are **withdrawn**.
Do not reintroduce them without a new director decision:

| Withdrawn | Replaced by |
| --- | --- |
| Single hidden player "Mr. X" | Multiple **Fugitives** (Subject X) |
| Role names `mr-x` / `detective` | `fugitive` / `agent` |
| Black tickets (double-move) | Fugitive gadgets (§5) |
| Shadow Step (free taxi leg) | **Alleyway Sprint** gadget (§5) |
| Public cache nodes as the second win axis | Contraband missions + Safe House extraction (§4) |
| Fixed 24-round `cold-drop`/`blitz`/`marathon`/`tutorial` contracts | Multi-Yard instances (§6) |
| Scheduled ticket refills at R8/R12/R16/R20 | Undefined — see Q1 |
| `ferry` transport mode | **Special Transport / Alleyway** (§3) |
| Grid coordinates "authoring units", 4096×3072 Meridian Central | Undefined map scale — see Q7 |

## Appendix C. Open design questions (derived)

Each has a recommended default so that implementation can proceed without
blocking. None of these are director-approved.

1. **Ticket economy numbers.** §3 gives no counts. *Recommend:* fugitive
   12 taxi / 8 bus / 6 metro / 2 special; agent 10 taxi / 8 bus / 5 metro /
   0 special; tickets never refill mid-Yard.
2. **Reveal Pulse interval.** §2 says "every N turns (e.g., 3, 8, 13, 18)",
   which is neither a constant interval nor a closed list. *Recommend:* fixed
   interval of 5, first pulse on turn 3 → 3, 8, 13, 18, 23.
   **RULED 2026-10-16:** superseded — a 16-turn Yard with pulses on **5 / 10 / 15**.
3. **How a Yard ends.** §2 defines capture but no match end. *Recommend:* a Yard
   runs a fixed number of turns (24), after which surviving Fugitives extract.
4. **Player counts per Yard.** *Recommend:* 1–4 Fugitives, 2–6 Agents, ≤10 seats.
   **RULED 2026-10-16:** up to **20 players**, **4 of them Fugitives** (4 + up to 16
   Agents); a solo player fills the remaining seats with bots, and a human joining
   later may **take over a bot's seat**.
5. **Are Fugitives human?** The MMO framing implies human, but AI decoys are
   mentioned. *Recommend:* human in MVP; only the logoff decoy is AI.
6. **Contraband weight → transport restriction.** §4 says heavy contraband "may
   restrict transport choices or generate extra noise pings". *Recommend:*
   `heavy` cargo forbids Metro; `arms` cargo emits a noise ping every 3rd turn.
7. **Map scale and node classes.** §3 describes transport tiers but no node
   taxonomy or map size. *Recommend:* keep `street`/`hub`/`terminal` classes with
   taxi/bus/metro eligibility, shipped map ~150 nodes.
8. **Logoff grace period and decoy behaviour.** §4 mentions a grace period
   without a duration. *Recommend:* 3 turns; the decoy is stationary and
   captures as a normal Fugitive but scores nothing.
9. **Scoring.** §4 gives points for delivery but no scale. *Recommend:* payout by
   risk tier — light 10, heavy 25, arms 50.
10. **Cross-Yard concerns.** §6 requires isolation. *Recommend:* no cross-Yard
    state in MVP; per-Yard seed, map, and turn clock are independent.
11. **Sensor Sweep counterplay.** §5 lets Agents confirm presence in a 2-node
    radius; a Decoy Ping can falsify a Reveal Pulse — it is unclear whether it
    also fools Sensor Sweep. *Recommend:* it does not.
12. **Does a captured Fugitive end the Yard?** *Recommend:* no — capture removes
    that Fugitive; the Yard continues until the turn limit.

### C.2 Questions surfaced by the round-03 MVP work (2026-10-16)

These came out of specifying and validating a *concrete* MVP. They are kept separate
from Q1–Q12 because two of them are **contradictions to resolve** rather than missing
numbers, and none has a `PROVISIONAL_` constant yet. Full reasoning:
[`docs/mvp/README.md`](docs/mvp/README.md) §5 and
[`docs/mvp/round-03-validation.md`](docs/mvp/round-03-validation.md).

- **Q1 is stale; Q2 is now answered.** The director ruled the pulse cycle (16 turns,
  pulses 5/10/15), which supersedes Q2 above. The ticket economy (Q1) is **still
  unratified** and must be rewritten for the 20-player scale: the MVP rules propose
  8/4/3/2 for a single Fugitive, and the scale has changed.
- **R13 — Is the loop interesting enough to build?** The validator's verdict was
  *"worth building only if three things change"*, because as specified the game
  reduces to *"don't be adjacent at the pulse, be adjacent at the pulse"*. Options:
  ship the thin loop to validate the pipeline; restore tension by scale (1v3 and/or a
  larger map); or add a second Agent lever between pulses. *Recommend:* ship the thin
  loop first — but this is a design call, not an engineering one.
  **RULED 2026-10-16:** accepted for the beginning. The pulse-dominant loop is a
  **known limitation, not a blocker**; revisit after the prototype.
- **R14 — Reveal Pulse interval, a second conflict.** The validator ruled 5/10/15 for
  a 16-turn Yard, then separately recommended 4/8/12/16 because the Agent candidate
  set saturates mid-interval (≥ 14 and up to 40 nodes). These contradict each other.
  *Recommend:* 4/8/12/16, plus a real solver test over the shipped map rather than an
  estimate.
  **RULED 2026-10-16:** the ruling stands at **5 / 10 / 15**; the saturation finding
  is set aside as **playtest tuning**, not a blocker.
- **R15 — Starting separation.** Validation captured the Fugitive on turn 2 with no
  play at all when both Agents started two edges away. *Recommend:* adopt a
  map-authoring requirement of **≥ 3 edges** between every Agent start and the
  Fugitive's start.
  **RULED 2026-10-16:** adopted.
- **R16 — Seat assignment.** No rule states who becomes the Fugitive. *Recommend:*
  assigned from the Yard seed.
  **RULED 2026-10-16:** random, **plus a testing/prototype override that always lets
  the director play as the Fugitive.**
- **R17 — Metro topology.** A near-complete terminal graph lets a single terminal
  Agent threaten every terminal, which produced a free kill in validation.
  *Recommend:* bound terminal degree, or require the metro path to be indirect.
- **R18 — The log invariant on the capture turn.** "Exactly one public row per living
  Fugitive per turn" holds on resolving turns, but the capture turn currently emits
  zero rows. *Recommend:* pin the rule to the turn sequence unconditionally.

Answers should be applied by editing the brief above and striking the matching
entry here.
