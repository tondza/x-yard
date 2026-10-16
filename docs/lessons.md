# docs/lessons.md — measured environment and tooling facts

Check here **before debugging** an environment or tooling failure. These are
measured facts about this machine and this repository, not preferences. Each
entry gives the symptom you will actually see, the cause, the fix, and where the
fix is enforced so it cannot be silently undone.

If a failure here is not covered, fix it, then **add an entry in the same change**
that fixed it. An entry that is not enforced by a file or a check will rot.

Last updated: 2026-10-16.

---

## L1 — `pnpm install` fails with `EROFS`

**Symptom.** Every install exits non-zero with `EROFS: read-only file system`,
naming a path under `$HOME`.

**Cause.** `$HOME` is read-only in this sandbox, and pnpm's default store and
cache live under it (`~/.local/share/pnpm`, `~/.cache/pnpm`).

**Fix.** `.npmrc` redirects `store-dir` and `cache-dir` inside the repository.
pnpm resolves the relative paths under `node_modules/`, which is already
git-ignored.

**Enforced by.** [`.npmrc`](../.npmrc). **Never remove it.**

---

## L2 — `pnpm install` exits non-zero with `ERR_PNPM_IGNORED_BUILDS`

**Symptom.** Install completes the resolution phase and then fails, naming a
package whose build script was blocked.

**Cause.** pnpm 12 blocks dependency build scripts by default. `esbuild` (pulled
in by both Vite and `tsx`) needs its postinstall to place its native binary.

**Fix.** Declarative allow-list in `pnpm-workspace.yaml`:
`allowBuilds: { esbuild: true }`.

**Note the key name.** pnpm 12 spells it `allowBuilds`; the older pnpm 10 spelling
is `onlyBuiltDependencies`.

**Enforced by.** [`pnpm-workspace.yaml`](../pnpm-workspace.yaml). Add an entry only
after establishing *why* that package must run code at install time.

---

## L3 — `/tmp` does not survive between commands

**Symptom.** A file written to `/tmp` in one shell invocation is missing in the
next; `mktemp` output vanishes.

**Cause.** `/tmp` is a **fresh tmpfs on every shell invocation**.

**Fix.** Never stage build output, caches, fixtures, or scratch files in `/tmp`.
Use a path inside the workspace. *(This was re-confirmed the hard way while
writing these docs — a stray `> /tmp/...` redirect failed with "Read-only file
system".)*

**Enforced by.** The workspace file sandbox; and the rule "the workspace is the
only durable writable location" in [`AGENT_RULES.md`](../AGENT_RULES.md) §7.

---

## L4 — `sudo`, `apt-get`, and system installs are impossible

**Symptom.** `sudo` fails even for a harmless command; `apt-get install` cannot
acquire anything.

**Cause.** There is no root. The DSH sandbox sets `NO_NEW_PRIVS`, which disables
the setuid bit, so privilege escalation cannot work at all.

**Fix.** Install toolchains **into the workspace**: Python venvs, a local
`npm install`, `cargo`/`go` builds. Do not plan a task around a system package.

**Enforced by.** The platform. See [`AGENT_RULES.md`](../AGENT_RULES.md) §7.

---

## L5 — Only the workspace is writable

**Symptom.** A write outside `/workspaces/x-yard` is denied; some paths are
read-only bind mounts.

**Cause.** The file policy in the runtime context (`workspace-write` by default).

**Fix.** Work inside the workspace. If a task genuinely needs wider access, say so
and let the approval flow decide — **do not route around a denial by another
mechanism.**

**Enforced by.** The DSH file sandbox.

---

## L6 — Chromium system libraries are absent (screenshot tooling)

**Symptom.** The screenshot script's browser fails to launch, reporting missing
shared objects.

**Cause.** Chromium's system libraries are not installed in this image and cannot
be installed without root (L4).

**Fix.** They are unpacked into `.chromium-libs/` and reached via
`LD_LIBRARY_PATH`, with browsers under `.playwright-browsers/`. Full invocation
is in [`design/moodboard/README.md`](../design/moodboard/README.md).

**Enforced by.** `.gitignore` keeps `.tools/`, `.playwright-browsers/`,
`.chromium-libs/`, and `.apt/` out of the repository; the tooling stays outside the
pnpm workspace so it cannot affect `pnpm test` or `pnpm build`.

---

## L7 — Playwright must not download into `$HOME`

**Symptom.** A future `pnpm test:e2e` install fails on a read-only `~/.cache`.

**Cause.** Playwright's default browser path is `~/.cache/ms-playwright` (L1).

**Fix.** Set `PLAYWRIGHT_BROWSERS_PATH` to a workspace path (e.g.
`/workspaces/x-yard/.playwright-browsers`) and keep browser tests on their own
`pnpm test:e2e` script so the mandated `pnpm test` stays a pure headless unit run.

**Enforced by.** Planned; recorded in [`TESTING_STRATEGY.md`](../TESTING_STRATEGY.md) §6.
