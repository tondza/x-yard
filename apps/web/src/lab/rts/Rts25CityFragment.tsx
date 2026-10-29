/**
 * Isometric RTS city fragment.
 *
 * Design lab, not the live renderer: the whole map is re-projected into a 2:1
 * map-space view; buildings are extruded up and to the right with visible
 * façades/window grids. This is the "Iron Quarter" option: it keeps the existing
 * board coordinates and camera, so it can plug into the current overlay.
 *
 * @module apps/web/lab/rts/IsoCityFragment
 */

import { useMemo } from 'react';

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

const SKEW_X = 0.28;
const LIFT_Y = 0.9;
export const RTS25_VIEW = { x: 250, y: 100, width: 750, height: 520 } as const;

interface P {
  readonly x: number;
  readonly y: number;
}

function proj(x: number, y: number, z = 0): P {
  return { x: x + z * SKEW_X, y: y - z * LIFT_Y };
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

function transformPath(path: readonly MapPoint[], z = 0): P[] {
  return path.map((point) => proj(point.x, point.y, z));
}

function transformEdge(edge: GraphEdge, nodeById: ReadonlyMap<NodeId, { x: number; y: number }>, z = 0): P[] {
  if (edge.path !== undefined && edge.path.length > 1) return transformPath(edge.path, z);
  const from = nodeById.get(edge.a);
  const to = nodeById.get(edge.b);
  if (from === undefined || to === undefined) return [];
  return [proj(from.x, from.y, z), proj(to.x, to.y, z)];
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
  const t0 = proj(c0.x, c0.y, z1);
  const t1 = proj(c1.x, c1.y, z1);
  const t2 = proj(c2.x, c2.y, z1);
  const t3 = proj(c3.x, c3.y, z1);
  const b0 = proj(c0.x, c0.y, z0);
  const b1 = proj(c1.x, c1.y, z0);
  const b2 = proj(c2.x, c2.y, z0);
  const b3 = proj(c3.x, c3.y, z0);
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
        const front = face.side === 2 || face.side === 3;
        return (
          <g key={`${face.side}-${index}`}>
            <polygon
              points={points(face.points)}
              fill={sideColour[face.side]}
              stroke={theme.shadow}
              strokeWidth={0.55}
              opacity={1}
            />
            <polygon
              points={points(face.points)}
              fill="url(#rts25-brick)"
              opacity={0.16}
            />
            <polygon
              points={points([
                wallPoint(a, b, c, d, 0, 0.72),
                wallPoint(a, b, c, d, 1, 0.72),
                wallPoint(a, b, c, d, 1, 1),
                wallPoint(a, b, c, d, 0, 1),
              ])}
              fill={theme.shadow}
              opacity={0.22}
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
      <polygon points={points(geometry.top)} fill={roofColour} stroke={roofEdge} strokeWidth={0.8} />
      <polygon points={points(geometry.top)} fill="url(#rts25-roof)" opacity={0.28} />
      <polygon points={points(geometry.top)} fill="none" stroke={theme.sun} strokeWidth={0.5} opacity={0.28} />
    </g>
  );
}

function buildingHeight(building: Building): number {
  const hash = hashString(building.key);
  return Math.round(8 + (hash % 5) * 3.2 + building.lift * 0.7);
}

function BuildingObject({
  building,
  theme,
}: {
  readonly building: Building;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const hash = hashString(building.key);
  const wall = theme.walls[hash % theme.walls.length] as WallPalette;
  const roof = theme.roofs[hash % theme.roofs.length] as { top: string; edge: string };
  const height = buildingHeight(building);
  const geometry = prism(building.x, building.y, building.w, building.h, 0, height);
  const gearCount = hash % 3;
  const gear = Array.from({ length: gearCount }, (_, index) => {
    const insetX = 4 + ((hash >>> (3 + index * 2)) % Math.max(4, Math.floor(building.w * 0.45)));
    const insetY = 4 + ((hash >>> (7 + index * 2)) % Math.max(4, Math.floor(building.h * 0.45)));
    const w = Math.min(8, Math.max(3, building.w * 0.18));
    const d = Math.min(7, Math.max(3, building.h * 0.2));
    const gearH = 2.4 + (hash % 3) + index;
    return { x: building.x + insetX, y: building.y + insetY, w, d, h: gearH, index };
  });
  return (
    <g>
      <DrawPrism
        prism={geometry}
        theme={theme}
        wall={wall}
        roofColour={roof.top}
        roofEdge={roof.edge}
        hash={hash}
      />
      {gear.map((item) => {
        const itemGeometry = prism(item.x, item.y, item.w, item.d, height, height + item.h);
        return (
          <g key={`gear-${item.index}`}>
            <DrawPrism
              prism={itemGeometry}
              theme={theme}
              wall={{ light: theme.steel, mid: theme.steel, dark: theme.shadow }}
              roofColour={item.index === 0 ? theme.rust : theme.steel}
              roofEdge={theme.shadow}
              hash={hash + item.index}
              windows={false}
            />
          </g>
        );
      })}
      {hash % 7 === 0 && (
        <g>
          <line
            x1={proj(building.x + building.w * 0.5, building.y + building.h * 0.5, height).x}
            y1={proj(building.x + building.w * 0.5, building.y + building.h * 0.5, height).y}
            x2={proj(building.x + building.w * 0.5, building.y + building.h * 0.5, height + 18).x}
            y2={proj(building.x + building.w * 0.5, building.y + building.h * 0.5, height + 18).y}
            stroke={theme.steel}
            strokeWidth={1}
          />
          <circle
            cx={proj(building.x + building.w * 0.5, building.y + building.h * 0.5, height + 18).x}
            cy={proj(building.x + building.w * 0.5, building.y + building.h * 0.5, height + 18).y}
            r={1.3}
            fill={theme.fugitive}
          />
        </g>
      )}
    </g>
  );
}

function TreeObject({ tree, theme }: { readonly tree: Tree; readonly theme: RtsTheme }): React.JSX.Element {
  const base = proj(tree.x, tree.y, 0);
  const height = 8 + tree.r * 0.9;
  const top = proj(tree.x, tree.y, height);
  const radius = Math.max(4, tree.r * 0.9);
  return (
    <g>
      <ellipse cx={base.x + 5} cy={base.y + 2} rx={radius * 0.9} ry={radius * 0.35} fill={theme.shadow} opacity={theme.shadowOpacity * 0.8} />
      <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={theme.treeTrunk} strokeWidth={1.6} />
      <circle cx={top.x} cy={top.y} r={radius} fill={theme.tree} stroke={theme.shadow} strokeWidth={0.6} />
      <circle cx={top.x - radius * 0.4} cy={top.y - radius * 0.25} r={radius * 0.62} fill={theme.treeLight} opacity={0.9} />
      <circle cx={top.x + radius * 0.35} cy={top.y - radius * 0.1} r={radius * 0.45} fill={theme.tree} opacity={0.9} />
    </g>
  );
}

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
  ].map((p) => proj(p.x, p.y, 0));
  const roof = [
    point(-3, -1.9),
    point(3, -1.9),
    point(3, 1.9),
    point(-3, 1.9),
  ].map((p) => proj(p.x, p.y, 4.2));
  return (
    <g>
      <polygon points={points(body)} fill={theme.shadow} opacity={0.5} transform="translate(5 3)" />
      <polygon points={points(body)} fill={colour} stroke={theme.shadow} strokeWidth={0.6} />
      <polygon points={points(roof)} fill={theme.window} opacity={0.7} stroke={theme.shadow} strokeWidth={0.4} />
      <circle cx={proj(point(5, 2.4).x, point(5, 2.4).y, 1).x} cy={proj(point(5, 2.4).x, point(5, 2.4).y, 1).y} r={1} fill={theme.lane} />
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
            <path d={pathOf(path)} fill="none" stroke={theme.sidewalk} strokeWidth={width + 7} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathOf(path)} fill="none" stroke={theme.asphalt} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathOf(path)} fill="none" stroke={theme.lane} strokeWidth={0.8} strokeLinecap="round" strokeDasharray="6 11" opacity={0.35} />
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
        const poly = block.polygon.map((point) => proj(point.x, point.y, 0));
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

