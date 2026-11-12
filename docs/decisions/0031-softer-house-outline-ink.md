# 0031 — House outlines use a softened ink, separate from shadow

**Status:** accepted — 2026-11-12

## Context

Board and Vintage house, roof and landmark outlines all used `theme.shadow` —
the near-black ink also used for labels and (on Vintage) cast shadows. The
director found the house outlines too strong and dark on both skins.

## Decision

1. Add an optional `outline` colour and `outlineScale` width multiplier to
   `RtsTheme`.
2. Use a small `ink(theme)` helper (`theme.outline ?? theme.shadow`) for house,
   roof, landmark, tree and furniture linework in `CanvasCity`.
3. Board uses `outline: '#806e55'` with `outlineScale: 0.75`; Vintage uses
   `outline: '#5c4833'` with `outlineScale: 0.8`.
4. Keep the non-linework uses separate: cast shadows remain `shadow`, labels and
   station rings remain `label`, route keylines use `routeCasing`, and Board
   street edges use the neutral street palette.
5. Other skins fall back to `shadow`, so Basic/Iron/Night are unchanged.

## Rejected alternatives

1. **Keep `shadow` for house linework.** It is the complaint; the near-black ink
   makes every roof and wall edge read as a hard black cut.
2. **Lighten `shadow` globally.** It would also weaken labels, station rings and
   Vintage's cast shadows; those need their own contrast.
3. **Remove house outlines entirely.** The plate loses the definition that makes
   the roof planes read.
4. **Change only one skin.** Both Board and Vintage had the same dark linework;
   the fix is shared.

## Consequences

- Board and Vintage houses keep their form but with softer, warmer outlines.
- The outline is a theme knob: `outline` and `outlineScale` can be tuned without
  touching drawing code.
- Cast shadows, labels, route ribbons and street edges are deliberately
  unaffected by the outline change.
