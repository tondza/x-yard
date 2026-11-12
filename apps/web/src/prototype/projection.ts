/**
 * Board projections for the city skins.
 *
 * The rules always operate in map coordinates. A skin may render a different
 * projection; the live overlay and camera must use exactly the same one. The
 * isometric vintage skin uses the classic 2:1 projection and translates it so
 * the camera's 0-based bounds still work.
 *
 * @module apps/web/prototype/projection
 */

import type { GeneratedMap, MapPoint } from '@x-yard/map-generator';

import type { MoveStep, Trail } from './motion';

export interface ProjectedBounds {
  readonly width: number;
  readonly height: number;
}

export interface Projection {
  readonly id: 'map' | 'iso';
  readonly bounds: ProjectedBounds;
  /** Translation applied to the city content; the overlay points already include it. */
  readonly offsetX: number;
  readonly point: (point: MapPoint) => MapPoint;
  readonly path: (path: readonly MapPoint[]) => MapPoint[];
}

const ISO_X = 0.9;
const ISO_Y = 0.5;

export function mapProjection(bounds: ProjectedBounds): Projection {
  return {
    id: 'map',
    bounds,
    offsetX: 0,
    point: (point) => point,
    path: (path) => [...path],
  };
}

export function isoProjection(bounds: ProjectedBounds): Projection {
  const offsetX = bounds.height * ISO_X;
  return {
    id: 'iso',
    bounds: {
      width: (bounds.width + bounds.height) * ISO_X,
      height: (bounds.width + bounds.height) * ISO_Y,
    },
    offsetX,
    point: (point) => ({
      x: (point.x - point.y) * ISO_X + offsetX,
      y: (point.x + point.y) * ISO_Y,
    }),
    path: (path) => path.map((point) => ({
      x: (point.x - point.y) * ISO_X + offsetX,
      y: (point.x + point.y) * ISO_Y,
    })),
  };
}

/** A rendered copy of the map with all rendered coordinates projected. */
export function projectMap(map: GeneratedMap, projection: Projection): GeneratedMap {
  if (projection.id === 'map') return map;
  return {
    ...map,
    bounds: projection.bounds,
    graph: {
      ...map.graph,
      nodes: map.graph.nodes.map((node) => {
        const point = projection.point({ x: node.x, y: node.y });
        return { ...node, x: point.x, y: point.y };
      }),
      edges: map.graph.edges.map((edge) => {
        if (edge.path === undefined) return edge;
        return { ...edge, path: projection.path(edge.path) };
      }),
    },
    // The overlay draws landmark plaques, so their anchors must share the
    // projection the stations use. The plate still reads the unprojected map.
    city: {
      ...map.city,
      landmarks: map.city.landmarks.map((landmark) => ({
        ...landmark,
        at: projection.point(landmark.at),
      })),
      streets: map.city.streets.map((street) => ({
        ...street,
        path: projection.path(street.path),
      })),
    },
  };
}

export function projectStep(step: MoveStep, projection: Projection): MoveStep {
  if (projection.id === 'map') return step;
  return { ...step, points: projection.path(step.points) };
}

export function projectTrail(trail: Trail, projection: Projection): Trail {
  if (projection.id === 'map') return trail;
  return { ...trail, points: projection.path(trail.points) };
}
