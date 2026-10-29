import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  APPEARANCE_TURNS,
  applyFugitiveCommand,
  createPrototypeGame,
  legalMoves,
  recentLog,
  resolveAgentPhase,
} from '@x-yard/game-core';
import type {
  MobilityOption,
  PrototypeCommand,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypeSeat,
  PrototypeState,
} from '@x-yard/game-core';
import type { GeneratedMap, NodeId } from '@x-yard/map-generator';

import mapJson from '../../../../maps/prototype-96-seed-42.json';
import { MapStage } from './MapStage';
import {
  HOLD_PAUSE_MS,
  MOVE_STYLE,
  REVEAL_HOLD_MS,
  STEP_GAP_MS,
  STEP_LEAD_MS,
  buildAgentSteps,
  buildFugitiveStep,
  stepTrail,
  type MoveStep,
  type PhaseBanner,
  type Trail,
} from './motion';
import './prototype.css';

const MAP = mapJson as unknown as GeneratedMap;

const MODES: readonly { readonly mode: MobilityOption; readonly label: string }[] = [
  { mode: 'taxi', label: 'Taxi' },
  { mode: 'bus', label: 'Bus' },
  { mode: 'underground', label: 'Metro' },
  { mode: 'special', label: 'Special' },
  { mode: 'foot', label: 'Foot' },
  { mode: 'scooter', label: 'Scooter' },
];

function initialGame(): PrototypeState {
  return createPrototypeGame(MAP.graph, MAP.starts, MAP.seed);
}

function nodeMap(state: PrototypeState): Readonly<Record<string, NodeId>> {
  const nodes: Record<string, NodeId> = {};
  for (const seat of state.seats) nodes[seat.id] = seat.node;
  return nodes;
}

function countFor(state: PrototypeState, mode: MobilityOption): number {
  const seat = state.seats[0];
  if (seat === undefined) return 0;
  if (mode === 'foot') return seat.footSteps;
  if (mode === 'scooter') return seat.scooterCharges;
  return seat.tickets[mode];
}

function logRow(entry: PrototypeLogEntry): string {
  if (entry.kind === 'appearance') return `T${entry.turn} · APPEARANCE · ${entry.node ?? '?'}`;
  if (entry.kind === 'reveal') return `T${entry.turn} · SCOOTER REVEAL · ${entry.node ?? '?'}`;
  if (entry.kind === 'result') return `T${entry.turn} · YARD OVER`;
  return `T${entry.turn} · ${entry.mode.toUpperCase()}`;
}

