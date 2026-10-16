import { describe, expect, it } from 'vitest';

import {
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
import {
  PROVISIONAL_AGENT_STARTING_TICKETS,
  PROVISIONAL_FUGITIVE_STARTING_TICKETS,
  type TicketLogEntry,
} from './types';

describe('createTicketBag', () => {
  it('defaults unspecified modes to zero', () => {
    expect(createTicketBag()).toEqual({ taxi: 0, bus: 0, underground: 0, special: 0 });
  });

  it('keeps explicit counts', () => {
    expect(createTicketBag({ taxi: 3, special: 1 })).toEqual({
      taxi: 3,
      bus: 0,
      underground: 0,
      special: 1,
    });
  });

  it('rejects negative and fractional counts', () => {
    expect(() => createTicketBag({ taxi: -1 })).toThrow(RangeError);
    expect(() => createTicketBag({ bus: 1.5 })).toThrow(RangeError);
  });
});

describe('spend', () => {
  it('decrements a single ticket', () => {
    const result = spend(createTicketBag({ taxi: 2 }), 'taxi');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ticketCount(result.bag, 'taxi')).toBe(1);
  });

  it('never mutates the input bag', () => {
    const before = createTicketBag({ taxi: 2 });
    spend(before, 'taxi');
    expect(ticketCount(before, 'taxi')).toBe(2);
  });

  it('rejects a spend with no tickets left, using the wire code no_ticket', () => {
    expect(spend(createTicketBag(), 'bus')).toEqual({
      ok: false,
      reason: 'no_ticket',
      mode: 'bus',
      available: 0,
    });
  });

  it('treats the special tier as an ordinary payable mode', () => {
    const result = spend(createTicketBag({ special: 1 }), 'special');
    expect(result.ok).toBe(true);
  });
});

describe('totals and helpers', () => {
  it('sums across every mode', () => {
    expect(totalTickets(createTicketBag({ taxi: 1, bus: 2, underground: 3, special: 4 }))).toBe(10);
  });

  it('reports emptiness only when every mode is exhausted', () => {
    expect(isEmpty(createTicketBag({ special: 1 }))).toBe(false);
    expect(isEmpty(createTicketBag())).toBe(true);
  });

  it('lists only non-empty modes, in a stable order', () => {
    expect(affordableModes(createTicketBag({ taxi: 1, special: 2 }))).toEqual(['taxi', 'special']);
  });

  it('reverses a spend', () => {
    const spent = spend(createTicketBag({ taxi: 1 }), 'taxi');
    expect(spent.ok).toBe(true);
    if (!spent.ok) return;
    expect(ticketCount(refund(spent.bag, 'taxi'), 'taxi')).toBe(1);
  });

  it('returns the PROVISIONAL starting bag for each faction', () => {
    // PROVISIONAL: §3 states no ticket counts (GAME_VISION.appendix.md Q1).
    expect(startingTicketsFor('fugitive')).toEqual(PROVISIONAL_FUGITIVE_STARTING_TICKETS);
    expect(startingTicketsFor('agent')).toEqual(PROVISIONAL_AGENT_STARTING_TICKETS);
  });

  it('gives Agents no special-tier tickets by default', () => {
    expect(startingTicketsFor('agent').special).toBe(0);
  });
});

describe('applyTicketDelta', () => {
  it('adds only the modes the delta mentions', () => {
    const bag = createTicketBag({ taxi: 1, bus: 1, underground: 1, special: 1 });
    expect(applyTicketDelta(bag, { taxi: 2, bus: 3 })).toEqual({
      taxi: 3,
      bus: 4,
      underground: 1,
      special: 1,
    });
  });

  it('does not mutate the input bag', () => {
    const bag = createTicketBag({ taxi: 1 });
    applyTicketDelta(bag, { taxi: 5 });
    expect(ticketCount(bag, 'taxi')).toBe(1);
  });
});

/**
 * The ticket log is the Agents' entire information channel between Reveal
 * Pulses (§2), so the two gadgets that attack it (§5) are tested directly.
 */
describe('ticketLogEntry', () => {
  it('records the mode used for an ordinary move', () => {
    expect(ticketLogEntry(4, 'f1', 'bus')).toEqual({ turn: 4, fugitiveId: 'f1', mode: 'bus' });
  });

  it('records Counterfeit Identity as unknown transport', () => {
    expect(ticketLogEntry(4, 'f1', 'underground', 'counterfeit-identity')).toEqual({
      turn: 4,
      fugitiveId: 'f1',
      mode: 'unknown',
    });
  });

  it('leaves no trail at all for Alleyway Sprint', () => {
    expect(ticketLogEntry(4, 'f1', 'taxi', 'alleyway-sprint')).toBeNull();
  });
});

describe('appendTicketLog', () => {
  it('appends a row without mutating the original log', () => {
    const log: readonly TicketLogEntry[] = [];
    const entry = ticketLogEntry(1, 'f1', 'taxi');
    const next = appendTicketLog(log, entry);
    expect(log).toHaveLength(0);
    expect(next).toHaveLength(1);
  });

  it('returns the same log when a move leaves no trail', () => {
    const log = appendTicketLog([], ticketLogEntry(1, 'f1', 'taxi'));
    expect(appendTicketLog(log, null)).toBe(log);
  });
});

describe('logForFugitive', () => {
  it('selects only the requested Fugitive, preserving order', () => {
    let log: readonly TicketLogEntry[] = [];
    log = appendTicketLog(log, ticketLogEntry(1, 'f1', 'taxi'));
    log = appendTicketLog(log, ticketLogEntry(1, 'f2', 'bus'));
    log = appendTicketLog(log, ticketLogEntry(2, 'f1', 'underground'));

    expect(logForFugitive(log, 'f1').map((entry) => entry.mode)).toEqual(['taxi', 'underground']);
    expect(logForFugitive(log, 'nobody')).toEqual([]);
  });
});
