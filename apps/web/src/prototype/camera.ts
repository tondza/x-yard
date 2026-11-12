/**
 * Camera maths for the prototype viewport.
 *
 * Presentation only: this module knows nothing about game rules. It converts a
 * map-space camera into an SVG `viewBox`, decides how much of the city the play
 * view should show, and keeps a pan or zoom inside the map.
 *
 * The screen-space overlay needs the same scale to keep station labels and
 * tokens at a readable size, so every helper returns plain numbers rather than
 * a rendered `viewBox` string alone.
 *
 * @module apps/web/prototype/camera
 */

import type { MapPoint } from '@x-yard/map-generator';

export interface StageSize {
  readonly width: number;
  readonly height: number;
}

export interface WorldBounds {
  readonly width: number;
  readonly height: number;
}

/** Map-space centre plus screen pixels per map unit. */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** `play` follows the current mover; `map` is the free inspectable view. */
export type ViewMode = 'play' | 'map';

export const CAMERA_MAX_SCALE = 3.4;
/** Never show less than this much of the city in the play view, even on a phone. */
export const PLAY_MIN_SCALE = 0.85;
/** World units across the short side of a comfortable play view. */
export const PLAY_WORLD_SPAN = 540;
export const CAMERA_ANIMATION_MS = 460;
export const ZOOM_ANIMATION_MS = 180;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Scale at which the whole city fits inside the stage. */
export function fitScale(bounds: WorldBounds, stage: StageSize): number {
  if (stage.width <= 0 || stage.height <= 0 || bounds.width <= 0 || bounds.height <= 0) return 0;
  return Math.min(stage.width / bounds.width, stage.height / bounds.height);
}

/**
 * The default gameplay zoom: a window roughly 540 world units tall, but never
 * so tight that a phone shows only a handful of stations, and never smaller than
 * the full-city fit.
 */
export function playScale(bounds: WorldBounds, stage: StageSize): number {
  if (stage.width <= 0 || stage.height <= 0) return 1;
  const fit = fitScale(bounds, stage);
  const shortSide = Math.min(stage.width, stage.height);
  const floor = Math.max(fit, PLAY_MIN_SCALE);
  return clamp(shortSide / PLAY_WORLD_SPAN, floor, CAMERA_MAX_SCALE);
}

/** Keep the visible rectangle inside the city; centre an axis that is larger. */
function clampAxis(centre: number, halfView: number, size: number): number {
  if (halfView * 2 >= size) return size / 2;
  return clamp(centre, halfView, size - halfView);
}

export function clampCamera(camera: Camera, bounds: WorldBounds, stage: StageSize): Camera {
  const minimum = Math.max(fitScale(bounds, stage), 0.05);
  const scale = clamp(camera.scale, minimum, CAMERA_MAX_SCALE);

  if (stage.width <= 0 || stage.height <= 0) {
    return { x: bounds.width / 2, y: bounds.height / 2, scale };
  }

  return {
    x: clampAxis(camera.x, stage.width / scale / 2, bounds.width),
    y: clampAxis(camera.y, stage.height / scale / 2, bounds.height),
    scale,
  };
}

/**
 * Keep an axis-aligned view rectangle inside a convex plate polygon.
 *
 * The projected city is a parallelogram, but a camera clamped to its bounding
 * box can show the empty corners beside the city. This shifts the centre (never
 * the scale) until every edge clears the view; if the view is too large to fit,
 * it settles at the least-violating centre.
 */
