/**
 * Procedural city decoration for the prototype.
 *
 * This is a pure data pass over the generated map: blocks become building
 * footprints, parks become trees, and every decision is seeded by the block id
 * and the map seed. The renderer only draws what this returns, so the city is a
 * view of the map model, not a hand-painted plate.
 *
 * House and roof variety live here, on purpose: they are *seeded presentation
 * decoration*, not map data. Landmark kinds are the opposite — they are map data
 * in `@x-yard/map-generator` and are never invented by drawing code. See
 * decision 0021.
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

/*
 * The Basic plate uses this flat list directly; the Vintage skin instead picks a
 * three-face palette from `VINTAGE.walls` by the same per-building hash. Both
 * are deliberately desaturated — the transit network stays the only saturated
 * layer.
 */
export const WALL_COLOURS = [
  '#e8d6b8',
  '#dfc9a8',
  '#d4bd9c',
  '#efe1c7',
  '#e3c5a8',
  '#d6c2a0',
  '#cbb48c',
  '#e6d8bd',
] as const;

/** The period house catalogue. Pitched types are deliberately the majority. */
export type HouseType =
  | 'terrace'
  | 'townhouse'
  | 'cottage'
  | 'mansion'
  | 'tenement'
  | 'warehouse'
  | 'shop';

/** Roof silhouettes the Canvas renderer can draw. */
export type RoofShape = 'gable' | 'hip' | 'mansard' | 'flat' | 'sawtooth';

/** Which footprint axis the roof ridge runs along. */
export type RidgeAxis = 'x' | 'y';

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
  /** Stable per-building hash: `hash(blockId + row + col) ^ map.seed`. */
  readonly hash: number;
  readonly type: HouseType;
  readonly roof: RoofShape;
  readonly ridge: RidgeAxis;
  /** Roof rise as a fraction of the shorter footprint edge. */
  readonly roofPitch: number;
  readonly dormers: number;
  readonly chimneyPots: number;
  /** Houses that share a continuous roofline carry the same run id. */
  readonly terraceRun: string;
  readonly runStart: boolean;
  readonly runEnd: boolean;
}

