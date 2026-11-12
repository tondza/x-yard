# docs/collaboration.md — the collaboration layer

Status: **adopted, edited in place.** This file is not a design or process
authority. [`AGENTS.md`](../AGENTS.md), [`AGENT_RULES.md`](../AGENT_RULES.md),
[`GAME_VISION.md`](../GAME_VISION.md) and [`TESTING_STRATEGY.md`](../TESTING_STRATEGY.md)
outrank it and stand regardless of whether a collaborator exists.

It records the **extra** rules, permissions and automation added so a second
person can contribute without changing the maintainer's workflow, and it is the
**revert map**: everything the layer adds is listed with the action that removes
it. Revert by adding a commit, never by rewriting history.

Last updated: 2026-11-12.

---

## 1. Why the model is asymmetric

X-Yard is solo-developed and maintained largely by autonomous agent sessions. A
contributor must not turn the maintainer into a reviewer of the maintainer's own
work. The model therefore puts **all the friction on the contributor** — branch,
pull request, CI gate, batch scope — while the maintainer keeps direct push to
`main`.

The contributor is a **trusted guest, not an equal**. In particular:

- the contributor never merges and never pushes to `main`;
- the contributor never edits [`PROJECT_LOG.md`](../PROJECT_LOG.md) or
  [`docs/status.md`](status.md) — these stay single-writer;
- game-design numbers, vocabulary, `game-core` dependencies and the wire protocol
  remain the maintainer's call ([`AGENT_RULES.md`](../AGENT_RULES.md) §11);
- the contributor proposes decisions, the maintainer accepts them.

## 2. Roles and permissions

| | Maintainer (owner) | Contributor |
| --- | --- | --- |
| GitHub access | Admin | **Write** |
| Push to `main` | direct (bypass) | never |
| Work on branches | optional | always |
| Pull request | optional | required |
| Merge | owner | never |
| `PROJECT_LOG.md`, `docs/status.md` | owner | read-only |
| `docs/decisions/` | owner, or approved contribution | propose only |
| Numbers, vocabulary, wire protocol | ratify | request |
| CI checks | pass (or bypass) | must pass |

Access is enforced by GitHub permissions, not by prose. If branch protection is
unavailable on the plan (private repo without Pro/Team), the fallback is
"CI + scope guard + the maintainer is the only merger".

## 3. The batch protocol

Every contributor change is an **improvement batch**: one functional seam, bounded
in advance, reviewable in one sitting.

**Branch:** `batch-NN-<slug>` (for example `batch-09-river-bridges`). The number
encodes the batch; CI reads it from the branch name.

**Brief:** `docs/briefs/batch-NN-<slug>.md`, built from
[`docs/briefs/_TEMPLATE.md`](briefs/_TEMPLATE.md), plus a machine-readable scope
lock:

```yaml
batch: 09
title: River and bridges
owner: contributor
paths:                       # the only paths this batch may touch
  - packages/map-generator/src/**
  - maps/*.json
  - docs/briefs/batch-09-river-bridges.md
verify: pnpm --filter @x-yard/map-generator test && pnpm verify
```

**Rules of the batch:**

1. One seam. If a required change falls outside `paths`, stop and report — do not
   widen the scope.
2. No cross-cutting refactors, no dependency changes, no rule or number changes
   unless the batch says so and the maintainer approved it.
3. Generated fixtures ship with the generator change (`WRITE_MAPS=1
   pnpm --filter @x-yard/map-generator test`, commit `maps/*.json`).
4. `verify` must pass before the PR is opened.
5. The agent session starts from the batch: *"Read `AGENTS.md` and
   `docs/briefs/batch-NN-<slug>.md`. Touch only the paths in the scope lock. Run
   the verify command. If a required change falls outside the scope, stop and
   report."*

The maintainer may use batches for larger work, but is not bound by them.

