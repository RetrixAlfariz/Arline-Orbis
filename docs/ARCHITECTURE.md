# Proposed architecture

**Status: architecture proposal, not an implemented stack.** Opheline may refine internal details but should preserve the product contracts in this document.

## 1. Implementation decision

Build Orbis as an **independent browser-first TypeScript application**. Do not fork an entire fantasy map editor, do not bundle a complete game engine, and do not introduce Rust simply because it is fashionable.

Recommended initial stack:
- Vite + Svelte + TypeScript: application shell, panels, inspector, keyboard actions.
- D3-geo: projection and graticule logic for 2D atlas views.
- Canvas 2D for large raster map data; SVG selectively for vector overlays and editable handles.
- Three.js/WebGL2: optional rotatable 3D globe, with LOD as necessary.
- Web Workers and cancellable tasks: generation and CPU-intensive map processing.
- IndexedDB for local editing state + explicit export/import; keep a canonical portable project format.
- Vitest and browser-level smoke tests for geometry, persistence, UI controls and interactions.

Later, **if profiling justifies it**, optional Rust/WASM for hot algorithms and Tauri 2 for desktop packaging. Avoid a compulsory backend/server in MVP. The browser build must work without Arline running.

## 2. Boundaries

~~~text
Arline Studio (separate app; Python/FastAPI + SQLite)
        |  explicit reviewed import/export or future versioned adapter
        v
Orbis story link adapter (never silently writes canon)
        |
+-------+-----------------------+
| Orbis domain / geographic core|
| world manifest, IDs, features |
| coordinates, authored locks   |
+-------+---------+-------------+
        |         |
  projection    terrain/water/subsurface domain
        |         |
  2D Atlas      generation workers, tile cache
        \         /
         3D globe renderer
               |
       local project store
~~~

**Domain is renderer-agnostic.** Neither screen pixels nor Three.js vertices are authoritative geographic coordinates. UI selection and camera state must not become canon or persistent feature geometry.

## 3. Ground truth: coordinate system

For an initial spherical body:
- Planet radius R in meters; latitude φ and longitude λ in decimal degrees.
- Latitude domain [-90,90], longitude normalized to [-180,180).
- Positive altitude/elevation means **above** reference sea-level datum.
- Underground objects use the same altitude datum; derive depth below local ground from terrain elevation minus object altitude.
- Oceans calculate water depth using the relevant connected water body's surface elevation minus floor elevation.
- Store named locations by IDs and world/branch references, **not** by text name.
- Distances calculated on the sphere (great-circle) independent of projection, with clear units.
- Map projections are view transforms only. Handle dateline splitting/pole behavior and different coordinate orientation between raster formats and 3D textures in tests.

Spherical first, ellipsoidal or non-spherical realms later via a pluggable planetary geometry interface. Do not assert arbitrary supernatural realm shapes use ordinary planetary geodesics.

## 4. Elevation, water, and caves: distinct data

**Elevation layer:** continuous coarse global surface in meters relative to common datum, including seabed below 0 m; regional elevation tiles may add local detail.

**Water body layer:** ocean connectivity and independent water surfaces for lakes/inland seas; surface level, optional salinity, names and lore. Do not infer "ocean" from blue color alone.

**Water column layer (later):** coarse sampled temperature/light/current/biome metadata, separate from physical floor. Floating positions can have negative altitude without lying on the floor.

**Subsurface layer:** sparse graph of entrances, cave chambers, tunnel edges, shafts and local mesh footprints with 3D positions and depth ranges. One planet-wide dense voxel grid is explicitly rejected.

**Story layer:** stable IDs, names, kinds, authored/generated origin, linked external IDs, locked canonical anchors and optionally temporal/branch variants.

## 5. Procedural pipeline (incremental)

~~~text
planet settings + deterministic seed
  -> macro continental / oceanic structure
  -> coarse elevation and bathymetry
  -> optional plate boundaries and age-based ocean floor
  -> ridges, rifts, trenches, margins, seamounts
  -> weathering, sediments, watersheds, rivers
  -> climate, biomes, ecology (optional)
  -> authored overrides and locked feature constraints
  -> seam-checked map tiles / derived visuals
~~~

This is an *aspirational physically informed pipeline*, not a claim to reproduce professional geophysics. Procedural modes may prioritize plausibility over fidelity. Every stage should be inspectable and optionally disabled. Dependency order matters (e.g., climate should follow terrain and water structure).

