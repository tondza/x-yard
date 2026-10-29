/**
 * Core domain vocabulary for X-Yard.
 *
 * GAME_VISION.md is the authority. Everything the brief states as fact is
 * encoded here plainly; everything it leaves open is marked `PROVISIONAL` and
 * cross-referenced to the matching open question in the appendix. If a
 * `PROVISIONAL_` symbol is still here when the director answers its question,
 * that is a bug — update the brief and this file together.
 *
 * @module @x-yard/game-core/types
 */

/* ------------------------------------------------------------------ *
 * Identifiers and enumerations
 * ------------------------------------------------------------------ */

/** Stable identifier for a Yard (an isolated game-room instance), e.g. `yard-london`. */
export type YardId = string;

/** Stable identifier for a node on the transit graph. */
export type NodeId = string;

/** Deterministic edge identifier. */
export type EdgeId = string;

/** Stable identifier for a seat at the table. */
export type PlayerId = string;

/** Stable identifier for a contraband run. */
export type MissionId = string;

/** One of the map's UI/stat groupings. */
export type DistrictId = string;

/**
 * Transport tiers (GAME_VISION.md §3).
 *
 * `underground` is the brief's "Underground / High-Speed Rail", also referred to
 * as Metro in §2. `special` is the brief's "Special Transport / Alleyway" —
 * secret or specialised links that require gear (Alleyway Sprint, Boat).
 */
export type TransportMode = 'taxi' | 'bus' | 'underground' | 'special';

/**
 * Factions (GAME_VISION.md §1). Fugitives are collectively "Subject X".
 *
 * There is no single hidden player: a Yard may hold several Fugitives.
 */
export type Role = 'fugitive' | 'agent';

/**
 * Structural node tier, which determines which transit modes a node may serve.
 *
 * PROVISIONAL (GAME_VISION.appendix.md Q7): §3 describes transport tiers but no node
 * taxonomy. These three classes are the engineering recommendation.
 */
export type NodeClass = 'street' | 'hub' | 'terminal';

/** A special function a node provides (GAME_VISION.md §4). */
export type Facility = 'black-market' | 'safe-house';

/** Risk tier of a contraband cargo, driving payout and side effects (§4). */
export type RiskTier = 'light' | 'heavy' | 'arms';

/** Fugitive consumable gadgets (GAME_VISION.md §5). */
export type Gadget = 'decoy-ping' | 'counterfeit-identity' | 'alleyway-sprint';

/** Agent active skills (GAME_VISION.md §5). */
export type AgentSkill = 'targeted-roadblock' | 'sensor-sweep' | 'rapid-deployment';

/** Ordered phases of a Yard turn (GAME_VISION.md §2). */
export type Phase =
  | 'yard-start'
  | 'fugitive-phase'
  | 'agent-phase'
  | 'capture-resolution'
  | 'reveal-pulse'
  | 'yard-end';

/** How a Fugitive was caught. §2 defines exactly one mechanism: occupation. */
export type CaptureKind = 'occupation';

/** Why a Fugitive's true node became public. */
export type RevealReason = 'schedule' | 'decoy-ping' | 'scooter';

/** Terminal outcome of a Yard. */
export type YardResult = 'agents-win' | 'fugitives-extracted' | 'abandoned';

/**
 * Every movement option a seat can choose.
 *
 * `foot` and `scooter` are deliberately not added to `TransportMode`: that union
 * indexes edges and ticket bags. Keeping them separate is decision E2 in
 * `docs/project-plan.md`.
 */
export type MobilityOption = TransportMode | 'foot' | 'scooter';

/**
 * What a viewer sees in the ticket log for one movement.
 *
 * `foot`, `scooter` and `hold` join the four paid tiers; `unknown` is the
 * Counterfeit Identity concealment.
 */
export type LoggedTransport = TransportMode | 'foot' | 'scooter' | 'hold' | 'unknown';

/* ------------------------------------------------------------------ *
 * Graph
 * ------------------------------------------------------------------ */

/** A node on the transit graph. JSON-serializable only. */
export interface GraphNode {
  readonly id: NodeId;
  readonly class: NodeClass;
  /** Modes usable at this node; must equal the modes of its incident edges. */
  readonly modes: readonly TransportMode[];
  readonly district: DistrictId;
  /** Facilities hosted here (§4). Empty for an ordinary node. */
  readonly facilities: readonly Facility[];
  readonly x: number;
  readonly y: number;
}

/** A point in map-data space (not screen space). */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A street centreline from the map generator.
 *
 * Street-following edges are validated against these: a taxi or bus path that
 * leaves the street network is a map bug, not a rendering choice (R5 in
 * `docs/mvp/round-03-rules.md`).
 */
export interface StreetSegment {
  readonly id: string;
  readonly path: readonly MapPoint[];
}

/** An undirected route. JSON-serializable only. */
export interface GraphEdge {
  readonly id: EdgeId;
  readonly a: NodeId;
  readonly b: NodeId;
  readonly mode: TransportMode;
  readonly ticketCost: 1;
  /** Every edge is traversable in both directions. */
  readonly symmetric: true;
  /**
   * Authored street-following polyline in map-data space.
   *
   * Required by the map generator for `taxi` and `bus`; `underground` and
   * `special` may legitimately cut across blocks. Optional so a hand-made
   * fixture can omit it; renderers fall back to a chord via `edgePath`.
   */
  readonly path?: readonly MapPoint[];
}

