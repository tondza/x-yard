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
  /** Optional neutral street palette for the Board plate. */
  readonly streetEdge?: string;
  readonly streetPavement?: string;
  readonly streetFill?: string;
  /** Optional softer keyline for route ribbons. Defaults to `shadow`. */
  readonly routeCasing?: string;
  /** Optional house/landmark line ink. Defaults to `shadow`. */
  readonly outline?: string;
  /** Multiplier on the building line width. Defaults to 1. */
  readonly outlineScale?: number;
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
  /** Disc fill. Falls back to stationPad when omitted. */
  readonly stationDisc?: string;
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
  readonly etching?: boolean;
  /** The paper-board renderer: flat fills, ink edges, no hatching or cast shadows. */
  readonly board?: boolean;
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
  ground: '#464949',
  block: '#82796b',
  blockEdge: '#5a5348',
  park: '#4b5d3a',
  parkEdge: '#38462c',
  water: '#24515c',
  waterEdge: '#183b43',
  asphalt: '#45494b',
  sidewalk: '#b3aa98',
  lane: '#d8bd7e',
  shadow: '#080a0b',
  shadowOpacity: 0.55,
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

export const VINTAGE: RtsTheme = {
  id: 'vintage',
  title: 'Vintage Etching',
  kicker: 'Isometric · 1925 · sepia',
  pitch: 'A hand-etched sepia city where the only saturated colour is the transit network.',
  strengths: [
    'The map and menus read as one period object',
    'Coloured routes stay instantly legible against the ink',
    'Cathedral, station and market already fit the era',
  ],
  watchouts: 'A full period pass still needs more period street furniture and a river/bridges.',
  effort: 'Medium',
  accent: '#7a2f25',
  ground: '#e8d8b7',
  block: '#dfceac',
  blockEdge: '#634b31',
  park: '#d2c9a1',
  parkEdge: '#756146',
  water: '#c4c2a4',
  waterEdge: '#6d5f48',
  asphalt: '#9c825c',
  sidewalk: '#c4ad84',
  lane: '#4f3b26',
  routeCasing: '#5a4733',
  outline: '#5c4833',
  outlineScale: 0.8,
  shadow: '#231c13',
  shadowOpacity: 0.5,
  /*
   * Render, stone, brick, timber, distemper and grey stone, all desaturated:
   * the transit network remains the only saturated layer. The Canvas renderer
   * picks one palette per building from the seeded building hash. These are
   * deliberately mid-toned — a paper-and-ink plate needs walls that can carry a
   * dark outline, not near-white cards.
   */
  walls: [
    { light: '#dcc8a4', mid: '#c2aa81', dark: '#846b4a' },
    { light: '#d3bd97', mid: '#b89f75', dark: '#7c6446' },
    { light: '#cfb091', mid: '#b18b69', dark: '#78573e' },
    { light: '#c8ab80', mid: '#ab8c61', dark: '#735b3d' },
    { light: '#dccbab', mid: '#c1ab84', dark: '#806948' },
    { light: '#beb49d', mid: '#9f967e', dark: '#6a624c' },
    { light: '#d3bd97', mid: '#b79c72', dark: '#796246' },
    { light: '#c9b18b', mid: '#ac9268', dark: '#755d3f' },
  ],
  roofs: [
    { top: '#8a7358', edge: '#66533e' },
    { top: '#75604a', edge: '#574634' },
    { top: '#96805f', edge: '#715f47' },
    { top: '#65533f', edge: '#4b3d2e' },
    { top: '#806a50', edge: '#5f4e3b' },
    { top: '#74766f', edge: '#565852' },
    { top: '#5f6059', edge: '#474841' },
    { top: '#947f5c', edge: '#6e5c44' },
  ],
  window: '#7a6a54',
  windowLit: '#f1dfae',
  windowLitChance: 0.07,
  steel: '#5e4d3a',
  rust: '#7d4c36',
  tree: '#8b8a67',
  treeLight: '#aaa77f',
  treeTrunk: '#5c4834',
  stationPad: '#f3e6c9',
  stationRing: '#3d3428',
  label: '#3b3227',
  labelStroke: '#f3e6c9',
  route: {
    taxi: '#bd882c',
    bus: '#3f7a52',
    underground: '#a43d33',
    special: '#6a4b9a',
  },
  fugitive: '#7a2f25',
  agent: '#3d3428',
  ghost: '#7a2f25',
  sky: '#d9c8a7',
  sun: '#fff0c9',
  night: false,
  etching: true,
};

