/**
 * Shared transit-route geometry and styling.
 *
 * The Canvas city plate and the SVG overlay must agree on route colour, offset
 * and dash grammar. Keeping them here means a permanent route and its legal-move
 * glow cannot drift onto different sides of the same street.
 *
 * @module apps/web/prototype/routes
 */

import type { MobilityOption } from '@x-yard/game-core';
import type { GraphEdge, MapPoint, NodeId } from '@x-yard/map-generator';

import type { RtsTheme } from '../lab/rts/rtsTheme';

/** Network draw order: lower tiers first, then the stronger lines. */
export const NETWORK_ORDER = ['taxi', 'bus', 'underground', 'special'] as const;

export type NetworkMode = (typeof NETWORK_ORDER)[number];

/**
 * Screen-pixel widths. The same table feeds the SVG overlay and the Canvas
 * plate, so the route grammar survives both renderers.
 */
export const NETWORK_STYLE: Readonly<
  Record<NetworkMode, { readonly width: number; readonly casing: number; readonly dash?: string }>
> = {
  taxi: { width: 4.6, casing: 7.8 },
  bus: { width: 5.4, casing: 8.6, dash: '9 5' },
  underground: { width: 6.0, casing: 9.2 },
  special: { width: 5.2, casing: 8.4, dash: '3 5' },
};

/** Parallel modes sit beside each other instead of painting over one another. */
export const NETWORK_OFFSET_PX: Readonly<Record<NetworkMode, number>> = {
  taxi: -2.4,
  bus: 2.4,
  underground: -4.9,
  special: 4.9,
};

export function modeOffset(mode: MobilityOption): number {
  if (mode === 'foot') return NETWORK_OFFSET_PX.taxi;
  return NETWORK_OFFSET_PX[mode];
}

export function routeColour(theme: RtsTheme, mode: MobilityOption): string {
  if (mode === 'foot') return theme.label;
  return theme.route[mode];
}

export function dashArray(dash: string | undefined): readonly number[] {
  if (dash === undefined) return [];
  const parts = dash.split(/\s+/).map(Number);
  return parts.some((value) => !Number.isFinite(value)) ? [] : parts;
}

function normalAt(from: MapPoint, to: MapPoint): MapPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  return { x: -dy / length, y: dx / length };
}

/**
 * Offset a polyline by a screen-pixel amount. The path is oriented by its
 * endpoints first, so the same street gets the same side even when the network
 * edge and a legal move are stored in opposite directions.
 */
export function offsetPolyline(
  points: readonly MapPoint[],
  offsetPx: number,
  scale: number,
): readonly MapPoint[] {
  if (points.length < 2 || offsetPx === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return points;
  const reverse = first.x > last.x || (first.x === last.x && first.y > last.y);
  const ordered = reverse ? [...points].reverse() : [...points];
  const distance = offsetPx / Math.max(scale, 0.001);
  const result: MapPoint[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const point = ordered[index];
    if (point === undefined) continue;
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    let normal =
      previous === undefined
        ? normalAt(point, next ?? point)
        : next === undefined
          ? normalAt(previous, point)
          : (() => {
              const a = normalAt(previous, point);
              const b = normalAt(point, next);
              const x = a.x + b.x;
              const y = a.y + b.y;
              const length = Math.hypot(x, y);
              return length === 0 ? a : { x: x / length, y: y / length };
            })();
    if (normal.x === 0 && normal.y === 0) normal = { x: 0, y: 1 };
    result.push({ x: point.x + normal.x * distance, y: point.y + normal.y * distance });
  }

  return reverse ? result.reverse() : result;
}

export function edgePoints(
  edge: GraphEdge,
  nodeById: ReadonlyMap<NodeId, { readonly x: number; readonly y: number }>,
): readonly MapPoint[] {
  if (edge.path !== undefined && edge.path.length > 1) return edge.path;
  const from = nodeById.get(edge.a);
  const to = nodeById.get(edge.b);
  if (from === undefined || to === undefined) return [];
  return [
    { x: from.x, y: from.y },
    { x: to.x, y: to.y },
  ];
}

/** Network draw order: mode tier, then id, so the plate is deterministic. */
export function sortedNetworkEdges(edges: readonly GraphEdge[]): readonly GraphEdge[] {
  return [...edges].sort(
    (left, right) =>
      NETWORK_ORDER.indexOf(left.mode) - NETWORK_ORDER.indexOf(right.mode) ||
      left.id.localeCompare(right.id),
  );
}
