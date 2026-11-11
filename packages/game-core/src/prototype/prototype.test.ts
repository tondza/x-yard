import { describe, expect, it } from 'vitest';

import { DEMO_BOARD } from '../demo-board';
import {
  applyFugitiveCommand,
  chooseAgentMove,
  chooseFugitiveMove,
  createPrototypeGame,
  legalMoves,
  resolveAgentPhase,
  revealAppearance,
} from './engine';
import type { PrototypeSeat, PrototypeState } from './types';

const STARTS = {
  fugitive: 's1',
  agents: ['s2', 's3', 's4', 's5'],
} as const;

function game(): PrototypeState {
  return createPrototypeGame(DEMO_BOARD, STARTS, 7);
}

function withSeats(state: PrototypeState, seats: readonly PrototypeSeat[]): PrototypeState {
  return { ...state, seats };
}

/** A tiny deterministic walk used to exercise the whole loop without a browser. */
function playOneTurn(state: PrototypeState): PrototypeState {
  if (state.phase !== 'fugitive') return state;
  const options = legalMoves(DEMO_BOARD, state, 'fugitive');
  const command =
    options.length === 0
      ? { kind: 'hold' as const }
      : {
          kind: 'move' as const,
          mode: options[0]?.mode ?? 'taxi',
          to: options[0]?.to ?? state.seats[0]?.node ?? 's1',
        };

  const applied = applyFugitiveCommand(DEMO_BOARD, state, command);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return state;
  const resolved = resolveAgentPhase(DEMO_BOARD, applied.state);
  expect(resolved.ok).toBe(true);
  return resolved.ok ? resolved.state : applied.state;
}

describe('prototype legal moves', () => {
  it('offers taxi and foot on every street edge, and nothing unaffordable', () => {
    const options = legalMoves(DEMO_BOARD, game(), 'fugitive');
    const taxi = options.filter((option) => option.mode === 'taxi').map((option) => option.to);
    const foot = options.filter((option) => option.mode === 'foot').map((option) => option.to);
    expect(taxi).toEqual(['s2', 's3', 's7', 's8']);
    expect(foot).toEqual(['s2', 's3', 's7', 's8']);
    expect(options.some((option) => option.mode === 'bus')).toBe(false);
  });

  it('offers no move when every purse and reserve is empty', () => {
    const state = game();
    const fugitive = state.seats[0] as PrototypeSeat;
    const broke: PrototypeSeat = {
      ...fugitive,
      tickets: { taxi: 0, bus: 0, underground: 0, special: 0 },
      footSteps: 0,
    };
    expect(legalMoves(DEMO_BOARD, withSeats(state, [broke, ...state.seats.slice(1)]), 'fugitive')).toEqual(
      [],
    );
  });

  it('rejects a move to a non-adjacent node as a value, not an exception', () => {
    const result = applyFugitiveCommand(DEMO_BOARD, game(), {
      kind: 'move',
      mode: 'taxi',
      to: 's6',
    });
    expect(result).toEqual({ ok: false, reason: 'illegal-move' });
  });
});

