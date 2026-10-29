/**
 * Movement playback for the prototype.
 *
 * The engine resolves a turn atomically. This module turns the *returned* moves
 * into short animated steps, so the view can reveal them one mover at a time
 * without re-simulating a bot or guessing which edge was charged.
 *
 * Everything here is presentation: durations and colours are UI constants, not
 * game rules.
 *
 * @module apps/web/prototype/motion
 */

import type { GeneratedMap, GraphEdge, MapPoint, NodeId } from '@x-yard/map-generator';
import type {
  MobilityOption,
  PlayerId,
  PrototypeAgentMove,
  PrototypeMoveOption,
  PrototypeState,
} from '@x-yard/game-core';

export const MOVE_STYLE: Readonly<
  Record<MobilityOption, { readonly colour: string; readonly label: string; readonly dash?: string }>
> = {
  taxi: { colour: '#d99a1f', label: 'Taxi' },
  bus: { colour: '#3b8a5a', label: 'Bus', dash: '9 5' },
  underground: { colour: '#b8403b', label: 'Metro' },
  special: { colour: '#6d4bb5', label: 'Special', dash: '3 5' },
  foot: { colour: '#33475c', label: 'Foot', dash: '1.5 5' },
  scooter: { colour: '#8a5cf0', label: 'Scooter', dash: '7 4' },
};

/** Per-mover durations. A single move never runs longer than 1 second. */
export const FUGITIVE_STEP_MS = 850;
export const AGENT_STEP_MS = 700;
export const SCOOTER_STEP_MS = 950;
/** The camera leads the token: it pans to the mover, then the token sets off. */
export const STEP_LEAD_MS = 170;
/** A beat between movers so the eye registers that one move ended. */
export const STEP_GAP_MS = 150;
/** A held turn still needs a visible beat, but shorter than a move. */
export const HOLD_PAUSE_MS = 420;
/** A pulse or scooter reveal stays on screen before the Agent phase starts. */
export const REVEAL_HOLD_MS = 1150;

export type MoverRole = 'fugitive' | 'agent';

export interface MoveStep {
  readonly key: string;
  readonly seatId: PlayerId;
  readonly label: string;
  readonly short: string;
  readonly role: MoverRole;
  readonly from: NodeId;
  readonly to: NodeId;
  readonly mode: MobilityOption;
  readonly points: readonly MapPoint[];
  readonly duration: number;
}

export interface Trail {
  readonly key: string;
  readonly seatId: PlayerId;
  readonly short: string;
  readonly colour: string;
  readonly points: readonly MapPoint[];
  readonly from: NodeId;
  readonly to: NodeId;
}

/** What the map banner says while a turn is being revealed. */
export type PhaseBanner =
  | { readonly kind: 'fugitive'; readonly step: MoveStep }
  | { readonly kind: 'hold' }
  | { readonly kind: 'reveal'; readonly node: NodeId; readonly scooter: boolean }
  | {
      readonly kind: 'agents';
      readonly step: MoveStep;
      readonly index: number;
      readonly total: number;
    };

function incidentPath(
  graph: GeneratedMap['graph'],
  from: NodeId,
  to: NodeId,
  mode: GraphEdge['mode'],
): GraphEdge | undefined {
  return graph.edges.find(
    (edge) =>
      edge.mode === mode &&
      ((edge.a === from && edge.b === to) || (edge.a === to && edge.b === from)),
  );
}

function anyPath(
  graph: GeneratedMap['graph'],
  from: NodeId,
  to: NodeId,
): GraphEdge | undefined {
  return graph.edges.find(
    (edge) =>
      (edge.a === from && edge.b === to) || (edge.a === to && edge.b === from),
  );
}

function orientedPath(edge: GraphEdge, from: NodeId): readonly MapPoint[] {
  const path = edge.path ?? [];
  return edge.a === from ? path : [...path].reverse();
}

function nodePoint(graph: GeneratedMap['graph'], id: NodeId): MapPoint | null {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  return node === undefined ? null : { x: node.x, y: node.y };
}

function combine(first: readonly MapPoint[], second: readonly MapPoint[]): readonly MapPoint[] {
  return second.length === 0 ? first : [...first, ...second.slice(1)];
}

/**
 * The actual street/transit polyline for a move. Foot and scooter run on the
 * taxi network; a scooter's second hop is part of the same visible route.
 */
