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

/*
 * PROVISIONAL (demo only): the three local-link budgets offered by the
 * interactive demo. `standard` reproduces the prototype's existing graph; the
 * other two only scale the extra taxi links and their reach, not the spanning
 * tree, bus, metro or special tiers.
 */
const PROVISIONAL_ROUTE_DENSITY = {
  sparse: { edgesPerNode: 0.78, reach: 0.9 },
  standard: { edgesPerNode: 1, reach: 1 },
  dense: { edgesPerNode: 1.35, reach: 1.15 },
} as const;

/*
 * PROVISIONAL: at large-map scale the dead-end repair ranks eligible stations by
 * straight-line distance and only routes the shortlist. The exact street-order
 * nearest is not a rule, and routing every station here is what dominated a 6x
 * generation. Maps at the prototype scale keep the exact original search.
 */
const PROVISIONAL_LARGE_DEAD_END_CANDIDATES = 12;

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

  /*
   * Farthest-point sampling can be updated incrementally: after each pick, only
   * the distance to the newly chosen point can lower a candidate's nearest
   * distance. This is the same sequence of picks with the same tie-breaking,
   * but O(pool) per pick instead of O(pool * chosen). It matters at 6x scale,
   * where the old scan did hundreds of millions of distance calls.
   */
  if (count > 100) {
    const nearest = remaining.map((candidate) => distance(candidate, chosen[0] as Intersection));
    while (chosen.length < count && remaining.length > 0) {
      let bestIndex = 0;
      let bestScore = -1;
      for (let index = 0; index < remaining.length; index += 1) {
        const value = nearest[index] as number;
        if (value > bestScore) {
          bestScore = value;
          bestIndex = index;
        }
      }
      const [next] = remaining.splice(bestIndex, 1);
      nearest.splice(bestIndex, 1);
      if (next === undefined) break;
      chosen.push(next);
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index] as Intersection;
        const value = distance(candidate, next);
        if (value < (nearest[index] as number)) nearest[index] = value;
      }
    }
    return chosen;
  }

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

interface QueueEntry {
  readonly priority: number;
  readonly cost: number;
  readonly tieA: number;
  readonly tieB: number;
  readonly node: number;
}

/** Small binary min-heap. Ties are broken by the two stable integers. */
class MinHeap {
  private readonly items: QueueEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: QueueEntry): void {
    const items = this.items;
    items.push(entry);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const parentEntry = items[parent] as QueueEntry;
      if (!queueBefore(entry, parentEntry)) break;
      items[index] = parentEntry;
      index = parent;
    }
    items[index] = entry;
  }

  pop(): QueueEntry | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (top === undefined || last === undefined) return top;
    if (items.length === 0) return top;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      if (left >= items.length) break;
      const right = left + 1;
      let child = left;
      if (right < items.length && queueBefore(items[right] as QueueEntry, items[left] as QueueEntry)) {
        child = right;
      }
      const childEntry = items[child] as QueueEntry;
      if (!queueBefore(childEntry, last)) break;
      items[index] = childEntry;
      index = child;
    }
    items[index] = last;
    return top;
  }

  clear(): void {
    this.items.length = 0;
  }
}

function queueBefore(left: QueueEntry, right: QueueEntry): boolean {
  if (left.priority !== right.priority) return left.priority < right.priority;
  if (left.tieA !== right.tieA) return left.tieA < right.tieA;
  if (left.tieB !== right.tieB) return left.tieB < right.tieB;
  return left.node < right.node;
}

interface StreetStep {
  readonly to: number;
  readonly length: number;
  readonly edge: GridEdge;
}

interface StreetIndex {
  readonly intersections: readonly Intersection[];
  readonly indexById: ReadonlyMap<string, number>;
  readonly neighbours: readonly (readonly StreetStep[])[];
  readonly xs: Float64Array;
  readonly ys: Float64Array;
}

