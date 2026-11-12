import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { GeneratedMap, GraphEdge, GraphNode, MapPoint, NodeId } from '@x-yard/map-generator';
import type {
  MobilityOption,
  PrototypeJob,
  PrototypeJobIcon,
  PrototypeMoveOption,
  PrototypeSeat,
} from '@x-yard/game-core';

import type { RtsTheme } from '../lab/rts/rtsTheme';

import { pathData } from './city';
import { JobGlyph } from './JobIcon';
import {
  NETWORK_STYLE,
  edgePoints,
  modeOffset,
  offsetPolyline,
  routeColour,
  sortedNetworkEdges,
} from './routes';
import {
  MOVE_STYLE,
  STEP_LEAD_MS,
  pointAtProgress,
  routePoints,
  type MoveStep,
  type Trail,
} from './motion';

/*
 * Overlay sizes are screen pixels; the camera scale converts them to map units.
 * The same grammar is used at every zoom: a numbered disc for every station, a
 * coloured arc for a bus/metro/special stop, and a keylined route ribbon.
 */
const DISC_FULL = 13;
const DISC_MID = 8;
const DISC_SMALL = 4.5;
const COLLAR_GAP = 6.5;
const COLLAR_WIDTH = 3.2;
const COLLAR_KEYLINE = 4.9;
const COLLAR_PAPER = 8;
const AGENT_RADIUS = 10.5;
const FUGITIVE_RADIUS = 13.5;
const DESTINATION_RADIUS = 25;
const DESTINATION_GLOW = 33;
const DESTINATION_HIT = 30;
const LANDMARK_LABEL_FONT = 10;
const LANDMARK_LABEL_HEIGHT = 19;

/** Fixed rim slots: the arc position carries the mode even without colour. */
const COLLAR_SLOT: Readonly<
  Record<'bus' | 'underground' | 'special', { readonly from: number; readonly to: number }>
> = {
  bus: { from: -124, to: -56 },
  underground: { from: 56, to: 124 },
  special: { from: -32, to: 32 },
};

const MODE_LABEL: Readonly<Record<'bus' | 'underground' | 'special', string>> = {
  bus: 'bus',
  underground: 'metro',
  special: 'special',
};

/** How far above its anchor a landmark's plaque sits, in map units. */
const LANDMARK_LIFT: Readonly<Record<string, number>> = {
  cathedral: 52,
  station: 40,
  market: 26,
  square: 26,
  museum: 30,
  townHall: 37,
  church: 34,
  university: 30,
  theatre: 24,
  hospital: 20,
  gasworks: 26,
  sportsGround: 12,
  gardens: 14,
};

const ANCHOR_LANDMARKS: ReadonlySet<string> = new Set(['cathedral', 'station', 'market', 'square']);

const STREET_WORD: Readonly<Record<string, string>> = {
  cathedral: 'Cathedral',
  station: 'Station',
  market: 'Market',
  square: 'Square',
  museum: 'Museum',
  townHall: 'Town Hall',
  church: 'Church',
  university: 'University',
  gardens: 'Gardens',
  theatre: 'Theatre',
  hospital: 'Hospital',
  gasworks: 'Gasworks',
  sportsGround: 'Sports Ground',
};

const STREET_SUFFIX = ['Road', 'Lane', 'Walk', 'Approach', 'Row', 'Street'] as const;

