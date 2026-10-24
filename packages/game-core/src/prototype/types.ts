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
  readonly scooterCharges: number;
}

/** A legal move for a seat. `via` is the scooter's intermediate node. */
export interface PrototypeMoveOption {
  readonly mode: MobilityOption;
  readonly to: NodeId;
  readonly via: NodeId | null;
}

/** A command from the human Fugitive. */
export type PrototypeCommand =
  | {
      readonly kind: 'move';
      readonly mode: MobilityOption;
      readonly to: NodeId;
      readonly via: NodeId | null;
    }
  | { readonly kind: 'hold' };

/** Why a command was rejected. Ordinary conditions are values, not throws. */
export type PrototypeCommandError =
  | 'not-fugitive-phase'
  | 'not-agent-phase'
  | 'game-over'
  | 'no-such-seat'
  | 'illegal-move';

/** Result of a Fugitive command or an Agent phase. */
export type PrototypeCommandResult =
  | { readonly ok: true; readonly state: PrototypeState; readonly move: PrototypeMoveOption | null }
  | { readonly ok: false; readonly reason: PrototypeCommandError };

/** One row of the local public log. */
export interface PrototypeLogEntry {
  readonly turn: number;
  readonly seatId: PlayerId | null;
  readonly kind: 'move' | 'pulse' | 'reveal' | 'result';
  readonly mode: LoggedTransport;
  /** Set for a pulse or a scooter reveal; `null` for an ordinary move row. */
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
  readonly phase: PrototypePhase;
  /** Fugitive first, then Agents. */
  readonly seats: readonly PrototypeSeat[];
  /** The node the Agents currently believe the Fugitive is at. */
  readonly lastKnown: NodeId;
  readonly lastPulseTurn: number | null;
  /** A scheduled pulse is owed at the end of this Fugitive move. */
  readonly pendingPulse: boolean;
  readonly log: readonly PrototypeLogEntry[];
  readonly result: PrototypeResult | null;
}
