/**
 * Procedural city decoration for the prototype.
 *
 * This is a pure data pass over the generated map: blocks become building
 * footprints, parks become trees, and every decision is seeded by the block id
 * and the map seed. The renderer only draws what this returns, so the city is a
 * view of the map model, not a hand-painted plate.
 *
 * @module apps/web/prototype/city
 */

import type { BlockModel, GeneratedMap, MapPoint } from '@x-yard/map-generator';

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type RoofMaterial =
  | 'clay'
  | 'terracotta'
  | 'ochre'
  | 'slate'
  | 'copper'
  | 'gravel'
  | 'glass';

export interface RoofStyle {
  readonly roof: string;
  readonly edge: string;
  readonly ridge: string;
}

export const ROOF_STYLES: Readonly<Record<RoofMaterial, RoofStyle>> = {
  clay: { roof: '#c26a4a', edge: '#984b32', ridge: '#a5553a' },
  terracotta: { roof: '#b85b3e', edge: '#8c432b', ridge: '#9c4a33' },
  ochre: { roof: '#c7954c', edge: '#a07234', ridge: '#b3833f' },
  slate: { roof: '#7f8c94', edge: '#5e6a72', ridge: '#6d7880' },
  copper: { roof: '#5c9a84', edge: '#3f7462', ridge: '#4d8470' },
  gravel: { roof: '#b7a98f', edge: '#95876d', ridge: '#a6977e' },
  glass: { roof: '#9cc4d4', edge: '#749cac', ridge: '#86adc0' },
};

export const WALL_COLOURS = ['#e8d6b8', '#dfc9a8', '#d4bd9c', '#efe1c7'] as const;

export interface Building {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly lift: number;
  readonly wall: string;
  readonly material: RoofMaterial;
  readonly windows: number;
  readonly chimney: boolean;
}

export interface Tree {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export function blockBounds(block: BlockModel): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of block.polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/*
 * Weighted toward the warm clay/slate palette of the approved F reference.
 * Copper and glass are accents, not the majority; a uniform pick made the city
 * read as a colour chart rather than a quarter.
 */
const MATERIALS: readonly RoofMaterial[] = [
  'clay',
  'clay',
  'clay',
  'terracotta',
  'terracotta',
  'ochre',
  'slate',
  'slate',
  'gravel',
  'gravel',
  'copper',
  'glass',
];

/** Split one block into a handful of building footprints. */
function buildingsForBlock(block: BlockModel, seed: number): readonly Building[] {
  const bounds = blockBounds(block);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 16 || height < 16) return [];

  const random = makeRandom(hashString(block.id) ^ seed);
  const cols = width > 132 ? 3 : 2;
  const rows = height > 112 ? 3 : 2;
  const gap = 4;
  const cellWidth = (width - 8 - gap * (cols - 1)) / cols;
  const cellHeight = (height - 8 - gap * (rows - 1)) / rows;

  const buildings: Building[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (random() < 0.16) continue;

      const inset = 1 + random() * 1.8;
      const x = bounds.minX + 4 + col * (cellWidth + gap) + inset;
      const y = bounds.minY + 4 + row * (cellHeight + gap) + inset;
      const w = Math.max(5, cellWidth - inset * 2);
      const h = Math.max(5, cellHeight - inset * 2);

      const lift = 5 + random() * Math.min(13, h * 0.45);
      const material = MATERIALS[Math.floor(random() * MATERIALS.length)] ?? 'clay';
      const wall = WALL_COLOURS[Math.floor(random() * WALL_COLOURS.length)] ?? '#e8d6b8';

      buildings.push({
        key: `${block.id}-${row}-${col}`,
        x,
        y,
        w,
        h,
        lift,
        wall,
        material,
        windows: lift > 8 ? 2 + Math.floor(random() * 2) : 1,
        chimney: random() < 0.55,
      });
    }
  }

  return buildings.sort((left, right) => left.y + left.h - (right.y + right.h));
}

export function buildingsForMap(map: GeneratedMap): readonly Building[] {
  const landmarkBlocks = new Set(map.city.landmarks.map((landmark) => landmark.blockId));
  const buildings: Building[] = [];

  for (const block of map.city.blocks) {
    if (block.kind !== 'block' || landmarkBlocks.has(block.id)) continue;
    buildings.push(...buildingsForBlock(block, map.seed));
  }

  return buildings.sort((left, right) => left.y + left.h - (right.y + right.h));
}

/** Trees in parks and a few along the block edges. */
export function treesForMap(map: GeneratedMap): readonly Tree[] {
  const trees: Tree[] = [];

  for (const block of map.city.blocks) {
    const random = makeRandom(hashString(`trees-${block.id}`) ^ map.seed);
    if (block.kind === 'park') {
      const bounds = blockBounds(block);
      const count = 5 + Math.floor(random() * 5);
      for (let index = 0; index < count; index += 1) {
        trees.push({
          key: `${block.id}-tree-${index}`,
          x: bounds.minX + 7 + random() * Math.max(1, bounds.maxX - bounds.minX - 14),
          y: bounds.minY + 7 + random() * Math.max(1, bounds.maxY - bounds.minY - 14),
          r: 3.5 + random() * 3,
        });
      }
      continue;
    }

    if (random() < 0.14) {
      const bounds = blockBounds(block);
      trees.push({
        key: `${block.id}-street-tree`,
        x: bounds.minX + random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + random() * (bounds.maxY - bounds.minY),
        r: 3 + random() * 2,
      });
    }
  }

  return trees;
}

/** A path string for a polyline. */
export function pathData(points: readonly MapPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}
