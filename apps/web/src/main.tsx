import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

/*
 * Dev-only screens. Putting each lazy import behind a statically false constant
 * lets the production build drop their chunks entirely, not merely leave them
 * unreachable.
 */
const Prototype = import.meta.env.DEV ? lazy(() => import('./prototype/Prototype')) : null;
const MapLab = import.meta.env.DEV ? lazy(() => import('./lab/MapLab')) : null;
const CityVisualLab = import.meta.env.DEV ? lazy(() => import('./lab/CityVisualLab')) : null;
const RtsVisualLab = import.meta.env.DEV ? lazy(() => import('./lab/rts/RtsVisualLab')) : null;
const VintageVisualLab = import.meta.env.DEV ? lazy(() => import('./lab/rts/VintageVisualLab')) : null;

type DevRoute = 'prototype' | 'lab' | 'visuals' | 'rts' | 'vintage' | 'board';

function devRoute(): DevRoute {
  if (!import.meta.env.DEV) return 'board';
  const params = new URLSearchParams(window.location.search);
  if (params.has('board')) return 'board';
  if (params.has('lab')) return 'lab';
  if (params.has('visuals')) return 'visuals';
  if (params.has('rts')) return 'rts';
  if (params.has('vintage')) return 'vintage';
  return 'prototype';
}

const route = devRoute();
const View =
  route === 'prototype'
    ? Prototype
    : route === 'lab'
      ? MapLab
      : route === 'visuals'
        ? CityVisualLab
        : route === 'rts'
          ? RtsVisualLab
          : route === 'vintage'
            ? VintageVisualLab
            : null;

const container = document.getElementById('root');
if (container === null) {
  throw new Error('missing #root element in index.html');
}

createRoot(container).render(
  <StrictMode>
    {View !== null ? (
      <Suspense
        fallback={
          <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#f5efe1' }}>
            Loading prototype…
          </div>
        }
      >
        <View />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
