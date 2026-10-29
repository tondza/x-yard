/**
 * A city fragment for the visual-direction lab.
 *
 * The city itself comes from the shared `CitySkinBase`; this wrapper adds the
 * same game overlay in each theme (transit network, stations, tokens, ghost) so
 * the comparison includes route/token legibility, not just the skyline.
 *
 * @module apps/web/lab/CityFragment
 */

import { useMemo } from 'react';

import type { GeneratedMap, GraphEdge, MapPoint, NodeId } from '@x-yard/map-generator';

import { pathData } from '../prototype/city';
import { CityBaseForCrop, type CityCrop } from '../prototype/skins/CitySkinBase';
import type { VisualTheme } from '../prototype/skins/visualThemes';

export const FRAGMENT_CROP: CityCrop = { x: 250, y: 100, width: 750, height: 520 };

const NETWORK_WIDTH: Readonly<Record<GraphEdge['mode'], number>> = {
  taxi: 1.45,
  bus: 2.2,
  underground: 2.9,
  special: 1.8,
};

const NETWORK_DASH: Readonly<Record<GraphEdge['mode'], string | undefined>> = {
  taxi: undefined,
  bus: undefined,
  underground: undefined,
  special: '5 4',
};

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

function Network({
  map,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const casing = theme.outline ?? (theme.night ? theme.background : '#fbf8f0');
  const legalEdge = map.graph.edges.find(
    (edge) =>
      edge.mode === 'taxi' &&
      ((edge.a === 'n8' && edge.b === 'n11') || (edge.a === 'n11' && edge.b === 'n8')),
  );

  return (
    <g>
      {[...map.graph.edges]
        .sort((left, right) => NETWORK_WIDTH[left.mode] - NETWORK_WIDTH[right.mode])
        .map((edge) => {
          const path = edgePoints(edge, nodeById);
          const colour = theme.route[edge.mode];
          return (
            <g key={`edge-${edge.id}`}>
              {theme.night && (
                <path
                  d={pathData(path)}
                  fill="none"
                  stroke={colour}
                  strokeWidth={NETWORK_WIDTH[edge.mode] + 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.18}
                />
              )}
              <path
                d={pathData(path)}
                fill="none"
                stroke={casing}
                strokeWidth={NETWORK_WIDTH[edge.mode] + 2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathData(path)}
                fill="none"
                stroke={colour}
                strokeWidth={NETWORK_WIDTH[edge.mode]}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={NETWORK_DASH[edge.mode]}
                opacity={theme.night ? 0.95 : 0.88}
              />
            </g>
          );
        })}

      {legalEdge !== undefined && (
        <g>
          <path
            d={pathData(edgePoints(legalEdge, nodeById))}
            fill="none"
            stroke={theme.station.fill}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.9}
          />
          <path
            d={pathData(edgePoints(legalEdge, nodeById))}
            fill="none"
            stroke={theme.route.taxi}
            strokeWidth={4.2}
            strokeLinecap="round"
            opacity={0.95}
          />
        </g>
      )}
    </g>
  );
}

