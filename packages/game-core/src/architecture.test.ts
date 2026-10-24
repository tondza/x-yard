/**
 * Architecture invariants — the rules from AGENT_RULES.md §1–§3 and §6 that
 * matter too much to live only in prose.
 *
 * `spec-alignment.test.ts` locks the *design* (stated facts, the `PROVISIONAL_`
 * convention, withdrawn vocabulary). This file locks the *architecture*: the
 * purity of `game-core`, its zero-dependency contract, and the one-way
 * dependency arrow.
 *
 * Every forbidden pattern is checked against comment-stripped source, so prose
 * that *names* a banned API (as the module headers deliberately do) is not a
 * violation. Only executable code counts.
 *
 * @module @x-yard/game-core/architecture.test
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_DIR = join(SRC_DIR, '..');

/** Every `.ts` file under `src/`, recursively, tests included. */
function sourceFiles(dir: string = SRC_DIR): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...sourceFiles(join(dir, entry.name)));
    else if (entry.name.endsWith('.ts')) found.push(join(dir, entry.name));
  }
  return found;
}

function isTestFile(path: string): boolean {
  return path.endsWith('.test.ts');
}

/**
 * Strip block and line comments so a banned name mentioned in prose does not
 * register as a violation. Crude but sufficient: it removes comment spans
 * without trying to parse the file.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const ENGINE_FILES = (): string[] => sourceFiles().filter((path) => !isTestFile(path));

describe('game-core is dependency-free', () => {
  it('declares no runtime dependencies', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies ?? {}).toEqual({});
  });
});

describe('game-core imports nothing outside itself', () => {
  /**
   * Import specifiers that would break the "runs unmodified in a browser, in
   * Node, and in a test runner" contract, or the one-way dependency arrow.
   */
  const FORBIDDEN = [
    // the one-way arrow: shared-types imports from game-core, never the reverse
    { pattern: /from\s+['"]@x-yard\/shared-types['"]/, why: 'game-core must never import shared-types' },
    // frameworks and UI
    { pattern: /from\s+['"](react|react-dom|fastify|socket\.io|vite)['"]/, why: 'framework/UI dependency' },
    // Node built-ins, in both spellings
    { pattern: /from\s+['"]node:/, why: 'Node built-in' },
    { pattern: /(?:from|require\()\s*['"](?:fs|path|crypto|os|http|https|net|child_process|worker_threads)['"]/, why: 'Node built-in (bare specifier)' },
    // ambient Node globals
    { pattern: /\bprocess\.(?:env|argv|cwd)\b/, why: 'process access' },
  ];

  it('has no forbidden import or ambient Node access in engine source', () => {
    const violations: string[] = [];

    for (const path of ENGINE_FILES()) {
      const code = stripComments(readFileSync(path, 'utf8'));
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(code)) {
          violations.push(`${path.replace(PACKAGE_DIR, '.')}: ${why}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('game-core determinism: no banned nondeterminism sources', () => {
  /**
   * AGENT_RULES.md §6. Randomness comes only from the injected `RngState`;
   * wall-clock time may decide *when* something happens, never *what*.
   */
  const BANNED_IN_CODE = [
    { pattern: /\bMath\.random\b/, why: 'Math.random — use the injected RngState' },
    { pattern: /\bDate\.now\b/, why: 'Date.now — wall-clock time must not decide what happens' },
    { pattern: /\bperformance\.now\b/, why: 'performance.now' },
    { pattern: /\bnew Date\b/, why: 'new Date — Date is banned in state' },
    { pattern: /\brequire\s*\(/, why: 'require() — not available in a browser build' },
  ];

  it('uses none of the banned APIs in engine source', () => {
    const violations: string[] = [];

    for (const path of ENGINE_FILES()) {
      const code = stripComments(readFileSync(path, 'utf8'));
      for (const { pattern, why } of BANNED_IN_CODE) {
        if (pattern.test(code)) {
          violations.push(`${path.replace(PACKAGE_DIR, '.')}: ${why}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('imports the test runner from test files only', () => {
    // A src/ module that imports vitest would ship a tool dependency into the
    // engine the moment it is consumed as source.
    const offenders = ENGINE_FILES().filter((path) =>
      /from\s+['"]vitest['"]/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('deferred invariant: JSON-serializable state', () => {
  /**
   * AGENT_RULES.md §6 bans `Map`, `Set`, `Date`, class instances, functions, and
   * `undefined` *inside state*, so that `hashState` is unambiguous and a Yard
   * replays from its event log. `GameState` does not exist yet (see
   * docs/status.md).
   *
   * Note what is deliberately NOT asserted: `Map`/`Set` are used freely in
   * `graph.ts` for transient local computation (adjacency, seen-sets). That is
   * allowed and correct — the ban is on state, not on working memory. A blanket
   * "no Map in game-core" check would be a false invariant.
   *
   * When `GameState` lands, this suite must be replaced by the real check:
   * for a representative set of states, assert that
   * `JSON.parse(JSON.stringify(state))` deep-equals the original, and that
   * `hashState(replay(init, log)) === hashState(live)`.
   */
  it('has no GameState yet, so the serialization oracle is still owed', () => {
    const engineSource = ENGINE_FILES()
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(/interface GameState\b/.test(engineSource)).toBe(false);
  });
});
