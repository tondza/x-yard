# X-Yard — environment setup

A step-by-step guide for a new contributor. It assumes you may be unfamiliar with
Node, pnpm, or Codespaces, and that an AI agent is helping run the commands.

The goal: from nothing to a running game and a green `pnpm test` in one sitting.

## 0. What you need

- A GitHub account with access to the repository.
- A browser.
- Nothing else — the toolchain is installed for you or pinned by the repo.

## 1. Open the repository

**Recommended: GitHub Codespaces.** On the repository page: **Code → Codespaces →
Create codespace on `main`**. A dev container installs Node and pnpm and runs the
first install automatically.

**Alternative: clone locally.**

```bash
git clone https://github.com/tondza/x-yard
cd x-yard
```

## 2. Install the toolchain

The project needs **Node ≥ 20.19** and **pnpm 12.x**.

- Codespaces (dev container): already handled.
- Local, via Corepack:

```bash
corepack enable          # activates the pnpm version pinned in package.json
pnpm --version           # 12.3.4
node --version           # ≥ 20.19
```

## 3. Install dependencies

```bash
pnpm install
```

This must exit 0. If it fails with `ERR_PNPM_IGNORED_BUILDS`, the esbuild
allow-list in `pnpm-workspace.yaml` is missing — see
[`docs/lessons.md`](lessons.md) (L2).

## 4. Confirm the project is healthy

```bash
pnpm typecheck   # tsc --noEmit, every workspace
pnpm test        # the full suite — this is the gate
pnpm build       # production build
pnpm check:docs  # links resolve and documented counts are current
```

`pnpm test` should report **7 test files / 149 tests**, all passing. If anything
is red *before* you have touched anything, stop and tell the maintainer — do not
"fix" it as your first act.

## 5. Run the game

```bash
pnpm --filter @x-yard/web dev
```

In Codespaces, open forwarded port **5173**:

```text
https://<CODESPACE_NAME>-5173.app.github.dev/
```

You should see the 96-station prototype with a side chooser. `?lab` opens the
seeded map lab; `?board` opens the old server-backed scaffold.

## 6. Set up your AI agent

The repository is designed to be driven by an agent. Point yours at the entry
files and it will pick up the project's rules automatically:

- **Claude Code:** run `claude` in the repo; it auto-reads `AGENTS.md`. Personal
  instructions go in `AGENTS.local.md` (gitignored).
- **Any agent:** start with — *"Read `AGENTS.md`, then `CONTRIBUTING.md`. I am a
  contributor, not the maintainer."*

Two standing instructions for your agent:

- **Do not run `git push`** — you open the pull request.
- **Do not edit `PROJECT_LOG.md` or `docs/status.md`** — those are the maintainer's.

## 7. Your personal files

The repo has shared rules (committed) and a place for your own (not committed):

| File | Committed? | Purpose |
| --- | --- | --- |
| `AGENTS.md`, `AGENT_RULES.md`, … | yes | shared rules |
| `AGENTS.local.md` | no | your personal agent instructions |
| `docs/lessons.local.md` | no | your personal lessons learned |

Copy the templates `AGENTS.local.example.md` and `docs/lessons.local.example.md`
as your starting point. They are addenda, not replacements.

## 8. Troubleshooting

- **`pnpm install` fails with a read-only `$HOME` (EROFS):** this happens only in
  the maintainer's sandbox, which redirects the pnpm store into the repo via
  `.npmrc`. A normal Codespace has a writable home; the redirect is harmless there
  and must not be removed.
- **Port 5173 won't open:** make sure the dev server is running and the port is
  forwarded in the Codespaces Ports panel.
- **Screenshots:** not needed for code changes. Visual evidence goes in the pull
  request, not the repository (see [`design/moodboard/README.md`](../design/moodboard/README.md)).

## Next

Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the workflow, then pick a batch
with the maintainer.
