/**
 * Camera state for the prototype viewport.
 *
 * Two modes share one camera. `play` frames the character you are watching —
 * the Fugitive, or the Agent whose move is currently being revealed. `map` is
 * free: the director's separate view for inspecting anywhere else on the board.
 *
 * Camera moves are eased over a few hundred milliseconds so a pan reads as a
 * camera move rather than a cut. The map itself is redrawn through an SVG
 * `viewBox`; the token/label overlay compensates for the scale separately.
 *
 * @module apps/web/prototype/useMapCamera
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MapPoint } from '@x-yard/map-generator';

import {
  CAMERA_ANIMATION_MS,
  ZOOM_ANIMATION_MS,
  clamp,
  clampCamera,
  easeOutCubic,
  fitScale,
  framePoints,
  lerp,
  overviewCamera,
  panCameraBy,
  playScale,
  zoomCameraAt,
  type Camera,
  type StageSize,
  type ViewMode,
  type WorldBounds,
} from './camera';

export interface MapCameraOptions {
  readonly bounds: WorldBounds;
  readonly stage: StageSize;
  /** Points the play camera should keep in frame. Empty means the map centre. */
  readonly focusPoints: readonly MapPoint[];
}

export interface MapCamera {
  readonly camera: Camera;
  readonly viewMode: ViewMode;
  readonly followZoom: number;
  readonly playScale: number;
  readonly overviewScale: number;
  readonly setPlay: () => void;
  readonly openMap: () => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly recentre: () => void;
  readonly panBy: (dxPixels: number, dyPixels: number) => void;
  readonly zoomAt: (factor: number, anchorX: number, anchorY: number, smooth?: boolean) => void;
}

function focusSignature(points: readonly MapPoint[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join('|');
}

export function useMapCamera({ bounds, stage, focusPoints }: MapCameraOptions): MapCamera {
  const [camera, setCamera] = useState<Camera>(() => ({
    x: bounds.width / 2,
    y: bounds.height / 2,
    scale: 1,
  }));
  const [viewMode, setViewMode] = useState<ViewMode>('play');
  const [followZoom, setFollowZoom] = useState(1);

  const cameraRef = useRef(camera);
  const animationRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const stopAnimation = useCallback((): void => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => stopAnimation, [stopAnimation]);

  const commit = useCallback(
    (next: Camera): void => {
      const clamped = clampCamera(next, bounds, stage);
      cameraRef.current = clamped;
      setCamera(clamped);
    },
    [bounds, stage],
  );

  const animateTo = useCallback(
    (next: Camera, duration = CAMERA_ANIMATION_MS): void => {
      stopAnimation();
      const target = clampCamera(next, bounds, stage);
      const from = cameraRef.current;

      if (duration <= 0) {
        commit(target);
        return;
      }

      const started = performance.now();
      const tick = (now: number): void => {
        const t = Math.min(1, (now - started) / duration);
        const eased = easeOutCubic(t);
        commit({
          x: lerp(from.x, target.x, eased),
          y: lerp(from.y, target.y, eased),
          scale: lerp(from.scale, target.scale, eased),
        });
        if (t < 1) {
          animationRef.current = requestAnimationFrame(tick);
        } else {
          animationRef.current = null;
        }
      };
      animationRef.current = requestAnimationFrame(tick);
    },
    [bounds, commit, stage, stopAnimation],
  );

  const playTarget = useMemo(
    () =>
      framePoints(focusPoints, bounds, stage, {
        paddingPx: 104,
        maxScale: playScale(bounds, stage) * followZoom,
        minScale: Math.max(fitScale(bounds, stage), 0.05),
      }),
    [bounds, focusPoints, followZoom, stage],
  );

  // Follow every new focus — the Fugitive after a move, the active Agent during
  // its reveal. The first measured frame snaps; later changes ease.
  const signature = focusSignature(focusPoints);
  useEffect(() => {
    if (viewMode !== 'play' || stage.width <= 0 || stage.height <= 0) return;
    if (!initializedRef.current) {
      commit(playTarget);
      initializedRef.current = true;
      return;
    }
    animateTo(playTarget);
    // `signature` stands in for focusPoints, which is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, signature, stage.width, stage.height, followZoom, playTarget, commit, animateTo]);

  // A resize in free view must not leave the camera outside the city.
  useEffect(() => {
    if (viewMode !== 'map' || stage.width <= 0 || stage.height <= 0) return;
    commit(cameraRef.current);
  }, [viewMode, stage.width, stage.height, commit]);

  const setPlay = useCallback((): void => {
    setViewMode('play');
  }, []);

  const openMap = useCallback((): void => {
    setViewMode('map');
    animateTo(overviewCamera(bounds, stage, focusPoints[0]));
  }, [animateTo, bounds, focusPoints, stage]);

  const recentre = useCallback((): void => {
    setFollowZoom(1);
    setViewMode('play');
    animateTo(
      framePoints(focusPoints, bounds, stage, {
        paddingPx: 104,
        maxScale: playScale(bounds, stage),
        minScale: Math.max(fitScale(bounds, stage), 0.05),
      }),
    );
  }, [animateTo, bounds, focusPoints, stage]);

  const zoomIn = useCallback((): void => {
    if (viewMode === 'play') {
      setFollowZoom((value) => clamp(value * 1.22, 0.75, 2.3));
      return;
    }
    animateTo(
      zoomCameraAt(cameraRef.current, 1.25, stage.width / 2, stage.height / 2, bounds, stage),
    );
  }, [animateTo, bounds, stage, viewMode]);

  const zoomOut = useCallback((): void => {
    if (viewMode === 'play') {
      setFollowZoom((value) => clamp(value / 1.22, 0.75, 2.3));
      return;
    }
    animateTo(
      zoomCameraAt(cameraRef.current, 1 / 1.25, stage.width / 2, stage.height / 2, bounds, stage),
    );
  }, [animateTo, bounds, stage, viewMode]);

  /** A drag or wheel is a request to look around: leave the follow camera. */
  const enterFree = useCallback((): void => {
    stopAnimation();
    setViewMode('map');
  }, [stopAnimation]);

  const panBy = useCallback(
    (dxPixels: number, dyPixels: number): void => {
      enterFree();
      commit(panCameraBy(cameraRef.current, dxPixels, dyPixels, bounds, stage));
    },
    [bounds, commit, enterFree, stage],
  );

  const zoomAt = useCallback(
    (factor: number, anchorX: number, anchorY: number, smooth = true): void => {
      enterFree();
      const next = zoomCameraAt(cameraRef.current, factor, anchorX, anchorY, bounds, stage);
      if (smooth) animateTo(next, ZOOM_ANIMATION_MS);
      else commit(next);
    },
    [animateTo, bounds, commit, enterFree, stage],
  );

  return {
    camera,
    viewMode,
    followZoom,
    playScale: playScale(bounds, stage),
    overviewScale: Math.max(fitScale(bounds, stage), 0.05),
    setPlay,
    openMap,
    zoomIn,
    zoomOut,
    recentre,
    panBy,
    zoomAt,
  };
}

/** Exported for the HUD: the zoom multiple relative to the full-city fit. */
export function zoomLabel(camera: Camera, bounds: WorldBounds, stage: StageSize): string {
  const fit = fitScale(bounds, stage);
  if (fit <= 0) return '1.0×';
  return `${(camera.scale / fit).toFixed(1)}×`;
}

