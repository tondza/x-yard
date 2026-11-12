/**
 * Shared city-skin renderer.
 *
 * This is the piece a new city skin plugs into: it draws the ground, streets,
 * blocks, buildings, trees, landmarks and ambient light from the generated map.
 * The game overlay (transit network, stations, tokens, ghost) stays in
 * `PrototypeMap`, so a skin can never change the board or the rules.
 *
 * `basic` in the skin registry is the original `CityPlate`. Every other skin is
 * a `VisualTheme` rendered here.
 *
 * @module apps/web/prototype/skins/CitySkinBase
 */

import { memo, useMemo } from 'react';

import type {
  BlockModel,
  GeneratedMap,
  GraphEdge,
  LandmarkModel,
  NodeId,
} from '@x-yard/map-generator';

import {
  blockBounds,
  buildingsForMap,
  pathData,
  treesForMap,
  type Building,
  type Tree,
} from '../city';
import type { VisualTheme } from './visualThemes';

export interface CityCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const STREET_WIDTH: Readonly<Record<0 | 1 | 2, number>> = { 0: 8, 1: 11, 2: 14 };

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inCrop(
  x: number,
  y: number,
  width: number,
  height: number,
  crop: CityCrop | undefined,
): boolean {
  if (crop === undefined) return true;
  const margin = 70;
  return (
    x + width > crop.x - margin &&
    x < crop.x + crop.width + margin &&
    y + height > crop.y - margin &&
    y < crop.y + crop.height + margin
  );
}