export function clampCameraToPlate(
  camera: Camera,
  plate: readonly MapPoint[],
  stage: StageSize,
  strength = 1,
): Camera {
  if (plate.length < 3 || stage.width <= 0 || stage.height <= 0) return camera;
  const halfWidth = stage.width / (2 * camera.scale);
  const halfHeight = stage.height / (2 * camera.scale);

  let area = 0;
  for (let index = 0; index < plate.length; index += 1) {
    const a = plate[index];
    const b = plate[(index + 1) % plate.length];
    if (a === undefined || b === undefined) continue;
    area += a.x * b.y - b.x * a.y;
  }
  const points = area < 0 ? [...plate].reverse() : plate;

  let { x, y } = camera;
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if (a === undefined || b === undefined) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      // Left normal: inward for a counter-clockwise polygon.
      const nx = -dy / length;
      const ny = dx / length;
      const support = Math.abs(nx) * halfWidth + Math.abs(ny) * halfHeight;
      const distance = nx * (x - a.x) + ny * (y - a.y);
      if (distance < support) {
        const shift = support - distance;
        x += nx * shift;
        y += ny * shift;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // A partial shift keeps the framed focus nearer the centre while still
  // removing most of the empty plate corner.
  return {
    ...camera,
    x: camera.x + (x - camera.x) * strength,
    y: camera.y + (y - camera.y) * strength,
  };
}

/** The `viewBox` both the city plate and the overlay use. */
export function cameraViewBox(camera: Camera, stage: StageSize): string {
  if (stage.width <= 0 || stage.height <= 0) return '0 0 1 1';
  const width = stage.width / camera.scale;
  const height = stage.height / camera.scale;
  return `${camera.x - width / 2} ${camera.y - height / 2} ${width} ${height}`;
}

export interface FrameOptions {
  /** Screen pixels kept free around the framed points for HUD and air. */
  readonly paddingPx: number;
  readonly maxScale: number;
  readonly minScale?: number;
}

/**
 * Frame a set of map points. A single point sits at the play zoom; a longer
 * move zooms out just far enough that both ends (and the fugitive, when passed)
 * stay visible.
 */
export function framePoints(
  points: readonly MapPoint[],
  bounds: WorldBounds,
  stage: StageSize,
  options: FrameOptions,
): Camera {
  const maxScale = clamp(options.maxScale, 0.05, CAMERA_MAX_SCALE);
  const minScale = clamp(options.minScale ?? fitScale(bounds, stage), 0.05, maxScale);

  if (points.length === 0 || stage.width <= 0 || stage.height <= 0) {
    return clampCamera(
      { x: bounds.width / 2, y: bounds.height / 2, scale: maxScale },
      bounds,
      stage,
    );
  }

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

  const availableWidth = Math.max(1, stage.width - options.paddingPx * 2);
  const availableHeight = Math.max(1, stage.height - options.paddingPx * 2);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  let scale = maxScale;
  if (spanX > 1) scale = Math.min(scale, availableWidth / spanX);
  if (spanY > 1) scale = Math.min(scale, availableHeight / spanY);
  scale = clamp(scale, minScale, maxScale);

  return clampCamera({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale }, bounds, stage);
}

export function panCameraBy(
  camera: Camera,
  dxPixels: number,
  dyPixels: number,
  bounds: WorldBounds,
  stage: StageSize,
): Camera {
  return clampCamera(
    {
      x: camera.x - dxPixels / camera.scale,
      y: camera.y - dyPixels / camera.scale,
      scale: camera.scale,
    },
    bounds,
    stage,
  );
}

/** Zoom keeping the map point under `anchor` fixed on screen. */
export function zoomCameraAt(
  camera: Camera,
  factor: number,
  anchorX: number,
  anchorY: number,
  bounds: WorldBounds,
  stage: StageSize,
): Camera {
  const minimum = Math.max(fitScale(bounds, stage), 0.05);
  const nextScale = clamp(camera.scale * factor, minimum, CAMERA_MAX_SCALE);
  if (nextScale === camera.scale) return camera;

  const offsetX = anchorX - stage.width / 2;
  const offsetY = anchorY - stage.height / 2;
  const worldX = camera.x + offsetX / camera.scale;
  const worldY = camera.y + offsetY / camera.scale;

  return clampCamera(
    {
      x: worldX - offsetX / nextScale,
      y: worldY - offsetY / nextScale,
      scale: nextScale,
    },
    bounds,
    stage,
  );
}

/**
 * Full-city overview, centred. On a portrait screen the 4:3 city cannot fit
 * legibly, so the overview fills the frame (cover) and invites a pan; on a
 * landscape/desktop frame the whole city fits.
 */
export function overviewCamera(
  bounds: WorldBounds,
  stage: StageSize,
  centre?: MapPoint,
): Camera {
  const fit = Math.max(fitScale(bounds, stage), 0.05);
  const cover = Math.max(stage.width / bounds.width, stage.height / bounds.height);
  const scale = stage.height > stage.width ? Math.max(fit, cover) : fit;

  return clampCamera(
    {
      x: centre?.x ?? bounds.width / 2,
      y: centre?.y ?? bounds.height / 2,
      scale,
    },
    bounds,
    stage,
  );
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
