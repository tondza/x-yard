# 0016 — The player-facing term is “appearance”, not “pulse”

**Status:** accepted — 2026-10-29

## Context

The director rejected the term “pulse” after the second playtest. The Scotland
Yard / Mr. X vocabulary is **appearance** — “next appearance”, “previous
appearance” — and the prototype’s turn strip, log and rules text used “pulse”
throughout. The schedule itself (turns 5, 10 and 15) is unchanged.

## Decision

- **Player-facing language** is Appearance: the turn strip reads `APPEARANCES`,
  the reveal banner reads `APPEARANCE`, and the public log row reads
  `T5 · APPEARANCE · n18`.
- **Prototype state and log** are renamed with it: `lastAppearanceTurn`,
  `pendingAppearance`, and `PrototypeLogEntry.kind: 'appearance'`.
- **The shared rules constant** is `APPEARANCE_TURNS = [5, 10, 15]`; the
  scaffold `/health` field is `appearanceTurns`.
- **The full-game wire/Phase names are left alone for now.**
  `Phase 'reveal-pulse'` and `RevealPulseMessage` belong to the not-yet-built
  `GameState`/socket contract. Renaming them is a mechanical change to be made
  with the real turn machine, not piecemeal in the prototype.
- Historical records — `PROJECT_LOG.md`, older decision records and the
  validation transcripts — keep the term that was true when they were written.
  New records use Appearance.

## Rejected alternatives

1. **Keep “pulse” as the UI term.** Rejected by the director: it is the wrong
   vocabulary for the game they are building.
2. **Rename the UI only.** Rejected: the prototype state, log and tests would
   drift from the words on screen, and the next session would reintroduce pulse
   in a refactor.
3. **Add both names as aliases.** Rejected by decision
   [0008](0008-rename-without-compatibility-aliases.md): two live names for one
   concept is how the wire and the rules drift apart.
4. **Rename the entire `GameState`/wire contract now.** Rejected: those types
   are unimplemented, and a partial rename would churn the MVP contract for no
   prototype gain. Do it once with the turn machine.

## Consequences

- `grep -rn pulse` in current implementation code should return only the
  deliberately deferred full-game identifiers and historical records.
- The spec-alignment test now pins `APPEARANCE_TURNS`; the ratified numbers are
  unchanged.
- No gameplay, timing or data semantics changed — this is a vocabulary rename.
