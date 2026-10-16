# 0004 — `shared-types` imports its vocabulary from `game-core`

**Status:** accepted (2026-10-15)

## Context

The wire protocol and the rules engine both need the same vocabulary:
`TransportMode`, `Role`, `YardResult`, `NodeId`, and so on. The engine is
authoritative for what those values *mean*; the wire layer needs to serialize them.

## Decision

`packages/shared-types` imports the unions and types from `packages/game-core`.
This creates a **type-only** dependency `shared-types → game-core`. The reverse
import is forbidden and is asserted by
[`architecture.test.ts`](../../packages/game-core/src/architecture.test.ts).

## Rejected alternative

**Duplicating the unions in `shared-types`.** Rejected because it lets the wire
protocol silently drift from the rules: a value added to `TransportMode` in the
engine would not appear in the wire type, and the mismatch would surface as a
runtime bug in a client rather than a compile error. This is the exact class of
drift the governance files exist to prevent.

## Consequences

- One declaration, one source of truth: a change to a union breaks compilation
  wherever the wire disagrees.
- `shared-types` cannot be consumed without `game-core`, and the arrow is one-way
  by construction.
- **Never re-declare a union that already exists in `game-core`** — that is how
  this decision would be silently undone.
