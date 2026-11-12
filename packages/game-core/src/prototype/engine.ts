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
import { pickRandom, seedRngState, type RngState } from '../rng';
import { spend } from '../tickets';
import {
  APPEARANCE_TURNS,
  TRANSPORT_MODES,
  YARD_TURN_LIMIT,
  type NodeId,
  type PlayerId,
  type TicketBag,
  type TransitGraph,
} from '../types';
import type {
  PrototypeAgentMove,
  PrototypeAgentOrders,
  PrototypeCommand,
  PrototypeCommandResult,
  PrototypeJob,
  PrototypeJobIcon,
  PrototypeJobPickup,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypeSeat,
  PrototypeSetup,
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

/*
 * PROVISIONAL (delivery jobs): the director set the cadence and £10 prize in
 * conversation; the timing is explicitly "to be tested". These are not in
 * GAME_VISION.md, so they stay provisional.
 */
const PROVISIONAL_JOB_INTERVAL_TURNS = 5;
const PROVISIONAL_JOB_LIFETIME_TURNS = 5;
const PROVISIONAL_JOB_PRIZE_POUNDS = 10;

/** Seeded shipment titles and their icons. */
const JOB_CATALOGUE: readonly { readonly title: string; readonly icon: PrototypeJobIcon }[] = [
  { title: 'The Gin Run', icon: 'barrel' },
  { title: "The Doctor's Bag", icon: 'bag' },
  { title: 'The Ledger', icon: 'ledger' },
  { title: 'The Revolver Case', icon: 'case' },
  { title: 'The Opium Box', icon: 'box' },
  { title: "The Jeweller's Packet", icon: 'pouch' },
  { title: 'The Cigarette Carton', icon: 'carton' },
  { title: 'The Silk Bolts', icon: 'silk' },
];

/*
 * PROVISIONAL (demo only): a Yard shorter or longer than the ratified 16 turns
 * keeps three appearances at the same relative points (5/10/15 of 16). The
 * fractions are a presentation default for the interactive demo, not a rule.
 */
const PROVISIONAL_APPEARANCE_FRACTIONS = [5 / 16, 10 / 16, 15 / 16] as const;

/** Appearance turns for an arbitrary Yard length, sorted and unique. */
export function prototypeAppearanceTurns(turnLimit: number): readonly number[] {
  if (!Number.isInteger(turnLimit) || turnLimit < 1) {
    throw new RangeError(`turnLimit must be a positive integer, received ${String(turnLimit)}`);
  }
  const turns = PROVISIONAL_APPEARANCE_FRACTIONS.map((fraction) =>
    Math.min(turnLimit, Math.max(1, Math.round(turnLimit * fraction))),
  );
  return [...new Set(turns)].sort((left, right) => left - right);
}

/** The fully populated default setup, safe for the demo to prefill from. */
export interface PrototypeDefaults {
  readonly turnLimit: number;
  readonly appearanceTurns: readonly number[];
  readonly fugitiveTickets: TicketBag;
  readonly agentTickets: TicketBag;
  readonly fugitiveFootSteps: number;
  readonly agentFootSteps: number;
}

/**
 * The defaults the prototype has always used. Exported so the interactive demo
 * can prefill its controls without repeating the numbers in the client.
 */
export const PROVISIONAL_PROTOTYPE_SETUP: PrototypeDefaults = {
  turnLimit: YARD_TURN_LIMIT,
  appearanceTurns: APPEARANCE_TURNS,
  fugitiveTickets: { ...PROVISIONAL_FUGITIVE_TICKETS },
  agentTickets: { ...PROVISIONAL_AGENT_TICKETS },
  fugitiveFootSteps: PROVISIONAL_FUGITIVE_FOOT_STEPS,
  agentFootSteps: PROVISIONAL_AGENT_FOOT_STEPS,
};

function countOrThrow(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new RangeError(`${label} must be a non-negative integer, received ${String(resolved)}`);
  }
  return resolved;
}

function ticketBag(base: TicketBag, override: Partial<TicketBag> | undefined): TicketBag {
  return {
    taxi: countOrThrow(override?.taxi, base.taxi, 'taxi tickets'),
    bus: countOrThrow(override?.bus, base.bus, 'bus tickets'),
    underground: countOrThrow(override?.underground, base.underground, 'underground tickets'),
    special: countOrThrow(override?.special, base.special, 'special tickets'),
  };
}

function normaliseAppearances(
  turnLimit: number,
  appearances: readonly number[] | undefined,
): readonly number[] {
  const source =
    appearances === undefined
      ? turnLimit === YARD_TURN_LIMIT
        ? APPEARANCE_TURNS
        : prototypeAppearanceTurns(turnLimit)
      : appearances;
  const cleaned: number[] = [];
  for (const turn of source) {
    if (!Number.isInteger(turn) || turn < 1 || turn > turnLimit) {
      throw new RangeError(
        `appearance turn ${String(turn)} must be an integer in [1, ${turnLimit}]`,
      );
    }
    if (!cleaned.includes(turn)) cleaned.push(turn);
  }
  return cleaned.sort((left, right) => left - right);
}

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

