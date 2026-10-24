/**
 * `@x-yard/game-core` — the pure, framework-agnostic X-Yard rules engine.
 *
 * GAME_VISION.md §6 requires graph traversal, ticket validation, and
 * win-condition checking to live here as framework-agnostic TypeScript. The
 * contract that makes that possible:
 *
 *   - No framework, UI, network, or filesystem dependencies. Ever.
 *   - Every transition is a pure function; inputs are never mutated.
 *   - All randomness flows through an injected {@link RngState}, so a Yard
 *     replays exactly from seed + event log.
 *   - `Math.random`, `Date.now`, `performance.now`, and `crypto` are banned.
 *   - State is JSON-only: no Map, Set, Date, class instances, or undefined.
 *
 * Symbols named `PROVISIONAL_*` are unratified defaults standing in for open
 * questions in the vision appendix. `grep -rn PROVISIONAL_` lists them all.
 *
 * @module @x-yard/game-core
 */

/* Domain vocabulary and constants. */
export type {
  AgentSkill,
  CaptureKind,
  ContrabandRun,
  DistrictId,
  EdgeId,
  Facility,
  Gadget,
  GraphEdge,
  GraphNode,
  LoggedTransport,
  MapPoint,
  MissionId,
  MobilityOption,
  NodeClass,
  NodeId,
  Phase,
  PlayerId,
  RevealReason,
  RiskTier,
  Role,
  StreetSegment,
  TicketBag,
  TicketBagDelta,
  TicketLogEntry,
  TransitGraph,
  TransportMode,
  YardId,
  YardResult,
} from './types';

export {
  AGENT_SKILLS,
  GADGETS,
  MAX_AGENTS_PER_YARD,
  MAX_FUGITIVES_PER_YARD,
  MIN_START_SEPARATION_EDGES,
  PROVISIONAL_AGENT_STARTING_TICKETS,
  PROVISIONAL_ARMS_NOISE_PING_EVERY,
  PROVISIONAL_FUGITIVE_STARTING_TICKETS,
  PROVISIONAL_HEAVY_CARGO_FORBIDS,
  PROVISIONAL_LOGOFF_GRACE_TURNS,
  PROVISIONAL_MISSION_PAYOUTS,
  REVEAL_PULSE_TURNS,
  SENSOR_SWEEP_RADIUS,
  TRANSPORT_MODES,
  YARD_TURN_LIMIT,
} from './types';

/* Deterministic randomness. */
export type { Draw, IntDraw, RngState, ShuffleResult } from './rng';

export { isRngState, nextRandom, pickRandom, randomInt, seedRngState, shuffleWith } from './rng';

/* Transit graph: traversal and validation. */
export type {
  GraphStats,
  GraphValidationReport,
  StreetGeometryOptions,
  StreetGeometryReport,
} from './graph';

export {
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

/* Ticket economy and the public ticket log. */
export type { Concealment, SpendAccepted, SpendRejected, SpendResult } from './tickets';

export {
  affordableModes,
  appendTicketLog,
  applyTicketDelta,
  createTicketBag,
  isEmpty,
  logForFugitive,
  refund,
  spend,
  startingTicketsFor,
  ticketCount,
  ticketLogEntry,
  totalTickets,
} from './tickets';

/* Scaffold fixture (not a shipped Yard map). */
export { DEMO_BOARD } from './demo-board';

/* Local 1-vs-N prototype loop (not the full GameState). */
export type {
  PrototypeCommand,
  PrototypeCommandError,
  PrototypeCommandResult,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypePhase,
  PrototypeResult,
  PrototypeSeat,
  PrototypeState,
} from './prototype/types';

export {
  applyFugitiveCommand,
  chooseAgentMove,
  createPrototypeGame,
  legalMoves,
  recentLog,
  resolveAgentPhase,
} from './prototype/engine';
