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

Review renders of the lab live in [`shots/`](shots/): `prototype-24-seed-42.png`
and `mvp-60-seed-42.png`.

Regenerate after a generator change:

```bash
WRITE_MAPS=1 pnpm --filter @x-yard/map-generator test
pnpm --filter @x-yard/map-generator test
```

The generator, its guarantees and the map lab are documented in
[`packages/map-generator/README.md`](../packages/map-generator/README.md).