/**
 * Normalise the public pickup stations. If the caller supplies none, every
 * station is a fallback so unit tests and small fixtures still have jobs.
 */
function normaliseJobPickups(
  graph: TransitGraph,
  pickups: readonly PrototypeJobPickup[] | undefined,
): readonly PrototypeJobPickup[] {
  const nodes = new Set(graph.nodes.map((node) => node.id));
  const source = pickups ?? [];
  const cleaned: PrototypeJobPickup[] = [];
  const seen = new Set<NodeId>();
  for (const pickup of source) {
    if (!nodes.has(pickup.node)) throw new Error(`unknown job pickup node: ${pickup.node}`);
    if (seen.has(pickup.node)) continue;
    seen.add(pickup.node);
    cleaned.push({
      node: pickup.node,
      label: pickup.label.trim() === '' ? pickup.node : pickup.label,
    });
  }
  if (cleaned.length > 0) return cleaned;
  return graph.nodes
    .map((node) => ({ node: node.id, label: node.id }))
    .sort((left, right) => left.node.localeCompare(right.node));
}

/** A separate seeded stream per spawn turn keeps existing jobs stable. */
function jobRng(seed: number, turn: number): RngState {
  return seedRngState((seed ^ Math.imul(turn, 0x9e3779b1)) >>> 0);
}

/** Build one deterministic offer for `turn`. */
function generateJob(graph: TransitGraph, state: PrototypeState, turn: number): PrototypeJob {
  let rng = jobRng(state.seed, turn);
  const pickupDraw = pickRandom(rng, state.jobPickups);
  rng = pickupDraw.state;
  const pickup = pickupDraw.value;

  const destinations = graph.nodes
    .map((node) => node.id)
    .filter((id) => id !== pickup.node)
    .sort();
  let destination = pickup.node;
  if (destinations.length > 0) {
    const destinationDraw = pickRandom(rng, destinations);
    rng = destinationDraw.state;
    destination = destinationDraw.value;
  }

  const liveTitles = new Set(
    state.jobs
      .filter((job) => job.status === 'available' || job.status === 'active')
      .map((job) => job.title),
  );
  const availableTitles = JOB_CATALOGUE.filter((entry) => !liveTitles.has(entry.title));
  const catalogue = availableTitles.length > 0 ? availableTitles : JOB_CATALOGUE;
  const titleDraw = pickRandom(rng, catalogue);

  return {
    id: `job-${turn}`,
    title: titleDraw.value.title,
    icon: titleDraw.value.icon,
    pickup: pickup.node,
    pickupLabel: pickup.label,
    destination,
    prize: PROVISIONAL_JOB_PRIZE_POUNDS,
    spawnedTurn: turn,
    expiresTurn: turn + PROVISIONAL_JOB_LIFETIME_TURNS,
    status: 'available',
  };
}

