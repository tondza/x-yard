/**
 * Isometric RTS city fragment.
 *
 * Design lab, not the live renderer: the whole map is re-projected into a 2:1
 * isometric view, buildings are extruded with visible façades/window grids, and
 * the station/route overlay is re-projected too. This is the "Command City"
 * option; it is deliberately the most expensive direction to integrate.
 *
 * @module apps/web/lab/rts/IsoCityFragment
 */

import { memo, useMemo } from 'react';

import type {
  BlockModel,
  GeneratedMap,
  GraphEdge,
  LandmarkModel,
  MapPoint,
  NodeId,
} from '@x-yard/map-generator';

import {
  buildingsForMap,
  treesForMap,
  type Building,
  type Tree,
} from '../../prototype/city';
import type { RtsTheme, WallPalette } from './rtsTheme';

const IX = 0.9;
const IY = 0.5;
export const ISO_VIEW = { x: -80, y: 220, width: 700, height: 460 } as const;

interface CullBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function parseViewBox(viewBox: string | undefined): CullBox | null {
  if (viewBox === undefined) return null;
  const parts = viewBox.split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  return { x: parts[0] as number, y: parts[1] as number, width: parts[2] as number, height: parts[3] as number };
}

function insideCull(point: { x: number; y: number }, cull: CullBox | null, margin: number): boolean {
  if (cull === null) return true;
  return (
    point.x >= cull.x - margin &&
    point.x <= cull.x + cull.width + margin &&
    point.y >= cull.y - margin &&
    point.y <= cull.y + cull.height + margin
  );
}

interface P {
  readonly x: number;
  readonly y: number;
}

function iso(x: number, y: number, z = 0): P {
  return { x: (x - y) * IX, y: (x + y) * IY - z };
}

