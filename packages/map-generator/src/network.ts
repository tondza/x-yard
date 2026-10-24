/**
 * Stage 2 — the transit network.
 *
 * This is the part that matters: stations, classes, the four transit tiers, and
 * the street-following paths that make a move readable. The city skeleton only
 * gives it streets to route on.
 *
 * All randomness comes from the seeded stream passed in; the same seed must
 * produce the same network byte for byte.
 *
 * @module @x-yard/map-generator/network
 */

import {
  MIN_START_SEPARATION_EDGES,
  TRANSPORT_MODES,
  validateGraph,
  validateStreetGeometry,
} from '@x-yard/game-core';
import type {
  DistrictId,
  Facility,
  GraphEdge,
  GraphNode,
  MapPoint,
  NodeClass,
  NodeId,
  TransitGraph,
  TransportMode,
} from '@x-yard/game-core';

import type { CityBuild, GridEdge, Intersection } from './grid';
import type { Rng } from './rng';
import type { MapFacilities, MapGeometryValidation, MapStarts, MapStats } from './types';

/** A station before it becomes a `GraphNode`. */
interface Station {
  readonly id: NodeId;
  readonly intersection: Intersection;
  readonly class: NodeClass;
  readonly district: DistrictId;
}

/** A route between two points: polyline, distance, and the street path used. */
interface Route {
  readonly distance: number;
  readonly points: readonly MapPoint[];
}

/** The network portion of a map, before validation. */
export interface NetworkBuild {
  readonly graph: TransitGraph;
  readonly stations: readonly Station[];
  readonly facilities: MapFacilities;
  readonly starts: MapStarts | null;
  readonly stats: MapStats;
  readonly geometry: MapGeometryValidation;
}

/*
 * PROVISIONAL (Q7): the class mix is a share of the station count, not a fixed
 * count, so 24 and 60 node maps scale the same way. The shares reproduce the
 * plan's 16/6/2 and the rules doc's 40/14/6.
 */
const PROVISIONAL_TERMINAL_SHARE = 0.1;
const PROVISIONAL_HUB_SHARE = 0.2333;
const PROVISIONAL_TAXI_EDGES_PER_NODE = 1.55;
const PROVISIONAL_MAX_TAXI_EDGES_PER_STATION = 6;
const PROVISIONAL_TAXI_REACH_FACTOR = 2.4;
const PROVISIONAL_MAX_STATION_DEGREE = 9;

function centroid(build: CityBuild): MapPoint {
  return { x: build.params.worldWidth / 2, y: build.params.worldHeight / 2 };
}

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function districtOf(build: CityBuild, point: MapPoint): DistrictId {
  const west = point.x < build.params.worldWidth / 2;
  const north = point.y < build.params.worldHeight / 2;
  if (north) return west ? 'nw' : 'ne';
  return west ? 'sw' : 'se';
}

/** Farthest-point sampling, seeded at one interior intersection. */
function chooseIntersections(build: CityBuild, rng: Rng, count: number): readonly Intersection[] {
  // Prefer junctions with at least three streets: after thinning, a two-street
  // corner makes a poor station and a dead end on the map.
  const junctions = build.intersections.filter(
    (intersection) => (build.adjacency.get(intersection.id)?.length ?? 0) >= 3,
  );
  const pool = junctions.length >= count ? junctions : build.intersections;
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));

  const chosen: Intersection[] = [rng.pick(sorted)];
  const remaining = sorted.filter((intersection) => intersection.id !== chosen[0]?.id);

  while (chosen.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index] as Intersection;
      let nearest = Number.POSITIVE_INFINITY;
      for (const station of chosen) {
        nearest = Math.min(nearest, distance(candidate, station));
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    if (next !== undefined) chosen.push(next);
  }

  return chosen;
}

