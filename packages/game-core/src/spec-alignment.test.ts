/**
 * Vision alignment lock.
 *
 * GAME_VISION.md is the authority. These tests do three jobs:
 *
 *   1. **Lock what the brief states as fact**, so the implementation cannot
 *      quietly drift from §3's transit tiers or §5's gadget and skill lists.
 *   2. **Lock the numbers the director has ratified**, so a promotion out of
 *      `PROVISIONAL_` cannot silently change the value that was ruled.
 *   3. **Keep the withdrawn vision withdrawn.** The brief replaced an earlier
 *      design (a single "Mr. X", cache nodes, fixed contracts, black tickets,
 *      shadow steps, ferry). Appendix B lists those as superseded, and this file
 *      fails if any of that vocabulary reappears in the public API.
 *
 * Numbers the brief leaves open are exposed under `PROVISIONAL_*` names and are
 * asserted here to be *named* that way, so `grep -rn PROVISIONAL_` remains a
 * complete inventory of unratified defaults. A ratified number may drop the
 * prefix only when it is named in `RATIFIED_EXPORTS` below — that list, not the
 * absence of a pattern, is what admits it.
 */

import { describe, expect, it } from 'vitest';

import * as gameCore from './index';
import {
  AGENT_SKILLS,
  GADGETS,
  MAX_AGENTS_PER_YARD,
  MAX_FUGITIVES_PER_YARD,
  MIN_START_SEPARATION_EDGES,
  APPEARANCE_TURNS,
  SENSOR_SWEEP_RADIUS,
  TRANSPORT_MODES,
  YARD_TURN_LIMIT,
} from './types';

describe('facts stated by the brief', () => {
  it('§5: Sensor Sweep confirms presence within a 2-node radius', () => {
    expect(SENSOR_SWEEP_RADIUS).toBe(2);
  });

  it('§5: the three named Fugitive gadgets exist, and only those', () => {
    expect([...GADGETS]).toEqual(['decoy-ping', 'counterfeit-identity', 'alleyway-sprint']);
  });

  it('§5: the three named Agent active skills exist, and only those', () => {
    expect([...AGENT_SKILLS]).toEqual(['targeted-roadblock', 'sensor-sweep', 'rapid-deployment']);
  });

  it('§3: the four transit tiers are taxi, bus, metro, and special', () => {
    expect([...TRANSPORT_MODES]).toEqual(['taxi', 'bus', 'underground', 'special']);
  });
});

describe('numbers ratified by the director on 2026-10-16 (appendix C.2)', () => {
  it('§2: a Yard runs 16 turns', () => {
    expect(YARD_TURN_LIMIT).toBe(16);
  });

  it('§2: appearances happen on turns 5, 10, and 15 — not the old 3/8/13/18', () => {
    expect([...APPEARANCE_TURNS]).toEqual([5, 10, 15]);
  });

  it('§4: a Yard seats 4 Fugitives and up to 16 Agents — the ruled 20 players', () => {
    expect(MAX_FUGITIVES_PER_YARD).toBe(4);
    expect(MAX_AGENTS_PER_YARD).toBe(16);
    expect(MAX_FUGITIVES_PER_YARD + MAX_AGENTS_PER_YARD).toBe(20);
  });

  it('§3: every Agent start is at least 3 edges from the Fugitive start (R15)', () => {
    expect(MIN_START_SEPARATION_EDGES).toBe(3);
  });
});