function indexStreets(build: CityBuild): StreetIndex {
  const indexById = new Map<string, number>();
  build.intersections.forEach((intersection, index) => indexById.set(intersection.id, index));
  const xs = new Float64Array(build.intersections.length);
  const ys = new Float64Array(build.intersections.length);
  const neighbours: StreetStep[][] = build.intersections.map((intersection, index) => {
    xs[index] = intersection.x;
    ys[index] = intersection.y;
    return (build.adjacency.get(intersection.id) ?? []).map((edge) => {
      const other = edge.a.id === intersection.id ? edge.b.id : edge.a.id;
      return {
        to: indexById.get(other) ?? -1,
        length: polylineLength(edge.street.path),
        edge,
      };
    });
  });
  return { intersections: build.intersections, indexById, neighbours, xs, ys };
}

/**
 * A* over the street lattice for maps above the prototype scale.
 *
 * The 96-station fixtures keep the original linear-scan Dijkstra so their
 * bytes do not move; this path exists because routing every station pair with
 * that scan is what made a 6x map take minutes. The heuristic is the straight
 * line, which is admissible and consistent because every street weight is a
 * polyline length between the same two points.
 */
class StreetRouter {
  private readonly index: StreetIndex;
  private readonly g: Float64Array;
  private readonly previous: Int32Array;
  private readonly previousEdge: (GridEdge | undefined)[];
  private readonly stamp: Int32Array;
  private readonly heap = new MinHeap();
  private run = 0;

  constructor(build: CityBuild) {
    this.index = indexStreets(build);
    const count = build.intersections.length;
    this.g = new Float64Array(count);
    this.previous = new Int32Array(count);
    this.previousEdge = new Array(count);
    this.stamp = new Int32Array(count);
  }

