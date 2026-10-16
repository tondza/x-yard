/**
 * Ticket economy and the public ticket log.
 *
 * Tickets are both the movement price (§3) and the Agents' only information
 * channel between Reveal Pulses (§2). Two Fugitive gadgets attack that channel
 * (§5), so the log is modelled here rather than in the wire layer:
 *
 *   - **Counterfeit Identity** — the log records `'unknown'` instead of the mode.
 *   - **Alleyway Sprint** — nothing is recorded at all: no ticket, no trail.
 *
 * Every function is pure. Ordinary game conditions — an empty pocket — return a
 * {@link SpendResult} rather than throwing, because "you cannot afford that" is a
 * normal command rejection.
 *
 * @module @x-yard/game-core/tickets
 */

import {
  PROVISIONAL_AGENT_STARTING_TICKETS,
  PROVISIONAL_FUGITIVE_STARTING_TICKETS,
  TRANSPORT_MODES,
  type LoggedTransport,
  type PlayerId,
  type Role,
  type TicketBag,
  type TicketBagDelta,
  type TicketLogEntry,
  type TransportMode,
} from './types';

/** How a Fugitive tried to conceal a movement (§5). */
export type Concealment = 'none' | 'counterfeit-identity' | 'alleyway-sprint';

/** A spend that could not be paid for. */
export interface SpendRejected {
  readonly ok: false;
  readonly reason: 'no_ticket';
  readonly mode: TransportMode;
  /** How many the bag actually held. */
  readonly available: number;
}

/** A spend that succeeded; `bag` is a new object. */
export interface SpendAccepted {
  readonly ok: true;
  readonly mode: TransportMode;
  readonly bag: TicketBag;
}

/** Outcome of attempting to spend one ticket. */
export type SpendResult = SpendAccepted | SpendRejected;

/**
 * Build a ticket bag, defaulting every unspecified mode to zero.
 *
 * @throws RangeError on a negative or fractional count
 */
export function createTicketBag(counts: Partial<Record<TransportMode, number>> = {}): TicketBag {
  const read = (mode: TransportMode): number => {
    const value = counts[mode] ?? 0;
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(
        `ticket count for ${mode} must be a non-negative integer, received ${String(value)}`,
      );
    }
    return value;
  };

  return {
    taxi: read('taxi'),
    bus: read('bus'),
    underground: read('underground'),
    special: read('special'),
  };
}

/** How many of one mode a bag holds. */
export function ticketCount(bag: TicketBag, mode: TransportMode): number {
  return bag[mode];
}

/** Every ticket held, across all modes. */
export function totalTickets(bag: TicketBag): number {
  return TRANSPORT_MODES.reduce((sum, mode) => sum + bag[mode], 0);
}

/** Whether the bag is empty in every mode. */
export function isEmpty(bag: TicketBag): boolean {
  return totalTickets(bag) === 0;
}

/** Every mode the player can currently pay for. */
export function affordableModes(bag: TicketBag): readonly TransportMode[] {
  return TRANSPORT_MODES.filter((mode) => bag[mode] > 0);
}

/**
 * Spend one ticket, returning a new bag.
 *
 * Never mutates `bag` and never throws on an empty pocket.
 */
export function spend(bag: TicketBag, mode: TransportMode): SpendResult {
  const available = bag[mode];
  if (available <= 0) {
    return { ok: false, reason: 'no_ticket', mode, available };
  }
  return { ok: true, mode, bag: { ...bag, [mode]: available - 1 } };
}

/** Give one ticket back, used to undo a tentative deduction. */
export function refund(bag: TicketBag, mode: TransportMode): TicketBag {
  return { ...bag, [mode]: bag[mode] + 1 };
}

/** Add a partial delta to a bag, ignoring modes the delta omits. */
export function applyTicketDelta(bag: TicketBag, delta: TicketBagDelta): TicketBag {
  const next: Record<TransportMode, number> = { ...bag };
  for (const mode of TRANSPORT_MODES) {
    const amount = delta[mode];
    if (amount !== undefined) next[mode] += amount;
  }
  return next;
}

/**
 * The starting bag for a role.
 *
 * PROVISIONAL (GAME_VISION.appendix.md Q1): §3 states no ticket counts.
 */
export function startingTicketsFor(role: Role): TicketBag {
  return role === 'fugitive'
    ? PROVISIONAL_FUGITIVE_STARTING_TICKETS
    : PROVISIONAL_AGENT_STARTING_TICKETS;
}

/**
 * The ticket-log row a movement produces, or `null` when it leaves no trail.
 *
 * This is the single place that encodes the two log-attacking gadgets, so a
 * detector and a server cannot disagree about what Agents are allowed to see.
 *
 * @returns `null` for Alleyway Sprint; otherwise the row to append
 */
export function ticketLogEntry(
  turn: number,
  fugitiveId: PlayerId,
  mode: TransportMode,
  concealment: Concealment = 'none',
): TicketLogEntry | null {
  if (concealment === 'alleyway-sprint') {
    // §5: no ticket spent and no ticket trail left.
    return null;
  }

  const logged: LoggedTransport = concealment === 'counterfeit-identity' ? 'unknown' : mode;
  return { turn, fugitiveId, mode: logged };
}

/** Append a row to a ticket log, returning a new array. */
export function appendTicketLog(
  log: readonly TicketLogEntry[],
  entry: TicketLogEntry | null,
): readonly TicketLogEntry[] {
  return entry === null ? log : [...log, entry];
}

/** Every log row attributable to one Fugitive, in order. */
export function logForFugitive(
  log: readonly TicketLogEntry[],
  fugitiveId: PlayerId,
): readonly TicketLogEntry[] {
  return log.filter((entry) => entry.fugitiveId === fugitiveId);
}