## 4. CI gate

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull
request and on push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm test` — the full suite, every workspace
4. `pnpm build`
5. `pnpm check:docs` — links resolve, documented counts match reality
6. `node scripts/check-batch-scope.mjs` — fails a `batch-*` branch whose diff
   touches a path outside its scope lock. Skipped for non-batch branches.

The scope check is the enforcement that matters: an agent that wanders outside its
batch fails the PR mechanically, not in review.

## 5. Review checklist

The maintainer reviews the PR, not every line. Five checks:

1. **Scope** — the diff stays inside the batch's `paths` (CI enforces this; the
   review confirms intent).
2. **Green** — all CI checks pass.
3. **No silent rule changes** — no new number without a `PROVISIONAL_` constant,
   no dependency added to `game-core`, no withdrawn vocabulary.
4. **Evidence** — visual batches attach before/after screenshots **to the PR**
   (GitHub upload); they are never committed (see
   [`design/moodboard/README.md`](../design/moodboard/README.md)).
5. **Docs** — a decision record if a decision was made; `PROJECT_LOG.md` and
   `docs/status.md` untouched by the contributor.

Then the maintainer merges and writes the `PROJECT_LOG.md` entry.

## 6. What is shared and what stays local

**Shared (committed):** all code; committed map fixtures in `maps/`; governance
docs; mockup sources; [`CONTRIBUTING.md`](../CONTRIBUTING.md) and
[`docs/setup.md`](setup.md).

**Local (gitignored):** `node_modules/`, the pnpm store and cache, build output,
the screenshot tooling, every render (`.png` etc. under `design/` and
`maps/shots/`), and each developer's personal files — `AGENTS.local.md`,
`CLAUDE.local.md`, `docs/lessons.local.md`, `docs/notes.local.md`. The personal
files are addenda to the shared rules, never replacements; templates are
[`AGENTS.local.example.md`](../AGENTS.local.example.md) and
[`docs/lessons.local.example.md`](lessons.local.example.md).

---

## 7. Inventory of the collaboration layer

Everything below was added **for collaboration**. The "revert" column is what
removes it.

| Artifact | Purpose | Revert action |
| --- | --- | --- |
| GitHub collaborator (Write) | lets the contributor push branches | Settings → Collaborators → remove |
| `main` branch protection / ruleset | requires PR + checks for the contributor | Settings → Branches/Rules → delete the rule |
| Required status checks | makes CI blocking | included in the rule above |
| `.devcontainer/devcontainer.json` | pins Node + pnpm for reproducible Codespaces | delete (harmless to keep) |
| `.github/workflows/ci.yml` | runs the six checks | delete |
| `.github/pull_request_template.md` | asks for batch id + evidence | delete |
| `scripts/check-batch-scope.mjs` | enforces the scope lock | delete; nothing else calls it |
| `CONTRIBUTING.md`, `docs/setup.md` | contributor entry point + setup guide | keep (harmless project docs) |
| `AGENTS.local.example.md`, `docs/lessons.local.example.md` | personal-file templates | keep (harmless) |
| `package.json` → `packageManager`, `.editorconfig` | pinned pnpm, consistent whitespace | keep (harmless) |
| `.gitignore` additions | personal files, renders, local scripts | keep (harmless) |
| this file | the record + revert map | mark `Status: retired`; do not delete |

## 8. Revert to solo contributor

Use when the contributor goes inactive and the maintainer resumes as sole
contributor. Reverting removes the **restrictions**, not the record.

**Step 1 — GitHub settings (no commit):**

1. Remove the collaborator (Settings → Collaborators and teams).
2. Delete the `main` ruleset / branch-protection rule, or at minimum remove the
   required status checks and the contributor's push restriction.

**Step 2 — repository artifacts (one commit):**

```bash
git rm .github/workflows/ci.yml
git rm .github/pull_request_template.md
git rm scripts/check-batch-scope.mjs
git rm -r .devcontainer        # optional; keep for the pinned toolchain
git commit -m "chore: retire collaboration layer (contributor inactive)"
```

**Step 3 — keep these (harmless, and some are useful solo):**

- `CONTRIBUTING.md`, `docs/setup.md`, the `*.local.example.md` templates, the
  `packageManager` pin, `.editorconfig`, the `.gitignore` additions, and
  [`LICENSE`](../LICENSE) — none of them restrict the maintainer.
- This file: mark `Status: retired` at the top rather than deleting it.

**Step 4 — verify nothing dangles:**

```bash
pnpm verify && pnpm test && pnpm check:docs
grep -rn "check-batch-scope\|collaboration.md" --include=*.md --include=*.yml --include=*.mjs .
```

If this file is linked from [`README.md`](../README.md) or
[`AGENTS.md`](../AGENTS.md), remove that link in the same revert commit.

**Step 5 — record it:** append a `PROJECT_LOG.md` entry stating the layer was
retired and why. Do not edit the entry that introduced it.

## 9. Re-enabling later

Nothing is destroyed by reverting, so re-enabling is a checkout, not a rewrite:

```bash
git checkout <commit-before-revert> -- .github .devcontainer scripts/check-batch-scope.mjs
```

Then re-add the collaborator and recreate the branch rule.

## 10. What must **not** be reverted

These predate the collaboration layer and are the project's own rules. Removing
them to "go back to solo" would damage the project, not simplify it:

- the three non-negotiables in [`AGENTS.md`](../AGENTS.md) — full `pnpm test`,
  zero-dependency `game-core`, TypeScript strict;
- [`AGENT_RULES.md`](../AGENT_RULES.md) and [`TESTING_STRATEGY.md`](../TESTING_STRATEGY.md);
- the append-only [`PROJECT_LOG.md`](../PROJECT_LOG.md) and in-place
  [`docs/status.md`](status.md);
- [`docs/decisions/`](decisions/README.md) and [`docs/lessons.md`](lessons.md);
- [`LICENSE`](../LICENSE) — a project decision (proprietary, source-available),
  independent of collaboration;
- the `PROVISIONAL_` convention and the guards in
  [`packages/game-core/src/spec-alignment.test.ts`](../packages/game-core/src/spec-alignment.test.ts)
  and [`architecture.test.ts`](../packages/game-core/src/architecture.test.ts).