function describeArc(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number): string {
  const from = (fromDeg * Math.PI) / 180;
  const to = (toDeg * Math.PI) / 180;
  const start = { x: cx + Math.cos(from) * radius, y: cy + Math.sin(from) * radius };
  const end = { x: cx + Math.cos(to) * radius, y: cy + Math.sin(to) * radius };
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function stationNumber(id: NodeId): string {
  return id.replace(/^[^0-9]*/, '');
}

interface OverlayBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function parseOverlayView(viewBox: string): OverlayBox | null {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  const x = parts[0] as number;
  const y = parts[1] as number;
  const width = parts[2] as number;
  const height = parts[3] as number;
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}

function pointInView(point: { readonly x: number; readonly y: number }, view: OverlayBox | null): boolean {
  if (view === null) return true;
  return point.x >= view.minX - 80 && point.x <= view.maxX + 80 && point.y >= view.minY - 80 && point.y <= view.maxY + 80;
}

function pathInView(points: readonly MapPoint[], view: OverlayBox | null): boolean {
  if (view === null) return true;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return maxX >= view.minX - 80 && minX <= view.maxX + 80 && maxY >= view.minY - 80 && minY <= view.maxY + 80;
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
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly index: number;
  readonly active: boolean;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const radius = AGENT_RADIUS / scale;
  return (
    <g>
      {active && <circle className="token-halo" cx={0} cy={0} r={radius * 1.9} fill={theme.agent} />}
      <circle cx={0} cy={0} r={radius} fill={theme.agent} stroke={theme.label} strokeWidth={2.1 / scale} />
      <text
        x={0}
        y={2.9 / scale}
        textAnchor="middle"
        fontSize={7.5 / scale}
        fontWeight={800}
        fill={theme.stationPad}
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
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly active: boolean;
  readonly theme: RtsTheme;
}): React.JSX.Element {
  const radius = FUGITIVE_RADIUS / scale;
  return (
    <g>
      {active && <circle className="token-halo fugitive" cx={0} cy={0} r={radius * 1.85} fill={theme.fugitive} />}
      <circle cx={0} cy={0} r={radius} fill={theme.fugitive} stroke={theme.label} strokeWidth={2.3 / scale} />
      <circle cx={0} cy={0} r={radius * 0.63} fill="none" stroke={theme.stationPad} strokeWidth={1.2 / scale} />
      <text
        x={0}
        y={3.6 / scale}
        textAnchor="middle"
        fontSize={9.5 / scale}
        fontWeight={800}
        fill={theme.stationPad}
      >
        F
      </text>
      <circle cx={0} cy={0} r={radius + 12 / scale} fill="transparent" opacity={0}>
        <title>{`Vulture at ${x.toFixed(0)},${y.toFixed(0)}`}</title>
      </circle>
    </g>
  );
}

interface NetworkLayerProps {
  readonly edges: readonly GraphEdge[];
  readonly nodeById: ReadonlyMap<NodeId, MapPoint>;
  readonly scale: number;
  readonly theme: RtsTheme;
}

/**
 * The permanent transit network. This layer depends on the quantised scale and
 * a coarse culling window only, so a camera pan does not rebuild hundreds of
 * path strings: the parent's `viewBox` still moves the whole SVG.
 */
const NetworkLayer = memo(function NetworkLayer({
  edges,
  nodeById,
  scale,
  theme,
}: NetworkLayerProps): React.JSX.Element {
  return (
    <g className="transit-network" aria-hidden="true">
      {edges.map((edge) => {
        const path = offsetPolyline(edgePoints(edge, nodeById), modeOffset(edge.mode), scale);
        const networkStyle = NETWORK_STYLE[edge.mode];
        return (
          <g key={`net-${edge.id}`}>
            <path
              d={pathData(path)}
              fill="none"
              stroke={theme.routeCasing ?? theme.shadow}
              strokeWidth={networkStyle.casing}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={networkStyle.dash ?? 'none'}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={pathData(path)}
              fill="none"
              stroke={routeColour(theme, edge.mode)}
              strokeWidth={networkStyle.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={networkStyle.dash ?? 'none'}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </g>
  );
});

interface StationLayerProps {
  readonly nodes: readonly GraphNode[];
  readonly scale: number;
  readonly theme: RtsTheme;
  readonly selectedStation: NodeId | null;
  readonly onInspectStation: (node: NodeId) => void;
}

/** Numbered discs, mode collars and the station hit targets. */
const StationLayer = memo(function StationLayer({
  nodes,
  scale,
  theme,
  selectedStation,
  onInspectStation,
}: StationLayerProps): React.JSX.Element {
  const discRadius = scale >= 1.0 ? DISC_FULL : scale >= 0.55 ? DISC_MID : DISC_SMALL;

  return (
    <g>
      {nodes.map((node) => {
        const radius = discRadius / scale;
        const modes: ('bus' | 'underground' | 'special')[] = [];
        for (const mode of node.modes) if (mode !== 'taxi') modes.push(mode);
        const showNumber = discRadius >= 8;
        const showCollar = discRadius >= DISC_FULL - 1;
        const numberSize = Math.min(11.5, discRadius * 0.88);

        return (
          <g key={node.id}>
            {showCollar &&
              modes.map((mode) => {
                const slot = COLLAR_SLOT[mode];
                const collarRadius = (discRadius + COLLAR_GAP) / scale;
                const d = describeArc(node.x, node.y, collarRadius, slot.from, slot.to);
                return (
                  <g key={`collar-${node.id}-${mode}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={theme.ground}
                      strokeWidth={COLLAR_PAPER / scale}
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={theme.label}
                      strokeWidth={COLLAR_KEYLINE / scale}
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={routeColour(theme, mode)}
                      strokeWidth={COLLAR_WIDTH / scale}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            <circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={theme.stationDisc ?? theme.stationPad}
              stroke={theme.label}
              strokeWidth={2 / scale}
            />
            {showNumber && (
              <text
                x={node.x}
                y={node.y + (numberSize * 0.36) / scale}
                textAnchor="middle"
                fontSize={numberSize / scale}
                fontWeight={800}
                fontFamily="Georgia, 'Iowan Old Style', 'Palatino Linotype', serif"
                fill={theme.label}
                pointerEvents="none"
              >
                {stationNumber(node.id)}
              </text>
            )}
            {selectedStation === node.id && (
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 8 / scale}
                fill="none"
                stroke={theme.label}
                strokeWidth={2 / scale}
                opacity={0.7}
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r={14 / scale}
              fill="transparent"
              className="station-hit"
              data-node={node.id}
              onClick={() => onInspectStation(node.id)}
            >
              <title>{`Station ${stationNumber(node.id)} · ${node.class}${modes.length > 0 ? ` · ${modes.map((mode) => MODE_LABEL[mode]).join(' ')}` : ' · taxi only'}`}</title>
            </circle>
          </g>
        );
      })}
    </g>
  );
});

interface StreetLabelLayerProps {
  readonly labels: readonly {
    readonly key: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  }[];
  readonly scale: number;
  readonly theme: RtsTheme;
}

const StreetLabelLayer = memo(function StreetLabelLayer({
  labels,
  scale,
  theme,
}: StreetLabelLayerProps): React.JSX.Element {
  return (
    <g className="street-labels" aria-hidden="true" pointerEvents="none">
      {labels.map((street) => (
        <text
          key={`street-${street.key}`}
          transform={`translate(${street.x.toFixed(1)} ${street.y.toFixed(1)}) rotate(${street.angle.toFixed(1)})`}
          textAnchor="middle"
          fontSize={9 / scale}
          fontWeight={700}
          fontFamily="Georgia, 'Iowan Old Style', 'Palatino Linotype', serif"
          letterSpacing={1.1 / scale}
          fill={theme.label}
          paintOrder="stroke"
          stroke={theme.stationPad}
          strokeWidth={2.8 / scale}
          strokeLinejoin="round"
          opacity={0.92}
        >
          {street.name.toUpperCase()}
        </text>
      ))}
    </g>
  );
});

interface PrototypeMapContentProps {
  readonly map: GeneratedMap;
  readonly theme: RtsTheme;
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
  readonly viewBox: string;
  readonly showFugitive: boolean;
  readonly moveSource: NodeId;
  readonly jobs: readonly PrototypeJob[];
  readonly activeJobId: string | null;
  readonly selectedJobId: string | null;
  readonly jobView: 'fugitive' | 'agent';
  /** Board/Vintage paint the permanent network in the Canvas plate. */
  readonly plateRoutes: boolean;
}

function PrototypeMapContent({
  map,
  theme,
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
  viewBox,
  showFugitive,
  moveSource,
  jobs,
  activeJobId,
  selectedJobId,
  jobView,
  plateRoutes,
}: PrototypeMapContentProps): React.JSX.Element {
  const fugitive = seats[0];
  const agents = seats.slice(1);
  const style = MOVE_STYLE[selectedMode];
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const view = useMemo(() => parseOverlayView(viewBox), [viewBox]);

  const activeJob = jobs.find((job) => job.id === activeJobId && job.status === 'active');
  const selectedJob = jobs.find(
    (job) =>
      job.id === selectedJobId && (job.status === 'available' || job.status === 'active'),
  );
  const jobMarkers: readonly {
    readonly key: string;
    readonly kind: 'pickup' | 'destination';
    readonly node: NodeId;
    readonly icon: PrototypeJobIcon;
    readonly title: string;
    readonly selected: boolean;
  }[] = (() => {
    if (jobView === 'agent') {
      return activeJob === undefined
        ? []
        : [
            {
              key: `pickup-${activeJob.id}`,
              kind: 'pickup' as const,
              node: activeJob.pickup,
              icon: activeJob.icon,
              title: activeJob.title,
              selected: false,
            },
          ];
    }

    const markers: {
      key: string;
      kind: 'pickup' | 'destination';
      node: NodeId;
      icon: PrototypeJobIcon;
      title: string;
      selected: boolean;
    }[] = [];
    for (const job of jobs) {
      if (job.status !== 'available') continue;
      markers.push({
        key: `pickup-${job.id}`,
        kind: 'pickup',
        node: job.pickup,
        icon: job.icon,
        title: job.title,
        selected: job.id === selectedJob?.id,
      });
    }
    if (activeJob !== undefined) {
      markers.push({
        key: `pickup-${activeJob.id}`,
        kind: 'pickup',
        node: activeJob.pickup,
        icon: activeJob.icon,
        title: activeJob.title,
        selected: activeJob.id === selectedJob?.id,
      });
      markers.push({
        key: `destination-${activeJob.id}`,
        kind: 'destination',
        node: activeJob.destination,
        icon: activeJob.icon,
        title: activeJob.title,
        selected: activeJob.id === selectedJob?.id,
      });
    }
    if (selectedJob !== undefined && selectedJob.id !== activeJob?.id) {
      markers.push({
        key: `destination-${selectedJob.id}`,
        kind: 'destination',
        node: selectedJob.destination,
        icon: selectedJob.icon,
        title: selectedJob.title,
        selected: true,
      });
    }
    return markers;
  })();

  /*
   * The static layers (network, station discs, street labels) are culled on a
   * coarse window and sized from a quantised scale. Both are stable while the
   * camera pans, so those layers bail out of React reconciliation; only the
   * parent SVG's `viewBox` changes. Without this, every pointer event rebuilt
   * every route path on the board.
   */
  const cullKey = useMemo(() => {
    if (view === null) return 'all';
    const step = 256;
    const pad = 320;
    return [
      Math.floor((view.minX - pad) / step),
      Math.floor((view.minY - pad) / step),
      Math.ceil((view.maxX + pad) / step),
      Math.ceil((view.maxY + pad) / step),
    ].join(',');
  }, [view]);
  const cullView = useMemo<OverlayBox | null>(() => {
    if (cullKey === 'all') return null;
    const step = 256;
    const [minX, minY, maxX, maxY] = cullKey.split(',').map(Number);
    return {
      minX: (minX ?? 0) * step,
      minY: (minY ?? 0) * step,
      maxX: (maxX ?? 0) * step,
      maxY: (maxY ?? 0) * step,
    };
  }, [cullKey]);
  /*
   * Station discs and route offsets are sized in world units so they stay a
   * constant size on screen. Recomputing them on every zoom frame would rebuild
   * every station and path in the graph; instead the static layers keep the
   * last settled scale and scale with the map during the gesture, then snap
   * once the camera stops.
   */
  const [renderScale, setRenderScale] = useState(scale);
  useEffect(() => {
    const timer = window.setTimeout(() => setRenderScale(scale), 180);
    return () => window.clearTimeout(timer);
  }, [scale]);
  const scaleBucket = renderScale;

  /*
   * The station and network layers deliberately render the whole graph. A
   * culling window that changes while the camera pans makes React rebuild
   * thousands of paths in the middle of a drag; a stable DOM lets the browser
   * clip and paint it. `cullNodes` is still used by the street-label search,
   * which needs to know what is on screen.
   */
  const visibleNodes = map.graph.nodes;
  const cullNodes = useMemo(
    () => (cullView === null ? visibleNodes : visibleNodes.filter((node) => pointInView(node, cullView))),
    [cullView, visibleNodes],
  );
  const options = legal.filter(
    (option) =>
      option.mode === selectedMode && pointInView(nodeById.get(option.to) ?? { x: 0, y: 0 }, view),
  );
  const networkEdges = useMemo(() => sortedNetworkEdges(map.graph.edges), [map.graph.edges]);
  const visibleEdges = networkEdges;
  const px = (value: number): number => value / scale;
  const sparseMap = scaleBucket < 0.62 && map.graph.edges.length > 400;
  const drawEdges = useMemo(
    () => (sparseMap ? visibleEdges.filter((edge) => edge.mode !== 'taxi') : visibleEdges),
    [sparseMap, visibleEdges],
  );
  const activeRole = activeStep?.role ?? null;

  // Street names are authored from the nearest landmark. They are presentation
  // only: no street data is added to the map. Six at most, play zoom only.
  const streetLabels = useMemo(() => {
    if (scaleBucket < 0.95) return [];
    const used = new Set<string>();
    const offset = 18 / scaleBucket;
    const candidates = map.city.streets
      .filter((street) => street.rank >= 1 && street.path.length >= 2)
      .map((street) => {
        let length = 0;
        for (let index = 1; index < street.path.length; index += 1) {
          const a = street.path[index - 1];
          const b = street.path[index];
          if (a === undefined || b === undefined) continue;
          length = Math.max(length, Math.hypot(b.x - a.x, b.y - a.y));
        }
        return { street, length };
      })
      .filter((candidate) => candidate.length > 24)
      .sort((left, right) => right.street.rank - left.street.rank || right.length - left.length);

    const labels: { key: string; name: string; x: number; y: number; angle: number }[] = [];
    for (const candidate of candidates) {
      if (labels.length >= 6) break;
      let segment: { a: MapPoint; b: MapPoint; length: number } | null = null;
      for (let index = 1; index < candidate.street.path.length; index += 1) {
        const a = candidate.street.path[index - 1];
        const b = candidate.street.path[index];
        if (a === undefined || b === undefined) continue;
        if (!pointInView(a, cullView) || !pointInView(b, cullView)) continue;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (segment === null || length > segment.length) segment = { a, b, length };
      }
      if (segment === null) continue;
      const x = (segment.a.x + segment.b.x) / 2;
      const y = (segment.a.y + segment.b.y) / 2;
      if (cullNodes.some((node) => (node.x - x) ** 2 + (node.y - y) ** 2 < offset ** 2)) continue;

      let nearest: { kind: string } | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const landmark of map.city.landmarks) {
        const distance = (landmark.at.x - x) ** 2 + (landmark.at.y - y) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = landmark;
        }
      }
      if (nearest === null) continue;
      const word = STREET_WORD[nearest.kind] ?? 'Quarter';
      let name = '';
      for (const suffix of STREET_SUFFIX) {
        const option = `${word} ${suffix}`;
        if (!used.has(option)) {
          name = option;
          break;
        }
      }
      if (name === '') continue;
      if (segment.length * scaleBucket < name.length * 5.6) continue;
      used.add(name);
      let angle = (Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x) * 180) / Math.PI;
      if (angle > 90 || angle < -90) angle += 180;
      labels.push({ key: candidate.street.id, name, x, y, angle });
    }
    return labels;
  }, [cullNodes, cullView, map.city.landmarks, map.city.streets, scaleBucket]);

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
          <path d="M0 0 L10 5 L0 10 z" fill={theme.agent} />
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
          <path d="M0 0 L10 5 L0 10 z" fill={theme.fugitive} />
        </marker>
      </defs>

      {/* Board and Vintage paint the permanent network in the Canvas plate, under
          the houses. Basic and the RTS skins still need this overlay layer. */}
      {!plateRoutes && (
        <NetworkLayer edges={drawEdges} nodeById={nodeById} scale={scaleBucket} theme={theme} />
      )}

      {/* Completed moves from this turn stay as a thin trace until the next turn. */}
      <g className="move-trails" aria-hidden="true">
        {trails.filter((trail) => pathInView(trail.points, view)).map((trail) => (
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
          const points = offsetPolyline(routeForOption(map, moveSource, option), modeOffset(option.mode), scale);
          const colour = routeColour(theme, option.mode);
          return (
            <g key={`${option.mode}-${option.to}`}>
              {/* A glow and a thin centreline, not a second ribbon: the
                  permanent route beneath stays legible and the legal move is
                  still unmistakable. */}
              <path
                className="move-glow"
                d={pathData(points)}
                fill="none"
                stroke={colour}
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.18}
                vectorEffect="non-scaling-stroke"
              />
              <path
                className="move-core"
                d={pathData(points)}
                fill="none"
                stroke={colour}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </g>

      {/* The move being revealed right now. */}
      {activeStep !== null && pathInView(activeStep.points, view) && (
        <g className="active-move" aria-hidden="true">
          <path
            d={pathData(offsetPolyline(activeStep.points, modeOffset(activeStep.mode), scale))}
            fill="none"
            stroke={theme.ground}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="active-move-line"
            d={pathData(offsetPolyline(activeStep.points, modeOffset(activeStep.mode), scale))}
            fill="none"
            stroke={activeRole === 'fugitive' ? theme.fugitive : theme.agent}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 6"
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#proto-arrow-${activeRole === 'fugitive' ? 'fugitive' : 'agent'})`}
          />
        </g>
      )}

      {/* Street names in the plate's lettering, above the roads but below the
          station discs. */}
      <StreetLabelLayer labels={streetLabels} scale={scaleBucket} theme={theme} />

      {/* Stations: one numbered disc, with a fixed-slot colour arc for bus,
          metro and special. Taxi is universal, so a plain disc is the norm. */}
      <StationLayer
        nodes={visibleNodes}
        scale={scaleBucket}
        theme={theme}
        selectedStation={selectedStation}
        onInspectStation={onInspectStation}
      />

      {/* Legal destinations: an oversized landing pad around the disc. */}
      <g className="destinations">
        {options.map((option) => {
          const destination = nodeById.get(option.to);
          if (!destination) return null;
          const colour = routeColour(theme, option.mode);

          return (
            <g key={`dest-${option.mode}-${option.to}`} className="destination">
              <circle
                cx={destination.x}
                cy={destination.y}
                r={DESTINATION_GLOW / scale}
                fill={colour}
                opacity={0.14}
              />
              <circle
                cx={destination.x}
                cy={destination.y}
                r={DESTINATION_RADIUS / scale}
                fill="none"
                stroke={colour}
                strokeWidth={2.8 / scale}
              />
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
                  {style.label} to {stationNumber(option.to)}
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
        if (node === undefined || !pointInView(node, view)) return null;
        const label = `F${stationNumber(ghostNode)}`;
        return (
          <g className="appearance-ghost" aria-hidden="true" pointerEvents="none">
            <circle cx={node.x} cy={node.y} r={18 / scale} fill={theme.fugitive} opacity={0.1} />
            <circle
              cx={node.x}
              cy={node.y}
              r={14.5 / scale}
              fill="none"
              stroke={theme.fugitive}
              strokeWidth={2}
              strokeDasharray="4 3"
              opacity={0.8}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={node.x} cy={node.y} r={8.5 / scale} fill={theme.fugitive} opacity={0.3} />
            <text
              x={node.x - 12 / scale}
              y={node.y + 3 / scale}
              textAnchor="end"
              fontSize={9 / scale}
              fontWeight={800}
              fill={theme.fugitive}
              paintOrder="stroke"
              stroke={theme.stationPad}
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
          if (!node || !pointInView(node, view)) return null;
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
                    theme={theme}
                  />
                </AnimatedToken>
              ) : (
                <g transform={`translate(${node.x} ${node.y})`}>
                  <AgentToken x={node.x} y={node.y} scale={scale} index={index} active={false} theme={theme} />
                </g>
              )}
            </g>
          );
        })}

        {showFugitive && fugitive && (() => {
          const node = nodeById.get(fugitive.node);
          if (!node || !pointInView(node, view)) return null;
          const isActive = activeStep?.seatId === fugitive.id;

          return isActive && activeStep !== null ? (
            <AnimatedToken step={activeStep}>
              <FugitiveToken x={node.x} y={node.y} scale={scale} active theme={theme} />
            </AnimatedToken>
          ) : (
            <g transform={`translate(${node.x} ${node.y})`}>
              <FugitiveToken x={node.x} y={node.y} scale={scale} active={false} theme={theme} />
            </g>
          );
        })()}
      </g>

      {appearanceNode !== null && (() => {
        const node = nodeById.get(appearanceNode);
        if (!node || !pointInView(node, view)) return null;
        return (
          <g className="appearance-ring" aria-hidden="true">
            <circle cx={node.x} cy={node.y} r={px(32)} fill={theme.fugitive} opacity={0.12} />
            <circle
              cx={node.x}
              cy={node.y}
              r={px(31)}
              fill="none"
              stroke={theme.stationPad}
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={px(31)}
              fill="none"
              stroke={theme.fugitive}
              strokeWidth={2.8}
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={px(20)}
              fill="none"
              stroke={theme.fugitive}
              strokeWidth={1.8}
              opacity={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })()}
      {/* Landmark plaques. Printed on top: they are how a player navigates the
          quarter, and the map data already carries the names. */}
      <g className="landmark-labels" aria-hidden="true" pointerEvents="none">
        {map.city.landmarks.map((landmark) => {
          if (!pointInView(landmark.at, view)) return null;
          // At whole-city zoom only the four anchor landmarks are labelled; ten
          // plaques at that scale collide and turn the plate into a legend.
          if (scale < 0.9 && !ANCHOR_LANDMARKS.has(landmark.kind)) return null;
          const lift = LANDMARK_LIFT[landmark.kind] ?? 26;
          const baseY = landmark.at.y - lift;
          if (view !== null && (baseY - LANDMARK_LABEL_HEIGHT / scale < view.minY || baseY > view.maxY)) return null;
          const label = landmark.label.toUpperCase();
          const width = (label.length * 7.2 + 18) / scale;
          const height = LANDMARK_LABEL_HEIGHT / scale;
          // Keep the plaque on screen when a landmark sits near the edge.
          const minX = view === null ? landmark.at.x : view.minX + width / 2;
          const maxX = view === null ? landmark.at.x : view.maxX - width / 2;
          const labelX = maxX < minX ? landmark.at.x : Math.min(Math.max(landmark.at.x, minX), maxX);
          return (
            <g key={`landmark-label-${landmark.id}`}>
              <rect
                x={labelX - width / 2}
                y={baseY - height}
                width={width}
                height={height}
                rx={2 / scale}
                fill={theme.stationPad}
                stroke={theme.label}
                strokeWidth={1.6 / scale}
              />
              <text
                x={labelX}
                y={baseY - height + 13 / scale}
                textAnchor="middle"
                fontSize={LANDMARK_LABEL_FONT / scale}
                fontWeight={700}
                fontFamily="Georgia, 'Iowan Old Style', 'Palatino Linotype', serif"
                letterSpacing={1.2 / scale}
                fill={theme.label}
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>
      {/* Job markers: the Fugitive sees pickups and the selected drop; Agents
          see only a pickup once it has been made public. */}
      <g className="job-markers" aria-hidden="true" pointerEvents="none">
        {jobMarkers.map((marker) => {
          const node = nodeById.get(marker.node);
          if (node === undefined || !pointInView(node, view)) return null;
          const badgeX = node.x + (marker.kind === 'pickup' ? 15 / scale : 0);
          const badgeY = marker.kind === 'pickup' ? node.y + 22 / scale : node.y - 26 / scale;
          const stemY = marker.kind === 'pickup' ? node.y + 10 / scale : node.y - 10 / scale;
          const badgeR = 11 / scale;
          const glyph = 12 / scale;
          const outline = theme.outline ?? theme.shadow;
          return (
            <g
              key={marker.key}
              className={`job-marker kind-${marker.kind}${marker.selected ? ' selected' : ''}`}
            >
              {marker.kind === 'destination' && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={19 / scale}
                  fill="none"
                  stroke={theme.accent}
                  strokeWidth={2 / scale}
                  strokeDasharray="4 3"
                />
              )}
              <line
                x1={node.x}
                y1={stemY}
                x2={badgeX}
                y2={badgeY}
                stroke={outline}
                strokeWidth={1.1 / scale}
                opacity={0.7}
              />
              <circle
                cx={badgeX}
                cy={badgeY}
                r={badgeR}
                fill={theme.stationPad}
                stroke={marker.selected ? theme.accent : outline}
                strokeWidth={(marker.selected ? 2.4 : 1.4) / scale}
              />
              <g
                transform={`translate(${badgeX - glyph / 2} ${badgeY - glyph / 2}) scale(${glyph / 16})`}
                color={theme.label}
              >
                {marker.kind === 'pickup' ? (
                  <JobGlyph icon={marker.icon} />
                ) : (
                  <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 13 V3" />
                    <path d="M4 3 H12 L9.5 6 L12 9 H4" />
                  </g>
                )}
              </g>
            </g>
          );
        })}
      </g>


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
  return routePoints(map.graph, from, option.to, option.mode);
}

interface PrototypeMapProps {
  readonly map: GeneratedMap;
  readonly theme: RtsTheme;
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
  readonly showFugitive: boolean;
  readonly moveSource: NodeId;
  readonly jobs: readonly PrototypeJob[];
  readonly activeJobId: string | null;
  readonly selectedJobId: string | null;
  readonly jobView: 'fugitive' | 'agent';
  readonly plateRoutes: boolean;
}

/** The live layer over the city plate: stations, routes, tokens and input. */
export function PrototypeMap({
  map,
  theme,
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
  showFugitive,
  moveSource,
  jobs,
  activeJobId,
  selectedJobId,
  jobView,
  plateRoutes,
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
        theme={theme}
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
        viewBox={viewBox}
        showFugitive={showFugitive}
        moveSource={moveSource}
        jobs={jobs}
        activeJobId={activeJobId}
        selectedJobId={selectedJobId}
        jobView={jobView}
        plateRoutes={plateRoutes}
      />
    </svg>
  );
}
