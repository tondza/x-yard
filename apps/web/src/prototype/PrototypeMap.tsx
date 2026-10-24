import type { GeneratedMap, GraphEdge, NodeId } from '@x-yard/map-generator';
import type { MobilityOption, PrototypeMoveOption, PrototypeState } from '@x-yard/game-core';

import { pathData } from './city';

export const MOVE_STYLE: Readonly<
  Record<MobilityOption, { readonly colour: string; readonly label: string; readonly dash?: string }>
> = {
  taxi: { colour: '#d99a1f', label: 'Taxi' },
  bus: { colour: '#3b8a5a', label: 'Bus', dash: '9 5' },
  underground: { colour: '#b8403b', label: 'Metro' },
  special: { colour: '#6d4bb5', label: 'Special', dash: '3 5' },
  foot: { colour: '#33475c', label: 'Foot', dash: '1.5 5' },
  scooter: { colour: '#8a5cf0', label: 'Scooter', dash: '7 4' },
};

function edgeBetween(
  graph: GeneratedMap['graph'],
  from: NodeId,
  to: NodeId,
  mode: 'taxi' | 'bus' | 'underground' | 'special',
): GraphEdge | undefined {
  return graph.edges.find(
    (edge) =>
      edge.mode === mode &&
      ((edge.a === from && edge.b === to) || (edge.a === to && edge.b === from)),
  );
}

function routeFor(
  graph: GeneratedMap['graph'],
  from: NodeId,
  option: PrototypeMoveOption,
): readonly { readonly x: number; readonly y: number }[] {
  if (option.mode === 'scooter' && option.via !== null) {
    const first = edgeBetween(graph, from, option.via, 'taxi');
    const second = edgeBetween(graph, option.via, option.to, 'taxi');
    if (first?.path && second?.path) {
      const firstPoints = first.a === from ? [...first.path] : [...first.path].reverse();
      const secondPoints = second.a === option.via ? [...second.path] : [...second.path].reverse();
      return [...firstPoints, ...secondPoints.slice(1)];
    }
  }

  const mode =
    option.mode === 'foot' || option.mode === 'scooter' ? 'taxi' : option.mode;
  const edge = edgeBetween(graph, from, option.to, mode);
  if (edge?.path) return edge.path;

  const fromNode = graph.nodes.find((node) => node.id === from);
  const toNode = graph.nodes.find((node) => node.id === option.to);
  if (fromNode && toNode) {
    return [
      { x: fromNode.x, y: fromNode.y },
      { x: toNode.x, y: toNode.y },
    ];
  }
  return [];
}

interface PrototypeMapProps {
  readonly map: GeneratedMap;
  readonly state: PrototypeState;
  readonly selectedMode: MobilityOption;
  readonly legal: readonly PrototypeMoveOption[];
  readonly onMove: (option: PrototypeMoveOption) => void;
  readonly pulseNode: NodeId | null;
}

