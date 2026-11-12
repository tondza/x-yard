# X-Yard — environment setup

A step-by-step guide for a new contributor. It assumes you may be unfamiliar with
Node, pnpm, or Codespaces, and that an AI agent is helping run the commands.

The goal: from nothing to a running game and a green `pnpm test` in one sitting.

## 0. What you need

- A GitHub account with access to the repository.
- A browser.
- Nothing else — the toolchain is installed for you or pinned by the repo.

## 1. Open the repository — create your own Codespace

The recommended path is GitHub Codespaces Cloud: an isolated Linux machine in the
cloud, created in your own GitHub account, with the toolchain already pinned.

1. **Accept the collaborator invite** from the repository owner (you need Write
   access to push branches).
2. Open <https://github.com/tondza/x-yard>.
3. Click the green **Code ▾** button, then the **Codespaces** tab.
4. Click **Create codespace on `main`** (or the **+** menu → *New with options* if
   you want to pick a machine size — the default 2-core is enough for this repo).
5. Wait for the container to build. The dev container
   ([`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json)) installs
   Node 22 and pnpm 12.3.4, then runs `pnpm install` automatically.
6. The Codespace opens as VS Code in the browser (or connect it to your desktop
   VS Code via the **>** menu → *Open in VS Code Desktop*).

Your Codespace is yours alone — anything you change or install lives in it, and it
is stopped and eventually deleted after ~30 days of inactivity (your work is safe
once pushed to a branch). You can create several, one per task if you like.

**Alternative: clone locally** (skip this if you used Codespaces):

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

The repository is designed to be driven by an agent: the agent reads `AGENTS.md`
and is routed to the right rule for the task. Any of these work inside your
Codespace; pick one.

### Claude Code (recommended)

Anthropic's terminal agent. Install it in the Codespace terminal:

```bash
npm install -g @anthropic-ai/claude-code
claude        # first run: sign in (GitHub or Claude account)
```

Then run it in the repo:

```bash
cd /workspaces/x-yard
claude
```

Claude Code reads `AGENTS.md` automatically, so it inherits the project's rules
without you explaining them. Start the first session with:

> Read `AGENTS.md`, then `CONTRIBUTING.md`. I am a contributor, not the
> maintainer. Work on branch `batch-NN-<slug>` and read that brief.

Personal instructions go in `AGENTS.local.md` (gitignored) — see §7.

### Deepseek Harness (DSH)

The harness the maintainer uses day-to-day; it runs the same agent workflow
through a web GUI.

1. Node is already installed by the dev container.
2. Install the harness globally:
   ```bash
   npm install -g @deepseek-ai/dsh
   ```
3. Start the web GUI:
   ```bash
   dsh web --no-open
   ```
   It serves on port **3080**.
4. In the Codespaces **Ports** panel, forward port **3080**, then open the
   forwarded URL (`https://<codespace>-3080.app.github.dev/`).
5. Sign in with your DeepSeek account when the GUI asks.

DSH also reads `AGENTS.md`, so the same shared rules apply. If you want the exact
same experience as the maintainer, use this.

### Cline (VS Code extension)

A plugin for VS Code (the editor your Codespace opens). Install it from the
marketplace (search **Cline**) inside your Codespace, add an API key for any model
(Claude, OpenAI, DeepSeek, or a local one), and drive it from the sidebar. Point
it at `AGENTS.md` the same way as above.

### Hermes Agent

A self-hosted / local agent runner. Install it per its own documentation, run it
inside the repo, and give it the same opening prompt. The project rules apply
regardless of which tool you choose.

### Two standing instructions for whichever agent you use

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
