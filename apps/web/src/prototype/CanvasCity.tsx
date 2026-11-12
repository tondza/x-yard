/**
 * Canvas city plate for the large-map path.
 *
 * The SVG city is great for a 96-station prototype but not for a 10–50× city:
 * it creates tens of thousands of DOM nodes and repaints them through the SVG
 * viewBox on every camera frame. This renderer keeps the same data model and
 * projection but draws only the buildings/trees whose projected bounds intersect
 * the camera, using a spatial grid and a zoom-dependent level of detail.
 *
 * The live overlay stays in `PrototypeMap` so interaction is unchanged.
 *
 * @module apps/web/prototype/CanvasCity
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { GeneratedMap, GraphEdge, LandmarkModel, MapPoint } from '@x-yard/map-generator';

import {
  buildingsForMap,
  furnitureForMap,
  treesForMap,
  type Building,
  type Furniture,
  type Tree,
} from './city';
import type { RtsTheme, WallPalette } from '../lab/rts/rtsTheme';
import {
  NETWORK_STYLE,
  dashArray,
  edgePoints,
  modeOffset,
  offsetPolyline,
  routeColour,
  sortedNetworkEdges,
} from './routes';

export interface CanvasCityProps {
  readonly map: GeneratedMap;
  readonly theme: RtsTheme;
  readonly viewBox: string;
  readonly stage: { readonly width: number; readonly height: number };
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface P {
  readonly x: number;
  readonly y: number;
}

interface BuildingRec {
  readonly building: Building;
  readonly height: number;
  readonly depth: number;
  readonly box: Box;
  readonly wall: WallPalette;
  readonly roof: { readonly top: string; readonly edge: string };
  readonly hash: number;
}

interface LandmarkRec {
  readonly landmark: LandmarkModel;
  readonly depth: number;
  readonly box: Box;
}

interface TreeRec {
  readonly tree: Tree;
  readonly depth: number;
  readonly box: Box;
}

interface FurnitureRec {
  readonly furniture: Furniture;
  readonly depth: number;
  readonly box: Box;
}

interface StreetRec {
  readonly path: readonly MapPoint[];
  readonly width: number;
  readonly box: Box;
}

interface BlockRec {
  readonly points: readonly MapPoint[];
  readonly park: boolean;
  readonly box: Box;
}

const ISO_X = 0.9;
const ISO_Y = 0.5;
const GRID = 240;

/*
 * The static plate is rendered into a tile cache. Camera pans then draw the
 * same tiles instead of rebuilding hundreds of buildings every frame, and only
 * the newly exposed tiles are painted. Tiles are sized in CSS pixels and keyed
 * by a quantised zoom, so an eased zoom reuses a tile until the bucket changes.
 * These are presentation budgets, not game rules.
 */
const PROVISIONAL_PLATE_TILE_CSS = 256;
const PROVISIONAL_PLATE_TILE_OVERLAP_CSS = 1;
const PROVISIONAL_PLATE_TILE_LIMIT = 48;
/* How much of a house is cut away where a route passes underneath it. */
const PROVISIONAL_ROUTE_CUTOUT_ALPHA = 0.4;
const PROVISIONAL_PLATE_TILE_REBUILD_RATIO = 2.5;
/*
 * Zooming must not rebuild the tile grid on every frame. Tiles stay at the
 * scale they were painted until the zoom differs by a factor, then a single
 * deferred rebuild sharpens them. A low-resolution whole-city image sits
 * underneath, so a zoom-out never reveals blank paper and the free map view
 * needs no tiles at all.
 */
const PROVISIONAL_PLATE_SETTLE_RATIO = 1.5;
const PROVISIONAL_PLATE_SETTLE_MS = 180;
const PROVISIONAL_PLATE_OVERVIEW_MAX_FACTOR = 1.35;
const PROVISIONAL_PLATE_OVERVIEW_MAX_PIXELS = 4_000_000;

/*
 * PROVISIONAL: the brief fixes the intent (etching, pitched roofs, varied
 * landmarks) but not measurements. Every number below is an unratified visual
 * default tuned against the 96-station quarter; none is a game rule.
 */
const PROVISIONAL_ROOF_MIN_RISE = 2.4;
const PROVISIONAL_ROOF_MAX_RISE = 20;
const PROVISIONAL_INK_LINE_SCALE = 1.2;
const PROVISIONAL_BLOCK_EDGE_SCALE = 1.05;
const PROVISIONAL_CURB_ALPHA = 0.22;
const PROVISIONAL_HATCH_ALPHA_LIGHT = 0.2;
const PROVISIONAL_HATCH_ALPHA_DARK = 0.36;
const PROVISIONAL_HATCH_SPACING_LIGHT = 6;
const PROVISIONAL_HATCH_SPACING_DARK = 3.6;
const PROVISIONAL_PAPER_GRAIN_TILE = 96;
const PROVISIONAL_PAPER_GRAIN_ALPHA = 0.35;
const PROVISIONAL_PAPER_SPECK_COUNT = 640;
const PROVISIONAL_PAPER_FIBRE_COUNT = 36;
const PROVISIONAL_DORMER_WIDTH = 2.8;
const PROVISIONAL_DORMER_HEIGHT = 2.6;
const PROVISIONAL_DORMER_ROOF_RISE = 1.3;
const PROVISIONAL_DORMER_SLOPE_DEPTH = 0.72;
const PROVISIONAL_CHIMNEY_WIDTH = 1.8;
const PROVISIONAL_CHIMNEY_HEIGHT = 2.8;
const PROVISIONAL_CHIMNEY_POT_WIDTH = 1.1;
const PROVISIONAL_CHIMNEY_POT_HEIGHT = 1.3;
const PROVISIONAL_PARAPET_INSET = 1.8;
const PROVISIONAL_SAWTOOTH_TOOTH_WIDTH = 13;
const PROVISIONAL_MANSARD_INSET = 0.18;
const PROVISIONAL_MANSARD_PLATEAU = 0.7;
const PROVISIONAL_SHADOW_OFFSET_X = 14;
const PROVISIONAL_SHADOW_OFFSET_Y = 7;
const PROVISIONAL_SHADOW_HATCH_ALPHA = 0.22;
const PROVISIONAL_SHADOW_TINT_ALPHA = 0.04;
const PROVISIONAL_PORTICO_DEPTH = 6;

const PROVISIONAL_FACADE = {
  u0: 0.14,
  uSpan: 0.72,
  v0: 0.2,
  vSpan: 0.6,
  uFill: 0.58,
  vFill: 0.5,
  maxCols: 4,
  maxRows: 3,
  rowHeight: 5.5,
} as const;

const PROVISIONAL_AWNING = {
  v0: 0.64,
  v1: 0.86,
  stripes: 6,
  inset: 0.06,
} as const;

const PROVISIONAL_FURNITURE = {
  lampHeight: 7,
  lampHead: 1.5,
  cabLength: 7,
  cabWidth: 3,
  cabHeight: 2.4,
  wheelRadius: 1.2,
  railingHeight: 2.4,
  railingTick: 2.4,
  bollardRadius: 0.9,
} as const;

const PROVISIONAL_CATHEDRAL = {
  naveW: 70,
  naveH: 34,
  naveZ: 18,
  roofRise: 13,
  towerW: 16,
  towerZ: 44,
  spireZ: 62,
  roseR: 4.6,
  buttresses: 6,
} as const;

const PROVISIONAL_STATION = {
  baseW: 76,
  baseH: 34,
  baseZ: 15,
  shedH: 24,
  shedArch: 13,
  shedSteps: 8,
  towerW: 12,
  towerZ: 36,
  clockZ: 28,
  clockR: 3.2,
} as const;

const PROVISIONAL_MARKET = {
  baseW: 62,
  baseH: 30,
  baseZ: 12,
  roofRise: 14,
  lanternW: 12,
  lanternZ: 30,
  lanternTip: 38,
  stallW: 8,
  stallH: 6,
  stalls: 4,
} as const;

const PROVISIONAL_SQUARE = {
  padRx: 28,
  padRy: 13,
  basinR: 11,
  basinZ: 0.6,
  plinth: 10,
  obeliskHalf: 2.2,
  obeliskZ: 24,
  tipZ: 34,
} as const;

const PROVISIONAL_SPORTS = {
  rx: 34,
  ry: 17,
  pitchRx: 24,
  pitchRy: 11,
  standW: 38,
  standH: 9,
  standZ: 8,
  railWidth: 2.2,
} as const;

const PROVISIONAL_TOWN_HALL = {
  baseW: 68,
  baseH: 34,
  baseZ: 18,
  roofRise: 11,
  towerW: 15,
  towerZ: 44,
  clockZ: 36,
  clockR: 3.6,
  spireZ: 52,
  porticoW: 28,
  porticoD: 6,
  porticoZ: 14,
  pedimentRise: 7,
  stepsH: 3,
} as const;

const PROVISIONAL_CHURCH = {
  naveW: 46,
  naveH: 24,
  naveZ: 14,
  roofRise: 12,
  towerW: 12,
  towerZ: 32,
  spireZ: 46,
  clockZ: 27,
  clockR: 2.8,
  windowZ: 8,
} as const;

const PROVISIONAL_GARDENS = {
  padW: 66,
  padH: 34,
  pathW: 4,
  hedgeH: 2.2,
  hedgeW: 3,
  bandstandHalf: 6,
  bandstandZ: 8,
  bandstandTip: 15,
  trees: 4,
} as const;

const PROVISIONAL_HOSPITAL = {
  rearW: 62,
  rearH: 12,
  rearZ: 16,
  wingW: 16,
  wingH: 20,
  wingZ: 14,
  centreW: 20,
  centreH: 20,
  centreZ: 22,
  domeR: 6,
  domeZ: 5,
  chimneyW: 4,
  chimneyZ: 34,
} as const;

const PROVISIONAL_MUSEUM = {
  baseW: 68,
  baseH: 32,
  baseZ: 16,
  roofRise: 8,
  porticoW: 34,
  porticoD: 6,
  porticoZ: 18,
  columns: 6,
  pedimentRise: 8,
  domeR: 7,
  domeZ: 8,
  drumW: 12,
  drumZ: 22,
} as const;

const PROVISIONAL_UNIVERSITY = {
  hallW: 48,
  hallH: 30,
  hallZ: 18,
  roofRise: 11,
  towerW: 14,
  towerZ: 40,
  spireZ: 50,
  clockZ: 32,
  clockR: 3.2,
  wingW: 12,
  wingZ: 14,
} as const;

const PROVISIONAL_THEATRE = {
  frontW: 44,
  frontH: 22,
  frontZ: 18,
  columns: 4,
  pedimentRise: 8,
  drumR: 12,
  drumZ: 20,
  domeZ: 6,
  flyW: 12,
  flyH: 10,
  flyZ: 30,
} as const;

const PROVISIONAL_GASWORKS = {
  holderR: 15,
  holderZ: 24,
  holderRibs: 8,
  retortW: 20,
  retortH: 16,
  retortZ: 16,
  chimneyW: 4,
  chimneyZ: 44,
} as const;