function Stations({
  map,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const stops = useMemo(() => {
    const found = new Map<NodeId, ('bus' | 'underground' | 'special')[]>();
    for (const edge of map.graph.edges) {
      if (edge.mode === 'taxi') continue;
      for (const id of [edge.a, edge.b]) {
        const current = found.get(id) ?? [];
        if (!current.includes(edge.mode)) current.push(edge.mode);
        found.set(id, current);
      }
    }
    for (const modes of found.values()) modes.sort();
    return found;
  }, [map]);
  const badgeColour = {
    bus: theme.route.bus,
    underground: theme.route.underground,
    special: theme.route.special,
  } as const;
  const badgeLabel = { bus: 'B', underground: 'M', special: 'S' } as const;
  const legalTarget = nodeById.get('n11');

  return (
    <g>
      {legalTarget !== undefined && (
        <g>
          <circle cx={legalTarget.x} cy={legalTarget.y} r={15} fill={theme.route.taxi} opacity={0.16} />
          <circle
            cx={legalTarget.x}
            cy={legalTarget.y}
            r={11.5}
            fill={theme.station.fill}
            stroke={theme.route.taxi}
            strokeWidth={2.8}
          />
          <text
            x={legalTarget.x}
            y={legalTarget.y + 3}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={800}
            fill={theme.station.text}
          >
            {legalTarget.id}
          </text>
        </g>
      )}

      {map.graph.nodes.map((node) => {
        const radius = node.class === 'terminal' ? 7.1 : node.class === 'hub' ? 6.2 : 5.1;
        const edge =
          node.class === 'terminal'
            ? theme.station.edgeMetro
            : node.class === 'hub'
              ? theme.station.edgeBus
              : theme.station.edgeStreet;
        const nodeStops = stops.get(node.id) ?? [];

        return (
          <g key={node.id}>
            {theme.night && (
              <circle cx={node.x} cy={node.y} r={radius + 5} fill={theme.station.fill} opacity={0.07} />
            )}
            <circle cx={node.x} cy={node.y} r={radius} fill={theme.station.fill} stroke={edge} strokeWidth={1.6} />
            {node.class !== 'street' && <circle cx={node.x} cy={node.y} r={2.2} fill={edge} />}
            <text
              x={node.x + radius + 2.4}
              y={node.y - radius + 1}
              fontSize={9.8}
              fontWeight={600}
              fill={theme.station.label}
              paintOrder="stroke"
              stroke={theme.station.labelStroke}
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {node.id}
            </text>
            {nodeStops.map((mode, index) => {
              const offset = (index - (nodeStops.length - 1) / 2) * 8;
              return (
                <text
                  key={`${node.id}-${mode}`}
                  x={node.x - radius - 3}
                  y={node.y + offset + 2.5}
                  textAnchor="end"
                  fontSize={7.2}
                  fontWeight={800}
                  fill={badgeColour[mode]}
                  paintOrder="stroke"
                  stroke={theme.station.labelStroke}
                  strokeWidth={2.4}
                >
                  {badgeLabel[mode]}
                </text>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Token({
  x,
  y,
  label,
  colour,
  textColour,
  ghost = false,
  theme,
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly colour: string;
  readonly textColour: string;
  readonly ghost?: boolean;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  return (
    <g>
      <circle cx={x + 2} cy={y + 2.5} r={9.5} fill={theme.shadow.colour} opacity={0.25} />
      {ghost ? (
        <>
          <circle cx={x} cy={y} r={15} fill={colour} opacity={0.08} />
          <circle
            cx={x}
            cy={y}
            r={12}
            fill="none"
            stroke={colour}
            strokeWidth={1.8}
            strokeDasharray="3.5 3"
            opacity={0.85}
          />
          <circle cx={x} cy={y} r={7.5} fill={colour} opacity={0.28} />
        </>
      ) : (
        <circle cx={x} cy={y} r={11} fill={colour} stroke={theme.station.fill} strokeWidth={2} />
      )}
      <text
        x={ghost ? x - 11 : x}
        y={ghost ? y + 3 : y + 3.5}
        textAnchor={ghost ? 'end' : 'middle'}
        fontSize={ghost ? 9 : 8.5}
        fontWeight={800}
        fill={ghost ? theme.token.ghostLabel : textColour}
        paintOrder="stroke"
        stroke={theme.station.labelStroke}
        strokeWidth={2.4}
      >
        {label}
      </text>
    </g>
  );
}

function Tokens({
  map,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const nodeById = useMemo(() => new Map(map.graph.nodes.map((node) => [node.id, node])), [map]);
  const at = (id: NodeId): { x: number; y: number } => {
    const node = nodeById.get(id);
    return node === undefined ? { x: 0, y: 0 } : { x: node.x, y: node.y };
  };
  const fugitive = at('n8');
  const falcon = at('n7');
  const harrier = at('n38');
  const ghost = at('n18');

  return (
    <g>
      <Token
        {...fugitive}
        label="F"
        colour={theme.token.fugitive}
        textColour={theme.token.fugitiveText}
        theme={theme}
      />
      <Token
        {...falcon}
        label="A1"
        colour={theme.token.agent}
        textColour={theme.token.agentText}
        theme={theme}
      />
      <Token
        {...harrier}
        label="A2"
        colour={theme.token.agent}
        textColour={theme.token.agentText}
        theme={theme}
      />
      <Token {...ghost} label="F18" colour={theme.token.ghost} textColour={theme.token.fugitiveText} ghost theme={theme} />
    </g>
  );
}

function Vignette({ theme }: { readonly theme: VisualTheme }): React.JSX.Element | null {
  if (!theme.night) return null;
  return (
    <rect
      x={FRAGMENT_CROP.x}
      y={FRAGMENT_CROP.y}
      width={FRAGMENT_CROP.width}
      height={FRAGMENT_CROP.height}
      fill={`url(#fragment-vignette-${theme.id})`}
      pointerEvents="none"
    />
  );
}

export function CityFragment({
  map,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  return (
    <svg
      className="city-fragment"
      viewBox={`${FRAGMENT_CROP.x} ${FRAGMENT_CROP.y} ${FRAGMENT_CROP.width} ${FRAGMENT_CROP.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${theme.title} city fragment`}
    >
      <defs>
        <radialGradient id={`fragment-vignette-${theme.id}`}>
          <stop offset="58%" stopColor="#02050a" stopOpacity={0} />
          <stop offset="100%" stopColor="#02050a" stopOpacity={0.58} />
        </radialGradient>
      </defs>
      <CityBaseForCrop map={map} theme={theme} crop={FRAGMENT_CROP} />
      <Network map={map} theme={theme} />
      <Stations map={map} theme={theme} />
      <Tokens map={map} theme={theme} />
      <Vignette theme={theme} />
    </svg>
  );
}
