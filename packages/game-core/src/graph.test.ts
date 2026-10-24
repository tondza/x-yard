import { describe, expect, it } from 'vitest';

import { DEMO_BOARD } from './demo-board';
import {
  createGraph,
  degree,
  edgePath,
  graphStats,
  hasRoute,
  modesFrom,
  neighboursOf,
  nodeById,
  nodesWithFacility,
  nodesWithinRadius,
  routeKey,
  validateGraph,
  validateStreetGeometry,
} from './graph';
import type {
  GraphEdge,
  GraphNode,
  MapPoint,
  StreetSegment,
  TransitGraph,
  TransportMode,
} from './types';

/** A mutable copy of the fixture, so each test can break exactly one rule. */
function clone(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: DEMO_BOARD.nodes.map((node) => ({ ...node })),
    edges: DEMO_BOARD.edges.map((edge) => ({ ...edge })),
  };
}

function boardWith(
  mutate: (draft: { nodes: GraphNode[]; edges: GraphEdge[] }) => void,
): TransitGraph {
  const draft = clone();
  mutate(draft);
  return { ...DEMO_BOARD, nodes: draft.nodes, edges: draft.edges };
}

/** Build an edge that violates a typed invariant, for negative tests. */
function badEdge(overrides: Partial<Record<keyof GraphEdge, unknown>>): GraphEdge {
  return {
    id: 'e_bad_0',
    a: 's1',
    b: 's2',
    mode: 'taxi',
    ticketCost: 1,
    symmetric: true,
    ...overrides,
  } as unknown as GraphEdge;
}

const errorsOf = (graph: TransitGraph): string => validateGraph(graph).errors.join('\n');
const warningsOf = (graph: TransitGraph): string => validateGraph(graph).warnings.join('\n');