function parseViewBox(viewBox: string): { x: number; y: number; width: number; height: number } | null {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  return { x: parts[0] as number, y: parts[1] as number, width: parts[2] as number, height: parts[3] as number };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function boxOf(points: readonly P[]): Box {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function intersects(box: Box, view: Box): boolean {
  return box.maxX >= view.minX && box.minX <= view.maxX && box.maxY >= view.minY && box.minY <= view.maxY;
}

function insertGrid(grid: Map<string, number[]>, index: number, box: Box): void {
  for (let x = Math.floor(box.minX / GRID); x <= Math.floor(box.maxX / GRID); x += 1) {
    for (let y = Math.floor(box.minY / GRID); y <= Math.floor(box.maxY / GRID); y += 1) {
      const key = `${x},${y}`;
      const list = grid.get(key);
      if (list === undefined) grid.set(key, [index]);
      else list.push(index);
    }
  }
}

function queryGrid(grid: ReadonlyMap<string, number[]>, view: Box): readonly number[] {
  const found = new Set<number>();
  for (let x = Math.floor(view.minX / GRID); x <= Math.floor(view.maxX / GRID); x += 1) {
    for (let y = Math.floor(view.minY / GRID); y <= Math.floor(view.maxY / GRID); y += 1) {
      const list = grid.get(`${x},${y}`);
      if (list !== undefined) for (const index of list) found.add(index);
    }
  }
  return [...found];
}

function lerp(a: P, b: P, t: number): P {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function convexHull(input: readonly P[]): P[] {
  const points = [...input].sort((left, right) => left.x - right.x || left.y - right.y);
  if (points.length <= 2) return points;
  const cross = (o: P, a: P, b: P): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: P[] = [];
  for (const point of points) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2] as P;
      const b = lower[lower.length - 1] as P;
      if (cross(a, b, point) > 0) break;
      lower.pop();
    }
    lower.push(point);
  }
  const upper: P[] = [];
  for (const point of [...points].reverse()) {
    while (upper.length >= 2) {
      const a = upper[upper.length - 2] as P;
      const b = upper[upper.length - 1] as P;
      if (cross(a, b, point) > 0) break;
      upper.pop();
    }
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function project(offsetX: number, x: number, y: number, z = 0): P {
  return { x: (x - y) * ISO_X + offsetX, y: (x + y) * ISO_Y - z };
}

function projectPath(offsetX: number, path: readonly MapPoint[]): readonly P[] {
  return path.map((point) => project(offsetX, point.x, point.y));
}

function prism(offsetX: number, x: number, y: number, w: number, h: number, z0: number, z1: number): { top: readonly P[]; sides: readonly { points: readonly [P, P, P, P]; side: 0 | 1 | 2 | 3; depth: number }[] } {
  const t0 = project(offsetX, x, y, z1);
  const t1 = project(offsetX, x + w, y, z1);
  const t2 = project(offsetX, x + w, y + h, z1);
  const t3 = project(offsetX, x, y + h, z1);
  const b0 = project(offsetX, x, y, z0);
  const b1 = project(offsetX, x + w, y, z0);
  const b2 = project(offsetX, x + w, y + h, z0);
  const b3 = project(offsetX, x, y + h, z0);
  const side = (points: readonly [P, P, P, P], sideIndex: 0 | 1 | 2 | 3) => ({
    points,
    side: sideIndex,
    depth: (points[0].y + points[1].y + points[2].y + points[3].y) / 4,
  });
  return {
    top: [t0, t1, t2, t3],
    sides: [side([t0, t1, b1, b0], 0), side([t1, t2, b2, b1], 1), side([t2, t3, b3, b2], 2), side([t3, t0, b0, b3], 3)],
  };
}

function buildingHeight(building: Building, board: boolean): number {
  const hash = hashString(building.key);
  // The board is roof-first: a short wall and a large roof plane. The etched
  // plate keeps its taller, more architectural massing.
  if (board) return Math.round(5 + (hash % 4) * 1.7 + building.lift * 0.22);
  return Math.round(8 + (hash % 5) * 3.2 + building.lift * 0.7);
}

function path(ctx: CanvasRenderingContext2D, points: readonly P[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index]!.x, points[index]!.y);
}

function fillPoly(ctx: CanvasRenderingContext2D, points: readonly P[], fill: string, stroke?: string, lineWidth = 1): void {
  path(ctx, points);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke !== undefined) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function ellipseWorld(
  offsetX: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  z: number,
  steps: number,
): readonly P[] {
  const points: P[] = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    points.push(project(offsetX, x + Math.cos(angle) * rx, y + Math.sin(angle) * ry, z));
  }
  return points;
}

/* ------------------------------------------------------------------ *
 * Etching textures
 * ------------------------------------------------------------------ */

const hatchTiles = new Map<number, HTMLCanvasElement>();
let paperTile: HTMLCanvasElement | null = null;

function hatchPattern(ctx: CanvasRenderingContext2D, spacing: number): CanvasPattern | null {
  let tile = hatchTiles.get(spacing);
  if (tile === undefined) {
    tile = document.createElement('canvas');
    tile.width = Math.ceil(spacing);
    tile.height = Math.ceil(spacing);
    const tileCtx = tile.getContext('2d');
    if (tileCtx !== null) {
      tileCtx.strokeStyle = '#231c13';
      tileCtx.lineWidth = 0.55;
      tileCtx.beginPath();
      tileCtx.moveTo(-1, spacing + 1);
      tileCtx.lineTo(spacing + 1, -1);
      tileCtx.stroke();
    }
    hatchTiles.set(spacing, tile);
  }
  return ctx.createPattern(tile, 'repeat');
}

/**
 * A paper-grain tile: sparse ink flecks and pale fibres on transparent ground.
 * The pattern is deterministic (fixed LCG) so the sheet never shimmers.
 */
function paperGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (paperTile === null) {
    paperTile = document.createElement('canvas');
    paperTile.width = PROVISIONAL_PAPER_GRAIN_TILE;
    paperTile.height = PROVISIONAL_PAPER_GRAIN_TILE;
    const tileCtx = paperTile.getContext('2d');
    if (tileCtx === null) return null;

    let state = 0x5eed1234;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };

    for (let index = 0; index < PROVISIONAL_PAPER_SPECK_COUNT; index += 1) {
      const x = random() * PROVISIONAL_PAPER_GRAIN_TILE;
      const y = random() * PROVISIONAL_PAPER_GRAIN_TILE;
      const radius = 0.3 + random() * 0.9;
      tileCtx.fillStyle =
        random() < 0.7 ? 'rgba(35, 28, 19, 0.14)' : 'rgba(255, 248, 230, 0.1)';
      tileCtx.beginPath();
      tileCtx.arc(x, y, radius, 0, Math.PI * 2);
      tileCtx.fill();
    }

    tileCtx.strokeStyle = 'rgba(43, 35, 24, 0.07)';
    tileCtx.lineWidth = 0.5;
    for (let index = 0; index < PROVISIONAL_PAPER_FIBRE_COUNT; index += 1) {
      const x = random() * PROVISIONAL_PAPER_GRAIN_TILE;
      const y = random() * PROVISIONAL_PAPER_GRAIN_TILE;
      const angle = random() * Math.PI;
      const length = 4 + random() * 14;
      tileCtx.beginPath();
      tileCtx.moveTo(x, y);
      tileCtx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      tileCtx.stroke();
    }
  }
  return ctx.createPattern(paperTile, 'repeat');
}

/* ------------------------------------------------------------------ *
 * Shared drawing helpers
 * ------------------------------------------------------------------ */

/**
 * House/landmark line ink. Board and Vintage soften this away from the
 * near-black shadow used for labels and cast shadows.
 */
function ink(theme: RtsTheme): string {
  return theme.outline ?? theme.shadow;
}

function drawFacadeWindows(
  ctx: CanvasRenderingContext2D,
  face: readonly [P, P, P, P],
  theme: RtsTheme,
  lineWidth: number,
  hash: number,
  columns = 3,
): void {
  const [a, b, c, d] = face;
  const cols = Math.min(PROVISIONAL_FACADE.maxCols, Math.max(1, columns));
  const rows = 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = PROVISIONAL_FACADE.u0 + (col + 0.2) * (PROVISIONAL_FACADE.uSpan / cols);
      const v = PROVISIONAL_FACADE.v0 + row * (PROVISIONAL_FACADE.vSpan / rows);
      const uw = (PROVISIONAL_FACADE.uSpan / cols) * PROVISIONAL_FACADE.uFill;
      const vh = (PROVISIONAL_FACADE.vSpan / rows) * PROVISIONAL_FACADE.vFill;
      const p0 = lerp(lerp(a, b, u), lerp(d, c, u), v);
      const p1 = lerp(lerp(a, b, u + uw), lerp(d, c, u + uw), v);
      const p2 = lerp(lerp(a, b, u + uw), lerp(d, c, u + uw), v + vh);
      const p3 = lerp(lerp(a, b, u), lerp(d, c, u), v + vh);
      const lit = (hash + row * 11 + col * 17) % 100 < theme.windowLitChance * 100;
      fillPoly(ctx, [p0, p1, p2, p3], lit ? theme.windowLit : theme.window, ink(theme), lineWidth * 0.25);
    }
  }
}

function drawPrismBlock(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  h: number,
  z0: number,
  z1: number,
  wall: WallPalette,
  roofTop: string,
  theme: RtsTheme,
  lineWidth: number,
  windows = false,
  hash = 0,
): void {
  const shape = prism(offsetX, x, y, w, h, z0, z1);
  for (const face of [...shape.sides].sort((left, right) => left.depth - right.depth)) {
    const colour = face.side === 1 ? wall.light : face.side === 2 ? wall.mid : wall.dark;
    fillPoly(ctx, face.points, colour, ink(theme), lineWidth);
    if (windows && (face.side === 1 || face.side === 2)) {
      drawFacadeWindows(ctx, face.points, theme, lineWidth, hash);
    }
  }
  fillPoly(ctx, shape.top, roofTop, ink(theme), lineWidth);
}

