# archive/ — superseded approaches

Nothing in this repository is deleted for being superseded. It moves here, with a
short `WHY_SUPERSEDED.md` explaining what it was, why it was replaced, and what —
if anything — was carried forward.

## The rule

1. **Move, don't delete.** `git mv` the directory so history follows it.
2. **Write `WHY_SUPERSEDED.md`** beside it. The valuable part is the *reason*, not
   the artifact: a future session needs to know whether the approach can be
   revived.
3. **Update the index below**, and remove or fix inbound links to the old path
   ([`pnpm check:docs`](../scripts/check-docs.mjs) fails on dead links, which is
   what makes this step mechanical rather than a matter of discipline).
4. **Never archive silently.** If a live document referenced it, that document
   must now say where it went.

## What is *not* archived

- **Withdrawn game concepts** — those are recorded in
  [`GAME_VISION.appendix.md`](../GAME_VISION.appendix.md) appendix B, which is a
  decision record rather than an artifact store.
- **Settled engineering decisions** — those live in
  [`docs/decisions/`](../docs/decisions/). A decision that is replaced gets
  superseded, not archived.
- **Superseded design exploration** — a moodboard round archives *in place*, in
  [`design/moodboard/`](../design/moodboard/README.md), because `design/` is
  already the archive for design history. Round 01 is the worked example: marked
  `Superseded`, kept with its screenshots, its reasoning recorded, and one mockup
  (A) explicitly carried forward as the HUD reference. Moving it here would add
  link churn without adding information.

## Enforced, not just documented

`pnpm check:docs` fails if any directory under `archive/` lacks a
`WHY_SUPERSEDED.md`. That is the point of this convention: an archived approach
without a recorded reason is just a deletion with extra steps, and a future
session cannot tell whether it can be revived.

## Index

| Archived | Was | Superseded by | Carried forward |
| --- | --- | --- | --- |
| — | *(nothing archived yet)* | — | — |

There are currently no entries. Deliberately: nothing has been *replaced* yet that
is not already better handled elsewhere. When that changes, the mechanics above
apply. Do not archive something merely because it is old.

The known future candidate is `packages/game-core/src/demo-board.ts` — a scaffold
fixture, not the shipped map — which archives when the real map lands.
