# `maps/` — committed generated fixtures

Generated maps are data, not build output. Committing them makes a board
reviewable and diffable, gives the playable prototype a stable input, and lets a
test regenerate each file from its seed and assert it is unchanged.

| File | Stations | Seed |
| --- | --- | --- |
| `prototype-24-seed-42.json` | 24 | 42 |
| `prototype-24-seed-7.json` | 24 | 7 |
| `mvp-60-seed-42.json` | 60 | 42 |
| `mvp-60-seed-7.json` | 60 | 7 |
| `prototype-96-seed-42.json` | 96 | 42 |

Review renders of the lab live in [`shots/`](shots/): `prototype-24-seed-42.png`,
`prototype-96-seed-42.png` and `mvp-60-seed-42.png`.

The first playable's frames remain for comparison:
`prototype-96-turn-1.png` (initial city and legal moves),
`prototype-96-turn-2.png` (after one move), and `prototype-96-result.png`
(capture overlay).

The **current** prototype is captured in:

| File | Shows |
| --- | --- |
| `prototype-96-play-1440.png` | play camera at 1440×900, permanent transit network |
| `prototype-96-station-1440.png` | hovering a legal destination opens its station card |
| `prototype-96-agent-1440.png` | an Agent's move being revealed, route + banner |
| `prototype-96-appearance-1440.png` | an appearance marker before the Agent phase |
| `prototype-96-appearance-ghost-1440.png` | the last-appearance `F18` ghost after the Fugitive moves away |
| `prototype-96-map-1440.png` | the free Map view of the whole quarter |
| `prototype-96-result-1440.png` | the capture result overlay |
| `prototype-96-play-390.png` | the responsive phone layout at 390×844 |
| `prototype-96-station-390.png` | a station card on the phone |
| `prototype-96-map-390.png` | the expanded map view on the same phone |

The network, station inspector and ghost are recorded in decisions
[0016](../docs/decisions/0016-appearance-terminology.md) and
[0017](../docs/decisions/0017-always-visible-network-and-last-appearance.md).
There is deliberately no route planner.

Regenerate after a generator change:

```bash
WRITE_MAPS=1 pnpm --filter @x-yard/map-generator test
pnpm --filter @x-yard/map-generator test
```

The generator, its guarantees and the map lab are documented in
[`packages/map-generator/README.md`](../packages/map-generator/README.md).
