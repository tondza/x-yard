/**
 * A small hand-authored board used for scaffolding and rendering work.
 *
 * This is NOT a shipped Yard map. GAME_VISION.md gives no map scale or node
 * count (GAME_VISION.appendix.md Q7), so this fixture exists only so the server, the canvas,
 * and `validateGraph` can be wired end-to-end.
 *
 * It is deliberately built to satisfy every non-provisional validation rule:
 * connectivity, class/mode eligibility (bus and metro avoid standard street
 * nodes), a Black Market to accept contraband runs, and a Safe House to extract
 * from. It also carries one `special` Alleyway link so the fourth transit tier
 * is exercised rather than merely declared.
 *
 * @module @x-yard/game-core/demo-board
 */

import { createGraph } from './graph';
import type { GraphEdge, GraphNode, TransitGraph, TransportMode } from './types';

/**
 * Node classes follow §3's transport tiers: `street` serves taxis only, `hub`
 * adds buses, `terminal` adds metro.
 */
const NODES: readonly GraphNode[] = [
  { id: 's1', class: 'street', modes: ['taxi'], district: 'north', facilities: [], x: 80, y: 80 },
  { id: 's2', class: 'street', modes: ['taxi'], district: 'north', facilities: [], x: 280, y: 60 },
  { id: 's3', class: 'street', modes: ['taxi'], district: 'east', facilities: [], x: 480, y: 90 },
  {
    id: 's4',
    class: 'terminal',
    modes: ['taxi', 'bus', 'underground'],
    district: 'east',
    facilities: [],
    x: 560,
    y: 240,
  },
  { id: 's5', class: 'street', modes: ['taxi'], district: 'south', facilities: [], x: 420, y: 380 },
  {
    id: 's6',
    class: 'street',
    modes: ['taxi', 'special'],
    district: 'south',
    facilities: ['black-market'],
    x: 200,
    y: 400,
  },
  {
    id: 's7',
    class: 'hub',
    modes: ['taxi', 'bus'],
    district: 'west',
    facilities: ['safe-house'],
    x: 60,
    y: 250,
  },
  {
    id: 's8',
    class: 'terminal',
    modes: ['taxi', 'bus', 'underground', 'special'],
    district: 'centre',
    facilities: [],
    x: 300,
    y: 220,
  },
];

/** Build an edge with a deterministic `e_<mode>_<a>-<b>` id. */
function edge(mode: TransportMode, a: string, b: string): GraphEdge {
  const [from, to] = a < b ? [a, b] : [b, a];
  return {
    id: `e_${mode}_${from}-${to}`,
    a: from as string,
    b: to as string,
    mode,
    ticketCost: 1,
    symmetric: true,
  };
}

/**
 * 16 taxi edges (a ring plus chords), 3 bus edges among hub/terminals, 1 metro
 * chord between terminals, and 1 special Alleyway link. 21 edges; mean
 * distinct-neighbour degree 4.5.
 */
const EDGES: readonly GraphEdge[] = [
  // Taxi ring — the dense short-range mesh of §3.
  edge('taxi', 's1', 's2'),
  edge('taxi', 's2', 's3'),
  edge('taxi', 's3', 's4'),
  edge('taxi', 's4', 's5'),
  edge('taxi', 's5', 's6'),
  edge('taxi', 's6', 's7'),
  edge('taxi', 's7', 's8'),
  edge('taxi', 's8', 's1'),
  // Taxi chords.
  edge('taxi', 's1', 's3'),
  edge('taxi', 's2', 's4'),
  edge('taxi', 's3', 's5'),
  edge('taxi', 's4', 's6'),
  edge('taxi', 's5', 's7'),
  edge('taxi', 's6', 's8'),
  edge('taxi', 's7', 's1'),
  edge('taxi', 's8', 's2'),
  // Bus — regional stops, skipping standard street nodes (§3).
  edge('bus', 's4', 's7'),
  edge('bus', 's4', 's8'),
  edge('bus', 's7', 's8'),
  // Metro — long jump between major hubs (§3).
  edge('underground', 's4', 's8'),
  // Special / Alleyway — a secret link usable with special gear (§3).
  edge('special', 's6', 's8'),
];

/** The scaffold board, validated at module load. */
export const DEMO_BOARD: TransitGraph = createGraph(NODES, EDGES, {
  mapId: 'demo-fixture',
  world: { width: 640, height: 480 },
});
