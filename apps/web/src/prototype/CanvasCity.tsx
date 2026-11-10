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

import { useEffect, useMemo, useRef } from 'react';

import type { GeneratedMap, LandmarkModel, MapPoint } from '@x-yard/map-generator';

import {
  buildingsForMap,
  treesForMap,
  type Building,
  type Tree,
} from './city';
import type { RtsTheme, WallPalette } from '../lab/rts/rtsTheme';

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

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / GRID)},${Math.floor(y / GRID)}`;
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

function queryGrid(grid: Map<string, number[]>, view: Box): readonly number[] {
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

function buildingHeight(building: Building): number {
  const hash = hashString(building.key);
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

let hatchTile: HTMLCanvasElement | null = null;

function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (hatchTile === null) {
    hatchTile = document.createElement('canvas');
    hatchTile.width = 6;
    hatchTile.height = 6;
    const tileCtx = hatchTile.getContext('2d');
    if (tileCtx === null) return null;
    tileCtx.strokeStyle = '#3d3428';
    tileCtx.lineWidth = 0.6;
    tileCtx.beginPath();
    tileCtx.moveTo(-1, 7);
    tileCtx.lineTo(7, -1);
    tileCtx.stroke();
  }
  return ctx.createPattern(hatchTile, 'repeat');
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: BuildingRec,
  theme: RtsTheme,
  detail: boolean,
  lineWidth: number,
  hatch: CanvasPattern | null,
): void {
  const style = prism(offsetX, rec.building.x, rec.building.y, rec.building.w, rec.building.h, 0, rec.height);
  const gable = detail && rec.height <= 18 && rec.hash % 3 === 0;
  const sideColour: Record<0 | 1 | 2 | 3, string> = {
    0: rec.wall.dark,
    1: rec.wall.light,
    2: rec.wall.mid,
    3: rec.wall.dark,
  };
  const sides = [...style.sides].sort((left, right) => left.depth - right.depth);
  for (const face of sides) {
    fillPoly(ctx, face.points, sideColour[face.side], theme.shadow, lineWidth * 0.7);
    if (detail && hatch !== null) {
      path(ctx, face.points);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = hatch;
      ctx.fill();
      ctx.restore();
    }
    if (detail && (face.side === 1 || face.side === 2)) {
      const [a, b, c, d] = face.points;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const u = 0.14 + (col * 0.72) / 3;
          const v = 0.22 + (row * 0.5) / 2;
          const p0 = lerp(lerp(a, b, u), lerp(d, c, u), v);
          const p1 = lerp(lerp(a, b, u + 0.16), lerp(d, c, u + 0.16), v);
          const p2 = lerp(lerp(a, b, u + 0.16), lerp(d, c, u + 0.16), v + 0.2);
          const p3 = lerp(lerp(a, b, u), lerp(d, c, u), v + 0.2);
          const lit = (rec.hash + row * 11 + col * 17 + face.side) % 100 < theme.windowLitChance * 100;
          fillPoly(ctx, [p0, p1, p2, p3], lit ? theme.windowLit : theme.window, theme.shadow, lineWidth * 0.25);
        }
      }
    }
  }
  if (gable) {
    const [t0, t1, t2, t3] = style.top;
    const ridgeA = { ...lerp(t0 as P, t3 as P, 0.5), y: lerp(t0 as P, t3 as P, 0.5).y - 4 };
    const ridgeB = { ...lerp(t1 as P, t2 as P, 0.5), y: lerp(t1 as P, t2 as P, 0.5).y - 4 };
    fillPoly(ctx, [t0 as P, t1 as P, ridgeB, ridgeA], rec.roof.top, rec.roof.edge, lineWidth);
    fillPoly(ctx, [ridgeA, ridgeB, t2 as P, t3 as P], rec.roof.edge, theme.shadow, lineWidth * 0.7);
    ctx.strokeStyle = theme.sun;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(ridgeA.x, ridgeA.y);
    ctx.lineTo(ridgeB.x, ridgeB.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    fillPoly(ctx, style.top, rec.roof.top, rec.roof.edge, lineWidth);
    if (detail && hatch !== null) {
      path(ctx, style.top);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = hatch;
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawLandmark(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  rec: LandmarkRec,
  theme: RtsTheme,
  detail: boolean,
  lineWidth: number,
): void {
  const { x, y } = rec.landmark.at;
  const wall = theme.walls[1] as WallPalette;
  const roof = theme.roofs[0] as { top: string; edge: string };
  if (rec.landmark.kind === 'square') {
    const center = project(offsetX, x, y, 0);
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, 28, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = theme.stationPad;
    ctx.fill();
    ctx.strokeStyle = theme.blockEdge;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = theme.water;
    ctx.fill();
    return;
  }
  if (rec.landmark.kind === 'cathedral') {
    const base = prism(offsetX, x - 36, y - 18, 72, 36, 0, 18);
    const tower = prism(offsetX, x - 8, y - 8, 16, 16, 18, 42);
    for (const face of [...base.sides].sort((left, right) => left.depth - right.depth)) {
      fillPoly(ctx, face.points, face.side === 2 ? wall.mid : wall.dark, theme.shadow, lineWidth);
    }
    fillPoly(ctx, base.top, theme.roofs[1]?.top ?? roof.top, theme.shadow, lineWidth);
    for (const face of [...tower.sides].sort((left, right) => left.depth - right.depth)) {
      fillPoly(ctx, face.points, face.side === 2 ? wall.light : wall.mid, theme.shadow, lineWidth);
    }
    fillPoly(ctx, tower.top, roof.top, theme.shadow, lineWidth);
    const top = project(offsetX, x, y, 42);
    const spire = project(offsetX, x, y, 58);
    fillPoly(ctx, [top, { x: top.x - 7, y: top.y + 2 }, spire], roof.edge, theme.shadow, lineWidth);
    return;
  }
  if (rec.landmark.kind === 'station') {
    const base = prism(offsetX, x - 46, y - 20, 92, 40, 0, 16);
    const glass = prism(offsetX, x - 50, y - 24, 100, 48, 16, 24);
    for (const face of [...base.sides].sort((left, right) => left.depth - right.depth)) {
      fillPoly(ctx, face.points, face.side === 2 ? wall.mid : wall.dark, theme.shadow, lineWidth);
    }
    fillPoly(ctx, base.top, theme.roofs[1]?.top ?? roof.top, theme.shadow, lineWidth);
    for (const face of [...glass.sides].sort((left, right) => left.depth - right.depth)) {
      fillPoly(ctx, face.points, theme.window, theme.shadow, lineWidth);
    }
    fillPoly(ctx, glass.top, theme.window, theme.steel, lineWidth);
    return;
  }
  const base = prism(offsetX, x - 30, y - 16, 60, 32, 0, 12);
  for (const face of [...base.sides].sort((left, right) => left.depth - right.depth)) {
    fillPoly(ctx, face.points, face.side === 2 ? wall.mid : wall.dark, theme.shadow, lineWidth);
  }
  fillPoly(ctx, base.top, theme.roofs[2]?.top ?? roof.top, theme.shadow, lineWidth);
  if (detail) {
    const center = project(offsetX, x, y, 12);
    ctx.fillStyle = theme.rust;
    ctx.fillRect(center.x - 8, center.y - 3, 16, 3);
  }
}

function drawTreesAndBuildings(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  hatch: CanvasPattern | null,
  scene: { readonly buildings: readonly BuildingRec[]; readonly trees: readonly TreeRec[] },
  visibleBuildings: readonly BuildingRec[],
  visibleTrees: readonly TreeRec[],
  visibleLandmarks: readonly LandmarkRec[],
  theme: RtsTheme,
  detail: boolean,
  lineWidth: number,
): void {
  const ordered: { depth: number; draw: () => void }[] = [];
  for (const rec of visibleBuildings) ordered.push({ depth: rec.depth, draw: () => drawBuilding(ctx, offsetX, rec, theme, detail, lineWidth, hatch) });
  for (const rec of visibleLandmarks) {
    ordered.push({ depth: rec.depth, draw: () => drawLandmark(ctx, offsetX, rec, theme, detail, lineWidth) });
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
        ctx.strokeStyle = theme.shadow;
        ctx.lineWidth = lineWidth * 0.6;
        ctx.stroke();
      },
    });
  }
  ordered.sort((left, right) => left.depth - right.depth);
  for (const item of ordered) item.draw();
  // Avoid an unused-parameter diagnostic in archive builds.
  void scene;
}

function drawLandmarkLabels(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  landmarks: readonly LandmarkRec[],
  theme: RtsTheme,
  scale: number,
  view: { readonly x: number; readonly y: number },
  dpr: number,
  stage: { readonly width: number; readonly height: number },
): void {
  if (landmarks.length === 0) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '700 11px Georgia, serif';
  ctx.textAlign = 'center';
  for (const rec of landmarks) {
    const at = project(offsetX, rec.landmark.at.x, rec.landmark.at.y, 44);
    const x = (at.x - view.x) * scale;
    const y = (at.y - view.y) * scale;
    if (x < -80 || x > stage.width + 80 || y < -30 || y > stage.height + 30) continue;
    const text = rec.landmark.label.toUpperCase();
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.stationPad;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = theme.shadow;
    ctx.fillText(text, x, y);
  }
}

export function CanvasCity({ map, theme, viewBox, stage }: CanvasCityProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetX = map.bounds.height * ISO_X;

  const scene = useMemo(() => {
    const gridBuildings = new Map<string, number[]>();
    const gridTrees = new Map<string, number[]>();
    const buildings: BuildingRec[] = buildingsForMap(map).map((building) => {
      const height = buildingHeight(building);
      const hash = hashString(building.key);
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
      const roof = theme.roofs[hash % theme.roofs.length] as { top: string; edge: string };
      const box = boxOf(corners);
      return { building, height, depth: building.x + building.y + building.w + building.h, box, wall, roof, hash };
    });
    buildings.forEach((rec, index) => insertGrid(gridBuildings, index, rec.box));
    const trees: TreeRec[] = treesForMap(map).map((tree) => {
      const base = project(offsetX, tree.x, tree.y, 0);
      const top = project(offsetX, tree.x, tree.y, 7 + tree.r * 0.9);
      const box = boxOf([base, top]);
      return { tree, depth: tree.x + tree.y + 2, box };
    });
    trees.forEach((rec, index) => insertGrid(gridTrees, index, rec.box));
    const streets: StreetRec[] = map.city.streets.map((street) => {
      const path = projectPath(offsetX, street.path);
      return { path, width: street.rank === 0 ? 8 : street.rank === 1 ? 11 : 14, box: boxOf(path) };
    });
    const blocks: BlockRec[] = map.city.blocks.map((block) => {
      const points = projectPath(offsetX, block.polygon);
      return { points, park: block.kind === 'park', box: boxOf(points) };
    });
    const landmarks: LandmarkRec[] = map.city.landmarks.map((landmark) => {
      const { x, y } = landmark.at;
      const corners = [
        project(offsetX, x - 50, y - 24, 0),
        project(offsetX, x + 50, y - 24, 0),
        project(offsetX, x + 50, y + 24, 0),
        project(offsetX, x - 50, y + 24, 0),
        project(offsetX, x - 50, y - 24, 48),
        project(offsetX, x + 50, y + 24, 48),
      ];
      return { landmark, depth: x + y, box: boxOf(corners) };
    });
    return { buildings, trees, streets, blocks, landmarks, gridBuildings, gridTrees };
  }, [map, offsetX, theme]);

  useEffect(() => {
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
    const scale = stage.width / view.width;
    const lineWidth = 1 / Math.max(scale, 0.2);
    const detail = scale > 0.9;
    const cameraBox: Box = { minX: view.x - 80, minY: view.y - 80, maxX: view.x + view.width + 80, maxY: view.y + view.height + 80 };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -view.x * scale * dpr, -view.y * scale * dpr);
    ctx.fillStyle = theme.ground;
    ctx.fillRect(view.x, view.y, view.width, view.height);

    for (const block of scene.blocks) {
      if (!intersects(block.box, cameraBox)) continue;
      fillPoly(ctx, block.points, block.park ? theme.park : theme.block, block.park ? theme.parkEdge : theme.blockEdge, lineWidth);
    }
    for (const street of scene.streets) {
      if (!intersects(street.box, cameraBox)) continue;
      path(ctx, street.path);
      ctx.strokeStyle = theme.sidewalk;
      ctx.lineWidth = street.width + 7;
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

    const hatch = detail ? hatchPattern(ctx) : null;
    const visibleBuildingIndices = queryGrid(scene.gridBuildings, cameraBox);
    const visibleTreeIndices = queryGrid(scene.gridTrees, cameraBox);
    const visibleBuildings = visibleBuildingIndices.map((index) => scene.buildings[index]).filter((rec): rec is BuildingRec => rec !== undefined && intersects(rec.box, cameraBox));
    const visibleTrees = visibleTreeIndices.map((index) => scene.trees[index]).filter((rec): rec is TreeRec => rec !== undefined && intersects(rec.box, cameraBox));
    const visibleLandmarks = scene.landmarks.filter((rec) => intersects(rec.box, cameraBox));

    // Shadows are a separate pass so they never cover a nearer building.
    for (const rec of visibleBuildings) {
      const base = [
        project(offsetX, rec.building.x, rec.building.y, 0),
        project(offsetX, rec.building.x + rec.building.w, rec.building.y, 0),
        project(offsetX, rec.building.x + rec.building.w, rec.building.y + rec.building.h, 0),
        project(offsetX, rec.building.x, rec.building.y + rec.building.h, 0),
      ];
      const hull = convexHull([...base, ...base.map((point) => ({ x: point.x + 22, y: point.y + 10 }))]);
      fillPoly(ctx, hull, theme.shadow, undefined);
    }

    drawTreesAndBuildings(ctx, offsetX, hatch, scene, visibleBuildings, visibleTrees, visibleLandmarks, theme, detail, lineWidth);
    if (!detail) drawLandmarkLabels(ctx, offsetX, visibleLandmarks, theme, scale, view, dpr, stage);
  }, [offsetX, scene, stage.height, stage.width, theme, viewBox]);

  return <canvas ref={canvasRef} className="city-plate canvas-city" aria-label={`${theme.title} city`} />;
}
