#!/usr/bin/env node
/**
 * check-docs.mjs — mechanical checks over the governance documents.
 *
 * Three classes of rot are caught here, all of which had already happened in this
 * repository before this script existed:
 *
 *   1. **Dead relative links.** A document promises a file (a mockup, a brief, a
 *      decision record) that does not exist.
 *   2. **Stale test counts.** A document asserts "N test files, M tests" and the
 *      suite has since grown, so the claim silently becomes false. The authority
 *      is Vitest's own machine-readable report, never a hand count.
 *   3. **Dangling section references.** `GAME_VISION.md §8` pointed at a section
 *      that no longer existed after the brief was replaced wholesale.
 *
 * Run with `pnpm check:docs` from the repository root. Exits non-zero on any
 * failure.
 *
 * The test counts come from `.vitest-report.json` (written by `pnpm test:report`
 * via the root `vitest.config.ts`). If that file is missing, this script refreshes
 * it by running the suite — it never guesses.
 *
 * Scope: repository markdown only. `node_modules`, `.git`, and every git-ignored
 * tooling directory are skipped. `design/**` is fully in scope: a broken link in
 * an exploration README still costs the director a wasted click.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPORT = join(ROOT, '.vitest-report.json');

/** Directories never walked. */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.tools',
  '.apt',
  '.playwright-browsers',
  '.chromium-libs',
  '.pnpm-store',
  '.pnpm-cache',
  'dist',
  'coverage',
]);

/**
 * Files exempt from the *claim* checks (documented counts and `GAME_VISION.md §N`
 * references). `PROJECT_LOG.md` is append-only by rule: an old entry stating
 * "4 test files, 83 tests", or quoting a section number that later disappeared,
 * was true when written and must not be corrected in place. A *current* claim in
 * a living document is checked normally, and link checking always applies — a
 * dead link is broken today regardless of when it was written.
 */
const HISTORICAL = new Set(['PROJECT_LOG.md']);

/** Collect every markdown file under `dir`. */
function markdownFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...markdownFiles(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const failures = [];

// ---------------------------------------------------------------- link checks

/**
 * Markdown inline links `[text](target)`, excluding images `![...]`. A target
 * that is external, an anchor, or a template placeholder is not a file link and
 * is skipped.
 */
const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;

function isExternal(target) {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(target) || // http:, https:, mailto:, data:
    target.startsWith('//') ||
    target.startsWith('#') ||
    target.includes('{{') ||
    target.includes('<') ||
    target.trim() === ''
  );
}

function checkLinks(file, source) {
  const dir = dirname(file);
  for (const match of source.matchAll(LINK_RE)) {
    let target = match[1].trim();
    if (isExternal(target)) continue;

    // strip an optional "title" and any trailing anchor
    target = target.replace(/\s+"[^"]*"$/, '').split('#')[0];
    if (target === '') continue;

    const resolved = target.startsWith('/')
      ? join(ROOT, target)
      : resolve(dir, decodeURIComponent(target));

    if (!resolved.startsWith(ROOT)) {
      failures.push(`${relative(ROOT, file)}: link escapes the repository → ${target}`);
      continue;
    }

    if (!existsSync(resolved)) {
      failures.push(`${relative(ROOT, file)}: dead link → ${target}`);
    }
  }
}

// --------------------------------------------------------------- count checks

/** Read the Vitest report, refreshing it from a real run if absent. */
function testCounts() {
  /**
   * The report must be *current*, not merely present. A report predating a test
   * edit would let a document claim a count that the suite has already outgrown —
   * exactly the drift this check exists to catch. So treat a report older than any
   * test file as absent.
   */
  const newestTestFile = (() => {
    let newest = 0;
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          walk(join(dir, entry.name));
        } else if (entry.name.endsWith('.test.ts')) {
          newest = Math.max(newest, statSync(join(dir, entry.name)).mtimeMs);
        }
      }
    };
    walk(ROOT);
    return newest;
  })();

  const reportIsCurrent =
    existsSync(REPORT) && statSync(REPORT).mtimeMs >= newestTestFile;

  if (!reportIsCurrent) {
    console.log(
      existsSync(REPORT)
        ? 'check-docs: .vitest-report.json is older than a test file — re-running the suite…'
        : 'check-docs: no .vitest-report.json — running the suite to obtain one…',
    );
    // Invoke the local vitest binary directly rather than via `npx`/`pnpm exec`:
    // no shell, no npm config warnings, and no dependency on a package manager
    // being on PATH.
    const vitest = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
    try {
      execFileSync(
        process.execPath,
        [vitest, 'run', '--reporter=json', `--outputFile=${REPORT}`],
        { cwd: ROOT, stdio: 'inherit' },
      );
    } catch {
      // A failing suite still writes a report; fall through and use it so the
      // failure is reported as a test problem, not a missing-report problem.
    }
  }

  if (!existsSync(REPORT)) {
    failures.push(
      'could not obtain .vitest-report.json — run `pnpm test:report` before `pnpm check:docs`',
    );
    return null;
  }

  const report = JSON.parse(readFileSync(REPORT, 'utf8'));
  const perFile = new Map();
  for (const result of report.testResults ?? []) {
    perFile.set(relative(ROOT, result.name).replaceAll('\\', '/'), result.assertionResults?.length ?? 0);
  }
  return { files: perFile.size, tests: report.numTotalTests ?? 0, perFile };
}

