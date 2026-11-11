import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  APPEARANCE_TURNS,
  applyFugitiveCommand,
  chooseFugitiveMove,
  createPrototypeGame,
  legalMoves,
  recentLog,
  resolveAgentPhase,
  revealAppearance,
} from '@x-yard/game-core';
import type {
  MobilityOption,
  PrototypeAgentOrders,
  PrototypeCommand,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypeSeat,
  PrototypeState,
} from '@x-yard/game-core';
import type { GeneratedMap, NodeId } from '@x-yard/map-generator';

import mapJson from '../../../../maps/prototype-96-seed-42.json';
import { MapStage } from './MapStage';
import { DEFAULT_SKIN, SKIN_OPTIONS, isSkinId, type SkinId } from './skins';
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

/** Which side the director chose for this local table. */
type PlaySide = 'fugitive' | 'agent';
const HUMAN_AGENT_ID = 'agent-1';
const BOT_MOVE_PAUSE_MS = 650;

const MODES: readonly { readonly mode: MobilityOption; readonly label: string }[] = [
  { mode: 'taxi', label: 'Taxi' },
  { mode: 'bus', label: 'Bus' },
  { mode: 'underground', label: 'Metro' },
  { mode: 'special', label: 'Special' },
  { mode: 'foot', label: 'Foot' },
];

function initialGame(): PrototypeState {
  return createPrototypeGame(MAP.graph, MAP.starts, MAP.seed);
}

/**
 * Developer skin preference: URL first (shareable), then localStorage, then the
 * original basic city. Never read by game logic.
 */