function lerp(a: P, b: P, t: number): P {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function points(list: readonly P[]): string {
  return list.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function pathOf(list: readonly P[]): string {
  return list.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cross(o: P, a: P, b: P): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(input: readonly P[]): P[] {
  const points = [...input].sort((left, right) => left.x - right.x || left.y - right.y);
  if (points.length <= 2) return points;
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

function buildingBase(building: Building): P[] {
  return [
    iso(building.x, building.y, 0),
    iso(building.x + building.w, building.y, 0),
    iso(building.x + building.w, building.y + building.h, 0),
    iso(building.x, building.y + building.h, 0),
  ];
}

function buildingShadow(building: Building): P[] {
  const base = buildingBase(building);
  // A screen-space cast shadow that includes the footprint itself. The shadow
  // therefore touches the base instead of sitting under a floating copy.
  const offset = base.map((point) => ({ x: point.x + 34, y: point.y + 15 }));
  return convexHull([...base, ...offset]);
}

function transformPath(path: readonly MapPoint[], z = 0): P[] {
  return path.map((point) => iso(point.x, point.y, z));
}

function transformEdge(edge: GraphEdge, nodeById: ReadonlyMap<NodeId, { x: number; y: number }>, z = 0): P[] {
  if (edge.path !== undefined && edge.path.length > 1) return transformPath(edge.path, z);
  const from = nodeById.get(edge.a);
  const to = nodeById.get(edge.b);
  if (from === undefined || to === undefined) return [];
  return [iso(from.x, from.y, z), iso(to.x, to.y, z)];
}

interface Prism {
  readonly top: readonly [P, P, P, P];
  readonly sides: readonly {
    readonly points: readonly [P, P, P, P];
    readonly depth: number;
    readonly side: 0 | 1 | 2 | 3;
  }[];
}

function prism(x: number, y: number, w: number, h: number, z0: number, z1: number): Prism {
  const c0 = { x, y };
  const c1 = { x: x + w, y };
  const c2 = { x: x + w, y: y + h };
  const c3 = { x, y: y + h };
  const t0 = iso(c0.x, c0.y, z1);
  const t1 = iso(c1.x, c1.y, z1);
  const t2 = iso(c2.x, c2.y, z1);
  const t3 = iso(c3.x, c3.y, z1);
  const b0 = iso(c0.x, c0.y, z0);
  const b1 = iso(c1.x, c1.y, z0);
  const b2 = iso(c2.x, c2.y, z0);
  const b3 = iso(c3.x, c3.y, z0);
  const side = (points: readonly [P, P, P, P], sideIndex: 0 | 1 | 2 | 3) => ({
    points,
    depth: (points[0].y + points[1].y + points[2].y + points[3].y) / 4,
    side: sideIndex,
  });
  return {
    top: [t0, t1, t2, t3],
    sides: [side([t0, t1, b1, b0], 0), side([t1, t2, b2, b1], 1), side([t2, t3, b3, b2], 2), side([t3, t0, b0, b3], 3)],
  };
}

function wallPoint(a: P, b: P, c: P, d: P, u: number, v: number): P {
  return lerp(lerp(a, b, u), lerp(d, c, u), v);
}

function WindowGrid({
  a,
  b,
  c,
  d,
  theme,
  hash,
  floorY,
}: {
  readonly a: P;
  readonly b: P;
  readonly c: P;
  readonly d: P;
  readonly theme: RtsTheme;
  readonly hash: number;
  readonly floorY: number;
}): React.JSX.Element {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const height = Math.abs(d.y - a.y);
  const cols = Math.max(2, Math.min(7, Math.round(length / 10)));
  const rows = Math.max(2, Math.min(7, Math.round(height / 8)));
  const windows: React.JSX.Element[] = [];
  const windowW = 0.52 / cols;
  const windowH = 0.46 / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = 0.08 + (col * 0.84) / cols;
      const v = 0.16 + (row * 0.72) / rows;
      const lit = (hash + row * 17 + col * 31) % 100 < theme.windowLitChance * 100;
      const p0 = wallPoint(a, b, c, d, u, v);
      const p1 = wallPoint(a, b, c, d, u + windowW, v);
      const p2 = wallPoint(a, b, c, d, u + windowW, v + windowH);
      const p3 = wallPoint(a, b, c, d, u, v + windowH);
      windows.push(
        <g key={`${row}-${col}`}>
          {lit && (
            <polygon
              points={points([p0, p1, p2, p3])}
              fill={theme.windowLit}
              opacity={0.16}
              transform={`translate(0 ${-0.6})`}
            />
          )}
          <polygon
            points={points([p0, p1, p2, p3])}
            fill={lit ? theme.windowLit : theme.window}
            stroke={theme.shadow}
            strokeWidth={0.35}
            opacity={lit ? 0.95 : 0.7}
          />
          <line x1={p3.x} y1={p3.y} x2={p2.x} y2={p2.y} stroke={theme.shadow} strokeWidth={0.5} opacity={0.55} />
          {theme.etching && (
            <g>
              <line
                x1={(p0.x + p1.x) / 2}
                y1={(p0.y + p1.y) / 2}
                x2={(p3.x + p2.x) / 2}
                y2={(p3.y + p2.y) / 2}
                stroke={theme.shadow}
                strokeWidth={0.3}
                opacity={0.55}
              />
              <line
                x1={(p0.x + p3.x) / 2}
                y1={(p0.y + p3.y) / 2}
                x2={(p1.x + p2.x) / 2}
                y2={(p1.y + p2.y) / 2}
                stroke={theme.shadow}
                strokeWidth={0.3}
                opacity={0.45}
              />
            </g>
          )}
        </g>,
      );
    }
  }
  return (
    <g>
      {windows}
      {floorY < 0.12 && (
        <polygon
          points={points([
            wallPoint(a, b, c, d, 0.02, 0.82),
            wallPoint(a, b, c, d, 0.98, 0.82),
            wallPoint(a, b, c, d, 0.98, 0.98),
            wallPoint(a, b, c, d, 0.02, 0.98),
          ])}
          fill={theme.steel}
          opacity={0.45}
          stroke={theme.shadow}
          strokeWidth={0.4}
        />
      )}
    </g>
  );
}

function DrawPrism({
  prism: geometry,
  theme,
  wall,
  roofColour,
  roofEdge,
  hash,
  windows = true,
}: {
  readonly prism: Prism;
  readonly theme: RtsTheme;
  readonly wall: WallPalette;
  readonly roofColour: string;
  readonly roofEdge: string;
  readonly hash: number;
  readonly windows?: boolean;
}): React.JSX.Element {
  const sideColour: Record<0 | 1 | 2 | 3, string> = {
    0: wall.dark,
    1: wall.light,
    2: wall.mid,
    3: wall.dark,
  };
  const sides = [...geometry.sides].sort((left, right) => left.depth - right.depth);
  return (
    <g>
      {sides.map((face, index) => {
        const [a, b, c, d] = face.points;
        const front = face.side === 1 || face.side === 2;
        return (
          <g key={`${face.side}-${index}`}>
            <polygon
              points={points(face.points)}
              fill={sideColour[face.side]}
              stroke={theme.shadow}
              strokeWidth={theme.etching ? 1.25 : 0.55}
              opacity={1}
            />
            <polygon
              points={points(face.points)}
              fill={theme.etching ? 'url(#vintage-hatch)' : 'url(#iso-brick)'}
              opacity={theme.etching ? 0.34 : 0.26}
            />
            <polygon
              points={points([
                wallPoint(a, b, c, d, 0, 0.72),
                wallPoint(a, b, c, d, 1, 0.72),
                wallPoint(a, b, c, d, 1, 1),
                wallPoint(a, b, c, d, 0, 1),
              ])}
              fill={theme.etching ? 'url(#vintage-hatch-dense)' : theme.shadow}
              opacity={theme.etching ? 0.2 : 0.22}
            />
            <polygon
              points={points([
                wallPoint(a, b, c, d, 0, 0),
                wallPoint(a, b, c, d, 1, 0),
                wallPoint(a, b, c, d, 1, 0.07),
                wallPoint(a, b, c, d, 0, 0.07),
              ])}
              fill={theme.sun}
              opacity={0.12}
            />
            {windows && front && (
              <WindowGrid a={a} b={b} c={c} d={d} theme={theme} hash={hash + face.side * 7} floorY={0.3} />
            )}
            {front && hash % 3 === 0 && (
              <g>
                <polygon
                  points={points([
                    wallPoint(a, b, c, d, 0.08, 0.74),
                    wallPoint(a, b, c, d, 0.92, 0.74),
                    wallPoint(a, b, c, d, 0.92, 0.8),
                    wallPoint(a, b, c, d, 0.08, 0.8),
                  ])}
                  fill={hash % 2 === 0 ? theme.rust : theme.route.bus}
                  stroke={theme.shadow}
                  strokeWidth={0.35}
                  opacity={0.95}
                />
                {[0.22, 0.44, 0.66, 0.88].map((u) => (
                  <line
                    key={u}
                    x1={wallPoint(a, b, c, d, u, 0.74).x}
                    y1={wallPoint(a, b, c, d, u, 0.74).y}
                    x2={wallPoint(a, b, c, d, u, 0.8).x}
                    y2={wallPoint(a, b, c, d, u, 0.8).y}
                    stroke={theme.stationPad}
                    strokeWidth={0.4}
                    opacity={0.65}
                  />
                ))}
              </g>
            )}
          </g>
        );
      })}
      <polygon points={points(geometry.top)} fill={roofColour} stroke={roofEdge} strokeWidth={theme.etching ? 1.2 : 0.8} />
      <polygon points={points(geometry.top)} fill={theme.etching ? 'url(#vintage-hatch)' : 'url(#iso-roof)'} opacity={theme.etching ? 0.32 : 0.38} />
      <polygon points={points(geometry.top)} fill="none" stroke={theme.sun} strokeWidth={0.5} opacity={0.28} />
    </g>
  );
}

function buildingHeight(building: Building): number {
  const hash = hashString(building.key);
  return Math.round(8 + (hash % 5) * 3.2 + building.lift * 0.7);
}

function RoofAc({
  x,
  y,
  w,
  d,
  z,
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly z: number;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const body = prism(x, y, w, d, z, z + 1.5);
  const fan = iso(x + w / 2, y + d / 2, z + 1.7);
  return (
    <g>
      <DrawPrism
        prism={body}
        theme={theme}
        wall={{ light: theme.steel, mid: theme.steel, dark: theme.shadow }}
        roofColour={theme.steel}
        roofEdge={theme.shadow}
        hash={1}
        windows={false}
      />
      <circle cx={fan.x} cy={fan.y} r={2.2} fill={theme.shadow} stroke={theme.steel} strokeWidth={0.5} />
      <circle cx={fan.x} cy={fan.y} r={1.4} fill={theme.steel} />
      <line x1={fan.x - 2} y1={fan.y} x2={fan.x + 2} y2={fan.y} stroke={theme.shadow} strokeWidth={0.45} />
      <line x1={fan.x} y1={fan.y - 2} x2={fan.x} y2={fan.y + 2} stroke={theme.shadow} strokeWidth={0.45} />
      {[0.25, 0.55, 0.85].map((v) => {
        const a = iso(x, y + d * v, z + 0.6);
        const b = iso(x + w, y + d * v, z + 0.6);
        return <line key={v} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.shadow} strokeWidth={0.35} opacity={0.55} />;
      })}
    </g>
  );
}

function RoofTank({
  x,
  y,
  w,
  d,
  z,
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly z: number;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const base = iso(x + w / 2, y + d / 2, z);
  const radius = Math.min(3.4, Math.max(2.2, w * 0.42));
  const top = base.y - 5.5;
  return (
    <g>
      <line x1={base.x - radius * 0.65} y1={base.y} x2={base.x - radius * 0.65} y2={top + 4} stroke={theme.steel} strokeWidth={0.8} />
      <line x1={base.x + radius * 0.65} y1={base.y} x2={base.x + radius * 0.65} y2={top + 4} stroke={theme.steel} strokeWidth={0.8} />
      <rect x={base.x - radius} y={top} width={radius * 2} height={5.5} fill={theme.rust} stroke={theme.shadow} strokeWidth={0.5} />
      <ellipse cx={base.x} cy={top} rx={radius} ry={radius * 0.4} fill={theme.steel} stroke={theme.shadow} strokeWidth={0.5} />
      <ellipse cx={base.x} cy={top + 5.5} rx={radius} ry={radius * 0.4} fill={theme.shadow} opacity={0.35} />
      <line x1={base.x - radius} y1={top + 2.4} x2={base.x + radius} y2={top + 2.4} stroke={theme.shadow} strokeWidth={0.35} opacity={0.6} />
    </g>
  );
}

function RoofVent({
  x,
  y,
  z,
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const base = iso(x, y, z);
  const top = iso(x, y, z + 2.6);
  return (
    <g>
      <rect x={base.x - 1} y={top.y} width={2} height={base.y - top.y} fill={theme.steel} stroke={theme.shadow} strokeWidth={0.35} />
      <ellipse cx={base.x} cy={top.y} rx={1.4} ry={0.55} fill={theme.shadow} opacity={0.65} />
    </g>
  );
}

function Chimney({
  x,
  y,
  z,
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const body = prism(x, y, 2.4, 2.4, z, z + 5);
  return (
    <g>
      <DrawPrism
        prism={body}
        theme={theme}
        wall={{ light: theme.steel, mid: theme.steel, dark: theme.shadow }}
        roofColour={theme.rust}
        roofEdge={theme.shadow}
        hash={3}
        windows={false}
      />
      <rect
        x={iso(x - 0.4, y - 0.4, z + 5).x - 2}
        y={iso(x - 0.4, y - 0.4, z + 5).y - 1}
        width={4}
        height={1.5}
        fill={theme.steel}
        stroke={theme.shadow}
        strokeWidth={0.4}
      />
    </g>
  );
}

function RoofSkylight({
  roof,
  theme,
}: {
  readonly roof: { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly z: number };
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const x = roof.x + roof.w * 0.3;
  const y = roof.y + roof.h * 0.56;
  const w = roof.w * 0.28;
  const h = roof.h * 0.2;
  const z = roof.z + 0.18;
  return (
    <g>
      <polygon
        points={points([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z)])}
        fill={theme.window}
        stroke={theme.steel}
        strokeWidth={0.6}
        opacity={0.8}
      />
      <line x1={iso(x, y, z).x} y1={iso(x, y, z).y} x2={iso(x + w, y + h, z).x} y2={iso(x + w, y + h, z).y} stroke={theme.shadow} strokeWidth={0.35} opacity={0.6} />
    </g>
  );
}

function BuildingObjectBase({
  building,
  theme,
  detail = 'full',
}: {
  readonly building: Building;
  readonly theme: RtsTheme;
  readonly detail?: 'full' | 'map';
}): React.JSX.Element {
  const hash = hashString(building.key);
  const wall = theme.walls[hash % theme.walls.length] as WallPalette;
  const roof = theme.roofs[hash % theme.roofs.length] as { top: string; edge: string };
  const height = buildingHeight(building);
  const etching = theme.etching === true;
  const low = detail === 'map';
  const tiered = height >= 18 && hash % 3 === 0;
  const pitched = !tiered && height <= (etching ? 18 : 16) && hash % (etching ? 2 : 3) === 0;
  const baseHeight = tiered ? Math.max(10, height * 0.62) : height;
  const roofArea = tiered
    ? { x: building.x + building.w * 0.16, y: building.y + building.h * 0.16, w: building.w * 0.68, h: building.h * 0.68, z: height }
    : { x: building.x, y: building.y, w: building.w, h: building.h, z: height };
  const baseGeometry = prism(building.x, building.y, building.w, building.h, 0, baseHeight);
  const upperGeometry = tiered ? prism(roofArea.x, roofArea.y, roofArea.w, roofArea.h, baseHeight, height) : null;
  const hasAc = !etching && hash % 3 === 0;
  const hasTank = hash % 5 === 0;
  const hasSkylight = hash % 4 === 1;
  const hasVent = hash % 2 === 0;

  return (
    <g>
      <DrawPrism
        prism={baseGeometry}
        theme={theme}
        wall={wall}
        roofColour={roof.top}
        roofEdge={roof.edge}
        hash={hash}
        windows={!low}
      />

      {upperGeometry !== null && (
        <g>
          <DrawPrism
            prism={upperGeometry}
            theme={theme}
            wall={wall}
            roofColour={roof.top}
            roofEdge={roof.edge}
            hash={hash + 3}
            windows={!low}
          />
        </g>
      )}

      {pitched && (() => {
        const t0 = baseGeometry.top[0] as P;
        const t1 = baseGeometry.top[1] as P;
        const t2 = baseGeometry.top[2] as P;
        const t3 = baseGeometry.top[3] as P;
        const ridgeA = { ...lerp(t0, t3, 0.5), y: lerp(t0, t3, 0.5).y - 4.2 };
        const ridgeB = { ...lerp(t1, t2, 0.5), y: lerp(t1, t2, 0.5).y - 4.2 };
        return (
          <g>
            <polygon points={points([t0, t1, ridgeB, ridgeA])} fill={roof.top} stroke={theme.shadow} strokeWidth={0.6} />
            <polygon points={points([ridgeA, ridgeB, t2, t3])} fill={roof.edge} stroke={theme.shadow} strokeWidth={0.6} />
            <line x1={ridgeA.x} y1={ridgeA.y} x2={ridgeB.x} y2={ridgeB.y} stroke={theme.sun} strokeWidth={0.9} opacity={0.55} />
            <line x1={ridgeA.x} y1={ridgeA.y} x2={ridgeA.x} y2={ridgeA.y - 2.5} stroke={theme.steel} strokeWidth={0.7} />
          </g>
        );
      })()}

      {!pitched && (
        <g>
          <polygon points={points(baseGeometry.top)} fill="none" stroke={theme.steel} strokeWidth={1.1} opacity={0.75} />
          {upperGeometry !== null && (
            <polygon points={points(upperGeometry.top)} fill="none" stroke={theme.steel} strokeWidth={1.1} opacity={0.75} />
          )}
        </g>
      )}

      {!pitched && building.w > 14 && hash % 4 === 1 && (
        <DrawPrism
          prism={prism(
            hash % 2 === 0 ? building.x + building.w * 0.72 : building.x - building.w * 0.16,
            building.y + building.h * 0.26,
            building.w * 0.34,
            building.h * 0.46,
            0,
            Math.max(6, baseHeight * 0.42),
          )}
          theme={theme}
          wall={theme.walls[(hash + 2) % theme.walls.length] as WallPalette}
          roofColour={theme.roofs[(hash + 2) % theme.roofs.length]?.top ?? roof.top}
          roofEdge={theme.roofs[(hash + 2) % theme.roofs.length]?.edge ?? roof.edge}
          hash={hash + 5}
          windows
        />
      )}

      {!low && !pitched && hasAc && (
        <RoofAc
          x={roofArea.x + roofArea.w * 0.18}
          y={roofArea.y + roofArea.h * 0.18}
          w={Math.min(7, roofArea.w * 0.23)}
          d={Math.min(5, roofArea.h * 0.2)}
          z={roofArea.z}
          theme={theme}
        />
      )}
      {!low && !pitched && hasTank && (
        <RoofTank
          x={roofArea.x + roofArea.w * 0.62}
          y={roofArea.y + roofArea.h * 0.2}
          w={Math.min(8, roofArea.w * 0.22)}
          d={Math.min(6, roofArea.h * 0.2)}
          z={roofArea.z}
          theme={theme}
        />
      )}
      {!low && !pitched && hasSkylight && <RoofSkylight roof={roofArea} theme={theme} />}
      {!low && !pitched && hasVent && <RoofVent x={roofArea.x + roofArea.w * 0.78} y={roofArea.y + roofArea.h * 0.7} z={roofArea.z} theme={theme} />}

      {!low && etching && hash % 2 === 0 && (
        <Chimney
          x={roofArea.x + roofArea.w * 0.74}
          y={roofArea.y + roofArea.h * 0.26}
          z={roofArea.z}
          theme={theme}
        />
      )}

      {hash % 6 === 0 && (
        <line
          x1={iso(building.x + building.w - 1, building.y + building.h, baseHeight * 0.2).x}
          y1={iso(building.x + building.w - 1, building.y + building.h, baseHeight * 0.2).y}
          x2={iso(building.x + building.w - 1, building.y + building.h, height).x}
          y2={iso(building.x + building.w - 1, building.y + building.h, height).y}
          stroke={theme.steel}
          strokeWidth={0.7}
          opacity={0.75}
        />
      )}

      {!low && !etching && hash % 7 === 0 && !pitched && (
        <g>
          <line
            x1={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z).x}
            y1={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z).y}
            x2={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 16).x}
            y2={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 16).y}
            stroke={theme.steel}
            strokeWidth={0.9}
          />
          <circle
            cx={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 16).x}
            cy={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 16).y}
            r={1.2}
            fill={theme.fugitive}
          />
        </g>
      )}

      {!low && !etching && hash % 13 === 0 && building.w > 18 && !pitched && (
        <g>
          {(() => {
            const anchor = iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 2);
            const panelW = Math.min(26, Math.max(15, building.w * 0.5));
            const panelH = 8;
            const top = anchor.y - panelH - 9;
            return (
              <g>
                <line x1={anchor.x - panelW * 0.28} y1={anchor.y} x2={anchor.x - panelW * 0.28} y2={top + panelH} stroke={theme.steel} strokeWidth={1.1} />
                <line x1={anchor.x + panelW * 0.28} y1={anchor.y} x2={anchor.x + panelW * 0.28} y2={top + panelH} stroke={theme.steel} strokeWidth={1.1} />
                <rect x={anchor.x - panelW / 2} y={top} width={panelW} height={panelH} fill={theme.shadow} stroke={theme.steel} strokeWidth={0.7} />
                <rect
                  x={anchor.x - panelW / 2 + 1.2}
                  y={top + 1.2}
                  width={panelW - 2.4}
                  height={panelH - 2.4}
                  fill={hash % 2 === 0 ? theme.accent : theme.route.bus}
                  opacity={0.82}
                />
                {[0.2, 0.5, 0.8].map((fraction) => (
                  <rect key={fraction} x={anchor.x - panelW / 2 + 2 + fraction * (panelW - 6)} y={top + 2.5} width={1.3} height={3.5} fill={theme.stationPad} opacity={0.8} />
                ))}
              </g>
            );
          })()}
        </g>
      )}

      {!low && !etching && hash % 17 === 0 && !pitched && (
        <g opacity={0.1}>
          {[0, 1, 2].map((index) => (
            <circle
              key={index}
              cx={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 10 + index * 5).x + index * 2}
              cy={iso(roofArea.x + roofArea.w * 0.5, roofArea.y + roofArea.h * 0.5, roofArea.z + 10 + index * 5).y}
              r={3 + index * 2}
              fill={theme.label}
            />
          ))}
        </g>
      )}
    </g>
  );
}