/** Assign ids by reading order, then classes by position and street rank. */
function classifyStations(build: CityBuild, intersections: readonly Intersection[]): readonly Station[] {
  const ordered = [...intersections].sort((a, b) => a.y - b.y || a.x - b.x);

  const stations: Station[] = ordered.map((intersection, index) => ({
    id: `n${index + 1}`,
    intersection,
    class: 'street',
    district: districtOf(build, intersection),
  }));

  const terminalCount = Math.max(2, Math.round(stations.length * PROVISIONAL_TERMINAL_SHARE));
  const hubCount = Math.max(2, Math.round(stations.length * PROVISIONAL_HUB_SHARE));
  const centre = centroid(build);

  /* Terminals: farthest-point among the stations, starting from the most peripheral. */
  const byPeriphery = [...stations].sort(
    (a, b) =>
      distance(b.intersection, centre) - distance(a.intersection, centre) ||
      a.id.localeCompare(b.id),
  );
  const terminals: Station[] = [];
  const firstTerminal = byPeriphery[0];
  if (firstTerminal !== undefined) terminals.push(firstTerminal);

  while (terminals.length < terminalCount && terminals.length < stations.length) {
    let best: Station | null = null;
    let bestSeparation = -1;
    for (const station of stations) {
      if (terminals.some((terminal) => terminal.id === station.id)) continue;
      const separation = Math.min(
        ...terminals.map((terminal) => distance(station.intersection, terminal.intersection)),
      );
      if (separation > bestSeparation) {
        bestSeparation = separation;
        best = station;
      }
    }
    if (best === null) break;
    terminals.push(best);
  }

  const terminalIds = new Set(terminals.map((terminal) => terminal.id));

  /* Hubs: the stations with the strongest boulevard frontage. */
  const rankScore = (station: Station): number => {
    const edges = build.adjacency.get(station.intersection.id) ?? [];
    return edges.reduce((sum, edge) => sum + edge.rank, 0);
  };

  const hubCandidates = stations
    .filter((station) => !terminalIds.has(station.id))
    .sort((a, b) => rankScore(b) - rankScore(a) || a.id.localeCompare(b.id));

  const hubIds = new Set(hubCandidates.slice(0, hubCount).map((station) => station.id));

  return stations.map((station) => {
    if (terminalIds.has(station.id)) return { ...station, class: 'terminal' };
    if (hubIds.has(station.id)) return { ...station, class: 'hub' };
    return station;
  });
}

/* ------------------------------------------------------------------ *
 * Street routing
 * ------------------------------------------------------------------ */

function edgePoints(edge: GridEdge, from: Intersection): readonly MapPoint[] {
  return edge.a.id === from.id ? edge.street.path : [...edge.street.path].reverse();
}

function appendPoints(target: MapPoint[], points: readonly MapPoint[]): void {
  for (const point of points) {
    const last = target[target.length - 1];
    if (last !== undefined && Math.abs(last.x - point.x) < 1e-6 && Math.abs(last.y - point.y) < 1e-6) {
      continue;
    }
    target.push({ x: point.x, y: point.y });
  }
}

function polylineLength(points: readonly MapPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1] as MapPoint;
    const b = points[index] as MapPoint;
    length += distance(a, b);
  }
  return length;
}

/** Dijkstra over the street lattice; returns the shortest street path. */
function shortestStreetRoute(build: CityBuild, from: Intersection, to: Intersection): Route {
  if (from.id === to.id) return { distance: 0, points: [{ x: from.x, y: from.y }] };

  const distances = new Map<string, number>();
  const previous = new Map<string, { vertex: Intersection; edge: GridEdge }>();
  const visited = new Set<string>();

  for (const intersection of build.intersections) distances.set(intersection.id, Number.POSITIVE_INFINITY);
  distances.set(from.id, 0);

  while (visited.size < build.intersections.length) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const [id, value] of distances) {
      if (visited.has(id)) continue;
      if (value < currentDistance) {
        currentDistance = value;
        currentId = id;
      }
    }

    if (currentId === null) break;
    visited.add(currentId);
    if (currentId === to.id) break;

    const current = build.byId.get(currentId);
    if (current === undefined) continue;

    for (const edge of build.adjacency.get(currentId) ?? []) {
      const other = edge.a.id === currentId ? edge.b : edge.a;
      const length = polylineLength(edge.street.path);
      const candidate = currentDistance + length;
      if (candidate < (distances.get(other.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(other.id, candidate);
        previous.set(other.id, { vertex: current, edge });
      }
    }
  }

  const routeEdges: { edge: GridEdge; from: Intersection }[] = [];
  let cursor = to;
  while (cursor.id !== from.id) {
    const step = previous.get(cursor.id);
    if (step === undefined) break;
    routeEdges.push({ edge: step.edge, from: step.vertex });
    cursor = step.vertex;
  }
  routeEdges.reverse();

  const points: MapPoint[] = [];
  for (const step of routeEdges) appendPoints(points, edgePoints(step.edge, step.from));

  if (points.length < 2) {
    return {
      distance: distance(from, to),
      points: [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ],
    };
  }

  return { distance: polylineLength(points), points };
}