Generated data must be reproducible from a seed + algorithm version + options. Locked authored facts survive regeneration, or changes explicitly fail with a reviewable conflict.

## 6. Rendering and performance

**Minimum view modes:** fast equirectangular atlas and selectable 3D globe. Bathymetry is a distinct style; transparent ocean water is a view switch, not geometry deletion.

Start with a modest global heightmap (e.g., 4096×2048 signed 16-bit samples ≈ 16 MiB raw) and vector overlays, **not** a 65K global texture. Sample data can initially be generated without full geological simulation.

For scale-up:
- Quadtree / cube-sphere tiles are a *future renderer optimization*, not required for first playable prototype.
- Progressive LOD and on-demand high-resolution regional tiles.
- Offscreen/vector layer culling and cache with memory budget.
- Worker-based asynchronous generation with progress, cancellation and deterministic cache keys.
- Stop continuously rendering when the scene is idle; 3D view can be activated only when needed.
- Prefer texture and mesh reuse to rebuilding them on every pointer movement.
- Avoid JS object-per-sample storage; use typed arrays where appropriate.

Performance requirements must be **measured and documented** on representative low-end and desktop hardware. Do not promise a fixed RAM footprint or FPS without benchmarks.

## 7. Storage and project portability

Initial persistence model:
- Local IndexedDB for working sessions, autosave state, and recoverable edits.
- Explicit Save/Export, Import and backup to a versioned Orbis format.
- JSON manifest + referenced binary height/tile data is the eventual portable package format; keep binary blobs out of giant JSON arrays.
- Validate imports, retain unknown optional fields where possible, and never run imported executable content.
- Metadata revision numbers and migrations must be explicit, tested and reversible via backups.
- Prefer immutable IDs for objects to keep lore links stable during re-labeling and repainting.

An initial small-world JSON-only export is acceptable to deliver the first working prototype, as long as its version and limitations are clearly labeled.

## 8. Relationship to Arline Studio v1.1

Verified upstream architecture at planning time: Arline Studio v1.1 is Python/FastAPI with SQLite, and its Library/Workspace distinguishes worlds, branches, entity families/variants, location entities, projects, manuscript and Context Stack.

Integration principles:
- **Do not change Arline Studio v1.1** for Orbis features. v1.1 is in feature freeze.
- Treat Arline Library as canon authority; Orbis owns geographic representation and provisional map features.
- Store explicit optional links: Arline world ID, branch ID, location/entity ID.
- Stage an export or API proposal; a human must approve canon changes.
- No direct cross-process SQLite table writes or shared mutable live DB.
- Plan future work for a suitable later Studio release (e.g., v1.2+) after verifying its current API and schema.
- A project is a story workspace, not the owner of global Library entities. Maintain this upstream invariant.

Integration adapters and schemas are proposed in [DATA_MODEL.md](DATA_MODEL.md).

## 9. Likely application organization

Keep MVP implementation readable rather than over-modularized:

~~~text
src/
  app/                 # UI composition and screen state
  core/                # world, feature, lore-link types; operations
  geo/                 # coords, geodesics, projections, dateline handling
  terrain/             # raster bathymetry, terrain tile operations
  subsurface/          # cave graph and depth profiles (later)
  render/atlas2d/      # canvas+svg
  render/globe3d/      # three.js
  generation/          # deterministic workers (later)
  storage/             # IndexedDB, export/import/versioning
  integrations/arline/ # explicit optional adapter (later)
tests/
docs/
~~~

This is a suggested directory map, not a requirement to create empty folders before functionality exists.

## 10. Verification requirements

- Known geodesic distances, units, and scale changes.
- Meridian wrap and pole/antimeridian placement in 2D and 3D.
- One test fixture with surface mountain, seafloor ridge, abyssal plain and trench.
- Water depth vs seafloor elevation vs below-ground cave depth are never confused.
- Seed + configuration reproducibility; authored feature locks survive regeneration.
- Save/reload fidelity for names, coordinates, IDs and locks.
- Offline loading, disabled network, invalid project import and graceful WebGL fallback.
- No Studio v1.1 schema write in Orbis.

## 11. Open design decisions

Decide with measured prototypes:
- Flat world data raster vs spherical plate mesh representation for generation.
- Compressed terrain tile/container format and high-resolution export.
- Interop interface shape for Arline (API plugin, file exchange, import assistant).
- Concrete offline strategy and maximum cache sizes.
- Multiple planets/realms in one project, portals between them, and historical branches.

Record any consequential deviation in an ADR or PR description, including its tradeoff and migration impact.
