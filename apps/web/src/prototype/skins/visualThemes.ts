/**
 * Visual-direction data for the city fragment lab.
 *
 * These are design-exploration presets, not production themes. Each one is a
 * palette + depth treatment over the same generated map, so the four fragments
 * are a controlled comparison rather than four unrelated illustrations.
 *
 * @module apps/web/lab/cityVisualThemes
 */

import type { RoofMaterial } from '../city';

export type VisualThemeId = 'golden' | 'blue' | 'paper' | 'rain';

export interface RoofPair {
  readonly roof: string;
  readonly edge: string;
  readonly ridge: string;
}

export interface VisualTheme {
  readonly id: VisualThemeId;
  readonly letter: string;
  readonly title: string;
  readonly kicker: string;
  readonly pitch: string;
  readonly strengths: readonly string[];
  readonly watchouts: string;
  readonly accent: string;
  readonly effort: 'Low' | 'Medium' | 'High';

  readonly background: string;
  readonly ground: string;
  readonly block: string;
  readonly blockEdge: string;
  readonly streetCasing: string;
  readonly street: string;
  readonly streetMark: string;
  readonly park: string;
  readonly parkEdge: string;
  readonly water: string;
  readonly waterEdge: string;

  readonly wall: string;
  readonly wallTones: readonly string[];
  readonly wallEdge: string;
  readonly window: string;
  readonly windowLit: string;
  readonly windowLitChance: number;
  readonly outline?: string;
  readonly outlineWidth?: number;

  readonly roofs: Readonly<Record<RoofMaterial, RoofPair>>;
  readonly shadow: {
    readonly dx: number;
    readonly dy: number;
    readonly colour: string;
    readonly opacity: number;
  };
  readonly tree: {
    readonly trunk: string;
    readonly leaf: string;
    readonly light: string;
    readonly outline?: string;
  };
  readonly landmark: {
    readonly stone: string;
    readonly stoneEdge: string;
    readonly roof: string;
    readonly roofEdge: string;
    readonly glass: string;
    readonly accent: string;
  };
  readonly route: {
    readonly taxi: string;
    readonly bus: string;
    readonly underground: string;
    readonly special: string;
  };
  readonly station: {
    readonly fill: string;
    readonly edgeStreet: string;
    readonly edgeBus: string;
    readonly edgeMetro: string;
    readonly text: string;
    readonly label: string;
    readonly labelStroke: string;
  };
  readonly token: {
    readonly fugitive: string;
    readonly fugitiveText: string;
    readonly agent: string;
    readonly agentText: string;
    readonly ghost: string;
    readonly ghostLabel: string;
  };

  readonly lift: number;
  /** `rich` adds gables, courtyards, balconies and shopfronts; `flat` keeps simple volumes. */
  readonly detail: 'rich' | 'flat';
  readonly ambient: 'awnings' | 'lamps' | 'neon' | 'none';
  readonly night: boolean;
  readonly rain: boolean;
  readonly grain: boolean;
}

const GOLDEN_ROOFS: Record<RoofMaterial, RoofPair> = {
  clay: { roof: '#c56f4f', edge: '#9a4c34', ridge: '#aa5a3d' },
  terracotta: { roof: '#b95b3d', edge: '#8b432b', ridge: '#9c4a33' },
  ochre: { roof: '#ca9952', edge: '#a37737', ridge: '#b3833f' },
  slate: { roof: '#7d8a92', edge: '#5c6870', ridge: '#6c777f' },
  copper: { roof: '#5d9a83', edge: '#3f7462', ridge: '#4d8470' },
  gravel: { roof: '#b7a98f', edge: '#95876d', ridge: '#a6977e' },
  glass: { roof: '#9cc4d4', edge: '#749cac', ridge: '#86adc0' },
};

