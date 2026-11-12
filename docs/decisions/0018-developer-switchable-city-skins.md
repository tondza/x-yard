# 0018 — Developer-switchable city skins; Basic stays the fallback

**Status:** accepted — 2026-10-29 (mechanism; the final art direction is still open)

> **Partially superseded by [0019](0019-1907-era-rules.md):** the default skin is
> now the isometric Vintage Etching skin, and the 1925 rules remove the motor-scooter.
> The skin registry/selector mechanism and Basic fallback remain in force.

## Context

The prototype's city plate is deliberately schematic: flat footprints, simple
blocks, a beige palette. The director's verdict on the illustrative pass was that
it still looked “pretty much like a children's drawing”, and that the target is a
late-90s RTS city look (“Red Alert 2 style”). At the same time the director was
explicit that this must not become a risky rewrite:

> The current / basic design could be kept as “backup” for easy switch back.
> Choice of skins doesn't need to be there for end user, but for game developer /
> admin, it should be very easy.

The constraints are therefore split:

1. the **rules, graph and live overlay must not change** when the city is reskinned;
2. **Basic must remain the default** and always be one action away;
3. the selector is **developer-facing**, not an end-user feature;
4. the expensive isometric direction must be separable from the cheap 2.5D one.

## Decision

1. **The city plate is a skin.** A skin renders only the city (ground, streets,
   blocks, buildings, trees, landmarks, ambient light). The live overlay
   (permanent network, station markers, tokens, ghost, labels) remains in
   `PrototypeMap`. A skin cannot change the board or the rules.
2. **Basic is the default and the fallback.** `basic` is the original
   `CityPlate`. It stays in the registry, loads by default, and is never removed
   until a replacement is ratified.
3. **Two RTS skins are live developer options:** `iron` (2.5D, late afternoon)
   and `nightops` (2.5D, night). Both use the same map coordinates, camera and
   overlay as Basic; only the city plate renderer changes.
4. **The selector is developer-only.** In the dev prototype, a `SKIN` select in
   the header switches live. `?skin=iron`, `?skin=nightops` and `?skin=basic`
   deep-link the same choice, and the choice is persisted in
   `localStorage['xyard.skin']`. The production build excludes the prototype, so
   no end-user skin selector ships.
5. **The isometric direction is lab-only for now.** “Command City” re-projects the
   whole board; its camera, station labels, transit lines and tokens would all
   need a projection pass. It stays in the `?rts` design lab until that cost is
   approved. It is not a skin the game can switch to yet.
6. **The look is not ratified.** This decision settles the switching mechanism and
   the Basic fallback, not the final art direction. The RTS direction is recorded
   as exploration in the round-05 moodboard.

## Rejected alternatives

1. **Replace Basic with the new skin.** Rejected by the director: Basic is the
   working fallback while a much more expensive look is explored.
2. **An end-user skin picker.** Rejected: it is not a player feature, it adds
   settings surface, and the game should have one authored look.
3. **Put skin logic in `game-core` or the wire types.** Rejected: a skin is a
   renderer concern; the engine must stay pure and deterministic.
4. **Make the isometric Command City the live skin immediately.** Rejected for
   now: it requires re-projecting the camera and every overlay layer, which is a
   separate, testable change.
5. **Commit to pre-rendered RA2-style sprites now.** Rejected as the first step:
   it needs a 3D asset pipeline. The vector RTS skins prove the composition,
   detail budget and switching mechanism first; sprite atlases can replace the
   city renderer later behind the same skin boundary.

## Consequences

- The game selector contains `Basic`, `Iron`, `Night` only; the pastel
  visual-lab themes are retained as history, not shipped options.
- `Rts25CityFragment` can render as a fragment (lab, with overlay) or as a city
  plate (`overlay={false}`, camera `viewBox`) for the prototype.
- No appearance, ticket, graph or state value changed. The full suite stays at
  **7 files / 131 tests**.
- The isometric lab is a concrete estimate of the extra work, not a rejected
  idea; if the director wants that look, the projection pass is the next step.
- A future pre-rendered skin can reuse the registry and selector; only its city
  renderer changes.
