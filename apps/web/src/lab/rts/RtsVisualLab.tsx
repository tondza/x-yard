/**
 * Dev-only RTS visual-direction lab.
 *
 * @module apps/web/lab/rts/RtsVisualLab
 */

import type { GeneratedMap } from '@x-yard/map-generator';

import mapJson from '../../../../../maps/prototype-96-seed-42.json';
import { IsoCityFragment } from './IsoCityFragment';
import { Rts25CityFragment } from './Rts25CityFragment';
import { COMMAND, NIGHT_OPS } from './rtsTheme';
import '../cityVisualLab.css';

const MAP = mapJson as unknown as GeneratedMap;

export default function RtsVisualLab(): React.JSX.Element {
  return (
    <main className="visual-lab rts-lab">
      <header className="visual-header">
        <span className="visual-eyebrow">X-YARD · VISUAL DIRECTIONS · RTS PASS</span>
        <h1>Command City</h1>
        <p>
          An original attempt at the late-90s RTS city look: true isometric blocks, visible
          façades and window grids, concrete and asphalt, industrial roof gear, deep shadows
          and small warm lights. Same generated quarter; no imported art.
        </p>
        <div className="visual-header-meta">
          <span>Isometric re-projection · 2:1</span>
          <span>Same 96-station map</span>
          <span>Fragment · not final HUD</span>
        </div>
      </header>

      <div className="rts-hero">
        <article className="visual-card" data-theme="command">
          <div className="visual-frame rts-frame">
            <IsoCityFragment map={MAP} theme={COMMAND} />
            <div className="rts-tag">
              <span>SECTOR 04</span>
              <b>OLD SQUARE</b>
            </div>
          </div>
          <div className="visual-caption">
            <span className="visual-letter" style={{ color: COMMAND.accent }}>
              A
            </span>
            <div className="visual-copy">
              <span className="visual-kicker" style={{ color: COMMAND.accent }}>
                {COMMAND.kicker}
              </span>
              <h2>{COMMAND.title}</h2>
              <p>{COMMAND.pitch}</p>
              <ul>
                {COMMAND.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
              <div className="visual-meta">
                <span className="visual-effort">Effort · {COMMAND.effort}</span>
                <span className="visual-watchout">{COMMAND.watchouts}</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="rts-pair">
        <article className="visual-card" data-theme="iron">
          <div className="visual-frame">
            <Rts25CityFragment map={MAP} theme={COMMAND} />
          </div>
          <div className="visual-caption">
            <span className="visual-letter" style={{ color: '#d9a441' }}>
              B
            </span>
            <div className="visual-copy">
              <span className="visual-kicker" style={{ color: '#d9a441' }}>
                2.5D · late afternoon · plug-in
              </span>
              <h2>Iron Quarter</h2>
              <p>
                The same detail without the isometric re-projection: taller façades, roof gear
                and window grids while the board keeps its current coordinates.
              </p>
              <ul>
                <li>Cheapest route to a much richer city</li>
                <li>Camera, labels and transit lines stay where they are</li>
                <li>Basic remains the fallback skin</li>
              </ul>
              <div className="visual-meta">
                <span className="visual-effort">Effort · Medium</span>
                <span className="visual-watchout">Less “true RTS” than the isometric version; still a big jump from Basic.</span>
              </div>
            </div>
          </div>
        </article>

        <article className="visual-card" data-theme="nightops">
          <div className="visual-frame">
            <Rts25CityFragment map={MAP} theme={NIGHT_OPS} />
          </div>
          <div className="visual-caption">
            <span className="visual-letter" style={{ color: NIGHT_OPS.accent }}>
              C
            </span>
            <div className="visual-copy">
              <span className="visual-kicker" style={{ color: NIGHT_OPS.accent }}>
                {NIGHT_OPS.kicker}
              </span>
              <h2>{NIGHT_OPS.title}</h2>
              <p>{NIGHT_OPS.pitch}</p>
              <ul>
                {NIGHT_OPS.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
              <div className="visual-meta">
                <span className="visual-effort">Effort · {NIGHT_OPS.effort}</span>
                <span className="visual-watchout">{NIGHT_OPS.watchouts}</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <footer className="visual-note">
        <strong>What this would cost.</strong> Command City re-projects the whole board, so
        the camera, station labels, transit lines and tokens must move with it; the rules and
        graph stay exactly as they are. Iron Quarter and Night Ops keep the current
        coordinates and can be swapped in as city skins, with Basic always one click back.
        All three are rendered from the same generated map — no imported game art.
      </footer>
    </main>
  );
}