export function routePoints(
  graph: GeneratedMap['graph'],
  from: NodeId,
  to: NodeId,
  mode: MobilityOption,
  via: NodeId | null = null,
): readonly MapPoint[] {
  if (from === to) {
    const single = nodePoint(graph, from);
    return single === null ? [] : [single];
  }

  if (mode === 'scooter' && via !== null) {
    const first = incidentPath(graph, from, via, 'taxi');
    const second = incidentPath(graph, via, to, 'taxi');
    if (first !== undefined && second !== undefined) {
      return combine(orientedPath(first, from), orientedPath(second, via));
    }
  }

  const edgeMode: GraphEdge['mode'] = mode === 'foot' || mode === 'scooter' ? 'taxi' : mode;
  const edge = incidentPath(graph, from, to, edgeMode);
  if (edge !== undefined && edge.path !== undefined && edge.path.length > 1) {
    return orientedPath(edge, from);
  }

  // A fixture may omit geometry; a fallback chord is still better than a token
  // that stays behind. The generator writes paths for every taxi/bus edge.
  const fallback = anyPath(graph, from, to);
  if (fallback !== undefined && fallback.path !== undefined && fallback.path.length > 1) {
    return orientedPath(fallback, from);
  }

  const fromPoint = nodePoint(graph, from);
  const toPoint = nodePoint(graph, to);
  if (fromPoint === null || toPoint === null) return fromPoint === null ? [] : [fromPoint];
  return [fromPoint, toPoint];
}

export function polylineLength(points: readonly MapPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as MapPoint;
    const current = points[index] as MapPoint;
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return total;
}

/** A point at `progress` (0..1) by distance, so speed is constant on every leg. */
export function pointAtProgress(points: readonly MapPoint[], progress: number): MapPoint {
  const first = points[0];
  if (first === undefined) return { x: 0, y: 0 };
  if (points.length === 1) return first;

  const total = polylineLength(points);
  if (total === 0) return first;

  const target = Math.min(1, Math.max(0, progress)) * total;
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as MapPoint;
    const current = points[index] as MapPoint;
    const length = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (travelled + length >= target) {
      const t = length === 0 ? 0 : (target - travelled) / length;
      return {
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
      };
    }
    travelled += length;
  }

  return points[points.length - 1] as MapPoint;
}

/** The human's move, or null for a hold (the view shows a separate hold beat). */
export function buildFugitiveStep(
  graph: GeneratedMap['graph'],
  before: PrototypeState,
  after: PrototypeState,
  move: PrototypeMoveOption | null,
): MoveStep | null {
  const fugitiveBefore = before.seats.find((seat) => seat.role === 'fugitive');
  const from = fugitiveBefore?.node;
  const to = after.seats.find((seat) => seat.role === 'fugitive')?.node;
  if (move === null || fugitiveBefore === undefined || from === undefined || to === undefined || from === to) {
    return null;
  }

  return {
    key: `fugitive-${before.turn}-${from}-${to}-${move.mode}`,
    seatId: fugitiveBefore.id,
    label: fugitiveBefore.name,
    short: 'F',
    role: 'fugitive',
    from,
    to,
    mode: move.mode,
    points: routePoints(graph, from, to, move.mode, move.via),
    duration: move.mode === 'scooter' ? SCOOTER_STEP_MS : FUGITIVE_STEP_MS,
  };
}

/** One step per Agent move, in the order the engine resolved them. */
export function buildAgentSteps(
  graph: GeneratedMap['graph'],
  state: PrototypeState,
  moves: readonly PrototypeAgentMove[],
): readonly MoveStep[] {
  const agents = state.seats.filter((seat) => seat.role === 'agent');

  return moves.flatMap((move) => {
    if (move.from === move.to) return [];
    const index = agents.findIndex((seat) => seat.id === move.seatId);
    const seat = index >= 0 ? agents[index] : undefined;

    return [
      {
        key: `agent-${state.turn}-${move.seatId}-${move.from}-${move.to}-${move.mode}`,
        seatId: move.seatId,
        label: seat?.name ?? move.seatId,
        short: `A${index >= 0 ? index + 1 : '?'}`,
        role: 'agent' as const,
        from: move.from,
        to: move.to,
        mode: move.mode,
        points: routePoints(graph, move.from, move.to, move.mode),
        duration: AGENT_STEP_MS,
      },
    ];
  });
}


export function stepTrail(step: MoveStep): Trail {
  return {
    key: step.key,
    seatId: step.seatId,
    short: step.short,
    colour: step.role === 'fugitive' ? '#a93c36' : '#2f6fed',
    points: step.points,
    from: step.from,
    to: step.to,
  };
}
