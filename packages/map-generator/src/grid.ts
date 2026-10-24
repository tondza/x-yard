/**
 * Stage 1 — the city skeleton.
 *
 * A jittered street lattice is enough to author a real transit network on top
 * of: stations sit on intersections, taxi and bus paths reuse the street
 * polylines, and blocks give the lab something to draw. Deliberately schematic;
 * buildings and roof detail belong to the presentation renderer.
 *
 * @module @x-yard/map-generator/grid
 */

import type { DistrictId, MapPoint } from '@x-yard/game-core';

import { createRng } from './rng';
import type { Rng } from './rng';
import type { BlockModel, CityModel, CityStreet, LandmarkModel, MapOptions, ResolvedMapOptions, StreetRank } from './types';

/** One street-lattice intersection. Stations are chosen from these. */
export interface Intersection {
  readonly id: string;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

/** A street edge between two adjacent intersections. */
export interface GridEdge {
  readonly id: string;
  readonly a: Intersection;
  readonly b: Intersection;
  readonly rank: StreetRank;
  readonly street: CityStreet;
}

/** The internal city build plus the indexes routing needs. */
export interface CityBuild {
  readonly params: ResolvedMapOptions;
  readonly intersections: readonly Intersection[];
  readonly gridEdges: readonly GridEdge[];
  readonly city: CityModel;
  readonly byId: ReadonlyMap<string, Intersection>;
  readonly adjacency: ReadonlyMap<string, readonly GridEdge[]>;
  readonly boulevardRows: readonly number[];
  readonly boulevardCols: readonly number[];
  readonly spacingX: number;
  readonly spacingY: number;
}

/** Resolve caller options into the shape stored on a generated map. */
export function resolveOptions(options: MapOptions = {}): ResolvedMapOptions {
  const targetNodes = options.targetNodes ?? 24;
  if (!Number.isInteger(targetNodes) || targetNodes < 8) {
    throw new RangeError(`targetNodes must be an integer >= 8, received ${String(targetNodes)}`);
  }

  /*
   * PROVISIONAL (Q7): the map has no ratified scale. Up to the 96-station
   * prototype the grid is pinned so seeds stay stable. Above that, derive a
   * grid with ~1.75 intersections per station; the previous fixed 12x14 grid was
   * a hard ceiling at 168 intersections and silently produced fewer stations
   * than requested.
   */
  const defaults =
    targetNodes <= 30
      ? { cols: 7, rows: 8 }
      : targetNodes <= 70
        ? { cols: 10, rows: 12 }
        : targetNodes <= 100
          ? { cols: 12, rows: 14 }
          : (() => {
              const intersections = Math.ceil(targetNodes * 1.75);
              const cols = Math.max(12, Math.ceil(Math.sqrt(intersections * 1.25)));
              const rows = Math.max(14, Math.ceil(intersections / cols));
              return { cols, rows };
            })();

  const startStrategy = options.startStrategy ?? 'farthest';
  if (startStrategy !== 'farthest' && startStrategy !== 'encircle') {
    throw new RangeError(`unknown start strategy: ${String(startStrategy)}`);
  }

  const agentCount = options.agentCount ?? 4;
  if (!Number.isInteger(agentCount) || agentCount < 1 || agentCount > 16) {
    throw new RangeError(`agentCount must be an integer in [1, 16], received ${String(agentCount)}`);
  }

  return {
    targetNodes,
    cols: options.cols ?? defaults.cols,
    rows: options.rows ?? defaults.rows,
    worldWidth: options.worldWidth ?? 1200,
    worldHeight: options.worldHeight ?? 900,
    startStrategy,
    agentCount,
  };
}

const PROVISIONAL_MARGIN = 80;
const PROVISIONAL_BLOCK_INSET = 10;
const PROVISIONAL_PARK_CHANCE = 0.07;

function districtFor(point: MapPoint, width: number, height: number): DistrictId {
  const west = point.x < width / 2;
  const north = point.y < height / 2;
  if (north) return west ? 'nw' : 'ne';
  return west ? 'sw' : 'se';
}

function midpoint(a: MapPoint, b: MapPoint): MapPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Build the street lattice, blocks and landmarks from a seed. */
export function buildCity(seed: number, options: MapOptions = {}): CityBuild {
  const params = resolveOptions(options);
  const rng = createRng(seed);
  const { cols, rows, worldWidth, worldHeight } = params;

  const margin = PROVISIONAL_MARGIN;
  const spacingX = (worldWidth - margin * 2) / (cols - 1);
  const spacingY = (worldHeight - margin * 2) / (rows - 1);

  const intersections: Intersection[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = margin + col * spacingX + rng.jitter(spacingX * 0.24);
      const y = margin + row * spacingY + rng.jitter(spacingY * 0.24);
      intersections.push({
        id: `i${row}-${col}`,
        col,
        row,
        x: Math.max(24, Math.min(worldWidth - 24, x)),
        y: Math.max(24, Math.min(worldHeight - 24, y)),
      });
    }
  }

