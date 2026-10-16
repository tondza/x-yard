# GAME VISION: X-Yard (Asymmetric MMO Pursuit Game)

Status: **authoritative**. Owner: product director.

This document supersedes all earlier X-Yard vision and design material. Anything
not stated here is either an engineering decision (see `AGENT_RULES.md`) or an
open question (see the appendix).

---

## 1. High-Level Concept
X-Yard is a web-based, asymmetric multiplayer game of hidden movement, spatial deduction, and contraband transport inspired by Scotland Yard. 
Players are divided into two primary factions operating across node-based metropolitan transit networks:
- **Fugitives (Subject X):** Move covertly across public transport, complete contraband transport missions for points, and escape via Safe House nodes.
- **Agents (Detectives):** Coordinate in teams to narrow down probability paths, track ticket trails, deploy tactical utility skills, and capture Fugitives by occupying their node.

---

## 2. Core Game Loop & Turn Mechanics
- **Simultaneous / Staggered Turn Ticks:**
  1. **Fugitive Phase:** Active Fugitives select adjacent connected nodes and pay the corresponding transit ticket (Taxi, Bus, Metro). Their physical position becomes hidden.
  2. **Agent Phase:** Agents view the ticket type used by each Fugitive (e.g., "Fugitive 1 used a Bus ticket") and update their deduction probability overlay. Agents then select their movement actions.
  3. **Capture Resolution:** Evaluated at the end of the Agent Phase. An Agent occupying the exact node of a Fugitive triggers an immediate arrest.

- **The Reveal Pulse (Scotland Yard Mechanic):**
  - Every $N$ turns (e.g., turns 3, 8, 13, 18), Fugitives undergo a mandatory broadcast pulse, revealing their exact node to all Agents on the map.
  - Between pulses, Agents rely entirely on ticket logs, transport graph limits, and tactical skills to calculate possible movement locations.

---

## 3. Map & Transport System
- **Node-and-Edge Graph:** The map consists of interconnected transit nodes representing city intersections and transit hubs.
- **Transit Types & Ticket Economy:**
  - **Taxi (Short Range):** Connects adjacent standard nodes. Cheap and plentiful.
  - **Bus (Medium Range):** Connects regional bus stop nodes, skipping standard street nodes.
  - **Underground / High-Speed Rail (Long Range):** Connects major transit hubs rapidly across long distances.
  - **Special Transport / Alleyway:** Secret or specialized links usable with special gear (e.g., Alleyway Sprint, Boat).

---

## 4. Mission Framework (Fugitives)
- **Contraband Runs:** Fugitives accept missions at Black Market nodes to transport stolen goods or arms from Location X to Location Y.
- **Risk vs. Reward:** Carrying heavier contraband grants higher point payouts upon delivery, but may restrict transport choices or generate extra noise pings for Agents.
- **Safe House Logging-Off:**
  - To safely log off or exit without forfeiting score or active inventory, Fugitives must reach a **Safe House** node and perform an "Extraction" action.
  - Logging off outside a Safe House leaves an AI shadow decoy that Agents can capture during a grace period.

---

## 5. Faction Abilities & Gear
- **Agent Active Skills:**
  - **Targeted Roadblock:** Temporarily block specific transit modes on target nodes.
  - **Sensor Sweep:** Scans a 2-node radius to confirm whether a Fugitive is present within the search area.
  - **Rapid Deployment:** Spend high-grade transport passes to move long distances in a single turn.
- **Fugitive Consumable Gadgets:**
  - **Decoy Ping:** Emits a fake position ping during a Reveal Turn.
  - **Counterfeit Identity:** Hides the exact ticket type used in the ticket log (`"Unknown Transport"`).
  - **Alleyway Sprint:** Move to an adjacent node without spending a ticket or leaving a ticket trail.

---

## 6. Architecture & Scalability Goals
- **Multi-Yard Instance Model:** Game rooms ("Yards") operate independently in isolated instances (e.g., Yard-London, Yard-Berlin).
- **Player Capacity:** Designed to support scaling up to 1,000 parallel players across multiple room instances without performance bottlenecks.
- **Decoupled Game Engine:** Core graph traversal, ticket validation, and win-condition checks exist as framework-agnostic TypeScript in `packages/game-core`.

---

<!--
=====================================================================
APPENDIX — DERIVED, NOT DIRECTOR-AUTHORED.
Everything below this line is engineering bookkeeping maintained by agent
sessions. It is NOT part of the design brief above and carries no design
authority. When the director answers an open question, the answer moves INTO
the brief above and the entry here is struck through, never deleted.
=====================================================================
-->

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
