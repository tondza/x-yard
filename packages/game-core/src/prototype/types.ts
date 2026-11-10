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
  readonly kind: 'move' | 'appearance' | 'result';
  readonly mode: LoggedTransport;
  /** Set for an appearance; `null` for an ordinary move row. */
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
  /** The turn of the last appearance, or `null` before the first one. */
  readonly lastAppearanceTurn: number | null;
  /** A scheduled appearance is owed at the end of this Fugitive move. */
  readonly pendingAppearance: boolean;
  readonly log: readonly PrototypeLogEntry[];
  readonly result: PrototypeResult | null;
}
