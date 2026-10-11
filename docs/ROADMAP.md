# Roadmap and engineering acceptance

**Status:** M0 and M1 implemented and locally verified through 2026-10-12; M2 onward remains planned. This roadmap is a sequence of achievable increments, not a promise of dates. See [M1 evidence and limitations](M1.md) and the original [M0 report](M0.md).

## M0 — Foundation and clickable prototype [P0]

**Implemented.** Local development and production browser checks pass. The original M0 used session landmarks; M1 now persists them. Scientific terrain generation remains outside this milestone.

**Goal:** get a working editor rather than a huge framework of placeholders.

Deliver:
- Minimal Svelte/Vite/TypeScript project with tests and reproducible run instructions.
- Sample seeded planet dataset: visible land, coastline, undersea ridge and trench.
- Responsive two-panel interface (atlas + inspector), coordinates on pointer/selection.
- 2D equirectangular view; toggle to a rotatable 3D globe using same source.
- Select a position, set/name a landmark, inspect elevation.

Accept when:
- Local dev and production build work; no required external service.
- The same landmark is found at the same coordinate in both modes.
- Browser refresh does not throw; non-WebGL view still works.
- Documentation distinguishes prototype terrain from scientific simulation.

## M1 — Geometry, sea depth, safety and portability [P0]

**Implemented locally.** Save/reopen, portable round-trip, locks, bounded recovery, radius/distance tools, sea-level/depth semantics and shared bathymetry views are available. See [M1](M1.md) for tests, measured performance and validation limits.

Deliver:
- Radius/scale editing, kilometer geodesic distance tool, correct dateline/pole handling.
- Separate seabed elevation, wet-area water depth and sea-level state.
- Bathymetry visualization with water visibility toggle, legends and inspection.
- Author-owned location edits, locks, save/load, import/export, migration/version checks.
- Undo or recoverable edit history sufficient to protect author-entered data.
- Automated tests on units, seams, numeric depth and round-trip.

Accept when:
- A selected ridge, trench and surface mountain preserve their elevation signs.
- Water depth and cave depth aren't conflated.
- Exporting/reopening retains landmark IDs, coordinates and locks.
- No silent loss of authored information from regenerating prototype terrain.
- Measured baseline memory/interactive performance is reported.

**M0+M1 = first useful Orbis MVP.** Stop and review usability before increasing scope.

## M2 — Authoring and regional cartography [P1]

**Incremental progress:** initial standalone world creation, geodesic elevation brushes, measured elevation cross-sections, globe geometry relief, and original Natural/Survey atlas palettes are implemented in [M2](M2.md). More complete point/line/polygon tools, regional tile detail and projections remain on the roadmap.



Deliver:
- Geographic point/line/polygon brushes with undo and selected-feature inspector.
- Terrain/bathymetry authoring with regeneration conflict preview.
- Regional detail layers, tile cache and automatic LOD where profiling requires it.
- Optional additional projections: Equal Earth, orthographic and regional.
- Surface-to-seafloor cross-sections and print/export atlas views.

Accept when:
- Edits remain georeferenced while switching projections.
- Changing an unlocked generated area never silently rewrites locked places.
- Unvisited regions don't have to allocate maximum detail.

## M3 — Underground and narrative extension [P1]

Deliver:
- Sparse chamber/entrance/tunnel/shaft graph and local depth slices.
- Simple underground cross-section, local passages, underwater entrances.
- Map links to story entities and branch/time variants.
- Standalone narrative place metadata and optional Orbis-local historical/variant scopes.

Accept when:
- A subsurface chamber can be placed at precise depth and located from its entrance.
- Ocean/seabed vs cave altitude are disambiguated in data and UI.
- Orbis world, place and optional variant IDs remain stable; the app functions without external services.

## M4 — Procedural planetary systems [P2]

Deliver selectively, guided by story value:
- Plate-inspired continents and ocean basins.
- Ridge/rift/subduction trench/seamount generators.
- Basin connectivity, watersheds, rivers, lakes, optional climate and biomes.
- Deterministic seeded generation with reproducible algorithms and per-stage disabling.
- Localized 3D cave geometry only for author-selected places.

Accept when:
- Generated worlds can be recreated from seed, version and options.
- Ocean landforms are geological outputs where possible, not only painted decorations.
- Procedural results are editable and never override confirmed author canon.
- The system remains usable on a modest computer in low-detail mode.

## M5 — Standalone hardening, optimization and distribution [P2]

Deliver:
- Real-world GPU/CPU/memory benchmarks, progressive tile loading, sensible low-detail mode and graceful degradation.
- Optional standalone desktop packaging (Tauri if justified).
- Import/export compatibility, versioned migrations, crash/recovery checks and project backup/restore.
- Accessibility, keyboard navigation, refined UX, sample atlases, release documentation.
- Regression coverage for projection seams, bathymetry, locked edits and existing project compatibility.

Accept when:
- Orbis is a useful standalone worldbuilding application with no other installed services.
- Large worlds remain interactive through progressive rendering, not universal maximum-resolution allocation.
- Existing projects upgrade safely, are recoverable and can be exported without data loss.
- Release documentation, automated tests and reproducible performance baselines exist.

## Unscheduled future possibility — Arline Studio interoperability [deferred, outside M0–M5]

**Do not implement this during the active roadmap.** Arline Studio integration is intentionally a distant possibility only. It can be reconsidered when Orbis has matured as a standalone application, users have stable project files, and both product APIs and data models are sufficiently settled. Research potential reviewed import/export *only after explicit reauthorization*.

[Issue #7](https://github.com/RetrixAlfariz/Arline-Orbis/issues/7) is a parked idea, **not an active development requirement**. It has no target release date, required deliverables, or implied implementation commitment.

## Backlog prioritization rules

1. **Never start advanced geology before M0/M1 is usable.**
2. Save/restore and authored-canon protection precede regeneration complexity.
3. Use profiling to justify WASM, Rust, tiling complexity or native packaging.
4. A feature requested for standalone lore continuity outranks photorealistic presentation.
5. Break milestone work into small PRs, each with an executable demo and tests.

Track actionable work in [issues](https://github.com/RetrixAlfariz/Arline-Orbis/issues); avoid treating this document as an automatically checked task list.
