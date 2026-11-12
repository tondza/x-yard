/**
 * The reduced, local prototype state.
 *
 * This is deliberately **not** the full `GameState` from the prototype plan:
 * there is one Fugitive, four Agents, no server projection, no missions and no
 * gadgets. It exists to make the 96-station board playable and testable, and it
 * is named `PrototypeState` so the architecture guard for the real state machine
 * stays honest.
 *
 * @module @x-yard/game-core/prototype/types
 */

import type {
  LoggedTransport,
  MobilityOption,
  NodeId,
  PlayerId,
  Role,
  TicketBag,
} from '../types';

/**
 * Optional overrides for a local demo. A real table uses the ratified defaults;
 * this exists so the interactive demo can vary the Yard length and ticket
 * budgets without editing a rules constant.
 */
export interface PrototypeSetup {
  /** Turns the Yard lasts. Defaults to the ratified 16. */
  readonly turnLimit?: number;
  /** Appearance turns; defaults to the 5/10/15 schedule, scaled for other lengths. */
  readonly appearanceTurns?: readonly number[];
  readonly fugitiveTickets?: Partial<TicketBag>;
  readonly agentTickets?: Partial<TicketBag>;
  readonly fugitiveFootSteps?: number;
  readonly agentFootSteps?: number;
  /** Stations near public landmarks where jobs may be collected. */
  readonly jobPickups?: readonly PrototypeJobPickup[];
}

/** A local prototype turn is one Fugitive move followed by the Agent phase. */
export type PrototypePhase = 'fugitive' | 'agents' | 'result';

/** One seat at the local table. JSON-serializable only. */
export interface PrototypeSeat {
  readonly id: PlayerId;
  readonly name: string;
  readonly role: Role;
  readonly node: NodeId;
  readonly tickets: TicketBag;
  readonly footSteps: number;
}

/** A public place where a job can be collected. */
export interface PrototypeJobPickup {
  readonly node: NodeId;
  readonly label: string;
}

/** The shipment icon keys the UI can draw. */
export type PrototypeJobIcon = 'barrel' | 'bag' | 'ledger' | 'case' | 'box' | 'pouch' | 'carton' | 'silk';

export type PrototypeJobStatus = 'available' | 'active' | 'delivered' | 'expired';

/** One smuggling job. Values are immutable; the state replaces the object on change. */
export interface PrototypeJob {
  readonly id: string;
  readonly title: string;
  readonly icon: PrototypeJobIcon;
  readonly pickup: NodeId;
  readonly pickupLabel: string;
  readonly destination: NodeId;
  readonly prize: number;
  readonly spawnedTurn: number;
  readonly expiresTurn: number;
  readonly status: PrototypeJobStatus;
}

/** A legal move for a seat. */
export interface PrototypeMoveOption {
  readonly mode: MobilityOption;
  readonly to: NodeId;
}

/**
 * One Agent move the engine actually applied, in resolution order.
 *
 * This is a *return value*, not state: the client uses it to reveal the moves
 * one at a time. Without it the view would have to re-run the bot and infer the
 * mode from the graph, which could draw a different edge than the one the engine
 * charged for.
 */
export interface PrototypeAgentMove {
  readonly seatId: PlayerId;
  readonly from: NodeId;
  readonly to: NodeId;
  readonly mode: MobilityOption;
}

/** A command from the human Fugitive. */
export type PrototypeCommand =
  | {
      readonly kind: 'move';
      readonly mode: MobilityOption;
      readonly to: NodeId;
    }
  | { readonly kind: 'hold' }
  | { readonly kind: 'collect-job'; readonly jobId: string }
  | { readonly kind: 'deliver-job' };

/** Why a command was rejected. Ordinary conditions are values, not throws. */
export type PrototypeCommandError =
  | 'not-fugitive-phase'
  | 'not-agent-phase'
  | 'game-over'
  | 'no-such-seat'
  | 'illegal-move'
  | 'illegal-job';

/** Optional human Agent orders for one Agent-phase resolution. */
export interface PrototypeAgentOrders {
  /** Agent moves chosen by the human; Agents not listed use their bot move. */
  readonly moves?: Readonly<Record<PlayerId, PrototypeMoveOption>>;
  /** Agents told to hold; they spend nothing and do not move. */
  readonly holds?: readonly PlayerId[];
}

/** Result of a Fugitive command or an Agent phase. */
export type PrototypeCommandResult =
  | {
      readonly ok: true;
      readonly state: PrototypeState;
      readonly move: PrototypeMoveOption | null;
      /** Agent moves applied by this resolution, in seat order. Empty for a Fugitive command. */
      readonly agentMoves: readonly PrototypeAgentMove[];
    }
  | { readonly ok: false; readonly reason: PrototypeCommandError };

/** One row of the local public log. */
export interface PrototypeLogEntry {
  readonly turn: number;
  readonly seatId: PlayerId | null;
  readonly kind: 'move' | 'appearance' | 'result' | 'pickup';
  readonly mode: LoggedTransport;
  /** Set for an appearance or pickup; `null` for an ordinary move row. */
  readonly node: NodeId | null;
}

/** Terminal outcome. */
export interface PrototypeResult {
  readonly winner: 'agents' | 'fugitives';
  readonly reason: 'capture' | 'survived';
  readonly turn: number;
  readonly capturedBy: PlayerId | null;
}

/** The complete local prototype state. */
export interface PrototypeState {
  readonly seed: number;
  readonly turn: number;
  /** The configured length of this Yard. */
  readonly turnLimit: number;
  /** The configured appearance turns, sorted and unique. */
  readonly appearanceTurns: readonly number[];
  readonly phase: PrototypePhase;
  /** Fugitive first, then Agents. */
  readonly seats: readonly PrototypeSeat[];
  /** Public pickup stations for jobs, stored so later spawns are deterministic. */
  readonly jobPickups: readonly PrototypeJobPickup[];
  readonly jobs: readonly PrototypeJob[];
  /** The single job the Fugitive is carrying, or `null`. */
  readonly activeJobId: string | null;
  /** Pounds earned this Yard. */
  readonly cash: number;
  readonly jobsDelivered: number;
  /** The node the Agents currently believe the Fugitive is at. */
  readonly lastKnown: NodeId;
  /** The turn of the last appearance, or `null` before the first one. */
  readonly lastAppearanceTurn: number | null;
  /** A scheduled appearance is owed at the end of this Fugitive move. */
  readonly pendingAppearance: boolean;
  readonly log: readonly PrototypeLogEntry[];
  readonly result: PrototypeResult | null;
}
