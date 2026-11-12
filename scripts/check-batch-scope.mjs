#!/usr/bin/env node
/**
 * check-batch-scope.mjs — enforce a batch's scope lock.
 *
 * For a contributor branch named `batch-NN-<slug>`, this loads the brief
 * `docs/briefs/batch-NN-<slug>.md`, reads its `paths:` scope lock (a fenced
 * yaml block), and fails if the branch's diff against the base branch touches
 * any file outside the lock. Non-batch branches (and `main`) exit 0.
 *
 * The scope lock is the mechanical half of the contribution rule: an agent that
 * wanders outside its batch fails here, not in review.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BRANCH = process.env.BRANCH ?? '';
const BASE = process.env.BASE_REF ?? 'main';

const match = /^batch-(\d+)-([a-z0-9-]+)$/.exec(BRANCH);
if (!match) {
  console.log(`check-batch-scope: branch "${BRANCH || '(unknown)'}" is not a batch branch — skipping`);
  process.exit(0);
}

const brief = `docs/briefs/batch-${match[1]}-${match[2]}.md`;
if (!existsSync(brief)) {
  console.error(`check-batch-scope: branch ${BRANCH} but no brief found at ${brief}`);
  process.exit(1);
}

const source = readFileSync(brief, 'utf8');
const yaml = /```ya?ml\n([\s\S]*?)\n```/.exec(source)?.[1] ?? '';
const pathsBlock = /^paths:\s*\n((?:\s+-\s+.+\n?)+)/m.exec(yaml);

if (!pathsBlock) {
  console.error(`check-batch-scope: no "paths:" scope lock found in ${brief}`);
  process.exit(1);
}

const allowed = [...pathsBlock[1].matchAll(/^\s+-\s+(\S+)$/gm)].map((m) => m[1]);

function matchPath(pattern, file) {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${re}`).test(file);
}

let changed;
try {
  changed = execFileSync('git', ['diff', '--name-only', `origin/${BASE}...HEAD`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
} catch (err) {
  console.error(`check-batch-scope: could not diff against origin/${BASE} — ${err.message}`);
  process.exit(1);
}

// The contributor may always touch the briefs/decisions docs; everything else
// must be inside the scope lock.
const alwaysAllowed = ['docs/briefs/', 'docs/decisions/'];
const outside = changed.filter(
  (file) => !alwaysAllowed.some((p) => file.startsWith(p)) && !allowed.some((p) => matchPath(p, file)),
);

if (outside.length > 0) {
  console.error(`check-batch-scope: ${outside.length} file(s) outside the scope lock of ${brief}:`);
  for (const file of outside) console.error(`  - ${file}`);
  console.error(`Allowed: ${allowed.join(', ')}`);
  process.exit(1);
}

console.log(
  `check-batch-scope: ${changed.length} changed file(s), all within the scope lock of ${brief} ✓`,
);
