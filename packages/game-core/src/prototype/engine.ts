/**
 * Local 1-Fugitive / N-Agent prototype loop.
 *
 * The turn shape is the plan's E6 order: the Fugitive moves, a scheduled
 * appearance updates the Agents' `lastKnown`, then the Agent phase resolves. Capture is end-position equality only; a clean swap is not a catch.
 *
 * Everything here is pure and deterministic. The bots use BFS over affordable
 * edges, not `Math.random`; a seed is stored only so the UI can reproduce the
 * same Yard.
 *
 * @module @x-yard/game-core/prototype/engine
 */

import { neighboursOf } from '../graph';
import { spend } from '../tickets';
import {
  APPEARANCE_TURNS,
  TRANSPORT_MODES,
  YARD_TURN_LIMIT,
  type NodeId,
  type PlayerId,
  type TransitGraph,
} from '../types';
import type {
  PrototypeAgentMove,
  PrototypeAgentOrders,
  PrototypeCommand,
  PrototypeCommandResult,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypeSeat,
  PrototypeState,
} from './types';

/*
 * PROVISIONAL (Q1): the MVP rules table gives these starting budgets, but the
 * director has not ratified them into GAME_VISION.md. The prototype uses the
 * same numbers so a playtest is not measuring a different economy.
 */
const PROVISIONAL_FUGITIVE_FOOT_STEPS = 8;
const PROVISIONAL_AGENT_FOOT_STEPS = 6;

const PROVISIONAL_FUGITIVE_TICKETS = {
  taxi: 8,
  bus: 4,
  underground: 3,
  special: 2,
};
const PROVISIONAL_AGENT_TICKETS = {
  taxi: 10,
  bus: 5,
  underground: 3,
  special: 0,
};

const AGENT_NAMES = ['Falcon', 'Harrier', 'Osprey', 'Merlin', 'Kestrel', 'Shrike'] as const;

const MODE_ORDER = [...TRANSPORT_MODES, 'foot'] as const;

function modeRank(mode: PrototypeMoveOption['mode']): number {
  return MODE_ORDER.indexOf(mode);
}

function fugitiveOf(state: PrototypeState): PrototypeSeat {
  const fugitive = state.seats.find((seat) => seat.role === 'fugitive');
  if (fugitive === undefined) throw new Error('prototype state has no Fugitive seat');
  return fugitive;
}

function agentsOf(state: PrototypeState): readonly PrototypeSeat[] {
  return state.seats.filter((seat) => seat.role === 'agent');
}

function seatById(state: PrototypeState, id: PlayerId): PrototypeSeat | undefined {
  return state.seats.find((seat) => seat.id === id);
}

function replaceSeat(state: PrototypeState, seat: PrototypeSeat): PrototypeState {
  return {
    ...state,
    seats: state.seats.map((candidate) => (candidate.id === seat.id ? seat : candidate)),
  };
}

function appendLog(state: PrototypeState, entry: PrototypeLogEntry): PrototypeState {
  return { ...state, log: [...state.log, entry] };
}

function incidentEdges(graph: TransitGraph, node: NodeId): readonly {
  readonly mode: (typeof TRANSPORT_MODES)[number];
  readonly other: NodeId;
}[] {
  const found: { mode: (typeof TRANSPORT_MODES)[number]; other: NodeId }[] = [];
  for (const edge of graph.edges) {
    if (edge.a === node) found.push({ mode: edge.mode, other: edge.b });
    else if (edge.b === node) found.push({ mode: edge.mode, other: edge.a });
  }
  return found;
}

/** Every move a seat may choose. Deterministic order: mode, then destination. */
export function legalMoves(
  graph: TransitGraph,
  state: PrototypeState,
  seatId: PlayerId,
): readonly PrototypeMoveOption[] {
  const seat = seatById(state, seatId);
  if (seat === undefined || state.result !== null) return [];

  const edges = incidentEdges(graph, seat.node);
  const options: PrototypeMoveOption[] = [];

  for (const edge of edges) {
    if (seat.tickets[edge.mode] > 0) {
      options.push({ mode: edge.mode, to: edge.other });
    }
    if (edge.mode === 'taxi' && seat.footSteps > 0) {
      options.push({ mode: 'foot', to: edge.other });
    }
  }

  return options.sort(
    (left, right) =>
      modeRank(left.mode) - modeRank(right.mode) || left.to.localeCompare(right.to),
  );
}

