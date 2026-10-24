# `@x-yard/map-generator`

Seeded city and transit-network generation for X-Yard. **Internal tooling and
test fixtures, not the rules engine.** It depends on `game-core`; `game-core`
never depends on it.

## What it produces

One `GeneratedMap` from a seed and a target station count:

- a schematic city: street centrelines, block polygons, parks, landmarks;
- a validated `TransitGraph` with `taxi`, `bus`, `underground` and `special`
  edges, each carrying a polyline in `GraphEdge.path`. The metro is a connected
  network: two lines share one interchange terminal and cover every terminal, so
  there are `terminals - 1` metro edges and no isolated chord pairs;
- one Black Market and one Safe House, both inert;
- start positions for 1 Fugitive + 4 Agents, all Agents at least 3 edges away;
- a validation report (graph errors, street-coverage check, provisional warnings).

The model is authoritative. The lab renders it; a future presentation renderer
will render the same data with buildings and roofs. No art is baked into the
generator.

## Use it

```bash
pnpm --filter @x-yard/web dev     # Vite on :5173
# open http://localhost:5173/     (dev default) or /?lab
```

The lab is dev-only. `/?board` opens the original server-backed board scaffold.

Programmatically:

```ts
import { generateMap } from '@x-yard/map-generator';

const map = generateMap(42, { targetNodes: 24 });
```

`generateMap` is pure and deterministic. If a layout fails a hard constraint it
retries on a derived seed, up to a bounded number of attempts, and records the
effective seed so the exact map can be regenerated. A seed that exhausts the
attempts throws `MapGenerationError` with the reasons.

## Fixtures

Committed maps live in [`../../maps/`](../../maps/):

- `prototype-24-seed-*.json`
- `mvp-60-seed-*.json`
- `prototype-96-seed-42.json` (the 96-station prototype target)

The test suite regenerates each fixture from its stored seed and asserts it is
byte-for-byte equivalent. To refresh them after a generator change:

```bash
WRITE_MAPS=1 pnpm --filter @x-yard/map-generator test
pnpm --filter @x-yard/map-generator test   # re-run without writing
```

## What is guaranteed

- `validateGraph` returns **no errors**; every taxi/bus path is covered by the
  street network (`validateStreetGeometry`, R5).
- The taxi-only subgraph reaches every station.
- Every station has degree >= 2.
- Station classes follow the target mix: 16/6/2 at 24 nodes, 40/14/6 at 60.
- Bus and metro avoid street nodes; metro joins terminals; special joins street
  nodes. The metro subgraph is connected (a tree of `terminals - 1` edges with a
  shared interchange).
- 1 Fugitive + 4 Agent starts satisfy the >= 3-edge separation rule.

## Known limitations

- The street skeleton is a thinned, jittered lattice. It is deliberately
  schematic; the irregular road graph, river/bridges and districts come next.
- The validator emits one **provisional** warning on every map: mean degree is
  below the `[4.5, 6.5]` heuristic. The plan's 24-node map is also ~40 edges, so
  the warning is reported, not hidden.
- No buildings, roof materials or animation yet. That is the presentation
  renderer.
- Starting seats are 1 Fugitive + 4 Agents. The 4-Fugitive / 16-Agent layout is
  MVP work and needs its own separation rule.