export interface Tree {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Period street furniture. Tiny, desaturated and never on a station. */
export type FurnitureKind = 'lamp' | 'cab' | 'railing' | 'bollard';

export interface Furniture {
  readonly key: string;
  readonly kind: FurnitureKind;
  readonly x: number;
  readonly y: number;
  /** Ground-plane angle in radians; railings use it as their long axis. */
  readonly angle: number;
  /** Lamps/cabs/bollards use a small size; railings use their span. */
  readonly size: number;
}

/*
 * PROVISIONAL: the brief names terraces, furniture and pitched roofs but gives
 * no visual measurements. These constants are the unratified defaults for the
 * 96-station quarter and are tuned by looking at that map, not by a design spec.
 */
const PROVISIONAL_HOUSE_GAP = 8.5;
const PROVISIONAL_HOUSE_MARGIN = 5;
const PROVISIONAL_HOUSE_INSET = 1.2;
const PROVISIONAL_HOUSE_INSET_RANGE = 2.4;
const PROVISIONAL_EMPTY_RUN_CHANCE = 0.22;
/* Houses in a terrace share a roofline but keep a visible alley between them. */
const PROVISIONAL_TERRACE_GAP = 6;
/* Footprint mix: one giant house, three narrow ones, or the usual pair. */
const PROVISIONAL_SINGLE_HOUSE_MIN_WIDTH = 70;
const PROVISIONAL_SINGLE_HOUSE_CHANCE = 0.12;
const PROVISIONAL_THREE_COLUMN_MIN_WIDTH = 55;
const PROVISIONAL_THREE_COLUMN_CHANCE = 0.5;
const PROVISIONAL_TWO_ROW_MIN_HEIGHT = 55;
const PROVISIONAL_TWO_ROW_CHANCE = 0.45;
/* Per-house width weights: 0.78–1.22 of the run average. */
const PROVISIONAL_WIDTH_JITTER_MIN = 0.78;
const PROVISIONAL_WIDTH_JITTER_RANGE = 0.44;
const PROVISIONAL_MIN_FOOTPRINT = 16;
const PROVISIONAL_MIN_HOUSE_SIDE = 5;
const PROVISIONAL_TRIPLE_RUN_CHANCE = 0.55;

/* Roof rise is a fraction of the shorter footprint edge. */
const ROOF_PITCH: Readonly<Record<HouseType, number>> = {
  terrace: 0.56,
  townhouse: 0.6,
  cottage: 0.8,
  mansion: 0.5,
  tenement: 0.04,
  warehouse: 0.36,
  shop: 0.04,
};

const HOUSE_DORMERS: Readonly<Record<HouseType, number>> = {
  terrace: 1,
  townhouse: 1,
  cottage: 1,
  mansion: 0,
  tenement: 0,
  warehouse: 0,
  shop: 0,
};

const HOUSE_CHIMNEYS: Readonly<Record<HouseType, number>> = {
  terrace: 2,
  townhouse: 2,
  cottage: 1,
  mansion: 3,
  tenement: 2,
  warehouse: 1,
  shop: 1,
};

const HOUSE_LIFT_BONUS: Readonly<Record<HouseType, number>> = {
  terrace: 0,
  townhouse: 1,
  cottage: -1,
  mansion: 4,
  tenement: 4,
  warehouse: 5,
  shop: -2,
};

/*
 * Weighted toward pitched roofs: 9 of these 14 entries are gable/hip houses.
 * Tenement, warehouse and shop are the minority flat/sawtooth types.
 */
const HOUSE_TYPES: readonly HouseType[] = [
  'terrace',
  'terrace',
  'terrace',
  'townhouse',
  'townhouse',
  'townhouse',
  'cottage',
  'cottage',
  'mansion',
  'tenement',
  'warehouse',
  'shop',
];

/** Types that make a convincing terraced run. */
const RUN_TYPES: readonly HouseType[] = ['terrace', 'terrace', 'townhouse', 'townhouse', 'cottage'];

function roofForHouse(type: HouseType, hash: number): RoofShape {
  switch (type) {
    case 'terrace':
      return 'gable';
    case 'townhouse':
      return hash % 3 === 0 ? 'hip' : 'gable';
    case 'cottage':
      return 'gable';
    case 'mansion':
      return 'hip';
    case 'tenement':
      return 'flat';
    case 'warehouse':
      return 'sawtooth';
    case 'shop':
      return 'flat';
    default:
      return 'gable';
  }
}

function windowsForHouse(type: HouseType, hash: number): number {
  switch (type) {
    case 'mansion':
      return 3;
    case 'tenement':
      return 3 + (hash % 2);
    case 'warehouse':
      return 2;
    case 'shop':
      return 2;
    default:
      return 2;
  }
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

/** `hash(blockId + row + col) ^ map.seed`, the building-variety contract. */
function buildingHash(key: string, seed: number): number {
  return (hashString(key) ^ seed) >>> 0;
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

interface TerraceRun {
  readonly start: number;
  readonly length: number;
}

/**
 * Partition a block row into terraced runs. Most rows become one long terrace
 * or a terrace plus a corner house, never a line of detached boxes.
 */
function terraceRuns(cols: number, random: () => number): readonly TerraceRun[] {
  const runs: TerraceRun[] = [];
  let start = 0;
  while (start < cols) {
    const remaining = cols - start;
    const length =
      remaining >= 3 && random() < PROVISIONAL_TRIPLE_RUN_CHANCE ? 3 : Math.min(2, remaining);
    runs.push({ start, length });
    start += length;
  }
  return runs;
}

function chimneyPotsFor(
  type: HouseType,
  isTerrace: boolean,
  runStart: boolean,
  runEnd: boolean,
  hash: number,
): number {
  const base = HOUSE_CHIMNEYS[type];
  if (!isTerrace) return base;
  // A terrace reads as one building: stacks belong on party walls and ends.
  if (runStart || runEnd) return Math.max(1, base - 1);
  return hash % 3 === 0 ? 1 : 0;
}

function makeBuilding(
  key: string,
  seed: number,
  type: HouseType,
  roof: RoofShape,
  isTerrace: boolean,
  terraceRun: string,
  runStart: boolean,
  runEnd: boolean,
  x: number,
  y: number,
  w: number,
  h: number,
  lift: number,
  ridge: RidgeAxis,
): Building {
  const hash = buildingHash(key, seed);
  const random = makeRandom(hash);
  const material = MATERIALS[Math.floor(random() * MATERIALS.length)] ?? 'clay';
  const wall = WALL_COLOURS[Math.floor(random() * WALL_COLOURS.length)] ?? '#e8d6b8';
  const dormerCount = HOUSE_DORMERS[type];
  const dormers = dormerCount === 0 ? 0 : 1 + (hash % dormerCount);
  const chimneyPots = chimneyPotsFor(type, isTerrace, runStart, runEnd, hash);
  const roofPitch = ROOF_PITCH[type];
  const windows = windowsForHouse(type, hash);

  return {
    key,
    x,
    y,
    w,
    h,
    lift,
    wall,
    material,
    windows,
    chimney: chimneyPots > 0,
    hash,
    type,
    roof,
    ridge,
    roofPitch,
    dormers,
    chimneyPots,
    terraceRun,
    runStart,
    runEnd,
  };
}

/** Split one block into terraced runs of building footprints. */
function buildingsForBlock(block: BlockModel, seed: number): readonly Building[] {
  const bounds = blockBounds(block);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < PROVISIONAL_MIN_FOOTPRINT || height < PROVISIONAL_MIN_FOOTPRINT) return [];

  const blockRandom = makeRandom(hashString(block.id) ^ seed);
  /*
   * Footprints are deliberately mixed. A fixed 2x2 split of a 74x37 block made
   * 28x9 houses — wide and shallow. Choose 1–3 columns and 1–2 rows from the
   * block seed, then vary each house's width and depth inside the run so some
   * read wide from the camera and some read narrow and deep.
   */
  const layoutRoll = blockRandom();
  const maxCols = Math.max(
    1,
    Math.floor(
      (width - PROVISIONAL_HOUSE_MARGIN * 2 + PROVISIONAL_HOUSE_GAP) /
        (PROVISIONAL_MIN_HOUSE_SIDE + PROVISIONAL_HOUSE_GAP),
    ),
  );
  const desiredCols =
    width > PROVISIONAL_SINGLE_HOUSE_MIN_WIDTH &&
    layoutRoll < PROVISIONAL_SINGLE_HOUSE_CHANCE
      ? 1
      : width > PROVISIONAL_THREE_COLUMN_MIN_WIDTH &&
          layoutRoll > PROVISIONAL_THREE_COLUMN_CHANCE
        ? 3
        : 2;
  const cols = Math.min(maxCols, desiredCols);
  const maxRows = Math.max(
    1,
    Math.floor(
      (height - PROVISIONAL_HOUSE_MARGIN * 2 + PROVISIONAL_HOUSE_GAP) /
        (PROVISIONAL_MIN_HOUSE_SIDE + PROVISIONAL_HOUSE_GAP),
    ),
  );
  const desiredRows =
    height > PROVISIONAL_TWO_ROW_MIN_HEIGHT && layoutRoll < PROVISIONAL_TWO_ROW_CHANCE ? 2 : 1;
  const rows = Math.min(maxRows, desiredRows);
  const cellWidth =
    (width - PROVISIONAL_HOUSE_MARGIN * 2 - PROVISIONAL_HOUSE_GAP * (cols - 1)) / cols;
  const cellHeight =
    (height - PROVISIONAL_HOUSE_MARGIN * 2 - PROVISIONAL_HOUSE_GAP * (rows - 1)) / rows;

  const buildings: Building[] = [];

  for (let row = 0; row < rows; row += 1) {
    const runs = terraceRuns(cols, blockRandom);

    for (const run of runs) {
      const runKey = `${block.id}-${row}-run${run.start}`;
      const runRandom = makeRandom(hashString(runKey) ^ seed);
      if (runRandom() < PROVISIONAL_EMPTY_RUN_CHANCE) continue;

      const inset = PROVISIONAL_HOUSE_INSET + runRandom() * PROVISIONAL_HOUSE_INSET_RANGE;
      const x0 =
        bounds.minX +
        PROVISIONAL_HOUSE_MARGIN +
        run.start * (cellWidth + PROVISIONAL_HOUSE_GAP);
      const runWidth = run.length * cellWidth + (run.length - 1) * PROVISIONAL_HOUSE_GAP;
      const available = Math.max(
        PROVISIONAL_MIN_HOUSE_SIDE * run.length,
        runWidth - inset * 2 - PROVISIONAL_TERRACE_GAP * (run.length - 1),
      );

      // A seeded weight per house: some widths are ~0.8x, some ~1.2x the mean.
      const weights: number[] = [];
      let weightTotal = 0;
      for (let index = 0; index < run.length; index += 1) {
        const weight =
          PROVISIONAL_WIDTH_JITTER_MIN + runRandom() * PROVISIONAL_WIDTH_JITTER_RANGE;
        weights.push(weight);
        weightTotal += weight;
      }

      const isTerrace = run.length >= 2;
      const runHash = (hashString(runKey) ^ seed) >>> 0;
      const runType = isTerrace
        ? (RUN_TYPES[Math.floor(runRandom() * RUN_TYPES.length)] ?? 'terrace')
        : 'terrace';
      const runRoof = isTerrace ? roofForHouse(runType, runHash) : 'gable';
      // One shared roofline: every house in a run gets the same lift and pitch.
      const sharedLift = Math.max(
        6,
        5 +
          HOUSE_LIFT_BONUS[runType] +
          runRandom() * Math.min(13, cellHeight * 0.45),
      );

      let cursorX = x0 + inset;
      for (let index = 0; index < run.length; index += 1) {
        const col = run.start + index;
        const key = `${block.id}-${row}-${col}`;
        const hash = buildingHash(key, seed);
        const type = isTerrace
          ? runType
          : (HOUSE_TYPES[hash % HOUSE_TYPES.length] ?? 'terrace');
        const roof = isTerrace ? runRoof : roofForHouse(type, hash);
        // Each house gets its own depth; the row is no longer a uniform slab.
        const yInset =
          PROVISIONAL_HOUSE_INSET + runRandom() * PROVISIONAL_HOUSE_INSET_RANGE;
        const y =
          bounds.minY +
          PROVISIONAL_HOUSE_MARGIN +
          row * (cellHeight + PROVISIONAL_HOUSE_GAP) +
          yInset;
        const h = Math.max(PROVISIONAL_MIN_HOUSE_SIDE, cellHeight - yInset * 2);
        const w = Math.max(
          PROVISIONAL_MIN_HOUSE_SIDE,
          (available * (weights[index] ?? 1)) / weightTotal,
        );
        const lift = isTerrace
          ? sharedLift
          : Math.max(
              6,
              5 +
                HOUSE_LIFT_BONUS[type] +
                runRandom() * Math.min(13, cellHeight * 0.45),
            );
        const x = cursorX;
        cursorX += w + PROVISIONAL_TERRACE_GAP;
        const ridge: RidgeAxis = isTerrace ? 'x' : w >= h ? 'x' : 'y';

        buildings.push(
          makeBuilding(
            key,
            seed,
            type,
            roof,
            isTerrace,
            isTerrace ? runKey : key,
            col === run.start,
            col === run.start + run.length - 1,
            x,
            y,
            w,
            h,
            lift,
            ridge,
          ),
        );
      }
    }
  }

  return buildings.sort((left, right) => left.y + left.h - (right.y + right.h));
}

/*
 * One generated cell can hold a 40-unit-wide house. The board reads as a row of
 * narrow houses, so a wide footprint is split into a 2-3 house terrace and a
 * deep one into 2-3 houses along its depth. Seeded presentation only: the block,
 * the streets and the map are untouched. See decision 0024.
 */
const TERRACE_ROOF_MATERIALS: readonly RoofMaterial[] = [
  'clay',
  'terracotta',
  'ochre',
  'clay',
  'slate',
  'terracotta',
];

function splitTerrace(building: Building): readonly Building[] {
  let count = 1;
  let along: RidgeAxis = 'x';
  if (building.w >= 24) {
    count = building.w >= 36 ? 3 : 2;
    along = 'x';
  } else if (building.h >= 36) {
    count = building.h >= 52 ? 3 : 2;
    along = 'y';
  }
  if (count === 1) return [building];

  const units: Building[] = [];
  for (let index = 0; index < count; index += 1) {
    const hash = (building.hash + Math.imul(index + 1, 2246822519)) >>> 0;
    units.push({
      ...building,
      key: `${building.key}-t${index}`,
      hash,
      x: along === 'x' ? building.x + (building.w / count) * index : building.x,
      y: along === 'y' ? building.y + (building.h / count) * index : building.y,
      w: along === 'x' ? building.w / count : building.w,
      h: along === 'y' ? building.h / count : building.h,
      wall: WALL_COLOURS[hash % WALL_COLOURS.length] ?? building.wall,
      material: TERRACE_ROOF_MATERIALS[hash % TERRACE_ROOF_MATERIALS.length] ?? building.material,
      roof: building.roof === 'flat' ? 'flat' : 'gable',
      ridge: along,
      windows: 1,
      chimney: true,
      dormers: 0,
      chimneyPots: 1,
      runStart: index === 0 ? building.runStart : false,
      runEnd: index === count - 1 ? building.runEnd : false,
    });
  }
  return units;
}

export function buildingsForMap(map: GeneratedMap): readonly Building[] {
  const landmarkBlocks = new Set(map.city.landmarks.map((landmark) => landmark.blockId));
  const buildings: Building[] = [];

  for (const block of map.city.blocks) {
    if (block.kind !== 'block' || landmarkBlocks.has(block.id)) continue;
    for (const building of buildingsForBlock(block, map.seed)) buildings.push(...splitTerrace(building));
  }

  return buildings.sort((left, right) => left.y + left.h - (right.y + right.h));
}

/** Trees in parks only: a random point in a built block can land on a roof. */
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

  }