/** Pay for one move and return the resulting seat, or null if it is unaffordable. */
function applyMove(seat: PrototypeSeat, option: PrototypeMoveOption): PrototypeSeat | null {
  if (option.mode === 'foot') {
    if (seat.footSteps <= 0) return null;
    return { ...seat, node: option.to, footSteps: seat.footSteps - 1 };
  }

  const paid = spend(seat.tickets, option.mode);
  if (!paid.ok) return null;
  return { ...seat, node: option.to, tickets: paid.bag };
}

/** Build the initial local state. Throws only on programming errors. */
export function createPrototypeGame(
  graph: TransitGraph,
  starts: { readonly fugitive: NodeId; readonly agents: readonly NodeId[] },
  seed: number,
): PrototypeState {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(starts.fugitive)) throw new Error(`unknown Fugitive start: ${starts.fugitive}`);
  for (const agent of starts.agents) {
    if (!nodeIds.has(agent)) throw new Error(`unknown Agent start: ${agent}`);
  }
  if (starts.agents.length === 0) throw new Error('the prototype needs at least one Agent');

  const fugitive: PrototypeSeat = {
    id: 'fugitive',
    name: 'Vulture',
    role: 'fugitive',
    node: starts.fugitive,
    tickets: { ...PROVISIONAL_FUGITIVE_TICKETS },
    footSteps: PROVISIONAL_FUGITIVE_FOOT_STEPS,
  };

  const agents: PrototypeSeat[] = starts.agents.map((node, index) => ({
    id: `agent-${index + 1}`,
    name: AGENT_NAMES[index] ?? `Agent ${index + 1}`,
    role: 'agent',
    node,
    tickets: { ...PROVISIONAL_AGENT_TICKETS },
    footSteps: PROVISIONAL_AGENT_FOOT_STEPS,
  }));

  return {
    seed,
    turn: 1,
    phase: 'fugitive',
    seats: [fugitive, ...agents],
    lastKnown: starts.fugitive,
    lastAppearanceTurn: null,
    pendingAppearance: APPEARANCE_TURNS.includes(1),
    log: [],
    result: null,
  };
}

/** Apply the human Fugitive's command and hand the turn to the Agents. */
export function applyFugitiveCommand(
  graph: TransitGraph,
  state: PrototypeState,
  command: PrototypeCommand,
): PrototypeCommandResult {
  if (state.result !== null) return { ok: false, reason: 'game-over' };
  if (state.phase !== 'fugitive') return { ok: false, reason: 'not-fugitive-phase' };

  const fugitive = fugitiveOf(state);
  let move: PrototypeMoveOption | null = null;

  if (command.kind === 'move') {
    const match = legalMoves(graph, state, fugitive.id).find(
      (option) => option.mode === command.mode && option.to === command.to,
    );
    if (match === undefined) return { ok: false, reason: 'illegal-move' };
    move = match;
  }

  let next = state;

  if (move !== null) {
    const moved = applyMove(fugitive, move);
    if (moved === null) return { ok: false, reason: 'illegal-move' };
    next = replaceSeat(next, moved);
    next = appendLog(next, {
      turn: state.turn,
      seatId: fugitive.id,
      kind: 'move',
      mode: move.mode,
      node: null,
    });

  } else {
    next = appendLog(next, {
      turn: state.turn,
      seatId: fugitive.id,
      kind: 'move',
      mode: 'hold',
      node: null,
    });
  }

  return {
    ok: true,
    move,
    agentMoves: [],
    state: {
      ...next,
      phase: 'agents',
      pendingAppearance: APPEARANCE_TURNS.includes(next.turn),
    },
  };
}

/** Whether an agent can traverse an edge with its remaining budget. */
function canTraverse(seat: PrototypeSeat, mode: (typeof TRANSPORT_MODES)[number]): boolean {
  if (mode === 'taxi') return seat.tickets.taxi > 0 || seat.footSteps > 0;
  return seat.tickets[mode] > 0;
}

function movementModeFor(
  seat: PrototypeSeat,
  mode: (typeof TRANSPORT_MODES)[number],
): PrototypeMoveOption['mode'] | null {
  if (mode === 'taxi') {
    if (seat.tickets.taxi > 0) return 'taxi';
    if (seat.footSteps > 0) return 'foot';
    return null;
  }
  return seat.tickets[mode] > 0 ? mode : null;
}

