import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { generateMap } from '@x-yard/map-generator';
import type { GeneratedMap, NodeId } from '@x-yard/map-generator';

import { MapSvg, MODE_STYLE } from './MapSvg';
import './lab.css';

const NODE_CHOICES = [24, 60, 96] as const;
type NodeChoice = (typeof NODE_CHOICES)[number];

interface InitialState {
  readonly seed: number;
  readonly nodes: NodeChoice;
}

function readInitialState(): InitialState {
  const params = new URLSearchParams(window.location.search);
  const rawSeed = Number.parseInt(params.get('seed') ?? '42', 10);
  const rawNodes = Number.parseInt(params.get('nodes') ?? '24', 10);

  const seed = Number.isFinite(rawSeed) ? rawSeed : 42;
  const nodes = (NODE_CHOICES as readonly number[]).includes(rawNodes)
    ? (rawNodes as NodeChoice)
    : 24;

  return { seed, nodes };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeUrl(seed: number, nodes: NodeChoice): void {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('nodes', String(nodes));
  window.history.replaceState(null, '', url);
}

/** Internal map lab: generate a transit network, inspect it, export it. */
export default function MapLab(): React.JSX.Element {
  const initial = useMemo(readInitialState, []);
  const [seedText, setSeedText] = useState(String(initial.seed));
  const [nodes, setNodes] = useState<NodeChoice>(initial.nodes);
  const [map, setMap] = useState<GeneratedMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback((requestedSeed: number, targetNodes: NodeChoice) => {
    setBusy(true);
    setCopied(false);

    // Let the browser paint the busy state before the synchronous generator runs.
    window.setTimeout(() => {
      try {
        const next = generateMap(requestedSeed, { targetNodes });
        setMap(next);
        setError(null);
        setSelected(null);
        writeUrl(requestedSeed, targetNodes);
      } catch (caught: unknown) {
        setMap(null);
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
    }, 0);
  }, []);

  useEffect(() => {
    generate(initial.seed, initial.nodes);
  }, [generate, initial]);

  const requestedSeed = Number.parseInt(seedText, 10);
  const seedIsValid = Number.isFinite(requestedSeed);

  const submit = (): void => {
    if (!seedIsValid) return;
    generate(requestedSeed, nodes);
  };

  const randomise = (): void => {
    const next = Math.floor(Math.random() * 1_000_000);
    setSeedText(String(next));
    generate(next, nodes);
  };

  const selectedNode = map?.graph.nodes.find((node) => node.id === selected) ?? null;
  const selectedEdges =
    map === null || selected === null
      ? []
      : map.graph.edges.filter((edge) => edge.a === selected || edge.b === selected);

  const copySeed = (): void => {
    if (map === null) return;
    void navigator.clipboard?.writeText(String(map.seed)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const exportJson = (): void => {
    if (map === null) return;
    const blob = new Blob([`${JSON.stringify(map, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `x-yard-map-${map.params.targetNodes}-seed-${map.seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onNodesChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = Number.parseInt(event.target.value, 10) as NodeChoice;
    setNodes(next);
    if (seedIsValid) generate(requestedSeed, next);
  };

  return (
    <div className="lab">
      <header className="lab-header">
        <div>
          <div className="eyebrow">X-YARD · INTERNAL TOOL</div>
          <h1>Map Lab</h1>
        </div>
        <p className="header-note">
          Seeded transit networks. Schematic view — the city art pass comes later.
        </p>
      </header>

      <div className="lab-body">
        <aside className="sidebar">
          <section className="panel controls-panel">
            <form
              className="controls"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="field">
                <span>Seed</span>
                <input
                  type="number"
                  value={seedText}
                  min={0}
                  step={1}
                  onChange={(event) => setSeedText(event.target.value)}
                  aria-label="Seed"
                />
              </label>

              <label className="field">
                <span>Stations</span>
                <select value={nodes} onChange={onNodesChange} aria-label="Station count">
                  {NODE_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </label>

              <div className="control-actions">
                <button className="button primary" type="submit" disabled={busy || !seedIsValid}>
                  {busy ? 'Generating…' : 'Generate'}
                </button>
                <button className="button" type="button" onClick={randomise} disabled={busy}>
                  Random
                </button>
              </div>
            </form>

            <p className="hint">
              Same seed + station count = same map. The effective seed is shown in the stats.
            </p>
          </section>

          {error !== null && (
            <section className="panel panel-error">
              <h2>No valid map</h2>
              <pre>{error}</pre>
              <button className="button" type="button" onClick={randomise}>
                Try another seed
              </button>
            </section>
          )}

          {map !== null && (
            <>
              <section className="panel">
                <h2>Network</h2>
                <div className="stat-grid">
                  <Stat label="Stations" value={map.stats.nodeCount} />
                  <Stat label="Routes" value={map.stats.edgeCount} />
                  <Stat label="Taxi" value={map.stats.byMode.taxi} />
                  <Stat label="Bus" value={map.stats.byMode.bus} />
                  <Stat label="Metro" value={map.stats.byMode.underground} />
                  <Stat label="Special" value={map.stats.byMode.special} />
                  <Stat label="Mean degree" value={map.stats.meanDegree.toFixed(2)} />
                  <Stat label="Degree range" value={`${map.stats.minDegree}–${map.stats.maxDegree}`} />
                  <Stat label="Street / hub / terminal" value={`${map.stats.classMix.street} / ${map.stats.classMix.hub} / ${map.stats.classMix.terminal}`} />
                  <Stat label="Attempts" value={map.attempts} />
                  <Stat label="Effective seed" value={map.seed} />
                  <Stat label="Start separation" value={map.stats.startDistances.join(' · ')} />
                </div>
                <div className="seed-actions">
                  <button className="button small" type="button" onClick={copySeed}>
                    {copied ? 'Copied' : 'Copy effective seed'}
                  </button>
                  <button className="button small" type="button" onClick={exportJson}>
                    Export JSON
                  </button>
                </div>
                {map.seed !== map.requestedSeed && (
                  <p className="hint">
                    Requested seed {map.requestedSeed} was retried as {map.seed}.
                  </p>
                )}
              </section>

              <section className="panel">
                <h2>Validation</h2>
                <div className="check-row">
                  <span className={map.validation.ok ? 'dot ok' : 'dot bad'} />
                  <span>{map.validation.ok ? 'Graph rules pass' : 'Graph rules fail'}</span>
                </div>
                <div className="check-row">
                  <span className={map.validation.geometry.ok ? 'dot ok' : 'dot bad'} />
                  <span>
                    Street-covered routes: {map.validation.geometry.checkedEdges} checked
                  </span>
                </div>
                {map.validation.warnings.length > 0 && (
                  <div className="warnings">
                    <h3>Provisional warnings</h3>
                    <ul>
                      {map.validation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section className="panel">
                <h2>Station inspector</h2>
                {selectedNode === null ? (
                  <p className="hint">Click a station on the map.</p>
                ) : (
                  <>
                    <div className="inspector-head">
                      <strong>{selectedNode.id}</strong>
                      <span className="tag">{selectedNode.class}</span>
                      <span className="tag">{selectedNode.district}</span>
                    </div>
                    <dl className="inspector-list">
                      <dt>Modes</dt>
                      <dd>{selectedNode.modes.length > 0 ? selectedNode.modes.join(', ') : 'none'}</dd>
                      <dt>Facilities</dt>
                      <dd>{selectedNode.facilities.length > 0 ? selectedNode.facilities.join(', ') : '—'}</dd>
                      <dt>Position</dt>
                      <dd>
                        {selectedNode.x.toFixed(0)}, {selectedNode.y.toFixed(0)}
                      </dd>
                      <dt>Routes ({selectedEdges.length})</dt>
                      <dd>
                        {selectedEdges
                          .map((edge) => `${edge.a === selected ? edge.b : edge.a} ${edge.mode}`)
                          .join(' · ') || '—'}
                      </dd>
                    </dl>
                  </>
                )}
              </section>
            </>
          )}
        </aside>

        <main className="map-panel">
          {map !== null ? (
            <MapSvg map={map} selected={selected} onSelect={setSelected} />
          ) : (
            <div className="empty-map">
              <p>{busy ? 'Generating…' : 'No map loaded.'}</p>
            </div>
          )}

          <div className="legend">
            {(Object.keys(MODE_STYLE) as (keyof typeof MODE_STYLE)[]).map((mode) => (
              <span className="legend-item" key={mode}>
                <span
                  className={`swatch${MODE_STYLE[mode].dash === undefined ? '' : ' dashed'}`}
                  style={{ background: MODE_STYLE[mode].colour }}
                />
                {MODE_STYLE[mode].label}
              </span>
            ))}
            <span className="legend-item">
              <span className="swatch ring" /> Station
            </span>
            <span className="legend-item">
              <span className="swatch ring red" /> F
            </span>
            <span className="legend-item">
              <span className="swatch ring blue" /> Agent
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string | number }): React.JSX.Element {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