/** A route along one row or column, used for bus corridors. */
function straightCorridorRoute(build: CityBuild, from: Intersection, to: Intersection): Route | null {
  if (from.row === to.row) {
    const step = from.col < to.col ? 1 : -1;
    const points: MapPoint[] = [];
    let cursor = from;
    while (cursor.col !== to.col) {
      const nextCol = cursor.col + step;
      const next = build.byId.get(`i${cursor.row}-${nextCol}`);
      if (next === undefined) return null;
      const edge = (build.adjacency.get(cursor.id) ?? []).find(
        (candidate) => candidate.a.id === next.id || candidate.b.id === next.id,
      );
      if (edge === undefined) return null;
      appendPoints(points, edgePoints(edge, cursor));
      cursor = next;
    }
    return { distance: polylineLength(points), points };
  }

  if (from.col === to.col) {
    const step = from.row < to.row ? 1 : -1;
    const points: MapPoint[] = [];
    let cursor = from;
    while (cursor.row !== to.row) {
      const nextRow = cursor.row + step;
      const next = build.byId.get(`i${nextRow}-${cursor.col}`);
      if (next === undefined) return null;
      const edge = (build.adjacency.get(cursor.id) ?? []).find(
        (candidate) => candidate.a.id === next.id || candidate.b.id === next.id,
      );
      if (edge === undefined) return null;
      appendPoints(points, edgePoints(edge, cursor));
      cursor = next;
    }
    return { distance: polylineLength(points), points };
  }

  return null;
}

