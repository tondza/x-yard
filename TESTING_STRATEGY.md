# TESTING_STRATEGY.md

How X-Yard is tested, what exists today, and what is deliberately deferred.

The single most important property of this project is that **the rules engine is
a pure, deterministic, serializable state machine** (AGENT_RULES.md §6). Almost
every testing decision below follows from that: if the engine is pure, then a
Yard is a value, a bug report is a seed plus an event log, and an entire class of
"cannot reproduce" problems disappears.

---

## 1. Layers

| Layer | Tool | Lives in | Runs in | Status |
| --- | --- | --- | --- | --- |
| Unit — rules primitives | Vitest (headless, node) | `packages/game-core/src/*.test.ts` | `pnpm test` | ✅ active (4 files, 83 tests) |
| Vision alignment lock | Vitest | `spec-alignment.test.ts` | `pnpm test` | ✅ active |
| Turn/phase machine | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending engine |
| Capture resolution | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending engine |
| Reveal-pulse scheduling | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending engine |
| Mission lifecycle | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending engine |
| State-machine fuzz | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending engine |
| Replay hash-equality | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending engine |
| Secret projection | Vitest | `packages/game-core` | `pnpm test` | ⏳ pending `projectState` |
| Server integration | Vitest + `fastify.inject()` | `apps/server` | `pnpm test` | ⏳ pending |
| Browser interaction | Playwright | `apps/web/e2e` | `pnpm test:e2e` | ⏳ deferred (§6) |

Rule of thumb: **if it can be decided by a pure function, it must be tested in
`game-core` at the unit layer**, not through the browser. Playwright is reserved
for things that only exist in a real browser: canvas rendering, pointer input,
socket reconnection, and the reconnect/resume UX.

## 2. Unit tests: the rules engine

Requirements:

- **Headless and fast.** Vitest with the default `node` environment. No DOM, no
  network, no filesystem, no clock. A test that needs a browser is in the wrong
  package.
- **Deterministic.** No `Math.random`, no `Date.now`. Inject a seed and assert on
  exact values. Randomised tests must be seeded, and the seed must be printed on
  failure so the case can be replayed.
- **Golden vectors.** Where an algorithm's exact output matters for stored
  replays, lock it with a golden vector. `rng.test.ts` is the reference example:
  it pins the xorshift128+ stream for seeds 42/7/99, because changing the stream
  would silently invalidate every saved Yard.
- **Value-based failures.** Rejections are returned as values
  (`{ ok: false, reason: 'no_ticket' }`), so tests assert on the value, not on a
  thrown exception.
- **Test names state the rule**, not the function: `rejects a one-way edge, which
  MVP forbids` beats `validateGraph works`.

### Vision alignment lock

`spec-alignment.test.ts` guards three things, and none of them is negotiable:

1. **Stated facts.** It asserts what the brief pins down: the Sensor Sweep radius
   is 2, and the gadget, skill, and transport-mode lists are exactly the brief's
   (`taxi` / `bus` / `underground` / `special`, with the three named gadgets and
   three named Agent skills and nothing else).
2. **The `PROVISIONAL_` convention.** Every number the brief does not state must
   be exported under a `PROVISIONAL_` name, and the test asserts both that the
   expected provisional exports exist and that no ticket, turn, grace, or payout
   constant exists *without* the prefix. This is what keeps
   `grep -rn PROVISIONAL_` a complete inventory of unratified defaults.
3. **The withdrawn vocabulary.** The test asserts that the superseded design
   cannot creep back into the public API: no `MR_X_*` / `DETECTIVE_*` /
   contract / cache exports, no `ferry` transport mode, no cache-node helpers.
   The old vision was replaced wholesale, and this guard is why a stray rename
   fails the suite instead of quietly reviving it.

Its purpose is to make *silent* drift impossible: an agent that changes a stated
fact, mints an unlabelled number, or reintroduces a withdrawn term gets a red
test. When the director changes the brief, update the brief and this test
together.

### Required suites

These are the suites the brief and the architecture require. The first column is
the target state; today, the first four are real.

| Suite | Purpose | Status |
| --- | --- | --- |
| `rng.test.ts` | xorshift128+ golden vectors; snapshot/restore round-trip (20 tests) | ✅ done |
| `graph.test.ts` | `validateGraph` errors vs warnings, facility requirements, traversal helpers (33 tests) | ✅ done |
| `tickets.test.ts` | spend/refund, exhaustion paths, and the ticket-log semantics of Counterfeit Identity and Alleyway Sprint (21 tests) | ✅ done |
| `spec-alignment.test.ts` | stated facts, `PROVISIONAL_` naming, withdrawn-vocabulary absence (9 tests) | ✅ done |
| `rules.test.ts` | fuzz seeded Yards; terminate within 2 × turn limit; no negative tickets; no unreachable nodes | ⏳ pending engine |
| `capture.test.ts` | occupation arrest at Capture Resolution | ⏳ pending engine |
| `reveal.test.ts` | Reveal Pulse scheduling and Decoy Ping falsification | ⏳ pending engine |
| `missions.test.ts` | mission accept/deliver/payout and risk-tier side effects | ⏳ pending engine |
| `replay.test.ts` | 1,000 Yards: `hashState(replay(init, log)) === hashState(live)` | ⏳ pending engine |
| `projection.test.ts` | serialised Agent/spectator view contains no Fugitive position, inventory, or `rngState` | ⏳ pending `projectState` |

