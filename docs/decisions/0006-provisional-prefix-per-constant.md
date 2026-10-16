# 0006 — One `PROVISIONAL_` constant per unratified number

**Status:** accepted (2026-10-15)

## Context

The director's brief pins some numbers down (Sensor Sweep's 2-node radius) and
leaves many open (ticket counts, reveal interval, turn limit, payouts, seat
counts). Implementation has to proceed without blocking on the answers, and when an
answer arrives someone must be able to find every number that was guessed.

## Decision

Every number the brief does not state is exported as its own named constant whose
identifier begins with `PROVISIONAL_`, with a comment citing the open question it
stands in for. `grep -rn PROVISIONAL_` is therefore the complete inventory of
unratified defaults, and
[`spec-alignment.test.ts`](../../packages/game-core/src/spec-alignment.test.ts)
asserts both directions: each expected export exists, and no ticket/turn/grace/
payout constant exists *without* the prefix.

## Rejected alternatives

- **Inline magic numbers.** Invisible to `grep`, so the inventory would be a lie.
- **One central `DEFAULTS` object.** `grep` would report a single symbol rather
  than the individual unratified numbers, and promoting one answer would mean
  editing a shared object all at once.

## Consequences

- The inventory is mechanically complete and cheap to check.
- `PROVISIONAL_` names are long on purpose: an unratified constant is visibly
  provisional at every call site.
- Only one number per constant. Never fold two provisional values into one named
  constant, and never let one reach the wire layer unlabelled.
- When an answer arrives, the change is a rename plus an appendix edit plus an
  alignment-test update — **in one commit** ([`AGENT_RULES.md`](../../AGENT_RULES.md) §4).