/** The first hop of a deterministic BFS toward `target`. */
function firstHopToward(
  graph: TransitGraph,
  seat: PrototypeSeat,
  target: NodeId,
): PrototypeMoveOption | null {
  if (seat.node === target) return null;

  const previous = new Map<NodeId, { readonly from: NodeId; readonly mode: (typeof TRANSPORT_MODES)[number] }>();
  const seen = new Set<NodeId>([seat.node]);
  const queue: NodeId[] = [seat.node];

  while (queue.length > 0) {
    const current = queue.shift() as NodeId;
    const edges = [...incidentEdges(graph, current)].sort(
      (left, right) => left.other.localeCompare(right.other) || left.mode.localeCompare(right.mode),
    );

    for (const edge of edges) {
      if (seen.has(edge.other)) continue;
      if (!canTraverse(seat, edge.mode)) continue;
      seen.add(edge.other);
      previous.set(edge.other, { from: current, mode: edge.mode });
      if (edge.other === target) {
        queue.length = 0;
        break;
      }
      queue.push(edge.other);
    }
  }

  if (!seen.has(target)) return null;

  let cursor = target;
  let step = previous.get(cursor);
  while (step !== undefined && step.from !== seat.node) {
    cursor = step.from;
    step = previous.get(cursor);
  }

  if (step === undefined) return null;
  const mode = movementModeFor(seat, step.mode);
  if (mode === null) return null;
  return { mode, to: cursor };
}

/**
 * Pick one Agent move: head for the last known node, or one of its neighbours,
 * so four Agents surround rather than stack. Deterministic.
 */
export function chooseAgentMove(
  graph: TransitGraph,
  state: PrototypeState,
  agentId: PlayerId,
): PrototypeMoveOption | null {
  const agent = seatById(state, agentId);
  if (agent === undefined || agent.role !== 'agent') return null;

  const index = agentsOf(state).findIndex((seat) => seat.id === agent.id);
  const neighbours = neighboursOf(graph, state.lastKnown);
  const target =
    index <= 0
      ? state.lastKnown
      : (neighbours[(index - 1) % Math.max(1, neighbours.length)] ?? state.lastKnown);

  return firstHopToward(graph, agent, target);
}

/** Make a scheduled appearance public without resolving the Agent phase yet. */
export function revealAppearance(state: PrototypeState): PrototypeCommandResult {
  if (state.result !== null) return { ok: false, reason: 'game-over' };
  if (state.phase !== 'agents') return { ok: false, reason: 'not-agent-phase' };
  if (!state.pendingAppearance) return { ok: true, state, move: null, agentMoves: [] };

  const fugitive = fugitiveOf(state);
  const next: PrototypeState = {
    ...state,
    lastKnown: fugitive.node,
    lastAppearanceTurn: state.turn,
    pendingAppearance: false,
  };
  return {
    ok: true,
    move: null,
    agentMoves: [],
    state: appendLog(next, {
      turn: state.turn,
      seatId: fugitive.id,
      kind: 'appearance',
      mode: 'unknown',
      node: fugitive.node,
    }),
  };
}

