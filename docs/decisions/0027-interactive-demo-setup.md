# 0027 — The interactive demo is a dev-only setup screen over the prototype

**Status:** accepted — 2026-11-12

## Context

The director asked for an interactive demo to test different parts of the game:
choose an existing or newly generated map (size, route density), set the total
number of turns, set the ticket budgets, and choose the Fugitive or the Agent
side — with the city skins still available. The existing prototype started from a
side chooser and then hard-coded the 96-station fixture, 16 turns and both
starting ticket bags.

The constraints that shaped the answer:

- `createPrototypeGame` is the one place that builds a playable state; a demo
  that reimplemented the setup in the client would drift from the engine.
- The 16-turn limit and the 5/10/15 appearances are ratified numbers. They must
  stay the defaults, and the engine must keep exposing the unratified ticket
  numbers under `PROVISIONAL_` names.
- Map generation is dev tooling. Adding a client-only demo must not make the
  generator a rules dependency or change the committed boards.

## Decision

1. **A setup screen at the prototype route.** It is dev-only like the rest of
   `apps/web/src/prototype`. It edits a `DemoConfig` and resolves it to a
   `GeneratedMap` plus a `PrototypeSetup`, then renders the existing play table
   in a new React subtree keyed by the build, so starting again resets cleanly.
   The skin selector stays on the setup screen and in the game header.
2. **Setup is an explicit engine input.** `createPrototypeGame(graph, starts,
   seed, setup?)` accepts an optional `PrototypeSetup` with `turnLimit`,
   `appearanceTurns`, per-role ticket bags and foot steps. Defaults come from the
   existing constants (`YARD_TURN_LIMIT`, `APPEARANCE_TURNS`, the prototype
   ticket bags), so a normal call is unchanged. The state records `turnLimit`
   and `appearanceTurns`, and the turn/appearance/capture rules read them from
   state instead of module globals.
3. **Shorter or longer Yards scale appearances.** For a non-16 turn limit the
   demo derives three appearances from the same relative points (5/16, 10/16,
   15/16), sorted and unique. This is a demo rule, not a ratified schedule.
4. **Route density is a generator option.** `MapOptions.routeDensity`
   (`sparse` / `standard` / `dense`) scales only the extra local taxi links and
   their reach. `standard` reproduces the prototype graph; the spanning tree,
   bus, metro and special tiers are untouched. Fixtures record
   `params.routeDensity: 'standard'`.
5. **Generated maps keep the tested density.** The demo derives the world size
   from the station count (`sqrt(targetNodes / 96)`, with a floor), so 24/60/192/
   300/384/576-station maps have roughly the quarter's building density instead
   of collapsing block sizes. Sizes stay at 576 or below until the overlay scale
   work lands.
6. **Existing fixtures remain the fast path.** The demo offers the 24, 60, 96
   and 576 committed maps; 576 is still a dynamic import. The 96 board, the 6x
   rehearsal, and the production bundle are unchanged.

## Rejected alternatives

1. **Hard-code a handful of demo presets in the UI.** Rejected: the suggested
   values would live beside the engine instead of in the engine's defaults, and
   the next ticket/turn change would make the presets lie.
2. **Mutate `YARD_TURN_LIMIT` or the ticket constants at runtime.** Rejected: the
   `PROVISIONAL_` inventory and the deterministic state are the contract; a
   demo must not rewrite a module constant. The setup is passed as state.
3. **Fork the prototype component into a demo-only copy.** Rejected: two play
   tables would drift on capture, reveal and Agent Practice. The setup screen
   only chooses inputs; the play table is the same component.
4. **Move the demo configuration to the server.** Rejected: the server has no
   `projectState` and must not send state to a client yet; this is a local,
   dev-only table.
5. **Offer 10x/50x station counts in the size selector.** Rejected for now: the
   stable SVG overlay has only been validated at 576, and a larger map needs
   Canvas/windowed routes first (decisions 0020 and 0025).
6. **Make route density a game rule or change the bus/metro tiers with it.**
   Rejected: only the local taxi extras have a clean interpretation as a demo
   knob. Changing the tier contract would change the game, not the test setup.

## Consequences

- The prototype state gains `turnLimit` and `appearanceTurns`. This is a
  prototype-only shape; the real `GameState` and its architecture guard are
  untouched.
- `createPrototypeGame` has a fourth optional argument; every existing call is
  source-compatible and keeps the ratified defaults.
- The generator's committed fixtures gain `params.routeDensity: 'standard'`
  metadata. Their graph, starts and positions are unchanged.
- The demo can generate a map synchronously in the browser; the setup screen
  shows a loading state and a failure message if generation throws.
- The demo is dev-only. The production build drops the prototype route, the
  1.9 MB 576 fixture and the generator import.
