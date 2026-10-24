import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateGraph, validateStreetGeometry } from '@x-yard/game-core';
import { describe, expect, it } from 'vitest';

import { generateMap } from './generate';
import type { GeneratedMap, MapOptions } from './types';

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));
const MAPS_DIR = fileURLToPath(new URL('../../../maps/', import.meta.url));

function metroIsConnected(map: GeneratedMap): boolean {
  const terminals = map.graph.nodes
    .filter((node) => node.class === 'terminal')
    .map((node) => node.id);
  if (terminals.length < 2) return true;

  const adjacency = new Map<string, string[]>(terminals.map((id) => [id, []]));
  for (const edge of map.graph.edges) {
    if (edge.mode !== 'underground') continue;
    adjacency.get(edge.a)?.push(edge.b);
    adjacency.get(edge.b)?.push(edge.a);
  }

  const first = terminals[0] as string;
  const seen = new Set<string>([first]);
  const queue: string[] = [first];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size === terminals.length;
}

function assertValid(map: GeneratedMap): void {
  const report = validateGraph(map.graph);
  const geometry = validateStreetGeometry(map.graph, map.city.streets);

  expect(report.errors).toEqual([]);
  expect(geometry.errors).toEqual([]);
  expect(map.validation.ok).toBe(true);
  expect(map.validation.errors).toEqual([]);

  expect(map.starts.agents).toHaveLength(map.params.agentCount);
  expect(new Set(map.starts.agents).size).toBe(map.params.agentCount);
  expect(map.starts.agents).not.toContain(map.starts.fugitive);
  expect(map.stats.startDistances).toHaveLength(map.params.agentCount);
  expect(Math.min(...map.stats.startDistances)).toBeGreaterThanOrEqual(3);
  if (map.params.startStrategy === 'encircle') {
    expect(Math.max(...map.stats.startDistances)).toBeLessThanOrEqual(5);
  }

  expect(report.warnings.join('\n')).not.toMatch(/taxi-only subgraph/);
  expect(map.stats.minDegree).toBeGreaterThanOrEqual(2);
  expect(map.facilities.blackMarket).not.toBe(map.facilities.safeHouse);

  for (const edge of map.graph.edges) {
    expect(edge.path, `${edge.id} has no path`).toBeDefined();
    expect(edge.path?.length ?? 0).toBeGreaterThanOrEqual(2);
  }

  const terminalCount = map.graph.nodes.filter((node) => node.class === 'terminal').length;
  expect(map.stats.byMode.taxi).toBeGreaterThan(0);
  expect(map.stats.byMode.bus).toBeGreaterThan(0);
  expect(map.stats.byMode.underground).toBeGreaterThan(0);
  expect(map.stats.byMode.special).toBeGreaterThan(0);

  // A metro network is connected (a tree of T-1 edges over the terminals), not
  // a set of disjoint chords. All lines share one interchange.
  expect(map.stats.byMode.underground).toBe(terminalCount - 1);
  expect(metroIsConnected(map)).toBe(true);

  const classById = new Map(map.graph.nodes.map((node) => [node.id, node.class]));
  for (const edge of map.graph.edges) {
    if (edge.mode === 'bus' || edge.mode === 'underground') {
      for (const endpoint of [edge.a, edge.b]) {
        expect(classById.get(endpoint), `${edge.id} touches a street node`).not.toBe('street');
      }
    }
    if (edge.mode === 'underground') {
      for (const endpoint of [edge.a, edge.b]) {
        expect(classById.get(endpoint), `${edge.id} must join two terminals`).toBe('terminal');
      }
    }
    if (edge.mode === 'special') {
      for (const endpoint of [edge.a, edge.b]) {
        expect(classById.get(endpoint), `${edge.id} must join street nodes`).toBe('street');
      }
    }
  }

  for (const facilityNode of [map.facilities.blackMarket, map.facilities.safeHouse]) {
    expect(classById.get(facilityNode)).toBe('street');
  }
}

function classMix(map: GeneratedMap): { street: number; hub: number; terminal: number } {
  const mix = { street: 0, hub: 0, terminal: 0 };
  for (const node of map.graph.nodes) mix[node.class] += 1;
  return mix;
}

