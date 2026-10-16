# Brief template

Copy this file, fill every section, and delete the guidance. A brief that leaves a
section empty is not ready to delegate — the recipient will guess, and you will
pay for the guess with a rework.

**Rule:** the brief must be complete enough that its recipient needs no other
context. Restate applicable rules from [`AGENTS.md`](../../AGENTS.md) rather than
linking them; a subagent should not have to discover constraints.

---

## Objective

One paragraph. Name the decision or artifact this produces, and who consumes it.
If the only acceptable outcome is a *comparison*, say what is being compared.

## Fixed inputs

Everything held constant. Exact paths, exact values, exact versions. For each: say
what it is and why it must not vary — the reason is what prevents a well-meaning
"improvement" from invalidating the comparison.

| Input | Value / path | Why it is fixed |
| --- | --- | --- |
| | | |

## The delta

The one axis this unit varies. For N parallel workers, one row each.

| Unit | Varies | Output path |
| --- | --- | --- |
| | | |

## Constraints

- The three non-negotiables from [`AGENTS.md`](../../AGENTS.md), restated.
- Any architecture boundary this touches.
- Anything prohibited that the recipient would otherwise reasonably do.

## Verification

The exact command(s), and what success looks like. Prefer mechanical checks over
"looks right": an exit code, a failing test, a pixel measurement.

```bash
# exact command
```

## Report back

State the shape of the result in one message: what was produced, where it lives,
what was verified, anything surprising. Not a transcript of the work.
