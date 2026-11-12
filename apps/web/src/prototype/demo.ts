/**
 * Interactive demo configuration: committed maps, generated maps, and the
 * setup values the prototype engine accepts.
 *
 * Dev-only. The production build drops the prototype route, so the 576-station
 * fixture is never part of the shipped bundle.
 *
 * @module apps/web/prototype/demo
 */

import {
  PROVISIONAL_PROTOTYPE_SETUP,
  prototypeAppearanceTurns,
  type PrototypeSetup,
  type TicketBag,
} from '@x-yard/game-core';
import { generateMap } from '@x-yard/map-generator';
import type { GeneratedMap, RouteDensity, StartStrategy } from '@x-yard/map-generator';

import mvp60 from '../../../../maps/mvp-60-seed-42.json';
import map24 from '../../../../maps/prototype-24-seed-42.json';
import map96 from '../../../../maps/prototype-96-seed-42.json';

export type PlaySide = 'fugitive' | 'agent';

export interface ExistingMapChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly load: () => Promise<GeneratedMap>;
}

const asMap = (json: unknown): GeneratedMap => json as GeneratedMap;

/** The committed fixtures offered by the demo. 576 loads on demand. */
export const EXISTING_MAPS: readonly ExistingMapChoice[] = [
  {
    id: 'quarter-96',
    label: 'Cathedral Quarter',
    detail: '96 stations · the shipped board',
    load: async () => asMap(map96),
  },
  {
    id: 'mvp-60',
    label: 'MVP Yard',
    detail: '60 stations · the multiplayer-scale fixture',
    load: async () => asMap(mvp60),
  },
  {
    id: 'prototype-24',
    label: 'Small Yard',
    detail: '24 stations · quick to read',
    load: async () => asMap(map24),
  },
  {
    id: 'rehearsal-576',
    label: 'Six-times rehearsal',
    detail: '576 stations · the heavy board',
    load: async () => {
      const module = await import('../../../../maps/prototype-576-seed-42.json');
      return asMap(module.default);
    },
  },
];

export interface DemoMapConfig {
  readonly mode: 'existing' | 'generate';
  readonly existingId: string;
  readonly targetNodes: number;
  readonly routeDensity: RouteDensity;
  readonly agentCount: number;
  readonly startStrategy: StartStrategy;
  readonly seed: number;
}

export interface DemoTickets {
  readonly fugitive: TicketBag;
  readonly agent: TicketBag;
  readonly fugitiveFoot: number;
  readonly agentFoot: number;
}

export interface DemoConfig {
  readonly map: DemoMapConfig;
  readonly turnLimit: number;
  readonly tickets: DemoTickets;
  readonly side: PlaySide;
}

export const NODE_CHOICES = [24, 60, 96, 192, 300, 384, 576] as const;
export const TURN_MIN = 4;
export const TURN_MAX = 32;
export const TICKET_MAX = 99;

export const ROUTE_DENSITY_OPTIONS: readonly {
  readonly value: RouteDensity;
  readonly label: string;
  readonly detail: string;
}[] = [
  { value: 'sparse', label: 'Sparse', detail: 'fewer local taxi links' },
  { value: 'standard', label: 'Standard', detail: 'the prototype density' },
  { value: 'dense', label: 'Dense', detail: 'more local taxi links' },
];

export const START_OPTIONS: readonly {
  readonly value: StartStrategy;
  readonly label: string;
  readonly detail: string;
}[] = [
  { value: 'encircle', label: 'Close starts', detail: '3–5 edges away' },
  { value: 'farthest', label: 'Far starts', detail: 'spread across the map' },
];

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function initialExistingId(): string {
  const map = new URLSearchParams(window.location.search).get('map');
  return map === '576' ? 'rehearsal-576' : 'quarter-96';
}

