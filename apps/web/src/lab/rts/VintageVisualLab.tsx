/**
 * Dev-only vintage-etching screen study.
 *
 * A monochrome/sepia city and paper HUD with the transit network kept in colour.
 * This is a design mock, not the live prototype: Basic and the RTS skins are
 * untouched.
 *
 * @module apps/web/lab/rts/VintageVisualLab
 */

import type { GeneratedMap } from '@x-yard/map-generator';

import mapJson from '../../../../../maps/prototype-96-seed-42.json';
import { IsoCityFragment } from './IsoCityFragment';
import { VINTAGE } from './rtsTheme';
import './vintageLab.css';

const MAP = mapJson as unknown as GeneratedMap;

const KIT = [
  { label: 'Taxi cab', count: 8, colour: VINTAGE.route.taxi },
  { label: 'Omnibus', count: 4, colour: VINTAGE.route.bus },
  { label: 'Underground', count: 3, colour: VINTAGE.route.underground },
  { label: 'Special', count: 2, colour: VINTAGE.route.special },
  { label: 'On foot', count: 8, colour: '#6b5c46' },
];

const AGENTS = [
  { name: 'Falcon', code: 'A1', node: 'n7' },
  { name: 'Harrier', code: 'A2', node: 'n38' },
  { name: 'Osprey', code: 'A3', node: 'n80' },
  { name: 'Merlin', code: 'A4', node: 'n59' },
];

export default function VintageVisualLab(): React.JSX.Element {
  return (
    <main className="vintage-page">
      <div className="vintage-screen">
        <header className="vintage-masthead">
          <div className="vintage-mark">
            <span className="vintage-eyebrow">X-YARD · YARD 04 · 1925</span>
            <h1>Cathedral Quarter</h1>
            <p>Sheet IV · the fugitive is somewhere in the quarter</p>
          </div>

          <div className="vintage-turn">
            <span>TURN</span>
            <b>VI</b>
            <span>/ XVI</span>
          </div>

          <div className="vintage-appearances">
            <span>APPEARANCES</span>
            <b>V</b>
            <b>X</b>
            <b>XV</b>
          </div>

          <div className="vintage-seal">THE YARD</div>
        </header>

        <div className="vintage-body">
          <section className="vintage-map">
            <div className="vintage-map-head">
              <span>THE CATHEDRAL QUARTER</span>
              <span>Surveyed for the Yard · 1925</span>
            </div>
            <div className="vintage-map-frame">
              <IsoCityFragment map={MAP} theme={VINTAGE} xray={false} />
            </div>
            <div className="vintage-map-foot">
              <span>The transit routes are the only coloured marks on the sheet.</span>
              <span>North is up</span>
            </div>
          </section>

          <aside className="vintage-side">
            <section className="vintage-panel">
              <h2>Fugitive kit</h2>
              <p className="vintage-note">Mr. X · Vulture</p>
              <div className="vintage-kit">
                {KIT.map((item) => (
                  <div key={item.label} className="vintage-kit-item">
                    <span className="vintage-swatch" style={{ background: item.colour }} />
                    <span>{item.label}</span>
                    <b>{item.count}</b>
                  </div>
                ))}
              </div>
              <p className="vintage-small">The 1925 rules have no motor-scooter.</p>
            </section>

            <section className="vintage-panel">
              <h2>Agents in the quarter</h2>
              <ul className="vintage-agents">
                {AGENTS.map((agent) => (
                  <li key={agent.code}>
                    <span>{agent.name}</span>
                    <b>{agent.code}</b>
                    <em>{agent.node}</em>
                  </li>
                ))}
              </ul>
            </section>

            <section className="vintage-panel">
              <h2>Routes</h2>
              <ul className="vintage-legend">
                <li><span style={{ background: VINTAGE.route.taxi }} />Taxi · gold</li>
                <li><span style={{ background: VINTAGE.route.bus }} />Omnibus · green</li>
                <li><span style={{ background: VINTAGE.route.underground }} />Underground · red</li>
                <li><span style={{ background: VINTAGE.route.special }} />Special · violet</li>
              </ul>
              <p className="vintage-small">The city and menus are ink; the network is colour.</p>
            </section>

            <section className="vintage-panel vintage-rules">
              <h2>Yard rules</h2>
              <p>You move first. The Fugitive appears on V, X and XV, showing the exact node to the Agents before they move. Survive to turn XVI.</p>
            </section>
          </aside>
        </div>

        <footer className="vintage-footer">
          <span>DESIGN STUDY · NOT THE LIVE RULES · BASIC REMAINS THE FALLBACK</span>
          <span>Iso · sepia · coloured transit</span>
        </footer>
      </div>
    </main>
  );
}
