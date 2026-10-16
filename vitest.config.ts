import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration, shared by every workspace that runs `vitest`.
 *
 * Why this exists:
 *
 *   1. A **machine-readable report** at `.vitest-report.json` (git-ignored). It is
 *      the single source of truth for how many test files and tests actually
 *      exist, so `scripts/check-docs.mjs` can verify the counts the governance
 *      documents claim instead of trusting them. Before this, the documents said
 *      "4 test files, 83 tests" while the suite had grown to 5 files / 89 tests,
 *      and nothing noticed.
 *   2. A **consistent environment** across workspaces.
 *
 * `isolate` is deliberately NOT disabled here. Packages opt out individually in
 * their own `test` script (`--no-isolate`) after establishing that their suites
 * share no module-level state; see `packages/game-core/package.json`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: {
      json: '.vitest-report.json',
    },
  },
});