/** Defaults come from the engine, so the demo cannot silently drift from it. */
export function defaultDemoConfig(): DemoConfig {
  const defaults = PROVISIONAL_PROTOTYPE_SETUP;
  return {
    map: {
      mode: 'existing',
      existingId: initialExistingId(),
      targetNodes: 96,
      routeDensity: 'standard',
      agentCount: 4,
      startStrategy: 'encircle',
      seed: 42,
    },
    turnLimit: defaults.turnLimit,
    tickets: {
      fugitive: { ...defaults.fugitiveTickets },
      agent: { ...defaults.agentTickets },
      fugitiveFoot: defaults.fugitiveFootSteps,
      agentFoot: defaults.agentFootSteps,
    },
    side: 'fugitive',
  };
}

/** The engine setup for the chosen demo controls. */
export function setupFromConfig(config: DemoConfig): PrototypeSetup {
  return {
    turnLimit: clampInt(config.turnLimit, TURN_MIN, TURN_MAX),
    appearanceTurns: prototypeAppearanceTurns(
      clampInt(config.turnLimit, TURN_MIN, TURN_MAX),
    ),
    fugitiveTickets: {
      taxi: clampInt(config.tickets.fugitive.taxi, 0, TICKET_MAX),
      bus: clampInt(config.tickets.fugitive.bus, 0, TICKET_MAX),
      underground: clampInt(config.tickets.fugitive.underground, 0, TICKET_MAX),
      special: clampInt(config.tickets.fugitive.special, 0, TICKET_MAX),
    },
    agentTickets: {
      taxi: clampInt(config.tickets.agent.taxi, 0, TICKET_MAX),
      bus: clampInt(config.tickets.agent.bus, 0, TICKET_MAX),
      underground: clampInt(config.tickets.agent.underground, 0, TICKET_MAX),
      special: clampInt(config.tickets.agent.special, 0, TICKET_MAX),
    },
    fugitiveFootSteps: clampInt(config.tickets.fugitiveFoot, 0, TICKET_MAX),
    agentFootSteps: clampInt(config.tickets.agentFoot, 0, TICKET_MAX),
  };
}

/**
 * Resolve the chosen map. Existing fixtures load directly; a generated map uses
 * the same density model as the committed 96 quarter, with the world scaled so
 * larger maps do not become cramped.
 */
export async function loadDemoMap(config: DemoConfig): Promise<GeneratedMap> {
  if (config.map.mode === 'existing') {
    const choice =
      EXISTING_MAPS.find((candidate) => candidate.id === config.map.existingId) ??
      EXISTING_MAPS[0];
    if (choice === undefined) throw new Error('no existing map is configured');
    return choice.load();
  }

  // Let the setup screen paint its loading state before the synchronous
  // generation work starts.
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  const targetNodes = clampInt(config.map.targetNodes, 24, 576);
  const worldScale = Math.max(0.75, Math.sqrt(targetNodes / 96));
  return generateMap(config.map.seed, {
    targetNodes,
    worldWidth: Math.round(1200 * worldScale),
    worldHeight: Math.round(900 * worldScale),
    routeDensity: config.map.routeDensity,
    agentCount: clampInt(config.map.agentCount, 1, 6),
    startStrategy: config.map.startStrategy,
  });
}

/** The title shown above the table. */
export function mapLabelFor(config: DemoConfig): string {
  if (config.map.mode === 'generate') {
    return `Generated ${config.map.targetNodes}-station Yard`;
  }
  return EXISTING_MAPS.find((choice) => choice.id === config.map.existingId)?.label ?? 'Yard';
}

/** A short summary used by the setup screen and the game header. */
export function describeSetup(config: DemoConfig): string {
  const map =
    config.map.mode === 'generate'
      ? `generated ${config.map.targetNodes}-station map`
      : (EXISTING_MAPS.find((choice) => choice.id === config.map.existingId)?.label ?? 'map');
  return `${map} · ${config.turnLimit} turns · ${config.side === 'agent' ? 'Agents' : 'Fugitive'}`;
}
