# docs/briefs/backlog.md — the batch backlog

A living list of candidate work, owned by **both** the maintainer and the
contributor. Anyone may add, refine, or claim a row here. It is not a plan and
not a commitment — it is the pool that batches are drawn from.

**How an idea becomes work:**

1. Add a row here with the seam (which package/files) and a rough size.
2. When someone is ready to start, the maintainer (or an agreed lead) turns the
   row into a brief using [`_TEMPLATE.md`](_TEMPLATE.md): `batch-NN-<slug>.md`,
   including the `paths:` scope lock.
3. Work happens on a `batch-NN-<slug>` branch; CI enforces the scope lock
   ([`../collaboration.md`](../collaboration.md) §3–§4).
4. On merge, move the row to **Done** and strike the idea.

**Sizes:** S = an afternoon, M = a few sessions, L = a multi-session feature.

---

## Ideas

| # | Idea | Seam | Size | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **River + bridges** — generator geometry, fixture regeneration | `packages/map-generator/src/**`, `maps/*.json` | L | idea | Largest remaining gap to the board reference (round-07 item 8). |
| 2 | **Landmark compound footprints** — real footprints instead of plaques | `apps/web/src/prototype/**` (city + skins) | M | idea | Director rejected scale-up; a compound footprint is the approved path. |
| 3 | **Denser block plan** — more, smaller blocks | `packages/map-generator/src/**`, `maps/*.json` | M | idea | Board pass follow-up. |
| 4 | **300-node scale rehearsal** — k-nearest taxi graph + camera/LOD contract | `packages/map-generator`, `apps/web` | L | idea | Proves MVP scale before the 20-player build. |
| 5 | **Street-name variety** — fewer repeated landmark suffixes | `apps/web/src/prototype` (presentation) | S | idea | Names are client-side labels, not map data. |
| 6 | **Gable-end windows** — detail pass on closed gable ends | `apps/web/src/prototype` (city renderer) | S | idea | Recorded as a known limit of the building-correctness pass. |

## Warm-up / small fixes

Small, low-risk items ideal for a contributor's first batch — add any bug or
polish task that is mechanical and scoped to one file or one package.

| # | Idea | Seam | Size | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| — | *(empty — add the first one here)* | | S | | |

## Done

| # | Idea | Batch / PR | Merged |
| --- | --- | --- | --- |
| — | *(none yet)* | | |
