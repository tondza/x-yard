/**
 * City skin registry.
 *
 * `basic` is the original `CityPlate` and stays the default/backup. The RTS
 * skins are 2.5D city plates rendered from the same generated map; they never
 * touch the rules, the graph or the live overlay. The selector is
 * developer-facing only, so it never ships in a production bundle.
 *
 * The earlier pastel themes live in `apps/web/src/lab` as visual history; they
 * are not part of the game selector.
 *
 * @module apps/web/prototype/skins
 */

export type SkinId = 'basic' | 'vintage' | 'board' | 'iron' | 'nightops';

export interface SkinOption {
  readonly id: SkinId;
  readonly label: string;
  readonly kicker: string;
}

export const SKIN_OPTIONS: readonly SkinOption[] = [
  { id: 'basic', label: 'Basic', kicker: 'F · 2.5D · prototype baseline' },
  { id: 'vintage', label: 'Vintage', kicker: 'Isometric · 1925 · etched sepia' },
  { id: 'board', label: 'Board', kicker: 'Isometric · 1925 · paper board' },
  { id: 'iron', label: 'Iron', kicker: '2.5D · RTS city' },
  { id: 'nightops', label: 'Night', kicker: '2.5D · night · lit windows' },
];

export const DEFAULT_SKIN: SkinId = 'board';

export function isSkinId(value: string | null): value is SkinId {
  return value !== null && SKIN_OPTIONS.some((option) => option.id === value);
}