function StreetLayer({
  map,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const streets = useMemo(
    () => [...map.city.streets].sort((left, right) => left.rank - right.rank),
    [map.city.streets],
  );

  return (
    <g aria-hidden="true">
      {streets.map((street) => (
        <path
          key={`${street.id}-casing`}
          d={pathData(street.path)}
          fill="none"
          stroke={theme.streetCasing}
          strokeWidth={STREET_WIDTH[street.rank] + (theme.outline !== undefined ? 7 : 5)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {streets.map((street) => (
        <path
          key={`${street.id}-asphalt`}
          d={pathData(street.path)}
          fill="none"
          stroke={theme.street}
          strokeWidth={STREET_WIDTH[street.rank]}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {streets.map((street) => (
        <path
          key={`${street.id}-mark`}
          d={pathData(street.path)}
          fill="none"
          stroke={theme.streetMark}
          strokeWidth={street.rank === 0 ? 0.8 : 1.1}
          strokeLinecap="round"
          strokeDasharray={street.rank === 0 ? '2 10' : '5 9'}
          opacity={theme.night ? 0.45 : 0.8}
        />
      ))}
    </g>
  );
}

function BlockGround({
  block,
  theme,
}: {
  readonly block: BlockModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const points = block.polygon
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const bounds = blockBounds(block);
  const rich = theme.detail === 'rich';

  if (block.kind === 'park') {
    return (
      <g>
        {rich && (
          <polygon
            points={points}
            fill={theme.streetCasing}
            stroke={theme.outline ?? theme.parkEdge}
            strokeWidth={theme.outline !== undefined ? 1.6 : 1.2}
          />
        )}
        <polygon
          points={points}
          fill={theme.park}
          stroke={theme.parkEdge}
          strokeWidth={theme.outline !== undefined ? 1.2 : 1}
        />
        <path
          d={`M${bounds.minX + 8} ${bounds.maxY - 18} Q${(bounds.minX + bounds.maxX) / 2} ${bounds.minY + 12} ${bounds.maxX - 8} ${bounds.maxY - 22}`}
          fill="none"
          stroke={theme.streetCasing}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.85}
        />
        <ellipse
          cx={bounds.minX + (bounds.maxX - bounds.minX) * 0.62}
          cy={bounds.minY + (bounds.maxY - bounds.minY) * 0.58}
          rx={Math.max(7, (bounds.maxX - bounds.minX) * 0.14)}
          ry={Math.max(4, (bounds.maxY - bounds.minY) * 0.1)}
          fill={theme.water}
          stroke={theme.waterEdge}
          strokeWidth={1}
        />
      </g>
    );
  }

  return (
    <g>
      {rich && (
        <polygon
          points={points}
          fill={theme.streetCasing}
          stroke={theme.outline ?? theme.blockEdge}
          strokeWidth={theme.outline !== undefined ? 1.4 : 1}
        />
      )}
      <polygon
        points={points}
        fill={theme.block}
        stroke={theme.blockEdge}
        strokeWidth={theme.outline !== undefined ? 1.1 : 0.9}
      />
    </g>
  );
}

function RichRoof({
  building,
  theme,
  style,
  lift,
}: {
  readonly building: Building;
  readonly theme: VisualTheme;
  readonly style: VisualTheme['roofs'][Building['material']];
  readonly lift: number;
}): React.JSX.Element {
  const outline = theme.outline;
  const outlineWidth = theme.outlineWidth ?? 1;
  const hash = hashString(building.key);
  const half = building.h * 0.54;
  const gable = hash % 5 === 0;
  const notch = building.w > 22 && building.h > 20 ? hash % 4 : -1;
  const courtyard = building.w > 20 && building.h > 18 && hash % 5 === 0;

  return (
    <g>
      <rect
        x={building.x}
        y={building.y - lift}
        width={building.w}
        height={building.h}
        fill={style.roof}
        stroke={outline ?? style.edge}
        strokeWidth={outline !== undefined ? outlineWidth : 0.8}
      />
      {theme.detail === 'rich' && (
        <rect
          x={building.x + 0.8}
          y={building.y - lift + 0.8}
          width={building.w - 1.6}
          height={building.h - 1.6}
          fill={`url(#city-tile-${theme.id})`}
          opacity={0.28}
        />
      )}
      {gable ? (
        <>
          <rect
            x={building.x}
            y={building.y - lift}
            width={building.w / 2}
            height={building.h}
            fill={style.roof}
          />
          <rect
            x={building.x + building.w / 2}
            y={building.y - lift}
            width={building.w / 2}
            height={building.h}
            fill={style.ridge}
            opacity={0.58}
          />
          <line
            x1={building.x + building.w / 2}
            y1={building.y - lift + 1}
            x2={building.x + building.w / 2}
            y2={building.y - lift + building.h - 1}
            stroke={outline ?? style.edge}
            strokeWidth={outline !== undefined ? 1 : 0.7}
            opacity={0.8}
          />
        </>
      ) : (
        <>
          <rect
            x={building.x}
            y={building.y - lift + half}
            width={building.w}
            height={building.h - half}
            fill={style.ridge}
            opacity={0.55}
          />
          <line
            x1={building.x + 1}
            y1={building.y - lift + half}
            x2={building.x + building.w - 1}
            y2={building.y - lift + half}
            stroke={outline ?? style.edge}
            strokeWidth={outline !== undefined ? 1 : 0.6}
            opacity={0.8}
          />
        </>
      )}
      <line
        x1={building.x + 1}
        y1={building.y - lift + 1.5}
        x2={building.x + building.w - 1}
        y2={building.y - lift + 1.5}
        stroke={theme.night ? '#7d9fc0' : style.ridge}
        strokeWidth={0.8}
        opacity={theme.night ? 0.35 : 0.55}
      />
      {hash % 4 === 0 &&
        [0.26, 0.42, 0.58, 0.74].map((fraction) => (
          <line
            key={fraction}
            x1={building.x + 2}
            y1={building.y - lift + building.h * fraction}
            x2={building.x + building.w - 2}
            y2={building.y - lift + building.h * fraction}
            stroke={outline ?? style.edge}
            strokeWidth={0.3}
            opacity={0.35}
          />
        ))}

      {notch === 1 && (
        <g>
          <rect
            x={building.x + building.w * 0.62}
            y={building.y - lift}
            width={building.w * 0.38}
            height={building.h * 0.44}
            fill={theme.block}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={outline !== undefined ? 1 : 0.7}
          />
          <line
            x1={building.x + building.w * 0.62}
            y1={building.y - lift + building.h * 0.44}
            x2={building.x + building.w}
            y2={building.y - lift + building.h * 0.44}
            stroke={theme.wallEdge}
            strokeWidth={1.2}
            opacity={0.6}
          />
          <circle
            cx={building.x + building.w * 0.82}
            cy={building.y - lift + building.h * 0.23}
            r={2.4}
            fill={theme.tree.leaf}
            stroke={outline ?? 'none'}
            strokeWidth={outline !== undefined ? 0.5 : 0}
          />
        </g>
      )}

      {notch === 3 && (
        <g>
          <rect
            x={building.x}
            y={building.y - lift + building.h * 0.58}
            width={building.w * 0.34}
            height={building.h * 0.42}
            fill={theme.block}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={outline !== undefined ? 1 : 0.7}
          />
          <circle
            cx={building.x + building.w * 0.18}
            cy={building.y - lift + building.h * 0.79}
            r={2.2}
            fill={theme.tree.leaf}
            stroke={outline ?? 'none'}
            strokeWidth={outline !== undefined ? 0.5 : 0}
          />
        </g>
      )}

      {courtyard && notch === -1 && (
        <g>
          <rect
            x={building.x + building.w * 0.3}
            y={building.y - lift + building.h * 0.3}
            width={building.w * 0.4}
            height={building.h * 0.4}
            fill={theme.block}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={outline !== undefined ? 1 : 0.7}
          />
          <circle
            cx={building.x + building.w * 0.5}
            cy={building.y - lift + building.h * 0.5}
            r={2.3}
            fill={theme.tree.leaf}
            stroke={outline ?? 'none'}
            strokeWidth={outline !== undefined ? 0.5 : 0}
          />
        </g>
      )}

      {hash % 7 === 0 && (
        <g>
          <rect
            x={building.x + building.w - 8.5}
            y={building.y - lift - 3.6}
            width={5}
            height={3.8}
            fill={style.roof}
            stroke={outline ?? style.edge}
            strokeWidth={0.55}
          />
          <polygon
            points={`${building.x + building.w - 9},${building.y - lift - 3.6} ${building.x + building.w - 6},${building.y - lift - 5.4} ${building.x + building.w - 3},${building.y - lift - 3.6}`}
            fill={style.ridge}
            stroke={outline ?? style.edge}
            strokeWidth={0.45}
          />
        </g>
      )}

      {hash % 11 === 0 && (
        <g>
          <rect
            x={building.x + 2}
            y={building.y - lift + 2}
            width={building.w * 0.34}
            height={building.h * 0.28}
            fill={theme.wall}
            stroke={outline ?? style.edge}
            strokeWidth={0.5}
          />
          <line
            x1={building.x + 2}
            y1={building.y - lift + 2 + building.h * 0.14}
            x2={building.x + 2 + building.w * 0.34}
            y2={building.y - lift + 2 + building.h * 0.14}
            stroke={outline ?? style.edge}
            strokeWidth={0.4}
          />
        </g>
      )}
    </g>
  );
}

function BuildingShape({
  building,
  theme,
}: {
  readonly building: Building;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const style = theme.roofs[building.material];
  const hash = hashString(building.key);
  const heightScale = theme.detail === 'rich' ? 0.78 + ((hash >>> 8) % 6) * 0.09 : 1;
  const lift = building.lift * theme.lift * heightScale;
  const wallTop = building.y + building.h - lift;
  const windowCount = Math.max(1, building.windows);
  const windowWidth = theme.detail === 'rich' ? 3.4 : 2.6;
  const gap = (building.w - windowCount * windowWidth) / (windowCount + 1);
  const lit = hash % 100 < theme.windowLitChance * 100;
  const wallTone = theme.wallTones[hash % theme.wallTones.length] ?? theme.wall;
  const outline = theme.outline;
  const outlineWidth = theme.outlineWidth ?? 0.8;
  const rich = theme.detail === 'rich';

  return (
    <g>
      <rect
        x={building.x + theme.shadow.dx + 2.5}
        y={building.y + theme.shadow.dy + 2.5}
        width={building.w}
        height={building.h + lift}
        fill={theme.shadow.colour}
        opacity={theme.shadow.opacity * 0.3}
      />
      <rect
        x={building.x + theme.shadow.dx}
        y={building.y + theme.shadow.dy}
        width={building.w}
        height={building.h + lift}
        fill={theme.shadow.colour}
        opacity={theme.shadow.opacity}
      />

      <rect
        x={building.x}
        y={wallTop}
        width={building.w}
        height={lift}
        fill={wallTone}
        stroke={outline ?? theme.wallEdge}
        strokeWidth={outline !== undefined ? outlineWidth : 0.45}
      />
      <rect
        x={building.x + 0.5}
        y={building.y + building.h - 1.6}
        width={building.w - 1}
        height={1.6}
        fill={theme.shadow.colour}
        opacity={0.15}
      />
      {rich && (
        <rect
          x={building.x}
          y={wallTop}
          width={building.w}
          height={lift}
          fill={`url(#city-brick-${theme.id})`}
          opacity={0.16}
        />
      )}

      {Array.from({ length: windowCount }, (_, index) => {
        const x = building.x + gap + index * (windowWidth + gap);
        const windowHeight = theme.detail === 'rich'
          ? Math.min(4.8, Math.max(2.2, lift - 3))
          : Math.min(3.8, Math.max(1.5, lift - 4));
        return (
          <g key={`${building.key}-window-${index}`}>
            {lit && (
              <rect
                x={x - 0.8}
                y={wallTop + 1.6}
                width={windowWidth + 1.6}
                height={windowHeight + 1.2}
                fill={theme.windowLit}
                opacity={0.2}
              />
            )}
            <rect
              x={x}
              y={wallTop + 2.2}
              width={windowWidth}
              height={windowHeight}
              fill={lit ? theme.windowLit : theme.window}
              stroke={outline ?? theme.wallEdge}
              strokeWidth={outline !== undefined ? 0.55 : 0.35}
              opacity={0.95}
            />
          </g>
        );
      })}

      {theme.night && lift > 7 && (
        <g>
          {Array.from({ length: Math.max(1, windowCount - 1) }, (_, index) => {
            const x = building.x + gap + 1.8 + index * (windowWidth + gap);
            return (
              <rect
                key={`${building.key}-upper-${index}`}
                x={x}
                y={wallTop + 0.8}
                width={windowWidth}
                height={2}
                fill={theme.windowLit}
                opacity={0.9}
              />
            );
          })}
        </g>
      )}

      {rich ? (
        <RichRoof building={building} theme={theme} style={style} lift={lift} />
      ) : (
        <g>
          <rect
            x={building.x}
            y={building.y - lift}
            width={building.w}
            height={building.h}
            rx={0.8}
            fill={style.roof}
            stroke={outline ?? style.edge}
            strokeWidth={outline !== undefined ? outlineWidth : 0.7}
          />
          <line
            x1={building.x + 1.5}
            y1={building.y - lift + building.h * 0.34}
            x2={building.x + building.w - 1.5}
            y2={building.y - lift + building.h * 0.34}
            stroke={style.ridge}
            strokeWidth={0.55}
            opacity={0.75}
          />
          <line
            x1={building.x + 1.5}
            y1={building.y - lift + building.h * 0.68}
            x2={building.x + building.w - 1.5}
            y2={building.y - lift + building.h * 0.68}
            stroke={style.ridge}
            strokeWidth={0.45}
            opacity={0.55}
          />
        </g>
      )}

      {rich && (
        <rect
          x={building.x + building.w * 0.86}
          y={wallTop}
          width={building.w * 0.14}
          height={lift}
          fill={theme.shadow.colour}
          opacity={0.12}
        />
      )}

      {rich && hash % 5 === 0 && (
        <g>
          <polygon
            points={`${building.x},${wallTop} ${building.x + building.w / 2},${wallTop - lift * 0.52} ${building.x + building.w},${wallTop}`}
            fill={wallTone}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={outline !== undefined ? 0.8 : 0.5}
          />
          <line
            x1={building.x}
            y1={wallTop}
            x2={building.x + building.w}
            y2={wallTop}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={0.6}
          />
          <circle
            cx={building.x + building.w / 2}
            cy={wallTop - lift * 0.22}
            r={1.7}
            fill={theme.window}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={0.35}
          />
        </g>
      )}

      {building.chimney && (
        <rect
          x={building.x + building.w * 0.66}
          y={building.y - lift - 2.2}
          width={3.2}
          height={5}
          fill={theme.wallEdge}
          stroke={outline ?? style.edge}
          strokeWidth={0.4}
        />
      )}

      {rich && (
        <g>
          <rect
            x={building.x + 1}
            y={building.y + building.h - 4.4}
            width={building.w - 2}
            height={3.2}
            fill={theme.window}
            opacity={0.8}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={0.45}
          />
          <line
            x1={building.x + building.w * 0.5}
            y1={building.y + building.h - 4.4}
            x2={building.x + building.w * 0.5}
            y2={building.y + building.h - 1.2}
            stroke={outline ?? theme.wallEdge}
            strokeWidth={0.35}
          />
          <rect
            x={building.x + 2.2}
            y={building.y + building.h - 3.8}
            width={2.4}
            height={2.2}
            fill={theme.wallEdge}
            opacity={0.75}
          />

          {hash % 3 === 0 && (
            <g>
              <rect
                x={building.x + 1}
                y={building.y + building.h - 1}
                width={building.w - 2}
                height={3.2}
                fill={theme.landmark.accent}
                opacity={0.9}
                stroke={outline ?? theme.wallEdge}
                strokeWidth={0.4}
              />
              {[0.2, 0.4, 0.6, 0.8].map((fraction) => (
                <rect
                  key={fraction}
                  x={building.x + 1 + (building.w - 2) * fraction - 0.7}
                  y={building.y + building.h - 1}
                  width={1.4}
                  height={3.2}
                  fill={theme.station.fill}
                  opacity={0.85}
                />
              ))}
            </g>
          )}

          {hash % 4 === 0 && building.w > 18 && (
            <g>
              <rect
                x={building.x + 2}
                y={wallTop + lift * 0.44}
                width={6.5}
                height={2.6}
                fill={theme.station.fill}
                stroke={outline ?? theme.wallEdge}
                strokeWidth={0.5}
              />
              <line
                x1={building.x + 2}
                y1={wallTop + lift * 0.44 + 1}
                x2={building.x + 8.5}
                y2={wallTop + lift * 0.44 + 1}
                stroke={outline ?? theme.wallEdge}
                strokeWidth={0.45}
              />
              <line
                x1={building.x + 2}
                y1={wallTop + lift * 0.44 + 2}
                x2={building.x + 8.5}
                y2={wallTop + lift * 0.44 + 2}
                stroke={outline ?? theme.wallEdge}
                strokeWidth={0.35}
              />
            </g>
          )}

          {hash % 8 === 0 && (
            <circle
              cx={building.x + 3}
              cy={building.y + building.h - 5}
              r={2}
              fill={theme.tree.leaf}
              stroke={outline ?? theme.wallEdge}
              strokeWidth={0.3}
            />
          )}
        </g>
      )}
    </g>
  );
}

function TreeShape({
  tree,
  theme,
}: {
  readonly tree: Tree;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const outline = theme.tree.outline;
  const scale = theme.detail === 'rich' ? 1.15 : 1;
  const radius = tree.r * scale;
  return (
    <g>
      <ellipse
        cx={tree.x + theme.shadow.dx * 0.5}
        cy={tree.y + theme.shadow.dy * 0.45}
        rx={radius * 0.9}
        ry={radius * 0.4}
        fill={theme.shadow.colour}
        opacity={theme.shadow.opacity * 0.7}
      />
      <rect
        x={tree.x - 0.8}
        y={tree.y}
        width={1.6}
        height={radius + 1.5}
        fill={theme.tree.trunk}
        stroke={outline ?? 'none'}
        strokeWidth={outline !== undefined ? 0.6 : 0}
      />
      <circle
        cx={tree.x}
        cy={tree.y - radius * 0.45}
        r={radius}
        fill={theme.tree.leaf}
        stroke={outline ?? 'none'}
        strokeWidth={outline !== undefined ? 0.8 : 0}
      />
      <circle
        cx={tree.x - radius * 0.35}
        cy={tree.y - radius * 0.75}
        r={radius * 0.62}
        fill={theme.tree.light}
        opacity={theme.night ? 0.55 : 0.9}
      />
      <circle cx={tree.x + radius * 0.3} cy={tree.y - radius * 0.35} r={radius * 0.34} fill={theme.tree.leaf} opacity={0.8} />
      <circle cx={tree.x - radius * 0.05} cy={tree.y - radius * 0.95} r={radius * 0.28} fill={theme.tree.light} opacity={0.7} />
    </g>
  );
}

function Cathedral({
  landmark,
  theme,
}: {
  readonly landmark: LandmarkModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const { x, y } = landmark.at;
  const outline = theme.outline;
  const strokeWidth = outline !== undefined ? 1.1 : 0.8;
  const { stone, stoneEdge, roof, roofEdge, glass, accent } = theme.landmark;

  return (
    <g>
      <rect x={x - 38} y={y - 16} width={76} height={38} fill={stone} stroke={outline ?? stoneEdge} strokeWidth={strokeWidth} />
      <polygon
        points={`${x - 43},${y - 16} ${x},${y - 44} ${x + 43},${y - 16}`}
        fill={roof}
        stroke={outline ?? roofEdge}
        strokeWidth={strokeWidth}
      />
      <rect x={x - 34} y={y - 38} width={13} height={40} fill={stone} stroke={outline ?? stoneEdge} strokeWidth={strokeWidth * 0.9} />
      <polygon
        points={`${x - 34},${y - 38} ${x - 27.5},${y - 56} ${x - 21},${y - 38}`}
        fill={roof}
        stroke={outline ?? roofEdge}
        strokeWidth={strokeWidth * 0.8}
      />
      <rect x={x + 21} y={y - 38} width={13} height={40} fill={stone} stroke={outline ?? stoneEdge} strokeWidth={strokeWidth * 0.9} />
      <polygon
        points={`${x + 21},${y - 38} ${x + 27.5},${y - 56} ${x + 34},${y - 38}`}
        fill={roof}
        stroke={outline ?? roofEdge}
        strokeWidth={strokeWidth * 0.8}
      />
      <circle cx={x} cy={y - 5} r={6.5} fill={glass} stroke={outline ?? roofEdge} strokeWidth={strokeWidth * 0.8} />
      <circle cx={x} cy={y - 5} r={2.8} fill="none" stroke={theme.night ? theme.windowLit : theme.station.fill} strokeWidth={0.9} />
      <path d={`M${x - 20} ${y + 22} Q${x} ${y + 32} ${x + 20} ${y + 22}`} fill="none" stroke={accent} strokeWidth={1.6} opacity={0.8} />
      <line x1={x - 27.5} y1={y - 56} x2={x - 27.5} y2={y - 63} stroke={outline ?? roofEdge} strokeWidth={1.1} />
      <line x1={x - 30.5} y1={y - 60} x2={x - 24.5} y2={y - 60} stroke={outline ?? roofEdge} strokeWidth={1.1} />
    </g>
  );
}

function StationHall({
  landmark,
  theme,
}: {
  readonly landmark: LandmarkModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const { x, y } = landmark.at;
  const outline = theme.outline;
  const strokeWidth = outline !== undefined ? 1.1 : 0.8;
  const { stone, stoneEdge, glass } = theme.landmark;

  return (
    <g>
      <rect x={x - 48} y={y - 16} width={96} height={34} fill={stone} stroke={outline ?? stoneEdge} strokeWidth={strokeWidth} />
      <path
        d={`M${x - 50} ${y - 16} Q${x} ${y - 39} ${x + 50} ${y - 16} Z`}
        fill={theme.night ? theme.windowLit : glass}
        stroke={outline ?? stoneEdge}
        strokeWidth={strokeWidth}
        opacity={theme.night ? 0.5 : 0.95}
      />
      {[-30, -10, 10, 30].map((offset) => (
        <line key={offset} x1={x + offset} y1={y - 16} x2={x + offset} y2={y - 33} stroke={stoneEdge} strokeWidth={0.7} opacity={0.7} />
      ))}
      <circle cx={x} cy={y - 22} r={4} fill={theme.night ? theme.windowLit : theme.station.fill} stroke={stoneEdge} strokeWidth={0.7} />
      <line x1={x} y1={y - 22} x2={x} y2={y - 25} stroke={stoneEdge} strokeWidth={0.6} />
      <line x1={x} y1={y - 22} x2={x + 2} y2={y - 21.5} stroke={stoneEdge} strokeWidth={0.6} />
    </g>
  );
}

function MarketHall({
  landmark,
  theme,
}: {
  readonly landmark: LandmarkModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const { x, y } = landmark.at;
  const outline = theme.outline;
  const strokeWidth = outline !== undefined ? 1.1 : 0.8;
  const { stone, stoneEdge, roof, roofEdge, accent } = theme.landmark;

  return (
    <g>
      <rect x={x - 31} y={y - 14} width={62} height={32} fill={stone} stroke={outline ?? stoneEdge} strokeWidth={strokeWidth} />
      <polygon
        points={`${x - 35},${y - 14} ${x},${y - 34} ${x + 35},${y - 14}`}
        fill={roof}
        stroke={outline ?? roofEdge}
        strokeWidth={strokeWidth}
      />
      {[-22, -8, 8, 22].map((offset) => (
        <rect
          key={offset}
          x={x + offset - 5}
          y={y + 18}
          width={9}
          height={7}
          fill={accent}
          stroke={outline ?? stoneEdge}
          strokeWidth={0.5}
        />
      ))}
      <circle cx={x} cy={y - 26} r={2.4} fill={theme.night ? theme.windowLit : theme.station.fill} stroke={outline ?? roofEdge} strokeWidth={0.5} />
      {theme.ambient === 'neon' && (
        <g>
          <rect x={x - 26} y={y - 32} width={52} height={4} fill={theme.landmark.accent} opacity={0.35} />
          <rect x={x - 20} y={y - 30.5} width={40} height={2} fill={theme.landmark.accent} />
        </g>
      )}
    </g>
  );
}

function OldSquare({
  landmark,
  theme,
}: {
  readonly landmark: LandmarkModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const { x, y } = landmark.at;
  const outline = theme.outline;
  const strokeWidth = outline !== undefined ? 1.1 : 1;
  const { stone, stoneEdge, glass } = theme.landmark;

  return (
    <g>
      <rect x={x - 30} y={y - 24} width={60} height={48} fill={stone} stroke={outline ?? stoneEdge} strokeWidth={strokeWidth} />
      <circle cx={x} cy={y} r={10} fill={glass} stroke={theme.waterEdge} strokeWidth={1} />
      <circle cx={x} cy={y} r={4} fill={theme.night ? theme.windowLit : theme.station.fill} stroke={theme.waterEdge} strokeWidth={0.7} opacity={theme.night ? 0.65 : 1} />
      <circle cx={x - 20} cy={y - 14} r={3} fill={theme.tree.leaf} />
      <circle cx={x + 21} cy={y + 15} r={3.2} fill={theme.tree.leaf} />
      {theme.ambient === 'awnings' && (
        <g>
          {[-16, 0, 16].map((offset) => (
            <g key={offset}>
              <circle cx={x + offset} cy={y + 18} r={5.4} fill={theme.route.taxi} opacity={0.35} />
              <circle cx={x + offset} cy={y + 18} r={3.4} fill={theme.station.fill} stroke={theme.landmark.stoneEdge} strokeWidth={0.5} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

/** Fallback for civic kinds the rich Vintage renderer handles in Canvas. */
function CivicHall({
  landmark,
  theme,
}: {
  readonly landmark: LandmarkModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const { x, y } = landmark.at;
  const { stone, stoneEdge, roof, roofEdge } = theme.landmark;
  return (
    <g>
      <rect x={x - 32} y={y - 16} width={64} height={34} fill={stone} stroke={stoneEdge} strokeWidth={0.8} />
      <polygon points={`${x - 36},${y - 16} ${x},${y - 38} ${x + 36},${y - 16}`} fill={roof} stroke={roofEdge} strokeWidth={0.8} />
      <rect x={x - 7} y={y - 42} width={14} height={28} fill={stone} stroke={stoneEdge} strokeWidth={0.7} />
      <polygon points={`${x - 7},${y - 42} ${x},${y - 57} ${x + 7},${y - 42}`} fill={roof} stroke={roofEdge} strokeWidth={0.6} />
    </g>
  );
}

function Landmark({
  landmark,
  theme,
}: {
  readonly landmark: LandmarkModel;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  const anchored =
    landmark.kind === 'cathedral' ||
    landmark.kind === 'station' ||
    landmark.kind === 'market' ||
    landmark.kind === 'square';
  return (
    <g>
      {landmark.kind === 'cathedral' && <Cathedral landmark={landmark} theme={theme} />}
      {landmark.kind === 'station' && <StationHall landmark={landmark} theme={theme} />}
      {landmark.kind === 'market' && <MarketHall landmark={landmark} theme={theme} />}
      {landmark.kind === 'square' && <OldSquare landmark={landmark} theme={theme} />}
      {!anchored && <CivicHall landmark={landmark} theme={theme} />}
      <text
        x={landmark.at.x}
        y={landmark.at.y - 56}
        textAnchor="middle"
        fontSize={10.5}
        letterSpacing={1.4}
        fill={theme.station.label}
        paintOrder="stroke"
        stroke={theme.station.labelStroke}
        strokeWidth={3}
        style={{ textTransform: 'uppercase' }}
      >
        {landmark.label}
      </text>
    </g>
  );
}

function LampGlows({
  map,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
}): React.JSX.Element | null {
  if (theme.ambient !== 'lamps' && theme.ambient !== 'neon') return null;
  const spacing = theme.ambient === 'neon' ? 7 : 5;
  const nodes = map.graph.nodes.filter((_, index) => index % spacing === 0);
  return (
    <g aria-hidden="true">
      {nodes.map((node) => (
        <g key={`lamp-${node.id}`}>
          <circle cx={node.x} cy={node.y + 8} r={theme.ambient === 'neon' ? 24 : 28} fill={`url(#city-lamp-${theme.id})`} />
          <circle cx={node.x + 3} cy={node.y + 12} r={1.5} fill={theme.windowLit} />
          <line x1={node.x + 3} y1={node.y + 12} x2={node.x + 3} y2={node.y + 5} stroke={theme.windowLit} strokeWidth={0.8} opacity={0.8} />
        </g>
      ))}
      {map.city.landmarks.map((landmark) => (
        <circle
          key={`flood-${landmark.id}`}
          cx={landmark.at.x}
          cy={landmark.at.y}
          r={56}
          fill={`url(#city-lamp-${theme.id})`}
          opacity={0.7}
        />
      ))}
    </g>
  );
}

function NeonSigns({ theme }: { readonly theme: VisualTheme }): React.JSX.Element | null {
  if (theme.ambient !== 'neon') return null;
  const signs = [
    { x: 520, y: 250, w: 34, h: 5, colour: '#ff5fa2' },
    { x: 600, y: 300, w: 26, h: 4, colour: '#59e0ff' },
    { x: 735, y: 330, w: 30, h: 5, colour: '#ff5fa2' },
    { x: 855, y: 535, w: 34, h: 5, colour: '#59e0ff' },
    { x: 660, y: 210, w: 22, h: 4, colour: '#ffd35c' },
    { x: 900, y: 260, w: 24, h: 4, colour: '#ff5fa2' },
    { x: 480, y: 420, w: 26, h: 4, colour: '#59e0ff' },
  ];
  return (
    <g aria-hidden="true">
      {signs.map((sign) => (
        <g key={`${sign.x}-${sign.y}`}>
          <rect x={sign.x - 3} y={sign.y - 3} width={sign.w + 6} height={sign.h + 6} fill={sign.colour} opacity={0.18} />
          <rect x={sign.x} y={sign.y} width={sign.w} height={sign.h} fill={sign.colour} opacity={0.92} />
          {[0, 1, 2].map((index) => (
            <rect
              key={index}
              x={sign.x + sign.w * (0.12 + index * 0.16)}
              y={sign.y + sign.h + 2}
              width={sign.w * 0.12}
              height={8 + index * 4}
              fill={sign.colour}
              opacity={0.18 - index * 0.04}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

function StreetLife({ theme }: { readonly theme: VisualTheme }): React.JSX.Element | null {
  if (theme.detail !== 'rich') return null;
  const lamps = [
    { x: 548, y: 238 },
    { x: 610, y: 300 },
    { x: 690, y: 318 },
    { x: 492, y: 396 },
    { x: 735, y: 365 },
    { x: 812, y: 436 },
  ];
  return (
    <g aria-hidden="true">
      {lamps.map((lamp) => (
        <g key={`${lamp.x}-${lamp.y}`}>
          <circle cx={lamp.x} cy={lamp.y} r={9} fill={`url(#city-lamp-${theme.id})`} opacity={0.65} />
          <line x1={lamp.x} y1={lamp.y} x2={lamp.x} y2={lamp.y - 7} stroke={theme.wallEdge} strokeWidth={0.9} />
          <circle cx={lamp.x} cy={lamp.y - 7.5} r={1.6} fill={theme.windowLit} />
        </g>
      ))}
      {[
        { x: 548, y: 286, angle: 8 },
        { x: 690, y: 456, angle: -12 },
        { x: 760, y: 410, angle: 5 },
      ].map((car) => (
        <g key={`${car.x}-${car.y}`} transform={`translate(${car.x} ${car.y}) rotate(${car.angle})`}>
          <rect x={-6.5} y={-2.8} width={13} height={5.6} rx={1.4} fill={theme.wallEdge} opacity={0.75} />
          <rect x={-3.8} y={-1.8} width={7.6} height={3.6} rx={1.1} fill={theme.window} opacity={0.55} />
          <rect x={-4.6} y={-1.8} width={1.8} height={3.6} rx={0.5} fill={theme.station.fill} opacity={0.35} />
          <circle cx={-4.2} cy={3.1} r={1.3} fill={theme.shadow.colour} />
          <circle cx={4.2} cy={3.1} r={1.3} fill={theme.shadow.colour} />
        </g>
      ))}
    </g>
  );
}

function RainOverlay({
  area,
  theme,
}: {
  readonly area: CityCrop;
  readonly theme: VisualTheme;
}): React.JSX.Element | null {
  if (!theme.rain) return null;
  const drops = Array.from({ length: 230 }, (_, index) => {
    const hash = hashString(`rain-${index}`);
    const x = area.x + ((hash % 1000) / 1000) * area.width;
    const y = area.y + (((hash >>> 10) % 1000) / 1000) * area.height;
    const length = 8 + (hash % 13);
    return { x, y, length };
  });

  return (
    <g aria-hidden="true" opacity={0.7}>
      {drops.map((drop, index) => (
        <line
          key={`rain-${index}`}
          x1={drop.x}
          y1={drop.y}
          x2={drop.x - 3}
          y2={drop.y + drop.length}
          stroke="#b7d8e8"
          strokeWidth={0.55}
          opacity={0.16}
        />
      ))}
      {[
        { x: 530, y: 330, rx: 20, ry: 5 },
        { x: 690, y: 390, rx: 28, ry: 6 },
        { x: 780, y: 300, rx: 16, ry: 4 },
        { x: 880, y: 520, rx: 24, ry: 5 },
      ].map((puddle) => (
        <g key={`${puddle.x}-${puddle.y}`}>
          <ellipse cx={puddle.x} cy={puddle.y} rx={puddle.rx} ry={puddle.ry} fill={theme.water} opacity={0.35} />
          <ellipse
            cx={puddle.x - 4}
            cy={puddle.y - 1}
            rx={puddle.rx * 0.45}
            ry={puddle.ry * 0.3}
            fill="#b7d8e8"
            opacity={0.18}
          />
        </g>
      ))}
      {[
        { x: 566, y: 360 },
        { x: 704, y: 420 },
        { x: 842, y: 470 },
      ].map((umbrella) => (
        <g key={`${umbrella.x}-${umbrella.y}`}>
          <line x1={umbrella.x} y1={umbrella.y} x2={umbrella.x} y2={umbrella.y - 8} stroke={theme.wallEdge} strokeWidth={0.8} />
          <path
            d={`M${umbrella.x - 7} ${umbrella.y - 7} Q${umbrella.x} ${umbrella.y - 14} ${umbrella.x + 7} ${umbrella.y - 7} Z`}
            fill={theme.landmark.accent}
            opacity={0.45}
          />
        </g>
      ))}
    </g>
  );
}

function PaperCompass({
  area,
  theme,
}: {
  readonly area: CityCrop;
  readonly theme: VisualTheme;
}): React.JSX.Element | null {
  if (!theme.grain) return null;
  const x = area.x + area.width - 46;
  const y = area.y + area.height - 48;
  return (
    <g aria-hidden="true" opacity={0.9}>
      <circle cx={x} cy={y} r={22} fill={theme.station.fill} stroke={theme.outline ?? theme.wallEdge} strokeWidth={1.1} opacity={0.9} />
      <path
        d={`M${x} ${y - 14} L${x + 4} ${y - 2} L${x} ${y} L${x - 4} ${y - 2} Z`}
        fill={theme.landmark.accent}
      />
      <text x={x} y={y + 12} textAnchor="middle" fontSize={8} fontWeight={800} fill={theme.station.text}>
        N
      </text>
    </g>
  );
}

export function CityBase({
  map,
  theme,
  crop,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
  readonly crop?: CityCrop;
}): React.JSX.Element {
  const buildings = useMemo(
    () =>
      buildingsForMap(map).filter((building) =>
        inCrop(building.x, building.y, building.w, building.h, crop),
      ),
    [crop, map],
  );
  const trees = useMemo(
    () => treesForMap(map).filter((tree) => inCrop(tree.x, tree.y, tree.r, tree.r, crop)),
    [crop, map],
  );
  const area = crop ?? {
    x: 0,
    y: 0,
    width: map.bounds.width,
    height: map.bounds.height,
  };

  return (
    <g>
      <defs>
        <radialGradient id={`city-lamp-${theme.id}`}>
          <stop offset="0%" stopColor={theme.windowLit} stopOpacity={0.42} />
          <stop offset="55%" stopColor={theme.windowLit} stopOpacity={0.14} />
          <stop offset="100%" stopColor={theme.windowLit} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`city-sun-${theme.id}`}>
          <stop offset="0%" stopColor="#ffd58a" stopOpacity={0.42} />
          <stop offset="55%" stopColor="#ffd58a" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#ffd58a" stopOpacity={0} />
        </radialGradient>
        <pattern id={`city-grain-${theme.id}`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.55" fill="#4b4338" opacity="0.5" />
          <circle cx="6" cy="5" r="0.4" fill="#4b4338" opacity="0.35" />
        </pattern>
        <pattern id={`city-tile-${theme.id}`} width="7" height="4.5" patternUnits="userSpaceOnUse">
          <line x1="0" y1="4" x2="7" y2="4" stroke={theme.wallEdge} strokeWidth="0.35" opacity="0.75" />
          <line x1="3.5" y1="0" x2="3.5" y2="4" stroke={theme.wallEdge} strokeWidth="0.22" opacity="0.45" />
        </pattern>
        <pattern id={`city-brick-${theme.id}`} width="6" height="3" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2.6" x2="6" y2="2.6" stroke={theme.wallEdge} strokeWidth="0.25" opacity="0.6" />
          <line x1="3" y1="0" x2="3" y2="1.4" stroke={theme.wallEdge} strokeWidth="0.2" opacity="0.45" />
        </pattern>
      </defs>
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill={theme.background} />
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill={theme.ground} />
      <StreetLayer map={map} theme={theme} />
      <g>
        {map.city.blocks.map((block) => (
          <BlockGround key={block.id} block={block} theme={theme} />
        ))}
      </g>
      <g>
        {buildings.map((building) => (
          <BuildingShape key={building.key} building={building} theme={theme} />
        ))}
      </g>
      <g>
        {trees.map((tree) => (
          <TreeShape key={tree.key} tree={tree} theme={theme} />
        ))}
      </g>
      <g>
        {map.city.landmarks.map((landmark) => (
          <Landmark key={landmark.id} landmark={landmark} theme={theme} />
        ))}
      </g>
      <StreetLife theme={theme} />
      {theme.id === 'golden' && (
        <g>
          <rect
            x={area.x}
            y={area.y}
            width={area.width}
            height={area.height}
            fill={`url(#city-sun-${theme.id})`}
            opacity={0.36}
          />
          <rect
            x={area.x}
            y={area.y}
            width={area.width}
            height={area.height}
            fill={`url(#city-grain-${theme.id})`}
            opacity={0.1}
          />
        </g>
      )}
      <LampGlows map={map} theme={theme} />
      <NeonSigns theme={theme} />
      <RainOverlay area={area} theme={theme} />
      {theme.grain && (
        <rect
          x={area.x}
          y={area.y}
          width={area.width}
          height={area.height}
          fill={`url(#city-grain-${theme.id})`}
          opacity={0.3}
        />
      )}
      <PaperCompass area={area} theme={theme} />
    </g>
  );
}

const MemoCityBase = memo(CityBase);

/** The city plate for a themed skin. The live overlay is rendered separately. */
export function CitySkinPlate({
  map,
  viewBox,
  theme,
}: {
  readonly map: GeneratedMap;
  readonly viewBox: string;
  readonly theme: VisualTheme;
}): React.JSX.Element {
  return (
    <svg
      className="city-plate"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <MemoCityBase map={map} theme={theme} />
    </svg>
  );
}

/** A small helper for the lab: the city without the overlay. */
export function CityBaseForCrop({
  map,
  theme,
  crop,
}: {
  readonly map: GeneratedMap;
  readonly theme: VisualTheme;
  readonly crop: CityCrop;
}): React.JSX.Element {
  return <MemoCityBase map={map} theme={theme} crop={crop} />;
}