/** Expire old offers and spawn the offer for this turn, if one is due. */
function beginTurn(graph: TransitGraph, state: PrototypeState, turn: number): PrototypeState {
  let jobs = state.jobs.map((job) =>
    job.status === 'available' && job.expiresTurn <= turn
      ? { ...job, status: 'expired' as const }
      : job,
  );
  const spawnDue = (turn - 1) % PROVISIONAL_JOB_INTERVAL_TURNS === 0;
  if (spawnDue && !jobs.some((job) => job.spawnedTurn === turn)) {
    jobs = [...jobs, generateJob(graph, { ...state, jobs }, turn)];
  }
  return { ...state, jobs };
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
  setup: PrototypeSetup = {},
): PrototypeState {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(starts.fugitive)) throw new Error(`unknown Fugitive start: ${starts.fugitive}`);
  for (const agent of starts.agents) {
    if (!nodeIds.has(agent)) throw new Error(`unknown Agent start: ${agent}`);
  }
  if (starts.agents.length === 0) throw new Error('the prototype needs at least one Agent');

  const turnLimit = setup.turnLimit ?? YARD_TURN_LIMIT;
  if (!Number.isInteger(turnLimit) || turnLimit < 1) {
    throw new RangeError(`turnLimit must be a positive integer, received ${String(turnLimit)}`);
  }
  const appearanceTurns = normaliseAppearances(turnLimit, setup.appearanceTurns);
  const jobPickups = normaliseJobPickups(graph, setup.jobPickups);

  const fugitive: PrototypeSeat = {
    id: 'fugitive',
    name: 'Vulture',
    role: 'fugitive',
    node: starts.fugitive,
    tickets: ticketBag(PROVISIONAL_FUGITIVE_TICKETS, setup.fugitiveTickets),
    footSteps: countOrThrow(
      setup.fugitiveFootSteps,
      PROVISIONAL_FUGITIVE_FOOT_STEPS,
      'fugitive foot steps',
    ),
  };

  const agents: PrototypeSeat[] = starts.agents.map((node, index) => ({
    id: `agent-${index + 1}`,
    name: AGENT_NAMES[index] ?? `Agent ${index + 1}`,
    role: 'agent',
    node,
    tickets: ticketBag(PROVISIONAL_AGENT_TICKETS, setup.agentTickets),
    footSteps: countOrThrow(setup.agentFootSteps, PROVISIONAL_AGENT_FOOT_STEPS, 'agent foot steps'),
  }));

  const initial: PrototypeState = {
    seed,
    turn: 1,
    turnLimit,
    appearanceTurns,
    phase: 'fugitive',
    seats: [fugitive, ...agents],
    jobPickups,
    jobs: [],
    activeJobId: null,
    cash: 0,
    jobsDelivered: 0,
    lastKnown: starts.fugitive,
    lastAppearanceTurn: null,
    pendingAppearance: appearanceTurns.includes(1),
    log: [],
    result: null,
  };
  return beginTurn(graph, initial, 1);
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
  let next = state;

  if (command.kind === 'move') {
    const match = legalMoves(graph, state, fugitive.id).find(
      (option) => option.mode === command.mode && option.to === command.to,
    );
    if (match === undefined) return { ok: false, reason: 'illegal-move' };
    move = match;
    const moved = applyMove(fugitive, match);
    if (moved === null) return { ok: false, reason: 'illegal-move' };
    next = replaceSeat(next, moved);
    next = appendLog(next, {
      turn: state.turn,
      seatId: fugitive.id,
      kind: 'move',
      mode: match.mode,
      node: null,
    });
  } else if (command.kind === 'collect-job') {
    const job = state.jobs.find((candidate) => candidate.id === command.jobId);
    if (
      state.activeJobId !== null ||
      job === undefined ||
      job.status !== 'available' ||
      job.pickup !== fugitive.node
    ) {
      return { ok: false, reason: 'illegal-job' };
    }
    next = {
      ...next,
      activeJobId: job.id,
      jobs: next.jobs.map((candidate) =>
        candidate.id === job.id ? { ...candidate, status: 'active' as const } : candidate,
      ),
    };
    // The pickup is the only public job event; the destination and prize stay private.
    next = appendLog(next, {
      turn: state.turn,
      seatId: fugitive.id,
      kind: 'pickup',
      mode: 'unknown',
      node: job.pickup,
    });
  } else if (command.kind === 'deliver-job') {
    const job = next.jobs.find((candidate) => candidate.id === next.activeJobId);
    if (
      job === undefined ||
      job.status !== 'active' ||
      job.destination !== fugitive.node
    ) {
      return { ok: false, reason: 'illegal-job' };
    }
    next = {
      ...next,
      activeJobId: null,
      cash: next.cash + job.prize,
      jobsDelivered: next.jobsDelivered + 1,
      jobs: next.jobs.map((candidate) =>
        candidate.id === job.id ? { ...candidate, status: 'delivered' as const } : candidate,
      ),
    };
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
      pendingAppearance: state.appearanceTurns.includes(next.turn),
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

/**
 * Bot Fugitive policy for Agent Practice with jobs. It collects the earliest
 * expiring offer it can reach and then heads for the drop. If no job is
 * reachable it falls back to evading the Agents.
 */
export function chooseFugitiveCommand(
  graph: TransitGraph,
  state: PrototypeState,
): PrototypeCommand | null {
  if (state.result !== null || state.phase !== 'fugitive') return null;
  const fugitive = fugitiveOf(state);

  const active = state.jobs.find((job) => job.id === state.activeJobId);
  if (active !== undefined && active.status === 'active') {
    if (fugitive.node === active.destination) return { kind: 'deliver-job' };
    const hop = firstHopToward(graph, fugitive, active.destination);
    return hop === null ? null : { kind: 'move', mode: hop.mode, to: hop.to };
  }

  const offers = state.jobs
    .filter((job) => job.status === 'available')
    .sort(
      (left, right) =>
        left.expiresTurn - right.expiresTurn || left.id.localeCompare(right.id),
    );
  const offer = offers[0];
  if (offer !== undefined) {
    if (fugitive.node === offer.pickup) return { kind: 'collect-job', jobId: offer.id };
    const hop = firstHopToward(graph, fugitive, offer.pickup);
    if (hop !== null) return { kind: 'move', mode: hop.mode, to: hop.to };
  }

  const move = chooseFugitiveMove(graph, state);
  return move === null ? null : { kind: 'move', mode: move.mode, to: move.to };
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

  if (next.turn >= state.turnLimit) {
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

  const nextTurn = next.turn + 1;
  const started = beginTurn(
    graph,
    {
      ...next,
      turn: nextTurn,
      phase: 'fugitive',
      pendingAppearance: next.appearanceTurns.includes(nextTurn),
    },
    nextTurn,
  );
  return {
    ok: true,
    move: null,
    agentMoves,
    state: started,
  };
}

/** Convenience for the UI: the public log in reverse chronological order. */
export function recentLog(state: PrototypeState, limit = 6): readonly PrototypeLogEntry[] {
  return state.log.slice(Math.max(0, state.log.length - limit)).reverse();
}
