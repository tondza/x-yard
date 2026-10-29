# 0015 — Reveal movers one at a time under a play/map camera

**Status:** accepted — 2026-10-29

## Context

The director played the first 96-station prototype and reported two problems:

1. **Movement was sudden and simultaneous.** Tokens jumped to their new nodes;
   four Agents moved in one frame. The director wants to *understand how the
   others move*: animate one mover at a time, with no move longer than two
   seconds and roughly one second preferred. Real multiplayer may have
   simultaneous moves, but the prototype should reveal them sequentially.
2. **The whole map was fitted into the frame.** That is not a realistic view and
   does not survive different screen sizes. The director asked for zoom/viewport
   logic and a separate "map view" to inspect places away from the player.

The engine resolves the Agent phase atomically and deterministically. The problem
is presentation, not the rules: the end state must not change.

## Decision

1. **The engine returns what it did.** `resolveAgentPhase` now returns
   `agentMoves` — one `{ seatId, from, to, mode }` per Agent, in resolution
   order. The client animates exactly that list. It does not re-run a bot, infer a
   mode from the graph, or reconstruct an edge. Engine state and tests are
   otherwise unchanged.
2. **One turn is a short, skippable reveal.** Each mover gets a ~170 ms camera
   lead-in. The Fugitive's route runs for ~850 ms, a scheduled pulse or scooter
   reveal holds for 1.15 s, and each Agent then runs for 700 ms with a 150 ms beat.
   Every mover travels its real street/transit polyline, and completed moves leave
   a thin trace for the rest of the turn. A
   Skip control jumps straight to the final state. The result overlay waits for
   the reveal to finish.
3. **Two cameras, one map.** `Play` follows the Fugitive and frames the active
   mover's route (so an Agent that starts off-screen is brought into view).
   `Map` is a free pan/zoom view, and `Expand` makes it fill the screen. Camera
   motion is eased; it never changes the game state.
4. **The overlay is screen-space; the city is map-space.** Station numbers,
   tokens, rings and route widths are drawn at constant screen size from the
   camera scale. The city plate zooms normally. Street-number labels drop out
   below a threshold while terminals, hubs, facilities, legal destinations and
   the active move stay labelled.
5. **The layout responds to the viewport.** The stage is measured with a
   `ResizeObserver`; CSS breakpoints rearrange the kit/side panel. There is no
   fixed 1440×900 assumption. On a portrait phone the Map view uses a cover crop
   centred on the Fugitive rather than shrinking the whole 4:3 city into 390 px;
   panning and zooming reach the rest.

## Rejected alternatives

1. **Move all Agents in one animation.** Rejected: this is the director's
   original complaint — it spends four moves in the time it takes to read one.
2. **Let the client re-derive Agent moves to animate them.** Rejected: the
   client could draw a different edge than the one the engine charged, and the
   animation would silently drift from the rules. The engine returns the moves.
3. **Make the camera authoritative or store it in `PrototypeState`.** Rejected:
   a camera is view state. Putting it in the engine would make replay depend on
   window size and would pollute the JSON-serializable state contract.
4. **One fitted viewBox for every screen.** Rejected: the original full-map fit;
   labels are unreadable on a phone and the board reads as a diagram, not a city.
5. **Scale station labels and tokens with the city.** Rejected: labels become
   microscopic at overview and oversized at play zoom. The overlay compensates
   for scale instead.
6. **An unskippable reveal.** Rejected: a pulse turn would lock 6–7 seconds of
   motion, which is unacceptable on repeat turns and while tuning the board.
7. **Build the 300-node/WebGL renderer now.** Rejected: 96 stations render in
   SVG without difficulty. The new camera contract (world `viewBox` + screen-space
   overlay) is the seam the 300-node renderer can keep, but the renderer itself
   is still the next scale rehearsal.

## Consequences

- The visual order is not the engine's simultaneous resolution. The banner says
  `AGENT PHASE · 2 / 4`; the end state is identical to the one-step resolution.
- Presentation timings live in `apps/web/src/prototype/motion.ts` as UI
  constants, not engine rules. Changing them cannot change a game result.
- Any new overlay marker must express its size in screen pixels and divide by
  `camera.scale` (or use `vector-effect="non-scaling-stroke"`), or it will jump
  size with the camera.
- The map view on a portrait phone is a moving window, not a full-city thumbnail.
  A future minimap or a rotated overview can add the missing orientation.
- The 300-node renderer must preserve the two-camera contract and label LOD;
  plain SVG will not hold that scale, which is already the next plan item.