const BuildingObject = memo(BuildingObjectBase);

function MapBuildingBase({ building, theme }: { readonly building: Building; readonly theme: RtsTheme }): React.JSX.Element {
  const hash = hashString(building.key);
  const wall = theme.walls[hash % theme.walls.length] as WallPalette;
  const roof = theme.roofs[hash % theme.roofs.length] as { top: string; edge: string };
  const height = buildingHeight(building);
  const geometry = prism(building.x, building.y, building.w, building.h, 0, height);
  const sideColour: Record<0 | 1 | 2 | 3, string> = { 0: wall.dark, 1: wall.light, 2: wall.mid, 3: wall.dark };
  const sides = [...geometry.sides].sort((left, right) => left.depth - right.depth);
  return (
    <g>
      {sides.map((face) => (
        <polygon
          key={face.side}
          points={points(face.points)}
          fill={sideColour[face.side]}
          stroke={theme.shadow}
          strokeWidth={0.6}
        />
      ))}
      <polygon points={points(geometry.top)} fill={roof.top} stroke={roof.edge} strokeWidth={0.8} />
    </g>
  );
}

const MapBuilding = memo(MapBuildingBase);

function TreeLite({ tree, theme }: { readonly tree: Tree; readonly theme: RtsTheme }): React.JSX.Element {
  const base = iso(tree.x, tree.y, 0);
  const top = iso(tree.x, tree.y, 7 + tree.r * 0.9);
  const radius = Math.max(3, tree.r * 0.9);
  return (
    <g>
      <ellipse cx={base.x + 5} cy={base.y + 2} rx={radius} ry={radius * 0.35} fill={theme.shadow} opacity={0.35} />
      <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={theme.treeTrunk} strokeWidth={1.4} />
      <circle cx={top.x} cy={top.y} r={radius} fill={theme.tree} stroke={theme.shadow} strokeWidth={0.6} />
    </g>
  );
}

