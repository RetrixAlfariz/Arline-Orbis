# Arline Orbis

> **Give every story a world.**

A local-first planetary atlas and geographic authoring application for storytellers. Orbis runs independently: no account, cloud database, external map tiles, AI model, or Arline Studio installation is required.

**Status: standalone M0–M4 implementation available.** This extends the existing M0/M1 and incremental M2 code with geographic features and projections, underground networks, staged planetary generation, regional detail and production offline support. See the [implementation and acceptance report](docs/M0_M4_COMPLETION.md) for the exact scope, verification and limitations. M5 distribution and broad platform hardening remain separate.

## Run locally

Requires Node.js **22.12+** and npm. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To use the production build, including offline caching:

```sh
npm run build
npm run preview
```

The first dependency installation and initial asset load need network access or a local server. After the production app reports **Offline ready**, cached assets support offline reload, including the lazy globe and workers. Development mode does not register a service worker. Double-clicking `dist/index.html` with `file://` is not supported.

**Export an important world before updating, clearing browser data, or changing origin.** IndexedDB autosave and recovery are browser/origin-specific. Explicit JSON and compressed `.orbis` backups are portable.

## What is implemented

| Domain | Current capabilities |
| --- | --- |
| Planetary atlas | Shared geodetic coordinates, configurable spherical radius, great-circle distance, 2D map and 3D globe, WebGL fallback |
| Cartography | Natural/Survey styling; equirectangular, Equal Earth, orthographic and regional azimuthal projections; SVG export |
| Terrain and ocean | Signed land/seafloor elevation, geodesic sculpt strokes, water/depth inspection, authored lake levels, measured elevation profiles |
| Geographic authoring | Points, lines, polygons, regions, roads, borders and lakes with stable IDs, locks, descriptions, tags and local era scopes |
| Underground | Entrances, chambers and settlements; tunnel/shaft/portal links; depth slices, sections, routes, reviewed cave suggestions and local 3D envelopes |
| Planetary systems | Seeded plate-inspired relief, ridges/rifts/trenches/seamounts, optional erosion/sediment, drainage/lakes/rivers, temperature/rainfall/biomes |
| Performance | Cancellable generation workers, reviewed preview/apply, progressive regional tiles and bounded cache, interaction-driven 3D rendering |
| Local projects | Autosave, undo/recovery, stale-tab protection, validated legacy imports, version 3 authoring, bounded gzip-compressed `.orbis` interchange |

These are **story-oriented heuristic systems**, not a calibrated geological, atmospheric, fluid or game-world simulator. Regional detail is a demand-paged visualization, not a seamless whole-planet cube-sphere engine. Cave 3D shows chamber envelopes and passages, not a walkable voxel interior.

## First authoring workflow

1. Explore Aurelia or use **Create new world** for an independent seed and radius.
2. Use **Map features & lore** to draw geography, save descriptions and lock important features.
3. Use **Sculpt terrain** to raise land or carve seabed. Use Undo to reverse a change.
4. Open **Underground** to place chambers at meaningful depths and connect passages.
5. In **Planetary generation · M4**, preview a recipe, inspect conflicts, and explicitly apply it. Cancel never changes the active world.
6. Export a backup and reopen it. Old v1/v2 worlds retain their original generator recipes; new authoring uses format v3.

## Author-safety contracts

- Coordinates and elevations are physical values, not screen pixels. Projection/style changes never move geographic anchors.
- Terrain strokes, lake surfaces, water depth and cave altitude use distinct semantics.
- Locked features resist direct edits and overlapping brushes. Regeneration requires review when underlying terrain changes at authored locations.
- Generated suggestions do not automatically become authored facts. Accepted terrain can still make a fixed location physically implausible; review remains the author's responsibility.
- The uncompressed project cap is **2 MB**. Compressed imports enforce the same decompression limit. `.orbis` currently means gzip JSON, **not a ZIP asset package**.
- Story eras are local visibility scopes, not an Arline branch system or full historical simulation.

## Verification

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For production browser tests, set `ORBIS_E2E_PREVIEW=1` in the environment. On PowerShell use `$env:ORBIS_E2E_PREVIEW='1'` first.

The implementation verification passed **53 unit tests**, **22 production Chromium browser tests**, Svelte/TypeScript checks with **0 errors and 0 warnings**, and the production build. [Verified run](https://github.com/RetrixAlfariz/Arline-Orbis/actions/runs/38195726366). Repeat CI for later changes; this evidence is not a guarantee about every browser or hardware GPU.

Use `node scripts/benchmark-m4.mjs benchmark.json` for reproducible CPU-kernel measurements. Browser evidence separately records worker time, main-thread heartbeat and environment. The large lazy Three.js chunk still produces Vite's size warning; its threshold is not hidden.

## Architecture and documentation

Svelte 5, TypeScript, Vite, Three.js and D3-geo remain the runtime stack. New generation and region workers use typed arrays and transferable buffers. Native packaging/Rust acceleration remain optional future work.

- [M0–M4 implementation, acceptance and limitations](docs/M0_M4_COMPLETION.md)
- [Roadmap](docs/ROADMAP.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture proposal](docs/ARCHITECTURE.md)
- [Original draft data model](docs/DATA_MODEL.md), distinct from the implemented v3 contract
- Historical reports: [M0](docs/M0.md), [M1](docs/M1.md), [initial M2](docs/M2.md)
- [Research and inspiration](docs/REFERENCES.md)
- [Original Opheline handoff](docs/OPHELINE_HANDOFF.md)

## Arline Studio remains deferred

Orbis shares the Arline identity but does not access Studio APIs, databases or canon. [Issue #7](https://github.com/RetrixAlfariz/Arline-Orbis/issues/7) remains a distant, unscheduled possibility outside this work. Standalone IDs and portable projects serve Orbis itself.

## License

The repository's own software license has **not yet been selected**. Do not infer it from Arline Studio or from reference projects. The new implementation uses original code and the existing locked dependencies; no third-party cartographic imagery or external font assets were added. Review upstream licenses and notices before any future reuse or redistribution.
