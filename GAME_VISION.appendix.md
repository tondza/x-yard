# GAME_VISION.md — Appendix (derived)

**Not director-authored. No design authority.**

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
| `game-core`: reveal pulse scheduling | ⏳ not started |
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
3. **How a Yard ends.** §2 defines capture but no match end. *Recommend:* a Yard
   runs a fixed number of turns (24), after which surviving Fugitives extract.
4. **Player counts per Yard.** *Recommend:* 1–4 Fugitives, 2–6 Agents, ≤10 seats.
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

Answers should be applied by editing the brief above and striking the matching
entry here.