function drawGableRoof(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  h: number,
  z0: number,
  rise: number,
  ridgeAxis: 'x' | 'y',
  lit: string,
  shade: string,
  wall: string,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const t0 = project(offsetX, x, y, z0);
  const t1 = project(offsetX, x + w, y, z0);
  const t2 = project(offsetX, x + w, y + h, z0);
  const t3 = project(offsetX, x, y + h, z0);
  let a: P;
  let b: P;
  if (ridgeAxis === 'x') {
    a = project(offsetX, x, y + h / 2, z0 + rise);
    b = project(offsetX, x + w, y + h / 2, z0 + rise);
    fillPoly(ctx, [t0, t1, b, a], lit, ink(theme), lineWidth);
    fillPoly(ctx, [a, b, t2, t3], shade, ink(theme), lineWidth);
    // The near gable end is a wall face, not an opening: without it the roof
    // reads as an empty triangle from the side.
    fillPoly(ctx, [t1, t2, b], wall, ink(theme), lineWidth);
  } else {
    a = project(offsetX, x + w / 2, y, z0 + rise);
    b = project(offsetX, x + w / 2, y + h, z0 + rise);
    fillPoly(ctx, [t0, a, b, t3], lit, ink(theme), lineWidth);
    fillPoly(ctx, [a, t1, t2, b], shade, ink(theme), lineWidth);
    fillPoly(ctx, [t3, t2, b], wall, ink(theme), lineWidth);
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = theme.sun;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawHipRoof(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  h: number,
  z0: number,
  rise: number,
  lit: string,
  shade: string,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const t0 = project(offsetX, x, y, z0);
  const t1 = project(offsetX, x + w, y, z0);
  const t2 = project(offsetX, x + w, y + h, z0);
  const t3 = project(offsetX, x, y + h, z0);
  const inset = Math.min(w, h) / 2;
  if (w >= h) {
    const a = project(offsetX, x + inset, y + h / 2, z0 + rise);
    const b = project(offsetX, x + w - inset, y + h / 2, z0 + rise);
    fillPoly(ctx, [t0, t1, b, a], lit, ink(theme), lineWidth);
    fillPoly(ctx, [t0, a, t3], lit, ink(theme), lineWidth);
    fillPoly(ctx, [t1, t2, b], shade, ink(theme), lineWidth);
    fillPoly(ctx, [a, b, t2, t3], shade, ink(theme), lineWidth);
  } else {
    const a = project(offsetX, x + w / 2, y + inset, z0 + rise);
    const b = project(offsetX, x + w / 2, y + h - inset, z0 + rise);
    fillPoly(ctx, [t0, a, b, t3], lit, ink(theme), lineWidth);
    fillPoly(ctx, [t0, t1, a], lit, ink(theme), lineWidth);
    fillPoly(ctx, [a, t2, b], shade, ink(theme), lineWidth);
    fillPoly(ctx, [a, t1, t2, b], shade, ink(theme), lineWidth);
  }
}

function drawMansardRoof(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  h: number,
  z0: number,
  rise: number,
  lit: string,
  shade: string,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const t0 = project(offsetX, x, y, z0);
  const t1 = project(offsetX, x + w, y, z0);
  const t2 = project(offsetX, x + w, y + h, z0);
  const t3 = project(offsetX, x, y + h, z0);
  const inset = Math.min(w, h) * PROVISIONAL_MANSARD_INSET;
  const plateau = z0 + rise * PROVISIONAL_MANSARD_PLATEAU;
  const i0 = project(offsetX, x + inset, y + inset, plateau);
  const i1 = project(offsetX, x + w - inset, y + inset, plateau);
  const i2 = project(offsetX, x + w - inset, y + h - inset, plateau);
  const i3 = project(offsetX, x + inset, y + h - inset, plateau);
  fillPoly(ctx, [t0, t1, i1, i0], lit, ink(theme), lineWidth);
  fillPoly(ctx, [t0, i0, i3, t3], lit, ink(theme), lineWidth);
  fillPoly(ctx, [t1, t2, i2, i1], shade, ink(theme), lineWidth);
  fillPoly(ctx, [i3, i2, t2, t3], shade, ink(theme), lineWidth);
  fillPoly(ctx, [i0, i1, i2, i3], lit, ink(theme), lineWidth);
}

function drawFlatRoof(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  h: number,
  z0: number,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const t0 = project(offsetX, x, y, z0);
  const t1 = project(offsetX, x + w, y, z0);
  const t2 = project(offsetX, x + w, y + h, z0);
  const t3 = project(offsetX, x, y + h, z0);
  const inset = Math.min(PROVISIONAL_PARAPET_INSET, Math.min(w, h) * 0.25);
  const i0 = project(offsetX, x + inset, y + inset, z0);
  const i1 = project(offsetX, x + w - inset, y + inset, z0);
  const i2 = project(offsetX, x + w - inset, y + h - inset, z0);
  const i3 = project(offsetX, x + inset, y + h - inset, z0);
  fillPoly(ctx, [t0, t1, t2, t3], roof.edge, ink(theme), lineWidth);
  fillPoly(ctx, [i0, i1, i2, i3], roof.top, ink(theme), lineWidth * 0.8);
}

function drawSawtoothRoof(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  h: number,
  z0: number,
  rise: number,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const teeth = Math.max(3, Math.round(w / PROVISIONAL_SAWTOOTH_TOOTH_WIDTH));
  const step = w / teeth;
  for (let index = 0; index < teeth; index += 1) {
    const xa = x + index * step;
    const xb = xa + step;
    const a = project(offsetX, xa, y, z0);
    const b = project(offsetX, xa, y + h, z0);
    const c = project(offsetX, xb, y + h, z0 + rise);
    const d = project(offsetX, xb, y, z0 + rise);
    fillPoly(ctx, [a, b, c, d], roof.top, ink(theme), lineWidth);
    const e = project(offsetX, xb, y, z0);
    const f = project(offsetX, xb, y + h, z0);
    const g = project(offsetX, xb, y + h, z0 + rise);
    const hPoint = project(offsetX, xb, y, z0 + rise);
    fillPoly(ctx, [e, f, g, hPoint], theme.window, ink(theme), lineWidth * 0.8);
  }
}

/* ------------------------------------------------------------------ *
 * Building and roof composition
 * ------------------------------------------------------------------ */

function roofRise(rec: BuildingRec): number {
  const span = Math.min(rec.building.w, rec.building.h);
  return Math.max(
    PROVISIONAL_ROOF_MIN_RISE,
    Math.min(PROVISIONAL_ROOF_MAX_RISE, span * rec.building.roofPitch),
  );
}

function drawDormers(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: BuildingRec,
  rise: number,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const count = rec.building.dormers;
  if (count === 0 || rise <= 0) return;
  if (rec.building.roof !== 'gable' && rec.building.roof !== 'mansard') return;
  const building = rec.building;
  const dw = Math.min(PROVISIONAL_DORMER_WIDTH, building.w * 0.22);
  const dh = dw * 0.9;
  const z0 = rec.height + rise * 0.38;
  for (let index = 0; index < count; index += 1) {
    const fraction = (index + 1) / (count + 1);
    const cx = building.x + building.w * fraction;
    const cy = building.y + building.h * PROVISIONAL_DORMER_SLOPE_DEPTH;
    drawPrismBlock(
      ctx,
      offsetX,
      cx - dw / 2,
      cy - dh / 2,
      dw,
      dh,
      z0,
      z0 + PROVISIONAL_DORMER_HEIGHT,
      rec.wall,
      rec.roof.top,
      theme,
      lineWidth * 0.8,
    );
    drawGableRoof(
      ctx,
      offsetX,
      cx - dw / 2,
      cy - dh / 2,
      dw,
      dh,
      z0 + PROVISIONAL_DORMER_HEIGHT,
      PROVISIONAL_DORMER_ROOF_RISE,
      'x',
      rec.roof.top,
      rec.roof.edge,
      rec.wall.mid,
      theme,
      lineWidth * 0.8,
    );
  }
}

function drawChimneyPots(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: BuildingRec,
  rise: number,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const count = rec.building.chimneyPots;
  if (count === 0) return;
  const building = rec.building;
  const pitched = building.roof !== 'flat' && building.roof !== 'sawtooth';
  const baseZ = rec.height + (pitched ? rise * 0.86 : 0);
  for (let index = 0; index < count; index += 1) {
    const fraction = count === 1 ? 0.5 : 0.2 + (index * 0.6) / (count - 1);
    let cx = building.x + building.w * fraction;
    let cy = building.y + building.h * fraction;
    if (building.roof === 'sawtooth') {
      cx = building.x + building.w * (0.2 + index * 0.2);
      cy = building.y + building.h * 0.2;
    } else if (pitched) {
      if (building.ridge === 'x') cy = building.y + building.h / 2;
      else cx = building.x + building.w / 2;
    }
    const w = PROVISIONAL_CHIMNEY_WIDTH;
    drawPrismBlock(
      ctx,
      offsetX,
      cx - w / 2,
      cy - w / 2,
      w,
      w,
      baseZ,
      baseZ + PROVISIONAL_CHIMNEY_HEIGHT,
      rec.wall,
      rec.roof.edge,
      theme,
      lineWidth * 0.7,
    );
    const potWidth = PROVISIONAL_CHIMNEY_POT_WIDTH;
    drawPrismBlock(
      ctx,
      offsetX,
      cx - potWidth / 2,
      cy - potWidth / 2,
      potWidth,
      potWidth,
      baseZ + PROVISIONAL_CHIMNEY_HEIGHT,
      baseZ + PROVISIONAL_CHIMNEY_HEIGHT + PROVISIONAL_CHIMNEY_POT_HEIGHT,
      rec.wall,
      ink(theme),
      theme,
      lineWidth * 0.6,
    );
  }
}

function drawAwning(
  ctx: CanvasRenderingContext2D,
  face: readonly [P, P, P, P],
  theme: RtsTheme,
): void {
  const [a, b, c, d] = face;
  const v0 = PROVISIONAL_AWNING.v0;
  const v1 = PROVISIONAL_AWNING.v1;
  const uInset = PROVISIONAL_AWNING.inset;
  const topLeft = lerp(lerp(a, b, uInset), lerp(d, c, uInset), v0);
  const topRight = lerp(lerp(a, b, 1 - uInset), lerp(d, c, 1 - uInset), v0);
  const botLeft = lerp(lerp(a, b, uInset), lerp(d, c, uInset), v1);
  const botRight = lerp(lerp(a, b, 1 - uInset), lerp(d, c, 1 - uInset), v1);
  fillPoly(ctx, [topLeft, topRight, botRight, botLeft], theme.rust, ink(theme), 0.6);
  ctx.strokeStyle = theme.stationPad;
  ctx.lineWidth = 0.7;
  for (let index = 1; index < PROVISIONAL_AWNING.stripes; index += 1) {
    const t = uInset + ((1 - uInset * 2) * index) / PROVISIONAL_AWNING.stripes;
    const top = lerp(lerp(a, b, t), lerp(d, c, t), v0);
    const bottom = lerp(lerp(a, b, t), lerp(d, c, t), v1);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: BuildingRec,
  theme: RtsTheme,
  detail: boolean,
  lineWidth: number,
  hatchLight: CanvasPattern | null,
  hatchDense: CanvasPattern | null,
): void {
  const building = rec.building;
  const style = prism(offsetX, building.x, building.y, building.w, building.h, 0, rec.height);
  const sideColour: Record<0 | 1 | 2 | 3, string> = {
    0: rec.wall.dark,
    1: rec.wall.light,
    2: rec.wall.mid,
    3: rec.wall.dark,
  };
  const sides = [...style.sides].sort((left, right) => left.depth - right.depth);
  for (const face of sides) {
    fillPoly(ctx, face.points, sideColour[face.side], ink(theme), lineWidth * PROVISIONAL_INK_LINE_SCALE);
    if (detail) {
      const pattern = face.side === 1 || face.side === 2 ? hatchLight : hatchDense;
      if (pattern !== null) {
        path(ctx, face.points);
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha =
          face.side === 1 || face.side === 2
            ? PROVISIONAL_HATCH_ALPHA_LIGHT
            : PROVISIONAL_HATCH_ALPHA_DARK;
        ctx.fillStyle = pattern;
        ctx.fill();
        ctx.restore();
      }
      if (face.side === 1 || face.side === 2) {
        drawFacadeWindows(ctx, face.points, theme, lineWidth, rec.hash, rec.building.windows);
      }
      if (theme.board !== true && building.type === 'shop' && face.side === 2) {
        drawAwning(ctx, face.points, theme);
      }
    }
  }

  if (!detail) {
    fillPoly(ctx, style.top, rec.roof.top, rec.roof.edge, lineWidth);
    return;
  }

  const rise = roofRise(rec);
  if (building.roof === 'gable') {
    drawGableRoof(
      ctx,
      offsetX,
      building.x,
      building.y,
      building.w,
      building.h,
      rec.height,
      rise,
      building.ridge,
      rec.roof.top,
      rec.roof.edge,
      rec.wall.mid,
      theme,
      lineWidth,
    );
  } else if (building.roof === 'hip') {
    drawHipRoof(
      ctx,
      offsetX,
      building.x,
      building.y,
      building.w,
      building.h,
      rec.height,
      rise,
      rec.roof.top,
      rec.roof.edge,
      theme,
      lineWidth,
    );
  } else if (building.roof === 'mansard') {
    drawMansardRoof(
      ctx,
      offsetX,
      building.x,
      building.y,
      building.w,
      building.h,
      rec.height,
      rise,
      rec.roof.top,
      rec.roof.edge,
      theme,
      lineWidth,
    );
  } else if (building.roof === 'sawtooth') {
    drawSawtoothRoof(
      ctx,
      offsetX,
      building.x,
      building.y,
      building.w,
      building.h,
      rec.height,
      rise,
      rec.roof,
      theme,
      lineWidth,
    );
  } else {
    drawFlatRoof(
      ctx,
      offsetX,
      building.x,
      building.y,
      building.w,
      building.h,
      rec.height,
      rec.roof,
      theme,
      lineWidth,
    );
  }

  if (theme.board !== true) drawDormers(ctx, offsetX, rec, rise, theme, lineWidth);
  drawChimneyPots(ctx, offsetX, rec, rise, theme, lineWidth);
}

/* ------------------------------------------------------------------ *
 * Landmarks
 * ------------------------------------------------------------------ */

function drawSpire(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  cx: number,
  cy: number,
  baseZ: number,
  half: number,
  height: number,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const a = project(offsetX, cx - half, cy - half, baseZ);
  const b = project(offsetX, cx + half, cy - half, baseZ);
  const c = project(offsetX, cx + half, cy + half, baseZ);
  const d = project(offsetX, cx - half, cy + half, baseZ);
  const apex = project(offsetX, cx, cy, baseZ + height);
  fillPoly(ctx, [a, b, apex], roof.edge, ink(theme), lineWidth);
  fillPoly(ctx, [b, c, apex], roof.top, ink(theme), lineWidth);
  fillPoly(ctx, [c, d, apex], roof.edge, ink(theme), lineWidth);
}

function drawDome(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  cx: number,
  cy: number,
  radius: number,
  baseZ: number,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const base = project(offsetX, cx, cy, baseZ);
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, radius * ISO_X, radius * ISO_Y * 1.6, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = roof.top;
  ctx.fill();
  ctx.strokeStyle = ink(theme);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  const finial = project(offsetX, cx, cy, baseZ + radius * 0.9);
  ctx.strokeStyle = ink(theme);
  ctx.beginPath();
  ctx.moveTo(finial.x, finial.y);
  ctx.lineTo(finial.x, finial.y - 3);
  ctx.stroke();
}

function drawClock(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  cx: number,
  cy: number,
  z: number,
  radius: number,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const face = project(offsetX, cx, cy, z);
  ctx.beginPath();
  ctx.arc(face.x, face.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = theme.stationPad;
  ctx.fill();
  ctx.strokeStyle = ink(theme);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(face.x, face.y);
  ctx.lineTo(face.x, face.y - radius * 0.6);
  ctx.moveTo(face.x, face.y);
  ctx.lineTo(face.x + radius * 0.45, face.y + radius * 0.1);
  ctx.strokeStyle = ink(theme);
  ctx.lineWidth = lineWidth * 0.8;
  ctx.stroke();
}

function drawBarrelRoof(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  length: number,
  halfWidth: number,
  z0: number,
  arch: number,
  steps: number,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const left: P[] = [];
  const right: P[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const yy = y - halfWidth + halfWidth * 2 * t;
    const zz = z0 + Math.sin(Math.PI * t) * arch;
    left.push(project(offsetX, x - length / 2, yy, zz));
    right.push(project(offsetX, x + length / 2, yy, zz));
  }
  fillPoly(ctx, [...left, ...[...right].reverse()], theme.window, theme.steel, lineWidth);
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = theme.steel;
  ctx.lineWidth = lineWidth * 0.7;
  for (let index = 0; index <= steps; index += 2) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCylinder(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  cx: number,
  cy: number,
  radius: number,
  z0: number,
  z1: number,
  wall: WallPalette,
  roofTop: string,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const bottom = ellipseWorld(offsetX, cx, cy, radius, radius, z0, 20);
  const top = ellipseWorld(offsetX, cx, cy, radius, radius, z1, 20);
  fillPoly(ctx, bottom, wall.dark, ink(theme), lineWidth);
  fillPoly(ctx, [...bottom, ...[...top].reverse()], wall.mid, ink(theme), lineWidth);
  fillPoly(ctx, top, roofTop, ink(theme), lineWidth);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = ink(theme);
  ctx.lineWidth = lineWidth * 0.7;
  for (let index = 0; index < bottom.length; index += 4) {
    const a = bottom[index];
    const b = top[index];
    if (a === undefined || b === undefined) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPortico(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  w: number,
  z0: number,
  z1: number,
  columns: number,
  wall: WallPalette,
  theme: RtsTheme,
  lineWidth: number,
): void {
  drawPrismBlock(
    ctx,
    offsetX,
    x,
    y,
    w,
    PROVISIONAL_PORTICO_DEPTH,
    z0,
    z1,
    wall,
    wall.light,
    theme,
    lineWidth,
  );
  const face = project(offsetX, x, y + PROVISIONAL_PORTICO_DEPTH, z0);
  const faceRight = project(offsetX, x + w, y + PROVISIONAL_PORTICO_DEPTH, z0);
  for (let index = 0; index <= columns; index += 1) {
    const t = index / columns;
    const p = lerp(face, faceRight, 0.06 + t * 0.88);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - (z1 - z0));
    ctx.strokeStyle = ink(theme);
    ctx.lineWidth = lineWidth * 0.8;
    ctx.stroke();
  }
}

function drawSquareLandmark(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const pad = ellipseWorld(offsetX, x, y, PROVISIONAL_SQUARE.padRx, PROVISIONAL_SQUARE.padRy, 0, 28);
  fillPoly(ctx, pad, theme.stationPad, theme.blockEdge, lineWidth * PROVISIONAL_BLOCK_EDGE_SCALE);
  const basin = ellipseWorld(offsetX, x, y, PROVISIONAL_SQUARE.basinR, PROVISIONAL_SQUARE.basinR * 0.45, 0, 24);
  fillPoly(ctx, basin, theme.water, theme.waterEdge, lineWidth);
  const inner = ellipseWorld(offsetX, x, y, PROVISIONAL_SQUARE.basinR * 0.55, PROVISIONAL_SQUARE.basinR * 0.25, 0, 20);
  fillPoly(ctx, inner, theme.stationPad, theme.waterEdge, lineWidth * 0.7);
  const plinth = PROVISIONAL_SQUARE.plinth;
  drawPrismBlock(ctx, offsetX, x - plinth / 2, y - plinth / 2, plinth, plinth, 0, 5, stone, roof.edge, theme, lineWidth);
  drawPrismBlock(
    ctx,
    offsetX,
    x - PROVISIONAL_SQUARE.obeliskHalf,
    y - PROVISIONAL_SQUARE.obeliskHalf,
    PROVISIONAL_SQUARE.obeliskHalf * 2,
    PROVISIONAL_SQUARE.obeliskHalf * 2,
    5,
    PROVISIONAL_SQUARE.obeliskZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    x,
    y,
    PROVISIONAL_SQUARE.obeliskZ,
    PROVISIONAL_SQUARE.obeliskHalf,
    PROVISIONAL_SQUARE.tipZ - PROVISIONAL_SQUARE.obeliskZ,
    roof,
    theme,
    lineWidth,
  );
}

function drawCathedral(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_CATHEDRAL;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.naveW / 2,
    y - spec.naveH / 2,
    spec.naveW,
    spec.naveH,
    0,
    spec.naveZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    3,
  );
  drawGableRoof(
    ctx,
    offsetX,
    x - spec.naveW / 2,
    y - spec.naveH / 2,
    spec.naveW,
    spec.naveH,
    spec.naveZ,
    spec.roofRise,
    'x',
    roof.top,
    roof.edge,
    stone.mid,
    theme,
    lineWidth,
  );
  for (let index = 0; index < spec.buttresses; index += 1) {
    const bx = x - spec.naveW / 2 + 6 + (index * (spec.naveW - 12)) / (spec.buttresses - 1);
    const bottom = project(offsetX, bx, y + spec.naveH / 2, 0);
    const top = project(offsetX, bx, y + spec.naveH / 2, spec.naveZ);
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(top.x, top.y);
    ctx.strokeStyle = ink(theme);
    ctx.lineWidth = lineWidth * 0.8;
    ctx.stroke();
  }
  const rose = project(offsetX, x, y + spec.naveH / 2, spec.naveZ * 0.62);
  ctx.beginPath();
  ctx.arc(rose.x, rose.y, spec.roseR, 0, Math.PI * 2);
  ctx.fillStyle = theme.window;
  ctx.fill();
  ctx.strokeStyle = theme.rust;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  // The tower sits at the east end of the nave, not on its centreline: a tower
  // drawn over the nave centre covers the rose window and reads as a facade
  // element in front of the building.
  const towerX = x + spec.naveW / 2 - spec.towerW / 2;
  drawPrismBlock(
    ctx,
    offsetX,
    towerX - spec.towerW / 2,
    y - spec.towerW / 2,
    spec.towerW,
    spec.towerW,
    0,
    spec.towerZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    towerX,
    y,
    spec.towerZ,
    spec.towerW / 2,
    spec.spireZ - spec.towerZ,
    roof,
    theme,
    lineWidth,
  );
  const crossTop = project(offsetX, towerX, y, spec.spireZ);
  ctx.strokeStyle = ink(theme);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(crossTop.x, crossTop.y);
  ctx.lineTo(crossTop.x, crossTop.y - 7);
  ctx.moveTo(crossTop.x - 3, crossTop.y - 5);
  ctx.lineTo(crossTop.x + 3, crossTop.y - 5);
  ctx.stroke();
}

function drawStation(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_STATION;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    0,
    spec.baseZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    7,
  );
  drawBarrelRoof(
    ctx,
    offsetX,
    x,
    y,
    spec.baseW - 8,
    spec.shedH / 2,
    spec.baseZ,
    spec.shedArch,
    spec.shedSteps,
    theme,
    lineWidth,
  );
  drawPrismBlock(
    ctx,
    offsetX,
    x + spec.baseW / 2 - spec.towerW - 3,
    y - spec.towerW / 2,
    spec.towerW,
    spec.towerW,
    0,
    spec.towerZ,
    stone,
    roof.top,
    theme,
    lineWidth,
    true,
    11,
  );
  drawClock(
    ctx,
    offsetX,
    x + spec.baseW / 2 - spec.towerW / 2 - 3,
    y + spec.towerW / 2,
    spec.clockZ,
    spec.clockR,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    x + spec.baseW / 2 - spec.towerW / 2 - 3,
    y,
    spec.towerZ,
    spec.towerW / 2,
    10,
    roof,
    theme,
    lineWidth,
  );
}

function drawMarket(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_MARKET;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    0,
    spec.baseZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    13,
  );
  drawGableRoof(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    spec.baseZ,
    spec.roofRise,
    'x',
    roof.top,
    roof.edge,
    stone.mid,
    theme,
    lineWidth,
  );
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.lanternW / 2,
    y - spec.lanternW / 2,
    spec.lanternW,
    spec.lanternW,
    spec.baseZ + spec.roofRise,
    spec.lanternZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    x,
    y,
    spec.lanternZ,
    spec.lanternW / 2,
    spec.lanternTip - spec.lanternZ,
    roof,
    theme,
    lineWidth,
  );
  for (let index = 0; index < spec.stalls; index += 1) {
    const sx = x - spec.baseW / 2 + 7 + index * (spec.baseW - 14) / (spec.stalls - 1);
    const ground = project(offsetX, sx, y + spec.baseH / 2 + 3, 0);
    ctx.fillStyle = index % 2 === 0 ? theme.rust : theme.stationPad;
    ctx.fillRect(ground.x - spec.stallW / 2, ground.y - spec.stallH, spec.stallW, spec.stallH);
    ctx.strokeStyle = ink(theme);
    ctx.lineWidth = lineWidth * 0.7;
    ctx.strokeRect(ground.x - spec.stallW / 2, ground.y - spec.stallH, spec.stallW, spec.stallH);
  }
}

function drawSportsGround(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_SPORTS;
  const ground = ellipseWorld(offsetX, x, y, spec.rx, spec.ry, 0, 36);
  fillPoly(ctx, ground, theme.park, theme.parkEdge, lineWidth * PROVISIONAL_BLOCK_EDGE_SCALE);
  const track = ellipseWorld(offsetX, x, y, spec.pitchRx + 5, spec.pitchRy + 4, 0, 32);
  fillPoly(ctx, track, theme.sidewalk, theme.blockEdge, lineWidth);
  const pitch = ellipseWorld(offsetX, x, y, spec.pitchRx, spec.pitchRy, 0, 32);
  fillPoly(ctx, pitch, theme.park, theme.parkEdge, lineWidth * 0.8);
  const centre = project(offsetX, x, y, 0);
  ctx.strokeStyle = theme.stationPad;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, spec.pitchRx * 0.35, spec.pitchRy * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centre.x - spec.pitchRx * ISO_X, centre.y);
  ctx.lineTo(centre.x + spec.pitchRx * ISO_X, centre.y);
  ctx.stroke();
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.standW / 2,
    y - spec.ry - 7,
    spec.standW,
    7,
    0,
    spec.standH,
    theme.walls[4] as WallPalette,
    theme.roofs[3]?.top ?? theme.shadow,
    theme,
    lineWidth,
  );
}

