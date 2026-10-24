import { useEffect, useMemo, useRef, useState } from 'react';

import {
  REVEAL_PULSE_TURNS,
  applyFugitiveCommand,
  createPrototypeGame,
  legalMoves,
  recentLog,
  resolveAgentPhase,
} from '@x-yard/game-core';
import type {
  MobilityOption,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypeState,
} from '@x-yard/game-core';
import type { GeneratedMap } from '@x-yard/map-generator';

import mapJson from '../../../../maps/prototype-96-seed-42.json';
import { CityPlate } from './CityPlate';
import { MOVE_STYLE, PrototypeMap } from './PrototypeMap';
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

function countFor(state: PrototypeState, mode: MobilityOption): number {
  const seat = state.seats[0];
  if (seat === undefined) return 0;
  if (mode === 'foot') return seat.footSteps;
  if (mode === 'scooter') return seat.scooterCharges;
  return seat.tickets[mode];
}

function logRow(entry: PrototypeLogEntry): string {
  if (entry.kind === 'pulse') return `T${entry.turn} · PULSE · ${entry.node ?? '?'}`;
  if (entry.kind === 'reveal') return `T${entry.turn} · SCOOTER REVEAL · ${entry.node ?? '?'}`;
  if (entry.kind === 'result') return `T${entry.turn} · YARD OVER`;
  return `T${entry.turn} · ${entry.mode.toUpperCase()}`;
}

/** The 96-station desktop prototype. */
export default function Prototype(): React.JSX.Element {
  const [game, setGame] = useState<PrototypeState>(initialGame);
  const [selectedMode, setSelectedMode] = useState<MobilityOption>('taxi');
  const [pending, setPending] = useState(false);
  const [pulseNode, setPulseNode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentTimer = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);

  const legal = useMemo(() => legalMoves(MAP.graph, game, 'fugitive'), [game]);
  const byMode = useMemo(() => {
    const map = new Map<MobilityOption, readonly PrototypeMoveOption[]>();
    for (const option of legal) {
      const current = map.get(option.mode) ?? [];
      map.set(option.mode, [...current, option]);
    }
    return map;
  }, [legal]);

  const clearTimers = (): void => {
    if (agentTimer.current !== null) window.clearTimeout(agentTimer.current);
    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    agentTimer.current = null;
    pulseTimer.current = null;
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (game.result !== null || game.phase !== 'fugitive') return;
    if (legal.some((option) => option.mode === selectedMode)) return;
    const first = legal[0]?.mode;
    if (first !== undefined) setSelectedMode(first);
  }, [game, legal, selectedMode]);

  const resolveAgents = (afterFugitive: PrototypeState): void => {
    setPending(true);
    agentTimer.current = window.setTimeout(() => {
      const resolved = resolveAgentPhase(MAP.graph, afterFugitive);
      if (resolved.ok) {
        const fresh = resolved.state.log.slice(afterFugitive.log.length);
        const reveal = fresh.find((entry) => entry.kind === 'pulse' || entry.kind === 'reveal');
        if (reveal?.node !== null && reveal?.node !== undefined) {
          setPulseNode(reveal.node);
          pulseTimer.current = window.setTimeout(() => setPulseNode(null), 1500);
        }
        setGame(resolved.state);
      }
      setPending(false);
    }, 700);
  };

  const applyCommand = (command: Parameters<typeof applyFugitiveCommand>[2]): void => {
    if (pending || game.result !== null) return;
    const applied = applyFugitiveCommand(MAP.graph, game, command);
    if (!applied.ok) {
      setError(applied.reason);
      return;
    }
    setError(null);
    setGame(applied.state);
    resolveAgents(applied.state);
  };

  const handleMove = (option: PrototypeMoveOption): void => {
    applyCommand({ kind: 'move', mode: option.mode, to: option.to, via: option.via });
  };

  const handleHold = (): void => {
    applyCommand({ kind: 'hold' });
  };

  const restart = (): void => {
    clearTimers();
    setPending(false);
    setPulseNode(null);
    setError(null);
    setSelectedMode('taxi');
    setGame(initialGame());
  };

  useEffect(() => {
    const scope = window as unknown as {
      __XYARD_PROTOTYPE__?: {
        state: PrototypeState;
        legal: readonly PrototypeMoveOption[];
        move: (option: PrototypeMoveOption) => void;
        hold: () => void;
        restart: () => void;
      };
    };
    scope.__XYARD_PROTOTYPE__ = {
      state: game,
      legal,
      move: handleMove,
      hold: handleHold,
      restart,
    };
    return () => {
      delete scope.__XYARD_PROTOTYPE__;
    };
  });

  const agents = game.seats.slice(1);
  const logs = [...recentLog(game, 8)].reverse();
  const selectedOptions = byMode.get(selectedMode) ?? [];

  return (
    <div className="proto">
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

        <div className="proto-pulses">
          <span className="pulse-label">PULSES</span>
          {REVEAL_PULSE_TURNS.map((turn) => (
            <span
              key={turn}
              className={`pulse-chip${game.turn === turn ? ' current' : ''}${game.turn > turn ? ' passed' : ''}`}
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
        <section className="proto-stage">
          <div className="map-frame">
            <CityPlate map={MAP} />
            <PrototypeMap
              map={MAP}
              state={game}
              selectedMode={selectedMode}
              legal={legal}
              onMove={handleMove}
              pulseNode={pulseNode}
            />
            {pending && <div className="agent-overlay">AGENTS MOVING…</div>}
          </div>

          <div className="map-legend">
            {MODES.map(({ mode, label }) => (
              <span key={mode} className="legend-item">
                <i style={{ background: MOVE_STYLE[mode].colour }} />
                {label}
              </span>
            ))}
            <span className="legend-hint">Click a ringed station to move · numbers are station ids</span>
          </div>
        </section>

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
                    <span className="mode-legal">{options.length > 0 ? `${options.length} legal` : 'no line'}</span>
                  </button>
                );
              })}
            </div>

            <p className="now-line">
              {selectedOptions.length > 0
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
              {pending ? 'Resolving Agents…' : 'Hold position'}
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
                <div key={agent.id} className="agent-row">
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
              You move first. A pulse on 5, 10 and 15 reveals your node before the
              Agents move. A scooter move reveals it immediately. Survive to turn 16.
            </p>
          </section>
        </aside>
      </main>

      {game.result !== null && (
        <div className="result-overlay">
          <div className="result-card">
            <span className="result-kicker">
              {game.result.winner === 'agents' ? 'CAPTURED' : 'SURVIVED'}
            </span>
            <h1>
              {game.result.winner === 'agents' ? 'The Agents win' : 'The Fugitive survives'}
            </h1>
            <p>
              {game.result.reason === 'capture'
                ? `${agents.find((agent) => agent.id === game.result?.capturedBy)?.name ?? 'An Agent'} ended the turn on Vulture's node.`
                : 'Sixteen turns, no Agent on your node.'}
            </p>
            <dl>
              <div>
                <dt>Turn</dt>
                <dd>{game.result.turn} / 16</dd>
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