const MemoTreeLite = memo(TreeLite);

function TreeObjectBase({ tree, theme }: { readonly tree: Tree; readonly theme: RtsTheme }): React.JSX.Element {
  const base = iso(tree.x, tree.y, 0);
  const height = 8 + tree.r * 0.9;
  const top = iso(tree.x, tree.y, height);
  const radius = Math.max(4, tree.r * 0.9);
  return (
    <g>
      <ellipse cx={base.x + 7} cy={base.y + 3} rx={radius * 1.05} ry={radius * 0.35} fill={theme.etching ? 'url(#vintage-hatch-dense)' : theme.shadow} opacity={theme.shadowOpacity * 0.55} />
      <ellipse cx={base.x} cy={base.y} rx={2.6} ry={1.3} fill={theme.shadow} opacity={theme.shadowOpacity * 0.9} />
      <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={theme.treeTrunk} strokeWidth={1.6} />
      <circle cx={top.x} cy={top.y} r={radius} fill={theme.tree} stroke={theme.shadow} strokeWidth={theme.etching ? 1.2 : 0.6} />
      {theme.etching ? (
        <g>
          <circle cx={top.x} cy={top.y} r={radius} fill="url(#vintage-stipple)" opacity={0.65} />
          <circle cx={top.x - radius * 0.3} cy={top.y - radius * 0.28} r={radius * 0.6} fill="none" stroke={theme.shadow} strokeWidth={0.45} opacity={0.55} />
          <line x1={top.x - radius * 0.6} y1={top.y + radius * 0.2} x2={top.x + radius * 0.55} y2={top.y - radius * 0.35} stroke={theme.shadow} strokeWidth={0.35} opacity={0.45} />
        </g>
      ) : (
        <>
          <circle cx={top.x - radius * 0.4} cy={top.y - radius * 0.25} r={radius * 0.62} fill={theme.treeLight} opacity={0.9} />
          <circle cx={top.x + radius * 0.35} cy={top.y - radius * 0.1} r={radius * 0.45} fill={theme.tree} opacity={0.9} />
        </>
      )}
    </g>
  );
}

