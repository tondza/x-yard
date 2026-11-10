# X-Yard

An asymmetric MMO pursuit game of hidden movement, spatial deduction, and
contraband transport, played in the browser. Players split into two factions on
node-based metropolitan transit networks: several **Fugitives** (collectively
"Subject X") move covertly, run contraband missions, and log off safely through
Safe House extractions; **Agents** coordinate to narrow probability paths, track
ticket trails, deploy tactical skills, and arrest a Fugitive by occupying their
exact node. Game rooms are isolated **Yards** (for example Yard-London), designed
to scale to roughly 1,000 parallel players across many instances.

Solo-developed. Low budget. Built to be implemented and maintained largely by
autonomous agent sessions — which is why the rules engine is a pure,
deterministic, serializable state machine and why the governance files are as
important as the code.

## Start here

| File | What it is |
| --- | --- |
| [AGENTS.md](AGENTS.md) | **Start here.** Entry point that routes a session to the authoritative document for its task |
| [GAME_VISION.md](GAME_VISION.md) | Authoritative game design brief §1–§6: core loop, Appearance, transit tiers, contraband missions, gadgets and skills, Yard scalability |
| [GAME_VISION.appendix.md](GAME_VISION.appendix.md) | Derived bookkeeping — implementation status, withdrawn concepts, open questions Q1–Q12. No design authority |
| [AGENT_RULES.md](AGENT_RULES.md) | Binding rules for agent sessions, including the `PROVISIONAL_` convention, validation errors vs warnings, and this machine's constraints |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Test layers, required suites, the vision alignment lock, Playwright plan, coverage gate |
| [PROJECT_LOG.md](PROJECT_LOG.md) | Append-only decision and progress log |
| [docs/status.md](docs/status.md) | Current state, edited in place — what is done, what is next |
| [docs/lessons.md](docs/lessons.md) | Measured environment and tooling facts |

## Layout

```
apps/
  web/            Vite + React + Canvas 2D client  (no rules)
  server/         Fastify + Socket.io authority    (no rules)
packages/
  game-core/      pure rules engine                (zero dependencies)
  map-generator/  seeded city + transit networks   (dev tooling; depends on game-core)
  shared-types/   wire DTOs and event schemas      (types only)
```

Dependency direction is one-way: `game-core` ← `shared-types` ← apps, and
`game-core` ← `map-generator`. `game-core` must never import a framework, a UI
library, `shared-types`, or the map generator.

## Commands

```bash
pnpm install     # required once after cloning
pnpm test        # the mandated gate: all workspaces, headless
pnpm typecheck   # tsc --noEmit, every workspace
pnpm build       # production build, where defined
pnpm dev         # run all apps in parallel
```

Run a single app:

```bash
pnpm --filter @x-yard/server dev     # Fastify on :3001  (/health, /board)
pnpm --filter @x-yard/web dev        # Vite on :5173; dev default is the 96-station prototype
```

In development, `http://localhost:5173/` opens the **96-station playable
prototype** — the illustrated Cathedral Quarter, one human Fugitive against four
Agent bots. `?lab` opens the seeded map lab (schematic generator, validation, JSON
export); `?board` opens the original server-backed board scaffold. Both are
dev-only and are not part of the production client.

## Status

Bootstrapped and verified: monorepo, tooling, governance files, and the engine's
foundation under the new vision — domain vocabulary for Yards, Fugitives/Agents,
transit tiers and facilities, contraband missions, gadgets and skills; xorshift128+
RNG with golden vectors; transit graph traversal and validation with the
errors-vs-warnings split; ticket economy with the ticket-log semantics for
Counterfeit Identity and Alleyway Sprint; a scaffold board; and a seeded
**map generator** that emits validated 24/60/96-station transit networks with
street-following edge geometry, and a **local 96-station prototype**: an
isometric Vintage Etching city plate (Canvas with spatial culling and zoom LOD), 16 turns, all five movement options, appearances,
capture, result and restart, with a permanent all-mode transit network, a
station inspector, a last-appearance ghost, deterministic Agent bots,
one-at-a-time move playback and a follow/map camera. The Vintage Etching skin is the default; Basic remains the fallback. 7 test files and 131 tests pass, and `pnpm install`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all
exit 0. `game-core` has zero runtime dependencies.

**The full server turn machine is not implemented yet.** The prototype loop is
local and reduced (one Fugitive, four Agents, no projection). There is no
authoritative server state machine, no multi-Fugitive projection, no mission
lifecycle, and no persistence. `apps/server` serves `/health` and `/board` and
rejects every game message explicitly as "not implemented" rather than pretending
to play. See [PROJECT_LOG.md](PROJECT_LOG.md) for what remains.

## Environment note

This repository is developed inside a sandboxed Codespace where `$HOME` is
read-only and `/tmp` does not survive between shell commands. `.npmrc` therefore
redirects the pnpm store into the repo, and `pnpm-workspace.yaml` allow-lists
`esbuild`'s build script. Do not remove either — see
[AGENT_RULES.md](AGENT_RULES.md) §7.
