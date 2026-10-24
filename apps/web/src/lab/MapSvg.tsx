import type { MapPoint, TransportMode } from '@x-yard/map-generator';
import type { GeneratedMap, NodeId } from '@x-yard/map-generator';

/** Mode identity is fixed here so the map and the legend cannot drift. */
export const MODE_STYLE: Readonly<
  Record<TransportMode, { readonly colour: string; readonly width: number; readonly dash?: string; readonly label: string }>
> = {
  taxi: { colour: '#d99a1f', width: 3.4, label: 'Taxi' },
  bus: { colour: '#3b8a5a', width: 4.4, dash: '10 5', label: 'Bus' },
  underground: { colour: '#b8403b', width: 4.8, label: 'Metro' },
  special: { colour: '#6d4bb5', width: 3.6, dash: '3 5', label: 'Special' },
};

const MODE_ORDER: readonly TransportMode[] = ['taxi', 'bus', 'underground', 'special'];

function pathD(points: readonly MapPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function polygonPoints(points: readonly MapPoint[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

interface MapSvgProps {
  readonly map: GeneratedMap;
  readonly selected: NodeId | null;
  readonly onSelect: (id: NodeId) => void;
}

/** The schematic map. Deliberately a data view, not the final art renderer. */
export function MapSvg({ map, selected, onSelect }: MapSvgProps): React.JSX.Element {
  const { width, height } = map.bounds;
  const agentIndex = new Map(map.starts.agents.map((id, index) => [id, index + 1]));

  return (
    <svg
      className="map-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Generated transit network: ${map.stats.nodeCount} stations, ${map.stats.edgeCount} routes`}
    >
      <rect x={0} y={0} width={width} height={height} fill="#f6f2e8" />

      {/* Blocks first: the city is the board, even in a schematic view. */}
      <g aria-hidden="true">
        {map.city.blocks.map((block) => (
          <polygon
            key={block.id}
            points={polygonPoints(block.polygon)}
            fill={block.kind === 'park' ? '#dbe8cc' : '#eae4d5'}
            stroke="#d9d1be"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* Street centrelines. Rank controls width, not mode. */}
      <g aria-hidden="true">
        {map.city.streets.map((street) => (
          <path
            key={street.id}
            d={pathD(street.path)}
            fill="none"
            stroke="#cbc3b0"
            strokeWidth={street.rank === 2 ? 8 : street.rank === 1 ? 6 : 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        ))}
        {map.city.streets.map((street) => (
          <path
            key={`${street.id}-centre`}
            d={pathD(street.path)}
            fill="none"
            stroke="#f6f2e8"
            strokeWidth={street.rank === 2 ? 2 : 1.4}
            strokeLinecap="round"
            strokeDasharray={street.rank === 0 ? '2 6' : undefined}
            opacity={0.8}
          />
        ))}
      </g>

      {/* Landmarks: faint labels give a seed an identity. */}
      <g aria-hidden="true">
        {map.city.landmarks.map((landmark) => (
          <text
            key={landmark.id}
            x={landmark.at.x}
            y={landmark.at.y}
            textAnchor="middle"
            fill="#7a715f"
            fontSize={13}
            letterSpacing={1.5}
            opacity={0.72}
            style={{ textTransform: 'uppercase' }}
          >
            {landmark.label}
          </text>
        ))}
      </g>

      {/* Transit routes, drawn in tier order so the fast tiers sit on top. */}
      {MODE_ORDER.map((mode) => {
        const style = MODE_STYLE[mode];
        const routes = map.graph.edges.filter((edge) => edge.mode === mode);
        return (
          <g key={mode} aria-hidden="true">
            {routes.map((edge) => {
              const d = pathD(edge.path ?? []);
              return (
                <g key={edge.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#fbf8f0"
                    strokeWidth={style.width + 2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={style.colour}
                    strokeWidth={style.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={style.dash ?? 'none'}
                    opacity={0.92}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Stations. Clicking one opens its inspector in the side panel. */}
      <g className="stations">
        {map.graph.nodes.map((node) => {
          const isSelected = node.id === selected;
          const radius = node.class === 'terminal' ? 11 : node.class === 'hub' ? 10 : 8.5;
          const stroke =
            node.class === 'terminal' ? '#a93c36' : node.class === 'hub' ? '#2f7a4f' : '#4a463c';

          return (
            <g
              key={node.id}
              className="station"
              onClick={() => onSelect(node.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(node.id);
              }}
            >
              <title>
                {node.id} · {node.class} · {node.modes.join(', ') || 'no routes'}
              </title>
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={radius + 7} fill="none" stroke="#1e6bb8" strokeWidth={2} strokeDasharray="4 4" />
              )}
              <circle cx={node.x} cy={node.y} r={radius} fill="#fbf8f0" stroke={stroke} strokeWidth={2.4} />
              {node.class !== 'street' && (
                <circle cx={node.x} cy={node.y} r={3.2} fill={stroke} opacity={0.8} />
              )}
              <text
                x={node.x + radius + 4}
                y={node.y - radius + 2}
                fontSize={13}
                fontWeight={600}
                fill="#3b372e"
                paintOrder="stroke"
                stroke="#f6f2e8"
                strokeWidth={3.5}
                strokeLinejoin="round"
              >
                {node.id}
              </text>
              {node.facilities.length > 0 && (
                <text
                  x={node.x}
                  y={node.y + radius + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill={node.facilities.includes('black-market') ? '#7a4bb5' : '#2f7a4f'}
                  paintOrder="stroke"
                  stroke="#f6f2e8"
                  strokeWidth={3}
                >
                  {node.facilities.includes('black-market') ? 'BM' : 'SH'}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Starting positions are annotations, never nodes of their own. */}
      <g aria-hidden="true">
        {map.graph.nodes.map((node) => {
          if (node.id === map.starts.fugitive) {
            return (
              <g key={`start-${node.id}`}>
                <circle cx={node.x} cy={node.y} r={22} fill="none" stroke="#a93c36" strokeWidth={2.4} strokeDasharray="5 4" />
                <text x={node.x + 26} y={node.y + 20} fontSize={13} fontWeight={700} fill="#a93c36" paintOrder="stroke" stroke="#f6f2e8" strokeWidth={3}>
                  F
                </text>
              </g>
            );
          }

          const index = agentIndex.get(node.id);
          if (index === undefined) return null;
          return (
            <g key={`start-${node.id}`}>
              <circle cx={node.x} cy={node.y} r={17} fill="none" stroke="#2f6fed" strokeWidth={2.2} />
              <text x={node.x + 20} y={node.y + 16} fontSize={12} fontWeight={700} fill="#2f6fed" paintOrder="stroke" stroke="#f6f2e8" strokeWidth={3}>
                A{index}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
