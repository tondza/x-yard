/**
 * Wire-level contracts shared by the Fastify/Socket.io server and the React
 * client.
 *
 * This package describes *what travels over the wire*, never *what happens*:
 * all rules live in `@x-yard/game-core`. Where a concept already exists in the
 * engine, the type is imported rather than re-declared, so the wire cannot
 * silently drift from the rules.
 *
 * Dependency direction: `game-core` <- `shared-types` <- apps. `game-core` must
 * never import this package.
 *
 * Terminology follows GAME_VISION.md: rooms are **Yards** (§6), time advances in
 * **turns** (§2), and players are **Fugitives** or **Agents** (§1).
 *
 * @module @x-yard/shared-types
 */

import type {
  AgentSkill,
  DistrictId,
  Facility,
  Gadget,
  NodeClass,
  NodeId,
  PlayerId,
  Role,
  TransportMode,
  YardId,
  YardResult,
} from '@x-yard/game-core';

export type {
  AgentSkill,
  DistrictId,
  Facility,
  Gadget,
  NodeClass,
  NodeId,
  PlayerId,
  Role,
  TransportMode,
  YardId,
  YardResult,
};

/** Client-facing lifecycle of a Yard (distinct from the engine's turn `Phase`). */
export type YardLifecycle = 'lobby' | 'active' | 'finished';

/** A node as rendered by the client. */
export interface StationDto {
  readonly id: NodeId;
  readonly class: NodeClass;
  readonly district: DistrictId;
  /** Black Market / Safe House, drawn as map markers (§4). */
  readonly facilities: readonly Facility[];
  readonly x: number;
  readonly y: number;
}

/** A route between two nodes. Routes are bidirectional. */
export interface RouteDto {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly mode: TransportMode;
}

/** Read-only board description; sent once when a Yard starts. */
export interface BoardDto {
  readonly mapId: string;
  readonly world: { readonly width: number; readonly height: number };
  readonly stations: readonly StationDto[];
  readonly routes: readonly RouteDto[];
}

/** Public information about one seat. */
export interface SeatDto {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly role: Role;
  /** Current node, or `null` when hidden (always `null` for Fugitives). */
  readonly position: NodeId | null;
  readonly connected: boolean;
  /** True while this seat is an AI shadow decoy left by a logoff (§4). */
  readonly decoy: boolean;
}

/**
 * Remaining tickets, per mode.
 *
 * A Fugitive's inventory and position are projected out for Agents and
 * spectators inside `game-core`; the server never decides this itself.
 */
export interface TicketInventoryDto {
  readonly taxi: number;
  readonly bus: number;
  readonly underground: number;
  readonly special: number;
}

/** One row of the public ticket log — the Agents' deduction surface (§2). */
export interface TicketLogEntryDto {
  readonly turn: number;
  readonly fugitiveId: PlayerId;
  /** `'unknown'` when Counterfeit Identity concealed the mode (§5). */
  readonly mode: TransportMode | 'unknown';
}

/** A contraband run as shown to its owner (§4). */
export interface MissionDto {
  readonly id: string;
  readonly origin: NodeId;
  readonly destination: NodeId;
  readonly riskTier: 'light' | 'heavy' | 'arms';
  readonly payoutPoints: number;
}

/** Full client-facing view of a Yard. */
export interface YardStateDto {
  readonly yardId: YardId;
  readonly lifecycle: YardLifecycle;
  readonly turn: number;
  readonly turnLimit: number;
  readonly turnPlayerId: PlayerId | null;
  readonly seats: readonly SeatDto[];
  readonly ticketLog: readonly TicketLogEntryDto[];
  readonly result: YardResult | null;
}

/* ------------------------------------------------------------------ *
 * Client -> server
 * ------------------------------------------------------------------ */

/** Claim a seat in a Yard lobby. */
export interface JoinYardMessage {
  readonly type: 'join-yard';
  readonly yardId: YardId;
  readonly displayName: string;
  /** Requested faction; the server may rebalance. */
  readonly prefer: Role;
}

