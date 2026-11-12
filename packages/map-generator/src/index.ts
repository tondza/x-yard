/**
 * `@x-yard/map-generator` — seeded city and transit-network generation.
 *
 * Dev/test tooling, not part of the rules engine: it depends on `game-core`
 * (never the reverse) and is not imported by the client's production path.
 * Output is a `GeneratedMap` that the lab renders and the engine tests consume.
 *
 * @module @x-yard/map-generator
 */

export type {
  BlockModel,
  CityModel,
  CityStreet,
  GeneratedMap,
  GraphEdge,
  GraphNode,
  LandmarkModel,
  MapFacilities,
  MapGeometryValidation,
  MapOptions,
  MapPoint,
  MapStarts,
  MapStats,
  MapValidation,
  NodeId,
  ResolvedMapOptions,
  RouteDensity,
  StartStrategy,
  StreetRank,
  TransitGraph,
  TransportMode,
} from './types';

export { generateMap, MapGenerationError } from './generate';
export { buildCity, blockCentre, deriveSeed, resolveOptions } from './grid';
export type { CityBuild, GridEdge, Intersection } from './grid';
export { buildTransitNetwork } from './network';
export type { NetworkBuild } from './network';
export { createRng } from './rng';
export type { Rng } from './rng';
