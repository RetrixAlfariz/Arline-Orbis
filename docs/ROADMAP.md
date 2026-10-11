# Roadmap and engineering acceptance

**Status:** implementation is not started. This roadmap is a sequence of achievable increments, not a promise of dates.

## M0 — Foundation and clickable prototype [P0]

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
- Versioned reviewed export proposal for a future Arline Studio adapter.

Accept when:
- A subsurface chamber can be placed at precise depth and located from its entrance.
- Ocean/seabed vs cave altitude are disambiguated in data and UI.
- World/branch/entity references remain stable and nothing silently writes to Arline Studio.

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

## M5 — Packaging and Arline integration [P2]

Deliver:
- Optional desktop packaging (Tauri if justified).
- Explicit, reviewed integration with a compatible future Arline Studio release.
- Backup/restore and conflict migration tests.
- Accessibility, benchmark reports, refined UI, release documentation.

Accept when:
- Orbis can run standalone.
- The user sees and approves any proposed change to Arline's Library.
- The integration leaves legacy v1.1 data intact.

## Backlog prioritization rules

1. **Never start advanced geology before M0/M1 is usable.**
2. Save/restore and authored-canon protection precede regeneration complexity.
3. Use profiling to justify WASM, Rust, tiling complexity or native packaging.
4. A feature requested for lore continuity outranks photorealistic presentation.
5. Break milestone work into small PRs, each with an executable demo and tests.

Track actionable work in [issues](https://github.com/RetrixAlfariz/Arline-Orbis/issues); avoid treating this document as an automatically checked task list.
