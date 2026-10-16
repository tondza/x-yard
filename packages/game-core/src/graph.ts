/**
 * Transit graph construction, validation, and traversal.
 *
 * GAME_VISION.md §3 defines the map as a node-and-edge graph with four transit
 * tiers. This module is pure and framework-agnostic: it is the traversal and
 * validation half of the "decoupled game engine" required by §6.
 *
 * Validation separates two kinds of judgement:
 *   - **errors** — the brief makes these requirements (endpoints exist, edges are
 *     symmetric, bus/metro serve the right node tiers, a map can actually host
 *     missions and extractions).
 *   - **warnings** — PROVISIONAL playability heuristics whose numbers came from
 *     recommendations, not from the brief. Warnings must not be silently
 *     promoted to errors; see the appendix.
 *
 * @module @x-yard/game-core/graph
 */

import type {
  Facility,
  GraphEdge,
  GraphNode,
  NodeClass,
  NodeId,
  TransitGraph,
  TransportMode,
} from './types';

/** Aggregate facts about a board, useful for design review and assertions. */
export interface GraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly byMode: Readonly<Record<TransportMode, number>>;
  readonly minDegree: number;
  readonly maxDegree: number;
  readonly meanDegree: number;
  readonly facilityCounts: Readonly<Record<Facility, number>>;
}

/** Result of validating a board. `ok` is true iff `errors` is empty. */
export interface GraphValidationReport {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly stats: GraphStats;
}

/**
 * Modes each node class may serve (§3). `special` is excluded deliberately:
 * Alleyway and Boat links are secret/specialised and may attach to any node.
 */
const CLASS_MODES: Readonly<Record<NodeClass, readonly TransportMode[]>> = {
  street: ['taxi'],
  hub: ['taxi', 'bus'],
  terminal: ['taxi', 'bus', 'underground'],
};

/** Bus and metro skip standard street nodes (§3: bus "skipping standard street nodes"). */
const MODES_AVOIDING_STREET: readonly TransportMode[] = ['bus', 'underground'];

/* PROVISIONAL playability heuristics (GAME_VISION.appendix.md Q7: map scale undefined). */
const PROVISIONAL_MIN_DEGREE = 2;
const PROVISIONAL_MAX_DEGREE = 9;
const PROVISIONAL_MEAN_DEGREE_RANGE: readonly [number, number] = [4.5, 6.5];
const PROVISIONAL_MIN_NODE_DISTANCE = 20;

/** Stable, order-independent key for one undirected route. */
export function routeKey(a: NodeId, b: NodeId, mode: TransportMode): string {
  return a < b ? `${a}|${b}|${mode}` : `${b}|${a}|${mode}`;
}

function buildAdjacency(graph: TransitGraph): Map<NodeId, Set<NodeId>> {
  const adjacency = new Map<NodeId, Set<NodeId>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    adjacency.get(edge.a)?.add(edge.b);
    adjacency.get(edge.b)?.add(edge.a);
  }
  return adjacency;
}

function buildIncidentModes(graph: TransitGraph): Map<NodeId, Set<TransportMode>> {
  const modes = new Map<NodeId, Set<TransportMode>>();
  for (const node of graph.nodes) modes.set(node.id, new Set());
  for (const edge of graph.edges) {
    modes.get(edge.a)?.add(edge.mode);
    modes.get(edge.b)?.add(edge.mode);
  }
  return modes;
}

/** Breadth-first reachability, optionally restricted to a set of modes. */
function reachableCount(
  graph: TransitGraph,
  start: NodeId,
  allowedModes?: readonly TransportMode[],
): number {
  const adjacency = new Map<NodeId, Set<NodeId>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    if (allowedModes !== undefined && !allowedModes.includes(edge.mode)) continue;
    adjacency.get(edge.a)?.add(edge.b);
    adjacency.get(edge.b)?.add(edge.a);
  }

  const seen = new Set<NodeId>([start]);
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const current = queue.shift() as NodeId;
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size;
}

/** Compute aggregate statistics without judging the board. */
export function graphStats(graph: TransitGraph): GraphStats {
  const byMode: Record<TransportMode, number> = { taxi: 0, bus: 0, underground: 0, special: 0 };
  for (const edge of graph.edges) byMode[edge.mode] += 1;

  const facilityCounts: Record<Facility, number> = { 'black-market': 0, 'safe-house': 0 };
  for (const node of graph.nodes) {
    for (const facility of node.facilities) facilityCounts[facility] += 1;
  }

  const adjacency = buildAdjacency(graph);
  const degrees = [...adjacency.values()].map((neighbours) => neighbours.size);

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    byMode,
    minDegree: degrees.length > 0 ? Math.min(...degrees) : 0,
    maxDegree: degrees.length > 0 ? Math.max(...degrees) : 0,
    meanDegree: degrees.length > 0 ? degrees.reduce((sum, d) => sum + d, 0) / degrees.length : 0,
    facilityCounts,
  };
}

