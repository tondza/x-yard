import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

/*
 * The lab is internal tooling. Putting the lazy import behind a statically
 * false constant lets the production build drop the chunk entirely, not merely
 * leave it unreachable.
 */
const MapLab = import.meta.env.DEV ? lazy(() => import('./lab/MapLab')) : null;

/**
 * The map lab is the default view of the dev server. `?board` still opens the
 * original server-backed board scaffold. Production builds never route here.
 *
 * Open it with `/` or `/?lab` on the Vite dev server.
 */
function isMapLab(): boolean {
  if (MapLab === null) return false;
  return !new URLSearchParams(window.location.search).has('board');
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('missing #root element in index.html');
}

const Lab = MapLab;

createRoot(container).render(
  <StrictMode>
    {Lab !== null && isMapLab() ? (
      <Suspense
        fallback={
          <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>Loading map lab…</div>
        }
      >
        <Lab />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