describe('withdrawn design (appendix B)', () => {
  const WITHDRAWN_EXPORTS = [
    'MR_X_STARTING_TICKETS',
    'MR_X_STARTING_BLACK_TICKETS',
    'MR_X_STARTING_SHADOW_STEPS',
    'MR_X_REVEAL_ROUNDS',
    'MR_X_REFILLS',
    'DETECTIVE_STARTING_TICKETS',
    'DETECTIVE_REFILLS',
    'CONTRACTS',
    'DEFAULT_CONTRACT_ID',
    'CACHES_REQUIRED_TO_WIN',
  ];

  it('no longer exports the single-Mr. X / contract vocabulary', () => {
    for (const name of WITHDRAWN_EXPORTS) {
      expect(Object.hasOwn(gameCore, name), `withdrawn export still present: ${name}`).toBe(false);
    }
  });

  it('no longer offers the withdrawn ferry transport mode', () => {
    expect(TRANSPORT_MODES).not.toContain('ferry');
  });

  it('has no cache-node concept', () => {
    expect(Object.hasOwn(gameCore, 'nodesWithCache')).toBe(false);
    expect(Object.hasOwn(gameCore, 'CACHES_REQUIRED_TO_WIN')).toBe(false);
  });
});

describe('unratified defaults are discoverable', () => {
  /**
   * Answers the director has ratified. Each may exist under its plain name —
   * and only these may. Naming a new export here is the deliberate act that
   * replaces a `PROVISIONAL_` prefix, so a rename that skips this list fails
   * the guard below.
   */
  const RATIFIED_EXPORTS = [
    'MAX_AGENTS_PER_YARD',
    'MAX_FUGITIVES_PER_YARD',
    'MIN_START_SEPARATION_EDGES',
    'APPEARANCE_TURNS',
    'YARD_TURN_LIMIT',
  ];

  const PROVISIONAL_EXPORTS = [
    'PROVISIONAL_FUGITIVE_STARTING_TICKETS',
    'PROVISIONAL_AGENT_STARTING_TICKETS',
    'PROVISIONAL_MISSION_PAYOUTS',
    'PROVISIONAL_LOGOFF_GRACE_TURNS',
    'PROVISIONAL_HEAVY_CARGO_FORBIDS',
    'PROVISIONAL_ARMS_NOISE_PING_EVERY',
  ];

  /**
   * The `PROVISIONAL_` names the 2026-10-16 ruling promoted out. They must be
   * gone, not aliased — a compatibility alias would keep a stale number
   * reachable (decision 0008).
   */
  const PROMOTED_NAMES = [
    'PROVISIONAL_MAX_AGENTS_PER_YARD',
    'PROVISIONAL_MAX_FUGITIVES_PER_YARD',
    'PROVISIONAL_REVEAL_PULSE_INTERVAL',
    'PROVISIONAL_REVEAL_PULSE_TURNS',
    'PROVISIONAL_YARD_TURN_LIMIT',
  ];

  /**
   * Quantities that must never reach the public API unnamed. A new export that
   * names one of these has to be `PROVISIONAL_`-prefixed or explicitly listed
   * in `RATIFIED_EXPORTS`; the allowlist is what protects the unratified ones.
   */
  const PROTECTED_QUANTITY =
    /STARTING_TICKETS|APPEARANCE|TURN_LIMIT|GRACE_TURNS|PAYOUTS|MAX_(?:FUGITIVES|AGENTS)_PER_YARD|START_SEPARATION/;

  it('exposes every unratified number under a PROVISIONAL_ name', () => {
    for (const name of PROVISIONAL_EXPORTS) {
      expect(Object.hasOwn(gameCore, name), `missing provisional export: ${name}`).toBe(true);
    }
  });

  it('exposes each ratified answer under its plain name, with no PROVISIONAL_ alias', () => {
    for (const name of RATIFIED_EXPORTS) {
      expect(Object.hasOwn(gameCore, name), `missing ratified export: ${name}`).toBe(true);
    }
    for (const name of PROMOTED_NAMES) {
      expect(Object.hasOwn(gameCore, name), `stale provisional export: ${name}`).toBe(false);
    }
  });

  it('does not expose a protected number without either ratification or the PROVISIONAL_ prefix', () => {
    const RATIFIED = new Set(RATIFIED_EXPORTS);
    const suspicious = Object.keys(gameCore).filter(
      (name) =>
        !name.startsWith('PROVISIONAL_') &&
        !name.startsWith('DEMO_') &&
        !RATIFIED.has(name) &&
        PROTECTED_QUANTITY.test(name),
    );
    expect(suspicious).toEqual([]);
  });
});