  return trees;
}

/*
 * PROVISIONAL: furniture density has no ratified value. The ambient-actor rule
 * says "tiny, desaturated, unringed, never on a station; when in doubt, omit",
 * so these are deliberately sparse.
 */
const PROVISIONAL_FURNITURE_STATION_CLEARANCE = 30;
const PROVISIONAL_LAMP_CHANCE = 0.22;
const PROVISIONAL_BOLLARD_CHANCE = 0.12;
const PROVISIONAL_PARK_RAILING_CHANCE = 0.6;
const PROVISIONAL_RAILING_SPAN = 0.62;
const PROVISIONAL_FURNITURE_EDGE_OFFSET = 3.5;
const PROVISIONAL_CAB_CHANCE = 0.025;
const PROVISIONAL_CAB_OFFSET = 4;

interface EdgePoint {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly span: number;
}

function edgeMidpoints(bounds: Bounds): readonly EdgePoint[] {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return [
    { x: midX, y: bounds.minY, angle: 0, span: width },
    { x: bounds.maxX, y: midY, angle: Math.PI / 2, span: height },
    { x: midX, y: bounds.maxY, angle: 0, span: width },
    { x: bounds.minX, y: midY, angle: Math.PI / 2, span: height },
  ];
}

/**
 * Period street furniture, seeded from the map. Positions are filtered against
 * every station node so an ambient prop can never be mistaken for a player
 * marker (the ambient-actor rule).
 */
