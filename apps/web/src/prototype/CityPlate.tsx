import { memo, useMemo } from 'react';

import type { BlockModel, GeneratedMap, LandmarkModel } from '@x-yard/map-generator';

import {
  ROOF_STYLES,
  blockBounds,
  buildingsForMap,
  pathData,
  treesForMap,
  type Building,
} from './city';

const STREET_WIDTH: Readonly<Record<0 | 1 | 2, number>> = { 0: 8, 1: 11, 2: 14 };

function StreetLayer({ map }: { readonly map: GeneratedMap }): React.JSX.Element {
  const sorted = useMemo(
    () => [...map.city.streets].sort((left, right) => left.rank - right.rank),
    [map.city.streets],
  );

  return (
    <g aria-hidden="true">
      {sorted.map((street) => (
        <path
          key={`${street.id}-casing`}
          d={pathData(street.path)}
          fill="none"
          stroke="#f8f4e9"
          strokeWidth={STREET_WIDTH[street.rank] + 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {sorted.map((street) => (
        <path
          key={`${street.id}-asphalt`}
          d={pathData(street.path)}
          fill="none"
          stroke={street.rank === 2 ? '#aaa392' : street.rank === 1 ? '#b3ac9b' : '#bab3a3'}
          strokeWidth={STREET_WIDTH[street.rank]}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {sorted.map((street) => (
        <path
          key={`${street.id}-marking`}
          d={pathData(street.path)}
          fill="none"
          stroke="#f3eddd"
          strokeWidth={street.rank === 0 ? 0.8 : 1.1}
          strokeLinecap="round"
          strokeDasharray={street.rank === 0 ? '2 10' : '5 9'}
          opacity={0.8}
        />
      ))}
    </g>
  );
}

function BlockGround({ block }: { readonly block: BlockModel }): React.JSX.Element {
  const points = block.polygon.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  if (block.kind === 'park') {
    const bounds = blockBounds(block);
    return (
      <g>
        <polygon points={points} fill="#cfe0b8" stroke="#b7cba0" strokeWidth={1.2} />
        <path
          d={`M${bounds.minX + 8} ${bounds.maxY - 18} Q${(bounds.minX + bounds.maxX) / 2} ${bounds.minY + 12} ${bounds.maxX - 8} ${bounds.maxY - 22}`}
          fill="none"
          stroke="#efe8d4"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
        <ellipse
          cx={bounds.minX + (bounds.maxX - bounds.minX) * 0.62}
          cy={bounds.minY + (bounds.maxY - bounds.minY) * 0.58}
          rx={Math.max(7, (bounds.maxX - bounds.minX) * 0.14)}
          ry={Math.max(4, (bounds.maxY - bounds.minY) * 0.1)}
          fill="#9cc9dd"
          stroke="#7aafc5"
          strokeWidth={1}
        />
      </g>
    );
  }

  return <polygon points={points} fill="#e5ddca" stroke="#d7ceba" strokeWidth={1.1} />;
}

function BuildingShape({ building }: { readonly building: Building }): React.JSX.Element {
  const style = ROOF_STYLES[building.material];
  const wallTop = building.y + building.h - building.lift;
  const windowCount = Math.max(1, building.windows);
  const windowWidth = 2.4;
  const gap = (building.w - windowCount * windowWidth) / (windowCount + 1);

  return (
    <g>
      {/* The near wall, then the lifted roof face. */}
      <rect
        x={building.x}
        y={wallTop}
        width={building.w}
        height={building.lift}
        fill={building.wall}
        stroke="#c7b492"
        strokeWidth={0.45}
      />
      {Array.from({ length: windowCount }, (_, index) => (
        <rect
          key={`${building.key}-w${index}`}
          x={building.x + gap + index * (windowWidth + gap)}
          y={wallTop + 2.2}
          width={windowWidth}
          height={Math.max(1, Math.min(3.6, building.lift - 4))}
          fill="#a9c9d5"
          stroke="#7d9aa5"
          strokeWidth={0.35}
          opacity={0.9}
        />
      ))}
      <rect
        x={building.x}
        y={building.y - building.lift}
        width={building.w}
        height={building.h}
        rx={0.8}
        fill={style.roof}
        stroke={style.edge}
        strokeWidth={0.7}
      />
      <line
        x1={building.x + 1.5}
        y1={building.y - building.lift + building.h * 0.34}
        x2={building.x + building.w - 1.5}
        y2={building.y - building.lift + building.h * 0.34}
        stroke={style.ridge}
        strokeWidth={0.55}
        opacity={0.75}
      />
      <line
        x1={building.x + 1.5}
        y1={building.y - building.lift + building.h * 0.68}
        x2={building.x + building.w - 1.5}
        y2={building.y - building.lift + building.h * 0.68}
        stroke={style.ridge}
        strokeWidth={0.45}
        opacity={0.55}
      />
      {building.chimney && (
        <rect
          x={building.x + building.w * 0.66}
          y={building.y - building.lift - 2.2}
          width={2.8}
          height={4.5}
          fill="#a48461"
          stroke="#866a4c"
          strokeWidth={0.4}
        />
      )}
    </g>
  );
}

function Cathedral({ landmark }: { readonly landmark: LandmarkModel }): React.JSX.Element {
  const { x, y } = landmark.at;
  return (
    <g>
      <rect x={x - 38} y={y - 16} width={76} height={38} fill="#d8cbb1" stroke="#b7a88d" strokeWidth={0.8} />
      <polygon points={`${x - 43},${y - 16} ${x},${y - 44} ${x + 43},${y - 16}`} fill="#727f87" stroke="#59656d" strokeWidth={0.8} />
      <rect x={x - 34} y={y - 38} width={13} height={40} fill="#d8cbb1" stroke="#b7a88d" strokeWidth={0.7} />
      <polygon points={`${x - 34},${y - 38} ${x - 27.5},${y - 56} ${x - 21},${y - 38}`} fill="#727f87" stroke="#59656d" strokeWidth={0.6} />
      <rect x={x + 21} y={y - 38} width={13} height={40} fill="#d8cbb1" stroke="#b7a88d" strokeWidth={0.7} />
      <polygon points={`${x + 21},${y - 38} ${x + 27.5},${y - 56} ${x + 34},${y - 38}`} fill="#727f87" stroke="#59656d" strokeWidth={0.6} />
      <circle cx={x} cy={y - 5} r={6.5} fill="#8fb8c9" stroke="#5f8595" strokeWidth={0.8} />
      <circle cx={x} cy={y - 5} r={2.8} fill="none" stroke="#e8f1f4" strokeWidth={0.8} />
      <line x1={x - 27.5} y1={y - 56} x2={x - 27.5} y2={y - 63} stroke="#59656d" strokeWidth={1.1} />
      <line x1={x - 30.5} y1={y - 60} x2={x - 24.5} y2={y - 60} stroke="#59656d" strokeWidth={1.1} />
    </g>
  );
}

function StationHall({ landmark }: { readonly landmark: LandmarkModel }): React.JSX.Element {
  const { x, y } = landmark.at;
  return (
    <g>
      <rect x={x - 48} y={y - 16} width={96} height={34} fill="#d6c6aa" stroke="#b6a488" strokeWidth={0.8} />
      <path
        d={`M${x - 50} ${y - 16} Q${x} ${y - 39} ${x + 50} ${y - 16} Z`}
        fill="#9ec4d3"
        stroke="#6f96a7"
        strokeWidth={0.8}
      />
      {[-30, -10, 10, 30].map((offset) => (
        <line key={offset} x1={x + offset} y1={y - 16} x2={x + offset} y2={y - 33} stroke="#d9edf3" strokeWidth={0.7} opacity={0.8} />
      ))}
      <circle cx={x} cy={y - 22} r={4} fill="#f3ecd9" stroke="#6f6656" strokeWidth={0.7} />
      <line x1={x} y1={y - 22} x2={x} y2={y - 25} stroke="#6f6656" strokeWidth={0.6} />
      <line x1={x} y1={y - 22} x2={x + 2} y2={y - 21.5} stroke="#6f6656" strokeWidth={0.6} />
    </g>
  );
}

function MarketHall({ landmark }: { readonly landmark: LandmarkModel }): React.JSX.Element {
  const { x, y } = landmark.at;
  return (
    <g>
      <rect x={x - 31} y={y - 14} width={62} height={32} fill="#dcc7a8" stroke="#b9a486" strokeWidth={0.8} />
      <polygon points={`${x - 35},${y - 14} ${x},${y - 34} ${x + 35},${y - 14}`} fill="#5c9a84" stroke="#3f7462" strokeWidth={0.8} />
      {[-22, -8, 8, 22].map((offset) => (
        <rect key={offset} x={x + offset - 5} y={y + 18} width={9} height={7} fill="#c26a4a" stroke="#984b32" strokeWidth={0.5} />
      ))}
      <circle cx={x} cy={y - 26} r={2.4} fill="#f3ecd9" stroke="#3f7462" strokeWidth={0.5} />
    </g>
  );
}

function OldSquare({ landmark }: { readonly landmark: LandmarkModel }): React.JSX.Element {
  const { x, y } = landmark.at;
  return (
    <g>
      <rect x={x - 30} y={y - 24} width={60} height={48} fill="#eee6d4" stroke="#d8ceba" strokeWidth={1} />
      <circle cx={x} cy={y} r={10} fill="#a9d0df" stroke="#7daec1" strokeWidth={1} />
      <circle cx={x} cy={y} r={4} fill="#e8f2f5" stroke="#7daec1" strokeWidth={0.7} />
      <circle cx={x - 20} cy={y - 14} r={3} fill="#8fae6d" />
      <circle cx={x + 21} cy={y + 15} r={3.2} fill="#8fae6d" />
    </g>
  );
}

/**
 * A neutral period hall for the civic landmark kinds the Vintage renderer draws
 * in detail. Basic stays a working fallback, so a new kind gets a building under
 * its label rather than a floating name.
 */
function CivicHall({ landmark }: { readonly landmark: LandmarkModel }): React.JSX.Element {
  const { x, y } = landmark.at;
  return (
    <g>
      <rect x={x - 32} y={y - 16} width={64} height={34} fill="#d8cbb1" stroke="#b7a88d" strokeWidth={0.8} />
      <polygon points={`${x - 36},${y - 16} ${x},${y - 38} ${x + 36},${y - 16}`} fill="#727f87" stroke="#59656d" strokeWidth={0.8} />
      <rect x={x - 7} y={y - 42} width={14} height={28} fill="#d8cbb1" stroke="#b7a88d" strokeWidth={0.7} />
      <polygon points={`${x - 7},${y - 42} ${x},${y - 57} ${x + 7},${y - 42}`} fill="#727f87" stroke="#59656d" strokeWidth={0.6} />
      <circle cx={x} cy={y - 36} r={3.2} fill="#f3ecd9" stroke="#6f6656" strokeWidth={0.6} />
    </g>
  );
}

function Landmark({ landmark }: { readonly landmark: LandmarkModel }): React.JSX.Element {
  const anchored =
    landmark.kind === 'cathedral' ||
    landmark.kind === 'station' ||
    landmark.kind === 'market' ||
    landmark.kind === 'square';
  return (
    <g>
      {landmark.kind === 'cathedral' && <Cathedral landmark={landmark} />}
      {landmark.kind === 'station' && <StationHall landmark={landmark} />}
      {landmark.kind === 'market' && <MarketHall landmark={landmark} />}
      {landmark.kind === 'square' && <OldSquare landmark={landmark} />}
      {!anchored && <CivicHall landmark={landmark} />}
      {/*
       * Landmark names are drawn once, by the live overlay, in every skin. The
       * plate used to print its own; two sets of labels overlapped.
       */}
    </g>
  );
}

/** The static illustrated city, drawn from the generated model. */
function CityContent({ map }: { readonly map: GeneratedMap }): React.JSX.Element {
  const buildings = useMemo(() => buildingsForMap(map), [map]);
  const trees = useMemo(() => treesForMap(map), [map]);
  const landmarkBlockIds = useMemo(
    () => new Set(map.city.landmarks.map((landmark) => landmark.blockId)),
    [map.city.landmarks],
  );

  return (
    <g>
      <rect x={0} y={0} width={map.bounds.width} height={map.bounds.height} fill="#e9e2d2" />
      <StreetLayer map={map} />

      <g>
        {map.city.blocks.map((block) => (
          <BlockGround key={block.id} block={block} />
        ))}
      </g>

      {/* One shadow direction for the whole city: south-east. */}
      <g opacity={0.18}>
        {buildings.map((building) => (
          <rect
            key={`${building.key}-shadow`}
            x={building.x + 5}
            y={building.y + 6}
            width={building.w}
            height={building.h + building.lift}
            fill="#6f6554"
          />
        ))}
      </g>

      <g>
        {buildings.map((building) => (
          <BuildingShape key={building.key} building={building} />
        ))}
      </g>

      <g>
        {trees.map((tree) => (
          <g key={tree.key}>
            <rect x={tree.x - 0.7} y={tree.y} width={1.4} height={tree.r + 1.5} fill="#8a6a4a" />
            <circle cx={tree.x} cy={tree.y - tree.r * 0.45} r={tree.r} fill="#7f9e5f" />
            <circle cx={tree.x - tree.r * 0.35} cy={tree.y - tree.r * 0.75} r={tree.r * 0.62} fill="#93b06f" />
          </g>
        ))}
      </g>

      <g>
        {map.city.landmarks.map((landmark) => (
          <Landmark key={landmark.id} landmark={landmark} />
        ))}
      </g>

      {/* Unbuilt landmark blocks still show their ground. */}
      <g opacity={0.4}>
        {map.city.blocks
          .filter((block) => landmarkBlockIds.has(block.id) && block.kind === 'block')
          .map((block) => (
            <polygon
              key={`${block.id}-ground`}
              points={block.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="#c9bfa9"
              strokeWidth={0.7}
            />
          ))}
      </g>
    </g>
  );
}

/**
 * The heavy city geometry is memoised separately from the SVG wrapper: a camera
 * pan changes the wrapper's `viewBox` every frame, but the city itself does not
 * reconcile while the camera moves.
 */
const MemoCityContent = memo(CityContent);

export interface CityPlateProps {
  readonly map: GeneratedMap;
  readonly viewBox: string;
}

function CityPlateView({ map, viewBox }: CityPlateProps): React.JSX.Element {
  return (
    <svg
      className="city-plate"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <MemoCityContent map={map} />
    </svg>
  );
}

/**
 * Memoised: the city never changes during a turn, so only the overlay should
 * reconcile when the game state moves.
 */
export const CityPlate = memo(CityPlateView);
