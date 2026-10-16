import { useEffect, useState } from 'react';

import type { BoardDto } from '@x-yard/shared-types';

import { FACILITY_COLOURS, GameCanvas, MODE_COLOURS } from './GameCanvas';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly board: BoardDto }
  | { readonly status: 'error'; readonly message: string };

/**
 * Fetch the board from the server (via the Vite `/api` proxy).
 *
 * Deliberately tolerant of the server being down: the bootstrap UI should still
 * render and explain the problem rather than showing a blank page.
 */
async function fetchBoard(signal: AbortSignal): Promise<BoardDto> {
  const response = await fetch('/api/board', { signal });
  if (!response.ok) {
    throw new Error(`server responded ${response.status}`);
  }
  return (await response.json()) as BoardDto;
}

/** A colour chip plus label, used for both legends. */
function LegendSwatch({ colour, label }: { readonly colour: string; readonly label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{ width: 12, height: 12, background: colour, borderRadius: 2, display: 'inline-block' }}
      />
      {label}
    </li>
  );
}

/** Root application shell. */
export function App(): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetchBoard(controller.signal)
      .then((board) => setState({ status: 'ready', board }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => controller.abort();
  }, []);

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        color: '#e6edf3',
        background: '#0b0e13',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ margin: '0 0 4px' }}>X-Yard</h1>
      <p style={{ margin: '0 0 20px', color: '#9aa7b4' }}>
        Asymmetric pursuit across node-based transit networks — bootstrap build.
      </p>

      {state.status === 'loading' && <p>Loading board…</p>}

      {state.status === 'error' && (
        <p style={{ color: '#c0504d' }}>
          Could not load the board ({state.message}). Start the server with{' '}
          <code>pnpm --filter @x-yard/server dev</code>.
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <GameCanvas board={state.board} />

          <ul style={{ listStyle: 'none', padding: 0, marginTop: 16, display: 'flex', gap: 16 }}>
            {Object.entries(MODE_COLOURS).map(([mode, colour]) => (
              <LegendSwatch key={mode} colour={colour} label={mode} />
            ))}
          </ul>

          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8, display: 'flex', gap: 16 }}>
            {Object.entries(FACILITY_COLOURS).map(([facility, colour]) => (
              <LegendSwatch key={facility} colour={colour} label={facility} />
            ))}
          </ul>

          <p style={{ marginTop: 16, color: '#9aa7b4', fontSize: 13 }}>
            {state.board.mapId} — {state.board.stations.length} nodes,{' '}
            {state.board.routes.length} routes.
          </p>
        </>
      )}
    </main>
  );
}