function drawTownHall(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_TOWN_HALL;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    0,
    spec.baseZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    17,
  );
  drawHipRoof(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    spec.baseZ,
    spec.roofRise,
    roof.top,
    roof.edge,
    theme,
    lineWidth,
  );
  // Tower first, portico after: the tower is behind the frontage, so drawing it
  // last makes its base paint over the columns and pediment.
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.towerW / 2,
    y - spec.towerW / 2,
    spec.towerW,
    spec.towerW,
    spec.baseZ,
    spec.towerZ,
    stone,
    roof.top,
    theme,
    lineWidth,
    true,
    19,
  );
  drawClock(ctx, offsetX, x, y + spec.towerW / 2, spec.clockZ, spec.clockR, theme, lineWidth);
  drawSpire(
    ctx,
    offsetX,
    x,
    y,
    spec.towerZ,
    spec.towerW / 2,
    spec.spireZ - spec.towerZ,
    roof,
    theme,
    lineWidth,
  );
  drawPortico(
    ctx,
    offsetX,
    x - spec.porticoW / 2,
    y + spec.baseH / 2,
    spec.porticoW,
    0,
    spec.porticoZ,
    4,
    stone,
    theme,
    lineWidth,
  );
  const pedimentLeft = project(offsetX, x - spec.porticoW / 2, y + spec.baseH / 2 + spec.porticoD, spec.porticoZ);
  const pedimentRight = project(offsetX, x + spec.porticoW / 2, y + spec.baseH / 2 + spec.porticoD, spec.porticoZ);
  const pedimentTop = project(offsetX, x, y + spec.baseH / 2 + spec.porticoD, spec.porticoZ + spec.pedimentRise);
  fillPoly(ctx, [pedimentLeft, pedimentRight, pedimentTop], roof.top, ink(theme), lineWidth);
}