  const byId = new Map(intersections.map((intersection) => [intersection.id, intersection]));
  const at = (row: number, col: number): Intersection => {
    const found = byId.get(`i${row}-${col}`);
    if (found === undefined) throw new Error(`missing intersection i${row}-${col}`);
    return found;
  };

  /*
   * PROVISIONAL (Q7): two boulevards each way, placed by fraction rather than
   * by seed so every map has a legible bus spine. Jitter lives in the
   * intersections, not in which streets are major.
   */
  const boulevardRows = [...new Set([Math.floor(rows * 0.28), Math.floor(rows * 0.68)])].filter(
    (row) => row >= 0 && row < rows,
  );
  const boulevardCols = [...new Set([Math.floor(cols * 0.3), Math.floor(cols * 0.7)])].filter(
    (col) => col >= 0 && col < cols,
  );

  const rankFor = (line: number, boulevards: readonly number[]): StreetRank => {
    if (boulevards.includes(line)) return 2;
    if (boulevards.some((boulevard) => Math.abs(boulevard - line) === 1)) return 1;
    return 0;
  };

  const gridEdges: GridEdge[] = [];

  const addEdge = (a: Intersection, b: Intersection, rank: StreetRank): void => {
    const middle = midpoint(a, b);
    // A small perpendicular bend stops the lattice reading as graph paper.
    const bend = rng.jitter(3.2);
    const bent: MapPoint =
      a.row === b.row
        ? { x: middle.x, y: middle.y + bend }
        : { x: middle.x + bend, y: middle.y };

    const street: CityStreet = {
      id: `st-${a.id}-${b.id}`,
      rank,
      path: [
        { x: a.x, y: a.y },
        bent,
        { x: b.x, y: b.y },
      ],
    };

    gridEdges.push({ id: street.id, a, b, rank, street });
  };

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      addEdge(at(row, col), at(row, col + 1), rankFor(row, boulevardRows));
    }
  }
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      addEdge(at(row, col), at(row + 1, col), rankFor(col, boulevardCols));
    }
  }

  /*
   * Thin the lattice. A perfect grid is graph paper; removing a seeded 10% of
   * the lanes (never a boulevard) makes irregular blocks while a connectivity
   * check keeps every intersection reachable. This is still a schematic city,
   * not the final road graph, but it stops the generator reading as a mesh.
   */
  const activeEdges = thinStreets(gridEdges, intersections, rng);

  const adjacency = new Map<string, GridEdge[]>();
  for (const intersection of intersections) adjacency.set(intersection.id, []);
  for (const edge of activeEdges) {
    adjacency.get(edge.a.id)?.push(edge);
    adjacency.get(edge.b.id)?.push(edge);
  }

  const blocks: BlockModel[] = [];
  const landmarkBlocks: BlockModel[] = [];

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const topLeft = at(row, col);
      const topRight = at(row, col + 1);
      const bottomRight = at(row + 1, col + 1);
      const bottomLeft = at(row + 1, col);

      const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x) + PROVISIONAL_BLOCK_INSET;
      const maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x) - PROVISIONAL_BLOCK_INSET;
      const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y) + PROVISIONAL_BLOCK_INSET;
      const maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y) - PROVISIONAL_BLOCK_INSET;

      if (maxX - minX < 8 || maxY - minY < 8) continue;

      const polygon: readonly MapPoint[] = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      const centroid = midpoint(polygon[0] as MapPoint, polygon[2] as MapPoint);

      const kind = rng.chance(PROVISIONAL_PARK_CHANCE) ? 'park' : 'block';
      const block: BlockModel = {
        id: `b${row}-${col}`,
        district: districtFor(centroid, worldWidth, worldHeight),
        kind,
        polygon,
      };
      blocks.push(block);
      if (kind === 'block') landmarkBlocks.push(block);
    }
  }

  const landmarkSpecs: readonly {
    kind: LandmarkModel['kind'];
    label: string;
    fraction: MapPoint;
  }[] = [
    { kind: 'station', label: 'Central Station', fraction: { x: 0.5, y: 0.5 } },
    { kind: 'cathedral', label: 'Cathedral', fraction: { x: 0.25, y: 0.3 } },
    { kind: 'market', label: 'Market Hall', fraction: { x: 0.72, y: 0.62 } },
    { kind: 'square', label: 'Old Square', fraction: { x: 0.5, y: 0.24 } },
  ];

  const landmarks: LandmarkModel[] = [];
  const usedBlocks = new Set<string>();

  for (const spec of landmarkSpecs) {
    const target = { x: worldWidth * spec.fraction.x, y: worldHeight * spec.fraction.y };
    let best: BlockModel | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const block of landmarkBlocks) {
      if (usedBlocks.has(block.id)) continue;
      const centre = blockCentre(block);
      const d = distance(centre, target);
      if (d < bestDistance) {
        best = block;
        bestDistance = d;
      }
    }

    if (best === null) continue;
    usedBlocks.add(best.id);
    landmarks.push({
      id: `lm-${spec.kind}`,
      kind: spec.kind,
      label: spec.label,
      blockId: best.id,
      at: blockCentre(best),
    });
  }

  const city: CityModel = {
    streets: activeEdges.map((edge) => edge.street),
    blocks,
    landmarks,
  };

  return {
    params,
    intersections,
    gridEdges: activeEdges,
    city,
    byId,
    adjacency,
    boulevardRows,
    boulevardCols,
    spacingX,
    spacingY,
  };
}

