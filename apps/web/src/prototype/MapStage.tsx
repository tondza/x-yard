/**
 * The map stage: city plate, live overlay, camera controls and turn banner.
 *
 * The stage owns the camera so camera animation never re-renders the side panel.
 * Its heavy children (city geometry and the station overlay content) are
 * memoised, so panning only updates the two `viewBox` wrappers.
 *
 * @module apps/web/prototype/MapStage
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { GeneratedMap, MapPoint, NodeId } from '@x-yard/map-generator';
import type {
  MobilityOption,
  PrototypeJob,
  PrototypeMoveOption,
  PrototypeSeat,
} from '@x-yard/game-core';

import { CityPlate } from './CityPlate';
import { Rts25CityFragment } from '../lab/rts/Rts25CityFragment';
import { CanvasCity } from './CanvasCity';
import { BOARD, COMMAND, NIGHT_OPS, VINTAGE } from '../lab/rts/rtsTheme';
import type { SkinId } from './skins';
import { PrototypeMap } from './PrototypeMap';
import { isoProjection, mapProjection, projectMap, projectStep, projectTrail } from './projection';
import { cameraViewBox, type StageSize } from './camera';
import {
  MOVE_STYLE,
  type MoveStep,
  type PhaseBanner,
  type Trail,
} from './motion';
import { useMapCamera, zoomLabel } from './useMapCamera';

interface MapStageProps {
  readonly map: GeneratedMap;
  readonly skin: SkinId;
  readonly playSide: 'fugitive' | 'agent';
  readonly focusSeatId: string;
  readonly showFugitive: boolean;
  readonly moveSource: NodeId;
  readonly focusRequest: { readonly node: NodeId; readonly nonce: number } | null;
  readonly ghostLabel: string;
  readonly seats: readonly PrototypeSeat[];
  readonly turn: number;
  readonly selectedMode: MobilityOption;
  readonly legal: readonly PrototypeMoveOption[];
  readonly onMove: (option: PrototypeMoveOption) => void;
  readonly appearanceNode: NodeId | null;
  readonly ghostNode: NodeId | null;
  readonly activeStep: MoveStep | null;
  readonly trails: readonly Trail[];
  readonly banner: PhaseBanner | null;
  readonly pending: boolean;
  readonly onSkip: () => void;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly selectedStation: NodeId | null;
  readonly onInspectStation: (node: NodeId) => void;
  readonly onCloseStation: () => void;
  readonly jobs: readonly PrototypeJob[];
  readonly activeJobId: string | null;
  readonly selectedJobId: string | null;
}

const STATION_MODES = ['taxi', 'bus', 'underground', 'special'] as const;
/** Keep a far-away Agent from pulling the play camera off the Fugitive. */
const AGENT_FOCUS_RADIUS = 430;

interface StationLine {
  readonly mode: (typeof STATION_MODES)[number];
  readonly destinations: readonly NodeId[];
}

function stationLines(map: GeneratedMap, nodeId: NodeId): readonly StationLine[] {
  const found = new Map<(typeof STATION_MODES)[number], NodeId[]>();
  for (const edge of map.graph.edges) {
    if (edge.a !== nodeId && edge.b !== nodeId) continue;
    const other = edge.a === nodeId ? edge.b : edge.a;
    const list = found.get(edge.mode) ?? [];
    if (!list.includes(other)) list.push(other);
    found.set(edge.mode, list);
  }
  return STATION_MODES.map((mode) => ({
    mode,
    destinations: [...(found.get(mode) ?? [])].sort((left, right) => left.localeCompare(right)),
  }));
}

function stationClassLabel(className: 'street' | 'hub' | 'terminal'): string {
  if (className === 'terminal') return 'Terminal';
  if (className === 'hub') return 'Hub';
  return 'Street';
}

