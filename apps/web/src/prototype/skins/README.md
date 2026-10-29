# City skins (developer-only)

The city plate is swappable without touching the rules, the graph or the live
overlay. This is the narrow boundary that makes “try a much richer city” cheap.

## Current registry

| `SkinId` | Renderer | Default? |
| --- | --- | --- |
| `basic` | `../CityPlate.tsx` — the original F-style plate | **yes** |
| `iron` | `Rts25CityFragment` with `COMMAND`, `overlay={false}` | no |
| `nightops` | `Rts25CityFragment` with `NIGHT_OPS`, `overlay={false}` | no |

`SKIN_OPTIONS` is the selector list. `basic` is the fallback and must stay.

## Switching

- Dev header: the `SKIN` select (not an end-user feature).
- URL: `?skin=basic`, `?skin=iron`, `?skin=nightops`.
- Persisted in `localStorage['xyard.skin']`; the URL wins over storage.

## Adding another 2.5D skin

1. Add a palette to the RTS theme data (or create another `RtsTheme`).
2. Render its city through the same skin boundary; the overlay stays in
   `PrototypeMap`.
3. Add the id to `SkinId`, `SKIN_OPTIONS` and the `MapStage` branch.
4. Keep `basic` reachable; screenshot the new skin at 1440 and 390.

A skin may change the city plate's palette, geometry and ambient detail. It must
not change station positions, routes, tokens, the ghost or any game value.

## What is intentionally not here

- The isometric **Command City** renderer lives in `apps/web/src/lab/rts/` and is
  lab-only until the camera/overlay projection is approved. It is not a skin yet.
- The pastel themes from round 04 live in `visualThemes.ts` / `CitySkinBase.tsx`
  as historical lab material; they are not in the game selector.
- There is no end-user skin picker and no server-side skin state.
