---
name: x-yard-decision-record
description: How to write and file a settled decision, lesson, or status update in X-Yard, including the house format with the rejected alternative, the append-only rule for PROJECT_LOG.md, and the numbering convention. Use when recording a decision, superseding an earlier one, capturing a measured environment fact, or updating what is currently true about the project.
---

# Recording decisions, lessons, and status in X-Yard

Four destinations, and choosing the wrong one is why records rot. Pick by *what
kind of statement* you are making.

| The statement is… | Goes in | Rewritable? |
| --- | --- | --- |
| "We chose X, and not Y, because Y would have caused Z" | `docs/decisions/NNNN-*.md` | No — supersede it |
| "This machine fails this way, and here is the fix" | [`docs/lessons.md`](../../../docs/lessons.md) | Yes — keep current |
| "What is done and what is next, right now" | [`docs/status.md`](../../../docs/status.md) | Yes — edited in place |
| "What happened, and when" | [`PROJECT_LOG.md`](../../../PROJECT_LOG.md) | **No — append only** |

## Decision records

Format and index live in [`docs/decisions/README.md`](../../../docs/decisions/README.md).
The non-obvious rules:

- **The rejected alternative is the point.** "We used X" is nearly worthless to a
  later session; "we used X, and Y was rejected because it would have let the wire
  drift from the rules" is what stops the mistake returning.
- **Never edit an accepted record's decision.** Write a new record, and set
  `Superseded by: NNNN` on the old one. The history of *why* is the artifact.
- Number in creation order: `NNNN-kebab-case-title.md`.
- **If the decision can be checked by a machine, check it.**
  [`architecture.test.ts`](../../../packages/game-core/src/architecture.test.ts) and
  [`spec-alignment.test.ts`](../../../packages/game-core/src/spec-alignment.test.ts)
  are the pattern — a prose record states intent, a test prevents regression.
  Prefer adding to a test over adding a paragraph.

## Lessons

An entry is only useful if it names the **symptom you will actually see**. Use the
shape: symptom → cause → fix → *enforced by* (the file or check that stops the fix
being silently undone). An entry with no enforcing file will rot; if a lesson
exposes a rule nothing enforces, that is a gap worth fixing in the same change.

## PROJECT_LOG.md

Append a new dated entry. **Never edit or delete an existing entry** — corrections
are new entries that reference the old one. Because of this, old entries may
contain claims that are no longer true; that is history, not error, and
[`scripts/check-docs.mjs`](../../../scripts/check-docs.mjs) exempts the file from
count checking for exactly this reason.

Each entry states what changed and *why*, and records the alternative that was
rejected.

## Status

`docs/status.md` describes the present, so rewrite it freely. If you change what
is true, update it in the same change — otherwise the next session starts from a
stale premise.

## Then verify

```bash
pnpm check:docs
```

It fails on dead links, stale test counts, and dangling `GAME_VISION.md §N`
references. Those checks exist because all three had already happened here.