function bannerText(banner: PhaseBanner | null, turn: number, playSide: 'fugitive' | 'agent'): {
  readonly kicker: string;
  readonly main: string;
  readonly detail: string;
} {
  if (banner === null) {
    return {
      kicker: playSide === 'agent' ? 'YOUR AGENT MOVE' : 'YOUR MOVE',
      main: `Turn ${turn}`,
      detail: playSide === 'agent' ? 'Move A1, then the other Agents follow' : 'Pick a mode, then a ringed station',
    };
  }

  if (banner.kind === 'fugitive') {
    return {
      kicker: 'YOUR MOVE',
      main: `${banner.step.label} · ${MOVE_STYLE[banner.step.mode].label}`,
      detail: `${banner.step.from} → ${banner.step.to}`,
    };
  }

  if (banner.kind === 'hold') {
    return { kicker: 'YOUR MOVE', main: 'Vulture holds', detail: 'The Agents move next' };
  }

  if (banner.kind === 'hidden') {
    return {
      kicker: 'FUGITIVE PHASE',
      main: 'Vulture moves',
      detail: 'The route is hidden from the Agents',
    };
  }

  if (banner.kind === 'reveal') {
    return {
      kicker: 'APPEARANCE',
      main: `Vulture seen at ${banner.node}`,
      detail: 'The Agents now know this station',
    };
  }

  if (banner.kind === 'pickup') {
    return {
      kicker: 'SHIPMENT COLLECTED',
      main: `Picked up at ${banner.node}`,
      detail: 'The Agents saw the public pickup',
    };
  }

  if (banner.kind === 'delivery') {
    return {
      kicker: 'SHIPMENT DELIVERED',
      main: `£${banner.prize} banked`,
      detail: 'The drop stayed private',
    };
  }

  return {
    kicker: `AGENT PHASE · ${banner.index + 1} / ${banner.total}`,
    main: `${banner.step.label} · ${MOVE_STYLE[banner.step.mode].label}`,
    detail: `${banner.step.from} → ${banner.step.to}`,
  };
}