/** The live layer over the city plate: stations, routes, tokens and input. */
export function PrototypeMap({
  map,
  state,
  selectedMode,
  legal,
  onMove,
  pulseNode,
}: PrototypeMapProps): React.JSX.Element {
  const fugitive = state.seats[0];
  const agents = state.seats.slice(1);
  const options = legal.filter((option) => option.mode === selectedMode);
  const style = MOVE_STYLE[selectedMode];
  const nodeById = new Map(map.graph.nodes.map((node) => [node.id, node]));

  const fastNetwork = map.graph.edges.filter((edge) => edge.mode !== 'taxi');

  return (
    <svg
      className="map-overlay"
      viewBox={`0 0 ${map.bounds.width} ${map.bounds.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* The fast network stays faint; the city is the board, not a graph. */}
      <g aria-hidden="true" opacity={0.24}>
        {fastNetwork.map((edge) => (
          <g key={`net-${edge.id}`}>
            <path d={pathData(edge.path ?? [])} fill="none" stroke="#fbf8f0" strokeWidth={4} strokeLinecap="round" />
            <path
              d={pathData(edge.path ?? [])}
              fill="none"
              stroke={MOVE_STYLE[edge.mode].colour}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeDasharray={MOVE_STYLE[edge.mode].dash ?? 'none'}
            />
          </g>
        ))}
      </g>

      {/* Legal move paths for the selected mode. */}
      <g className="move-paths">
        {options.map((option) => {
          const points = routeFor(map.graph, fugitive?.node ?? '', option);

          return (
            <g key={`${option.mode}-${option.to}-${option.via ?? ''}`}>
              <path d={pathData(points)} fill="none" stroke="#fbf8f0" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.92} />
              <path
                d={pathData(points)}
                fill="none"
                stroke={style.colour}
                strokeWidth={5.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={style.dash ?? 'none'}
              />
            </g>
          );
        })}
      </g>

      {/* Stations, numbers and class rings. */}
      <g>
        {map.graph.nodes.map((node) => {
          const radius = node.class === 'terminal' ? 8 : node.class === 'hub' ? 7 : 5.8;
          const stroke = node.class === 'terminal' ? '#a93c36' : node.class === 'hub' ? '#2f7a4f' : '#5a5347';

          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={radius} fill="#fbf8f0" stroke={stroke} strokeWidth={1.8} />
              {node.class !== 'street' && <circle cx={node.x} cy={node.y} r={2.2} fill={stroke} />}
              <text
                x={node.x + radius + 2.5}
                y={node.y - radius + 1}
                fontSize={9.6}
                fontWeight={600}
                fill="#3d382e"
                paintOrder="stroke"
                stroke="#f4efe2"
                strokeWidth={3.2}
                strokeLinejoin="round"
              >
                {node.id}
              </text>
              {node.facilities.length > 0 && (
                <text
                  x={node.x}
                  y={node.y + radius + 9}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight={700}
                  fill={node.facilities.includes('black-market') ? '#7a4bb5' : '#2f7a4f'}
                  paintOrder="stroke"
                  stroke="#f4efe2"
                  strokeWidth={2.5}
                >
                  {node.facilities.includes('black-market') ? 'BM' : 'SH'}
                </text>
              )}
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
              <circle cx={destination.x} cy={destination.y} r={17} fill={style.colour} opacity={0.16} />
              <circle cx={destination.x} cy={destination.y} r={12.5} fill="#fbf8f0" stroke={style.colour} strokeWidth={2.8} />
              <text
                x={destination.x}
                y={destination.y + 3}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight={700}
                fill="#3b372e"
                pointerEvents="none"
              >
                {option.to}
              </text>
              <circle
                cx={destination.x}
                cy={destination.y}
                r={18}
                fill="transparent"
                className="dest-hit"
                onClick={() => onMove(option)}
              >
                <title>
                  {style.label} to {option.to}
                </title>
              </circle>
            </g>
          );
        })}
      </g>

      {/* Tokens. Agents are visible from the Fugitive's seat (prototype rule). */}
      <g>
        {agents.map((agent, index) => {
          const node = nodeById.get(agent.node);
          if (!node) return null;
          return (
            <g key={agent.id}>
              <circle cx={node.x} cy={node.y} r={9.5} fill="#2f6fed" stroke="#fbf8f0" strokeWidth={2} />
              <text
                x={node.x + 11}
                y={node.y + 3}
                fontSize={8}
                fontWeight={700}
                fill="#2f6fed"
                paintOrder="stroke"
                stroke="#f4efe2"
                strokeWidth={2.5}
              >
                A{index + 1}
              </text>
            </g>
          );
        })}

        {fugitive && (() => {
          const node = nodeById.get(fugitive.node);
          if (!node) return null;
          return (
            <g>
              <circle cx={node.x} cy={node.y} r={11.5} fill="#a93c36" stroke="#fbf8f0" strokeWidth={2.4} />
              <text x={node.x} y={node.y + 3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#fff8ef">
                F
              </text>
            </g>
          );
        })()}
      </g>

      {pulseNode !== null && (() => {
        const node = nodeById.get(pulseNode);
        if (!node) return null;
        return (
          <g className="pulse-ring" aria-hidden="true">
            <circle cx={node.x} cy={node.y} r={26} fill="none" stroke="#a93c36" strokeWidth={2.6} strokeDasharray="5 5" />
            <circle cx={node.x} cy={node.y} r={18} fill="none" stroke="#f0b4af" strokeWidth={2} />
          </g>
        );
      })()}
    </svg>
  );
}