function drawChurch(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_CHURCH;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.naveW / 2,
    y - spec.naveH / 2,
    spec.naveW,
    spec.naveH,
    0,
    spec.naveZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    23,
  );
  drawGableRoof(
    ctx,
    offsetX,
    x - spec.naveW / 2,
    y - spec.naveH / 2,
    spec.naveW,
    spec.naveH,
    spec.naveZ,
    spec.roofRise,
    'x',
    roof.top,
    roof.edge,
    stone.mid,
    theme,
    lineWidth,
  );
  const window = project(offsetX, x - 6, y + spec.naveH / 2, spec.windowZ);
  ctx.beginPath();
  ctx.arc(window.x, window.y, 3.4, Math.PI, 0);
  ctx.rect(window.x - 3.4, window.y, 6.8, 6);
  ctx.fillStyle = theme.window;
  ctx.fill();
  ctx.strokeStyle = ink(theme);
  ctx.lineWidth = lineWidth * 0.8;
  ctx.stroke();
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.naveW / 2 - spec.towerW / 2,
    y - spec.towerW / 2,
    spec.towerW,
    spec.towerW,
    0,
    spec.towerZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawClock(
    ctx,
    offsetX,
    x - spec.naveW / 2,
    y + spec.towerW / 2,
    spec.clockZ,
    spec.clockR,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    x - spec.naveW / 2,
    y,
    spec.towerZ,
    spec.towerW / 2,
    spec.spireZ - spec.towerZ,
    roof,
    theme,
    lineWidth,
  );
}

function drawGardens(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_GARDENS;
  const pad: readonly P[] = [
    project(offsetX, x - spec.padW / 2, y - spec.padH / 2, 0),
    project(offsetX, x + spec.padW / 2, y - spec.padH / 2, 0),
    project(offsetX, x + spec.padW / 2, y + spec.padH / 2, 0),
    project(offsetX, x - spec.padW / 2, y + spec.padH / 2, 0),
  ];
  fillPoly(ctx, pad, theme.park, theme.parkEdge, lineWidth * PROVISIONAL_BLOCK_EDGE_SCALE);
  const horizontal: readonly P[] = [
    project(offsetX, x - spec.padW / 2, y - spec.pathW / 2, 0),
    project(offsetX, x + spec.padW / 2, y - spec.pathW / 2, 0),
    project(offsetX, x + spec.padW / 2, y + spec.pathW / 2, 0),
    project(offsetX, x - spec.padW / 2, y + spec.pathW / 2, 0),
  ];
  const vertical: readonly P[] = [
    project(offsetX, x - spec.pathW / 2, y - spec.padH / 2, 0),
    project(offsetX, x + spec.pathW / 2, y - spec.padH / 2, 0),
    project(offsetX, x + spec.pathW / 2, y + spec.padH / 2, 0),
    project(offsetX, x - spec.pathW / 2, y + spec.padH / 2, 0),
  ];
  fillPoly(ctx, horizontal, theme.sidewalk, theme.blockEdge, lineWidth * 0.6);
  fillPoly(ctx, vertical, theme.sidewalk, theme.blockEdge, lineWidth * 0.6);
  const half = spec.bandstandHalf;
  drawPrismBlock(
    ctx,
    offsetX,
    x - half,
    y - half,
    half * 2,
    half * 2,
    0,
    spec.bandstandZ,
    theme.walls[4] as WallPalette,
    theme.roofs[2]?.top ?? theme.shadow,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    x,
    y,
    spec.bandstandZ,
    half,
    spec.bandstandTip - spec.bandstandZ,
    theme.roofs[2] as { readonly top: string; readonly edge: string },
    theme,
    lineWidth,
  );
  for (let index = 0; index < spec.trees; index += 1) {
    const angle = (index / spec.trees) * Math.PI * 2;
    const tx = x + Math.cos(angle) * spec.padW * 0.38;
    const ty = y + Math.sin(angle) * spec.padH * 0.36;
    const base = project(offsetX, tx, ty, 0);
    const top = project(offsetX, tx, ty, 8);
    ctx.strokeStyle = theme.treeTrunk;
    ctx.lineWidth = lineWidth * 1.2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(top.x, top.y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = theme.tree;
    ctx.fill();
    ctx.strokeStyle = ink(theme);
    ctx.lineWidth = lineWidth * 0.6;
    ctx.stroke();
  }
}

function drawHospital(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_HOSPITAL;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.rearW / 2,
    y - spec.rearH - 6,
    spec.rearW,
    spec.rearH,
    0,
    spec.rearZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    29,
  );
  for (const direction of [-1, 1]) {
    drawPrismBlock(
      ctx,
      offsetX,
      x + direction * (spec.centreW / 2) - (direction > 0 ? 0 : spec.wingW),
      y - spec.wingH / 2,
      spec.wingW,
      spec.wingH,
      0,
      spec.wingZ,
      stone,
      roof.edge,
      theme,
      lineWidth,
      true,
      31,
    );
  }
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.centreW / 2,
    y - spec.centreH / 2,
    spec.centreW,
    spec.centreH,
    0,
    spec.centreZ,
    stone,
    roof.top,
    theme,
    lineWidth,
    true,
    33,
  );
  drawDome(ctx, offsetX, x, y, spec.domeR, spec.centreZ, roof, theme, lineWidth);
  for (const direction of [-1, 1]) {
    drawPrismBlock(
      ctx,
      offsetX,
      x + direction * 30 - spec.chimneyW / 2,
      y - spec.rearH - 10,
      spec.chimneyW,
      spec.chimneyW,
      spec.rearZ,
      spec.chimneyZ,
      stone,
      ink(theme),
      theme,
      lineWidth * 0.7,
    );
  }
}

function drawMuseum(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_MUSEUM;
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    0,
    spec.baseZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    37,
  );
  drawHipRoof(
    ctx,
    offsetX,
    x - spec.baseW / 2,
    y - spec.baseH / 2,
    spec.baseW,
    spec.baseH,
    spec.baseZ,
    spec.roofRise,
    roof.top,
    roof.edge,
    theme,
    lineWidth,
  );
  // Dome first, portico after: the portico is the frontmost element.
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.drumW / 2,
    y - spec.drumW / 2,
    spec.drumW,
    spec.drumW,
    spec.baseZ,
    spec.drumZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawDome(ctx, offsetX, x, y, spec.domeR, spec.drumZ, roof, theme, lineWidth);
  drawPortico(
    ctx,
    offsetX,
    x - spec.porticoW / 2,
    y + spec.baseH / 2,
    spec.porticoW,
    0,
    spec.porticoZ,
    spec.columns,
    stone,
    theme,
    lineWidth,
  );
  const left = project(offsetX, x - spec.porticoW / 2, y + spec.baseH / 2 + spec.porticoD, spec.porticoZ);
  const right = project(offsetX, x + spec.porticoW / 2, y + spec.baseH / 2 + spec.porticoD, spec.porticoZ);
  const top = project(offsetX, x, y + spec.baseH / 2 + spec.porticoD, spec.porticoZ + spec.pedimentRise);
  fillPoly(ctx, [left, right, top], roof.top, ink(theme), lineWidth);
}

function drawUniversity(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_UNIVERSITY;
  for (const direction of [-1, 1]) {
    drawPrismBlock(
      ctx,
      offsetX,
      x + direction * (spec.hallW / 2) - (direction > 0 ? 0 : spec.wingW),
      y - spec.hallH / 2,
      spec.wingW,
      spec.hallH,
      0,
      spec.wingZ,
      stone,
      roof.edge,
      theme,
      lineWidth,
      true,
      41,
    );
  }
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.hallW / 2,
    y - spec.hallH / 2,
    spec.hallW,
    spec.hallH,
    0,
    spec.hallZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    43,
  );
  drawGableRoof(
    ctx,
    offsetX,
    x - spec.hallW / 2,
    y - spec.hallH / 2,
    spec.hallW,
    spec.hallH,
    spec.hallZ,
    spec.roofRise,
    'x',
    roof.top,
    roof.edge,
    stone.mid,
    theme,
    lineWidth,
  );
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.towerW / 2,
    y - spec.towerW / 2,
    spec.towerW,
    spec.towerW,
    spec.hallZ,
    spec.towerZ,
    stone,
    roof.top,
    theme,
    lineWidth,
    true,
    47,
  );
  drawClock(
    ctx,
    offsetX,
    x,
    y + spec.towerW / 2,
    spec.clockZ,
    spec.clockR,
    theme,
    lineWidth,
  );
  drawSpire(
    ctx,
    offsetX,
    x,
    y,
    spec.towerZ,
    spec.towerW / 2,
    spec.spireZ - spec.towerZ,
    roof,
    theme,
    lineWidth,
  );
}

function drawTheatre(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_THEATRE;
  const drumY = y - spec.frontH / 2;
  const frontY = y + spec.frontH / 2;
  drawCylinder(
    ctx,
    offsetX,
    x,
    drumY,
    spec.drumR,
    0,
    spec.drumZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawDome(ctx, offsetX, x, drumY, spec.drumR * 0.8, spec.drumZ, roof, theme, lineWidth);
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.frontW / 2,
    y - spec.frontH / 2,
    spec.frontW,
    spec.frontH,
    0,
    spec.frontZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    53,
  );
  drawPortico(
    ctx,
    offsetX,
    x - spec.frontW / 2,
    frontY,
    spec.frontW,
    0,
    12,
    spec.columns,
    stone,
    theme,
    lineWidth,
  );
  const pedimentFront = frontY + PROVISIONAL_PORTICO_DEPTH;
  const left = project(offsetX, x - spec.frontW / 2, pedimentFront, 12);
  const right = project(offsetX, x + spec.frontW / 2, pedimentFront, 12);
  const top = project(offsetX, x, pedimentFront, 12 + spec.pedimentRise);
  fillPoly(ctx, [left, right, top], roof.top, ink(theme), lineWidth);
  drawPrismBlock(
    ctx,
    offsetX,
    x - spec.flyW / 2,
    y - spec.frontH / 2 - 10,
    spec.flyW,
    spec.flyH,
    spec.drumZ,
    spec.flyZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
  );
}