export function furnitureForMap(map: GeneratedMap): readonly Furniture[] {
  const stations = map.graph.nodes;
  const clearOfStations = (x: number, y: number): boolean =>
    stations.every(
      (station) =>
        Math.hypot(station.x - x, station.y - y) > PROVISIONAL_FURNITURE_STATION_CLEARANCE,
    );

  const furniture: Furniture[] = [];

  for (const block of map.city.blocks) {
    const random = makeRandom(hashString(`furniture-${block.id}`) ^ map.seed);
    const bounds = blockBounds(block);
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;
    const edges = edgeMidpoints(bounds);

    if (block.kind === 'park') {
      for (const [index, edge] of edges.entries()) {
        if (random() >= PROVISIONAL_PARK_RAILING_CHANCE) continue;
        if (!clearOfStations(edge.x, edge.y)) continue;
        furniture.push({
          key: `${block.id}-railing-${index}`,
          kind: 'railing',
          x: edge.x,
          y: edge.y,
          angle: edge.angle,
          size: edge.span * PROVISIONAL_RAILING_SPAN,
        });
      }
      continue;
    }

    const edge = edges[Math.floor(random() * edges.length)] ?? edges[0];
    if (edge === undefined) continue;
    const outwardX = edge.angle === Math.PI / 2 ? Math.sign(edge.x - midX) : 0;
    const outwardY = edge.angle === 0 ? Math.sign(edge.y - midY) : 0;
    const lampX = edge.x + outwardX * PROVISIONAL_FURNITURE_EDGE_OFFSET;
    const lampY = edge.y + outwardY * PROVISIONAL_FURNITURE_EDGE_OFFSET;

    if (random() < PROVISIONAL_LAMP_CHANCE && clearOfStations(lampX, lampY)) {
      furniture.push({
        key: `${block.id}-lamp`,
        kind: 'lamp',
        x: lampX,
        y: lampY,
        angle: edge.angle,
        size: 1,
      });
    }

    if (random() < PROVISIONAL_BOLLARD_CHANCE) {
      const alongX = edge.angle === 0 ? 1 : 0;
      const alongY = edge.angle === Math.PI / 2 ? 1 : 0;
      for (const offset of [-4, 4]) {
        const x = lampX + alongX * offset;
        const y = lampY + alongY * offset;
        if (!clearOfStations(x, y)) continue;
        furniture.push({
          key: `${block.id}-bollard-${offset}`,
          kind: 'bollard',
          x,
          y,
          angle: edge.angle,
          size: 1,
        });
      }
    }
  }

  for (const street of map.city.streets) {
    const random = makeRandom(hashString(`cab-${street.id}`) ^ map.seed);
    if (random() >= PROVISIONAL_CAB_CHANCE) continue;
    const path = street.path;
    if (path.length < 2) continue;
    const first = path[0] as MapPoint;
    const last = path[path.length - 1] as MapPoint;
    const middle = path[Math.floor(path.length / 2)] as MapPoint;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const length = Math.hypot(dx, dy) || 1;
    const x = middle.x - (dy / length) * PROVISIONAL_CAB_OFFSET;
    const y = middle.y + (dx / length) * PROVISIONAL_CAB_OFFSET;
    if (!clearOfStations(x, y)) continue;
    furniture.push({
      key: `${street.id}-cab`,
      kind: 'cab',
      x,
      y,
      angle: Math.atan2(dy, dx),
      size: 1,
    });
  }

  return furniture;
}

/** A path string for a polyline. */
export function pathData(points: readonly MapPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}
