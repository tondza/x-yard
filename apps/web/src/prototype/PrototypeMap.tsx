import { memo, useLayoutEffect, useMemo, useRef } from 'react';

import type { GeneratedMap, GraphEdge, MapPoint, NodeId } from '@x-yard/map-generator';
import type { MobilityOption, PrototypeMoveOption, PrototypeSeat } from '@x-yard/game-core';

import { pathData } from './city';
import {
  MOVE_STYLE,
  STEP_LEAD_MS,
  pointAtProgress,
  routePoints,
  type MoveStep,
  type Trail,
} from './motion';

/** Overlay sizes are screen pixels; the camera scale converts them to map units. */
const STATION_RADIUS = { street: 3.1, hub: 3.8, terminal: 4.5 } as const;
const LABEL_FONT = 10.5;
const FACILITY_FONT = 7.6;
const AGENT_RADIUS = 9;
const FUGITIVE_RADIUS = 10.5;
const DESTINATION_RADIUS = 13.5;
const DESTINATION_HIT = 19;
const LABEL_ALL_SCALE = 0.78;
const BADGE_SCALE = 0.62;

/** The permanent transit network. Legal moves are drawn brighter on top. */
const NETWORK_ORDER = ['taxi', 'bus', 'underground', 'special'] as const;
const NETWORK_STYLE: Readonly<
  Record<
    (typeof NETWORK_ORDER)[number],
    { readonly width: number; readonly opacity: number; readonly casing: number; readonly dash?: string }
  >
> = {
  taxi: { width: 1.15, opacity: 0.5, casing: 3.2 },
  bus: { width: 2.1, opacity: 0.82, casing: 4.6 },
  underground: { width: 2.8, opacity: 0.9, casing: 5.4 },
  special: { width: 1.8, opacity: 0.85, casing: 4.2, dash: '5 4' },
};

const STOP_BADGE: Readonly<
  Record<'bus' | 'underground' | 'special', { readonly label: string; readonly colour: string }>
> = {
  bus: { label: 'B', colour: '#2f7a4f' },
  underground: { label: 'M', colour: '#a93c36' },
  special: { label: 'S', colour: '#6d4bb5' },
};

function stationNumber(id: NodeId): string {
  return id.replace(/^[^0-9]*/, '');
}