/** The 96-station prototype, now with sequential playback and a camera. */
export default function Prototype(): React.JSX.Element {
  const [game, setGame] = useState<PrototypeState>(initialGame);
  const [selectedMode, setSelectedMode] = useState<MobilityOption>('taxi');
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<PhaseBanner | null>(null);
  const [activeStep, setActiveStep] = useState<MoveStep | null>(null);
  const [trails, setTrails] = useState<readonly Trail[]>([]);
  const [seatNodes, setSeatNodes] = useState<Readonly<Record<string, NodeId>>>({});
  const [appearanceNode, setAppearanceNode] = useState<NodeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedStation, setSelectedStation] = useState<NodeId | null>(null);

  const runIdRef = useRef(0);
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const finalRef = useRef<PrototypeState | null>(null);
  const allStepsRef = useRef<readonly MoveStep[]>([]);

  // The map must not advertise the next move while a turn is being revealed.
  const legal = useMemo(
    () => (pending || game.phase !== 'fugitive' ? [] : legalMoves(MAP.graph, game, 'fugitive')),
    [game, pending],
  );
  const byMode = useMemo(() => {
    const map = new Map<MobilityOption, readonly PrototypeMoveOption[]>();
    for (const option of legal) {
      const current = map.get(option.mode) ?? [];
      map.set(option.mode, [...current, option]);
    }
    return map;
  }, [legal]);

  const displaySeats = useMemo<readonly PrototypeSeat[]>(
    () =>
      game.seats.map((seat) => {
        const override = seatNodes[seat.id];
        return override === undefined ? seat : { ...seat, node: override };
      }),
    [game.seats, seatNodes],
  );

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      clearTimer();
    };
  }, [clearTimer]);

  useEffect(() => {
    if (pending || game.result !== null || game.phase !== 'fugitive') return;
    if (legal.some((option) => option.mode === selectedMode)) return;
    const first = legal[0]?.mode;
    if (first !== undefined) setSelectedMode(first);
  }, [game, legal, pending, selectedMode]);

  const alive = (runId: number): boolean => runIdRef.current === runId;

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const id = window.setTimeout(() => {
        // A skipped timeline and the next turn can overlap; only the timer that
        // is still current may clear the slot.
        if (timerRef.current === id) timerRef.current = null;
        resolve();
      }, ms);
      timerRef.current = id;
    });

  const commitStep = useCallback((step: MoveStep): void => {
    setSeatNodes((previous) => ({ ...previous, [step.seatId]: step.to }));
  }, []);

  const skipPlayback = useCallback((): void => {
    const final = finalRef.current;
    if (final === null) return;

    // Let the pending reveal wake up and see a stale run id; no timer is cleared
    // here because the suspended timeline must be able to unwind.
    runIdRef.current += 1;
    busyRef.current = false;
    setActiveStep(null);
    setAppearanceNode(null);
    setBanner(null);
    setTrails(allStepsRef.current.map(stepTrail));
    setSeatNodes(nodeMap(final));
    setGame(final);
    setPending(false);
  }, []);

  /**
   * Reveal a turn: the Fugitive's real route first, then any reveal, then each
   * Agent in the order the engine resolved them. The engine state itself is
   * already final — this is a presentation timeline, and it is skippable.
   */
  const runTurn = async (
    runId: number,
    applied: Extract<ReturnType<typeof applyFugitiveCommand>, { ok: true }>,
    resolved: Extract<ReturnType<typeof resolveAgentPhase>, { ok: true }>,
    fugitiveStep: MoveStep | null,
    agentSteps: readonly MoveStep[],
  ): Promise<void> => {
    if (fugitiveStep !== null) {
      setBanner({ kind: 'fugitive', step: fugitiveStep });
      setActiveStep(fugitiveStep);
      await sleep(STEP_LEAD_MS + fugitiveStep.duration);
      if (!alive(runId)) return;
      commitStep(fugitiveStep);
      setTrails((previous) => [...previous, stepTrail(fugitiveStep)]);
      await sleep(STEP_GAP_MS);
      if (!alive(runId)) return;
    } else {
      setBanner({ kind: 'hold' });
      await sleep(HOLD_PAUSE_MS);
      if (!alive(runId)) return;
    }

    // From here the tickets and the phase are committed; only positions animate.
    setGame(applied.state);

    const reveal = applied.state.log
      .slice(game.log.length)
      .find((entry) => entry.kind === 'reveal');
    const fugitiveNode =
      applied.state.seats.find((seat) => seat.role === 'fugitive')?.node ?? applied.state.lastKnown;

    if (applied.state.pendingAppearance) {
      setAppearanceNode(fugitiveNode);
      setBanner({ kind: 'reveal', node: fugitiveNode, scooter: false });
      await sleep(REVEAL_HOLD_MS);
      if (!alive(runId)) return;
      setAppearanceNode(null);
    } else if (reveal !== undefined && reveal.node !== null) {
      setAppearanceNode(reveal.node);
      setBanner({ kind: 'reveal', node: reveal.node, scooter: true });
      await sleep(REVEAL_HOLD_MS);
      if (!alive(runId)) return;
      setAppearanceNode(null);
    }

    for (let index = 0; index < agentSteps.length; index += 1) {
      const step = agentSteps[index];
      if (step === undefined) continue;
      setBanner({ kind: 'agents', step, index, total: agentSteps.length });
      setActiveStep(step);
      await sleep(STEP_LEAD_MS + step.duration);
      if (!alive(runId)) return;
      commitStep(step);
      setTrails((previous) => [...previous, stepTrail(step)]);
      await sleep(STEP_GAP_MS);
      if (!alive(runId)) return;
    }

    setActiveStep(null);
    setAppearanceNode(null);
    setBanner(null);
    setSeatNodes(nodeMap(resolved.state));
    setGame(resolved.state);
    setPending(false);
    busyRef.current = false;
  };

  const applyCommand = useCallback(
    (command: PrototypeCommand): void => {
      if (busyRef.current || game.result !== null) return;
      const applied = applyFugitiveCommand(MAP.graph, game, command);
      if (!applied.ok) {
        setError(applied.reason);
        return;
      }

      const resolved = resolveAgentPhase(MAP.graph, applied.state);
      if (!resolved.ok) {
        setError(resolved.reason);
        return;
      }

      setError(null);
      busyRef.current = true;
      finalRef.current = resolved.state;
      runIdRef.current += 1;
      const runId = runIdRef.current;

      const fugitiveStep = buildFugitiveStep(MAP.graph, game, applied.state, applied.move);
      const agentSteps = buildAgentSteps(MAP.graph, applied.state, resolved.agentMoves);
      allStepsRef.current = fugitiveStep === null ? agentSteps : [fugitiveStep, ...agentSteps];

      setSeatNodes(nodeMap(game));
      setTrails([]);
      setAppearanceNode(null);
      setActiveStep(null);
      setSelectedStation(null);
      setPending(true);

      void runTurn(runId, applied, resolved, fugitiveStep, agentSteps);
    },
    [game],
  );

  const handleMove = useCallback(
    (option: PrototypeMoveOption): void => {
      applyCommand({ kind: 'move', mode: option.mode, to: option.to, via: option.via });
    },
    [applyCommand],
  );

  const handleHold = useCallback((): void => {
    applyCommand({ kind: 'hold' });
  }, [applyCommand]);

  const restart = useCallback((): void => {
    runIdRef.current += 1;
    busyRef.current = false;
    finalRef.current = null;
    allStepsRef.current = [];
    setPending(false);
    setActiveStep(null);
    setAppearanceNode(null);
    setTrails([]);
    setSeatNodes({});
    setBanner(null);
    setError(null);
    setSelectedMode('taxi');
    setExpanded(false);
    setSelectedStation(null);
    setGame(initialGame());
  }, []);

  const toggleExpanded = useCallback((): void => {
    setExpanded((value) => !value);
  }, []);

  const inspectStation = useCallback(
    (node: NodeId): void => {
      if (pending) return;
      setSelectedStation((current) => (current === node ? null : node));
    },
    [pending],
  );

  const closeStation = useCallback((): void => {
    setSelectedStation(null);
  }, []);

  useEffect(() => {
    const scope = window as unknown as {
      __XYARD_PROTOTYPE__?: {
        state: PrototypeState;
        seats: readonly PrototypeSeat[];
        legal: readonly PrototypeMoveOption[];
        pending: boolean;
        activeStep: { seatId: string; from: string; to: string; mode: string } | null;
        trails: number;
        expanded: boolean;
        selectedStation: NodeId | null;
        lastAppearanceTurn: number | null;
        lastKnown: NodeId;
        move: (option: PrototypeMoveOption) => void;
        hold: () => void;
        skip: () => void;
        restart: () => void;
        setExpanded: (value: boolean) => void;
        inspectStation: (node: NodeId) => void;
      };
    };
    scope.__XYARD_PROTOTYPE__ = {
      state: game,
      seats: displaySeats,
      legal,
      pending,
      activeStep:
        activeStep === null
          ? null
          : {
              seatId: activeStep.seatId,
              from: activeStep.from,
              to: activeStep.to,
              mode: activeStep.mode,
            },
      trails: trails.length,
      expanded,
      selectedStation,
      lastAppearanceTurn: game.lastAppearanceTurn,
      lastKnown: game.lastKnown,
      move: handleMove,
      hold: handleHold,
      skip: skipPlayback,
      restart,
      setExpanded,
      inspectStation,
    };
    return () => {
      delete scope.__XYARD_PROTOTYPE__;
    };
  }, [
    activeStep,
    displaySeats,
    expanded,
    game,
    handleHold,
    handleMove,
    inspectStation,
    legal,
    pending,
    restart,
    selectedStation,
    skipPlayback,
    trails.length,
  ]);

  const agents = displaySeats.slice(1);
  // The Agents' last-known node, shown as a ghost once it is no longer where the
  // real Fugitive is standing. Before the first appearance there is nothing to show.
  const ghostNode =
    game.lastAppearanceTurn !== null && game.lastKnown !== displaySeats[0]?.node
      ? game.lastKnown
      : null;
  const logs = [...recentLog(game, 9)].reverse();
  const selectedOptions = byMode.get(selectedMode) ?? [];
  const showResult = game.result !== null && !pending;

  return (
    <div className={`proto${expanded ? ' map-expanded' : ''}`}>
      <header className="proto-header">
        <div className="proto-brand">
          <span className="proto-eyebrow">X-YARD · 96-STATION PROTOTYPE</span>
          <strong>Cathedral Quarter</strong>
        </div>

        <div className="proto-turn">
          <span>TURN</span>
          <b>{String(game.turn).padStart(2, '0')}</b>
          <span>/ 16</span>
        </div>

        <div className="proto-appearances">
          <span className="appearance-label">APPEARANCES</span>
          {APPEARANCE_TURNS.map((turn) => (
            <span
              key={turn}
              className={`appearance-chip${game.turn === turn ? ' current' : ''}${game.turn > turn ? ' passed' : ''}`}
            >
              {turn}
            </span>
          ))}
        </div>

        <div className="proto-meta">
          <span>seed {game.seed}</span>
          <span>{MAP.stats.nodeCount} stations</span>
        </div>

        <button className="proto-restart" type="button" onClick={restart}>
          Restart
        </button>
      </header>

      <main className="proto-body">
        <MapStage
          map={MAP}
          seats={displaySeats}
          turn={game.turn}
          selectedMode={selectedMode}
          legal={legal}
          onMove={handleMove}
          onInspectStation={inspectStation}
          appearanceNode={appearanceNode}
          activeStep={activeStep}
          trails={trails}
          banner={banner}
          pending={pending}
          onSkip={skipPlayback}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          selectedStation={selectedStation}
          ghostNode={ghostNode}
          onCloseStation={closeStation}
        />

        <aside className="proto-side">
          <section className="side-section kit-section">
            <div className="side-heading">
              <span>Fugitive kit</span>
              <span className="side-note">VULTURE · YOU</span>
            </div>

            <div className="mode-grid">
              {MODES.map(({ mode, label }) => {
                const count = countFor(game, mode);
                const options = byMode.get(mode) ?? [];
                const disabled = pending || game.result !== null || count <= 0 || options.length === 0;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`mode-tile${selectedMode === mode ? ' selected' : ''}${options.length > 0 ? ' legal' : ''}`}
                    style={{ '--mode-colour': MOVE_STYLE[mode].colour } as React.CSSProperties}
                    disabled={disabled}
                    onClick={() => setSelectedMode(mode)}
                  >
                    <span className="mode-name">{label}</span>
                    <span className="mode-count">{count}</span>
                    <span className="mode-legal">
                      {pending ? 'wait' : options.length > 0 ? `${options.length} legal` : 'no line'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="now-line">
              {pending
                ? 'Resolving the turn — watch each move, or skip.'
                : selectedOptions.length > 0
                  ? `${MODES.find((entry) => entry.mode === selectedMode)?.label} → ${selectedOptions
                      .map((option) => option.to)
                      .join(' · ')}`
                  : 'No legal move in this mode.'}
            </p>

            <button
              className="hold-button"
              type="button"
              onClick={handleHold}
              disabled={pending || game.result !== null}
            >
              {pending ? 'Resolving turn…' : 'Hold position'}
            </button>

            {error !== null && <p className="proto-error">{error}</p>}
          </section>

          <section className="side-section">
            <div className="side-heading">
              <span>Public log</span>
              <span className="side-note">MODE ONLY · DESTINATION HIDDEN</span>
            </div>
            <div className="log-list">
              {logs.map((entry, index) => (
                <div key={`${entry.turn}-${entry.kind}-${index}`} className={`log-row kind-${entry.kind}`}>
                  {logRow(entry)}
                </div>
              ))}
            </div>
          </section>

          <section className="side-section">
            <div className="side-heading">
              <span>Agents</span>
              <span className="side-note">{agents.length} IN THE QUARTER</span>
            </div>
            <div className="agent-list">
              {agents.map((agent, index) => (
                <div
                  key={agent.id}
                  className={`agent-row${activeStep?.seatId === agent.id ? ' moving' : ''}`}
                >
                  <span className="agent-dot" />
                  <span>{agent.name}</span>
                  <b>A{index + 1}</b>
                  <span className="agent-node">{agent.node}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="side-section quiet">
            <div className="side-heading">
              <span>Rules reminder</span>
            </div>
            <p>
              You move first. The Fugitive appears on 5, 10 and 15, showing the exact
              node to the Agents before they move. A scooter move shows it immediately.
              Survive to turn 16.
            </p>
          </section>
        </aside>
      </main>

      {showResult && (
        <div className="result-overlay">
          <div className="result-card">
            <span className="result-kicker">
              {game.result?.winner === 'agents' ? 'CAPTURED' : 'SURVIVED'}
            </span>
            <h1>
              {game.result?.winner === 'agents' ? 'The Agents win' : 'The Fugitive survives'}
            </h1>
            <p>
              {game.result?.reason === 'capture'
                ? `${agents.find((agent) => agent.id === game.result?.capturedBy)?.name ?? 'An Agent'} ended the turn on Vulture's node.`
                : 'Sixteen turns, no Agent on your node.'}
            </p>
            <dl>
              <div>
                <dt>Turn</dt>
                <dd>{game.result?.turn} / 16</dd>
              </div>
              <div>
                <dt>Seed</dt>
                <dd>{game.seed}</dd>
              </div>
            </dl>
            <button type="button" onClick={restart}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