describe('validateGraph on the scaffold fixture', () => {
  it('accepts it with no errors and no provisional warnings', () => {
    const report = validateGraph(DEMO_BOARD);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

describe('identity, endpoints, duplication, symmetry', () => {
  it('rejects a self-loop', () => {
    expect(errorsOf(boardWith((d) => d.edges.push(badEdge({ a: 's1', b: 's1' }))))).toContain(
      'self-loop',
    );
  });

  it('rejects a duplicated route in either direction', () => {
    const graph = boardWith((d) =>
      d.edges.push(badEdge({ id: 'e_dup', a: 's2', b: 's1', mode: 'taxi' })),
    );
    expect(errorsOf(graph)).toContain('duplicate route');
  });

  it('accepts a parallel edge on a different mode', () => {
    // s4-s7 already has a bus edge; a taxi edge on the same pair is legal.
    const graph = boardWith((d) =>
      d.edges.push(badEdge({ id: 'e_extra', a: 's4', b: 's7', mode: 'taxi' })),
    );
    expect(validateGraph(graph).errors.filter((e) => e.includes('duplicate route'))).toEqual([]);
  });

  it('rejects a duplicate edge id', () => {
    const graph = boardWith((d) => {
      const first = d.edges[0] as GraphEdge;
      d.edges.push({ ...first, a: 's5', b: 's6' });
    });
    expect(errorsOf(graph)).toContain('duplicate edge id');
  });

  it('rejects an edge referencing an unknown node', () => {
    const graph = boardWith((d) =>
      d.edges.push(badEdge({ id: 'e_ghost', a: 's1', b: 'nowhere' })),
    );
    expect(errorsOf(graph)).toContain('unknown node');
  });

  it('rejects a one-way edge', () => {
    const graph = boardWith((d) =>
      d.edges.push(badEdge({ id: 'e_oneway', symmetric: false })),
    );
    expect(errorsOf(graph)).toContain('one-way');
  });

  it('rejects a ticketCost other than 1', () => {
    const graph = boardWith((d) => d.edges.push(badEdge({ id: 'e_pricey', ticketCost: 2 })));
    expect(errorsOf(graph)).toContain('ticketCost');
  });
});

describe('node rules', () => {
  it('rejects an isolated node', () => {
    const graph = boardWith((d) =>
      d.nodes.push({
        id: 's9',
        class: 'street',
        modes: ['taxi'],
        district: 'north',
        facilities: [],
        x: 620,
        y: 460,
      }),
    );
    expect(errorsOf(graph)).toContain('isolated');
  });

  it('rejects a node whose declared modes disagree with its edges', () => {
    const graph = boardWith((d) => {
      const i = d.nodes.findIndex((n) => n.id === 's1');
      const node = d.nodes[i] as GraphNode;
      d.nodes[i] = { ...node, modes: [...node.modes, 'bus'] };
    });
    expect(errorsOf(graph)).toContain('declares modes');
  });

  it('rejects a street node declaring bus', () => {
    const graph = boardWith((d) => {
      const i = d.nodes.findIndex((n) => n.id === 's1');
      const node = d.nodes[i] as GraphNode;
      d.nodes[i] = { ...node, modes: ['taxi', 'bus'] };
    });
    expect(errorsOf(graph)).toContain("class 'street'");
  });

  it('allows a special Alleyway link to attach to a street node', () => {
    // §3 calls special transport "secret or specialized", so the street-node
    // restriction that governs bus and metro must not apply to it.
    const graph = boardWith((d) => {
      const i = d.nodes.findIndex((n) => n.id === 's1');
      const j = d.nodes.findIndex((n) => n.id === 's3');
      d.nodes[i] = { ...(d.nodes[i] as GraphNode), modes: ['taxi', 'special'] };
      d.nodes[j] = { ...(d.nodes[j] as GraphNode), modes: ['taxi', 'special'] };
      d.edges.push(badEdge({ id: 'e_alley', a: 's1', b: 's3', mode: 'special' }));
    });
    expect(validateGraph(graph).errors).toEqual([]);
  });
});

describe('transit tiers serve the right node tiers (§3)', () => {
  it('rejects a bus edge touching a standard street node', () => {
    const graph = boardWith((d) =>
      d.edges.push(badEdge({ id: 'e_bus_street', a: 's1', b: 's3', mode: 'bus' })),
    );
    expect(errorsOf(graph)).toContain('touches standard street node');
  });

  it('rejects a metro edge touching a standard street node', () => {
    const graph = boardWith((d) =>
      d.edges.push(badEdge({ id: 'e_ug_street', a: 's1', b: 's3', mode: 'underground' })),
    );
    expect(errorsOf(graph)).toContain('touches standard street node');
  });
});

describe('a Yard must be able to host missions and extractions (§4)', () => {
  it('rejects a map with no Safe House', () => {
    const graph = boardWith((d) => {
      d.nodes = d.nodes.map((node) => ({ ...node, facilities: [] }));
    });
    expect(errorsOf(graph)).toContain('no safe-house node');
  });

  it('rejects a map with no Black Market', () => {
    const graph = boardWith((d) => {
      d.nodes = d.nodes.map((node) => ({ ...node, facilities: [] }));
    });
    expect(errorsOf(graph)).toContain('no black-market node');
  });
});

describe('connectivity', () => {
  it('rejects a disconnected graph', () => {
    const graph = boardWith((d) => {
      d.edges = d.edges.filter((edge) => edge.a !== 's8' && edge.b !== 's8');
    });
    expect(errorsOf(graph)).toContain('full graph is not connected');
  });
});

describe('provisional heuristics are warnings, never errors', () => {
  it('warns rather than fails when the mean degree is low', () => {
    const ring = new Set([
      'e_taxi_s1-s2',
      'e_taxi_s2-s3',
      'e_taxi_s3-s4',
      'e_taxi_s4-s5',
      'e_taxi_s5-s6',
      'e_taxi_s6-s7',
      'e_taxi_s7-s8',
      'e_taxi_s8-s1',
    ]);
    const graph = boardWith((d) => {
      d.edges = d.edges.filter((edge) => ring.has(edge.id));
    });
    expect(warningsOf(graph)).toContain('provisional: mean degree');
    expect(errorsOf(graph)).not.toContain('mean degree');
  });

  it('labels every provisional finding as provisional', () => {
    const graph = boardWith((d) => {
      d.edges = d.edges.filter((edge) => edge.mode === 'taxi');
      const i = d.nodes.findIndex((n) => n.id === 's8');
      const node = d.nodes[i] as GraphNode;
      d.nodes[i] = { ...node, modes: ['taxi'] };
    });
    const provisional = validateGraph(graph).warnings;
    expect(provisional.length).toBeGreaterThan(0);
    expect(provisional.every((warning) => warning.startsWith('provisional:'))).toBe(true);
  });
});

describe('createGraph', () => {
  it('returns the graph when valid', () => {
    const { nodes, edges } = clone();
    expect(createGraph(nodes, edges).nodes).toHaveLength(nodes.length);
  });

  it('throws with every validation error listed', () => {
    expect(() =>
      createGraph(DEMO_BOARD.nodes, [
        ...DEMO_BOARD.edges,
        badEdge({ id: 'e_self', a: 's1', b: 's1' }),
      ]),
    ).toThrow(/invalid transit graph/);
  });
});

describe('graphStats', () => {
  it('reports the fixture totals exactly', () => {
    const stats = graphStats(DEMO_BOARD);
    expect(stats.nodeCount).toBe(8);
    expect(stats.edgeCount).toBe(21);
    expect(stats.byMode).toEqual({ taxi: 16, bus: 3, underground: 1, special: 1 });
    expect(stats.facilityCounts).toEqual({ 'black-market': 1, 'safe-house': 1 });
    expect(stats.minDegree).toBe(4);
    expect(stats.maxDegree).toBe(6);
    expect(stats.meanDegree).toBeCloseTo(4.5, 10);
  });
});

describe('traversal', () => {
  it('is order-independent in routeKey', () => {
    expect(routeKey('s1', 's2', 'taxi')).toBe(routeKey('s2', 's1', 'taxi'));
    expect(routeKey('s1', 's2', 'taxi')).not.toBe(routeKey('s1', 's2', 'bus'));
  });

  it('lists neighbours sorted and deduplicated across modes', () => {
    expect(neighboursOf(DEMO_BOARD, 's1')).toEqual(['s2', 's3', 's7', 's8']);
  });

  it('filters neighbours by mode', () => {
    expect(neighboursOf(DEMO_BOARD, 's8', 'taxi')).toEqual(['s1', 's2', 's6', 's7']);
    expect(neighboursOf(DEMO_BOARD, 's1', 'bus')).toEqual([]);
  });

  it('lists the modes available at a node', () => {
    expect(modesFrom(DEMO_BOARD, 's4')).toEqual(['bus', 'taxi', 'underground']);
    expect(modesFrom(DEMO_BOARD, 's8')).toEqual(['bus', 'special', 'taxi', 'underground']);
  });

  it('treats routes as undirected', () => {
    expect(hasRoute(DEMO_BOARD, 's4', 's8', 'underground')).toBe(true);
    expect(hasRoute(DEMO_BOARD, 's8', 's4', 'underground')).toBe(true);
    expect(hasRoute(DEMO_BOARD, 's1', 's4')).toBe(false);
  });

  it('counts distinct adjacent nodes, not parallel edges', () => {
    expect(degree(DEMO_BOARD, 's1')).toBe(4);
    expect(degree(DEMO_BOARD, 's8')).toBe(5);
  });

  it('finds nodes by id and by facility', () => {
    expect(nodeById(DEMO_BOARD, 's8')?.class).toBe('terminal');
    expect(nodeById(DEMO_BOARD, 'nope')).toBeUndefined();
    expect(nodesWithFacility(DEMO_BOARD, 'safe-house').map((n) => n.id)).toEqual(['s7']);
    expect(nodesWithFacility(DEMO_BOARD, 'black-market').map((n) => n.id)).toEqual(['s6']);
  });
});

/**
 * `nodesWithinRadius` is the search area for the Agent Sensor Sweep skill
 * (§5: "Scans a 2-node radius to confirm whether a Fugitive is present").
 */
describe('nodesWithinRadius', () => {
  it('excludes the origin at every radius', () => {
    expect(nodesWithinRadius(DEMO_BOARD, 's1', 0)).toEqual([]);
    expect(nodesWithinRadius(DEMO_BOARD, 's1', 1)).not.toContain('s1');
    expect(nodesWithinRadius(DEMO_BOARD, 's1', 2)).not.toContain('s1');
  });

  it('returns immediate neighbours at radius 1', () => {
    expect(nodesWithinRadius(DEMO_BOARD, 's1', 1)).toEqual(['s2', 's3', 's7', 's8']);
  });

  it('expands to the full two-hop search area at radius 2', () => {
    // s1 is connected enough that a 2-node sweep covers the whole fixture.
    expect(nodesWithinRadius(DEMO_BOARD, 's1', 2)).toEqual([
      's2',
      's3',
      's4',
      's5',
      's6',
      's7',
      's8',
    ]);
  });

  it('rejects a negative or fractional radius', () => {
    expect(() => nodesWithinRadius(DEMO_BOARD, 's1', -1)).toThrow(RangeError);
    expect(() => nodesWithinRadius(DEMO_BOARD, 's1', 1.5)).toThrow(RangeError);
  });
});

/* ------------------------------------------------------------------ *
 * Edge geometry (R5)
 * ------------------------------------------------------------------ */

/** Two nodes 100 units apart on a straight street. */
function geometryBoard(
  mode: TransportMode,
  path?: readonly MapPoint[],
): TransitGraph {
  const nodeModes: readonly TransportMode[] =
    mode === 'underground'
      ? ['underground']
      : mode === 'special'
        ? ['special']
        : mode === 'bus'
          ? ['bus']
          : ['taxi'];

  const nodes: readonly GraphNode[] = [
    {
      id: 'a',
      class: 'hub',
      modes: nodeModes,
      district: 'test',
      facilities: [],
      x: 0,
      y: 0,
    },
    {
      id: 'b',
      class: 'hub',
      modes: nodeModes,
      district: 'test',
      facilities: [],
      x: 100,
      y: 0,
    },
  ];

  const edge: GraphEdge = {
    id: `e_${mode}`,
    a: 'a',
    b: 'b',
    mode,
    ticketCost: 1,
    symmetric: true,
    ...(path === undefined ? {} : { path }),
  };

  return { mapId: 'test', world: { width: 100, height: 100 }, nodes, edges: [edge] };
}

const STRAIGHT_STREET: readonly StreetSegment[] = [
  {
    id: 's1',
    path: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  },
];

describe('edgePath', () => {
  it('returns the authored path when one exists', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 50, y: 10 },
      { x: 100, y: 0 },
    ];
    const graph = geometryBoard('taxi', path);
    expect(edgePath(graph, 'e_taxi')).toEqual(path);
  });

  it('falls back to a straight chord for a hand-made edge without geometry', () => {
    const edge = DEMO_BOARD.edges[0];
    if (edge === undefined) throw new Error('the fixture must have an edge');
    const from = nodeById(DEMO_BOARD, edge.a);
    const to = nodeById(DEMO_BOARD, edge.b);
    if (from === undefined || to === undefined) throw new Error('edge endpoints must exist');

    expect(edgePath(DEMO_BOARD, edge.id)).toEqual([
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ]);
  });

  it('returns null for an unknown edge id', () => {
    expect(edgePath(DEMO_BOARD, 'e_missing')).toBeNull();
  });
});

describe('validateStreetGeometry (R5)', () => {
  it('accepts a taxi path that stays on the street network', () => {
    const graph = geometryBoard('taxi', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const report = validateStreetGeometry(graph, STRAIGHT_STREET);
    expect(report.errors).toEqual([]);
    expect(report.checkedEdges).toBe(1);
    expect(report.ok).toBe(true);
  });

  it('rejects a taxi path that cuts across a block', () => {
    const graph = geometryBoard('taxi', [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ]);
    const report = validateStreetGeometry(graph, STRAIGHT_STREET);
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toMatch(/leaves the street network/);
  });

  it('rejects a taxi edge with no authored path', () => {
    const report = validateStreetGeometry(geometryBoard('taxi'), STRAIGHT_STREET);
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toMatch(/has no street-following path/);
  });

  it('rejects a path that does not start at its node', () => {
    const graph = geometryBoard('taxi', [
      { x: 10, y: 0 },
      { x: 100, y: 0 },
    ]);
    const report = validateStreetGeometry(graph, STRAIGHT_STREET);
    expect(report.errors.join('\n')).toMatch(/does not start at node a/);
  });

  it('exempts underground and special edges, which may cut across blocks', () => {
    for (const mode of ['underground', 'special'] as const) {
      const graph = geometryBoard(mode, [
        { x: 0, y: 0 },
        { x: 50, y: 40 },
        { x: 100, y: 0 },
      ]);
      const report = validateStreetGeometry(graph, STRAIGHT_STREET);
      expect(report.errors).toEqual([]);
      expect(report.checkedEdges).toBe(0);
    }
  });

  it('checks bus paths as street-following edges', () => {
    const graph = geometryBoard('bus', [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ]);
    const report = validateStreetGeometry(graph, STRAIGHT_STREET);
    expect(report.checkedEdges).toBe(1);
    expect(report.ok).toBe(false);
  });
});
