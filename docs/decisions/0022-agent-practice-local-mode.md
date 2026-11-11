# 0022 — Agent Practice is a local role mode

**Status:** accepted — 2026-10-29

## Context

The 96-station prototype began as a single-player **Fugitive** table. The director
wants to give feedback on the Agent side before the full server/projection work.
That needs a way to play an Agent without pretending the Agent has the Fugitive's
information — or shipping the full four-Fugitive, multi-Agent room.

The local prototype already has one bot-controlled Agent team and one Fugitive
seat. What is missing is a role choice, a hidden bot Fugitive, and a pause for the
human Agent inside the Agent phase.

## Decision

1. The prototype opens with a **side chooser**: **Fugitive** or **Agent Practice**.
   The chosen side is held in client state; `Restart` keeps it and `Change side`
   returns to the chooser.
2. **Agent Practice** is one human Agent (**Falcon**, `agent-1`) against a
   bot-controlled, hidden Fugitive and the three other bot Agents.
3. The bot Fugitive uses a deterministic policy: move to the greatest graph
   distance from the nearest Agent, or hold if no move improves the distance. It is
   a practice opponent, not a final AI.
4. The Agent sees only public information: the ticket-mode log, appearances
   (5/10/15), the last-known ghost, and the public positions of the Agents. The true
   Fugitive token and route are not rendered. The appearance is public and is
   revealed before the human Agent moves.
5. The Agent phase pauses for the human Agent's chosen move; the engine accepts it
   as an explicit order (`moves`), validates it, then resolves the other Agents as
   bots. The engine remains the only authority for captures, turn advancement and
   the result.
6. `revealAppearance` is a separate public transition so the Agent can act on an
   appearance without the engine first resolving every bot.
7. The Fugitive run is unchanged: the same start chooser leads to the existing
   human-Fugitive loop. No rules, numbers or tickets changed.

## Rejected alternatives

1. **Agent spectator only.** Rejected: it does not let the director test Agent
   choices, which is the purpose of the exercise.
2. **Hotseat with full information.** Rejected: it would appear to validate Agent
   play while showing the true Fugitive position. That is exactly the information
   the real Agent must not have.
3. **Let the human control all four Agents.** Rejected for this pass: the Agent
   team is a unit, and one human seat plus three bots is enough to test the view and
   the phase. It also avoids inventing a second turn structure.
4. **Full server projection now.** Rejected: the real `GameState`/`projectState`
   work is separate. This is a local practice table; the engine is authoritative
   for the table, but the hidden projection is client-side because there is one
   human view.
5. **A new "practice" ruleset with different capture or appearance numbers.**
   Rejected: the feedback would not transfer to the real Agent experience. The same
   table is used.

## Consequences

- The start screen requires a side choice; there is one extra click before play.
- The true Fugitive exists in the local state and the dev-only debug object. It is
  not rendered or logged; the real server projection remains required before
  multiplayer.
- The bot Fugitive is intentionally simple. Its distance policy must be replaced or
  tuned after the director's Agent feedback.
- Engine tests cover Agent orders, holds, invalid orders and public appearance
  reveal. The full suite is **7 files / 136 tests**.
