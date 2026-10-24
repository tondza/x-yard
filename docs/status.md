# docs/status.md — current state

Edited **in place**. This is the answer to "where are things right now?"; it is
not a history. History lives in [`PROJECT_LOG.md`](../PROJECT_LOG.md), and unlike
that file this one is expected to be rewritten as reality changes.

Last updated: 2026-10-16.

## What works today

| Thing | State | Verified by |
| --- | --- | --- |
| Monorepo + tooling (pnpm workspaces, TS strict, Vitest) | ✅ done | `pnpm install` / `pnpm typecheck` |
| `game-core`: domain vocabulary, graph + validator, ticket economy, xorshift128+ RNG | ✅ done | 5 test files, 93 tests |
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

## Blocked on the director (and what is now ruled)

Items marked **RULED** are recorded for context. They no longer block anything.

- **Art style and perspective** — narrowed on 2026-10-16 to **F** (flat vector,
  2.5D tilt) and **H** (painterly, pure top-down, night) in
  [`design/moodboard/round-02-city/`](../design/moodboard/round-02-city/);
  pixel-art is out. Not yet a single choice. Settling it is a prerequisite for
  committing to a rendering technology (Canvas 2D will not hold ~600–900 nodes ×
  ~100 players).
- **RULED 2026-10-16 — MVP scope.** Drafted and validated, then **re-scoped by the
  director** the same day. The ratified re-statement is [`docs/mvp/README.md`](mvp/README.md),
  whose top section lists the six rulings and what they invalidate. Three P0 changes
  are applied there: **16 turns with pulses 5/10/15**, the **scooter's exact-position
  reveal cut**, and **pass-and-play rejected** in favour of one device per seat.
- **RULED 2026-10-16 — phase order: prototype before MVP.** The director added a
  **prototype phase** (5 seats: 1 human + 4 bots, single-player, simple bots) whose
  purpose is to give a feeling of success and validate the look. The **MVP is
  multiplayer at up to 20 players with 4 Fugitives**, bots filling empty seats and
  humans able to take over a bot's seat mid-Yard. Recorded as [decision
  0011](decisions/0011-prototype-before-multiplayer-mvp.md); the plan is
  [`docs/project-plan.md`](project-plan.md).
- **RULED 2026-10-16 — turn model: timed concurrent windows.** Each faction acts in a
  **30-second window with all members moving at once**; a move is visible to the rest
  of the faction as soon as it is made. Agents first, then Fugitives, and Fugitives see
  each other. This **replaces sequential play** — M1's `detectiveOrder` and the
  ratified `fugitive-phase → reveal-pulse → agent-phase` order both need rewriting, and
  every mobile screen now needs a countdown and a "waiting for others" state. Recorded
  as [decision 0012](decisions/0012-timed-concurrent-turn-windows.md).
- **Open sub-questions from the turn-model ruling:** confirm Agents-then-Fugitives;
  timeout behaviour (`hold` vs a pure `chooseAutoMove`); early window close (required —
  16 turns × two 30 s windows is up to 16 minutes against a 5–10 minute target); where
  the Reveal Pulse now sits; and concurrent collisions (two Agents to one node, an
  Agent and a Fugitive crossing in one window).
- **Invalidated by the re-scope.** `round-03-rules.md`, `round-03-product.md` and
  `round-03-validation.md` were all written for **1 Fugitive vs 2 Agents** and must be
  rewritten for the 20-player, 4-Fugitive model. With four Fugitives, `projectState`
  must project per viewer **and per Fugitive**.
- **The core loop — the real blocker.** The validator's verdict is *"worth building
  only if three things change"*: as specified the game reduces to
  *"don't be adjacent at the pulse, be adjacent at the pulse"* — the Reveal Pulse is
  the only real decision and the rest is bookkeeping around 3–5 one-turn windows.
  The three P0s are necessary but may not be sufficient. Options are in
  [`docs/mvp/README.md`](mvp/README.md) §5: ship the thin loop to validate the
  pipeline, restore tension by scale (1v3 and/or a larger map), or add a second
  Agent lever between pulses. **This is a design call for the director.**
- **Map representation — researched, recommendation recorded.** Node-and-edge stays
  authoritative. A block/square field was **rejected**: it does not make capture more
  unambiguous (capture is already one exact discrete comparison) and it would
  collapse the four transport tiers into "how far". The real fix for the
  diagonal-drawing complaint is **authored per-edge street geometry**. See
  `docs/research/round-03-map-system.md` and [`docs/mvp/README.md`](mvp/README.md) §4.
- **Mobile-first MVP mockups** — in flight under
  `design/moodboard/round-03-mobile/`: phone-portrait scenarios (Fugitive turn,
  Agent deduction, Reveal Pulse, capture result), one night-style variant for the
  F-versus-H comparison, and one desktop enhancement.
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
