# 0011 — A bot-filled single-player prototype precedes the multiplayer MVP

**Status:** accepted (2026-10-16)

## Context

The MVP as specified (1 Fugitive vs 2 Agents, full netcode) is all-or-nothing:
nothing is playable until the turn machine, state projection, capture resolution,
sockets, bots and the mobile UI have all landed. The director needs an early
*feeling of success* and a way to validate what the game actually looks like. At the
same time the MVP itself must be genuinely multiplayer — a map of up to 20 players,
4 of them Fugitives — with a solo player able to fill the remaining seats with bots
and a human joining later able to take over a bot's seat.

## Decision

Build a **prototype first**: **5 seats — one human and four bots**, single-player,
running the same rules engine the MVP will use, with deliberately simple bots. The
MVP then scales that same engine to **up to 20 players with 4 Fugitives**, bots
filling empty seats and humans taking over bot seats mid-Yard. Faction assignment is
**random**, with a testing/prototype override that always makes the director the
Fugitive. One device per seat.

## Rejected alternatives

- **Build the MVP directly, with no prototype.** Nothing is playable until the last
  subsystem lands, so there is no early evidence the game is worth building and no way
  to see the art direction in motion — which is precisely the director's stated need.
- **Make the prototype multiplayer too.** It would front-load sockets, rooms,
  reconnect and interest management *before* the loop and the look are validated,
  which is the risk the prototype exists to remove.
- **Use pass-and-play to avoid netcode in the prototype.** Rejected outright by the
  director: no same-device sharing is to be supported. (Hot-seat also leaks hidden
  information three ways — see `docs/mvp/README.md` §2.)
- **Jump straight to the 20-player MVP.** Multiplies the unknown. The 20-player scale
  stays the MVP's acceptance bar but is not the first thing built.

## Consequences

- The prototype is the **first consumer of the turn machine**, so the engine is built
  with both in mind rather than for the MVP alone.
- **Bots and humans must sit behind one interchangeable seat abstraction**, or
  mid-Yard bot takeover will not be possible later. This is a design constraint on the
  engine, not a UI detail.
- The **3-seat assumption** baked into `round-03-rules.md`, `round-03-product.md` and
  `round-03-validation.md` is **invalidated** and must be rewritten. With 4 Fugitives,
  `projectState` must project **per viewer and per Fugitive** rather than hiding one
  player.
- The **map generator is pulled earlier** than the MVP: the prototype needs a map, and
  hand-authoring will not scale to the MVP's. The prototype itself may use a small
  hand-authored map.
- The prototype ships **without** accounts, persistence, matchmaking or the generator.
