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

The derived appendix — implementation status, superseded concepts, and open
design questions — lives in [`GAME_VISION.appendix.md`](GAME_VISION.appendix.md).
It carries no design authority. Do not add bookkeeping to this file.
