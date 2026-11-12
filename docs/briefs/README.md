# docs/briefs/ — self-contained briefs for delegated work

One file per unit of delegated work — a subagent task, an exploration round, a
parallel workstream. The rule is that **the brief is complete enough that its
recipient needs no other context**: it names the inputs, the fixed constraints,
the deltas, and the quality bar.

## Why this exists

[`design/moodboard/round-02-city/_BRIEF.md`](../../design/moodboard/round-02-city/_BRIEF.md)
is the working example. It fixed the city, the stations, the game state, and the
HUD content, and varied only style/perspective/time-of-day — which is what made E
vs F a valid test of perspective. Because every mockup's author received the same
complete brief, four independent outputs could be compared meaningfully.

That file is the reason this directory exists: the pattern worked, so it should be
the default rather than a one-off.

## What a brief must contain

1. **Objective** — the decision or artifact this work produces.
2. **Fixed inputs** — everything held constant, with exact paths or values. If
   something must not vary, say so explicitly and say why.
3. **The delta** — the one axis this unit varies, per unit. For N parallel
   workers, list each unit's delta in a table.
4. **Constraints** — the rules from
   [`AGENTS.md`](../../AGENTS.md) that apply, restated rather than linked, because
   a subagent should not have to discover them.
5. **Verification** — how the recipient proves it worked (`pnpm test`, a
   screenshot check, an explicit exit code). Include the exact command.
6. **Output location** — where artifacts go, and whether they are committable.

## Rules

- Candidate work is tracked in [`backlog.md`](backlog.md); an idea becomes a brief
  (with its `paths:` scope lock) only when someone is ready to start it.
- **The lead session writes the brief, not the worker.** Context spent writing the
  brief is context not spent on the work itself, and it is reusable across units.
- A brief records **what to report back**, so the returning message is a result
  rather than a transcript.
- Never delegate a decision that must be made in one thread — for example the turn
  machine's design. Briefs are for breadth, not for judgement calls.
- Keep briefs for finished work. When a round is superseded, its brief moves with
  it (see [`../../archive/`](../../archive/)) rather than being deleted.