export function MapStage({
  map,
  skin,
  playSide,
  focusSeatId,
  showFugitive,
  moveSource,
  focusRequest,
  ghostLabel,
  seats,
  turn,
  selectedMode,
  legal,
  onMove,
  appearanceNode,
  ghostNode,
  activeStep,
  trails,
  banner,
  pending,
  onSkip,
  expanded,
  onToggleExpanded,
  selectedStation,
  onInspectStation,
  onCloseStation,
  jobs,
  activeJobId,
  selectedJobId,
}: MapStageProps): React.JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageSize>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<NodeId | null>(null);
  const lastPointerTypeRef = useRef<string>('mouse');
  const suppressClickRef = useRef(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ distance: number; x: number; y: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; travelled: number } | null>(null);

  useEffect(() => {
    const element = frameRef.current;
    if (element === null) return;

    const update = (): void => {
      const rect = element.getBoundingClientRect();
      setStage({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const projection = useMemo(
    () => (skin === 'vintage' || skin === 'board' ? isoProjection(map.bounds) : mapProjection(map.bounds)),
    [map.bounds, skin],
  );
  const displayMap = useMemo(() => projectMap(map, projection), [map, projection]);
  const playPlate = useMemo(
    () => [
      projection.point({ x: 0, y: 0 }),
      projection.point({ x: map.bounds.width, y: 0 }),
      projection.point({ x: map.bounds.width, y: map.bounds.height }),
      projection.point({ x: 0, y: map.bounds.height }),
    ],
    [map.bounds.height, map.bounds.width, projection],
  );
  const displayStep = useMemo(
    () => (activeStep === null ? null : projectStep(activeStep, projection)),
    [activeStep, projection],
  );
  const displayTrails = useMemo(
    () => trails.map((trail) => projectTrail(trail, projection)),
    [projection, trails],
  );

  const focusPoints = useMemo<readonly MapPoint[]>(() => {
    const nodeById = new Map(displayMap.graph.nodes.map((node) => [node.id, node]));
    const points: MapPoint[] = [];

    // Play view stays on the Fugitive and, while a move is being revealed, the
    // mover's actual route. Framing every seat at once would zoom back out to
    // the whole-city view the camera exists to avoid.
    const focusSeat = seats.find((seat) => seat.id === focusSeatId) ?? seats[0];
    const focusNode = focusSeat === undefined ? undefined : nodeById.get(focusSeat.node);
    if (focusNode !== undefined) points.push({ x: focusNode.x, y: focusNode.y });

    if (displayStep !== null) {
      const destination = displayStep.points[displayStep.points.length - 1];
      const distance =
        focusNode === undefined || destination === undefined
          ? 0
          : Math.hypot(destination.x - focusNode.x, destination.y - focusNode.y);
      // The Fugitive's own move is always followed. An Agent is only followed
      // while the move is near enough to matter; a distant Agent should not make
      // the camera zoom out just to show an off-screen token.
      if (displayStep.role === 'fugitive' || distance <= AGENT_FOCUS_RADIUS) {
        points.push(...displayStep.points);
      }
    }

    return points;
  }, [displayMap.graph.nodes, displayStep, focusSeatId, seats]);

  // Hovering a legal destination previews its onward lines without moving there.
  const cardStation = selectedStation ?? hoveredStation;
  const cardIsPreview = selectedStation === null && hoveredStation !== null;
  const selectedNode =
    cardStation === null ? undefined : map.graph.nodes.find((node) => node.id === cardStation);
  const selectedLines = useMemo(
    () => (cardStation === null ? [] : stationLines(map, cardStation)),
    [cardStation, map],
  );
  const stationTenant =
    cardStation === null ? undefined : seats.find((seat) => seat.node === cardStation);
  const legalHere =
    cardStation === null ? [] : legal.filter((option) => option.to === cardStation);

  useEffect(() => {
    if (pending) setHoveredStation(null);
  }, [pending]);

  const camera = useMapCamera({ bounds: projection.bounds, stage, focusPoints, playPlate });
  const centerOn = camera.centerOn;
  const viewBox = cameraViewBox(camera.camera, stage);

  // A public-log/agent click asks for a one-shot inspection centre without
  // changing the play/free mode.
  useEffect(() => {
    if (focusRequest === null) return;
    const node = displayMap.graph.nodes.find((candidate) => candidate.id === focusRequest.node);
    if (node !== undefined) centerOn({ x: node.x, y: node.y });
  }, [centerOn, displayMap.graph.nodes, focusRequest]);
  const bannerInfo = bannerText(banner, turn, playSide);
  const { openMap, setPlay, recentre, zoomIn, zoomOut, zoomAt } = camera;
  const overviewOpen = useRef(false);

  // Expanding is explicitly a whole-map request; closing returns to follow.
  useEffect(() => {
    if (expanded === overviewOpen.current) return;
    overviewOpen.current = expanded;
    if (expanded) openMap();
    else setPlay();
  }, [expanded, openMap, setPlay]);

  // The expanded frame is a different size; fit it once the browser has measured.
  useEffect(() => {
    if (!expanded || stage.width <= 0 || stage.height <= 0) return;
    openMap();
    // react to the frame size only; camera state updates are handled inside the hook
  }, [expanded, stage.width, stage.height]);

  // Wheel is a native listener so it can preventDefault without React's passive
  // wrapper. The HUD is excluded: scrolling over a control should not move the map.
  useEffect(() => {
    const element = frameRef.current;
    if (element === null) return;

    const onWheel = (event: WheelEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest('.map-hud') !== null) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0016);
      zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top, true);
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        onToggleExpanded();
      } else if (event.key === 'f' || event.key === 'F') {
        recentre();
      } else if (event.key === '+' || event.key === '=') {
        zoomIn();
      } else if (event.key === '-') {
        zoomOut();
      } else if (event.key === 'Escape' && expanded) {
        onToggleExpanded();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onToggleExpanded, recentre, zoomIn, zoomOut]);

  const handleMove = useCallback(
    (option: PrototypeMoveOption): void => {
      if (suppressClickRef.current) return;
      // Touch has no hover: the first tap previews the destination's lines, the
      // second tap on the same ring moves. Mouse clicks still move immediately.
      if (lastPointerTypeRef.current === 'touch' && selectedStation !== option.to) {
        onInspectStation(option.to);
        return;
      }
      onMove(option);
    },
    [onInspectStation, onMove, selectedStation],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    lastPointerTypeRef.current = event.pointerType;
    const target = event.target;
    if (target instanceof Element && target.closest('.map-hud, .dest-hit, .station-hit') !== null) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      dragRef.current = { x: event.clientX, y: event.clientY, travelled: 0 };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      if (first !== undefined && second !== undefined) {
        pinchRef.current = {
          distance: Math.hypot(first.x - second.x, first.y - second.y),
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        };
      }
      dragRef.current = null;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current !== null) {
      const [first, second] = [...pointersRef.current.values()];
      if (first === undefined || second === undefined) return;
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const previous = pinchRef.current;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (first.x + second.x) / 2 - rect.left;
      const y = (first.y + second.y) / 2 - rect.top;
      if (previous.distance > 0) {
        camera.zoomAt(distance / previous.distance, x, y, false);
        camera.panBy(x - (previous.x - rect.left), y - (previous.y - rect.top));
      }
      pinchRef.current = { distance, x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      suppressClickRef.current = true;
      return;
    }

    const drag = dragRef.current;
    if (drag === null) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.travelled += Math.abs(dx) + Math.abs(dy);
    drag.x = event.clientX;
    drag.y = event.clientY;

    if (drag.travelled > 4) {
      suppressClickRef.current = true;
      if (!dragging) setDragging(true);
      camera.panBy(dx, dy);
    }
  };

  const finishPointers = (event: React.PointerEvent<HTMLDivElement>): void => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      if (remaining !== undefined) {
        dragRef.current = { x: remaining.x, y: remaining.y, travelled: 0 };
      }
      pinchRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      pinchRef.current = null;
      if (dragging) setDragging(false);
      if (suppressClickRef.current) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }
  };

  const freeCursor = camera.viewMode === 'map' || dragging;

  return (
    <section className="proto-stage">
      <div
        ref={frameRef}
        className={`map-frame skin-${skin}${freeCursor ? ' is-free' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointers}
        onPointerCancel={finishPointers}
      >
        {skin === 'vintage' || skin === 'board' ? (
          <CanvasCity map={map} theme={skin === 'board' ? BOARD : VINTAGE} viewBox={viewBox} stage={stage} />
        ) : skin === 'iron' ? (
          <Rts25CityFragment map={map} theme={COMMAND} viewBox={viewBox} overlay={false} />
        ) : skin === 'nightops' ? (
          <Rts25CityFragment map={map} theme={NIGHT_OPS} viewBox={viewBox} overlay={false} />
        ) : (
          <CityPlate map={map} viewBox={viewBox} />
        )}
        <PrototypeMap
          map={displayMap}
          theme={skin === 'board' ? BOARD : skin === 'vintage' ? VINTAGE : skin === 'iron' ? COMMAND : skin === 'nightops' ? NIGHT_OPS : VINTAGE}
          seats={seats}
          selectedMode={selectedMode}
          legal={legal}
          onMove={handleMove}
          onInspectStation={onInspectStation}
          onHoverStation={setHoveredStation}
          appearanceNode={appearanceNode}
          ghostNode={ghostNode}
          showFugitive={showFugitive}
          moveSource={moveSource}
          viewBox={viewBox}
          scale={camera.camera.scale}
          activeStep={displayStep}
          trails={displayTrails}
          selectedStation={selectedStation ?? hoveredStation}
          jobs={jobs}
          activeJobId={activeJobId}
          selectedJobId={selectedJobId}
          jobView={playSide}
          plateRoutes={skin === 'board' || skin === 'vintage'}
        />

        <div className="map-hud">
          <div className="map-toolbar" onPointerDown={(event) => event.stopPropagation()}>
            <div className="view-switch" role="group" aria-label="Camera view">
              <button
                type="button"
                className={camera.viewMode === 'play' ? 'active' : ''}
                onClick={camera.setPlay}
                title="Follow the action (F)"
              >
                Play
              </button>
              <button
                type="button"
                className={camera.viewMode === 'map' ? 'active' : ''}
                onClick={camera.openMap}
                title="Inspect the whole map"
              >
                Map
              </button>
            </div>

            <span className="toolbar-divider" />

            <button type="button" className="tool-button" onClick={camera.zoomOut} aria-label="Zoom out">
              −
            </button>
            <span className="zoom-readout" title="Zoom relative to the whole-city view">
              {zoomLabel(camera.camera, projection.bounds, stage)}
            </span>
            <button type="button" className="tool-button" onClick={camera.zoomIn} aria-label="Zoom in">
              +
            </button>
            <button
              type="button"
              className="tool-button"
              onClick={camera.recentre}
              aria-label="Recentre on the action"
              title="Recentre (F)"
            >
              ◎
            </button>

            <button type="button" className="tool-button expand" onClick={onToggleExpanded}>
              {expanded ? 'Close map' : 'Expand'}
            </button>
          </div>

          {(cardStation === null || pending) && (
            <div
              className={`motion-banner kind-${banner?.kind ?? 'idle'}${
                camera.viewMode === 'map' ? ' free-look' : ''
              }`}
            >
              <div className="banner-copy">
                <span className="banner-kicker">{bannerInfo.kicker}</span>
                <strong className="banner-main">{bannerInfo.main}</strong>
                <span className="banner-detail">{bannerInfo.detail}</span>
              </div>
              {pending && (
                <button type="button" className="skip-button" onClick={onSkip}>
                  Skip
                </button>
              )}
            </div>
          )}

          {cardStation !== null && selectedNode !== undefined && !pending && (
            <div className="station-card" onPointerDown={(event) => event.stopPropagation()}>
              {!cardIsPreview && (
                <button
                  type="button"
                  className="station-close"
                  onClick={() => {
                    setHoveredStation(null);
                    onCloseStation();
                  }}
                  aria-label="Close station card"
                >
                  ×
                </button>
              )}
              <span className="station-kicker">
                {cardIsPreview ? 'STATION PREVIEW' : 'STATION'}
              </span>
              <div className="station-title">
                <strong>{cardStation}</strong>
                <span>
                  {stationClassLabel(selectedNode.class)}
                  {selectedLines.some((line) => line.destinations.length > 0)
                    ? ` · ${selectedLines
                        .filter((line) => line.destinations.length > 0)
                        .map((line) => MOVE_STYLE[line.mode].label)
                        .join(' / ')}`
                    : ''}
                </span>
              </div>

              {stationTenant !== undefined && (
                <div className="station-tenant">
                  {stationTenant.name} is
                  {stationTenant.id === seats[0]?.id ? ' here (you)' : ' here'}
                </div>
              )}

              {ghostNode === cardStation && (
                <div className="station-appearance">
                  {ghostLabel} · F{cardStation.replace(/^[^0-9]*/, '')}
                </div>
              )}

              <div className="station-lines">
                {selectedLines.map((line) => (
                  <div key={line.mode} className="station-line">
                    <span
                      className="station-line-label"
                      style={{ color: MOVE_STYLE[line.mode].colour }}
                    >
                      {MOVE_STYLE[line.mode].label}
                    </span>
                    <span className="station-line-dest">
                      {line.destinations.length > 0 ? line.destinations.join(' · ') : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {!cardIsPreview && legalHere.length > 0 && (
                <p className="station-move-hint">
                  Tap the ringed station again to move here.
                </p>
              )}

              <p className="station-hint">
                Foot uses the taxi network. Ticket counts are in the kit.
              </p>
            </div>
          )}

          {camera.viewMode === 'map' && (
            <div className="free-look-hint">
              FREE LOOK · drag to pan · scroll to zoom
            </div>
          )}
        </div>

        {skin === 'board' && camera.viewMode === 'map' && (
          <div className="plate-cartouche" aria-hidden="true">
            <span className="plate-title">Cathedral Quarter</span>
            <span className="plate-sub">Transit plate · 1925</span>
            <div className="plate-row">
              <svg className="plate-compass" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" />
                <path d="M12 3 L14 11 L12 9.5 L10 11 Z" fill="currentColor" />
                <path d="M12 21 L10 13 L12 14.5 L14 13 Z" fill="currentColor" opacity="0.55" />
                <path d="M12 5.5 V8.4 M12 15.6 V18.5" stroke="currentColor" strokeWidth="0.8" />
              </svg>
              <span className="plate-scale"><i />0 — 100 yd</span>
            </div>
          </div>
        )}
      </div>

      <div className="map-legend">
        {Object.entries(MOVE_STYLE).map(([mode, style]) => (
          <span key={mode} className="legend-item" title={`${style.label} route${style.dash ? ' (dashed)' : ''}`}>
            <svg className="legend-swatch" viewBox="0 0 22 8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                stroke={style.colour}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={style.dash}
              />
            </svg>
            {style.label}
          </span>
        ))}
        <span className="legend-badges">Rim arc: bus · metro · special</span>
        <span className="legend-ghost">
          <i className="ghost-swatch" /> {ghostLabel}
        </span>
        <span className="legend-hint">
          Ringed station moves · any station opens its lines
        </span>
      </div>
    </section>
  );
}