function LandmarkObject({ landmark, theme }: { readonly landmark: LandmarkModel; readonly theme: RtsTheme }): React.JSX.Element {
  const { x, y } = landmark.at;
  if (landmark.kind === 'square') {
    const center = proj(x, y, 0);
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
    const towerTop = proj(x, y, 42);
    const spireTop = proj(x, y, 58);
    return (
      <g>
        <DrawPrism prism={base} theme={theme} wall={{ light: '#a89a84', mid: '#8b7d69', dark: '#635a4c' }} roofColour="#4b4f50" roofEdge={theme.shadow} hash={7} windows />
        <DrawPrism prism={tower} theme={theme} wall={{ light: '#b7a58c', mid: '#96846d', dark: '#6d5f4e' }} roofColour="#54483c" roofEdge={theme.shadow} hash={11} windows />
        <polygon points={points([towerTop, proj(x - 9, y + 9, 42), proj(x + 9, y + 9, 42)])} fill="#6d4d3c" stroke={theme.shadow} strokeWidth={0.6} />
        <polygon points={points([proj(x - 9, y + 9, 42), proj(x + 9, y + 9, 42), spireTop])} fill="#7c5a45" stroke={theme.shadow} strokeWidth={0.6} />
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
        <DrawPrism prism={base} theme={theme} wall={{ light: '#9e9684', mid: '#817a6b', dark: '#5d574c' }} roofColour="#4d5354" roofEdge={theme.shadow} hash={19} windows />
        <DrawPrism prism={roof} theme={theme} wall={{ light: '#5a7d86', mid: '#43646c', dark: '#2c454b' }} roofColour="#3f707b" roofEdge={theme.shadow} hash={23} windows={false} />
        {[-24, -8, 8, 24].map((offset) => {
          const a = proj(x + offset, y - 16, 25);
          const b = proj(x + offset, y + 16, 25);
          return <line key={offset} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.steel} strokeWidth={0.8} opacity={0.8} />;
        })}
      </g>
    );
  }

  const base = prism(x - 30, y - 16, 60, 32, 0, 12);
  const ridgeA = proj(x - 32, y - 18, 22);
  const ridgeB = proj(x + 32, y - 18, 22);
  const ridgeC = proj(x + 32, y + 18, 22);
  const ridgeD = proj(x - 32, y + 18, 22);
  return (
    <g>
      <DrawPrism prism={base} theme={theme} wall={{ light: '#b08a5f', mid: '#8c6a46', dark: '#604830' }} roofColour="#5b4a3f" roofEdge={theme.shadow} hash={29} windows />
      <polygon points={points([proj(x - 30, y - 16, 12), proj(x + 30, y - 16, 12), ridgeB, ridgeA])} fill="#6e5847" stroke={theme.shadow} strokeWidth={0.6} />
      <polygon points={points([proj(x - 30, y + 16, 12), ridgeD, ridgeC, proj(x + 30, y + 16, 12)])} fill="#4f4035" stroke={theme.shadow} strokeWidth={0.6} />
    </g>
  );
}

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
        const base = proj(node.x, node.y, 0);
        const major = node.class !== 'street';
        const showLabel =
          major ||
          index % 5 === 0 ||
          node.id === 'n8' ||
          node.id === 'n11' ||
          node.id === 'n24';
        const badgeColours: Record<string, string> = {
          bus: theme.route.bus,
          underground: theme.route.underground,
          special: theme.route.special,
        };
        return (
          <g key={node.id}>
            <ellipse cx={base.x} cy={base.y} rx={major ? 7 : 5} ry={major ? 3.5 : 2.5} fill={theme.stationPad} stroke={theme.stationRing} strokeWidth={1.1} />
            <ellipse cx={base.x} cy={base.y} rx={2.6} ry={1.3} fill={theme.shadow} opacity={0.5} />
            {showLabel && (
              <text
                x={base.x + 5}
                y={base.y - 4}
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
                  x={base.x - 6}
                  y={base.y + badgeIndex * 7}
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
        const base = proj(point.x, point.y, 0);
        const top = proj(point.x, point.y, 16);
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

function LampLayer({ map, theme }: { readonly map: GeneratedMap; readonly theme: RtsTheme }): React.JSX.Element {
  const nodes = map.graph.nodes.filter((_, index) => index % 6 === 0);
  return (
    <g aria-hidden="true">
      {nodes.map((node) => {
        const base = proj(node.x, node.y, 0);
        const top = proj(node.x, node.y, theme.night ? 15 : 12);
        return (
          <g key={`lamp-${node.id}`}>
            <circle cx={top.x} cy={top.y} r={theme.night ? 22 : 12} fill={`url(#${theme.id}-lamp)`} opacity={theme.night ? 0.8 : 0.35} />
            <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={theme.steel} strokeWidth={0.8} />
            <circle cx={top.x} cy={top.y} r={1.6} fill={theme.windowLit} />
          </g>
        );
      })}
      {map.city.landmarks.map((landmark) => {
        const top = proj(landmark.at.x, landmark.at.y, theme.night ? 20 : 16);
        return <circle key={`flood-${landmark.id}`} cx={top.x} cy={top.y} r={theme.night ? 45 : 25} fill={`url(#${theme.id}-lamp)`} opacity={theme.night ? 0.55 : 0.25} />;
      })}
    </g>
  );
}

export function Rts25CityFragment({
  map,
  theme,
  viewBox,
  overlay = true,
}: {
  readonly map: GeneratedMap;
  readonly theme: RtsTheme;
  readonly viewBox?: string;
  readonly overlay?: boolean;
}): React.JSX.Element {
  const buildings = useMemo(() => buildingsForMap(map), [map]);
  const trees = useMemo(() => treesForMap(map), [map]);
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const area = overlay ? RTS25_VIEW : { x: 0, y: 0, width: map.bounds.width, height: map.bounds.height };
  const items = useMemo(() => {
    const list: { depth: number; element: React.JSX.Element }[] = [];
    for (const building of buildings) {
      const point = proj(building.x + building.w / 2, building.y + building.h / 2, 0);
      if (overlay && (point.x < RTS25_VIEW.x - 120 || point.x > RTS25_VIEW.x + RTS25_VIEW.width + 120 || point.y < RTS25_VIEW.y - 120 || point.y > RTS25_VIEW.y + RTS25_VIEW.height + 120)) continue;
      list.push({ depth: building.x + building.y + building.w + building.h, element: <BuildingObject key={building.key} building={building} theme={theme} /> });
    }
    for (const tree of trees) {
      const point = proj(tree.x, tree.y, 0);
      if (overlay && (point.x < RTS25_VIEW.x - 80 || point.x > RTS25_VIEW.x + RTS25_VIEW.width + 80 || point.y < RTS25_VIEW.y - 80 || point.y > RTS25_VIEW.y + RTS25_VIEW.height + 80)) continue;
      list.push({ depth: tree.x + tree.y + 2, element: <TreeObject key={tree.key} tree={tree} theme={theme} /> });
    }
    for (const landmark of map.city.landmarks) {
      list.push({ depth: landmark.at.x + landmark.at.y, element: <LandmarkObject key={landmark.id} landmark={landmark} theme={theme} /> });
    }
    return list.sort((left, right) => left.depth - right.depth);
  }, [buildings, map.city.landmarks, overlay, theme, trees]);

  return (
    <svg
      className={overlay ? 'city-fragment rts25-fragment' : 'city-plate rts25-plate'}
      viewBox={viewBox ?? `${RTS25_VIEW.x} ${RTS25_VIEW.y} ${RTS25_VIEW.width} ${RTS25_VIEW.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${theme.title} 2.5D city`}
    >
      <defs>
        <radialGradient id={`${theme.id}-lamp`}>
          <stop offset="0%" stopColor={theme.windowLit} stopOpacity={0.38} />
          <stop offset="55%" stopColor={theme.windowLit} stopOpacity={0.12} />
          <stop offset="100%" stopColor={theme.windowLit} stopOpacity={0} />
        </radialGradient>
        <pattern id="rts25-concrete" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.6" fill="#0c0e0f" opacity="0.35" />
          <circle cx="8" cy="7" r="0.45" fill="#0c0e0f" opacity="0.3" />
        </pattern>
        <pattern id="rts25-roof" width="8" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="7" x2="8" y2="7" stroke="#0b0d0e" strokeWidth="0.3" opacity="0.35" />
          <line x1="4" y1="0" x2="4" y2="7" stroke="#0b0d0e" strokeWidth="0.22" opacity="0.25" />
        </pattern>
        <pattern id="rts25-brick" width="6" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="3.5" x2="6" y2="3.5" stroke="#0b0d0e" strokeWidth="0.28" opacity="0.5" />
          <line x1="3" y1="0" x2="3" y2="1.8" stroke="#0b0d0e" strokeWidth="0.22" opacity="0.4" />
        </pattern>
        <linearGradient id="rts25-sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd08a" stopOpacity="0.13" />
          <stop offset="55%" stopColor="#ffd08a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill={theme.ground} />
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#rts25-concrete)" />
      <RoadLayer map={map} theme={theme} />
      <BlockLayer map={map} theme={theme} />
      <g aria-hidden="true">
        {buildings.map((building) => (
          <polygon
            key={`shadow-${building.key}`}
            points={points([
              proj(building.x + 18, building.y + 10, 0),
              proj(building.x + building.w + 18, building.y + 10, 0),
              proj(building.x + building.w + 18, building.y + building.h + 10, 0),
              proj(building.x + 18, building.y + building.h + 10, 0),
            ])}
            fill={theme.shadow}
            opacity={theme.shadowOpacity}
          />
        ))}
      </g>
      {overlay && <NetworkLayer map={map} theme={theme} />}
      {items.map((item) => item.element)}
      {[
        { x: 548, y: 286, angle: 8, colour: '#8a3d2f' },
        { x: 690, y: 456, angle: -12, colour: '#4d5f6b' },
        { x: 760, y: 410, angle: 5, colour: '#8c7a4e' },
      ].map((car) => (
        <CarObject key={`${car.x}-${car.y}`} x={car.x} y={car.y} angle={car.angle} colour={car.colour} theme={theme} />
      ))}
      <LampLayer map={map} theme={theme} />
      {overlay && <StationLayer map={map} theme={theme} />}
      {overlay && <TokenLayer theme={theme} />}
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#rts25-sun)" pointerEvents="none" />
    </svg>
  );
}