/*
 * The board treatment: the reference is the printed Scotland Yard city, not an
 * etching. Flat fills, a heavy uniform ink contour, paper streets, short
 * roof-first houses and saturated route ribbons. `board: true` makes CanvasCity
 * skip hatching, cast shadows, lane markings and paper grain.
 */
export const BOARD: RtsTheme = {
  id: 'board',
  title: 'Yard Board',
  kicker: 'Isometric · 1925 · paper board',
  pitch: 'The printed board: roof-first houses, paper streets and the transit network as the boldest layer.',
  strengths: [
    'Landmarks, numbered discs and routes read at a glance',
    'The plate fills the frame like a board, not a vignette',
    'One colour language from route ribbon to kit card',
  ],
  watchouts: 'Needs a river and a denser block plan to match the reference city.',
  effort: 'Medium',
  accent: '#a43d33',
  ground: '#fdf9ec',
  block: '#fdf9ec',
  blockEdge: '#eadfc6',
  park: '#a9bd6d',
  parkEdge: '#6f7f45',
  water: '#5c93ad',
  waterEdge: '#3f6c82',
  asphalt: '#cec2ac',
  sidewalk: '#e4d9c4',
  lane: '#8b7d67',
  streetEdge: '#b7a68a',
  streetPavement: '#e4d9c4',
  streetFill: '#cec2ac',
  routeCasing: '#7f6f57',
  outline: '#806e55',
  outlineScale: 0.75,
  shadow: '#2a2018',
  shadowOpacity: 0.2,
  /*
   * Warm plaster and tile. The plate keeps the 1925 palette, but every tone is
   * flat enough to carry a heavy contour; the ink does the work, not shading.
   */
  walls: [
    { light: '#f6e8c8', mid: '#e9d5ac', dark: '#c9ae80' },
    { light: '#f2dfba', mid: '#e2c997', dark: '#bfa16f' },
    { light: '#efd9b0', mid: '#dcbf8a', dark: '#b69865' },
    { light: '#f8edcf', mid: '#ead7ae', dark: '#cbb384' },
    { light: '#e9dcc2', mid: '#d6c5a4', dark: '#af9c7b' },
    { light: '#f4e4c4', mid: '#e3cda2', dark: '#c0a576' },
    { light: '#ead2ae', mid: '#d4b88b', dark: '#ac8f64' },
    { light: '#f7e9cd', mid: '#e6d1a8', dark: '#c3a97c' },
  ],
  roofs: [
    { top: '#c26a4a', edge: '#8e4a32' },
    { top: '#b85b3e', edge: '#843c28' },
    { top: '#c7954c', edge: '#946b33' },
    { top: '#7f8c94', edge: '#5b666e' },
    { top: '#5f9b84', edge: '#3f7462' },
    { top: '#b9a98d', edge: '#8e7f66' },
    { top: '#a85a44', edge: '#7c3f2f' },
    { top: '#8d8477', edge: '#6a6257' },
  ],
  window: '#5d4b39',
  windowLit: '#f1dfae',
  windowLitChance: 0.05,
  steel: '#5e4d3a',
  rust: '#8a4b34',
  tree: '#7f9a4e',
  treeLight: '#96ad61',
  treeTrunk: '#6d5638',
  stationPad: '#f9f0da',
  stationDisc: '#f7e6ac',
  stationRing: '#2a2018',
  label: '#2a2018',
  labelStroke: '#fdf9ec',
  route: {
    taxi: '#c08a2c',
    bus: '#3f7a52',
    underground: '#a43d33',
    special: '#6a4b9a',
  },
  fugitive: '#8f2f26',
  agent: '#2f6fed',
  ghost: '#8f2f26',
  sky: '#fdf9ec',
  sun: '#fff6d8',
  night: false,
  board: true,
};