/** A quadratic arc between two stations; used by metro and special links. */
function curveRoute(from: MapPoint, to: MapPoint, bend: number): Route {
  const length = distance(from, to);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const normal = length === 0 ? { x: 0, y: 0 } : { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
  const control = { x: mid.x + normal.x * length * bend, y: mid.y + normal.y * length * bend };

  const points: MapPoint[] = [];
  for (let index = 0; index <= 12; index += 1) {
    const t = index / 12;
    const inv = 1 - t;
    points.push({
      x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
      y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
    });
  }

  return { distance: polylineLength(points), points };
}

/* ------------------------------------------------------------------ *
 * Network construction
 * ------------------------------------------------------------------ */

function edgeId(prefix: string, a: NodeId, b: NodeId): string {
  return a < b ? `${prefix}:${a}-${b}` : `${prefix}:${b}-${a}`;
}

function routeKey(a: NodeId, b: NodeId, mode: TransportMode): string {
  return a < b ? `${a}|${b}|${mode}` : `${b}|${a}|${mode}`;
}

/** Build stations, edges, facilities and starts; never throws on a bad map. */
export function buildTransitNetwork(build: CityBuild, rng: Rng): NetworkBuild {
  const chosen = chooseIntersections(build, rng, build.params.targetNodes);
  const stations = classifyStations(build, chosen);

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (
    a: Station,
    b: Station,
    mode: TransportMode,
    route: Route,
    bendForCurve = 0,
  ): boolean => {
    if (a.id === b.id) return false;
    const key = routeKey(a.id, b.id, mode);
    if (seen.has(key)) return false;
    seen.add(key);

    const points =
      mode === 'underground' || mode === 'special'
        ? curveRoute(a.intersection, b.intersection, bendForCurve).points
        : route.points;

    edges.push({
      id: edgeId(mode, a.id, b.id),
      a: a.id,
      b: b.id,
      mode,
      ticketCost: 1,
      symmetric: true,
      path: points,
    });
    return true;
  };

  const routeCache = new Map<string, Route>();
  const streetRoute = (a: Station, b: Station): Route => {
    // The cache key must be ordered: a route's polyline runs from a to b.
    const key = `${a.id}|${b.id}`;
    const cached = routeCache.get(key);
    if (cached !== undefined) return cached;
    const route = shortestStreetRoute(build, a.intersection, b.intersection);
    routeCache.set(key, route);
    return route;
  };

  /* Taxi: a spanning tree first, so every node is walkable, then local extras. */
  const degree = new Map<NodeId, number>(stations.map((station) => [station.id, 0]));
  const connectTaxi = (a: Station, b: Station): boolean => {
    if (!addEdge(a, b, 'taxi', streetRoute(a, b))) return false;
    degree.set(a.id, (degree.get(a.id) ?? 0) + 1);
    degree.set(b.id, (degree.get(b.id) ?? 0) + 1);
    return true;
  };

  const connected = new Set<number>([0]);
  while (connected.size < stations.length) {
    let best: { from: number; to: number; route: Route } | null = null;

    for (const from of connected) {
      const a = stations[from];
      if (a === undefined) continue;
      for (let to = 0; to < stations.length; to += 1) {
        if (connected.has(to)) continue;
        const b = stations[to];
        if (b === undefined) continue;
        const route = streetRoute(a, b);
        if (best === null || route.distance < best.route.distance) best = { from, to, route };
      }
    }

    if (best === null) break;
    const a = stations[best.from];
    const b = stations[best.to];
    if (a === undefined || b === undefined) break;
    connectTaxi(a, b);
    connected.add(best.to);
  }

  const candidateEdges: { a: Station; b: Station; route: Route }[] = [];
  for (let i = 0; i < stations.length; i += 1) {
    for (let j = i + 1; j < stations.length; j += 1) {
      const a = stations[i];
      const b = stations[j];
      if (a === undefined || b === undefined) continue;
      if (seen.has(routeKey(a.id, b.id, 'taxi'))) continue;
      candidateEdges.push({ a, b, route: streetRoute(a, b) });
    }
  }
  candidateEdges.sort((left, right) => left.route.distance - right.route.distance);

  const taxiTarget = Math.round(stations.length * PROVISIONAL_TAXI_EDGES_PER_NODE);
  const maxTaxiReach = Math.max(build.spacingX, build.spacingY) * PROVISIONAL_TAXI_REACH_FACTOR;

  for (const candidate of candidateEdges) {
    if (edges.filter((edge) => edge.mode === 'taxi').length >= taxiTarget) break;
    if (candidate.route.distance > maxTaxiReach) continue;
    if ((degree.get(candidate.a.id) ?? 0) >= PROVISIONAL_MAX_TAXI_EDGES_PER_STATION) continue;
    if ((degree.get(candidate.b.id) ?? 0) >= PROVISIONAL_MAX_TAXI_EDGES_PER_STATION) continue;
    connectTaxi(candidate.a, candidate.b);
  }

  /* No station may be a dead end: the validator warns, and a one-edge station
     is a bad experience even before it does. Skip pairs already joined by a
     taxi edge; otherwise the "nearest" candidate is the existing neighbour and
     the loop stops without adding anything. */
  for (const station of stations) {
    let guard = 0;
    while ((degree.get(station.id) ?? 0) < 2 && guard < stations.length) {
      guard += 1;
      const nearest = stations
        .filter(
          (other) =>
            other.id !== station.id &&
            (degree.get(other.id) ?? 0) < PROVISIONAL_MAX_STATION_DEGREE &&
            !seen.has(routeKey(station.id, other.id, 'taxi')),
        )
        .map((other) => ({ other, route: streetRoute(station, other) }))
        .sort((left, right) => left.route.distance - right.route.distance)[0];

      if (nearest === undefined) break;
      if (!connectTaxi(station, nearest.other)) break;
    }
  }

  /* Bus: stations with boulevard frontage, connected along the boulevard. */
  const busStations = stations.filter((station) => station.class === 'hub' || station.class === 'terminal');

  const connectBusRow = (row: number): void => {
    const onRow = busStations
      .filter((station) => station.intersection.row === row)
      .sort((a, b) => a.intersection.col - b.intersection.col);
    for (let index = 1; index < onRow.length; index += 1) {
      const a = onRow[index - 1] as Station;
      const b = onRow[index] as Station;
      const route = straightCorridorRoute(build, a.intersection, b.intersection);
      if (route !== null) addEdge(a, b, 'bus', route);
    }
  };

  const connectBusColumn = (col: number): void => {
    const onColumn = busStations
      .filter((station) => station.intersection.col === col)
      .sort((a, b) => a.intersection.row - b.intersection.row);
    for (let index = 1; index < onColumn.length; index += 1) {
      const a = onColumn[index - 1] as Station;
      const b = onColumn[index] as Station;
      const route = straightCorridorRoute(build, a.intersection, b.intersection);
      if (route !== null) addEdge(a, b, 'bus', route);
    }
  };

  for (const row of build.boulevardRows) connectBusRow(row);
  for (const col of build.boulevardCols) connectBusColumn(col);

  if (edges.filter((edge) => edge.mode === 'bus').length < 2) {
    const pairs = busStations
      .map((station) => station)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (let index = 0; index + 1 < pairs.length; index += 1) {
      const a = pairs[index] as Station;
      const b = pairs[index + 1] as Station;
      addEdge(a, b, 'bus', streetRoute(a, b));
      if (edges.filter((edge) => edge.mode === 'bus').length >= 2) break;
    }
  }

  /* Metro: pair the terminals across the map, so every line is long. */
  const terminals = stations
    .filter((station) => station.class === 'terminal')
    .sort((a, b) => a.intersection.x - b.intersection.x || a.intersection.y - b.intersection.y);

  for (let index = 0; index < Math.floor(terminals.length / 2); index += 1) {
    const a = terminals[index];
    const b = terminals[terminals.length - 1 - index];
    if (a === undefined || b === undefined) continue;
    addEdge(a, b, 'underground', streetRoute(a, b), rng.jitter(0.2));
  }

  /*
   * Special: one alley/boat shortcut. Prefer the pair whose street route is
   * most disproportionate to the crow line, but always add the best candidate
   * so every generated map exercises the fourth tier.
   */
  const streetStations = stations.filter((station) => station.class === 'street');
  const minCrow = Math.min(build.spacingX, build.spacingY) * 0.5;
  let bestSpecial: { a: Station; b: Station; ratio: number } | null = null;
  for (let i = 0; i < streetStations.length; i += 1) {
    for (let j = i + 1; j < streetStations.length; j += 1) {
      const a = streetStations[i];
      const b = streetStations[j];
      if (a === undefined || b === undefined) continue;
      if (seen.has(routeKey(a.id, b.id, 'taxi'))) continue;
      const crow = distance(a.intersection, b.intersection);
      if (crow < minCrow) continue;
      const street = streetRoute(a, b).distance;
      const ratio = street / crow;
      if (bestSpecial === null || ratio > bestSpecial.ratio) {
        bestSpecial = { a, b, ratio };
      }
    }
  }
  if (bestSpecial !== null) {
    addEdge(bestSpecial.a, bestSpecial.b, 'special', streetRoute(bestSpecial.a, bestSpecial.b), 0.16);
  }

  /* Facilities: one of each, on ordinary street nodes (inert in the prototype). */
  const streetPool = stations.filter((station) => station.class === 'street');
  const facilityCandidates = (streetPool.length >= 2 ? streetPool : [...stations]).sort(
    (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id),
  );
  const blackMarket = facilityCandidates[0];
  const safeHouse = facilityCandidates.find((station) => station.id !== blackMarket?.id);
  if (blackMarket === undefined || safeHouse === undefined) {
    throw new Error('a generated map needs at least two stations for facilities');
  }

  /* Nodes: modes are derived from incident edges, exactly as the validator
     requires. Facilities are attached here, not in the generator loop above. */
  const incidentModes = new Map<NodeId, Set<TransportMode>>(
    stations.map((station) => [station.id, new Set<TransportMode>()]),
  );
  for (const edge of edges) {
    incidentModes.get(edge.a)?.add(edge.mode);
    incidentModes.get(edge.b)?.add(edge.mode);
  }

  const nodes: GraphNode[] = stations.map((station) => {
    const modes = TRANSPORT_MODES.filter((mode) => incidentModes.get(station.id)?.has(mode) === true);
    const facilities: Facility[] = [];
    if (station.id === blackMarket.id) facilities.push('black-market');
    if (station.id === safeHouse.id) facilities.push('safe-house');

    return {
      id: station.id,
      class: station.class,
      modes,
      district: station.district,
      facilities,
      x: station.intersection.x,
      y: station.intersection.y,
    };
  });

  const graph: TransitGraph = {
    mapId: 'generated',
    world: { width: build.params.worldWidth, height: build.params.worldHeight },
    nodes,
    edges,
  };

  const starts = chooseStarts(graph, stations);
  const stats = statsFor(graph, stations, starts);

  const graphReport = validateGraph(graph);
  const geometry = validateStreetGeometry(graph, build.city.streets);
  const errors = [...graphReport.errors, ...geometry.errors];

  return {
    graph,
    stations,
    facilities: { blackMarket: blackMarket.id, safeHouse: safeHouse.id },
    starts,
    stats,
    geometry: { ok: geometry.ok, errors: geometry.errors, checkedEdges: geometry.checkedEdges },
  };
}

/* ------------------------------------------------------------------ *
 * Starts and stats
 * ------------------------------------------------------------------ */

function distancesFrom(graph: TransitGraph, start: NodeId): Map<NodeId, number> {
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.a)?.push(edge.b);
    adjacency.get(edge.b)?.push(edge.a);
  }

  const distances = new Map<NodeId, number>([[start, 0]]);
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const current = queue.shift() as NodeId;
    const currentDistance = distances.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, currentDistance + 1);
      queue.push(next);
    }
  }
  return distances;
}

