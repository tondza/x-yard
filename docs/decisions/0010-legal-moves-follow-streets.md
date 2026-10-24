# 0010 — Legal-move paths follow the street network

**Status:** accepted (2026-10-16)

## Context

The round-02 mockups (E–H) rendered each selected character's legal moves as
straight lines between stations. Drawn over an illustrated city, this produces
routes that cut diagonally across rooftops and blocks — travel the city geometry
plainly forbids. The director rejected it outright: *"movement lines drawn
diagonally over buildings and streets ... it should not be possible! Possible
movement paths should mostly follow streets!"* Only a genuine off-street mode —
underground/metro, or a comparable special mode — may cross the map directly.

## Decision

A legal move is a path **along graph edges that correspond to streets**, and the
map draws that path edge-by-edge. The renderer never draws a straight line between
two stations that are not joined by an edge of the traversed mode. Modes that
genuinely run off-street (metro, special) are the only ones that may cross blocks,
and they are styled to read as such.

## Rejected alternatives

- **A straight line from origin to destination.** Cheapest to draw, and exactly
  what the director rejected: it renders impossible travel and destroys the fiction
  that the board *is* a city. This is the failure mode the rule exists to prevent.
- **Drawing the whole network permanently so paths appear to trace streets.** This
  was already declined in `VISUAL_DIRECTION.md` decision 1 (hybrid route display) —
  a permanent overlay buries the city art. Following streets is achieved by routing
  the *highlighted* path through edges, not by showing every edge.

## Consequences

- Display pathfinding yields an **edge sequence**, not an endpoint pair. For a
  single move that is one edge; it only becomes interesting once multi-step or
  preview paths exist.
- The off-street exception is a **property of the mode in the data**, not a
  rendering special case. A future mode that may cross blocks must declare it.
- The rule is a *game* rule as well as a rendering rule, and the game-rule half
  belongs in `GAME_VISION.md` §2/§3, which only the director edits. Until it is
  promoted there, this record and `VISUAL_DIRECTION.md` §4 carry it.
- **Mechanically enforceable, not yet enforced.** A renderer or path test should
  assert that no drawn segment connects two stations without an edge of the
  traversed mode. The guard belongs with the client renderer once it exists.