function initialSkin(): SkinId {
  const fromUrl = new URLSearchParams(window.location.search).get('skin');
  if (isSkinId(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem('xyard.skin');
    if (isSkinId(stored)) return stored;
  } catch {
    // A blocked storage API must not stop the prototype from starting.
  }
  return DEFAULT_SKIN;
}

function nodeMap(state: PrototypeState): Readonly<Record<string, NodeId>> {
  const nodes: Record<string, NodeId> = {};
  for (const seat of state.seats) nodes[seat.id] = seat.node;
  return nodes;
}

function countFor(seat: PrototypeSeat | undefined, mode: MobilityOption): number {
  if (seat === undefined) return 0;
  if (mode === 'foot') return seat.footSteps;
  return seat.tickets[mode];
}

function logRow(entry: PrototypeLogEntry): string {
  if (entry.kind === 'appearance') return `T${entry.turn} · VULTURE APPEARANCE · ${entry.node ?? '?'}`;
  if (entry.kind === 'result') return `T${entry.turn} · YARD OVER`;
  return `T${entry.turn} · VULTURE · ${entry.mode.toUpperCase()}`;
}

function RoleChoice({ onChoose, skin }: { readonly onChoose: (side: PlaySide) => void; readonly skin: SkinId }): React.JSX.Element {
  return (
    <div className={`proto skin-${skin} role-chooser`}>
      <div className="role-shell">
        <span className="proto-eyebrow">X-YARD · 96-STATION PROTOTYPE</span>
        <h1>Choose your side</h1>
        <p className="role-lede">
          The Vulture is loose in the Cathedral Quarter. Run with it, or take a badge and
          hunt it down.
        </p>

        <div className="role-grid">
          <button className="role-card" type="button" onClick={() => onChoose('fugitive')}>
            <span className="role-kicker">FUGITIVE</span>
            <strong>Run the quarter</strong>
            <p>
              You move first, follow your own route and survive to turn 16. Appearances
              show the Agents exactly where you are.
            </p>
            <span className="role-cta">Play as Fugitive →</span>
          </button>

          <button className="role-card agent" type="button" onClick={() => onChoose('agent')}>
            <span className="role-kicker">AGENTS</span>
            <strong>Hunt the Vulture</strong>
            <p>
              Command Falcon. The Fugitive is bot-controlled and hidden; you get only
              appearances, ticket modes and the public log. The other three Agents follow.
            </p>
            <span className="role-cta">Start Agent Practice →</span>
          </button>
        </div>

        <p className="role-note">
          Agent Practice is a local training table. It uses the same map, tickets, appearances
          and capture rule as the Fugitive run.
        </p>
      </div>
    </div>
  );
}

/** The 96-station prototype, now with sequential playback and a camera. */
export default function Prototype(): React.JSX.Element {
  const [side, setSide] = useState<PlaySide | null>(null);
  const [awaitingAgent, setAwaitingAgent] = useState(false);
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
  const [focusRequest, setFocusRequest] = useState<{ readonly node: NodeId; readonly nonce: number } | null>(null);
  const [skin, setSkin] = useState<SkinId>(initialSkin);

  const runIdRef = useRef(0);
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const finalRef = useRef<PrototypeState | null>(null);
  const allStepsRef = useRef<readonly MoveStep[]>([]);

  const humanSeatId = side === 'agent' ? HUMAN_AGENT_ID : 'fugitive';
  const humanSeat = game.seats.find((seat) => seat.id === humanSeatId);
  const moveSource = humanSeat?.node ?? game.lastKnown;
  const canAct =
    side === 'fugitive'
      ? game.phase === 'fugitive'
      : side === 'agent' && game.phase === 'agents' && awaitingAgent;

  // The map must not advertise the next move while a turn is being revealed.
  const legal = useMemo(
    () => (pending || game.result !== null || !canAct ? [] : legalMoves(MAP.graph, game, humanSeatId)),
    [canAct, game, humanSeatId, pending],
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
    if (pending || game.result !== null || legal.length === 0) return;
    if (legal.some((option) => option.mode === selectedMode)) return;
    const first = legal[0]?.mode;
    if (first !== undefined) setSelectedMode(first);
  }, [game.result, legal, pending, selectedMode]);

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
    if (final === null) {
      // The bot Fugitive's hidden move is still unfolding. Let the effect start
      // it again rather than leaving the UI stuck in a pending frame.
      runIdRef.current += 1;
      busyRef.current = false;
      setPending(false);
      setBanner(null);
      return;
    }

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
    setAwaitingAgent(side === 'agent' && final.phase === 'agents');
    setPending(false);
  }, [side]);

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

    const fugitiveNode =
      applied.state.seats.find((seat) => seat.role === 'fugitive')?.node ?? applied.state.lastKnown;

    if (applied.state.pendingAppearance) {
      setAppearanceNode(fugitiveNode);
      setBanner({ kind: 'reveal', node: fugitiveNode });
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

  /** Reveal the Agent phase chosen by the engine, one Agent at a time. */
  const runAgentResolution = async (
    runId: number,
    resolved: Extract<ReturnType<typeof resolveAgentPhase>, { ok: true }>,
    agentSteps: readonly MoveStep[],
  ): Promise<void> => {
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
    setAwaitingAgent(false);
    setPending(false);
    busyRef.current = false;
  };

  /**
   * Agent Practice: the bot Fugitive moves first, hidden. Only an appearance
   * becomes public. The human Agent then gets the Agent phase and is allowed to
   * choose A1's move; the other Agents still resolve as bots.
   */
  const runBotFugitive = useCallback(async (): Promise<void> => {
    if (side !== 'agent' || busyRef.current || game.phase !== 'fugitive' || game.result !== null) return;
    busyRef.current = true;
    finalRef.current = null;
    allStepsRef.current = [];
    runIdRef.current += 1;
    const runId = runIdRef.current;

    setError(null);
    setPending(true);
    setAwaitingAgent(false);
    setActiveStep(null);
    setAppearanceNode(null);
    setBanner({ kind: 'hidden' });
    setTrails([]);
    setSeatNodes(nodeMap(game));
    setSelectedStation(null);

    await sleep(BOT_MOVE_PAUSE_MS);
    if (!alive(runId)) return;

    const option = chooseFugitiveMove(MAP.graph, game);
    const command: PrototypeCommand =
      option === null ? { kind: 'hold' } : { kind: 'move', mode: option.mode, to: option.to };
    const applied = applyFugitiveCommand(MAP.graph, game, command);
    if (!applied.ok) {
      setError(applied.reason);
      setBanner(null);
      setPending(false);
      busyRef.current = false;
      return;
    }

    const fugitiveNode = applied.state.seats.find((seat) => seat.role === 'fugitive')?.node;
    let publicState = applied.state;

    if (applied.state.pendingAppearance && fugitiveNode !== undefined) {
      const revealed = revealAppearance(applied.state);
      if (!revealed.ok) {
        setError(revealed.reason);
        setBanner(null);
        setPending(false);
        busyRef.current = false;
        return;
      }
      publicState = revealed.state;
      finalRef.current = publicState;
      setGame(publicState);
      setAppearanceNode(fugitiveNode);
      setBanner({ kind: 'reveal', node: fugitiveNode });
      await sleep(REVEAL_HOLD_MS);
      if (!alive(runId)) return;
      setAppearanceNode(null);
    } else {
      finalRef.current = publicState;
      setGame(publicState);
    }

    setActiveStep(null);
    setAppearanceNode(null);
    setBanner(null);
    setSeatNodes(nodeMap(publicState));
    setAwaitingAgent(true);
    setPending(false);
    busyRef.current = false;
  }, [game, side]);

  const applyAgentOrders = useCallback(
    (orders: PrototypeAgentOrders): void => {
      if (side !== 'agent' || !awaitingAgent || busyRef.current || game.result !== null) return;
      const resolved = resolveAgentPhase(MAP.graph, game, orders);
      if (!resolved.ok) {
        setError(resolved.reason);
        return;
      }

      setError(null);
      busyRef.current = true;
      finalRef.current = resolved.state;
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const agentSteps = buildAgentSteps(MAP.graph, game, resolved.agentMoves);
      allStepsRef.current = agentSteps;

      setSeatNodes(nodeMap(game));
      setTrails([]);
      setAppearanceNode(null);
      setActiveStep(null);
      setSelectedStation(null);
      setAwaitingAgent(false);
      setPending(true);
      void runAgentResolution(runId, resolved, agentSteps);
    },
    [awaitingAgent, game, runAgentResolution, side],
  );

  useEffect(() => {
    if (side !== 'agent' || pending || busyRef.current || game.result !== null || game.phase !== 'fugitive') {
      return;
    }
    const timer = window.setTimeout(() => {
      void runBotFugitive();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [game.phase, game.turn, pending, runBotFugitive, side]);

  const applyCommand = useCallback(
    (command: PrototypeCommand): void => {
      if (side !== 'fugitive' || busyRef.current || game.result !== null) return;
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
    [game, side],
  );

  const handleMove = useCallback(
    (option: PrototypeMoveOption): void => {
      if (side === 'agent') {
        applyAgentOrders({ moves: { [HUMAN_AGENT_ID]: option } });
        return;
      }
      applyCommand({ kind: 'move', mode: option.mode, to: option.to });
    },
    [applyAgentOrders, applyCommand, side],
  );

  const handleHold = useCallback((): void => {
    if (side === 'agent') {
      applyAgentOrders({ holds: [HUMAN_AGENT_ID] });
      return;
    }
    applyCommand({ kind: 'hold' });
  }, [applyAgentOrders, applyCommand, side]);

  const resetTable = useCallback((): void => {
    runIdRef.current += 1;
    busyRef.current = false;
    finalRef.current = null;
    allStepsRef.current = [];
    setAwaitingAgent(false);
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
    setFocusRequest(null);
    setGame(initialGame());
  }, []);

  const startSide = useCallback(
    (next: PlaySide): void => {
      resetTable();
      setSide(next);
    },
    [resetTable],
  );

  const changeSide = useCallback((): void => {
    resetTable();
    setSide(null);
  }, [resetTable]);

  const restart = useCallback((): void => {
    resetTable();
  }, [resetTable]);

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

  const focusMapNode = useCallback((node: NodeId): void => {
    setSelectedStation(node);
    setFocusRequest((previous) => ({ node, nonce: (previous?.nonce ?? 0) + 1 }));
  }, []);

  const focusLog = useCallback(
    (entry: PrototypeLogEntry): void => {
      if (entry.node !== null) {
        focusMapNode(entry.node);
        return;
      }
      if (entry.seatId === null) return;
      // A move row deliberately has no destination. In Agent Practice, centre
      // the last public position; in the Fugitive run the player knows their own.
      const seat = game.seats.find((candidate) => candidate.id === entry.seatId);
      const target = side === 'agent' ? game.lastKnown : seat?.node;
      if (target !== undefined) focusMapNode(target);
    },
    [focusMapNode, game.lastKnown, game.seats, side],
  );

  const changeSkin = useCallback((next: SkinId): void => {
    if (!isSkinId(next)) return;
    setSkin(next);
    try {
      window.localStorage.setItem('xyard.skin', next);
    } catch {
      // The URL still carries the choice if storage is unavailable.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('skin', next);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    const scope = window as unknown as {
      __XYARD_PROTOTYPE__?: {
        state: PrototypeState;
        side: PlaySide | null;
        awaitingAgent: boolean;
        humanSeatId: string;
        chooseSide: (next: PlaySide) => void;
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
        skin: SkinId;
        setSkin: (next: SkinId) => void;
      };
    };
    scope.__XYARD_PROTOTYPE__ = {
      state: game,
      side,
      awaitingAgent,
      humanSeatId,
      chooseSide: startSide,
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
      skin,
      setSkin: changeSkin,
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
    changeSkin,
    inspectStation,
    legal,
    pending,
    restart,
    selectedStation,
    side,
    awaitingAgent,
    humanSeatId,
    startSide,
    skin,
    skipPlayback,
    trails.length,
  ]);

  if (side === null) {
    return <RoleChoice skin={skin} onChoose={startSide} />;
  }

  const agents = displaySeats.slice(1);
  // The Agents' last-known node, shown as a ghost once it is no longer where the
  // real Fugitive is standing. Before the first appearance there is nothing to show.
  const ghostNode =
    side === 'agent'
      ? game.lastKnown
      : game.lastAppearanceTurn !== null && game.lastKnown !== displaySeats[0]?.node
        ? game.lastKnown
        : null;
  const logs = [...recentLog(game, 9)].reverse();
  const selectedOptions = byMode.get(selectedMode) ?? [];
  const showResult = game.result !== null && !pending;

  return (
    <div className={`proto skin-${skin}${expanded ? ' map-expanded' : ''}`}>
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
          <span className="proto-side">{side === 'agent' ? 'AGENT PRACTICE' : 'FUGITIVE RUN'}</span>
          <span>seed {game.seed}</span>
          <span>{MAP.stats.nodeCount} stations</span>
        </div>

        <label className="proto-skin" title="Developer skin — saved in this browser, not part of the game">
          <span>SKIN</span>
          <select
            aria-label="City skin"
            value={skin}
            onChange={(event) => changeSkin(event.target.value as SkinId)}
          >
            {SKIN_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} title={option.kicker}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button className="proto-change-side" type="button" onClick={changeSide}>
          Change side
        </button>

        <button className="proto-restart" type="button" onClick={restart}>
          Restart
        </button>
      </header>

      <main className="proto-body">
        <MapStage
          map={MAP}
          skin={skin}
          playSide={side}
          focusSeatId={humanSeatId}
          showFugitive={side === 'fugitive'}
          moveSource={moveSource}
          focusRequest={focusRequest}
          ghostLabel={side === 'agent' && game.lastAppearanceTurn === null ? 'Vulture start' : 'Last appearance'}
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
              <span>{side === 'agent' ? 'Agent kit' : 'Fugitive kit'}</span>
              <span className="side-note">
                {humanSeat === undefined ? 'YOU' : `${humanSeat.name.toUpperCase()} · YOU`}
              </span>
            </div>

            <div className="mode-grid">
              {MODES.map(({ mode, label }) => {
                const count = countFor(humanSeat, mode);
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
                ? side === 'agent' && !awaitingAgent
                  ? 'The Fugitive is moving in secret…'
                  : 'Resolving the turn — watch each move, or skip.'
                : side === 'agent' && !awaitingAgent
                  ? 'The Fugitive is hidden. Public information only: appearance, ticket mode and log.'
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
              {pending ? 'Resolving turn…' : side === 'agent' ? 'Hold A1' : 'Hold position'}
            </button>

            {error !== null && <p className="proto-error">{error}</p>}
          </section>

          <section className="side-section">
            <div className="side-heading">
              <span>Public log</span>
              <span className="side-note">MODE PUBLIC · ROUTE HIDDEN</span>
            </div>
            <div className="log-list">
              {side === 'agent' && (
                <button
                  type="button"
                  className="log-row kind-start"
                  onClick={() => focusMapNode(MAP.starts.fugitive)}
                  title="Reveal the Vulture's starting station"
                >
                  T1 · VULTURE START · {MAP.starts.fugitive}
                </button>
              )}
              {logs.map((entry, index) => (
                <button
                  key={`${entry.turn}-${entry.kind}-${index}`}
                  type="button"
                  className={`log-row kind-${entry.kind}`}
                  onClick={() => focusLog(entry)}
                  title="Centre this public event on the map"
                >
                  {logRow(entry)}
                </button>
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
                <button
                  key={agent.id}
                  type="button"
                  className={`agent-row${activeStep?.seatId === agent.id ? ' moving' : ''}${agent.id === humanSeatId ? ' human' : ''}`}
                  onClick={() => focusMapNode(agent.node)}
                  title={`Centre ${agent.name} at ${agent.node}`}
                >
                  <span className="agent-dot" />
                  <span>{agent.name}</span>
                  <b>{agent.id === humanSeatId ? 'YOU' : `A${index + 1}`}</b>
                  <span className="agent-node">{agent.node}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="side-section quiet">
            <div className="side-heading">
              <span>Rules reminder</span>
            </div>
            <p>
              {side === 'agent' ? (
                <>
                  The Fugitive moves first and stays hidden. You command Falcon; the other
                  three Agents follow. Appearances on 5, 10 and 15 reveal the exact node.
                  Capture by ending the Agent phase on it.
                </>
              ) : (
                <>
                  You move first. The Fugitive appears on 5, 10 and 15, showing the exact
                  node to the Agents before they move. Survive to turn 16.
                </>
              )}
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
                : side === 'agent'
                  ? 'Sixteen turns, and the Vulture stayed ahead of the badge.'
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
            <button type="button" className="result-change-side" onClick={changeSide}>
              Change side
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
