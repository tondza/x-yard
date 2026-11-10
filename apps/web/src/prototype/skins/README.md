# City skins (developer-only)

The city plate is swappable without touching the rules, the graph or the live
overlay. This is the narrow boundary that makes “try a much richer city” cheap.

## Current registry

| `SkinId` | Renderer | Default? |
| --- | --- | --- |
| `vintage` | `IsoCityFragment` with `VINTAGE`, projected city; the live overlay is projected too | **yes** |
| `basic` | `../CityPlate.tsx` — the original F-style plate | fallback |
| `iron` | `Rts25CityFragment` with `COMMAND`, `overlay={false}` | no |
| `nightops` | `Rts25CityFragment` with `NIGHT_OPS`, `overlay={false}` | no |

`SKIN_OPTIONS` is the selector list. `vintage` is the default; `basic` is the
fallback and must stay. The 1907 rules have no motor-scooter.

## Switching

- Dev header: the `SKIN` select (not an end-user feature).
- URL: `?skin=vintage`, `?skin=basic`, `?skin=iron`, `?skin=nightops`.
- Persisted in `localStorage['xyard.skin']`; the URL wins over storage.

## Adding another 2.5D skin

1. Add a palette to the RTS theme data (or create another `RtsTheme`).
2. Render its city through the same skin boundary; the overlay stays in
   `PrototypeMap`.
3. Add the id to `SkinId`, `SKIN_OPTIONS` and the `MapStage` branch. If the skin
   changes projection, add it to `projection.ts` and project the overlay/camera
   together.
4. Keep `basic` reachable; screenshot the new skin at 1440 and 390.

A skin may change the city plate's palette, geometry and ambient detail. It must
not change station positions, routes, tokens, the ghost or any game value.

## What is intentionally not here

- The isometric renderer lives in `apps/web/src/lab/rts/` and is now used by the
  default Vintage skin. The lab Command City card remains a study/comparison.
- The pastel themes from round 04 live in `visualThemes.ts` / `CitySkinBase.tsx`
  as historical lab material; they are not in the game selector.
- There is no end-user skin picker and no server-side skin state, and no
  motor-scooter in the 1907 rules.