/** Take a move from the current node to a directly connected one. */
export interface SubmitMoveMessage {
  readonly type: 'submit-move';
  readonly to: NodeId;
  readonly mode: TransportMode;
}

/** Spend a Fugitive gadget (§5). */
export interface UseGadgetMessage {
  readonly type: 'use-gadget';
  readonly gadget: Gadget;
  /** Required target for Alleyway Sprint. */
  readonly to: NodeId | null;
}

/** Activate an Agent skill (§5). */
export interface UseSkillMessage {
  readonly type: 'use-skill';
  readonly skill: AgentSkill;
  /** Required target for Targeted Roadblock; ignored by Sensor Sweep. */
  readonly target: NodeId | null;
}

/** Perform Safe House Extraction to log off safely (§4). */
export interface ExtractMessage {
  readonly type: 'extract';
}

/** Accept an available contraband run (§4). */
export interface AcceptMissionMessage {
  readonly type: 'accept-mission';
  readonly missionId: string;
}

/** Ask the server to resend everything after a sequence number (reconnect). */
export interface ResumeMessage {
  readonly type: 'resume';
  readonly yardId: YardId;
  readonly lastEventSeq: number;
}

/** Every message a client may send. */
export type ClientMessage =
  | JoinYardMessage
  | SubmitMoveMessage
  | UseGadgetMessage
  | UseSkillMessage
  | ExtractMessage
  | AcceptMissionMessage
  | ResumeMessage;

/* ------------------------------------------------------------------ *
 * Server -> client
 * ------------------------------------------------------------------ */

/** Initial snapshot after joining. */
export interface YardStateSyncMessage {
  readonly type: 'yard-state-sync';
  readonly board: BoardDto;
  readonly state: YardStateDto;
  readonly you: PlayerId;
}

/** Incremental update after any accepted action. */
export interface YardStatePatchMessage {
  readonly type: 'yard-state-patch';
  readonly state: YardStateDto;
  /** Human-readable log lines produced by this transition. */
  readonly log: readonly string[];
}

/**
 * A Reveal Pulse (§2): every Fugitive's true node becomes public for one turn.
 * `position: null` marks a pulse falsified by a Decoy Ping (§5).
 */
export interface RevealPulseMessage {
  readonly type: 'reveal-pulse';
  readonly turn: number;
  readonly fugitiveId: PlayerId;
  readonly position: NodeId | null;
  readonly decoy: boolean;
}

/** An Agent arrested a Fugitive by occupying their node (§2). */
export interface CaptureMessage {
  readonly type: 'capture';
  readonly turn: number;
  readonly fugitiveId: PlayerId;
  readonly agentId: PlayerId;
  readonly node: NodeId;
}

/** The Yard ended. */
export interface YardEndedMessage {
  readonly type: 'yard-ended';
  readonly result: YardResult;
  readonly state: YardStateDto;
}

/** The server rejected a client message. */
export interface ErrorMessage {
  readonly type: 'error';
  readonly code: ErrorCode;
  readonly message: string;
}

/** Machine-readable rejection reasons. */
export type ErrorCode =
  | 'not-your-turn'
  | 'illegal-move'
  | 'no_ticket'
  | 'gadget_unavailable'
  | 'skill_unavailable'
  | 'no_safe_house'
  | 'unknown-yard'
  | 'yard-full'
  | 'internal';

/** Every message the server may send. */
export type ServerMessage =
  | YardStateSyncMessage
  | YardStatePatchMessage
  | RevealPulseMessage
  | CaptureMessage
  | YardEndedMessage
  | ErrorMessage;

/** Socket.io event names, kept in one place so the two apps cannot drift. */
export const SOCKET_EVENTS = {
  clientMessage: 'client:message',
  serverMessage: 'server:message',
} as const;

const CLIENT_MESSAGE_TYPES: readonly ClientMessage['type'][] = [
  'join-yard',
  'submit-move',
  'use-gadget',
  'use-skill',
  'extract',
  'accept-mission',
  'resume',
];

/** Type-narrowing helper usable on both sides of the wire. */
export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return CLIENT_MESSAGE_TYPES.includes(type as ClientMessage['type']);
}