### The replay oracle

`hashState(state)` is the equality oracle: a canonical stringify with sorted keys.
Two states are the same Yard position iff their hashes match.
`replay(init, log)` must hash-equal the live server state — this is what makes the
append-only event log the authoritative record and what makes reconnect and
anti-cheat affordable. Persistence is not implemented yet; see PROJECT_LOG.md.

**Implementation note:** `undefined` is banned from state precisely so that
hashing is unambiguous. `Map`/`Set` are banned because their iteration order is
not part of the JSON contract.

### Fuzzing rules

- Every fuzz case is seeded and reproducible. On failure, print the seed and the
  command to reproduce it.
- Fuzz assertions are invariants, never golden values: ticket counts never go
  negative, every Yard terminates, no node becomes unreachable, `rngState` always
  has four valid words.
- Keep a bounded case count in the default run (10,000 Yards must stay well under
  a minute); put longer soak runs behind an opt-in env var.

## 3. Coverage

- Gate: **90% lines for `packages/game-core`** (engineering target; the brief
  states no coverage number).
- Coverage is not yet wired up. When it is, use `@vitest/coverage-v8` and make the
  gate fail the build rather than only reporting.
- Type-only files (`types.ts`) and test files are excluded from the denominator.
- Coverage is a floor, not a goal: `spec-alignment.test.ts` and the fuzz suites
  matter more than a percentage.

## 4. Server integration tests

- Build the app with `buildServer()` and drive it with `fastify.inject()` — never
  bind a real port in a test.
- Socket.io behaviour is tested against an in-process server, not a real network
  peer.
- Until the turn machine lands, the contract to test is the explicit rejection:
  every accepted client message type is answered with a typed `ErrorMessage`
  saying the handler is not implemented, never silently dropped.
- The projection boundary is the critical case: assert that an Agent's serialised
  snapshot contains no secret. This is a security property, not a formatting
  preference.
- The server must never trust client input: send malformed and hostile messages
  and assert they are rejected with a typed `ErrorCode`.

## 5. What is forbidden in a unit test

- Real timers and `setTimeout`-based waiting. Inject a clock or advance to an
  explicit turn.
- Real network calls, including to a local server.
- Reading or writing files.
- Asserting on `console.log` output.
- Snapshot tests over the whole `GameState` blob. They fail for unrelated reasons
  and hide which rule broke. Assert on the specific field.

## 6. Playwright (browser interaction) — deferred

Playwright is the right tool for the client, but it is **not installed yet** and
cannot be installed naively in this environment:

- Browsers download to `~/.cache/ms-playwright`, and `$HOME` is **read-only**
  here (see AGENT_RULES.md §7). Installation must set
  `PLAYWRIGHT_BROWSERS_PATH` to a path inside the workspace, e.g.
  `PLAYWRIGHT_BROWSERS_PATH=/workspaces/x-yard/.playwright-browsers`, and that
  directory must be git-ignored.
- `pnpm test` must stay fast and must **not** launch browsers. Browser tests get
  their own script, `pnpm test:e2e`, so the mandated pre-completion `pnpm test`
  remains a pure headless unit run.

Scope when it lands:

1. **Canvas rendering** — the map draws the expected number of station discs and
   routes, facility markers for Black Market and Safe House nodes are present, and
   a mode-colour legend is present. Deterministic input (a fixture board) means
   this can be asserted by pixel sampling rather than eyeballing.
2. **Pointer interaction** — clicking a station selects it; only legal
   destinations are offered.
3. **Reconnect/resume** — kill the socket, reconnect, assert the client resumes
   from `lastEventSeq` with no duplicated or missing events.
4. **Spectator delay** — a spectating session sees state as of `turn - 2` and
   never a Fugitive's exact position.

Anti-flake rules: no fixed `sleep`; wait on explicit app state exposed via a test
hook; run one worker in CI; never assert on animation frames.

## 7. Running the tests

```bash
pnpm test                              # all workspaces, headless (the mandated gate)
pnpm --filter @x-yard/game-core test   # rules engine only
pnpm --filter @x-yard/game-core test -- --watch
pnpm typecheck                         # every workspace
pnpm test:e2e                          # Playwright (not yet wired)
```

`pnpm test` at the root runs `pnpm -r --if-present run test`, so a package
without tests is skipped rather than failing. Adding a `test` script to a package
enrols it in the gate automatically.

## 8. CI readiness

The suite is CI-ready as long as CI can write to the workspace (for the pnpm
store). There is no test that depends on wall-clock time, network access, a
browser, or a database. When Postgres arrives for persistence, integration tests
must run against a disposable container, never a shared instance.
