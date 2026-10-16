/**
 * Vision alignment lock.
 *
 * GAME_VISION.md is the authority. These tests do two jobs:
 *
 *   1. **Lock what the brief states as fact**, so the implementation cannot
 *      quietly drift from §3's transit tiers or §5's gadget and skill lists.
 *   2. **Keep the withdrawn vision withdrawn.** The brief replaced an earlier
 *      design (a single "Mr. X", cache nodes, fixed contracts, black tickets,
 *      shadow steps, ferry). Appendix B lists those as superseded, and this file
 *      fails if any of that vocabulary reappears in the public API.
 *
 * Numbers the brief leaves open are exposed under `PROVISIONAL_*` names and are
 * asserted here to be *named* that way, so `grep -rn PROVISIONAL_` remains a
 * complete inventory of unratified defaults.
 */

import { describe, expect, it } from 'vitest';

import * as gameCore from './index';
import { AGENT_SKILLS, GADGETS, SENSOR_SWEEP_RADIUS, TRANSPORT_MODES } from './types';

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
  const PROVISIONAL_EXPORTS = [
    'PROVISIONAL_REVEAL_PULSE_TURNS',
    'PROVISIONAL_REVEAL_PULSE_INTERVAL',
    'PROVISIONAL_YARD_TURN_LIMIT',
    'PROVISIONAL_FUGITIVE_STARTING_TICKETS',
    'PROVISIONAL_AGENT_STARTING_TICKETS',
    'PROVISIONAL_MISSION_PAYOUTS',
    'PROVISIONAL_LOGOFF_GRACE_TURNS',
    'PROVISIONAL_MAX_FUGITIVES_PER_YARD',
    'PROVISIONAL_MAX_AGENTS_PER_YARD',
    'PROVISIONAL_HEAVY_CARGO_FORBIDS',
    'PROVISIONAL_ARMS_NOISE_PING_EVERY',
  ];

  it('exposes every unratified number under a PROVISIONAL_ name', () => {
    for (const name of PROVISIONAL_EXPORTS) {
      expect(Object.hasOwn(gameCore, name), `missing provisional export: ${name}`).toBe(true);
    }
  });

  it('does not expose ticket or turn numbers without the PROVISIONAL_ prefix', () => {
    const suspicious = Object.keys(gameCore).filter(
      (name) =>
        !name.startsWith('PROVISIONAL_') &&
        !name.startsWith('DEMO_') &&
        /STARTING_TICKETS|REVEAL_PULSE|TURN_LIMIT|GRACE_TURNS|PAYOUTS/.test(name),
    );
    expect(suspicious).toEqual([]);
  });
});