describe('generateMap: 24-node prototype maps', () => {
  for (const seed of [1, 2, 3, 7, 42, 99]) {
    it(`produces a valid, connected network for seed ${seed}`, () => {
      const map = generateMap(seed, { targetNodes: 24 });
      assertValid(map);
      expect(map.stats.nodeCount).toBe(24);
      expect(classMix(map)).toEqual({ street: 16, hub: 6, terminal: 2 });
      expect(map.stats.byMode.taxi).toBeGreaterThan(0);
      expect(map.stats.byMode.bus).toBeGreaterThan(0);
      expect(map.stats.byMode.underground).toBeGreaterThan(0);
      expect(map.stats.byMode.special).toBeGreaterThan(0);
    });
  }
});

describe('generateMap: 60-node MVP-scale maps', () => {
  for (const seed of [1, 7, 42]) {
    it(`produces a valid, connected network for seed ${seed}`, () => {
      const map = generateMap(seed, { targetNodes: 60 });
      assertValid(map);
      expect(map.stats.nodeCount).toBe(60);
      expect(classMix(map)).toEqual({ street: 40, hub: 14, terminal: 6 });
    });
  }
});

describe('generateMap: the 96-station prototype scale', () => {
  it('scales the class mix with the station count', () => {
    const map = generateMap(42, { targetNodes: 96, startStrategy: 'encircle' });
    assertValid(map);
    expect(map.stats.nodeCount).toBe(96);
    expect(classMix(map)).toEqual({ street: 64, hub: 22, terminal: 10 });
  });

  it('places the requested number of Agents inside the encircle band', () => {
    const map = generateMap(42, {
      targetNodes: 96,
      startStrategy: 'encircle',
      agentCount: 6,
    });
    assertValid(map);
    expect(map.params.agentCount).toBe(6);
    expect(map.starts.agents).toHaveLength(6);
    expect(Math.max(...map.stats.startDistances)).toBeLessThanOrEqual(5);
  });
});

describe('determinism and serialization', () => {
  it('returns the same map for the same seed and options', () => {
    const first = generateMap(42, { targetNodes: 24 });
    const second = generateMap(42, { targetNodes: 24 });
    expect(second).toEqual(first);
  });

  it('returns a different map for a different seed', () => {
    const first = generateMap(42, { targetNodes: 24 });
    const second = generateMap(43, { targetNodes: 24 });
    expect(second.graph.nodes.map((node) => `${node.x},${node.y}`)).not.toEqual(
      first.graph.nodes.map((node) => `${node.x},${node.y}`),
    );
  });

  it('survives JSON.parse(JSON.stringify(...)) intact', () => {
    const map = generateMap(7, { targetNodes: 24 });
    expect(JSON.parse(JSON.stringify(map))).toEqual(map);
  });

  it('uses no banned nondeterminism or runtime imports in generator source', () => {
    const offenders: string[] = [];
    for (const name of readdirSync(SRC_DIR)) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
      const source = readFileSync(join(SRC_DIR, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      for (const banned of [
        /\bMath\.random\b/,
        /\bDate\.now\b/,
        /\bperformance\.now\b/,
        /from\s+['"]node:/,
        /from\s+['"]@x-yard\/shared-types['"]/,
        /from\s+['"](?:react|react-dom|fastify|socket\.io)['"]/,
      ]) {
        if (banned.test(source)) offenders.push(`${name}: ${banned.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Committed fixtures
 * ------------------------------------------------------------------ */

const FIXTURES: readonly { file: string; seed: number; options: MapOptions }[] = [
  { file: 'prototype-24-seed-42.json', seed: 42, options: { targetNodes: 24 } },
  { file: 'prototype-24-seed-7.json', seed: 7, options: { targetNodes: 24 } },
  { file: 'mvp-60-seed-42.json', seed: 42, options: { targetNodes: 60 } },
  { file: 'mvp-60-seed-7.json', seed: 7, options: { targetNodes: 60 } },
  {
    file: 'prototype-96-seed-42.json',
    seed: 42,
    options: { targetNodes: 96, startStrategy: 'encircle' },
  },
];

describe('committed map fixtures', () => {
  it('regenerate exactly from their stored seed and node count', () => {
    mkdirSync(MAPS_DIR, { recursive: true });

    for (const fixture of FIXTURES) {
      const path = join(MAPS_DIR, fixture.file);
      const generated = generateMap(fixture.seed, fixture.options);

      if (process.env.WRITE_MAPS === '1') {
        writeFileSync(path, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
      }

      if (!existsSync(path)) {
        throw new Error(`missing fixture ${fixture.file}; run WRITE_MAPS=1 pnpm --filter @x-yard/map-generator test`);
      }

      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
      expect(parsed).toEqual(generated);
    }
  });
});
