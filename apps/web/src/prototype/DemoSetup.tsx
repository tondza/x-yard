/**
 * The interactive demo setup screen.
 *
 * Presentation only: it edits a `DemoConfig`, which the prototype wrapper turns
 * into an engine setup and a map. The engine owns every rule number's default.
 *
 * @module apps/web/prototype/DemoSetup
 */

import type { TicketBag } from '@x-yard/game-core';

import {
  EXISTING_MAPS,
  NODE_CHOICES,
  ROUTE_DENSITY_OPTIONS,
  START_OPTIONS,
  TICKET_MAX,
  TURN_MAX,
  TURN_MIN,
  describeSetup,
  setupFromConfig,
  type DemoConfig,
  type DemoMapConfig,
  type PlaySide,
} from './demo';
import { SKIN_OPTIONS, type SkinId } from './skins';

interface DemoSetupProps {
  readonly config: DemoConfig;
  readonly skin: SkinId;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onChange: (config: DemoConfig) => void;
  readonly onSkinChange: (skin: SkinId) => void;
  readonly onStart: () => void;
}

const TICKET_ROWS: readonly { readonly key: keyof TicketBag; readonly label: string }[] = [
  { key: 'taxi', label: 'Taxi' },
  { key: 'bus', label: 'Bus' },
  { key: 'underground', label: 'Metro' },
  { key: 'special', label: 'Special' },
];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function DemoSetup({
  config,
  skin,
  loading,
  error,
  onChange,
  onSkinChange,
  onStart,
}: DemoSetupProps): React.JSX.Element {
  const setup = setupFromConfig(config);
  const appearances = setup.appearanceTurns ?? [];

  const patchMap = (patch: Partial<DemoMapConfig>): void => {
    onChange({ ...config, map: { ...config.map, ...patch } });
  };

  const patchTicket = (
    role: 'fugitive' | 'agent',
    key: keyof TicketBag,
    value: number,
  ): void => {
    onChange({
      ...config,
      tickets: {
        ...config.tickets,
        [role]: { ...config.tickets[role], [key]: clamp(value, 0, TICKET_MAX) },
      },
    });
  };

  const patchFoot = (role: 'fugitive' | 'agent', value: number): void => {
    onChange({
      ...config,
      tickets: {
        ...config.tickets,
        [role === 'fugitive' ? 'fugitiveFoot' : 'agentFoot']: clamp(value, 0, TICKET_MAX),
      },
    });
  };

  const chooseSide = (side: PlaySide): void => {
    onChange({ ...config, side });
  };

  return (
    <div className={`proto skin-${skin} demo-setup`}>
      <div className="demo-shell">
        <header className="demo-header">
          <div>
            <span className="proto-eyebrow">X-YARD · INTERACTIVE DEMO</span>
            <h1>Set up a Yard</h1>
            <p className="demo-lede">
              Pick a board, tune the chase, then take the Fugitive's route or the Agents'
              badge. Skins stay available on both sides.
            </p>
          </div>
          <label className="proto-skin" title="City skin — saved in this browser, not part of the rules">
            <span>SKIN</span>
            <select
              aria-label="City skin"
              value={skin}
              onChange={(event) => onSkinChange(event.target.value as SkinId)}
            >
              {SKIN_OPTIONS.map((option) => (
                <option key={option.id} value={option.id} title={option.kicker}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {error !== null && <p className="proto-error demo-error">{error}</p>}

        <div className={`demo-grid${config.map.mode === 'generate' ? ' is-generate' : ''}`}>
          <section className="demo-card demo-map-card">
            <div className="demo-card-head">
              <span className="demo-index">1</span>
              <h2>Map</h2>
            </div>

            <div className="demo-toggle" role="group" aria-label="Map source">
              <button
                type="button"
                className={config.map.mode === 'existing' ? 'active' : ''}
                onClick={() => patchMap({ mode: 'existing' })}
              >
                Existing
              </button>
              <button
                type="button"
                className={config.map.mode === 'generate' ? 'active' : ''}
                onClick={() => patchMap({ mode: 'generate' })}
              >
                Generate new
              </button>
            </div>

            {config.map.mode === 'existing' ? (
              <label className="demo-field">
                <span>Board</span>
                <select
                  value={config.map.existingId}
                  onChange={(event) => patchMap({ existingId: event.target.value })}
                >
                  {EXISTING_MAPS.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label} · {choice.detail}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="demo-fields">
                <label className="demo-field">
                  <span>Stations</span>
                  <select
                    value={config.map.targetNodes}
                    onChange={(event) => patchMap({ targetNodes: Number(event.target.value) })}
                  >
                    {NODE_CHOICES.map((count) => (
                      <option key={count} value={count}>
                        {count} stations
                      </option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span>Routes</span>
                  <select
                    value={config.map.routeDensity}
                    onChange={(event) =>
                      patchMap({ routeDensity: event.target.value as DemoMapConfig['routeDensity'] })
                    }
                  >
                    {ROUTE_DENSITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.detail}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span>Agents</span>
                  <select
                    value={config.map.agentCount}
                    onChange={(event) => patchMap({ agentCount: Number(event.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? 'Agent' : 'Agents'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span>Starts</span>
                  <select
                    value={config.map.startStrategy}
                    onChange={(event) =>
                      patchMap({ startStrategy: event.target.value as DemoMapConfig['startStrategy'] })
                    }
                  >
                    {START_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.detail}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="demo-field demo-seed">
                  <span>Seed</span>
                  <div className="demo-seed-row">
                    <input
                      type="number"
                      value={config.map.seed}
                      onChange={(event) => patchMap({ seed: Number(event.target.value) })}
                    />
                    <button
                      type="button"
                      className="demo-dice"
                      title="Pick a different seed"
                      onClick={() => patchMap({ seed: Math.floor(Math.random() * 1_000_000) })}
                    >
                      Randomise
                    </button>
                  </div>
                </div>
                <p className="demo-hint demo-map-hint">
                  The world scales with the station count, so larger Yards keep the
                  quarter's density. Route density changes local taxi links only.
                </p>
              </div>
            )}
          </section>

          <section className="demo-card">
            <div className="demo-card-head">
              <span className="demo-index">2</span>
              <h2>Yard length</h2>
            </div>
            <label className="demo-range">
              <span>
                Total turns <b>{config.turnLimit}</b>
              </span>
              <input
                type="range"
                min={TURN_MIN}
                max={TURN_MAX}
                step={1}
                value={config.turnLimit}
                onChange={(event) =>
                  onChange({ ...config, turnLimit: Number(event.target.value) })
                }
              />
            </label>
            <p className="demo-hint">
              One Fugitive move and one Agent phase per turn. Appearances at turns{' '}
              <strong>{appearances.join(', ')}</strong>.
            </p>
          </section>

          <section className="demo-card demo-ticket-card">
            <div className="demo-card-head">
              <span className="demo-index">3</span>
              <h2>Tickets</h2>
            </div>
            <div className="demo-ticket-head">
              <span />
              <span>Fugitive</span>
              <span>Agents</span>
            </div>
            {TICKET_ROWS.map((row) => (
              <div key={row.key} className="demo-ticket-row">
                <span>{row.label}</span>
                <input
                  aria-label={`Fugitive ${row.label} tickets`}
                  type="number"
                  min={0}
                  max={TICKET_MAX}
                  value={config.tickets.fugitive[row.key]}
                  onChange={(event) => patchTicket('fugitive', row.key, Number(event.target.value))}
                />
                <input
                  aria-label={`Agent ${row.label} tickets`}
                  type="number"
                  min={0}
                  max={TICKET_MAX}
                  value={config.tickets.agent[row.key]}
                  onChange={(event) => patchTicket('agent', row.key, Number(event.target.value))}
                />
              </div>
            ))}
            <div className="demo-ticket-row demo-foot-row">
              <span>Foot</span>
              <input
                aria-label="Fugitive foot steps"
                type="number"
                min={0}
                max={TICKET_MAX}
                value={config.tickets.fugitiveFoot}
                onChange={(event) => patchFoot('fugitive', Number(event.target.value))}
              />
              <input
                aria-label="Agent foot steps"
                type="number"
                min={0}
                max={TICKET_MAX}
                value={config.tickets.agentFoot}
                onChange={(event) => patchFoot('agent', Number(event.target.value))}
              />
            </div>
          </section>

          <section className="demo-card demo-side-card">
            <div className="demo-card-head">
              <span className="demo-index">4</span>
              <h2>Side</h2>
            </div>
            <div className="demo-side-grid">
              <button
                type="button"
                className={`demo-side${config.side === 'fugitive' ? ' active' : ''}`}
                onClick={() => chooseSide('fugitive')}
              >
                <span className="demo-side-kicker">FUGITIVE</span>
                <strong>Play as Vulture</strong>
                <p>Move first, follow your own route and stay hidden between appearances.</p>
              </button>
              <button
                type="button"
                className={`demo-side agent${config.side === 'agent' ? ' active' : ''}`}
                onClick={() => chooseSide('agent')}
              >
                <span className="demo-side-kicker">AGENT · DETECTIVE</span>
                <strong>Play as Falcon</strong>
                <p>Command one Agent; the Vulture is bot-controlled and hidden. Any other Agents move on their own.</p>
              </button>
            </div>
          </section>
        </div>

        <footer className="demo-footer">
          <div className="demo-summary">
            <span>{describeSetup(config)}</span>
            <span className="demo-summary-detail">
              {config.map.mode === 'generate'
                ? `${config.map.routeDensity} routes · ${config.map.agentCount} Agents · seed ${config.map.seed}`
                : 'committed fixture'}
            </span>
          </div>
          <div className="demo-actions">
            <button
              type="button"
              className="demo-start"
              onClick={onStart}
              disabled={loading}
            >
              {loading ? 'Building Yard…' : 'Start demo →'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