const TreeObject = memo(TreeObjectBase);

function CarObject({ x, y, angle, colour, theme }: { readonly x: number; readonly y: number; readonly angle: number; readonly colour: string; readonly theme: RtsTheme }): React.JSX.Element {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const point = (lx: number, ly: number): P => ({ x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos });
  const body = [
    point(-5, -2.4),
    point(5, -2.4),
    point(5, 2.4),
    point(-5, 2.4),
  ].map((p) => iso(p.x, p.y, 0));
  const roof = [
    point(-3, -1.9),
    point(3, -1.9),
    point(3, 1.9),
    point(-3, 1.9),
  ].map((p) => iso(p.x, p.y, 4.2));
  return (
    <g>
      <polygon points={points(body)} fill={theme.shadow} opacity={0.5} transform="translate(5 3)" />
      <polygon points={points(body)} fill={colour} stroke={theme.shadow} strokeWidth={0.6} />
      <polygon points={points(roof)} fill={theme.window} opacity={0.7} stroke={theme.shadow} strokeWidth={0.4} />
      <circle cx={iso(point(5, 2.4).x, point(5, 2.4).y, 1).x} cy={iso(point(5, 2.4).x, point(5, 2.4).y, 1).y} r={1} fill={theme.lane} />
    </g>
  );
}

function RoadLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  return (
    <g>
      {[...map.city.streets].sort((a, b) => a.rank - b.rank).map((street) => {
        const path = transformPath(street.path, 0);
        const width = street.rank === 0 ? 8 : street.rank === 1 ? 11 : 14;
        return (
          <g key={street.id}>
            {theme.etching && (
              <path d={pathOf(path)} fill="none" stroke={theme.shadow} strokeWidth={width + 9} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} />
            )}
            <path d={pathOf(path)} fill="none" stroke={theme.sidewalk} strokeWidth={width + 7} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathOf(path)} fill="none" stroke={theme.asphalt} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathOf(path)} fill="none" stroke={theme.lane} strokeWidth={theme.etching ? 0.7 : 0.8} strokeLinecap="round" strokeDasharray="6 11" opacity={theme.etching ? 0.55 : 0.35} />
          </g>
        );
      })}
    </g>
  );
}

function BlockLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  return (
    <g>
      {map.city.blocks.map((block: BlockModel) => {
        const poly = block.polygon.map((point) => iso(point.x, point.y, 0));
        if (poly.length < 3) return null;
        return (
          <polygon
            key={block.id}
            points={points(poly)}
            fill={block.kind === 'park' ? theme.park : theme.block}
            stroke={block.kind === 'park' ? theme.parkEdge : theme.blockEdge}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

function LandmarkObjectBase({ landmark, theme }: { readonly landmark: LandmarkModel; readonly theme: RtsTheme }): React.JSX.Element {
  const { x, y } = landmark.at;
  const etching = theme.etching === true;
  const stoneWall = etching ? (theme.walls[0] as WallPalette) : { light: '#a89a84', mid: '#8b7d69', dark: '#635a4c' };
  const towerWall = etching ? (theme.walls[1] as WallPalette) : { light: '#b7a58c', mid: '#96846d', dark: '#6d5f4e' };
  const stoneRoof = etching ? (theme.roofs[0]?.top ?? '#8d775b') : '#4b4f50';
  const towerRoof = etching ? (theme.roofs[1]?.top ?? '#79654e') : '#54483c';
  const stationWall = etching ? (theme.walls[2] as WallPalette) : { light: '#9e9684', mid: '#817a6b', dark: '#5d574c' };
  const stationRoof = etching ? (theme.roofs[1]?.top ?? '#79654e') : '#4d5354';
  const glassRoof = etching ? (theme.roofs[2]?.top ?? '#9a8566') : '#3f707b';
  if (landmark.kind === 'square') {
    const center = iso(x, y, 0);
    return (
      <g>
        <ellipse cx={center.x} cy={center.y} rx={28} ry={13} fill={theme.stationPad} stroke={theme.blockEdge} strokeWidth={1.2} />
        <ellipse cx={center.x} cy={center.y} rx={10} ry={4.5} fill={theme.water} stroke={theme.waterEdge} strokeWidth={1} />
        <circle cx={center.x} cy={center.y - 9} r={4} fill={theme.water} stroke={theme.waterEdge} strokeWidth={0.8} />
        {[-17, 14].map((offset, index) => (
          <TreeObject key={offset} tree={{ key: `sq-${index}`, x: x + offset, y: y + 8, r: 4 }} theme={theme} />
        ))}
        <text x={center.x} y={center.y - 26} textAnchor="middle" fontSize={10} fontWeight={800} letterSpacing={1.2} fill={theme.label} stroke={theme.labelStroke} strokeWidth={3} paintOrder="stroke">
          {landmark.label.toUpperCase()}
        </text>
      </g>
    );
  }

  if (landmark.kind === 'cathedral') {
    const base = prism(x - 36, y - 18, 72, 36, 0, 18);
    const tower = prism(x - 8, y - 8, 16, 16, 18, 42);
    const towerTop = iso(x, y, 42);
    const spireTop = iso(x, y, 58);
    return (
      <g>
        <DrawPrism prism={base} theme={theme} wall={stoneWall} roofColour={stoneRoof} roofEdge={theme.shadow} hash={7} windows />
        <DrawPrism prism={tower} theme={theme} wall={towerWall} roofColour={towerRoof} roofEdge={theme.shadow} hash={11} windows />
        <polygon points={points([towerTop, iso(x - 9, y + 9, 42), iso(x + 9, y + 9, 42)])} fill={etching ? towerRoof : '#6d4d3c'} stroke={theme.shadow} strokeWidth={0.6} />
        <polygon points={points([iso(x - 9, y + 9, 42), iso(x + 9, y + 9, 42), spireTop])} fill={etching ? stoneRoof : '#7c5a45'} stroke={theme.shadow} strokeWidth={0.6} />
        <line x1={spireTop.x} y1={spireTop.y} x2={spireTop.x} y2={spireTop.y - 10} stroke={theme.steel} strokeWidth={1} />
        <circle cx={spireTop.x} cy={spireTop.y - 10} r={1.2} fill={theme.rust} />
      </g>
    );
  }

  if (landmark.kind === 'station') {
    const base = prism(x - 46, y - 20, 92, 40, 0, 16);
    const roof = prism(x - 50, y - 24, 100, 48, 16, 24);
    return (
      <g>
        <DrawPrism prism={base} theme={theme} wall={stationWall} roofColour={stationRoof} roofEdge={theme.shadow} hash={19} windows />
        <DrawPrism prism={roof} theme={theme} wall={etching ? { light: theme.window, mid: theme.steel, dark: theme.shadow } : { light: '#5a7d86', mid: '#43646c', dark: '#2c454b' }} roofColour={glassRoof} roofEdge={theme.shadow} hash={23} windows={false} />
        {[-24, -8, 8, 24].map((offset) => {
          const a = iso(x + offset, y - 16, 25);
          const b = iso(x + offset, y + 16, 25);
          return <line key={offset} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.steel} strokeWidth={0.8} opacity={0.8} />;
        })}
      </g>
    );
  }

  const base = prism(x - 30, y - 16, 60, 32, 0, 12);
  const ridgeA = iso(x - 32, y - 18, 22);
  const ridgeB = iso(x + 32, y - 18, 22);
  const ridgeC = iso(x + 32, y + 18, 22);
  const ridgeD = iso(x - 32, y + 18, 22);
  return (
    <g>
      <DrawPrism prism={base} theme={theme} wall={etching ? (theme.walls[3] as WallPalette) : { light: '#b08a5f', mid: '#8c6a46', dark: '#604830' }} roofColour={etching ? (theme.roofs[2]?.top ?? '#9a8566') : '#5b4a3f'} roofEdge={theme.shadow} hash={29} windows />
      <polygon points={points([iso(x - 30, y - 16, 12), iso(x + 30, y - 16, 12), ridgeB, ridgeA])} fill={etching ? (theme.roofs[2]?.edge ?? '#65523e') : '#6e5847'} stroke={theme.shadow} strokeWidth={0.6} />
      <polygon points={points([iso(x - 30, y + 16, 12), ridgeD, ridgeC, iso(x + 30, y + 16, 12)])} fill={etching ? (theme.roofs[3]?.top ?? '#6d5b47') : '#4f4035'} stroke={theme.shadow} strokeWidth={0.6} />
    </g>
  );
}

const LandmarkObject = memo(LandmarkObjectBase);

function NetworkLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  return (
    <g>
      {map.graph.edges.map((edge) => {
        const path = transformEdge(edge, nodeById, 1.2);
        const width = edge.mode === 'underground' ? 3.4 : edge.mode === 'bus' ? 2.6 : edge.mode === 'special' ? 2 : 1.8;
        const colour = theme.route[edge.mode];
        return (
          <g key={edge.id}>
            <path d={pathOf(path)} fill="none" stroke={theme.shadow} strokeWidth={width + 2.2} strokeLinecap="round" opacity={0.7} />
            <path d={pathOf(path)} fill="none" stroke={colour} strokeWidth={width} strokeLinecap="round" opacity={0.85} />
          </g>
        );
      })}
    </g>
  );
}

function StationLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  const stops = useMemo(() => {
    const found = new Map<NodeId, string[]>();
    for (const edge of map.graph.edges) {
      if (edge.mode === 'taxi') continue;
      for (const id of [edge.a, edge.b]) {
        const list = found.get(id) ?? [];
        if (!list.includes(edge.mode)) list.push(edge.mode);
        found.set(id, list);
      }
    }
    return found;
  }, [map]);

  return (
    <g>
      {map.graph.nodes.map((node, index) => {
        const base = iso(node.x, node.y, 0);
        const major = node.class !== 'street';
        const showLabel =
          major ||
          index % 5 === 0 ||
          node.id === 'n8' ||
          node.id === 'n11' ||
          node.id === 'n24';
        const top = iso(node.x, node.y, major ? 20 : 11);
        const badgeColours: Record<string, string> = {
          bus: theme.route.bus,
          underground: theme.route.underground,
          special: theme.route.special,
        };
        return (
          <g key={node.id}>
            <ellipse cx={base.x} cy={base.y} rx={major ? 7 : 5} ry={major ? 3.5 : 2.5} fill={theme.stationPad} stroke={theme.stationRing} strokeWidth={1.1} />
            <ellipse cx={base.x} cy={base.y} rx={2.6} ry={1.3} fill={theme.shadow} opacity={0.5} />
            <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={theme.steel} strokeWidth={0.8} />
            <circle cx={top.x} cy={top.y} r={major ? 3.4 : 2.2} fill={theme.stationPad} stroke={theme.stationRing} strokeWidth={0.9} />
            {showLabel && (
              <text
                x={top.x + 5}
                y={top.y - 3}
                fontSize={major ? 8.5 : 7.5}
                fontWeight={800}
                fill={theme.label}
                stroke={theme.labelStroke}
                strokeWidth={2.6}
                paintOrder="stroke"
              >
                {node.id}
              </text>
            )}
            {major &&
              (stops.get(node.id) ?? []).map((mode, badgeIndex) => (
                <text
                  key={mode}
                  x={top.x - 5}
                  y={top.y + badgeIndex * 7}
                  textAnchor="end"
                  fontSize={6}
                  fontWeight={800}
                  fill={badgeColours[mode] ?? theme.label}
                  stroke={theme.labelStroke}
                  strokeWidth={2}
                  paintOrder="stroke"
                >
                  {mode === 'bus' ? 'B' : mode === 'underground' ? 'M' : 'S'}
                </text>
              ))}
          </g>
        );
      })}
    </g>
  );
}

function TokenLayer({ theme }: { readonly theme: RtsTheme }): React.JSX.Element {
  const tokens = [
    { id: 'n8', label: 'F', colour: theme.fugitive, ghost: false },
    { id: 'n7', label: 'A1', colour: theme.agent, ghost: false },
    { id: 'n38', label: 'A2', colour: theme.agent, ghost: false },
    { id: 'n18', label: 'F18', colour: theme.ghost, ghost: true },
  ];
  const positions: Record<string, P> = {
    n8: { x: 761.53, y: 129.57 },
    n7: { x: 350.61, y: 123.75 },
    n38: { x: 817.93, y: 358.39 },
    n18: { x: 344, y: 260 },
  };
  return (
    <g>
      {tokens.map((token) => {
        const point = positions[token.id];
        if (point === undefined) return null;
        const base = iso(point.x, point.y, 0);
        const top = iso(point.x, point.y, 38);
        return (
          <g key={token.id} opacity={token.ghost ? 0.55 : 1}>
            <ellipse cx={base.x} cy={base.y} rx={7} ry={3.4} fill={theme.shadow} opacity={0.7} />
            <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={token.colour} strokeWidth={1.4} strokeDasharray={token.ghost ? '3 2' : undefined} />
            <circle cx={top.x} cy={top.y} r={7.5} fill={token.colour} stroke={theme.label} strokeWidth={1.5} />
            <text x={top.x} y={top.y + 3} textAnchor="middle" fontSize={6.8} fontWeight={800} fill={theme.label}>
              {token.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function EtchedRouteLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const widthFor = (mode: GraphEdge['mode']): number =>
    mode === 'underground' ? 3.4 : mode === 'bus' ? 2.8 : mode === 'special' ? 2.1 : 2;
  return (
    <g>
      {map.graph.edges.map((edge) => {
        const path = transformEdge(edge, nodeById, 2.6);
        const width = widthFor(edge.mode);
        return (
          <g key={`etch-${edge.id}`}>
            <path d={pathOf(path)} fill="none" stroke={theme.stationPad} strokeWidth={width + 2.6} strokeLinecap="round" opacity={0.8} />
            <path
              d={pathOf(path)}
              fill="none"
              stroke={theme.route[edge.mode]}
              strokeWidth={width}
              strokeLinecap="round"
              strokeDasharray={edge.mode === 'special' ? '6 4' : undefined}
              opacity={0.92}
            />
          </g>
        );
      })}
    </g>
  );
}

function VintageOverlay({ theme }: { readonly theme: RtsTheme }): React.JSX.Element {
  const x = ISO_VIEW.x;
  const y = ISO_VIEW.y;
  const width = ISO_VIEW.width;
  const height = ISO_VIEW.height;
  const compassX = x + width - 44;
  const compassY = y + height - 44;
  const serif = "Georgia, 'Times New Roman', serif";
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x={x + 5} y={y + 5} width={width - 10} height={height - 10} fill="none" stroke={theme.shadow} strokeWidth={2} opacity={0.7} />
      <rect x={x + 9} y={y + 9} width={width - 18} height={height - 18} fill="none" stroke={theme.shadow} strokeWidth={0.7} opacity={0.55} />
      <g transform={`translate(${compassX} ${compassY})`} opacity={0.75}>
        <circle r={21} fill={theme.stationPad} fillOpacity={0.55} stroke={theme.shadow} strokeWidth={1.1} />
        <circle r={16} fill="none" stroke={theme.shadow} strokeWidth={0.45} />
        <path d="M0 -15 L4 -1 L0 2 L-4 -1 Z" fill={theme.etching ? theme.rust : theme.route.underground} opacity={0.9} />
        <path d="M0 15 L3 5 L0 3 L-3 5 Z" fill={theme.shadow} opacity={0.5} />
        <line x1={-14} y1={0} x2={14} y2={0} stroke={theme.shadow} strokeWidth={0.4} />
        <text x={0} y={-24} textAnchor="middle" fontFamily={serif} fontSize={8} fontWeight={700} fill={theme.shadow}>N</text>
        <text x={0} y={30} textAnchor="middle" fontFamily={serif} fontSize={7} fill={theme.shadow}>S</text>
        <text x={-27} y={3} textAnchor="middle" fontFamily={serif} fontSize={7} fill={theme.shadow}>W</text>
        <text x={27} y={3} textAnchor="middle" fontFamily={serif} fontSize={7} fill={theme.shadow}>E</text>
      </g>
      <g transform={`translate(${x + 22} ${y + height - 24})`} opacity={0.7}>
        <line x1={0} y1={0} x2={62} y2={0} stroke={theme.shadow} strokeWidth={1} />
        <line x1={0} y1={-3} x2={0} y2={3} stroke={theme.shadow} strokeWidth={1} />
        <line x1={31} y1={-2} x2={31} y2={2} stroke={theme.shadow} strokeWidth={0.8} />
        <line x1={62} y1={-3} x2={62} y2={3} stroke={theme.shadow} strokeWidth={1} />
        <text x={31} y={12} textAnchor="middle" fontFamily={serif} fontSize={7} letterSpacing={0.6} fill={theme.shadow}>100 YARDS</text>
      </g>
    </g>
  );
}

function XrayLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const legal = map.graph.edges.find(
    (edge) =>
      edge.mode === 'taxi' &&
      ((edge.a === 'n8' && edge.b === 'n11') || (edge.a === 'n11' && edge.b === 'n8')),
  );
  const target = nodeById.get('n11');
  const xray = '#9fe6f2';
  return (
    <g>
      {map.graph.edges.map((edge) => {
        const path = transformEdge(edge, nodeById, 2);
        return (
          <path
            key={`xray-${edge.id}`}
            d={pathOf(path)}
            fill="none"
            stroke={xray}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.16}
          />
        );
      })}
      {legal !== undefined && (
        <g className="iso-xray-route">
          <path
            d={pathOf(transformEdge(legal, nodeById, 2.5))}
            fill="none"
            stroke={xray}
            strokeWidth={12}
            strokeLinecap="round"
            opacity={0.16}
          />
          <path
            d={pathOf(transformEdge(legal, nodeById, 2.5))}
            fill="none"
            stroke={theme.shadow}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.55}
          />
          <path
            d={pathOf(transformEdge(legal, nodeById, 2.5))}
            fill="none"
            stroke={xray}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeDasharray="7 4"
            opacity={0.95}
          />
        </g>
      )}
      {target !== undefined && (
        <g>
          <ellipse cx={iso(target.x, target.y, 0).x} cy={iso(target.x, target.y, 0).y} rx={14} ry={7} fill={xray} opacity={0.12} />
          <ellipse cx={iso(target.x, target.y, 0).x} cy={iso(target.x, target.y, 0).y} rx={12} ry={6} fill="none" stroke={xray} strokeWidth={1.6} strokeDasharray="3 2" opacity={0.9} />
          <line x1={iso(target.x, target.y, 0).x} y1={iso(target.x, target.y, 0).y} x2={iso(target.x, target.y, 14).x} y2={iso(target.x, target.y, 14).y} stroke={xray} strokeWidth={1} opacity={0.55} />
        </g>
      )}
    </g>
  );
}

function LampLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  const nodes = map.graph.nodes.filter((_, index) => index % 6 === 0);
  return (
    <g aria-hidden="true">
      {nodes.map((node) => {
        const base = iso(node.x, node.y, 0);
        const top = iso(node.x, node.y, theme.night ? 15 : 12);
        return (
          <g key={`lamp-${node.id}`}>
            <circle cx={top.x} cy={top.y} r={theme.night ? 22 : 12} fill={`url(#${theme.id}-lamp)`} opacity={theme.night ? 0.8 : 0.35} />
            <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={theme.steel} strokeWidth={0.8} />
            <circle cx={top.x} cy={top.y} r={1.6} fill={theme.windowLit} />
          </g>
        );
      })}
      {map.city.landmarks.map((landmark) => {
        const top = iso(landmark.at.x, landmark.at.y, theme.night ? 20 : 16);
        return (
          <circle key={`flood-${landmark.id}`} cx={top.x} cy={top.y} r={theme.night ? 45 : 25} fill={`url(#${theme.id}-lamp)`} opacity={theme.night ? 0.55 : 0.25} />
        );
      })}
    </g>
  );
}

export interface IsoCityFragmentProps {
  readonly map: GeneratedMap;
  readonly theme: RtsTheme;
  /** Camera viewBox in projected space. Defaults to the lab crop. */
  readonly viewBox?: string;
  /** Translation applied to the city content; the game uses the map-height offset. */
  readonly offsetX?: number;
  /** Lab mode draws the overlay/frame; the game supplies its own overlay. */
  readonly overlay?: boolean;
  /** Draw the paper border/compass. Off when the HUD supplies the frame. */
  readonly frame?: boolean;
  readonly xray?: boolean;
  /** Use the `city-plate` class instead of the lab fragment class. */
  readonly plate?: boolean;
}

export function IsoCityFragment({
  map,
  theme,
  viewBox,
  offsetX = 0,
  overlay = true,
  frame = true,
  xray = true,
  plate = false,
}: IsoCityFragmentProps): React.JSX.Element {
  const buildings = useMemo(() => buildingsForMap(map), [map]);
  const trees = useMemo(() => treesForMap(map), [map]);
  const span = map.bounds.width + map.bounds.height;
  const area = overlay
    ? ISO_VIEW
    : { x: -offsetX, y: 0, width: span * 0.9, height: span * 0.5 };
  const cull = overlay ? ISO_VIEW : parseViewBox(viewBox);
  const viewWidth = parseViewBox(viewBox)?.width ?? (map.bounds.width + map.bounds.height) * 0.9;
  const lowDetail = !overlay && viewWidth > (map.bounds.width + map.bounds.height) * 0.9 * 0.48;
  const visibleBuildings = useMemo(
    () =>
      buildings.filter((building) => {
        const point = iso(building.x + building.w / 2, building.y + building.h / 2, 0);
        return insideCull(point, cull, 170);
      }),
    [buildings, cull],
  );
  const visibleTrees = useMemo(
    () =>
      trees.filter((tree) => insideCull(iso(tree.x, tree.y, 0), cull, 100)),
    [cull, trees],
  );
  const items = useMemo(() => {
    const list: { depth: number; element: React.JSX.Element }[] = [];
    for (const building of visibleBuildings) {
      list.push({ depth: building.x + building.y + building.w + building.h, element: lowDetail ? <MapBuilding key={building.key} building={building} theme={theme} /> : <BuildingObject key={building.key} building={building} theme={theme} detail="full" /> });
    }
    for (const tree of visibleTrees) {
      list.push({ depth: tree.x + tree.y + 2, element: lowDetail ? <MemoTreeLite key={tree.key} tree={tree} theme={theme} /> : <TreeObject key={tree.key} tree={tree} theme={theme} /> });
    }
    for (const landmark of map.city.landmarks) {
      list.push({ depth: landmark.at.x + landmark.at.y, element: <LandmarkObject key={landmark.id} landmark={landmark} theme={theme} /> });
    }
    return list.sort((left, right) => left.depth - right.depth);
  }, [lowDetail, map.city.landmarks, theme, visibleBuildings, visibleTrees]);

  return (
    <svg
      className={plate ? 'city-plate' : 'city-fragment iso-fragment'}
      viewBox={viewBox ?? `${ISO_VIEW.x} ${ISO_VIEW.y} ${ISO_VIEW.width} ${ISO_VIEW.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${theme.title} isometric city`}
    >
      <defs>
        <radialGradient id={`${theme.id}-lamp`}>
          <stop offset="0%" stopColor={theme.windowLit} stopOpacity={0.38} />
          <stop offset="55%" stopColor={theme.windowLit} stopOpacity={0.12} />
          <stop offset="100%" stopColor={theme.windowLit} stopOpacity={0} />
        </radialGradient>
        <pattern id="iso-concrete" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.6" fill="#0c0e0f" opacity="0.35" />
          <circle cx="8" cy="7" r="0.45" fill="#0c0e0f" opacity="0.3" />
        </pattern>
        <pattern id="iso-roof" width="8" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="7" x2="8" y2="7" stroke="#0b0d0e" strokeWidth="0.3" opacity="0.35" />
          <line x1="4" y1="0" x2="4" y2="7" stroke="#0b0d0e" strokeWidth="0.22" opacity="0.25" />
        </pattern>
        <pattern id="iso-brick" width="6" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="3.5" x2="6" y2="3.5" stroke="#0b0d0e" strokeWidth="0.28" opacity="0.5" />
          <line x1="3" y1="0" x2="3" y2="1.8" stroke="#0b0d0e" strokeWidth="0.22" opacity="0.4" />
        </pattern>
        {theme.etching && (
          <>
            <pattern id="vintage-paper" width="17" height="17" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="4" r="0.45" fill="#5c4b37" opacity="0.25" />
              <circle cx="12" cy="9" r="0.35" fill="#5c4b37" opacity="0.2" />
              <path d="M0 14 L17 12" stroke="#5c4b37" strokeWidth="0.2" opacity="0.18" />
            </pattern>
            <pattern id="vintage-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#3d3428" strokeWidth="0.45" opacity="0.55" />
            </pattern>
            <pattern id="vintage-hatch-dense" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
              <line x1="0" y1="0" x2="0" y2="3" stroke="#3d3428" strokeWidth="0.55" opacity="0.7" />
            </pattern>
            <pattern id="vintage-stipple" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="#3d3428" opacity="0.5" />
              <circle cx="3" cy="3" r="0.35" fill="#3d3428" opacity="0.35" />
            </pattern>
          </>
        )}
        <linearGradient id="iso-sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd08a" stopOpacity="0.13" />
          <stop offset="55%" stopColor="#ffd08a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={offsetX === 0 ? undefined : `translate(${offsetX} 0)`}>
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill={theme.ground} />
      {theme.etching ? (
        <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#vintage-paper)" opacity={0.5} />
      ) : (
        <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#iso-concrete)" />
      )}
      <RoadLayer map={map} theme={theme} />
      <BlockLayer map={map} theme={theme} />
      <g aria-hidden="true">
        {visibleBuildings.map((building) => (
          <g key={`shadow-${building.key}`}>
            <polygon
              className="iso-shadow iso-shadow-contact"
              points={points(buildingBase(building))}
              fill={theme.etching ? 'url(#vintage-hatch-dense)' : theme.shadow}
              stroke={theme.shadow}
              strokeWidth={2}
              opacity={theme.shadowOpacity * 0.55}
            />
            <polygon
              className="iso-shadow"
              points={points(buildingShadow(building))}
              fill={theme.etching ? 'url(#vintage-hatch)' : theme.shadow}
              opacity={theme.shadowOpacity * 0.85}
            />
          </g>
        ))}
      </g>
      {!overlay ? null : theme.etching ? null : <NetworkLayer map={map} theme={theme} />}
      {items.map((item) => item.element)}
      {overlay && theme.etching && <EtchedRouteLayer map={map} theme={theme} />}
      {!theme.etching &&
        [
          { x: 548, y: 286, angle: 8, colour: '#a33f2f' },
          { x: 690, y: 456, angle: -12, colour: '#3f6070' },
          { x: 760, y: 410, angle: 5, colour: '#9a8140' },
          { x: 610, y: 330, angle: 92, colour: '#5c6b4e' },
          { x: 700, y: 250, angle: 178, colour: '#7a3f36' },
        ].map((car) => (
          <CarObject key={`${car.x}-${car.y}`} x={car.x} y={car.y} angle={car.angle} colour={car.colour} theme={theme} />
        ))}
      {overlay && xray && !theme.etching && <XrayLayer map={map} theme={theme} />}
      <LampLayer map={map} theme={theme} />
      {overlay && <StationLayer map={map} theme={theme} />}
      {overlay && <TokenLayer theme={theme} />}
      {theme.etching ? (
        frame ? <VintageOverlay theme={theme} /> : null
      ) : (
        <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#iso-sun)" pointerEvents="none" />
      )}
      </g>
    </svg>
  );
}