function edgePoints(
  edge: GraphEdge,
  nodeById: ReadonlyMap<NodeId, { readonly x: number; readonly y: number }>,
): readonly MapPoint[] {
  if (edge.path !== undefined && edge.path.length > 1) return edge.path;
  const from = nodeById.get(edge.a);
  const to = nodeById.get(edge.b);
  if (from === undefined || to === undefined) return [];
  return [
    { x: from.x, y: from.y },
    { x: to.x, y: to.y },
  ];
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * A token that traverses its move polyline. The camera may re-render this
 * component (on zoom), so the animated `transform` is set imperatively rather
 * than as a React prop: React does not own the attribute after mount.
 */
function AnimatedToken({
  step,
  children,
}: {
  readonly step: MoveStep;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const groupRef = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    const element = groupRef.current;
    if (element === null) return;

    const first = step.points[0];
    if (first !== undefined) {
      element.setAttribute('transform', `translate(${first.x} ${first.y})`);
    }

    const started = performance.now() + STEP_LEAD_MS;
    let frame = 0;

    const tick = (now: number): void => {
      const t = Math.min(1, Math.max(0, (now - started) / step.duration));
      const point = pointAtProgress(step.points, easeInOutCubic(t));
      element.setAttribute('transform', `translate(${point.x} ${point.y})`);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  return <g ref={groupRef}>{children}</g>;
}

function AgentToken({
  x,
  y,
  scale,
  index,
  active,
}: {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly index: number;
  readonly active: boolean;
}): React.JSX.Element {
  const radius = AGENT_RADIUS / scale;
  return (
    <g>
      {active && <circle className="token-halo" cx={0} cy={0} r={radius * 1.9} fill="#2f6fed" />}
      <circle cx={0} cy={0} r={radius} fill="#2f6fed" stroke="#fbf8f0" strokeWidth={2 / scale} />
      <text
        x={radius + 2.5 / scale}
        y={3 / scale}
        fontSize={8 / scale}
        fontWeight={700}
        fill="#2f6fed"
        paintOrder="stroke"
        stroke="#f4efe2"
        strokeWidth={2.5 / scale}
      >
        A{index + 1}
      </text>
      {!active && (
        <circle cx={0} cy={0} r={radius + 9 / scale} fill="transparent" opacity={0}>
          <title>{`Agent A${index + 1} at ${x.toFixed(0)},${y.toFixed(0)}`}</title>
        </circle>
      )}
    </g>
  );
}

function FugitiveToken({
  x,
  y,
  scale,
  active,
}: {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly active: boolean;
}): React.JSX.Element {
  const radius = FUGITIVE_RADIUS / scale;
  return (
    <g>
      {active && <circle className="token-halo fugitive" cx={0} cy={0} r={radius * 1.85} fill="#a93c36" />}
      <circle cx={0} cy={0} r={radius} fill="#a93c36" stroke="#fbf8f0" strokeWidth={2.4 / scale} />
      <text
        x={0}
        y={3.6 / scale}
        textAnchor="middle"
        fontSize={9.5 / scale}
        fontWeight={800}
        fill="#fff8ef"
      >
        F
      </text>
      <circle cx={0} cy={0} r={radius + 12 / scale} fill="transparent" opacity={0}>
        <title>{`Vulture at ${x.toFixed(0)},${y.toFixed(0)}`}</title>
      </circle>
    </g>
  );
}

interface PrototypeMapContentProps {
  readonly map: GeneratedMap;
  readonly seats: readonly PrototypeSeat[];
  readonly selectedMode: MobilityOption;
  readonly legal: readonly PrototypeMoveOption[];
  readonly onMove: (option: PrototypeMoveOption) => void;
  readonly onInspectStation: (node: NodeId) => void;
  readonly onHoverStation: (node: NodeId | null) => void;
  readonly appearanceNode: NodeId | null;
  readonly ghostNode: NodeId | null;
  readonly scale: number;
  readonly activeStep: MoveStep | null;
  readonly trails: readonly Trail[];
  readonly selectedStation: NodeId | null;
}

function PrototypeMapContent({
  map,
  seats,
  selectedMode,
  legal,
  onMove,
  onInspectStation,
  onHoverStation,
  appearanceNode,
  ghostNode,
  scale,
  activeStep,
  trails,
  selectedStation,
}: PrototypeMapContentProps): React.JSX.Element {
  const fugitive = seats[0];
  const agents = seats.slice(1);
  const options = legal.filter((option) => option.mode === selectedMode);
  const style = MOVE_STYLE[selectedMode];
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const networkEdges = useMemo(
    () =>
      [...map.graph.edges].sort(
        (left, right) =>
          NETWORK_ORDER.indexOf(left.mode) - NETWORK_ORDER.indexOf(right.mode) ||
          left.id.localeCompare(right.id),
      ),
    [map.graph.edges],
  );
  const stopsByNode = useMemo(() => {
    const stops = new Map<NodeId, ('bus' | 'underground' | 'special')[]>();
    for (const edge of map.graph.edges) {
      if (edge.mode === 'taxi') continue;
      for (const id of [edge.a, edge.b]) {
        const current = stops.get(id) ?? [];
        if (!current.includes(edge.mode)) current.push(edge.mode);
        stops.set(id, current);
      }
    }
    for (const modes of stops.values()) modes.sort();
    return stops;
  }, [map.graph.edges]);

  const px = (value: number): number => value / scale;
  const importantNodes = useMemo(() => {
    const ids = new Set<NodeId>();
    for (const seat of seats) ids.add(seat.node);
    for (const option of legal) {
      ids.add(option.to);
      if (option.via !== null) ids.add(option.via);
    }
    if (activeStep !== null) {
      ids.add(activeStep.from);
      ids.add(activeStep.to);
    }
    if (appearanceNode !== null) ids.add(appearanceNode);
    if (ghostNode !== null) ids.add(ghostNode);
    if (selectedStation !== null) ids.add(selectedStation);
    for (const node of map.graph.nodes) {
      if (node.class !== 'street' || node.facilities.length > 0) ids.add(node.id);
    }
    return ids;
  }, [activeStep, appearanceNode, ghostNode, legal, map.graph.nodes, seats, selectedStation]);

  const showAllLabels = scale >= LABEL_ALL_SCALE;
  const showBadges = scale >= BADGE_SCALE;
  const activeRole = activeStep?.role ?? null;

  return (
    <g>
      <defs>
        <marker
          id="proto-arrow-agent"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#2f6fed" />
        </marker>
        <marker
          id="proto-arrow-fugitive"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#a93c36" />
        </marker>
      </defs>

      {/* The permanent transit map: taxi streets, bus, metro and special links. */}
      <g className="transit-network" aria-hidden="true">
        {networkEdges.map((edge) => {
          const path = edgePoints(edge, nodeById);
          const networkStyle = NETWORK_STYLE[edge.mode];
          return (
            <g key={`net-${edge.id}`}>
              <path
                d={pathData(path)}
                fill="none"
                stroke="#fbf8f0"
                strokeWidth={networkStyle.casing}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.55}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={pathData(path)}
                fill="none"
                stroke={MOVE_STYLE[edge.mode].colour}
                strokeWidth={networkStyle.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={networkStyle.dash ?? 'none'}
                opacity={networkStyle.opacity}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </g>

      {/* Completed moves from this turn stay as a thin trace until the next turn. */}
      <g className="move-trails" aria-hidden="true">
        {trails.map((trail) => (
          <path
            key={`trail-${trail.key}`}
            d={pathData(trail.points)}
            fill="none"
            stroke={trail.colour}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="7 5"
            opacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Legal move paths for the selected mode. */}
      <g className="move-paths">
        {options.map((option) => {
          const points = routeForOption(map, fugitive?.node ?? '', option);
          return (
            <g key={`${option.mode}-${option.to}-${option.via ?? ''}`}>
              <path
                d={pathData(points)}
                fill="none"
                stroke="#fbf8f0"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={pathData(points)}
                fill="none"
                stroke={style.colour}
                strokeWidth={4.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={style.dash ?? 'none'}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </g>

      {/* The move being revealed right now. */}
      {activeStep !== null && (
        <g className="active-move" aria-hidden="true">
          <path
            d={pathData(activeStep.points)}
            fill="none"
            stroke="#fbf8f0"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="active-move-line"
            d={pathData(activeStep.points)}
            fill="none"
            stroke={activeRole === 'fugitive' ? '#a93c36' : '#2f6fed'}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 6"
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#proto-arrow-${activeRole === 'fugitive' ? 'fugitive' : 'agent'})`}
          />
        </g>
      )}

      {/* Stations, numbers and class rings. */}
      <g>
        {map.graph.nodes.map((node) => {
          const radius = STATION_RADIUS[node.class] / scale;
          const stroke =
            node.class === 'terminal' ? '#a93c36' : node.class === 'hub' ? '#2f7a4f' : '#5a5347';
          const labelled = showAllLabels || importantNodes.has(node.id);
          const stops = stopsByNode.get(node.id) ?? [];

          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={radius} fill="#fbf8f0" stroke={stroke} strokeWidth={1.6 / scale} />
              {node.class !== 'street' && (
                <circle cx={node.x} cy={node.y} r={1.9 / scale} fill={stroke} />
              )}
              {showBadges &&
                stops.map((mode, index) => {
                  const badge = STOP_BADGE[mode];
                  const offset = (index - (stops.length - 1) / 2) * (8.4 / scale);
                  return (
                    <text
                      key={`badge-${node.id}-${mode}`}
                      x={node.x - radius - 3.8 / scale}
                      y={node.y + offset + 2.4 / scale}
                      textAnchor="end"
                      fontSize={8 / scale}
                      fontWeight={800}
                      fill={badge.colour}
                      paintOrder="stroke"
                      stroke="#f4efe2"
                      strokeWidth={2.4 / scale}
                      strokeLinejoin="round"
                    >
                      {badge.label}
                    </text>
                  );
                })}
              {labelled && (
                <text
                  x={node.x + radius + 2.5 / scale}
                  y={node.y - radius + 1 / scale}
                  fontSize={LABEL_FONT / scale}
                  fontWeight={600}
                  fill="#3d382e"
                  paintOrder="stroke"
                  stroke="#f4efe2"
                  strokeWidth={3.2 / scale}
                  strokeLinejoin="round"
                >
                  {node.id}
                </text>
              )}
              {node.facilities.length > 0 && (
                <text
                  x={node.x}
                  y={node.y + radius + 8 / scale}
                  textAnchor="middle"
                  fontSize={FACILITY_FONT / scale}
                  fontWeight={700}
                  fill={node.facilities.includes('black-market') ? '#7a4bb5' : '#2f7a4f'}
                  paintOrder="stroke"
                  stroke="#f4efe2"
                  strokeWidth={2.4 / scale}
                >
                  {node.facilities.includes('black-market') ? 'BM' : 'SH'}
                </text>
              )}
              {selectedStation === node.id && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 7.5 / scale}
                  fill="none"
                  stroke="#1e88a8"
                  strokeWidth={2.2}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={12 / scale}
                fill="transparent"
                className="station-hit"
                data-node={node.id}
                onClick={() => onInspectStation(node.id)}
              >
                <title>{`Station ${node.id} · ${node.class}${stops.length > 0 ? ` · ${stops.map((mode) => STOP_BADGE[mode].label).join(' ')}` : ' · taxi only'}`}</title>
              </circle>
            </g>
          );
        })}
      </g>

      {/* Destination rings sit above the station discs so the choice is obvious. */}
      <g className="destinations">
        {options.map((option) => {
          const destination = nodeById.get(option.to);
          if (!destination) return null;

          return (
            <g key={`dest-${option.mode}-${option.to}-${option.via ?? ''}`} className="destination">
              <circle
                cx={destination.x}
                cy={destination.y}
                r={DESTINATION_RADIUS * 1.35 / scale}
                fill={style.colour}
                opacity={0.16}
              />
              <circle
                cx={destination.x}
                cy={destination.y}
                r={DESTINATION_RADIUS / scale}
                fill="#fbf8f0"
                stroke={style.colour}
                strokeWidth={2.6 / scale}
              />
              <text
                x={destination.x}
                y={destination.y + 3 / scale}
                textAnchor="middle"
                fontSize={8.5 / scale}
                fontWeight={700}
                fill="#3b372e"
                pointerEvents="none"
              >
                {option.to}
              </text>
              <circle
                cx={destination.x}
                cy={destination.y}
                r={DESTINATION_HIT / scale}
                fill="transparent"
                className="dest-hit"
                data-node={option.to}
                onClick={() => onMove(option)}
                onPointerEnter={() => onHoverStation(option.to)}
                onPointerLeave={() => onHoverStation(null)}
              >
                <title>
                  {style.label} to {option.to}
                </title>
              </circle>
            </g>
          );
        })}
      </g>

      {/* The Agents' last-known node. It stays after they move away, until the
          next appearance replaces it. Deliberately not the true position. */}
      {ghostNode !== null && (() => {
        const node = nodeById.get(ghostNode);
        if (node === undefined) return null;
        const label = `F${stationNumber(ghostNode)}`;
        return (
          <g className="appearance-ghost" aria-hidden="true" pointerEvents="none">
            <circle cx={node.x} cy={node.y} r={18 / scale} fill="#a93c36" opacity={0.1} />
            <circle
              cx={node.x}
              cy={node.y}
              r={14.5 / scale}
              fill="none"
              stroke="#a93c36"
              strokeWidth={2}
              strokeDasharray="4 3"
              opacity={0.8}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={node.x} cy={node.y} r={8.5 / scale} fill="#a93c36" opacity={0.3} />
            <text
              x={node.x - 12 / scale}
              y={node.y + 3 / scale}
              textAnchor="end"
              fontSize={9 / scale}
              fontWeight={800}
              fill="#8e2c26"
              paintOrder="stroke"
              stroke="#f4efe2"
              strokeWidth={2.6 / scale}
              strokeLinejoin="round"
            >
              {label}
            </text>
          </g>
        );
      })()}

      {/* Tokens. Agents are visible from the Fugitive's seat (prototype rule). */}
      <g className="tokens">
        {agents.map((agent, index) => {
          const node = nodeById.get(agent.node);
          if (!node) return null;
          const isActive = activeStep?.seatId === agent.id;

          return (
            <g key={agent.id}>
              {isActive && activeStep !== null ? (
                <AnimatedToken step={activeStep}>
                  <AgentToken
                    x={node.x}
                    y={node.y}
                    scale={scale}
                    index={index}
                    active
                  />
                </AnimatedToken>
              ) : (
                <g transform={`translate(${node.x} ${node.y})`}>
                  <AgentToken x={node.x} y={node.y} scale={scale} index={index} active={false} />
                </g>
              )}
            </g>
          );
        })}

        {fugitive && (() => {
          const node = nodeById.get(fugitive.node);
          if (!node) return null;
          const isActive = activeStep?.seatId === fugitive.id;

          return isActive && activeStep !== null ? (
            <AnimatedToken step={activeStep}>
              <FugitiveToken x={node.x} y={node.y} scale={scale} active />
            </AnimatedToken>
          ) : (
            <g transform={`translate(${node.x} ${node.y})`}>
              <FugitiveToken x={node.x} y={node.y} scale={scale} active={false} />
            </g>
          );
        })()}
      </g>

      {appearanceNode !== null && (() => {
        const node = nodeById.get(appearanceNode);
        if (!node) return null;
        return (
          <g className="appearance-ring" aria-hidden="true">
            <circle cx={node.x} cy={node.y} r={px(32)} fill="#a93c36" opacity={0.12} />
            <circle
              cx={node.x}
              cy={node.y}
              r={px(31)}
              fill="none"
              stroke="#fbf8f0"
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={px(31)}
              fill="none"
              stroke="#a93c36"
              strokeWidth={2.8}
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={px(20)}
              fill="none"
              stroke="#a93c36"
              strokeWidth={1.8}
              opacity={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })()}
    </g>
  );
}

const MemoMapContent = memo(PrototypeMapContent);

function routeForOption(
  map: GeneratedMap,
  from: NodeId,
  option: PrototypeMoveOption,
): readonly MapPoint[] {
  if (from === '') return [];
  return routePoints(map.graph, from, option.to, option.mode, option.via);
}

interface PrototypeMapProps {
  readonly map: GeneratedMap;
  readonly seats: readonly PrototypeSeat[];
  readonly selectedMode: MobilityOption;
  readonly legal: readonly PrototypeMoveOption[];
  readonly onMove: (option: PrototypeMoveOption) => void;
  readonly onInspectStation: (node: NodeId) => void;
  readonly onHoverStation: (node: NodeId | null) => void;
  readonly appearanceNode: NodeId | null;
  readonly ghostNode: NodeId | null;
  readonly viewBox: string;
  readonly scale: number;
  readonly activeStep: MoveStep | null;
  readonly trails: readonly Trail[];
  readonly selectedStation: NodeId | null;
}

/** The live layer over the city plate: stations, routes, tokens and input. */
export function PrototypeMap({
  map,
  seats,
  selectedMode,
  legal,
  onMove,
  onInspectStation,
  onHoverStation,
  appearanceNode,
  ghostNode,
  viewBox,
  scale,
  activeStep,
  trails,
  selectedStation,
}: PrototypeMapProps): React.JSX.Element {
  return (
    <svg
      className="map-overlay"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-label="Cathedral Quarter transit map"
    >
      <MemoMapContent
        map={map}
        seats={seats}
        selectedMode={selectedMode}
        legal={legal}
        onMove={onMove}
        onInspectStation={onInspectStation}
        onHoverStation={onHoverStation}
        appearanceNode={appearanceNode}
        ghostNode={ghostNode}
        scale={scale}
        activeStep={activeStep}
        trails={trails}
        selectedStation={selectedStation}
      />
    </svg>
  );
}