const BLUE_ROOFS: Record<RoofMaterial, RoofPair> = {
  clay: { roof: '#7a4a44', edge: '#3d2626', ridge: '#5a3632' },
  terracotta: { roof: '#73423a', edge: '#38201c', ridge: '#55302a' },
  ochre: { roof: '#6b5433', edge: '#392c19', ridge: '#544127' },
  slate: { roof: '#40566e', edge: '#22364a', ridge: '#324a60' },
  copper: { roof: '#35695d', edge: '#1b4038', ridge: '#28564b' },
  gravel: { roof: '#454b54', edge: '#282d33', ridge: '#383e45' },
  glass: { roof: '#385f70', edge: '#1f3a47', ridge: '#2c4d5d' },
};

const PAPER_ROOFS: Record<RoofMaterial, RoofPair> = {
  clay: { roof: '#c97b62', edge: '#6f4a3c', ridge: '#8b5b49' },
  terracotta: { roof: '#d08b6a', edge: '#80513e', ridge: '#96604b' },
  ochre: { roof: '#d8b06a', edge: '#8a6d3b', ridge: '#a58249' },
  slate: { roof: '#8fa6a6', edge: '#536b6d', ridge: '#6b8384' },
  copper: { roof: '#7f9d8a', edge: '#4c6758', ridge: '#638071' },
  gravel: { roof: '#d8c48f', edge: '#8a7c5e', ridge: '#a89975' },
  glass: { roof: '#a9cbd6', edge: '#668e9b', ridge: '#83aeb9' },
};

const RAIN_ROOFS: Record<RoofMaterial, RoofPair> = {
  clay: { roof: '#5a3a3b', edge: '#2a1d1f', ridge: '#442b2d' },
  terracotta: { roof: '#583334', edge: '#29191a', ridge: '#412526' },
  ochre: { roof: '#58492e', edge: '#2a2317', ridge: '#423720' },
  slate: { roof: '#3a4d5b', edge: '#1d2a33', ridge: '#2c3d49' },
  copper: { roof: '#2c5c54', edge: '#16332e', ridge: '#204a43' },
  gravel: { roof: '#3f464d', edge: '#23282d', ridge: '#30373d' },
  glass: { roof: '#315a68', edge: '#18333d', ridge: '#254955' },
};

const GOLDEN: VisualTheme = {
  id: 'golden',
  letter: 'A',
  title: 'Illustrated Quarter',
  kicker: 'F · flat vector · 2.5D · late afternoon',
  pitch: 'The current direction, rebuilt as a richer city: gables, courtyards, shopfronts and street life.',
  strengths: [
    'More varied silhouettes: gables, notches, roof tiles',
    'Shaded façades, awnings, balconies and parked cars',
    'Long warm shadows; still legible at 96 stations',
  ],
  watchouts: 'The safest jump from Basic; still an illustration, not photorealism.',
  accent: '#c18a1c',
  effort: 'Low',
  background: '#efe0c3',
  ground: '#e9dabf',
  block: '#e6d8bc',
  blockEdge: '#d0bf9f',
  streetCasing: '#f9f1df',
  street: '#b3a68e',
  streetMark: '#f1e4c2',
  park: '#c8d69d',
  parkEdge: '#adc084',
  water: '#9dc8da',
  waterEdge: '#7aafc5',
  wall: '#dcc094',
  wallTones: ['#dcc094', '#d2b184', '#e4cba4', '#c49f74', '#d7c2a0', '#b98f6a'],
  wallEdge: '#8f7452',
  window: '#a6c8d4',
  windowLit: '#ffd487',
  windowLitChance: 0.18,
  outline: '#6f5a3f',
  outlineWidth: 0.55,
  roofs: GOLDEN_ROOFS,
  shadow: { dx: 14, dy: 7, colour: '#5f4528', opacity: 0.24 },
  tree: { trunk: '#8a6a4a', leaf: '#7f9e5f', light: '#98b471' },
  landmark: {
    stone: '#d8ccb3',
    stoneEdge: '#b7a88d',
    roof: '#727f87',
    roofEdge: '#59656d',
    glass: '#8fb8c9',
    accent: '#c56f4f',
  },
  route: { taxi: '#c18a1c', bus: '#2f7a4f', underground: '#b8403b', special: '#6d4bb5' },
  station: {
    fill: '#fbf7ec',
    edgeStreet: '#5a5347',
    edgeBus: '#2f7a4f',
    edgeMetro: '#a93c36',
    text: '#3d382e',
    label: '#3d382e',
    labelStroke: '#f4efe2',
  },
  token: {
    fugitive: '#a93c36',
    fugitiveText: '#fff8ef',
    agent: '#2f6fed',
    agentText: '#fbf8f0',
    ghost: '#a93c36',
    ghostLabel: '#8e2c26',
  },
  lift: 1.35,
  detail: 'rich',
  ambient: 'awnings',
  night: false,
  rain: false,
  grain: false,
};

