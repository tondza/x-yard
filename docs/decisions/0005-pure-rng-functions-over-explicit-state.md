# 0005 — The RNG is pure functions over an explicit `RngState`

**Status:** accepted (2026-10-15)

## Context

The engine needs randomness (map generation, decoy behaviour, tie-breaks). The
replay contract requires that a Yard reconstruct exactly from its seed and event
log, which means every random draw must be reproducible from persisted state.

## Decision

`xorshift128+` implemented as **pure functions over an explicit state value**:
`seedRngState`, `nextRandom`, `randomInt`, `pickRandom`, `shuffleWith`, and
`isRngState`. The state lives *inside* `GameState` as four words.

## Rejected alternative

**A stateful closure or class** (e.g. a `Random` object holding its own seed).
Rejected because it would hide the very state that has to be serialized: the
closure's internal words could not be persisted, so replay from an event log would
be impossible without reaching into private state. It would also be a class
instance, which the state contract bans.

## Consequences

- Replay is possible: `rngState` round-trips through JSON like any other field.
- `rng.test.ts` locks the stream with golden vectors for seeds 42/7/99, because
  **changing the algorithm silently invalidates every saved Yard**. Treat those
  vectors as a data-format version, not as an implementation detail.
- Callers must thread state through explicitly. That is deliberate friction: a
  draw that does not advance persisted state is a replay bug.
