import { useEffect, useRef } from 'react';

import type { BoardDto, Facility, TransportMode } from '@x-yard/shared-types';

/** Transit-tier colours, the single source of truth for mode identity (§3). */
export const MODE_COLOURS: Readonly<Record<TransportMode, string>> = {
  taxi: '#e8b23a',
  bus: '#4a9d5f',
  underground: '#c0504d',
  special: '#3b7ea1',
};

/** Facility marker colours (§4). */
export const FACILITY_COLOURS: Readonly<Record<Facility, string>> = {
  'safe-house': '#6ee7a8',
  'black-market': '#c084fc',
};

/** Draw order: short-range mesh first, long jumps on top. */
const DRAW_ORDER: readonly TransportMode[] = ['taxi', 'bus', 'underground', 'special'];

const STATION_RADIUS = 9;
const FACILITY_RADIUS = 15;
const BACKGROUND = '#12161c';
const STATION_FILL = '#e6edf3';
const LABEL_COLOUR = '#9aa7b4';

/**
 * Draw a facility marker around its node: a square for a Safe House, a diamond
 * for a Black Market. Shapes differ as well as colours so the map stays legible
 * without relying on colour perception.
 */
function drawFacility(
  context: CanvasRenderingContext2D,
  facility: Facility,
  x: number,
  y: number,
): void {
  context.strokeStyle = FACILITY_COLOURS[facility];
  context.lineWidth = 2;
  context.beginPath();

  if (facility === 'safe-house') {
    context.rect(x - FACILITY_RADIUS, y - FACILITY_RADIUS, FACILITY_RADIUS * 2, FACILITY_RADIUS * 2);
  } else {
    context.moveTo(x, y - FACILITY_RADIUS);
    context.lineTo(x + FACILITY_RADIUS, y);
    context.lineTo(x, y + FACILITY_RADIUS);
    context.lineTo(x - FACILITY_RADIUS, y);
    context.closePath();
  }

  context.stroke();
}

/**
 * Draw the board.
 *
 * Rendering is a pure function of the board DTO, so the same graph always
 * produces the same picture — which is what makes canvas assertions in
 * Playwright tractable rather than flaky.
 */
function drawBoard(canvas: HTMLCanvasElement, board: BoardDto): void {
  const context = canvas.getContext('2d');
  if (context === null) return;

  const stationById = new Map(board.stations.map((station) => [station.id, station]));

  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Routes first, so station discs sit on top of the lines.
  for (const mode of DRAW_ORDER) {
    context.strokeStyle = MODE_COLOURS[mode];
    context.lineWidth = mode === 'underground' ? 4 : 2;
    context.beginPath();
    for (const route of board.routes) {
      if (route.mode !== mode) continue;
      const from = stationById.get(route.from);
      const to = stationById.get(route.to);
      if (from === undefined || to === undefined) continue;
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    }
    context.stroke();
  }

  for (const station of board.stations) {
    for (const facility of station.facilities) {
      drawFacility(context, facility, station.x, station.y);
    }
  }

  context.font = '11px system-ui, sans-serif';
  context.textAlign = 'center';

  for (const station of board.stations) {
    context.beginPath();
    context.arc(station.x, station.y, STATION_RADIUS, 0, Math.PI * 2);
    context.fillStyle = STATION_FILL;
    context.fill();

    context.fillStyle = LABEL_COLOUR;
    context.fillText(station.id, station.x, station.y - STATION_RADIUS - 4);
  }
}

/** Canvas-2D renderer for the transit network. */
export function GameCanvas({ board }: { readonly board: BoardDto }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    drawBoard(canvas, board);
  }, [board]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      style={{ borderRadius: 8, display: 'block', background: BACKGROUND }}
    />
  );
}
