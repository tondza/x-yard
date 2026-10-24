/**
 * The public entry point: seed + options in, a validated map out.
 *
 * Generation is deterministic and retried on a derived seed if a layout fails a
 * hard constraint. Retrying is bounded and reported: a fixture records the
 * effective seed and the number of attempts, so "regenerate this exact map" is
 * always possible from the stored seed.
 *
 * @module @x-yard/map-generator/generate
 */

import { validateGraph } from '@x-yard/game-core';

import { buildCity, deriveSeed } from './grid';
import { buildTransitNetwork } from './network';
import { createRng } from './rng';
import type { GeneratedMap, MapOptions, MapValidation } from './types';

/*
 * PROVISIONAL (Q7): how many derived seeds to try before declaring the seed
 * unusable. 32 is far beyond what a healthy generator needs; it exists so a
 * genuinely impossible parameter combination fails loudly instead of looping.
 */
const PROVISIONAL_MAX_GENERATION_ATTEMPTS = 32;

/** Why a seed failed, when every attempt is exhausted. */
export class MapGenerationError extends Error {
  readonly requestedSeed: number;
  readonly attempts: number;
  readonly reasons: readonly string[];

  constructor(requestedSeed: number, attempts: number, reasons: readonly string[]) {
    super(
      `could not generate a valid map for seed ${requestedSeed} after ${attempts} attempts:\n  - ${reasons.join('\n  - ')}`,
    );
    this.name = 'MapGenerationError';
    this.requestedSeed = requestedSeed;
    this.attempts = attempts;
    this.reasons = reasons;
  }
}

/**
 * Generate one map.
 *
 * @throws MapGenerationError when no derived seed produces a valid transit
 * network. That is a bug or an impossible option set, not an expected outcome.
 */
export function generateMap(requestedSeed: number, options: MapOptions = {}): GeneratedMap {
  let lastReasons: readonly string[] = ['no attempt was made'];

  for (let attempt = 0; attempt < PROVISIONAL_MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const seed = deriveSeed(requestedSeed, attempt);
    const city = buildCity(seed, options);
    const network = buildTransitNetwork(city, createRng(seed ^ 0x9e3779b9));
    const graphReport = validateGraph(network.graph);

    const starts = network.starts;
    const reasons: string[] = [...graphReport.errors, ...network.geometry.errors];

    // The grid is derived from targetNodes, but never trust it silently: a seed
    // that cannot place the requested number of stations must fail, not return a
    // smaller map.
    if (network.graph.nodes.length !== city.params.targetNodes) {
      reasons.push(
        `placed ${network.graph.nodes.length} stations, expected ${city.params.targetNodes}`,
      );
    }
    if (starts === null) {
      lastReasons = [...reasons, 'no start layout satisfies the separation rule'];
      continue;
    }
    if (starts.agents.length !== city.params.agentCount) {
      reasons.push(`placed ${starts.agents.length} Agent starts, expected ${city.params.agentCount}`);
    }
    if (reasons.length > 0) {
      lastReasons = reasons;
      continue;
    }

    const validation: MapValidation = {
      ok: true,
      errors: [],
      warnings: graphReport.warnings,
      geometry: network.geometry,
    };

    return {
      version: 1,
      seed,
      requestedSeed,
      attempts: attempt + 1,
      params: city.params,
      bounds: { width: city.params.worldWidth, height: city.params.worldHeight },
      city: city.city,
      graph: network.graph,
      facilities: network.facilities,
      starts,
      stats: network.stats,
      validation,
    };
  }

  throw new MapGenerationError(requestedSeed, PROVISIONAL_MAX_GENERATION_ATTEMPTS, lastReasons);
}
