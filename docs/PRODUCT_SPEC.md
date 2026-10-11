# Product specification

**Stage:** product requirements baseline. The M0 atlas prototype is implemented; most capabilities below remain requirements or proposals. [M0](M0.md) records exactly what is available.

## 1. Purpose and audience

Orbis is for writers and worldbuilders who need a consistent, navigable fictional world. It must remain useful without realistic climate simulation, GPUs capable of modern games, or an Arline Studio installation.

Primary jobs:
- Establish a world's physical scale and geographically plausible structure.
- Navigate one world in 2D and 3D without changing locations.
- Create and edit meaningful geography above **and** below sea level.
- Track places relevant to the story, even after procedural regeneration.
- Distinguish lore/canon from unreviewed procedural suggestions.
- Save, reopen, and transfer a world without vendor lock-in.

## 2. Surface, sea and subsurface are peers

An ocean is **not an empty blue polygon**. Land and seafloor share a single global elevation field, with water bodies and subsurface geometry as separate layers.

### A. Surface land
Continents, islands, mountain systems, valleys, watersheds, rivers, lakes, settlements, roads, nation borders, and story markers.

### B. Oceans and inland seas
- Bathymetric relief: continental shelves, slopes, abyssal plains, mid-ocean ridges and rift valleys, fracture zones, trenches, seamounts/guyots, submarine canyons and back-arc basins.
- Editable sea level and separate levels for inland lakes, flooded basins, and artificial reservoirs.
- Cross-sections with meaningful distances and vertical units; adjustable water transparency to expose seabed relief.
- Later: tectonic plausibility, shallow/deep water biomes, simplified current and temperature layers.
- Distinguish *seafloor elevation* (relative to a datum) from *water depth* (water surface minus floor). Neither is a cave depth.

### C. Underground and sub-seafloor
- 2D depth slices and local cross-section views for cave chambers, tunnels, vertical shafts, underground lakes, settlements, and portal/connection markers.
- Connection graph and stable spatial anchors; optional localized 3D cave meshes much later.
- No requirement to voxelize the entire planet or simulate subsurface fluid dynamics.

### D. Story metadata
Location name, type, description, links to Arline entity/world/branch IDs, historical states, author-defined significance, provenance, and locks. A geography edit should not silently rewrite story canon.

## 3. Maps and coordinate systems

Minimum capabilities:
- Configure spherical planet radius in **meters**, sea-level datum, axial tilt and optional descriptive physical properties.
- Latitude [-90°, +90°], longitude normalized to [-180°, +180°); positive elevations above the reference datum.
- Equirectangular projected map and rotatable 3D globe from **the same** georeferenced source.
- Coordinate readout, scale bar, physically meaningful distance measurements (great-circle/geodesic on spherical model).
- Correct antimeridian wrapping and stable polar behavior.
- Proposed later projections: orthographic 2D, Equal Earth, azimuthal equidistant, appropriate regional projections.
- Projection choice changes *display*, not stored positions, physical extent, or distance calculations.

Authoring requirement: new features should support geographic anchoring (point, polyline, polygon, region or subsurface node) without depending on screen pixels.

## 4. Experience and primary workflows

### Workflow A: create and inspect
1. Create/open a world and select a named seed or sample planet.
2. Set radius/scale and optional planetary properties.
3. Inspect the map in 2D; switch to the globe without losing selection.
4. Click a position to inspect coordinates, elevation, and water depth where relevant.
5. Measure distance between two places in kilometers.

### Workflow B: edit geographic/story features
1. Create a location/landmark or editable region.
2. Tag its source as authored or generated and provide descriptive lore.
3. Lock an authored feature.
4. Regenerate an **unlocked** geographical layer.
5. Confirm authored IDs/anchors survived and conflicting generated results are **reported**, not silently accepted.

### Workflow C: inspect the ocean
1. Enable bathymetry shading and hide or fade the water surface.
2. Locate a submarine ridge, deep basin, and trench in sample terrain.
3. Inspect elevation and a local cross-section; compare depth with the sea-level datum.
4. Add a location on the seabed or a marker in the water column.

### Workflow D: inspect underground (post-MVP)
1. Choose surface / bathymetry / underground layer.
2. Move between depth slices and see a local vertical cross-section.
3. Trace chamber/tunnel links, entrances and exits.
4. Anchor a city or plot event at a consistent 3D position.

### Workflow E: portable, standalone story work

1. Save a complete project and export it to a portable format.
2. Open it without any connection to Arline Studio or cloud infrastructure.
3. Share or back up the project while preserving its geographic IDs, scale, authored metadata and edits.
4. Optionally maintain local story notes, character/place associations and timeline variants inside Orbis itself.

**Arline integration is specifically deferred and is not a deliverable of any current milestone.**

## 5. Priorities

| Priority | Requirement |
| --- | --- |
| P0 | A real runnable atlas (not only diagrams), 2D + 3D globe, stable geographic coordinates |
| P0 | Planet radius/scale, geodesic measurement, map/projection consistency |
| P0 | Render both land and seafloor; a useful bathymetry mode with sample trench and ridge |
| P0 | Place/edit/lock locations; portable save/load and safe edit persistence |
| P0 | Responsive navigation, no generation on every frame, graceful low-detail mode |
| P1 | Terrain and seabed painting with authored override precedence |
| P1 | Richer map projections, regional tiled detail, cross-section inspection |
| P1 | Underground network with explicit depth and surface entrance links |
| P1 | Standalone lore/place metadata and explicit author-controlled variants; no external adapters |
| P2 | Tectonic, climate and hydrology algorithms; water columns / deep-ocean biomes |
| P2 | Historical map states, conditional/fantasy geography, specialized realms |
| P2 | Optional Tauri desktop and selectively optimized Rust/WASM kernels |

**Deferred / unscheduled (not P0–P2):** investigate optional Arline Studio interoperability *only after* Orbis is independently usable, stable, and portable. No compatibility implementation is authorized by this specification.

P0 must be deliberately small. **Do not attempt full planetary geology or a voxel game before completing P0.**

## 6. Non-goals

- First-person real-time exploration, NPCs, combat, game physics.
- Full Navier–Stokes oceans, global fluid simulation, planet-wide voxel storage.
- High-resolution geometry for areas that are not visible.
- Fully scientifically validated tectonics or meteorology in the first releases.
- Any Arline Studio adapter, synchronization feature, or direct database integration during current milestones, including implicit editing of Arline's Library.
- Mandatory online account, always-on server, cloud database, or model inference.

## 7. Data and author safety

- Local-first; explicit backup/export and imports with version checks.
- Strong separation between generated output, authored overrides, and branch/time variants.
- Undo/redo (or reversible edit history) before advanced generation editors.
- Do not discard authored material when a generator seed, planet radius, sea level, or projection changes; warn where transformations require review.
- No implicit writing to Arline Studio v1.1 database.
- Sample assets should use original or appropriately licensed data.

## 8. Product decision tests

A feature is justified if it helps a writer answer: **where is this, how far/deep is it, what connects to it, what changed, and which facts are canon?** If not, it probably belongs in a future plugin rather than the MVP.