function drawGasworks(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  x: number,
  y: number,
  stone: WallPalette,
  roof: { readonly top: string; readonly edge: string },
  theme: RtsTheme,
  lineWidth: number,
): void {
  const spec = PROVISIONAL_GASWORKS;
  drawCylinder(
    ctx,
    offsetX,
    x - 12,
    y - 2,
    spec.holderR,
    0,
    spec.holderZ,
    stone,
    roof.top,
    theme,
    lineWidth,
  );
  drawDome(
    ctx,
    offsetX,
    x - 12,
    y - 2,
    spec.holderR,
    spec.holderZ,
    roof,
    theme,
    lineWidth,
  );
  for (let index = 0; index < spec.holderRibs; index += 1) {
    const angle = (index / spec.holderRibs) * Math.PI * 2;
    const bx = x - 12 + Math.cos(angle) * spec.holderR;
    const by = y - 2 + Math.sin(angle) * spec.holderR;
    const bottom = project(offsetX, bx, by, 0);
    const top = project(offsetX, bx, by, spec.holderZ);
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(top.x, top.y);
    ctx.strokeStyle = theme.steel;
    ctx.lineWidth = lineWidth * 0.6;
    ctx.stroke();
  }
  drawPrismBlock(
    ctx,
    offsetX,
    x + 10,
    y - spec.retortH / 2,
    spec.retortW,
    spec.retortH,
    0,
    spec.retortZ,
    stone,
    roof.edge,
    theme,
    lineWidth,
    true,
    59,
  );
  const rise = 5;
  drawSawtoothRoof(
    ctx,
    offsetX,
    x + 10,
    y - spec.retortH / 2,
    spec.retortW,
    spec.retortH,
    spec.retortZ,
    rise,
    roof,
    theme,
    lineWidth,
  );
  drawPrismBlock(
    ctx,
    offsetX,
    x + 10 + spec.retortW - spec.chimneyW,
    y - 6,
    spec.chimneyW,
    spec.chimneyW,
    0,
    spec.chimneyZ,
    stone,
    ink(theme),
    theme,
    lineWidth * 0.7,
  );
}