/**
 * `N test files, M tests` — the phrasing used across the governance docs. The
 * optional per-file form `name.test.ts (K tests)` is checked too, because
 * TESTING_STRATEGY.md enumerates suites that way and those numbers rot fastest.
 */
function checkCounts(file, source, counts) {
  const rel = relative(ROOT, file);
  if (HISTORICAL.has(rel)) return;

  const claimRe = /(\d+)\s+test files?,?\s+(?:and\s+)?(\d+)\s+tests?\b/gi;
  for (const match of source.matchAll(claimRe)) {
    const claimedFiles = Number(match[1]);
    const claimedTests = Number(match[2]);
    if (claimedFiles !== counts.files || claimedTests !== counts.tests) {
      failures.push(
        `${rel}: stale test count — claims ${claimedFiles} files / ${claimedTests} tests, ` +
          `actual is ${counts.files} files / ${counts.tests} tests`,
      );
    }
  }

  const perFileRe = /([\w.-]+\.test\.ts)\s*\((\d+)\s+tests?\)/g;
  for (const match of source.matchAll(perFileRe)) {
    const name = match[1];
    const claimed = Number(match[2]);
    const entry = [...counts.perFile.entries()].find(([path]) => path.endsWith('/' + name));
    if (entry === undefined) {
      failures.push(`${rel}: names a suite that does not exist — ${name}`);
    } else if (entry[1] !== claimed) {
      failures.push(
        `${rel}: stale suite size — ${name} claims ${claimed} tests, actual is ${entry[1]}`,
      );
    }
  }
}

// ------------------------------------------------------------------- §-refs

/**
 * `GAME_VISION.md §N` cross-references must name a section that exists. Section
 * numbers are unenforceable pointers that rot when a document is replaced
 * wholesale — which is exactly what happened here, leaving citations of a "§8"
 * the brief no longer had.
 */
const VISION_REF_RE = /GAME_VISION\.md\s+§(\d+)/g;

function checkVisionRefs(file, source) {
  if (HISTORICAL.has(relative(ROOT, file))) return;
  const vision = readFileSync(join(ROOT, 'GAME_VISION.md'), 'utf8');
  const sections = new Set(
    [...vision.matchAll(/^##\s+(\d+)\./gm)].map((match) => Number(match[1])),
  );
  for (const match of source.matchAll(VISION_REF_RE)) {
    const section = Number(match[1]);
    if (!sections.has(section)) {
      failures.push(
        `${relative(ROOT, file)}: GAME_VISION.md §${section} does not exist ` +
          `(brief has §${[...sections].sort((a, b) => a - b).join(', §')})`,
      );
    }
  }
}

// ------------------------------------------------------- archive convention

/**
 * Every directory under `archive/` must contain a `WHY_SUPERSEDED.md`. An
 * archived approach without a recorded reason is a deletion with extra steps: a
 * later session cannot tell what it was or whether it can be revived.
 *
 * This is what makes the cleanup convention automatic instead of aspirational —
 * forgetting the reason file fails the gate rather than quietly degrading the
 * archive into a graveyard.
 */
function checkArchiveReasonFiles() {
  const archiveDir = join(ROOT, 'archive');
  if (!existsSync(archiveDir)) return;

  for (const entry of readdirSync(archiveDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const reason = join(archiveDir, entry.name, 'WHY_SUPERSEDED.md');
    if (!existsSync(reason)) {
      failures.push(
        `archive/${entry.name}/: missing WHY_SUPERSEDED.md — an archived approach must record ` +
          `what it was, why it was replaced, and what was carried forward`,
      );
    }
  }
}

// ---------------------------------------------------------------------- main

const counts = testCounts();
const files = markdownFiles(ROOT).sort();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  checkLinks(file, source);
  if (counts !== null) checkCounts(file, source, counts);
  checkVisionRefs(file, source);
}

checkArchiveReasonFiles();

if (counts !== null) {
  console.log(
    `check-docs: scanned ${files.length} markdown files; suite is ` +
      `${counts.files} test files / ${counts.tests} tests (from Vitest)`,
  );
}

if (failures.length > 0) {
  console.error(`\ncheck-docs: ${failures.length} problem(s):\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('\nFix the document (or the code) so the claim is true again.');
  process.exit(1);
}

console.log('check-docs: all links resolve, documented counts are current ✅');
