# Roadmap and engineering acceptance

**Status, 2026-10-12:** M0–M4 standalone functionality is implemented in the bounded story-oriented scope below. The [acceptance report](M0_M4_COMPLETION.md) maps issues to code, tests, performance evidence and known limitations. Existing M0/M1 and early M2 behavior is retained. M5 and Arline Studio integration are not part of this completion.

## M0: foundation and clickable prototype [P0]

**Implemented, regressions retained.** Svelte/TypeScript/Vite atlas, original seeded Aurelia with land/ridge/trench, inspector, shared geographic coordinates and 2D/globe selection.

Acceptance: local development/build works without an external service; landmarks have consistent positions between views; refresh and non-WebGL fallback work; illustrative geography is not described as scientific simulation.

Historical evidence: [M0](M0.md).

## M1: geometry, sea depth, safety and portability [P0]

**Implemented, regressions retained and extended.** Radius/geodesic distance, antimeridian/poles, signed seabed vs water depth, terrain/bathymetry modes, stable authored landmarks, locks, autosave, undo/recovery, stale-tab protection and portable import/export.

Acceptance: elevation signs/depth semantics remain correct; imports and reopen retain IDs, positions and locks; errors do not silently destroy the active project. Production offline caching and bounded compressed interchange now supplement the original local workflow.

Historical evidence: [M1](M1.md).

## M2: authoring and regional cartography [P1]

**Implemented in current bounded scope.** Point/line/polygon/region/lake authoring, lore and era fields, reversible terrain/bathymetry strokes, geographic lock protection, preview conflict review, four projections, measured cross-sections, SVG map export and progressive regional tiles.

Acceptance: geographic records remain fixed under projection changes; locked places cannot be overwritten silently; unused regions do not allocate maximum detail. Regional tiles use an 8 MiB LRU cache and progressive 33/65/129 grids.

Boundaries: simple spherical polygons, no holes/multipolygons; regional residual detail is a visualization, not a whole-planet cube-sphere renderer or sub-raster authoring store. See [completion details](M0_M4_COMPLETION.md#regional-detail). The [initial M2 report](M2.md) is historical.

## M3: underground and narrative extension [P1]

**Implemented.** Sparse entrance/chamber/settlement nodes, tunnel/shaft/portal links, stable IDs, altitude/depth inspection, separate flood levels, depth slices, network sections, shortest routes, locks, local lore and era scopes. Deterministic cave suggestions require explicit acceptance; local 3D is on demand.

Acceptance: precise below-ground depth and surface anchor relationships; persistent entrance/passage IDs; geographic records survive style/projection changes; no global voxel allocation or external service.

Boundaries: 3D chamber envelopes/passages rather than walkable interiors; a network section is not a straight geological transect. Story references are local strings, and eras filter visibility rather than implementing full semantic branches/history simulation.

## M4: procedural planetary systems [P2]

**Implemented as parameterized heuristic authoring.** Seeded spherical plates/crust regions, continuous continental material field, ocean basins/age-related depths, ridges/rifts/trenches/transform scars/seamounts, optional erosion/sediment, priority-flood drainage/lakes/rivers and climate/biomes.

Generation runs in a worker with stage progress, real cancellation, reviewable preview and explicit apply. Imported M4 recipes reconstruct in a worker. Array results reproduce from version, seed, options, resolution and authored strokes. Existing canonical records are retained; changing ground beneath them requires review.

Acceptance evidence: deterministic and hydrological invariant tests, disabled-stage tests, browser cancellation and main-thread heartbeat, reviewed conflicts, cache/edge consistency and documented CPU/worker benchmarks. Low-detail generation is measured on a 4-vCPU hosted runner; broad low-end-device/hardware-GPU validation is not claimed.

Boundaries: no professional tectonic reconstruction, calibrated erosion/climate, tides/currents, fluid dynamics or infinitely detailed planet. See [model limitations](M0_M4_COMPLETION.md#planetary-generation).

## M5: standalone hardening, optimization and distribution [P2, not implemented by this delivery]

Deliver:
- Broader real-device CPU/GPU/memory measurements, low-detail tuning, Firefox/Safari testing and accessibility review.
- Optional native desktop packaging, only when justified.
- Long-lived project migrations, crash recovery, archival formats and regression expansion.
- UX refinement, sample atlases, release/deployment documentation.
- Further geographic precision, richer topology, regional authored patches and higher-quality rendering where story workflows justify them.

Accept when the independently useful application remains responsive across supported devices, existing projects upgrade safely, and distribution/backup behavior is documented and tested. Do not present one hosted Chromium run as universal validation.

## Arline Studio interoperability [deferred, unscheduled]

[Issue #7](https://github.com/RetrixAlfariz/Arline-Orbis/issues/7) remains outside M0–M5. No Studio APIs, SQLite writes, sync UI or external identity requirements were implemented. Reconsider only after explicit owner authorization and a new review of both products' then-current architecture.

## Prioritization

Protect authored data before increasing simulation complexity. Keep projections, generation, rendering and persistence separate. Profile before choosing Rust/native dependencies. Prefer story usefulness over photorealistic ornament, and record limitations rather than hiding them behind completed checkboxes.