const BLUE: VisualTheme = {
  id: 'blue',
  letter: 'B',
  title: 'Blue Hour',
  kicker: 'H · top-down · night',
  pitch: 'Indigo city, amber windows and pools of lamplight; the routes glow.',
  strengths: [
    'Characters and route lines separate from the city instantly',
    'Warm windows give the dense blocks life without more geometry',
    'A clear H-direction test on the real board',
  ],
  watchouts: 'Labels and street detail need careful contrast; night is harder to read at a glance.',
  accent: '#f2bd4a',
  effort: 'Medium',
  background: '#08111f',
  ground: '#0d1b2d',
  block: '#16283e',
  blockEdge: '#213d58',
  streetCasing: '#06101a',
  street: '#1b3048',
  streetMark: '#3a5878',
  park: '#16302c',
  parkEdge: '#21473f',
  water: '#0f2e44',
  waterEdge: '#1d4d6a',
  wall: '#243a52',
  wallTones: ['#243a52', '#20364d', '#2a4058', '#1b3046', '#263d55'],
  wallEdge: '#122235',
  window: '#6b8ba3',
  windowLit: '#ffd27a',
  windowLitChance: 0.72,
  roofs: BLUE_ROOFS,
  shadow: { dx: 8, dy: 9, colour: '#02060b', opacity: 0.35 },
  tree: { trunk: '#2a211b', leaf: '#24493d', light: '#2f5c4a' },
  landmark: {
    stone: '#2a3a4d',
    stoneEdge: '#1a2838',
    roof: '#334961',
    roofEdge: '#1f3145',
    glass: '#f0c66b',
    accent: '#c76a4a',
  },
  route: { taxi: '#f2bd4a', bus: '#5fcf8b', underground: '#ff6f62', special: '#b48cff' },
  station: {
    fill: '#f6ecd8',
    edgeStreet: '#b7ae9b',
    edgeBus: '#5fcf8b',
    edgeMetro: '#ff6f62',
    text: '#1b2330',
    label: '#f4ead7',
    labelStroke: '#07101a',
  },
  token: {
    fugitive: '#e25a50',
    fugitiveText: '#fff8ef',
    agent: '#69a4ff',
    agentText: '#fbf8f0',
    ghost: '#e25a50',
    ghostLabel: '#f0a49d',
  },
  lift: 1.4,
  detail: 'rich',
  ambient: 'lamps',
  night: true,
  rain: false,
  grain: false,
};

