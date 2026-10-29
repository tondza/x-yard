/**
 * Dev-only city visual-direction lab.
 *
 * Four renderings of the same generated fragment, with the same stations,
 * network and tokens. The point is a controlled comparison of palette, depth and
 * lighting — not four different cities. Reachable at `?visuals` in dev.
 *
 * @module apps/web/lab/CityVisualLab
 */

import type { GeneratedMap } from '@x-yard/map-generator';

import mapJson from '../../../../maps/prototype-96-seed-42.json';
import { CityFragment } from './CityFragment';
import { VISUAL_THEMES } from '../prototype/skins/visualThemes';
import './cityVisualLab.css';

const MAP = mapJson as unknown as GeneratedMap;

export default function CityVisualLab(): React.JSX.Element {
  return (
    <main className="visual-lab">
      <header className="visual-header">
        <span className="visual-eyebrow">X-YARD · VISUAL DIRECTIONS · CATHEDRAL QUARTER</span>
        <h1>Four ways to draw the city</h1>
        <p>
          The same generated fragment — Old Square, the Cathedral, Central Station and the
          Market Hall — in four visual directions. Same map, same stations, same transit
          network, same tokens and the same last-appearance ghost. Only the city changes.
        </p>
        <div className="visual-header-meta">
          <span>Same crop · 750 × 520 world units</span>
          <span>All four read the real `buildingsForMap` / `treesForMap` model</span>
          <span>Fragments, not final screens</span>
        </div>
      </header>

      <div className="visual-grid">
        {VISUAL_THEMES.map((theme) => (
          <article key={theme.id} className={`visual-card visual-card-${theme.id}`} data-theme={theme.id}>
            <div className="visual-frame">
              <CityFragment map={MAP} theme={theme} />
            </div>
            <div className="visual-caption">
              <span className="visual-letter" style={{ color: theme.accent }}>
                {theme.letter}
              </span>
              <div className="visual-copy">
                <span className="visual-kicker" style={{ color: theme.accent }}>
                  {theme.kicker}
                </span>
                <h2>{theme.title}</h2>
                <p>{theme.pitch}</p>
                <ul>
                  {theme.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
                <div className="visual-meta">
                  <span className="visual-effort">Effort · {theme.effort}</span>
                  <span className="visual-watchout">{theme.watchouts}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <footer className="visual-note">
        <strong>How to read this.</strong> Every option is a palette, depth and lighting pass
        over the existing city model; none of them needs a different map or a different rules
        engine. The overlay (numbers, B/M/S badges, transit lines, tokens, ghost) is held
        constant so the city is the only variable. If one direction is picked, the next step
        is porting its palette and depth values into{' '}
        <code>apps/web/src/prototype/CityPlate.tsx</code> — not redrawing the quarter.
      </footer>
    </main>
  );
}