/** The immutable board. */
export interface TransitGraph {
  readonly mapId: string;
  readonly world: { readonly width: number; readonly height: number };
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/* ------------------------------------------------------------------ *
 * Economy
 * ------------------------------------------------------------------ */

/** Per-mode tickets held by one player. */
export interface TicketBag {
  readonly taxi: number;
  readonly bus: number;
  readonly underground: number;
  readonly special: number;
}

/** A partial ticket delta. */
export type TicketBagDelta = Partial<Record<TransportMode, number>>;

/**
 * One public row of the ticket log — the deduction surface (§2, §5).
 *
 * Every Fugitive movement normally appends a row naming the mode used. Two
 * gadgets break that:
 *   - **Counterfeit Identity** appends `mode: 'unknown'`.
 *   - **Alleyway Sprint** appends nothing at all: no ticket, no trail.
 */
export interface TicketLogEntry {
  readonly turn: number;
  readonly fugitiveId: PlayerId;
  readonly mode: LoggedTransport;
}

/* ------------------------------------------------------------------ *
 * Missions (§4)
 * ------------------------------------------------------------------ */

/**
 * A contraband run: carry cargo from the Black Market node it was accepted at
 * to a destination node, for points.
 */
export interface ContrabandRun {
  readonly id: MissionId;
  /** Node the run was accepted at; §4 requires a Black Market node. */
  readonly origin: NodeId;
  readonly destination: NodeId;
  readonly riskTier: RiskTier;
  readonly payoutPoints: number;
}

/* ------------------------------------------------------------------ *
 * Constants stated by the brief
 * ------------------------------------------------------------------ */

/** Sensor Sweep confirms presence within this many nodes (§5, "a 2-node radius"). */
export const SENSOR_SWEEP_RADIUS = 2;

/** Every gadget in the game (§5). */
export const GADGETS: readonly Gadget[] = [
  'decoy-ping',
  'counterfeit-identity',
  'alleyway-sprint',
];

/** Every Agent active skill in the game (§5). */
export const AGENT_SKILLS: readonly AgentSkill[] = [
  'targeted-roadblock',
  'sensor-sweep',
  'rapid-deployment',
];

/** The three public transit tiers plus the special tier (§3). */
export const TRANSPORT_MODES: readonly TransportMode[] = [
  'taxi',
  'bus',
  'underground',
  'special',
];

/* ------------------------------------------------------------------ *
 * Numbers ratified by the director on 2026-10-16
 *
 * Each of these was a `PROVISIONAL_` default until the director answered the
 * matching open question in GAME_VISION.appendix.md C.2. The value cited in
 * the comment is the ruling; do not change one without a new ruling.
 * ------------------------------------------------------------------ */

/** Turns in one Yard (§2). Ratified 2026-10-16: a 16-turn Yard. */
export const YARD_TURN_LIMIT = 16;

/**
 * Turns on which the Fugitive makes a mandatory appearance (§2).
 * Ratified 2026-10-16 as turns 5 / 10 / 15; the director renamed the
 * player-facing term from "Reveal Pulse" to "Appearance" on 2026-10-29.
 */
export const APPEARANCE_TURNS: readonly number[] = [5, 10, 15];

/** Fugitive seats per Yard (§6). Ratified 2026-10-16. */
export const MAX_FUGITIVES_PER_YARD = 4;

/**
 * Agent seats per Yard (§6). Ratified 2026-10-16 alongside
 * {@link MAX_FUGITIVES_PER_YARD}: 4 + 16 = the ruled 20 players per Yard.
 */
export const MAX_AGENTS_PER_YARD = 16;

/**
 * Minimum graph distance, in edges, between every Agent start and the
 * Fugitive start (§3). Ratified 2026-10-16 (appendix C.2, R15).
 */
export const MIN_START_SEPARATION_EDGES = 3;

/* ------------------------------------------------------------------ *
 * PROVISIONAL defaults — NOT stated by the brief
 *
 * Each constant below exists only so the engine can run before the director
 * answers. The `PROVISIONAL_` prefix is deliberate: `grep -rn PROVISIONAL_`
 * must list every unratified number in the codebase.
 * ------------------------------------------------------------------ */

/** PROVISIONAL (Q1): §3 gives no ticket counts, only "cheap and plentiful". */
export const PROVISIONAL_FUGITIVE_STARTING_TICKETS: TicketBag = {
  taxi: 12,
  bus: 8,
  underground: 6,
  special: 2,
};

/** PROVISIONAL (Q1). */
export const PROVISIONAL_AGENT_STARTING_TICKETS: TicketBag = {
  taxi: 10,
  bus: 8,
  underground: 5,
  special: 0,
};

/** PROVISIONAL (Q9): payout scale by cargo risk tier. */
export const PROVISIONAL_MISSION_PAYOUTS: Readonly<Record<RiskTier, number>> = {
  light: 10,
  heavy: 25,
  arms: 50,
};

/** PROVISIONAL (Q8): §4 mentions a grace period without a duration. */
export const PROVISIONAL_LOGOFF_GRACE_TURNS = 3;

/** PROVISIONAL (Q6): how heavy cargo restricts movement. */
export const PROVISIONAL_HEAVY_CARGO_FORBIDS: readonly TransportMode[] = ['underground'];

/** PROVISIONAL (Q6): how often arms cargo emits a noise ping. */
export const PROVISIONAL_ARMS_NOISE_PING_EVERY = 3;