function drawLandmark(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: LandmarkRec,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const { x, y } = rec.landmark.at;
  const stone = (theme.walls[1] ?? theme.walls[0]) as WallPalette;
  const greyStone = (theme.walls[5] ?? theme.walls[1] ?? theme.walls[0]) as WallPalette;
  const roof = (theme.roofs[0] ?? { top: '#8d775b', edge: '#5a4936' }) as {
    readonly top: string;
    readonly edge: string;
  };
  const slate = (theme.roofs[3] ?? theme.roofs[0] ?? roof) as {
    readonly top: string;
    readonly edge: string;
  };

  switch (rec.landmark.kind) {
    case 'square':
      drawSquareLandmark(ctx, offsetX, x, y, greyStone, slate, theme, lineWidth);
      break;
    case 'cathedral':
      drawCathedral(ctx, offsetX, x, y, stone, slate, theme, lineWidth);
      break;
    case 'station':
      drawStation(ctx, offsetX, x, y, stone, slate, theme, lineWidth);
      break;
    case 'market':
      drawMarket(ctx, offsetX, x, y, stone, roof, theme, lineWidth);
      break;
    case 'sportsGround':
      drawSportsGround(ctx, offsetX, x, y, theme, lineWidth);
      break;
    case 'townHall':
      drawTownHall(ctx, offsetX, x, y, stone, slate, theme, lineWidth);
      break;
    case 'church':
      drawChurch(ctx, offsetX, x, y, greyStone, slate, theme, lineWidth);
      break;
    case 'gardens':
      drawGardens(ctx, offsetX, x, y, theme, lineWidth);
      break;
    case 'hospital':
      drawHospital(ctx, offsetX, x, y, greyStone, slate, theme, lineWidth);
      break;
    case 'museum':
      drawMuseum(ctx, offsetX, x, y, stone, roof, theme, lineWidth);
      break;
    case 'university':
      drawUniversity(ctx, offsetX, x, y, stone, slate, theme, lineWidth);
      break;
    case 'theatre':
      drawTheatre(ctx, offsetX, x, y, stone, roof, theme, lineWidth);
      break;
    case 'gasworks':
      drawGasworks(ctx, offsetX, x, y, greyStone, slate, theme, lineWidth);
      break;
    default:
      drawMarket(ctx, offsetX, x, y, stone, roof, theme, lineWidth);
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Furniture
 * ------------------------------------------------------------------ */

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: FurnitureRec,
  theme: RtsTheme,
  lineWidth: number,
): void {
  const { furniture } = rec;
  if (furniture.kind === 'lamp') {
    const base = project(offsetX, furniture.x, furniture.y, 0);
    const top = project(offsetX, furniture.x, furniture.y, PROVISIONAL_FURNITURE.lampHeight);
    ctx.strokeStyle = theme.steel;
    ctx.lineWidth = lineWidth * 1.1;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(top.x, top.y - 1, PROVISIONAL_FURNITURE.lampHead, 0, Math.PI * 2);
    ctx.fillStyle = theme.windowLit;
    ctx.fill();
    ctx.strokeStyle = ink(theme);
    ctx.lineWidth = lineWidth * 0.6;
    ctx.stroke();
  } else if (furniture.kind === 'cab') {
    const cos = Math.cos(furniture.angle);
    const sin = Math.sin(furniture.angle);
    const half = PROVISIONAL_FURNITURE.cabLength / 2;
    const a = project(offsetX, furniture.x - cos * half, furniture.y - sin * half, 0);
    const b = project(offsetX, furniture.x + cos * half, furniture.y + sin * half, 0);
    const topA = { x: a.x, y: a.y - PROVISIONAL_FURNITURE.cabHeight };
    const topB = { x: b.x, y: b.y - PROVISIONAL_FURNITURE.cabHeight };
    fillPoly(ctx, [a, b, topB, topA], theme.sidewalk, ink(theme), lineWidth * 0.7);
    for (const point of [a, b]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, PROVISIONAL_FURNITURE.wheelRadius, 0, Math.PI * 2);
      ctx.fillStyle = ink(theme);
      ctx.fill();
    }
  } else if (furniture.kind === 'railing') {
    const half = furniture.size / 2;
    const cos = Math.cos(furniture.angle);
    const sin = Math.sin(furniture.angle);
    const start = project(offsetX, furniture.x - cos * half, furniture.y - sin * half, 0);
    const end = project(offsetX, furniture.x + cos * half, furniture.y + sin * half, 0);
    ctx.strokeStyle = theme.steel;
    ctx.lineWidth = lineWidth * 0.7;
    const ticks = Math.max(2, Math.floor(furniture.size / PROVISIONAL_FURNITURE.railingTick));
    for (let index = 0; index <= ticks; index += 1) {
      const t = index / ticks;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - PROVISIONAL_FURNITURE.railingHeight);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y - PROVISIONAL_FURNITURE.railingHeight);
    ctx.lineTo(end.x, end.y - PROVISIONAL_FURNITURE.railingHeight);
    ctx.stroke();
  } else {
    const base = project(offsetX, furniture.x, furniture.y, 0);
    ctx.beginPath();
    ctx.arc(base.x, base.y, PROVISIONAL_FURNITURE.bollardRadius, 0, Math.PI * 2);
    ctx.fillStyle = theme.steel;
    ctx.fill();
    ctx.strokeStyle = ink(theme);
    ctx.lineWidth = lineWidth * 0.5;
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ *
 * Scene assembly
 * ------------------------------------------------------------------ */

function drawScene(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  hatchLight: CanvasPattern | null,
  hatchDense: CanvasPattern | null,
  visibleBuildings: readonly BuildingRec[],
  visibleTrees: readonly TreeRec[],
  visibleLandmarks: readonly LandmarkRec[],
  visibleFurniture: readonly FurnitureRec[],
  theme: RtsTheme,
  detail: boolean,
  lineWidth: number,
): void {
  const ordered: { depth: number; draw: () => void }[] = [];
  for (const rec of visibleBuildings) {
    ordered.push({
      depth: rec.depth,
      draw: () => drawBuilding(ctx, offsetX, rec, theme, detail, lineWidth, hatchLight, hatchDense),
    });
  }
  for (const rec of visibleLandmarks) {
    ordered.push({ depth: rec.depth, draw: () => drawLandmark(ctx, offsetX, rec, theme, lineWidth) });
  }
  for (const rec of visibleTrees) {
    ordered.push({
      depth: rec.depth,
      draw: () => {
        const base = project(offsetX, rec.tree.x, rec.tree.y, 0);
        const top = project(offsetX, rec.tree.x, rec.tree.y, 7 + rec.tree.r * 0.9);
        const radius = Math.max(3, rec.tree.r * 0.9);
        ctx.strokeStyle = theme.treeTrunk;
        ctx.lineWidth = lineWidth * 1.4;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(top.x, top.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = theme.tree;
        ctx.fill();
        ctx.strokeStyle = ink(theme);
        ctx.lineWidth = lineWidth * 0.6;
        ctx.stroke();
      },
    });
  }
  for (const rec of visibleFurniture) {
    ordered.push({
      depth: rec.depth,
      draw: () => drawFurniture(ctx, offsetX, rec, theme, lineWidth),
    });
  }
  ordered.sort((left, right) => left.depth - right.depth);
  for (const item of ordered) item.draw();
}

interface RouteRec {
  /** Projected centreline, before the parallel-mode screen offset. */
  readonly path: readonly MapPoint[];
  readonly mode: GraphEdge['mode'];
  readonly box: Box;
}

interface PlateScene {
  readonly buildings: readonly BuildingRec[];
  readonly trees: readonly TreeRec[];
  readonly streets: readonly StreetRec[];
  readonly blocks: readonly BlockRec[];
  readonly landmarks: readonly LandmarkRec[];
  readonly furniture: readonly FurnitureRec[];
  readonly routes: readonly RouteRec[];
  readonly gridBuildings: ReadonlyMap<string, number[]>;
  readonly gridTrees: ReadonlyMap<string, number[]>;
  readonly gridBlocks: ReadonlyMap<string, number[]>;
  readonly gridStreets: ReadonlyMap<string, number[]>;
  readonly gridRoutes: ReadonlyMap<string, number[]>;
}

interface PlateTile {
  readonly canvas: HTMLCanvasElement;
  /** World rect, including the one-pixel overlap that hides seams. */
  readonly rect: Box;
  used: number;
}

interface PlateTileCache {
  readonly scene: PlateScene;
  readonly theme: RtsTheme;
  readonly offsetX: number;
  readonly scaleBucket: number;
  readonly tiles: Map<string, PlateTile>;
  frame: number;
  lastChange: number;
}

interface PlateOverview {
  readonly canvas: HTMLCanvasElement;
  /** The whole projected city, in world coordinates. */
  readonly rect: Box;
  readonly scene: PlateScene;
  readonly theme: RtsTheme;
  readonly offsetX: number;
}

/**
 * Stroke one route. Widths, offsets and dashes are authored in screen pixels
 * and divided by the plate scale, so the ribbon matches the SVG grammar.
 */
function strokeRoute(
  ctx: CanvasRenderingContext2D,
  rec: RouteRec,
  theme: RtsTheme,
  scale: number,
  casing: boolean,
): void {
  const style = NETWORK_STYLE[rec.mode];
  const points = offsetPolyline(rec.path, modeOffset(rec.mode), scale);
  path(ctx, points);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = (casing ? style.casing : style.width) / scale;
  ctx.strokeStyle = casing ? (theme.routeCasing ?? theme.shadow) : routeColour(theme, rec.mode);
  // The casing follows the same dash as the colour: a solid casing under a
  // dashed line reads as a solid route with dark gaps.
  ctx.setLineDash(dashArray(style.dash).map((value) => value / scale));
  ctx.stroke();
}

/** Routes that intersect the current plate view, with overview sparseness. */
function visiblePlateRoutes(scene: PlateScene, view: Box, screenScale: number): readonly RouteRec[] {
  const scale = Math.max(screenScale, 0.1);
  const routePad = Math.max(16, 18 / scale);
  const cameraBox: Box = {
    minX: view.minX - routePad,
    minY: view.minY - routePad,
    maxX: view.maxX + routePad,
    maxY: view.maxY + routePad,
  };
  const sparse = screenScale < 0.62 && scene.routes.length > 400;
  return queryGrid(scene.gridRoutes, cameraBox)
    .map((index) => scene.routes[index])
    .filter((rec): rec is RouteRec => rec !== undefined && intersects(rec.box, cameraBox))
    .filter((rec) => !sparse || rec.mode !== 'taxi');
}

/**
 * Draw the permanent routes on the ground. A later casing must not run through
 * an earlier route at a junction, so every casing is stroked before any colour.
 */
function paintPlateRoutes(
  ctx: CanvasRenderingContext2D,
  routes: readonly RouteRec[],
  theme: RtsTheme,
  screenScale: number,
): void {
  const scale = Math.max(screenScale, 0.1);
  for (const rec of routes) strokeRoute(ctx, rec, theme, scale, true);
  for (const rec of routes) strokeRoute(ctx, rec, theme, scale, false);
  ctx.setLineDash([]);
}

/**
 * Punch a narrow, partial hole in the building layer along each route. Only the
 * route and its keyline show through the house; the rest of the house, and the
 * street/ground around it, stay opaque.
 */
function cutRouteBands(
  ctx: CanvasRenderingContext2D,
  routes: readonly RouteRec[],
  screenScale: number,
): void {
  if (routes.length === 0) return;
  const scale = Math.max(screenScale, 0.1);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = PROVISIONAL_ROUTE_CUTOUT_ALPHA;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  for (const rec of routes) {
    const style = NETWORK_STYLE[rec.mode];
    const points = offsetPolyline(rec.path, modeOffset(rec.mode), scale);
    path(ctx, points);
    ctx.lineWidth = style.casing / scale;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw the static city into any 2D context. The same routine fills the
 * offscreen plate cache; keeping it separate from the component means the cache
 * and any direct fallback cannot drift apart.
 */
function paintPlate(
  ctx: CanvasRenderingContext2D,
  scene: PlateScene,
  offsetX: number,
  theme: RtsTheme,
  view: Box,
  screenScale: number,
  pixelRatio: number,
): void {
  const quality = screenScale * pixelRatio;
  const board = theme.board === true;
  // Board linework is deliberately heavier: one uniform ink contour holds the
  // flat fills together at every zoom.
  const lineWidth =
    (1 / Math.max(screenScale, 0.2)) * (board ? 1.5 : 1) * (theme.outlineScale ?? 1);
  const detail = screenScale > 0.9;
  /*
   * Only geometry that can paint outside its own projected box needs padding:
   * the vintage plate's cast shadows and hatch overdraw. The board is flat
   * prisms, so a few pixels cover its strokes and cut each tile's building list
   * substantially.
   */
  const cullPad = board ? 8 : 32;
  const cameraBox: Box = {
    minX: view.minX - cullPad,
    minY: view.minY - cullPad,
    maxX: view.maxX + cullPad,
    maxY: view.maxY + cullPad,
  };

  ctx.setTransform(quality, 0, 0, quality, -view.minX * quality, -view.minY * quality);
  const grain = board ? null : paperGrain(ctx);
  ctx.fillStyle = theme.ground;
  ctx.fillRect(view.minX, view.minY, view.maxX - view.minX, view.maxY - view.minY);
  if (grain !== null) {
    ctx.save();
    ctx.globalAlpha = PROVISIONAL_PAPER_GRAIN_ALPHA;
    ctx.fillStyle = grain;
    ctx.fillRect(view.minX, view.minY, view.maxX - view.minX, view.maxY - view.minY);
    ctx.restore();
  }

  for (const blockIndex of queryGrid(scene.gridBlocks, cameraBox)) {
    const block = scene.blocks[blockIndex];
    if (block === undefined || !intersects(block.box, cameraBox)) continue;
    fillPoly(
      ctx,
      block.points,
      block.park ? theme.park : theme.block,
      block.park ? theme.parkEdge : board ? undefined : theme.blockEdge,
      lineWidth * PROVISIONAL_BLOCK_EDGE_SCALE,
    );
    if (grain !== null) {
      path(ctx, block.points);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = PROVISIONAL_PAPER_GRAIN_ALPHA * 0.8;
      ctx.fillStyle = grain;
      ctx.fill();
      ctx.restore();
    }
  }
  const streetsInView = queryGrid(scene.gridStreets, cameraBox)
    .map((index) => scene.streets[index])
    .filter((street): street is StreetRec => street !== undefined && intersects(street.box, cameraBox));
  if (board) {
    // Every ink edge first, then every paper carriageway. Drawing each street
    // as ink-then-paper leaves the ink of a later street running down the
    // middle of an earlier one at junctions, which reads as a pipe.
    // Neutral road toning instead of a black ink outline: a warm grey-brown
    // edge, a lighter pavement strip, then the carriageway.
    const streetEdge = theme.streetEdge ?? theme.shadow;
    const streetPavement = theme.streetPavement ?? theme.sidewalk;
    const streetFill = theme.streetFill ?? theme.asphalt;
    for (const street of streetsInView) {
      path(ctx, street.path);
      ctx.strokeStyle = streetEdge;
      ctx.lineWidth = street.width + 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    for (const street of streetsInView) {
      path(ctx, street.path);
      ctx.strokeStyle = streetPavement;
      ctx.lineWidth = street.width + 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    for (const street of streetsInView) {
      path(ctx, street.path);
      ctx.strokeStyle = streetFill;
      ctx.lineWidth = street.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  } else {
    for (const street of streetsInView) {
      // A faint curb, not an ink silhouette: a heavy outline made every street
      // read as a drawn border rather than a road through the blocks.
      path(ctx, street.path);
      ctx.save();
      ctx.globalAlpha = PROVISIONAL_CURB_ALPHA;
      ctx.strokeStyle = theme.blockEdge;
      ctx.lineWidth = street.width + 6.5;
      ctx.stroke();
      ctx.restore();
      path(ctx, street.path);
      ctx.strokeStyle = theme.sidewalk;
      ctx.lineWidth = street.width + 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      path(ctx, street.path);
      ctx.strokeStyle = theme.asphalt;
      ctx.lineWidth = street.width;
      ctx.stroke();
      path(ctx, street.path);
      ctx.strokeStyle = theme.lane;
      ctx.lineWidth = lineWidth * 0.8;
      ctx.setLineDash([6, 11]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Strong routes sit on the streets but under the buildings. The building
  // layer is cut along these same paths later, so only the route shows through.
  const plateRoutes = visiblePlateRoutes(scene, view, screenScale);
  paintPlateRoutes(ctx, plateRoutes, theme, screenScale);

  const hatchLight = detail && !board ? hatchPattern(ctx, PROVISIONAL_HATCH_SPACING_LIGHT) : null;
  const hatchDense = detail && !board ? hatchPattern(ctx, PROVISIONAL_HATCH_SPACING_DARK) : null;
  const visibleBuildingIndices = queryGrid(scene.gridBuildings, cameraBox);
  const visibleTreeIndices = queryGrid(scene.gridTrees, cameraBox);
  const visibleBuildings = visibleBuildingIndices
    .map((index) => scene.buildings[index])
    .filter((rec): rec is BuildingRec => rec !== undefined && intersects(rec.box, cameraBox));
  const visibleTrees = visibleTreeIndices
    .map((index) => scene.trees[index])
    .filter((rec): rec is TreeRec => rec !== undefined && intersects(rec.box, cameraBox));
  const visibleLandmarks = scene.landmarks.filter((rec) => intersects(rec.box, cameraBox));
  // Furniture is deliberately absent at overview zoom: tiny props are noise when
  // the whole quarter is on screen, and the ambient-actor rule says omit.
  const visibleFurniture =
    detail && !board ? scene.furniture.filter((rec) => intersects(rec.box, cameraBox)) : [];

  // Shadows are a separate pass so they never cover a nearer building. At play
  // zoom they are hatched rather than solid: a paper plate shows its ground
  // through a cast shadow, and the gaps between terraces stay legible.
  if (!board) {
    for (const rec of visibleBuildings) {
      const base = [
        project(offsetX, rec.building.x, rec.building.y, 0),
        project(offsetX, rec.building.x + rec.building.w, rec.building.y, 0),
        project(offsetX, rec.building.x + rec.building.w, rec.building.y + rec.building.h, 0),
        project(offsetX, rec.building.x, rec.building.y + rec.building.h, 0),
      ];
      const hull = convexHull([
        ...base,
        ...base.map((point) => ({
          x: point.x + PROVISIONAL_SHADOW_OFFSET_X,
          y: point.y + PROVISIONAL_SHADOW_OFFSET_Y,
        })),
      ]);
      if (detail && hatchDense !== null) {
        ctx.save();
        ctx.globalAlpha = PROVISIONAL_SHADOW_HATCH_ALPHA;
        ctx.fillStyle = hatchDense;
        path(ctx, hull);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = PROVISIONAL_SHADOW_TINT_ALPHA;
        fillPoly(ctx, hull, theme.shadow, undefined);
        ctx.restore();
      } else {
        fillPoly(ctx, hull, theme.shadow, undefined);
      }
    }
  }

  /*
   * Buildings, trees and landmarks go onto a transparent layer. Cutting the
   * route bands out of that layer means the route is visible through a house
   * only where it actually passes underneath, and the street/ground around it
   * does not bleed through.
   */
  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = ctx.canvas.width;
  layerCanvas.height = ctx.canvas.height;
  const layerCtx = layerCanvas.getContext('2d');
  if (layerCtx !== null) {
    layerCtx.setTransform(quality, 0, 0, quality, -view.minX * quality, -view.minY * quality);
    drawScene(
      layerCtx,
      offsetX,
      hatchLight,
      hatchDense,
      visibleBuildings,
      visibleTrees,
      visibleLandmarks,
      visibleFurniture,
      theme,
      detail,
      lineWidth,
    );
    cutRouteBands(layerCtx, plateRoutes, screenScale);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layerCanvas, 0, 0);
    ctx.restore();
  } else {
    drawScene(
      ctx,
      offsetX,
      hatchLight,
      hatchDense,
      visibleBuildings,
      visibleTrees,
      visibleLandmarks,
      visibleFurniture,
      theme,
      detail,
      lineWidth,
    );
  }
}

export function CanvasCity({ map, theme, viewBox, stage }: CanvasCityProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetX = map.bounds.height * ISO_X;

  const scene = useMemo(() => {
    const gridBuildings = new Map<string, number[]>();
    const gridTrees = new Map<string, number[]>();
    const gridBlocks = new Map<string, number[]>();
    const gridStreets = new Map<string, number[]>();
    const gridRoutes = new Map<string, number[]>();
    const nodeById = new Map(
      map.graph.nodes.map((node) => [node.id, { x: node.x, y: node.y }] as const),
    );
    const routes: RouteRec[] = sortedNetworkEdges(map.graph.edges)
      .map((edge) => {
        const path = projectPath(offsetX, edgePoints(edge, nodeById));
        return { path, mode: edge.mode, box: boxOf(path) };
      })
      .filter((rec) => rec.path.length >= 2);
    routes.forEach((rec, index) => insertGrid(gridRoutes, index, rec.box));

    const buildings: BuildingRec[] = buildingsForMap(map).map((building) => {
      const height = buildingHeight(building, theme.board === true);
      const hash = building.hash;
      const corners = [
        project(offsetX, building.x, building.y, 0),
        project(offsetX, building.x + building.w, building.y, 0),
        project(offsetX, building.x + building.w, building.y + building.h, 0),
        project(offsetX, building.x, building.y + building.h, 0),
        project(offsetX, building.x, building.y, height),
        project(offsetX, building.x + building.w, building.y, height),
        project(offsetX, building.x + building.w, building.y + building.h, height),
        project(offsetX, building.x, building.y + building.h, height),
      ];
      const wall = theme.walls[hash % theme.walls.length] as WallPalette;
      const roof = theme.roofs[hash % theme.roofs.length] as { readonly top: string; readonly edge: string };
      const box = boxOf(corners);
      return {
        building,
        height,
        depth: building.x + building.y + building.w + building.h,
        box,
        wall,
        roof,
        hash,
      };
    });
    buildings.forEach((rec, index) => insertGrid(gridBuildings, index, rec.box));
    const trees: TreeRec[] = treesForMap(map).map((tree) => {
      const base = project(offsetX, tree.x, tree.y, 0);
      const top = project(offsetX, tree.x, tree.y, 7 + tree.r * 0.9);
      const box = boxOf([base, top]);
      return { tree, depth: tree.x + tree.y + 2, box };
    });
    trees.forEach((rec, index) => insertGrid(gridTrees, index, rec.box));
    const streetWidths: readonly [number, number, number] = theme.board === true ? [10, 13, 17] : [8, 11, 14];
    const streets: StreetRec[] = map.city.streets.map((street) => {
      const path = projectPath(offsetX, street.path);
      return { path, width: street.rank === 0 ? streetWidths[0] : street.rank === 1 ? streetWidths[1] : streetWidths[2], box: boxOf(path) };
    });
    const blocks: BlockRec[] = map.city.blocks.map((block) => {
      const points = projectPath(offsetX, block.polygon);
      return { points, park: block.kind === 'park', box: boxOf(points) };
    });
    blocks.forEach((rec, index) => insertGrid(gridBlocks, index, rec.box));
    streets.forEach((rec, index) => insertGrid(gridStreets, index, rec.box));
    const landmarks: LandmarkRec[] = map.city.landmarks.map((landmark) => {
      const { x, y } = landmark.at;
      const corners = [
        project(offsetX, x - 64, y - 34, 0),
        project(offsetX, x + 64, y - 34, 0),
        project(offsetX, x + 64, y + 34, 0),
        project(offsetX, x - 64, y + 34, 0),
        project(offsetX, x - 64, y - 34, 64),
        project(offsetX, x + 64, y + 34, 64),
      ];
      return { landmark, depth: x + y, box: boxOf(corners) };
    });
    const furniture: FurnitureRec[] = furnitureForMap(map).map((item) => {
      const base = project(offsetX, item.x, item.y, 0);
      const top = project(offsetX, item.x, item.y, 12);
      return { furniture: item, depth: item.x + item.y + 1, box: boxOf([base, top]) };
    });
    return {
      buildings,
      trees,
      streets,
      blocks,
      landmarks,
      furniture,
      routes,
      gridBuildings,
      gridTrees,
      gridBlocks,
      gridStreets,
      gridRoutes,
    };
  }, [map, offsetX, theme]);

  const tileCacheRef = useRef<PlateTileCache | null>(null);
  const overviewRef = useRef<PlateOverview | null>(null);
  const prefetchTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const [revision, setRevision] = useState(0);

  /*
   * Draw before paint, not after: the SVG overlay updates its `viewBox` during
   * the React commit, and an effect that runs after paint leaves the canvas one
   * frame behind while the camera moves. That is the visible route/house drift
   * this replaces.
   */
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const view = parseViewBox(viewBox);
    if (canvas === null || view === null || stage.width <= 0 || stage.height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(stage.width * dpr);
    const pixelHeight = Math.round(stage.height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    const screenScale = stage.width / view.width;
    const cityRect: Box = {
      minX: 0,
      minY: 0,
      maxX: (map.bounds.width + map.bounds.height) * ISO_X,
      maxY: (map.bounds.width + map.bounds.height) * ISO_Y,
    };
    const fit = Math.min(
      stage.width / Math.max(1, cityRect.maxX - cityRect.minX),
      stage.height / Math.max(1, cityRect.maxY - cityRect.minY),
    );
    const overviewOnly = screenScale <= fit * PROVISIONAL_PLATE_OVERVIEW_MAX_FACTOR;

    /*
     * One low-resolution image of the whole city. It fills the free map view
     * without tiles, and sits under the play view so a zoom-out never exposes
     * blank paper while the high-resolution tiles are being rebuilt.
     */
    let overview = overviewRef.current;
    if (
      overview === null ||
      overview.scene !== scene ||
      overview.theme !== theme ||
      overview.offsetX !== offsetX
    ) {
      const overviewWidth = Math.max(1, cityRect.maxX - cityRect.minX);
      const overviewHeight = Math.max(1, cityRect.maxY - cityRect.minY);
      let quality = Math.min(
        dpr * fit,
        Math.sqrt(PROVISIONAL_PLATE_OVERVIEW_MAX_PIXELS / (overviewWidth * overviewHeight)),
      );
      if (!Number.isFinite(quality) || quality <= 0) quality = 0.2;
      const width = Math.max(1, Math.ceil(overviewWidth * quality));
      const height = Math.max(1, Math.ceil(overviewHeight * quality));
      const overviewCanvas = document.createElement('canvas');
      overviewCanvas.width = width;
      overviewCanvas.height = height;
      const exact: Box = {
        minX: cityRect.minX,
        minY: cityRect.minY,
        maxX: cityRect.minX + width / quality,
        maxY: cityRect.minY + height / quality,
      };
      const overviewCtx = overviewCanvas.getContext('2d');
      if (overviewCtx !== null) {
        overviewCtx.setTransform(1, 0, 0, 1, 0, 0);
        overviewCtx.fillStyle = theme.ground;
        overviewCtx.fillRect(0, 0, width, height);
        paintPlate(overviewCtx, scene, offsetX, theme, exact, fit, quality / fit);
      }
      overview = { canvas: overviewCanvas, rect: exact, scene, theme, offsetX };
      overviewRef.current = overview;
    }
    if (overview === null) return;

    let cache = tileCacheRef.current;
    const cacheStale =
      cache === null ||
      cache.scene !== scene ||
      cache.theme !== theme ||
      cache.offsetX !== offsetX ||
      Math.abs(Math.log(screenScale / cache.scaleBucket)) >
        Math.log(PROVISIONAL_PLATE_TILE_REBUILD_RATIO);
    if (cacheStale) {
      cache = {
        scene,
        theme,
        offsetX,
        scaleBucket: screenScale,
        tiles: new Map<string, PlateTile>(),
        frame: 0,
        lastChange: 0,
      };
      tileCacheRef.current = cache;
    }
    if (cache === null) return;
    const renderScale = cache.scaleBucket;
    cache.frame += 1;
    cache.lastChange = performance.now();

    const drawn: PlateTile[] = [];
    if (!overviewOnly) {
      const worldTile = PROVISIONAL_PLATE_TILE_CSS / renderScale;
      const overlap = PROVISIONAL_PLATE_TILE_OVERLAP_CSS / renderScale;
      const quality = dpr * renderScale;
      const firstX = Math.floor(view.x / worldTile);
      const firstY = Math.floor(view.y / worldTile);
      const lastX = Math.floor((view.x + view.width) / worldTile);
      const lastY = Math.floor((view.y + view.height) / worldTile);

      const ensureTile = (tileX: number, tileY: number): PlateTile => {
        const key = `${tileX},${tileY}`;
        const existing = cache.tiles.get(key);
        if (existing !== undefined) {
          existing.used = cache.frame;
          return existing;
        }
        const rect: Box = {
          minX: tileX * worldTile - overlap,
          minY: tileY * worldTile - overlap,
          maxX: (tileX + 1) * worldTile + overlap,
          maxY: (tileY + 1) * worldTile + overlap,
        };
        const tileCanvas = document.createElement('canvas');
        const width = Math.max(1, Math.ceil((rect.maxX - rect.minX) * quality));
        const height = Math.max(1, Math.ceil((rect.maxY - rect.minY) * quality));
        tileCanvas.width = width;
        tileCanvas.height = height;
        // Paint to the exact pixel extent of the canvas. Using the pre-rounding
        // rect would stretch the tile by up to one pixel and reintroduce a seam.
        const exact: Box = {
          minX: rect.minX,
          minY: rect.minY,
          maxX: rect.minX + width / quality,
          maxY: rect.minY + height / quality,
        };
        const tileCtx = tileCanvas.getContext('2d');
        if (tileCtx !== null) {
          tileCtx.setTransform(1, 0, 0, 1, 0, 0);
          tileCtx.fillStyle = theme.ground;
          tileCtx.fillRect(0, 0, width, height);
          paintPlate(tileCtx, scene, offsetX, theme, exact, renderScale, dpr);
        }
        const tile = { canvas: tileCanvas, rect: exact, used: cache.frame };
        cache.tiles.set(key, tile);
        return tile;
      };

      for (let tileX = firstX; tileX <= lastX; tileX += 1) {
        for (let tileY = firstY; tileY <= lastY; tileY += 1) {
          drawn.push(ensureTile(tileX, tileY));
        }
      }

      /*
       * Warm the one-tile ring once the camera has been still for a moment. A
       * drag that crosses a tile boundary then blits instead of painting. The
       * work is chunked and skips itself if the camera moves again.
       */
      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
      const ring: { readonly x: number; readonly y: number }[] = [];
      for (let tileX = firstX - 1; tileX <= lastX + 1; tileX += 1) {
        for (let tileY = firstY - 1; tileY <= lastY + 1; tileY += 1) {
          if (tileX >= firstX && tileX <= lastX && tileY >= firstY && tileY <= lastY) continue;
          if (!cache.tiles.has(`${tileX},${tileY}`)) ring.push({ x: tileX, y: tileY });
        }
      }
      if (ring.length > 0) {
        const scheduled = cache;
        const tick = (): void => {
          prefetchTimerRef.current = null;
          if (tileCacheRef.current !== scheduled) return;
          if (performance.now() - scheduled.lastChange < 220) {
            prefetchTimerRef.current = window.setTimeout(tick, 120);
            return;
          }
          const next = ring.shift();
          if (next === undefined) return;
          ensureTile(next.x, next.y);
          if (ring.length > 0) prefetchTimerRef.current = window.setTimeout(tick, 24);
        };
        prefetchTimerRef.current = window.setTimeout(tick, 220);
      }

      // Keep memory bounded while still allowing a reverse pan to reuse tiles.
      if (cache.tiles.size > PROVISIONAL_PLATE_TILE_LIMIT) {
        const entries = [...cache.tiles.entries()].sort(
          (left, right) => left[1].used - right[1].used,
        );
        for (const [key, tile] of entries) {
          if (cache.tiles.size <= PROVISIONAL_PLATE_TILE_LIMIT) break;
          if (tile.used === cache.frame) continue;
          cache.tiles.delete(key);
          tile.canvas.width = 0;
          tile.canvas.height = 0;
        }
      }
    } else if (prefetchTimerRef.current !== null) {
      window.clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.setTransform(
      dpr * screenScale,
      0,
      0,
      dpr * screenScale,
      -view.x * screenScale * dpr,
      -view.y * screenScale * dpr,
    );
    ctx.fillStyle = theme.ground;
    ctx.fillRect(view.x, view.y, view.width, view.height);
    ctx.drawImage(
      overview.canvas,
      overview.rect.minX,
      overview.rect.minY,
      overview.rect.maxX - overview.rect.minX,
      overview.rect.maxY - overview.rect.minY,
    );
    for (const tile of drawn) {
      const width = tile.rect.maxX - tile.rect.minX;
      const height = tile.rect.maxY - tile.rect.minY;
      if (width <= 0 || height <= 0) continue;
      ctx.drawImage(tile.canvas, tile.rect.minX, tile.rect.minY, width, height);
    }

    // A final fine grain unifies the sheet without hiding the ink. It stays in
    // screen space so the grain size does not change with the camera.
    if (theme.board !== true) {
      const grain = paperGrain(ctx);
      if (grain !== null) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = PROVISIONAL_PAPER_GRAIN_ALPHA * 0.2;
        ctx.fillStyle = grain;
        ctx.fillRect(0, 0, stage.width, stage.height);
        ctx.restore();
      }
    }

    /*
     * A zoom reuses tiles at their painted scale, then sharpens once when the
     * camera settles. Rebuilding on every scale change made a wheel zoom take
     * hundreds of milliseconds per frame.
     */
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (
      !overviewOnly &&
      Math.abs(Math.log(screenScale / renderScale)) > Math.log(PROVISIONAL_PLATE_SETTLE_RATIO)
    ) {
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        tileCacheRef.current = null;
        setRevision((value) => value + 1);
      }, PROVISIONAL_PLATE_SETTLE_MS);
    }

    return () => {
      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [map, offsetX, revision, scene, stage.height, stage.width, theme, viewBox]);


  return <canvas ref={canvasRef} className="city-plate canvas-city" aria-label={`${theme.title} city`} />;
}