  private heuristic(from: number, to: number): number {
    const dx = (this.index.xs[from] as number) - (this.index.xs[to] as number);
    const dy = (this.index.ys[from] as number) - (this.index.ys[to] as number);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private pointsTo(
    start: number,
    goal: number,
    previous: Int32Array,
    previousEdge: readonly (GridEdge | undefined)[],
  ): MapPoint[] {
    const steps: { edge: GridEdge; from: number }[] = [];
    let cursor = goal;
    let guard = 0;
    while (cursor !== start && guard <= this.index.intersections.length) {
      guard += 1;
      const back = previous[cursor] ?? -1;
      const edge = previousEdge[cursor];
      if (back < 0 || edge === undefined) break;
      steps.push({ edge, from: back });
      cursor = back;
    }
    steps.reverse();
    const points: MapPoint[] = [];
    for (const step of steps) {
      const from = this.index.intersections[step.from];
      if (from !== undefined) appendPoints(points, edgePoints(step.edge, from));
    }
    return points;
  }

  route(from: Intersection, to: Intersection): Route {
    const start = this.index.indexById.get(from.id);
    const goal = this.index.indexById.get(to.id);
    if (start === undefined || goal === undefined) {
      return {
        distance: distance(from, to),
        points: [
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        ],
      };
    }
    if (start === goal) return { distance: 0, points: [{ x: from.x, y: from.y }] };

    /*
     * Reuse one search workspace with a generation stamp. A 6x map performs
     * thousands of these searches; allocating and filling three arrays per call
     * was measurable in both time and GC.
     */
    this.run += 1;
    const run = this.run;
    const g = this.g;
    const previous = this.previous;
    const previousEdge = this.previousEdge;
    const stamp = this.stamp;
    const heap = this.heap;
    heap.clear();
    g[start] = 0;
    stamp[start] = run;
    previous[start] = -1;
    previousEdge[start] = undefined;
    heap.push({
      priority: this.heuristic(start, goal),
      cost: 0,
      tieA: start,
      tieB: 0,
      node: start,
    });

    while (heap.size > 0) {
      const entry = heap.pop() as QueueEntry;
      if (entry.cost > (stamp[entry.node] === run ? (g[entry.node] as number) : Number.POSITIVE_INFINITY) + 1e-9) {
        continue;
      }
      if (entry.node === goal) break;
      for (const step of this.index.neighbours[entry.node] ?? []) {
        if (step.to < 0) continue;
        const candidate = entry.cost + step.length;
        if (stamp[step.to] !== run || candidate < (g[step.to] as number) - 1e-9) {
          g[step.to] = candidate;
          stamp[step.to] = run;
          previous[step.to] = entry.node;
          previousEdge[step.to] = step.edge;
          heap.push({
            priority: candidate + this.heuristic(step.to, goal),
            cost: candidate,
            tieA: step.to,
            tieB: 0,
            node: step.to,
          });
        }
      }
    }

    if (stamp[goal] !== run) {
      return {
        distance: distance(from, to),
        points: [
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        ],
      };
    }
    const points = this.pointsTo(start, goal, previous, previousEdge);
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

  /**
   * Prim's spanning tree over the stations, with one multi-source Dijkstra
   * instead of one shortest-path search per station pair.
   *
   * Each newly connected station becomes a source at distance zero. Its own
   * `previous` pointer is deliberately left intact: paths from an older source
   * may still pass through it, and keeping the old link means those routes stay
   * reconstructable.
   */
  spanningTree(
    stations: readonly Station[],
    onConnect: (from: number, to: number, route: Route) => void,
  ): void {
    if (stations.length === 0) return;
    const count = this.index.intersections.length;
    const dist = new Float64Array(count).fill(Number.POSITIVE_INFINITY);
    const source = new Int32Array(count).fill(-1);
    const previous = new Int32Array(count).fill(-1);
    const previousEdge: (GridEdge | undefined)[] = new Array(count);
    const connected = new Uint8Array(stations.length);
    const heap = new MinHeap();

    const firstIndex = this.index.indexById.get(stations[0]?.intersection.id ?? '');
    if (firstIndex === undefined) return;
    dist[firstIndex] = 0;
    source[firstIndex] = 0;
    connected[0] = 1;
    heap.push({ priority: 0, cost: 0, tieA: 0, tieB: firstIndex, node: firstIndex });
    let connectedCount = 1;

    while (connectedCount < stations.length) {
      while (heap.size > 0) {
        const entry = heap.pop() as QueueEntry;
        if (entry.cost > (dist[entry.node] as number) + 1e-9) continue;
        for (const step of this.index.neighbours[entry.node] ?? []) {
          if (step.to < 0) continue;
          const candidate = entry.cost + step.length;
          if (candidate < (dist[step.to] as number) - 1e-9) {
            dist[step.to] = candidate;
            source[step.to] = entry.tieA;
            previous[step.to] = entry.node;
            previousEdge[step.to] = step.edge;
            heap.push({
              priority: candidate,
              cost: candidate,
              tieA: entry.tieA,
              tieB: step.to,
              node: step.to,
            });
          }
        }
      }

      let bestStation = -1;
      let bestNode = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestSource = Number.POSITIVE_INFINITY;
      for (let index = 0; index < stations.length; index += 1) {
        if (connected[index] === 1) continue;
        const station = stations[index];
        if (station === undefined) continue;
        const node = this.index.indexById.get(station.intersection.id);
        if (node === undefined) continue;
        const candidateDistance = dist[node] as number;
        const candidateSource = source[node] ?? -1;
        if (candidateSource < 0 || candidateDistance === Number.POSITIVE_INFINITY) continue;
        if (
          candidateDistance < bestDistance - 1e-9 ||
          (Math.abs(candidateDistance - bestDistance) <= 1e-9 &&
            (candidateSource < bestSource ||
              (candidateSource === bestSource && index < bestStation)))
        ) {
          bestDistance = candidateDistance;
          bestSource = candidateSource;
          bestStation = index;
          bestNode = node;
        }
      }

      if (bestStation < 0 || bestNode < 0 || bestSource < 0) return;
      const sourceNode = this.index.indexById.get(stations[bestSource]?.intersection.id ?? '');
      const targetStation = stations[bestStation];
      let routePoints =
        sourceNode === undefined ? [] : this.pointsTo(sourceNode, bestNode, previous, previousEdge);
      if (routePoints.length < 2 && sourceNode !== undefined && targetStation !== undefined) {
        const fromIntersection = this.index.intersections[sourceNode];
        routePoints = [
          { x: fromIntersection?.x ?? 0, y: fromIntersection?.y ?? 0 },
          { x: targetStation.intersection.x, y: targetStation.intersection.y },
        ];
      }
      onConnect(bestSource, bestStation, {
        distance: polylineLength(routePoints),
        points: routePoints,
      });
      connected[bestStation] = 1;
      connectedCount += 1;
      // Keep `previous` for this node: older routes may pass through it. The
      // distance/source pair is what makes it a source.
      dist[bestNode] = 0;
      source[bestNode] = bestStation;
      heap.push({ priority: 0, cost: 0, tieA: bestStation, tieB: bestNode, node: bestNode });
    }
  }
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

  /*
   * Above the prototype scale, route with A* and build the taxi tree with one
   * multi-source Dijkstra. The 96-station fixtures keep the original path so
   * their bytes do not move; the old all-pairs scan is what made a 6x map take
   * minutes rather than seconds.
   */
  const router = build.params.targetNodes > 100 ? new StreetRouter(build) : null;
  const routeCache = new Map<string, Route>();
  const streetRoute = (a: Station, b: Station): Route => {
    // The cache key must be ordered: a route's polyline runs from a to b.
    const key = `${a.id}|${b.id}`;
    const cached = routeCache.get(key);
    if (cached !== undefined) return cached;
    const route =
      router === null
        ? shortestStreetRoute(build, a.intersection, b.intersection)
        : router.route(a.intersection, b.intersection);
    routeCache.set(key, route);
    return route;
  };

  /* Taxi: a spanning tree first, so every node is walkable, then local extras. */
  const degree = new Map<NodeId, number>(stations.map((station) => [station.id, 0]));
  const connectTaxiRoute = (a: Station, b: Station, route: Route): boolean => {
    if (!addEdge(a, b, 'taxi', route)) return false;
    degree.set(a.id, (degree.get(a.id) ?? 0) + 1);
    degree.set(b.id, (degree.get(b.id) ?? 0) + 1);
    return true;
  };
  const connectTaxi = (a: Station, b: Station): boolean =>
    connectTaxiRoute(a, b, streetRoute(a, b));
  let taxiEdgeCount = 0;

  if (router !== null) {
    router.spanningTree(stations, (from, to, route) => {
      const a = stations[from];
      const b = stations[to];
      if (a === undefined || b === undefined) return;
      if (connectTaxiRoute(a, b, route)) taxiEdgeCount += 1;
    });
  } else {
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
      if (connectTaxi(a, b)) taxiEdgeCount += 1;
      connected.add(best.to);
    }
  }
  const density = PROVISIONAL_ROUTE_DENSITY[build.params.routeDensity];
  const taxiTarget = Math.round(
    stations.length * PROVISIONAL_TAXI_EDGES_PER_NODE * density.edgesPerNode,
  );
  const maxTaxiReach =
    Math.max(build.spacingX, build.spacingY) * PROVISIONAL_TAXI_REACH_FACTOR * density.reach;

  const candidateEdges: { a: Station; b: Station; route: Route }[] = [];
  for (let i = 0; i < stations.length; i += 1) {
    for (let j = i + 1; j < stations.length; j += 1) {
      const a = stations[i];
      const b = stations[j];
      if (a === undefined || b === undefined) continue;
      if (seen.has(routeKey(a.id, b.id, 'taxi'))) continue;
      /*
       * A street route is never shorter than the straight line between its
       * endpoints, and the loop below rejects anything over `maxTaxiReach`.
       * Skipping those pairs before routing is therefore exact, and it is the
       * difference between ~5k and ~165k shortest-path searches at 6x scale.
       */
      if (distance(a.intersection, b.intersection) > maxTaxiReach) continue;
      candidateEdges.push({ a, b, route: streetRoute(a, b) });
    }
  }
  candidateEdges.sort((left, right) => left.route.distance - right.route.distance);

  for (const candidate of candidateEdges) {
    if (taxiEdgeCount >= taxiTarget) break;
    if (candidate.route.distance > maxTaxiReach) continue;
    if ((degree.get(candidate.a.id) ?? 0) >= PROVISIONAL_MAX_TAXI_EDGES_PER_STATION) continue;
    if ((degree.get(candidate.b.id) ?? 0) >= PROVISIONAL_MAX_TAXI_EDGES_PER_STATION) continue;
    if (connectTaxi(candidate.a, candidate.b)) taxiEdgeCount += 1;
  }

  /* No station may be a dead end: the validator warns, and a one-edge station
     is a bad experience even before it does. Skip pairs already joined by a
     taxi edge; otherwise the "nearest" candidate is the existing neighbour and
     the loop stops without adding anything. */
  for (const station of stations) {
    let guard = 0;
    while ((degree.get(station.id) ?? 0) < 2 && guard < stations.length) {
      guard += 1;
      const eligible = stations.filter(
        (other) =>
          other.id !== station.id &&
          (degree.get(other.id) ?? 0) < PROVISIONAL_MAX_STATION_DEGREE &&
          !seen.has(routeKey(station.id, other.id, 'taxi')),
      );
      const nearest =
        router === null
          ? eligible
              .map((other) => ({ other, route: streetRoute(station, other) }))
              .sort((left, right) => left.route.distance - right.route.distance)[0]
          : eligible
              .map((other) => ({
                other,
                straight: distance(station.intersection, other.intersection),
              }))
              .sort(
                (left, right) =>
                  left.straight - right.straight || left.other.id.localeCompare(right.other.id),
              )
              .slice(0, PROVISIONAL_LARGE_DEAD_END_CANDIDATES)
              .map((entry) => ({ other: entry.other, route: streetRoute(station, entry.other) }))
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
  /*
   * Metro: a connected network, not a set of disjoint chords. Two lines share
   * one interchange terminal; each line is a nearest-neighbour path through its
   * half of the terminals. Every terminal is on one of the two lines, so the
   * metro subgraph is a tree with T-1 edges and one obvious interchange.
   */
  const terminals = stations
    .filter((station) => station.class === 'terminal')
    .sort((a, b) => a.intersection.x - b.intersection.x || a.intersection.y - b.intersection.y);
  const centre = centroid(build);

  const interchange = terminals.reduce<Station | null>((best, candidate) => {
    if (best === null) return candidate;
    return distance(candidate.intersection, centre) < distance(best.intersection, centre)
      ? candidate
      : best;
  }, null);

  if (interchange !== null) {
    const angle = (station: Station): number =>
      Math.atan2(station.intersection.y - centre.y, station.intersection.x - centre.x);
    const others = terminals
      .filter((station) => station.id !== interchange.id)
      .sort((a, b) => angle(a) - angle(b) || a.id.localeCompare(b.id));
    const split = Math.ceil(others.length / 2);

    const connectMetroLine = (group: readonly Station[]): void => {
      const remaining = [...group];
      let current = interchange;

      while (remaining.length > 0) {
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < remaining.length; index += 1) {
          const candidate = remaining[index] as Station;
          const candidateDistance = distance(current.intersection, candidate.intersection);
          if (candidateDistance < bestDistance) {
            bestDistance = candidateDistance;
            bestIndex = index;
          }
        }

        const [next] = remaining.splice(bestIndex, 1);
        if (next === undefined) break;
        addEdge(current, next, 'underground', streetRoute(current, next), rng.jitter(0.14));
        current = next;
      }
    };

    connectMetroLine(others.slice(0, split));
    connectMetroLine(others.slice(split));
  }

  /*
   * Special: one alley/boat shortcut. Prefer the pair whose street route is
   * most disproportionate to the crow line, but always add the best candidate
   * so every generated map exercises the fourth tier.
   */
  const streetStations = stations.filter((station) => station.class === 'street');
  const minCrow = Math.min(build.spacingX, build.spacingY) * 0.5;
  let bestSpecial: { a: Station; b: Station; ratio: number } | null = null;
  if (router !== null) {
    /*
     * At 6x scale the exhaustive street-station pair scan is ~100k A* searches.
     * The shortcut is presentation: choose the best ratio among the pairs the
     * taxi candidate pass already routed (a local band, not the whole city).
     */
    for (const candidate of candidateEdges) {
      if (candidate.a.class !== 'street' || candidate.b.class !== 'street') continue;
      if (seen.has(routeKey(candidate.a.id, candidate.b.id, 'taxi'))) continue;
      const crow = distance(candidate.a.intersection, candidate.b.intersection);
      if (crow < minCrow) continue;
      const ratio = candidate.route.distance / crow;
      if (bestSpecial === null || ratio > bestSpecial.ratio) {
        bestSpecial = { a: candidate.a, b: candidate.b, ratio };
      }
    }
  } else {
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
  const starts = chooseStarts(
    graph,
    stations,
    build.params.startStrategy,
    build.params.agentCount,
  );
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

/*
 * PROVISIONAL (Q7): the outer bound for the `encircle` start. The rule only
 * says >= 3 edges; 3-5 is the band in which four Agents can actually close on a
 * 96-station map. It is not a gameplay rule and may be tuned after playtesting.
 */
const PROVISIONAL_ENCIRCLE_MAX_EDGES = 5;

interface StartCandidate {
  readonly id: NodeId;
  readonly distance: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Pick a Fugitive start and Agent starts.
 *
 * `encircle` is the realistic 1+4 chase: the Fugitive starts where at least
 * `agentCount` stations sit 3-5 edges away, and the Agents are picked evenly
 * around the Fugitive by angle rather than all from one side.
 *
 * `farthest` is the lab default: the four most distant stations, useful for
 * inspecting the whole map but not a playable chase.
 */
function chooseStarts(
  graph: TransitGraph,
  stations: readonly Station[],
  strategy: 'farthest' | 'encircle',
  agentCount: number,
): MapStarts | null {
  const radius = MIN_START_SEPARATION_EDGES;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  if (strategy === 'encircle') {
    let best: { station: Station; candidates: readonly StartCandidate[] } | null = null;

    for (const station of stations) {
      const distances = distancesFrom(graph, station.id);
      const candidates: StartCandidate[] = [];

      for (const [id, distance] of distances) {
        if (id === station.id) continue;
        if (distance < radius || distance > PROVISIONAL_ENCIRCLE_MAX_EDGES) continue;
        const node = nodeById.get(id);
        if (node === undefined) continue;
        candidates.push({ id, distance, x: node.x, y: node.y });
      }

      if (candidates.length < agentCount) continue;
      if (best === null || candidates.length > best.candidates.length) {
        best = { station, candidates };
      }
    }

    if (best !== null) {
      const origin = best.station.intersection;
      const sorted = [...best.candidates].sort((a, b) => {
        const angleA = Math.atan2(a.y - origin.y, a.x - origin.x);
        const angleB = Math.atan2(b.y - origin.y, b.x - origin.x);
        return angleA - angleB || a.id.localeCompare(b.id);
      });

      const picked: NodeId[] = [];
      for (let index = 0; index < agentCount; index += 1) {
        const candidate = sorted[Math.floor((index * sorted.length) / agentCount)];
        if (candidate !== undefined && !picked.includes(candidate.id)) picked.push(candidate.id);
      }

      if (picked.length === agentCount) {
        return { fugitive: best.station.id, agents: picked };
      }
    }
    // Fall through to the farthest strategy rather than ship an invalid start.
  }

  let farthest: { station: Station; far: readonly StartCandidate[] } | null = null;

  for (const station of stations) {
    const distances = distancesFrom(graph, station.id);
    const far: StartCandidate[] = [];

    for (const [id, distance] of distances) {
      if (id === station.id || distance < radius) continue;
      const node = nodeById.get(id);
      if (node === undefined) continue;
      far.push({ id, distance, x: node.x, y: node.y });
    }

    far.sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id));
    if (far.length < agentCount) continue;
    if (farthest === null || far.length > farthest.far.length) farthest = { station, far };
  }

  if (farthest === null) return null;
  return {
    fugitive: farthest.station.id,
    agents: farthest.far.slice(0, agentCount).map((entry) => entry.id),
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

