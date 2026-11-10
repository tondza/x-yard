# docs/decisions/ — settled engineering decisions

One file per settled engineering, tooling, or process decision. This is the
**addressable** form of the "Decisions" blocks in
[`PROJECT_LOG.md`](../../PROJECT_LOG.md): the log stays the chronological record,
and these records are what an agent reads when it needs *one* decision instead of
a whole round of history.

## What belongs here

An engineering, tooling, or process decision with a real alternative that was
considered and rejected. Not a game-design answer — those are ratified numbers and
belong in [`GAME_VISION.md`](../../GAME_VISION.md) (or, while unratified, in
[`GAME_VISION.appendix.md`](../../GAME_VISION.appendix.md) appendix C as an open
question).

## Format

Follow [`0001-native-pnpm-workspaces.md`](0001-native-pnpm-workspaces.md):

- **Status** — accepted / superseded by NNNN.
- **Context** — the forces that made a choice necessary.
- **Decision** — what was chosen, in one or two sentences.
- **Rejected alternative** — what was *not* chosen and the concrete failure mode
  it would have caused. This is the most valuable field: it is what stops a later
  session from "improving" the design back into a mistake.
- **Consequences** — what this makes easy, and what it makes expensive.

## Rules

- **Never edit an accepted record's decision.** Supersede it with a new record and
  set `Superseded by` on the old one. The history of *why* is the point.
- Name files `NNNN-kebab-case-title.md`, numbered in creation order.
- Link the record from the `PROJECT_LOG.md` entry that made the decision.
- A decision that can be enforced mechanically should also be enforced
  mechanically — see [`../../packages/game-core/src/architecture.test.ts`](../../packages/game-core/src/architecture.test.ts)
  and [`../../packages/game-core/src/spec-alignment.test.ts`](../../packages/game-core/src/spec-alignment.test.ts)
  for the pattern. Prose records intent; a test prevents regression.

## Index

| Record | Decision |
| --- | --- |
| [0001](0001-native-pnpm-workspaces.md) | Native pnpm workspaces — no Turborepo, Nx, or Lerna |
| [0002](0002-vitest-as-root-dev-dependency.md) | Vitest is a root dev dependency only; `game-core` declares no devDependencies |
| [0003](0003-workspaces-consumed-as-source.md) | Workspaces are consumed as TypeScript source, not built to `dist` |
| [0004](0004-shared-types-imports-engine-vocabulary.md) | `shared-types` imports its vocabulary from `game-core` rather than re-declaring it |
| [0005](0005-pure-rng-functions-over-explicit-state.md) | The RNG is pure functions over an explicit `RngState`, not a stateful closure |
| [0006](0006-provisional-prefix-per-constant.md) | One `PROVISIONAL_` constant per unratified number, not a central defaults object |
| [0007](0007-two-validation-channels.md) | Graph validation splits errors (brief requirements) from warnings (provisional heuristics) |
| [0008](0008-rename-without-compatibility-aliases.md) | Vocabulary was renamed in place, with no compatibility aliases |
| [0009](0009-derived-appendix-split-from-the-brief.md) | The derived appendix lives in its own file, separate from the director's brief |
| [0010](0010-legal-moves-follow-streets.md) | Legal-move paths follow the street network; no straight lines across blocks |
| [0011](0011-prototype-before-multiplayer-mvp.md) | A bot-filled single-player prototype precedes the multiplayer MVP |
| [0012](0012-timed-concurrent-turn-windows.md) | Timed, concurrent turn windows replace sequential turns |
| [0013](0013-map-generator-separate-package.md) | The map generator is a separate, model-first package; the map lab renders the model |
| [0014](0014-96-station-desktop-prototype.md) | The first playable prototype is 96 stations, desktop-first, with close Agent starts |
| [0015](0015-sequential-reveal-and-play-map-camera.md) | Prototype turns reveal one mover at a time under a play/map camera with label LOD |
| [0016](0016-appearance-terminology.md) | The player-facing term is Appearance, not Pulse |
| [0017](0017-always-visible-network-and-last-appearance.md) | The transit network is always visible; no route planner; last-appearance ghost |
| [0018](0018-developer-switchable-city-skins.md) | City skins are developer-switchable; Basic stays the default fallback |
| [0019](0019-1907-era-rules.md) | The 1907 era rules remove the motor-scooter; special stays; Vintage is the default skin |
