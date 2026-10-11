# Arline Orbis

> **Give every story a world.**

**Arline Orbis** is a planned, local-first, lightweight planetary atlas for storytellers. It shares the broader Arline identity, but is being designed and built as a **fully standalone application**. Direct [Arline Studio](https://github.com/RetrixAlfariz/Arline-Studio) integration is a **distant, unscheduled possibility**, not part of the current delivery plan. Its purpose is **story continuity and authoring**, not game-world simulation for its own sake.

**Status: specification / architecture baseline. No functioning editor or generator has been implemented in this repository yet.** The initial build and subsequent polish are delegated to **Opheline**. The documents here are the implementation brief, not claims of completed features.

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

## Intended stack (provisional)

- **TypeScript + Svelte + Vite** for a browser-first, responsive editor.
- **Three.js** for the optional 3D globe; **D3-geo** for map projections.
- **Web Workers** for heavy or cancellable generation.
- **IndexedDB + explicit project export/import** for the initial local-first workflow.
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

## First milestone

Build a **working, offline-capable atlas prototype**: open a sample planet, switch between a 2D projected map and a 3D globe, read coordinates and distances, reveal the seafloor, add and lock a location, and export/reopen the same world **without losing authored edits**.

This is an acceptance target, **not functionality available today**. See the [roadmap](docs/ROADMAP.md) and [GitHub Issues](https://github.com/RetrixAlfariz/Arline-Orbis/issues) for the implementation work.

## Relationship to Arline Studio (long-term only)

Orbis is being developed **entirely independently**. Arline Studio v1.1 is feature-frozen, and the two applications have different implementation needs. In the current Orbis roadmap there is **no integration milestone, shared database, API adapter, synchronization layer, or required Arline installation**.

Keep Orbis's saved worlds, geographic coordinates and IDs portable. In the distant future, after the standalone atlas is mature, a separately approved project could explore reviewed import/export or a compatible adapter. The dormant [future interoperability issue](https://github.com/RetrixAlfariz/Arline-Orbis/issues/7) is **not part of Opheline's active work**.

## License and inspiration

This repository's **own software license has not yet been chosen**. Before copying or vendoring external implementation code, review the upstream license and seek a deliberate licensing decision for Orbis. External projects in [references](docs/REFERENCES.md) are for research/inspiration; links do not grant blanket permission to reuse code.

---

**Project stage:** planning / handoff to Opheline • **Mission:** Give every story a world.
