/**
 * The map model shared by the generator, the map lab and (later) the server.
 *
 * Two rules shape these types:
 *
 *   1. **The model is authority, the renderer is a view.** Streets, blocks and
 *      landmarks are data; no drawing code may invent geometry.
 *   2. **The rules graph stays in `game-core`.** This package produces a
 *      `TransitGraph` plus the city around it; it never re-declares the engine's
 *      unions or validation rules.
 *
 * @module @x-yard/map-generator/types
 */

import type {
  DistrictId,
  GraphEdge,
  GraphNode,
  MapPoint,
  NodeClass,
  NodeId,
  StreetSegment,
  TransitGraph,
  TransportMode,
} from '@x-yard/game-core';

/**
 * Caller-facing generation knobs.
 *
 * Only `targetNodes` matters for gameplay; the rest exist so the lab can force
 * a shape while comparing seeds. Every omitted value is resolved by
 * {@link DEFAULT_MAP_OPTIONS}.
 */
export interface MapOptions {
  readonly targetNodes?: number;
  readonly cols?: number;
  readonly rows?: number;
  readonly worldWidth?: number;
  readonly worldHeight?: number;
  /**
   * How Agent starts are chosen.
   *
   * `farthest` is the lab default and spreads Agents across the whole map;
   * `encircle` keeps them 3–5 edges from the Fugitive and spreads them by angle,
   * which is what a realistic 96-station chase needs (a 1+4 game with Agents ten
   * edges away never closes).
   */
  readonly startStrategy?: StartStrategy;
  /** Agent seats to place. The prototype uses 4; future maps scale this. */
  readonly agentCount?: number;
}

/** Start-placement policy. */
export type StartStrategy = 'farthest' | 'encircle';

/** Fully resolved options, stored on the map so a fixture is self-describing. */
export interface ResolvedMapOptions {
  readonly targetNodes: number;
  readonly cols: number;
  readonly rows: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly startStrategy: StartStrategy;
  readonly agentCount: number;
}

/** Street ranks drive the schematic width and bus-corridor selection. */
export type StreetRank = 0 | 1 | 2;

/** One street centreline with its render/authoring rank. */
export interface CityStreet extends StreetSegment {
  readonly rank: StreetRank;
}

/** A city block. Parks are blocks that the renderer does not build on. */
export interface BlockModel {
  readonly id: string;
  readonly district: DistrictId;
  readonly kind: 'block' | 'park';
  readonly polygon: readonly MapPoint[];
}

/** A named place, used to anchor terminals and give a seed an identity. */
export interface LandmarkModel {
  readonly id: string;
  readonly kind: 'cathedral' | 'station' | 'market' | 'square';
  readonly label: string;
  readonly blockId: string;
  readonly at: MapPoint;
}

/** The non-rules half of a map. */
export interface CityModel {
  readonly streets: readonly CityStreet[];
  readonly blocks: readonly BlockModel[];
  readonly landmarks: readonly LandmarkModel[];
}

/** Exactly one of each facility exists on every generated map (validator rule). */
export interface MapFacilities {
  readonly blackMarket: NodeId;
  readonly safeHouse: NodeId;
}

/** Starting seats for the prototype: 1 Fugitive and 4 Agents. */
export interface MapStarts {
  readonly fugitive: NodeId;
  readonly agents: readonly NodeId[];
}

/** Aggregate facts shown in the lab and asserted by tests. */
export interface MapStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly byMode: Readonly<Record<TransportMode, number>>;
  readonly classMix: Readonly<Record<NodeClass, number>>;
  readonly minDegree: number;
  readonly meanDegree: number;
  readonly maxDegree: number;
  /** Graph distance from the Fugitive start to each Agent start, in edges. */
  readonly startDistances: readonly number[];
}

/** Result of the R5 street-coverage check. */
export interface MapGeometryValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly checkedEdges: number;
}

/** Everything the lab needs to judge a generated map. */
export interface MapValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly geometry: MapGeometryValidation;
}

/** A complete, JSON-serializable generated map. */
export interface GeneratedMap {
  readonly version: 1;
  /**
   * The effective seed: regenerating with this value reproduces this exact map
   * on the first attempt. `requestedSeed` records what the caller asked for.
   */
  readonly seed: number;
  readonly requestedSeed: number;
  /** How many derived seeds were tried before one passed validation. */
  readonly attempts: number;
  readonly params: ResolvedMapOptions;
  readonly bounds: { readonly width: number; readonly height: number };
  readonly city: CityModel;
  readonly graph: TransitGraph;
  readonly facilities: MapFacilities;
  readonly starts: MapStarts;
  readonly stats: MapStats;
  readonly validation: MapValidation;
}

/** Re-export the engine's graph types so the lab has one import site. */
export type { GraphEdge, GraphNode, MapPoint, NodeId, TransitGraph, TransportMode };