/** Shortest-path distance from every node to the nearest Agent, all edges. */
function distanceToAgents(graph: TransitGraph, agents: readonly PrototypeSeat[]): ReadonlyMap<NodeId, number> {
  const distance = new Map<NodeId, number>();
  const queue: NodeId[] = [];
  for (const agent of agents) {
    if (!distance.has(agent.node)) {
      distance.set(agent.node, 0);
      queue.push(agent.node);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift() as NodeId;
    const nextDistance = (distance.get(current) ?? 0) + 1;
    for (const neighbour of neighboursOf(graph, current)) {
      if (distance.has(neighbour)) continue;
      distance.set(neighbour, nextDistance);
      queue.push(neighbour);
    }
  }
  return distance;
}

/**
 * Bot Fugitive policy for Agent Practice: move to the node with the greatest
 * graph distance from the nearest Agent, or hold if no move improves it.
 * Deterministic; it never sees hidden Agent intentions beyond the board.
 */
export function chooseFugitiveMove(
  graph: TransitGraph,
  state: PrototypeState,
): PrototypeMoveOption | null {
  if (state.result !== null || state.phase !== 'fugitive') return null;
  const fugitive = fugitiveOf(state);
  const options = legalMoves(graph, state, fugitive.id);
  if (options.length === 0) return null;

  const distance = distanceToAgents(graph, agentsOf(state));
  const current = distance.get(fugitive.node) ?? 0;
  let best: PrototypeMoveOption | null = null;
  let bestDistance = current;

  for (const option of options) {
    const score = distance.get(option.to) ?? 0;
    if (
      score > bestDistance ||
      (score === bestDistance &&
        best !== null &&
        (modeRank(option.mode) < modeRank(best.mode) ||
          (option.mode === best.mode && option.to.localeCompare(best.to) < 0)))
    ) {
      best = option;
      bestDistance = score;
    }
  }

  // Never move closer merely to spend a ticket; holding is a legal turn.
  return bestDistance > current ? best : null;
}

/** Resolve the Agent phase, apply capture, and advance or end the Yard. */
export function resolveAgentPhase(
  graph: TransitGraph,
  state: PrototypeState,
  orders: PrototypeAgentOrders = {},
): PrototypeCommandResult {
  if (state.result !== null) return { ok: false, reason: 'game-over' };
  if (state.phase !== 'agents') return { ok: false, reason: 'not-agent-phase' };

  const agents = agentsOf(state);
  const moves = orders.moves ?? {};
  const holds = new Set(orders.holds ?? []);
  for (const id of [...Object.keys(moves), ...holds]) {
    const agent = agents.find((candidate) => candidate.id === id);
    if (agent === undefined) return { ok: false, reason: 'no-such-seat' };
    if (holds.has(id) && moves[id] !== undefined) return { ok: false, reason: 'illegal-move' };
    const option = moves[id];
    if (option !== undefined) {
      const legal = legalMoves(graph, state, id).some(
        (candidate) => candidate.mode === option.mode && candidate.to === option.to,
      );
      if (!legal) return { ok: false, reason: 'illegal-move' };
    }
  }

  const fugitive = fugitiveOf(state);
  let next: PrototypeState = state;
  const agentMoves: PrototypeAgentMove[] = [];

  if (state.pendingAppearance) {
    next = {
      ...next,
      lastKnown: fugitive.node,
      lastAppearanceTurn: state.turn,
      pendingAppearance: false,
    };
    next = appendLog(next, {
      turn: state.turn,
      seatId: fugitive.id,
      kind: 'appearance',
      mode: 'unknown',
      node: fugitive.node,
    });
  }

  for (const agent of agentsOf(next)) {
    const from = agent.node;
    if (holds.has(agent.id)) continue;
    const option = moves[agent.id] ?? chooseAgentMove(graph, { ...next, seats: next.seats }, agent.id);
    if (option === null) continue;
    const moved = applyMove(agent, option);
    if (moved === null) continue;
    next = replaceSeat(next, moved);
    agentMoves.push({ seatId: agent.id, from, to: moved.node, mode: option.mode });
  }

  const captor = agentsOf(next).find((agent) => agent.node === fugitive.node);
  if (captor !== undefined) {
    const result = {
      winner: 'agents' as const,
      reason: 'capture' as const,
      turn: next.turn,
      capturedBy: captor.id,
    };
    return {
      ok: true,
      move: null,
      agentMoves,
      state: appendLog(
        { ...next, phase: 'result', result },
        {
          turn: next.turn,
          seatId: null,
          kind: 'result',
          mode: 'unknown',
          node: captor.node,
        },
      ),
    };
  }

  if (next.turn >= YARD_TURN_LIMIT) {
    const result = {
      winner: 'fugitives' as const,
      reason: 'survived' as const,
      turn: next.turn,
      capturedBy: null,
    };
    return {
      ok: true,
      move: null,
      agentMoves,
      state: appendLog(
        { ...next, phase: 'result', result },
        {
          turn: next.turn,
          seatId: null,
          kind: 'result',
          mode: 'unknown',
          node: null,
        },
      ),
    };
  }

  return {
    ok: true,
    move: null,
    agentMoves,
    state: {
      ...next,
      turn: next.turn + 1,
      phase: 'fugitive',
      pendingAppearance: APPEARANCE_TURNS.includes(next.turn + 1),
    },
  };
}

/** Convenience for the UI: the public log in reverse chronological order. */
export function recentLog(state: PrototypeState, limit = 6): readonly PrototypeLogEntry[] {
  return state.log.slice(Math.max(0, state.log.length - limit)).reverse();
}
