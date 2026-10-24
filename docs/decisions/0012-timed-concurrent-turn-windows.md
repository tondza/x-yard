# 0012 — Timed, concurrent turn windows replace sequential turns

**Status:** accepted (2026-10-16)

## Context

The MVP inherited a **sequential** model: M1 rotated Agent turns by a fixed
`detectiveOrder`, and the engine's phases assumed one actor at a time. The director
has clarified the intended model — each faction acts inside a **time limit of 30
seconds**, **all Agents move within that window**, and **a move is visible to the
others as soon as it is made**. The Fugitive window then follows the same shape, and
**Fugitives see each other**.

## Decision

A turn has **two timed windows, Agents then Fugitives**, each **30 seconds** (a
starting value to tune). Every member of the active faction may move inside the
window; moves are broadcast as they land; the window closes when everyone has moved
or the timer expires. **Faction-internal positions are visible**; cross-faction
positions stay hidden except on a Reveal Pulse and through the public mode log.

## Rejected alternatives

- **Sequential turns in a fixed rotation.** What the rules currently specify.
  With up to 20 seats a rotation means waiting for up to 19 other players before you
  may act — unplayable inside a 5–10 minute phone session, and it removes the
  read-the-room tension the director is asking for.
- **Simultaneous submission, all moves revealed together at the end of the window.**
  Rejected outright: the director wants a move visible *as it is made*, so later movers
  act on more information. That is a deliberate gameplay property, not an
  implementation detail.
- **Putting the timer inside the engine.** Rejected: `game-core` is banned from
  wall-clock time. The timer belongs to the server; a timeout reaches the engine as an
  event, so *what* happens stays independent of *when*.
- **Replaying moves in an arbitrary or sorted order.** Rejected: once moves are
  observable mid-window, **arrival order changes outcomes**, so it must be recorded.
  The append-only event log already carries it; replay must never re-sort.

## Consequences

- Determinism survives **only because the event log records arrival order**. Any
  replay or test that re-orders events is now wrong.
- **Capture resolution must define concurrent collisions** — two Agents reaching the
  same node, and an Agent and a Fugitive crossing inside the same window. Neither is
  specified today.
- **Timeout behaviour is undefined.** `hold` is not obviously right: a player who ran
  out of time is not the same as a player with no legal move. A pure `chooseAutoMove`
  keeps determinism and is the likely answer, but it is the director's call.
- **Windows must close early** to hit the session target; otherwise 16 turns × two 30 s
  windows is 16 minutes against a 5–10 minute budget. The turn limit may also need to
  fall.
- M1's `detectiveOrder` and the ratified `fugitive-phase → reveal-pulse → agent-phase`
  order **both need rewriting**, as does the mobile UI: every screen now needs a
  visible countdown and a "waiting for others" state, which the current mockups do not
  show.
