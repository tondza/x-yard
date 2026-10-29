# 0017 — The transit network is always visible; planning stays in the player’s head

**Status:** accepted — 2026-10-29

## Context

The second playtest found that the map only highlighted transport from the
current node. The full taxi / bus / metro / special network was effectively
hidden, so the player could not see that a destination was a bus stop, trace
“1 bus + 2 taxis”, or reason about what an opponent could reach. The director
then added an important constraint before the fix went further:

> “I don’t want any special plan mode. Planning should happen inside the head of
> the player. That’s where the beauty lies.”

So the problem is **legibility**, not calculation. A route planner would solve
the player’s game for them.

## Decision

1. **The network is permanent.** Every taxi, bus, metro and special edge is drawn
   at all times, with distinct line styles (taxi thin gold, bus green, metro red,
   special purple dashed). The selected mode’s legal moves are drawn brighter on
   top; they no longer replace the network.
2. **Station badges and a station inspector.** Bus/metro/special stops carry
   `B` / `M` / `S` badges. Hovering a legal destination or clicking any station
   opens a card listing each mode’s destinations from that station and who is
   standing there. This is a lookup, not a route calculation.
3. **No route planner.** There is no Plan mode, no reachability overlay, no
   shortest-route card, no seat selector and no ticket arithmetic done for the
   player. The prototype that briefly implemented those was removed.
4. **A last-appearance ghost.** The Agents’ `lastKnown` node is drawn as a
   semi-transparent red fugitive ghost labelled `F<node>` (for example `F21`)
   with a dashed ring. It persists after the Agents move away and is replaced at
   the next appearance. It is hidden while the real Fugitive is standing on that
   node to avoid double-drawing. This is a memory aid for public information, not
   a prediction or a planner.

## Rejected alternatives

1. **A Plan mode / reachability overlay / route-cost calculator.** Rejected by
   the director: it turns deduction into arithmetic and removes the part of the
   game that is the point. The first implementation was deleted.
2. **Keep only the selected mode’s legal moves visible.** Rejected: it is the
   original complaint; the player cannot see the bus/metro network at all.
3. **Hide the network behind an optional layer.** Rejected for now: the default
   view must show the real map. Layer filters can be added later if the map is
   too noisy, but starting hidden repeats the problem.
4. **Show the ghost at true position.** Rejected: it would lie about what the
   Agents know. `lastKnown` is the only correct source.
5. **Always draw the ghost, even on the real token’s node.** Rejected: it
   overlaps the actual Fugitive and makes the current position ambiguous.
6. **Add best-move/probability hints.** Rejected: not asked for, and it would
   play the deduction game for the player.

## Consequences

- The map is denser. Station labels and badges use level-of-detail; the station
  card gives exact destinations without adding lines to the plate.
- The route planner module and its tests are gone; the suite is back to
  **7 files / 131 tests**.
- The ghost is a pure view of existing state (`lastKnown` plus
  `lastAppearanceTurn`); no new game state was introduced.
- The 300-node renderer must keep the network layer, the station inspector and
  the ghost, and will need more aggressive label LOD.