/** Whether the remaining street edges still connect every intersection. */
function streetNetworkIsConnected(
  intersections: readonly Intersection[],
  edges: readonly GridEdge[],
): boolean {
  const first = intersections[0];
  if (first === undefined) return true;

  const adjacency = new Map<string, string[]>();
  for (const intersection of intersections) adjacency.set(intersection.id, []);
  for (const edge of edges) {
    adjacency.get(edge.a.id)?.push(edge.b.id);
    adjacency.get(edge.b.id)?.push(edge.a.id);
  }

  const seen = new Set<string>([first.id]);
  const queue: string[] = [first.id];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return seen.size === intersections.length;
}

/**
 * Remove a seeded share of ordinary lanes, never a boulevard, and never at the
 * cost of connectivity. The attempts cap keeps a pathological seed bounded.
 */
function thinStreets(
  edges: readonly GridEdge[],
  intersections: readonly Intersection[],
  rng: Rng,
): readonly GridEdge[] {
  const active = [...edges];
  const target = Math.round(edges.length * 0.1);
  let removed = 0;
  let attempts = 0;

  while (removed < target && attempts < 300 && active.length > 0) {
    attempts += 1;
    const index = rng.int(active.length);
    const edge = active[index];
    if (edge === undefined || edge.rank !== 0) continue;

    active.splice(index, 1);
    if (streetNetworkIsConnected(intersections, active)) {
      removed += 1;
    } else {
      active.splice(index, 0, edge);
    }
  }

  return active;
}

/** The centre of a rectangular block. */
export function blockCentre(block: BlockModel): MapPoint {
  const first = block.polygon[0] as MapPoint;
  const opposite = block.polygon[2] as MapPoint;
  return { x: (first.x + opposite.x) / 2, y: (first.y + opposite.y) / 2 };
}

/** A short, stable seed derivation for retry attempts. */
export function deriveSeed(seed: number, attempt: number): number {
  if (attempt === 0) return seed;
  // Golden-ratio stepping keeps nearby attempts from producing similar layouts.
  return (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
}
