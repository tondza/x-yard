# 0009 — The derived appendix lives in its own file

**Status:** accepted (2026-10-16)

## Context

`GAME_VISION.md` held two documents with opposite authority in one file: §1–§6, the
director-authored brief (authoritative for design), and Appendix A–C,
agent-maintained bookkeeping (implementation status, withdrawn concepts, open
questions) which explicitly carries **no design authority**.

The cost was concrete. An agent told to "respect the brief" had to read past ~5 KB
of derived bookkeeping every time, and had to re-derive which half it was reading
from an HTML comment. Worse, section *numbers* are not enforceable pointers, and
after the vision was replaced wholesale the code still cited a brief section
number (§8) that no longer existed — three separate files, unnoticed for a full
round.

## Decision

Split the file at the authority boundary:

- [`GAME_VISION.md`](../../GAME_VISION.md) — the brief, §1–§6, director-authored.
- [`GAME_VISION.appendix.md`](../../GAME_VISION.appendix.md) — derived A–C, with a
  header stating its lack of authority and the procedure for answering a question.

## Rejected alternatives

- **Leave the file as one document with a banner comment.** The banner is prose;
  nothing enforces it, and the §-reference rot proved the file boundary was doing
  no work.
- **Move the appendix into `docs/`.** Rejected because the appendix is
  *referenced from inside the brief* and from `PROVISIONAL_` comments throughout
  the engine; a sibling file keeps it discoverable next to what it annotates.

## Consequences

- A session can read the brief without the bookkeeping, and vice versa.
- Appendix A (implementation status) can be edited in place, since it describes
  the present — unlike the append-only `PROJECT_LOG.md`.
- Cross-references had to be rewritten in one pass, and
  [`scripts/check-docs.mjs`](../../scripts/check-docs.mjs) now resolves
  `GAME_VISION.md §N` against the brief's actual headings so this specific rot
  cannot recur silently.