const PAPER: VisualTheme = {
  id: 'paper',
  letter: 'C',
  title: 'Paper Diorama',
  kicker: 'F · flat vector · 2.5D · tactile',
  pitch: 'A cut-paper model of the quarter: ink outlines, pastel card, brass-pin stations.',
  strengths: [
    'The clearest city/route separation of the four',
    'Strong board-game identity; scales down cleanly',
    'Depth comes from paper layers, not texture',
  ],
  watchouts: 'Less realistic, and less SimCity 2000 than the other directions.',
  accent: '#c97b62',
  effort: 'Medium',
  background: '#c4b498',
  ground: '#f6ecd9',
  block: '#ecdfc7',
  blockEdge: '#c4b291',
  streetCasing: '#6e5f4e',
  street: '#d6c6aa',
  streetMark: '#b9a98c',
  park: '#cfdcb1',
  parkEdge: '#a9bc8a',
  water: '#a9d0dc',
  waterEdge: '#7daec1',
  wall: '#f0e3cc',
  wallTones: ['#f0e3cc', '#eadcc2', '#f4e8d2', '#e5d6ba'],
  wallEdge: '#7b6a55',
  window: '#8aa7b2',
  windowLit: '#f2c878',
  windowLitChance: 0.1,
  outline: '#443d33',
  outlineWidth: 1.05,
  roofs: PAPER_ROOFS,
  shadow: { dx: 9, dy: 10, colour: '#5b5143', opacity: 0.28 },
  tree: { trunk: '#8a6a4a', leaf: '#8fb073', light: '#a9c58c', outline: '#4f4538' },
  landmark: {
    stone: '#efe2c9',
    stoneEdge: '#6e5f4e',
    roof: '#8fa6a6',
    roofEdge: '#4f6264',
    glass: '#a9d0df',
    accent: '#c97b62',
  },
  route: { taxi: '#b8862a', bus: '#3f7f5a', underground: '#b84a42', special: '#7657a8' },
  station: {
    fill: '#fff8e9',
    edgeStreet: '#4b4338',
    edgeBus: '#3f7f5a',
    edgeMetro: '#b84a42',
    text: '#3f3a33',
    label: '#3f3a33',
    labelStroke: '#fff8e9',
  },
  token: {
    fugitive: '#b84a42',
    fugitiveText: '#fff8e9',
    agent: '#3b6fc4',
    agentText: '#fff8e9',
    ghost: '#b84a42',
    ghostLabel: '#8c3a34',
  },
  lift: 1.85,
  detail: 'rich',
  ambient: 'none',
  night: false,
  rain: false,
  grain: true,
};

const RAIN: VisualTheme = {
  id: 'rain',
  letter: 'D',
  title: 'Rain & Neon',
  kicker: 'H · top-down · night, wet',
  pitch: 'Wet streets, neon shopfronts and reflected light; the boldest city on the board.',
  strengths: [
    'The most atmospheric of the four',
    'Neon route lines read through a very dark city',
    'Rain and reflections reward the zoomed-in camera',
  ],
  watchouts: 'The riskiest for legibility and accessibility; detail can hide stations and labels.',
  accent: '#ff5fa2',
  effort: 'High',
  background: '#071017',
  ground: '#0a151e',
  block: '#14222e',
  blockEdge: '#1e3340',
  streetCasing: '#04080c',
  street: '#16242f',
  streetMark: '#2c4354',
  park: '#132620',
  parkEdge: '#1b3b31',
  water: '#0b2633',
  waterEdge: '#1b4555',
  wall: '#1c2e3a',
  wallTones: ['#1c2e3a', '#182a36', '#20333f', '#152631'],
  wallEdge: '#0b161e',
  window: '#6d91a4',
  windowLit: '#ffc46a',
  windowLitChance: 0.5,
  roofs: RAIN_ROOFS,
  shadow: { dx: 8, dy: 9, colour: '#000000', opacity: 0.4 },
  tree: { trunk: '#1d241f', leaf: '#1f3a2d', light: '#2d4d3a' },
  landmark: {
    stone: '#1f2a33',
    stoneEdge: '#101820',
    roof: '#2b3d4b',
    roofEdge: '#15232e',
    glass: '#f0c66b',
    accent: '#ff5fa2',
  },
  route: { taxi: '#ffd35c', bus: '#4fe0a0', underground: '#ff6b6b', special: '#c08cff' },
  station: {
    fill: '#f8efdd',
    edgeStreet: '#b9b09e',
    edgeBus: '#4fe0a0',
    edgeMetro: '#ff6b6b',
    text: '#101820',
    label: '#f6eedb',
    labelStroke: '#05090d',
  },
  token: {
    fugitive: '#ff5f55',
    fugitiveText: '#fff8ef',
    agent: '#69a4ff',
    agentText: '#fbf8f0',
    ghost: '#ff5f55',
    ghostLabel: '#f0a49d',
  },
  lift: 1.45,
  detail: 'rich',
  ambient: 'neon',
  night: true,
  rain: true,
  grain: false,
};

export const VISUAL_THEMES: readonly VisualTheme[] = [GOLDEN, BLUE, PAPER, RAIN];
