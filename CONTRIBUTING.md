# Contributing to X-Yard

Welcome. This file is the **contributor's entry point**: the rules, the workflow,
and where to get help. It assumes you may be new to this project and to this style
of development, and that an AI agent (Claude Code, DeepSeek, …) will do most of
the mechanical work under your direction.

X-Yard is a browser game of hidden movement — several **Fugitives** versus
**Agents** on a generated transit network. The code is a small monorepo with a
deliberately pure rules engine, and it is developed and maintained largely by
autonomous agent sessions. That is why the *process* files here matter as much as
the code.

## The two roles

- **Maintainer** — owns `main`, merges pull requests, writes [`PROJECT_LOG.md`](PROJECT_LOG.md)
  and [`docs/status.md`](docs/status.md), and ratifies game numbers, vocabulary,
  dependencies and the wire protocol.
- **Contributor (you)** — works on your own branch, opens a pull request, and
  never merges, never pushes to `main`, and never edits the two chronicle files.

Everything below is the contributor's side of that split.

## Before anything else — set up

Follow [`docs/setup.md`](docs/setup.md) end to end first. It takes you from a clean
checkout to a running game and a green test suite, assuming an AI agent is helping.

## The contribution loop (TL;DR)

1. Pick a **batch** — a task scoped to one functional area. Your brief names it.
2. Create a branch: `batch-NN-<slug>`.
3. Read [`AGENTS.md`](AGENTS.md), then the batch brief. Tell your agent to touch
   only the paths in the brief's scope lock.
4. Make the change and run the gate (below).
5. Open a pull request; the maintainer reviews and merges.

## Work is done in "batches"

A batch is a task bounded in advance, so it stays small to review and its impact
is limited. Every contributor change starts from a brief at
`docs/briefs/batch-NN-<slug>.md`, written from the
[`docs/briefs/_TEMPLATE.md`](docs/briefs/_TEMPLATE.md) template, which includes a
**scope lock**: the exact list of paths the batch may touch.

Rules of a batch:

1. **Stay inside the scope.** If a required change falls outside the lock, stop
   and report it — do not widen the scope on your own.
2. **No cross-cutting refactors**, no new dependencies, and no changes to game
   numbers, terminology, or the wire protocol unless the brief says so and the
   maintainer approved it.
3. **Regenerate data with the code.** A map-generator change ships with its
   regenerated `maps/*.json` fixtures in the same pull request.
4. **Run the gate before the PR.**

Give your agent an instruction like this to start a batch:

> Read `AGENTS.md`, then `docs/briefs/batch-NN-<slug>.md`. Touch only the paths in
> the scope lock. Run the verify command. Do not edit `PROJECT_LOG.md` or
> `docs/status.md`. Do not run `git push`.

## The rules that never bend

These come from [`AGENTS.md`](AGENTS.md) and [`AGENT_RULES.md`](AGENT_RULES.md).
The short version:

1. **Run the full test suite from the repo root** before you call work done —
   `pnpm test`, not one package's tests.
2. **Never add a dependency to `packages/game-core`.** It stays at
   `"dependencies": {}`.
3. **TypeScript strict mode stays on.** Fix the code, not the compiler settings.

Ask the maintainer before changing a stated number, adding a dependency to
`game-core`, or changing the wire protocol. Unstated numbers must be named
`PROVISIONAL_` constants, never inlined as magic numbers.

## Shared vs local files

- **Shared (committed, everyone reads the same):** `AGENTS.md`, `AGENT_RULES.md`,
  `GAME_VISION.md`, `docs/**`, `PROJECT_LOG.md`, mockup sources, map fixtures.
- **Local (gitignored, yours alone):** `AGENTS.local.md` (your personal agent
  instructions) and `docs/lessons.local.md` (your personal lessons). They are
  addenda to the shared files, never a replacement, and never committed.

## Verification gate

Run from the repository root before opening a pull request:

```bash
pnpm verify   # install + typecheck + check:docs + build
pnpm test     # the full suite, every workspace
```

Paste the output into the pull request. A green run is not a courtesy; it is how
the maintainer knows the change is safe to read.

## Pull requests

- Branch `batch-NN-<slug>`; one batch per PR.
- Describe the change, state the batch number, and attach evidence (a screenshot
  for visual work).
- The maintainer reviews scope, correctness and rules, then merges and writes the
  [`PROJECT_LOG.md`](PROJECT_LOG.md) entry.

## Licensing

This project is source-available under a proprietary license ([`LICENSE`](LICENSE)).
By submitting a pull request you grant the copyright holder a worldwide,
royalty-free, irrevocable, perpetual license to your contribution under those
terms — this lets the project be monetized or relicensed later without asking
each contributor again.

## Getting help

- Ask your agent to read [`AGENTS.md`](AGENTS.md) first — it routes every task to
  the right document.
- [`docs/lessons.md`](docs/lessons.md) records measured environment and tooling
  facts.
- [`docs/decisions/`](docs/decisions/README.md) explains *why* things are the way
  they are, including the rejected alternative.
