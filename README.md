# Arline Orbis

> **Give every story a world.**

**Arline Orbis** is a planned, local-first, lightweight planetary atlas for storytellers. It shares the broader Arline identity, but is being designed and built as a **fully standalone application**. Direct [Arline Studio](https://github.com/RetrixAlfariz/Arline-Studio) integration is a **distant, unscheduled possibility**, not part of the current delivery plan. Its purpose is **story continuity and authoring**, not game-world simulation for its own sake.

**Status: M0 implemented — runnable 2D/3D atlas prototype.** Explore original seeded terrain, inspect coordinates/elevation, and name session landmarks. Persistence, export/import, author locks and distance tools remain M1 work. See the [M0 implementation report](docs/M0.md) for proof, limitations and the demo checklist.

## Run locally

Requires **Node.js 22.12+** and npm. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No Arline installation, account, remote assets or runtime external service is required. After installing dependencies, development and production preview work without internet access. This release does not install an offline service worker or support double-clicking `dist/index.html`.

```sh
npm run check
npm test
npm run build
npm run preview
```

Browser verification (Chromium installation requires internet once):

```sh
npx playwright install chromium
npm run test:e2e
```

**M0 editing is session-only: refresh clears landmarks.** The UI states this explicitly. Terrain is an illustrative seeded fixture, not a scientific planetary simulation.

## Why Orbis?

A fantasy world is more than coastlines and country borders. It has real distances, projections, land and seafloor relief, oceans and inland water bodies, underground passages, places and histories. Orbis connects those physical locations to authored story canon.

**Orbis answers _where_ something happens and lets its author control geographic truth, independently of any other application.**

## Product principles

1. **Story-first:** geography supports writing, lore, navigation, and timelines. Do not build a game engine.
2. **One spatial world:** surface terrain and ocean bathymetry share a single elevation datum; water levels, water columns, and subsurface features have separate representations.
3. **Real scale:** planet radius, positions, distances, and elevations are in physical units, independent of how a map is projected.
4. **2D + 3D:** fast projected atlases and a rotatable 3D globe inspect the same underlying coordinates.
5. **Detail on demand:** global structure stays lightweight; generate and load detailed regions only when requested.
6. **Authored canon wins:** generated geography never silently overwrites locked landmarks, lore, or historical facts.
7. **Local-first and portable:** projects can be saved, backed up, and exchanged without an online account.
8. **Standalone first:** No Arline Studio APIs, adapters, or database integration in current milestones. Future interoperability must be separately scoped and approved; never mutate external canon silently.

## Scope at a glance

| Domain | Initial scope | Later expansion |
| --- | --- | --- |
| Planetary scale | Configurable radius, coordinate readout, distance tools | Ellipsoids, multiple exotic geometries |
| Maps | 2D equirectangular projection, globe, terrain coloring | Equal Earth, regional projections, map styles |
| Terrain | Global height/elevation model, regional inspection | Tectonics, erosion, sophisticated LOD |
| Oceans | Full seafloor elevation, shelves, ridges, trenches, bathymetric styling | Seabed generation, hydrology, water-column ecology |
| Underground | Documented depth model and stable place links | Cave networks, cross-sections, localized 3D caverns |
| Worldbuilding | Locations, labels, notes, editable/locked features | History and world-branch visualization |
| External interoperability | Portable Orbis projects and stable location IDs | Possible Arline Studio integration only after Orbis matures; unscheduled |

## Stack

- **TypeScript + Svelte 5 + Vite**, implemented for the responsive editor.
- **Three.js** for the optional, lazily loaded 3D globe; **D3-geo** for the atlas graticule/projection.
- **Vitest + Playwright** for geographic/unit tests and real browser interactions.
- **Web Workers** planned for heavy or cancellable generation; M0 generates one coarse sample on startup.
- **IndexedDB + explicit project export/import** planned for M1.
- **Rust/WASM and Tauri 2** only when profiling or native desktop packaging justifies them.
- **No Arline Studio dependency** during current development. Keep project serialization portable and identifiers stable, without building an integration adapter.

See [Architecture](docs/ARCHITECTURE.md) for boundaries and engineering decisions.

## Documentation

- [Product specification and scope](docs/PRODUCT_SPEC.md)
- [System architecture and rendering strategy](docs/ARCHITECTURE.md)
- [Proposed geographic and story data contract](docs/DATA_MODEL.md)
- [Phased roadmap and acceptance criteria](docs/ROADMAP.md)
- [Opheline implementation handoff](docs/OPHELINE_HANDOFF.md)
- [Research references and licensing caution](docs/REFERENCES.md)

## MVP target (M0 + M1)

Build a **working, offline-capable atlas prototype**: open a sample planet, switch between a 2D projected map and a 3D globe, read coordinates and distances, reveal the seafloor, add and lock a location, and export/reopen the same world **without losing authored edits**.

M0 supplies the sample planet, both views, coordinate/elevation inspection and session landmarks. Distance tools, water visibility, locks and export/reopen are **not available yet**. See the [roadmap](docs/ROADMAP.md) for the remaining M1 work.

## Relationship to Arline Studio (long-term only)

Orbis is being developed **entirely independently**. Arline Studio v1.1 is feature-frozen, and the two applications have different implementation needs. In the current Orbis roadmap there is **no integration milestone, shared database, API adapter, synchronization layer, or required Arline installation**.

Keep Orbis's saved worlds, geographic coordinates and IDs portable. In the distant future, after the standalone atlas is mature, a separately approved project could explore reviewed import/export or a compatible adapter. The dormant [future interoperability issue](https://github.com/RetrixAlfariz/Arline-Orbis/issues/7) is **not part of Opheline's active work**.

## License and inspiration

This repository's **own software license has not yet been chosen**. Before copying or vendoring external implementation code, review the upstream license and seek a deliberate licensing decision for Orbis. External projects in [references](docs/REFERENCES.md) are for research/inspiration; links do not grant blanket permission to reuse code.

---

**Project stage:** M0 prototype implemented by Opheline • **Mission:** Give every story a world.