/**
 * Pick a Fugitive start with at least four stations beyond the separation
 * radius, then put the four Agents on the farthest of them.
 */
function chooseStarts(graph: TransitGraph, stations: readonly Station[]): MapStarts | null {
  const radius = MIN_START_SEPARATION_EDGES;
  let best: { station: Station; far: readonly { id: NodeId; distance: number }[] } | null = null;

  for (const station of stations) {
    const distances = distancesFrom(graph, station.id);
    const far = [...distances.entries()]
      .filter(([id, value]) => id !== station.id && value >= radius)
      .map(([id, value]) => ({ id, distance: value }))
      .sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id));

    if (far.length < 4) continue;
    if (best === null || far.length > best.far.length) best = { station, far };
  }

  if (best === null) return null;
  return {
    fugitive: best.station.id,
    agents: best.far.slice(0, 4).map((entry) => entry.id),
  };
}

function statsFor(graph: TransitGraph, stations: readonly Station[], starts: MapStarts | null): MapStats {
  const byMode: Record<TransportMode, number> = { taxi: 0, bus: 0, underground: 0, special: 0 };
  for (const edge of graph.edges) byMode[edge.mode] += 1;

  const neighbours = new Map<NodeId, Set<NodeId>>(stations.map((station) => [station.id, new Set<NodeId>()]));
  for (const edge of graph.edges) {
    neighbours.get(edge.a)?.add(edge.b);
    neighbours.get(edge.b)?.add(edge.a);
  }
  const degrees = [...neighbours.values()].map((set) => set.size);

  const classMix: Record<NodeClass, number> = { street: 0, hub: 0, terminal: 0 };
  for (const station of stations) classMix[station.class] += 1;

  const startDistances =
    starts === null
      ? []
      : starts.agents.map((agent) => {
          const distances = distancesFrom(graph, starts.fugitive);
          return distances.get(agent) ?? 0;
        });

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    byMode,
    classMix,
    minDegree: degrees.length > 0 ? Math.min(...degrees) : 0,
    meanDegree: degrees.length > 0 ? degrees.reduce((sum, value) => sum + value, 0) / degrees.length : 0,
    maxDegree: degrees.length > 0 ? Math.max(...degrees) : 0,
    startDistances,
  };
}

