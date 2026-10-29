/**
 * Palette for the RTS-inspired city explorations.
 *
 * Original colours and geometry, not ripped assets. The reference is the gritty
 * pre-rendered isometric look of late-90s RTS cities: concrete, asphalt, brick,
 * rust, deep shadows and small warm lights.
 *
 * @module apps/web/lab/rts/rtsTheme
 */

export interface WallPalette {
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
}

export interface RtsTheme {
  readonly id: string;
  readonly title: string;
  readonly kicker: string;
  readonly pitch: string;
  readonly strengths: readonly string[];
  readonly watchouts: string;
  readonly effort: 'Low' | 'Medium' | 'High';
  readonly accent: string;

  readonly ground: string;
  readonly block: string;
  readonly blockEdge: string;
  readonly park: string;
  readonly parkEdge: string;
  readonly water: string;
  readonly waterEdge: string;
  readonly asphalt: string;
  readonly sidewalk: string;
  readonly lane: string;
  readonly shadow: string;
  readonly shadowOpacity: number;
  readonly walls: readonly WallPalette[];
  readonly roofs: readonly { readonly top: string; readonly edge: string }[];
  readonly window: string;
  readonly windowLit: string;
  readonly windowLitChance: number;
  readonly steel: string;
  readonly rust: string;
  readonly tree: string;
  readonly treeLight: string;
  readonly treeTrunk: string;
  readonly stationPad: string;
  readonly stationRing: string;
  readonly label: string;
  readonly labelStroke: string;
  readonly route: {
    readonly taxi: string;
    readonly bus: string;
    readonly underground: string;
    readonly special: string;
  };
  readonly fugitive: string;
  readonly agent: string;
  readonly ghost: string;
  readonly sky: string;
  readonly sun: string;
  readonly night: boolean;
}

export const COMMAND: RtsTheme = {
  id: 'command',
  title: 'Command City',
  kicker: 'Isometric · late afternoon · high detail',
  pitch: 'The boldest direction: true isometric blocks, visible façades and a dense late-90s RTS city.',
  strengths: [
    'Real depth: walls, roofs, window grids and cast shadows',
    'Concrete, asphalt, brick and rust instead of pastel card',
    'Industrial roof gear, streetlights, cars and lit windows',
  ],
  watchouts: 'Needs an isometric camera/overlay pass; the whole board is re-projected, not just the palette.',
  effort: 'High',
  accent: '#c5452f',
  ground: '#3a3d3d',
  block: '#7a7062',
  blockEdge: '#4f483d',
  park: '#4b5d3a',
  parkEdge: '#38462c',
  water: '#24515c',
  waterEdge: '#183b43',
  asphalt: '#3a3e40',
  sidewalk: '#a69d8c',
  lane: '#d8bd7e',
  shadow: '#080a0b',
  shadowOpacity: 0.5,
  walls: [
    { light: '#b47a55', mid: '#8b5a42', dark: '#5f3d2f' },
    { light: '#9a8d78', mid: '#786d5c', dark: '#4f483d' },
    { light: '#a65e42', mid: '#7d4632', dark: '#563023' },
    { light: '#8b9290', mid: '#6b7270', dark: '#474d4c' },
    { light: '#b0925d', mid: '#8a7048', dark: '#5c4b31' },
    { light: '#7d8a7a', mid: '#5f6b5e', dark: '#404a40' },
  ],
  roofs: [
    { top: '#4c4f50', edge: '#2e3132' },
    { top: '#5b4a3f', edge: '#392e28' },
    { top: '#6b5a44', edge: '#463a2c' },
    { top: '#3f4b4d', edge: '#293132' },
    { top: '#7a3f32', edge: '#4d281f' },
    { top: '#555b5c', edge: '#34393a' },
  ],
  window: '#7c969c',
  windowLit: '#ffc96b',
  windowLitChance: 0.36,
  steel: '#6c7478',
  rust: '#a35a3a',
  tree: '#4b6238',
  treeLight: '#657b45',
  treeTrunk: '#4a3929',
  stationPad: '#d8cfb4',
  stationRing: '#17191a',
  label: '#f4ead5',
  labelStroke: '#101214',
  route: {
    taxi: '#d9a441',
    bus: '#4e9a5f',
    underground: '#c04a3a',
    special: '#8a63c9',
  },
  fugitive: '#c5452f',
  agent: '#4f7fbf',
  ghost: '#c5452f',
  sky: '#1c2022',
  sun: '#ffd08a',
  night: false,
};

export const NIGHT_OPS: RtsTheme = {
  ...COMMAND,
  id: 'nightops',
  title: 'Night Ops',
  kicker: '2.5D · night · lit windows',
  pitch: 'The same gritty blocks after dark: sodium lights, lit windows and a much darker board.',
  strengths: [
    'Strong contrast for routes, stations and tokens',
    'Lit windows and street lamps carry the detail at night',
    'Keeps the current board coordinates and camera',
  ],
  watchouts: 'Harder to read than daylight; station labels and legal paths need extra contrast.',
  effort: 'Medium',
  accent: '#e0a44a',
  ground: '#11181b',
  block: '#2c3436',
  blockEdge: '#1c2224',
  park: '#1e3326',
  parkEdge: '#13251a',
  water: '#12333f',
  waterEdge: '#0b232b',
  asphalt: '#181f22',
  sidewalk: '#414b4d',
  lane: '#c9a45f',
  shadow: '#000000',
  shadowOpacity: 0.55,
  walls: [
    { light: '#5d4b3e', mid: '#43362d', dark: '#29211c' },
    { light: '#4b5557', mid: '#353e40', dark: '#202729' },
    { light: '#5a3d31', mid: '#3f2b24', dark: '#271a16' },
    { light: '#526057', mid: '#3a453e', dark: '#232a25' },
    { light: '#5f563a', mid: '#443e2a', dark: '#2a261a' },
  ],
  roofs: [
    { top: '#252b2d', edge: '#121718' },
    { top: '#332b26', edge: '#1a1512' },
    { top: '#2b3537', edge: '#151c1d' },
    { top: '#3d2b26', edge: '#211411' },
    { top: '#26302b', edge: '#121a16' },
  ],
  window: '#53686f',
  windowLit: '#ffd27a',
  windowLitChance: 0.72,
  steel: '#4a5356',
  rust: '#8b4a31',
  tree: '#223622',
  treeLight: '#30482c',
  treeTrunk: '#2a2118',
  stationPad: '#e7ddc2',
  stationRing: '#080b0c',
  label: '#f5ecd8',
  labelStroke: '#070a0b',
  route: {
    taxi: '#f0bc4f',
    bus: '#58b976',
    underground: '#d85a49',
    special: '#a17de0',
  },
  fugitive: '#e05545',
  agent: '#6a9bd8',
  ghost: '#e05545',
  night: true,
};