describe('prototype turn, appearance and capture', () => {
  it('applies a taxi move, spends one ticket and hands the turn to the Agents', () => {
    const result = applyFugitiveCommand(DEMO_BOARD, game(), {
      kind: 'move',
      mode: 'taxi',
      to: 's2',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('agents');
    expect(result.state.seats[0]?.node).toBe('s2');
    expect(result.state.seats[0]?.tickets.taxi).toBe(7);
    expect(result.state.log.at(-1)?.mode).toBe('taxi');
  });

  it('makes the Fugitive appear on turns 5, 10 and 15 before the Agents move', () => {
    const base = game();
    const state: PrototypeState = { ...base, turn: 5, pendingAppearance: false };
    const applied = applyFugitiveCommand(DEMO_BOARD, state, { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.state.pendingAppearance).toBe(true);

    const resolved = resolveAgentPhase(DEMO_BOARD, applied.state);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.lastAppearanceTurn).toBe(5);
    expect(resolved.state.log.some((entry) => entry.kind === 'appearance')).toBe(true);
  });

  it('returns no Agent moves for a Fugitive command', () => {
    const applied = applyFugitiveCommand(DEMO_BOARD, game(), { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.agentMoves).toEqual([]);
  });

  it('reports the Agent moves it applied, in resolution order, for one-at-a-time reveal', () => {
    const applied = applyFugitiveCommand(DEMO_BOARD, game(), { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const resolved = resolveAgentPhase(DEMO_BOARD, applied.state);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.agentMoves.length).toBeGreaterThan(0);
    expect(resolved.agentMoves.map((move) => move.seatId)).toEqual(
      applied.state.seats.filter((seat) => seat.role === 'agent').map((seat) => seat.id),
    );

    for (const move of resolved.agentMoves) {
      const before = applied.state.seats.find((seat) => seat.id === move.seatId);
      const after = resolved.state.seats.find((seat) => seat.id === move.seatId);
      expect(move.from, move.seatId).toBe(before?.node);
      expect(move.to, move.seatId).toBe(after?.node);
      expect(legalMoves(DEMO_BOARD, applied.state, move.seatId)).toContainEqual({
        mode: move.mode,
        to: move.to,
        });
    }
  });

  it('captures when an Agent ends the Agent phase on the Fugitive node', () => {
    const base = game();
    const seats = base.seats.map((seat) =>
      seat.id === 'agent-1' ? { ...seat, node: 's1' } : seat,
    );
    const state: PrototypeState = {
      ...base,
      seats,
      phase: 'agents',
      lastKnown: 's1',
      pendingAppearance: false,
    };

    const resolved = resolveAgentPhase(DEMO_BOARD, state);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.result).toEqual({
      winner: 'agents',
      reason: 'capture',
      turn: 1,
      capturedBy: 'agent-1',
    });
    expect(resolved.state.phase).toBe('result');
  });

  it('ends with a Fugitive survival after turn 16 without capture', () => {
    const base = game();
    const state: PrototypeState = {
      ...base,
      turn: 16,
      phase: 'agents',
      lastKnown: 's6',
      pendingAppearance: false,
    };
    const resolved = resolveAgentPhase(DEMO_BOARD, state);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.result?.winner).toBe('fugitives');
    expect(resolved.state.result?.reason).toBe('survived');
  });

  it('never lets an Agent choose an illegal move', () => {
    let state = game();
    let checkedAgents = 0;

    for (let turn = 0; turn < 8 && state.result === null; turn += 1) {
      const options = legalMoves(DEMO_BOARD, state, 'fugitive');
      const first = options[0];
      const applied = applyFugitiveCommand(
        DEMO_BOARD,
        state,
        first === undefined
          ? { kind: 'hold' }
          : { kind: 'move', mode: first.mode, to: first.to },
      );
      expect(applied.ok).toBe(true);
      if (!applied.ok) break;

      for (const agent of applied.state.seats.filter((seat) => seat.role === 'agent')) {
        const move = chooseAgentMove(DEMO_BOARD, applied.state, agent.id);
        if (move === null) continue;
        checkedAgents += 1;
        expect(legalMoves(DEMO_BOARD, applied.state, agent.id)).toContainEqual(move);
      }

      const resolved = resolveAgentPhase(DEMO_BOARD, applied.state);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) break;
      state = resolved.state;
    }

    expect(checkedAgents).toBeGreaterThan(0);
    expect(state.log.some((entry) => entry.kind === 'move')).toBe(true);
  });

  it('keeps exactly one Fugitive move row per turn', () => {
    let state = game();
    for (let turn = 0; turn < 4; turn += 1) state = playOneTurn(state);

    const moveRows = state.log.filter((entry) => entry.kind === 'move');
    const byTurn = new Map<number, number>();
    for (const row of moveRows) byTurn.set(row.turn, (byTurn.get(row.turn) ?? 0) + 1);
    for (const [turn, count] of byTurn) {
      expect(count, `turn ${turn}`).toBe(1);
    }
  });
});

describe('Agent Practice orders', () => {
  it('applies the human Agent move and still resolves the other Agents', () => {
    const applied = applyFugitiveCommand(DEMO_BOARD, game(), { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const option = legalMoves(DEMO_BOARD, applied.state, 'agent-1')[0];
    expect(option).toBeDefined();
    if (option === undefined) return;

    const resolved = resolveAgentPhase(DEMO_BOARD, applied.state, {
      moves: { 'agent-1': option },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const human = resolved.state.seats.find((seat) => seat.id === 'agent-1');
    expect(human?.node).toBe(option.to);
    expect(resolved.agentMoves[0]).toMatchObject({ seatId: 'agent-1', to: option.to });
    expect(resolved.agentMoves.length).toBe(4);
  });

  it('rejects an illegal or contradictory human Agent order without applying the phase', () => {
    const applied = applyFugitiveCommand(DEMO_BOARD, game(), { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(
      resolveAgentPhase(DEMO_BOARD, applied.state, {
        moves: { 'agent-1': { mode: 'taxi', to: 's6' } },
      }),
    ).toEqual({ ok: false, reason: 'illegal-move' });

    expect(
      resolveAgentPhase(DEMO_BOARD, applied.state, {
        moves: { 'agent-1': { mode: 'taxi', to: legalMoves(DEMO_BOARD, applied.state, 'agent-1')[0]?.to ?? 's2' } },
        holds: ['agent-1'],
      }),
    ).toEqual({ ok: false, reason: 'illegal-move' });

    expect(
      resolveAgentPhase(DEMO_BOARD, applied.state, {
        moves: { fugitive: { mode: 'taxi', to: 's2' } },
      }),
    ).toEqual({ ok: false, reason: 'no-such-seat' });
  });

  it('lets a human Agent hold while the bots still move', () => {
    const applied = applyFugitiveCommand(DEMO_BOARD, game(), { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const start = applied.state.seats.find((seat) => seat.id === 'agent-1')?.node;

    const resolved = resolveAgentPhase(DEMO_BOARD, applied.state, { holds: ['agent-1'] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.seats.find((seat) => seat.id === 'agent-1')?.node).toBe(start);
    expect(resolved.agentMoves.some((move) => move.seatId === 'agent-1')).toBe(false);
    expect(resolved.agentMoves.length).toBeGreaterThan(0);
  });

  it('reveals a scheduled appearance publicly before the Agent phase resolves', () => {
    const base: PrototypeState = { ...game(), turn: 5, pendingAppearance: false };
    const applied = applyFugitiveCommand(DEMO_BOARD, base, { kind: 'hold' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.state.pendingAppearance).toBe(true);

    const revealed = revealAppearance(applied.state);
    expect(revealed.ok).toBe(true);
    if (!revealed.ok) return;
    expect(revealed.state.pendingAppearance).toBe(false);
    expect(revealed.state.phase).toBe('agents');
    expect(revealed.state.lastAppearanceTurn).toBe(5);
    expect(revealed.state.lastKnown).toBe(
      revealed.state.seats.find((seat) => seat.role === 'fugitive')?.node,
    );
    expect(revealed.state.log.at(-1)?.kind).toBe('appearance');

    const resolved = resolveAgentPhase(DEMO_BOARD, revealed.state);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.log.filter((entry) => entry.kind === 'appearance')).toHaveLength(1);
  });
});

describe('bot Fugitive policy', () => {
  it('only returns a legal move or a hold, deterministically', () => {
    const state = game();
    const first = chooseFugitiveMove(DEMO_BOARD, state);
    const second = chooseFugitiveMove(DEMO_BOARD, state);
    expect(second).toEqual(first);
    if (first !== null) {
      expect(legalMoves(DEMO_BOARD, state, 'fugitive')).toContainEqual(first);
    }
  });
});

describe('prototype state is JSON-serializable and replayable', () => {
  it('survives a JSON round-trip', () => {
    const state = playOneTurn(game());
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('produces the same state for the same command sequence', () => {
    const first = playOneTurn(game());
    const second = playOneTurn(game());
    expect(second).toEqual(first);
  });
});
