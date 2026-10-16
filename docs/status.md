# docs/status.md — current state

Edited **in place**. This is the answer to "where are things right now?"; it is
not a history. History lives in [`PROJECT_LOG.md`](../PROJECT_LOG.md), and unlike
that file this one is expected to be rewritten as reality changes.

Last updated: 2026-10-16.

## What works today

| Thing | State | Verified by |
| --- | --- | --- |
| Monorepo + tooling (pnpm workspaces, TS strict, Vitest) | ✅ done | `pnpm install` / `pnpm typecheck` |
| `game-core`: domain vocabulary, graph + validator, ticket economy, xorshift128+ RNG | ✅ done | 5 test files, 88 tests |
| `game-core`: zero runtime dependencies | ✅ enforced | `dependencies: {}` and `architecture.test.ts` |
| `apps/server`: boots, serves `/health` and `/board` | ✅ done | manual `curl`; no integration suite yet |
| `apps/web`: scaffold board on Canvas 2D | 🟡 scaffold only | `pnpm build` |
| Governance: entry point, enforceable invariants, doc checks | ✅ done | `pnpm check:docs` |

## What is next (in order)

1. **`GameState` + `submitCommand` + `applyEvent` + the turn/phase machine** —
   the single blocking item; almost everything below depends on it.
2. `hashState` / `replay` — the replay oracle.
3. `projectState` — secret projection. **Until it exists no server code may send
   `GameState` to a client.**
4. Capture Resolution, Reveal Pulse scheduling, mission lifecycle, gadget/skill
   resolution.
5. Server integration tests via `fastify.inject()`.
6. Persistence, reconnect/resume, multi-Yard management, matchmaking.

## Blocked on the director

- **Art style and perspective** — mockups E–H exist in
  [`design/moodboard/round-02-city/`](../design/moodboard/round-02-city/); no
  decision recorded yet. Settling them is a prerequisite for committing to a
  rendering technology (Canvas 2D will not hold ~600–900 nodes × ~100 players).
- **Open questions Q1–Q12** in
  [`GAME_VISION.appendix.md`](../GAME_VISION.appendix.md) appendix C. Each has a
  recommended default already encoded as a `PROVISIONAL_` constant, so nothing is
  blocked in practice.

## Known deviations from the brief

Tracked here so a session does not rediscover them (full detail in the log):

- Module layout is flat; the brief cites nested paths. Revisit when the turn
  machine lands.
- `demo-board.ts` is a fixture, **not** the shipped map.
- Node classes (`street`/`hub`/`terminal`) are a provisional taxonomy (Q7).
- `TransportMode` has four values and does **not** include on-foot movement,
  which `VISUAL_DIRECTION.md` §1 decision 2 makes a fifth movement option. This
  affects the wire protocol and the ticket log, so it needs a deliberate decision.
- Playwright is not installed; `pnpm test:e2e` does not exist yet.