/**
 * Validate a board.
 *
 * Pure: never mutates `graph` and never throws. {@link createGraph} turns a
 * failing report into an exception.
 */
export function validateGraph(graph: TransitGraph): GraphValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = graphStats(graph);

  /* Identity, endpoints, duplication, symmetry. ---------------------- */
  const nodeIds = new Set<NodeId>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
  }

  const seenEdges = new Set<string>();
  const seenEdgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (seenEdgeIds.has(edge.id)) errors.push(`duplicate edge id: ${edge.id}`);
    seenEdgeIds.add(edge.id);

    if (edge.a === edge.b) errors.push(`self-loop at node ${edge.a} (${edge.mode})`);
    if (!nodeIds.has(edge.a)) errors.push(`edge ${edge.id} references unknown node: ${edge.a}`);
    if (!nodeIds.has(edge.b)) errors.push(`edge ${edge.id} references unknown node: ${edge.b}`);

    const key = routeKey(edge.a, edge.b, edge.mode);
    if (seenEdges.has(key)) {
      errors.push(`duplicate route: ${edge.a} <-> ${edge.b} (${edge.mode})`);
    }
    seenEdges.add(key);

    if (edge.symmetric !== true) errors.push(`edge ${edge.id} is one-way; MVP edges are symmetric`);
    if (edge.ticketCost !== 1) {
      errors.push(`edge ${edge.id} has ticketCost ${edge.ticketCost}; expected 1`);
    }
  }

  /* Per-node rules: reachability, declared modes, class eligibility. -- */
  const adjacency = buildAdjacency(graph);
  const incidentModes = buildIncidentModes(graph);
  const classById = new Map(graph.nodes.map((node) => [node.id, node.class]));

  for (const node of graph.nodes) {
    const degree = adjacency.get(node.id)?.size ?? 0;
    const modes = incidentModes.get(node.id) ?? new Set<TransportMode>();

    if (degree === 0) errors.push(`node ${node.id} is isolated: it appears in no edge`);

    const declared = [...node.modes].sort().join(',');
    const actual = [...modes].sort().join(',');
    if (declared !== actual) {
      errors.push(`node ${node.id} declares modes [${declared}] but its edges serve [${actual}]`);
    }

    for (const mode of node.modes) {
      if (mode === 'special') continue; // secret links may attach anywhere (§3)
      if (!CLASS_MODES[node.class].includes(mode)) {
        errors.push(`node ${node.id} is class '${node.class}' but declares mode '${mode}'`);
      }
    }
  }

  /* Transit tiers serve the right node tiers (§3). -------------------- */
  for (const edge of graph.edges) {
    if (!MODES_AVOIDING_STREET.includes(edge.mode)) continue;
    for (const endpoint of [edge.a, edge.b]) {
      if (classById.get(endpoint) === 'street') {
        errors.push(`${edge.mode} edge ${edge.id} touches standard street node ${endpoint}`);
      }
    }
  }

  /* A Yard must be able to host missions and extractions (§4). -------- */
  if (stats.nodeCount > 0) {
    if (stats.facilityCounts['black-market'] === 0) {
      errors.push('no black-market node: Fugitives could not accept contraband runs (§4)');
    }
    if (stats.facilityCounts['safe-house'] === 0) {
      errors.push('no safe-house node: Fugitives could not extract (§4)');
    }
  }

  /* Full connectivity is required to play at all. --------------------- */
  const first = graph.nodes[0];
  if (first !== undefined) {
    if (reachableCount(graph, first.id) !== graph.nodes.length) {
      errors.push('full graph is not connected');
    }
  }

  /* PROVISIONAL heuristics — warnings, never errors. ------------------ */
  if (stats.nodeCount > 0) {
    if (stats.minDegree < PROVISIONAL_MIN_DEGREE) {
      warnings.push(`provisional: min degree ${stats.minDegree} is below ${PROVISIONAL_MIN_DEGREE}`);
    }
    if (stats.maxDegree > PROVISIONAL_MAX_DEGREE) {
      warnings.push(`provisional: max degree ${stats.maxDegree} exceeds ${PROVISIONAL_MAX_DEGREE}`);
    }
    const [low, high] = PROVISIONAL_MEAN_DEGREE_RANGE;
    if (stats.meanDegree < low || stats.meanDegree > high) {
      warnings.push(
        `provisional: mean degree ${stats.meanDegree.toFixed(2)} is outside [${low}, ${high}]`,
      );
    }
    if (first !== undefined && reachableCount(graph, first.id, ['taxi']) !== graph.nodes.length) {
      warnings.push('provisional: taxi-only subgraph does not reach every node');
    }

    for (let i = 0; i < graph.nodes.length; i += 1) {
      const node = graph.nodes[i] as GraphNode;
      for (let j = i + 1; j < graph.nodes.length; j += 1) {
        const other = graph.nodes[j] as GraphNode;
        const distance = Math.hypot(other.x - node.x, other.y - node.y);
        if (distance === 0) {
          warnings.push(`provisional: nodes ${node.id} and ${other.id} share coordinates`);
        } else if (distance < PROVISIONAL_MIN_NODE_DISTANCE) {
          warnings.push(
            `provisional: nodes ${node.id} and ${other.id} are ${distance.toFixed(1)} units apart`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats };
}

/**
 * Build a board, rejecting invalid input.
 *
 * @throws Error listing every validation error when the board is malformed
 */
export function createGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  meta: {
    readonly mapId?: string;
    readonly world?: { readonly width: number; readonly height: number };
  } = {},
): TransitGraph {
  const graph: TransitGraph = {
    mapId: meta.mapId ?? 'custom',
    world: meta.world ?? { width: 0, height: 0 },
    nodes,
    edges,
  };

  const report = validateGraph(graph);
  if (!report.ok) {
    throw new Error(`invalid transit graph:\n  - ${report.errors.join('\n  - ')}`);
  }
  return graph;
}

/** Look up a node by id. */
export function nodeById(graph: TransitGraph, id: NodeId): GraphNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

/** Every node that hosts a given facility (§4). */
export function nodesWithFacility(graph: TransitGraph, facility: Facility): readonly GraphNode[] {
  return graph.nodes.filter((node) => node.facilities.includes(facility));
}

/**
 * Every node reachable from `id` in one move.
 *
 * @param mode - restrict to a single transport mode; omit for all modes
 * @returns neighbour ids, deduplicated and sorted for determinism
 */
export function neighboursOf(
  graph: TransitGraph,
  id: NodeId,
  mode?: TransportMode,
): readonly NodeId[] {
  const found = new Set<NodeId>();
  for (const edge of graph.edges) {
    if (mode !== undefined && edge.mode !== mode) continue;
    if (edge.a === id) found.add(edge.b);
    else if (edge.b === id) found.add(edge.a);
  }
  return [...found].sort();
}

/** Transport modes usable directly from `id`. */
export function modesFrom(graph: TransitGraph, id: NodeId): readonly TransportMode[] {
  const found = new Set<TransportMode>();
  for (const edge of graph.edges) {
    if (edge.a === id || edge.b === id) found.add(edge.mode);
  }
  return [...found].sort();
}

/** Whether a single move from `a` to `b` exists, optionally on a given mode. */
export function hasRoute(
  graph: TransitGraph,
  a: NodeId,
  b: NodeId,
  mode?: TransportMode,
): boolean {
  return graph.edges.some((edge) => {
    if (mode !== undefined && edge.mode !== mode) return false;
    return (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a);
  });
}

/** Number of distinct nodes adjacent to `id`. */
export function degree(graph: TransitGraph, id: NodeId): number {
  return neighboursOf(graph, id).length;
}

/**
 * Every node within `radius` moves of `origin`, excluding `origin` itself.
 *
 * This is the search area for the Agent **Sensor Sweep** skill (§5, "scans a
 * 2-node radius"). Pure and deterministic: the result is sorted.
 */
export function nodesWithinRadius(
  graph: TransitGraph,
  origin: NodeId,
  radius: number,
): readonly NodeId[] {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError(`radius must be a non-negative integer, received ${String(radius)}`);
  }

  const adjacency = new Map<NodeId, Set<NodeId>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    adjacency.get(edge.a)?.add(edge.b);
    adjacency.get(edge.b)?.add(edge.a);
  }

  const found = new Set<NodeId>();
  let frontier: NodeId[] = [origin];
  for (let step = 0; step < radius; step += 1) {
    const next: NodeId[] = [];
    for (const current of frontier) {
      for (const neighbour of adjacency.get(current) ?? []) {
        if (neighbour === origin || found.has(neighbour)) continue;
        found.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }

  return [...found].sort();
}
