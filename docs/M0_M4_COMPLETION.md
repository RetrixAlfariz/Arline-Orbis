# M0–M4 implementation and acceptance

This release implements the standalone, story-oriented functionality associated with issues #1–#6. It extends the existing M0/M1 and incremental M2 code. It does not access Arline Studio, alter its databases, or schedule issue #7. **M5 distribution and broad platform hardening remain separate.**

The geology, climate and caves are intentionally **heuristic authoring systems**, not validated geophysical, fluid-dynamics or volumetric game simulations. The bounded defaults below are part of the release contract.

## Acceptance map

| Issue / milestone | Implementation | Verification |
| --- | --- | --- |
| #1 M0 atlas foundation | Shared spherical coordinates, original Aurelia sample, local build and no required external service | Existing M0 browser and coordinate regressions retained |
| #2 M0/M1 globe and scale | Radius-based geodesics, pole/dateline behavior, 2D/globe selection, graceful WebGL fallback | M0/M1 coordinate, browser and context-loss tests |
| #3 M1 bathymetry | Signed seabed, explicit sea datum, visual water toggle, depth styling and profiles; M4 adds relief categories and basin data | Terrain, water-depth, hydrology and measured-profile tests |
| #4 M1 persistence | Stable IDs, locks, local autosave, bounded undo/recovery, legacy import, validated v3 JSON and compressed `.orbis` export | Persistence/conflict tests plus v3, decompression cap and offline browser round-trip |
| #5 M2/M3 editing and underground | Points/lines/polygons/regions/lakes with lore and eras; projections; geodesic lock protection; chamber/entrance/settlement nodes and tunnel/shaft/portal edges, slices, sections and routes | Unit and real browser feature, lake, cave, projection, export and reload workflows |
| #6 M4 procedural systems | Seeded plates, parameterized seafloor, erosion/sediment, drainage, climate/biomes, cancellable worker preview with reviewed apply, regional tiles and local cave 3D | Determinism, stage toggles, drainage invariants and cache tests; browser cancellation, heartbeat, conflict review and regional loading |

Issue #1 was already closed before this work. This delivery retains its regressions rather than claiming it was implemented anew.

## Geographic features and projections

Under **Map features & lore**, create a point, polyline, polygon or region. Enter `latitude, longitude`, one vertex per line, or collect vertices by clicking the atlas after **Start drawing**. Save a name, classification, description, tags, story-reference strings and optional local era.

Save applies a reversible project edit. Lock prevents accidental editing/deletion and overlapping sculpt strokes. Projection controls offer **equirectangular, Equal Earth, orthographic and regional azimuthal equidistant** displays without rewriting stored coordinates. SVG export includes the local raster and visible vectors, not remote map tiles.

Polygons use a small-area spherical winding convention. Holes, multipolygons and full topological repair are not provided. Story references are author-written strings; they do not trigger integration. Eras are non-destructive visibility scopes, not full historical-border simulation or semantic world branching.

Authored lakes have their own surface altitude. The inspector distinguishes **sea level**, **local water surface**, **terrain elevation** and **water depth**. A lake polygon is an author-defined extent, not an automatically solved hydrological shoreline.

## Underground authoring

Choose **Underground**. Place an entrance, chamber or settlement at a geographic coordinate and a depth below sampled ground. Existing nodes can be moved by explicit latitude, longitude and altitude. Radius and height describe an envelope around the anchor; depth refers to that anchor, not an inferred cave floor.

Connect nodes with tunnels, shafts or fictional portals. Locks protect nodes and connected locked passages. Route queries minimize approximate segment length. Portals contribute zero physical distance and are counted separately; this is not a travel-time model.

The section's horizontal axis is distance from the first visible node, with ground and depth guides. It is not a straight geological slice through an arbitrary branching network. Depth slices highlight chamber envelopes intersecting the selected altitude. Local 3D displays envelopes and passage geometry on demand, without allocating planet-wide voxels or implementing a walkable interior.

**Suggest cave network** produces a deterministic proposal; **Accept cave proposal** commits it. A chamber at altitude −2,000 m beneath +500 m ground reports 2,500 m below ground. Flood surfaces and lore/era metadata are separate fields.

## Planetary generation

Open **Planetary generation · M4**, choose parameters and **Preview generation**. A module worker reports stages; **Cancel generation** terminates it without changing the active project.

Preview is not canon. Changed terrain at authored anchors is listed for review. **Apply generated world** changes the recipe while retaining authored coordinates, elevations, geometry IDs and locks. Editing the project during preview invalidates it. Imported M4 worlds reconstruct in a worker; editing waits for the correct dataset.

The recipe includes:

- Seeded spherical plate regions and boundary-motion heuristics, distinct from a perturbed continental-material field that determines coasts.
- Ocean depth related to approximate crustal age; parameterized ridge uplift, central rifts, convergent trenches, transform scars and volcanic seamounts.
- Optional thermal relaxation and sediment accumulation. This is a discrete operator, not a calibrated erosion timescale.
- Optional priority-flood basins, acyclic drainage parents, accumulation, lake levels and up to 80 displayed river paths.
- Optional latitude/elevation/moisture-based temperature, rainfall and biomes, not circulation simulation.

Derived arrays reproduce for the same **algorithm version + seed + options + resolution + ordered strokes**. Runtime timings are not deterministic. Original M0/M2 recipes remain available unchanged.

Disconnected sub-sea basins currently use the selected sea level. Tides, dynamic water balance, ocean currents, fine submarine canyons, plate-history reconstruction and scientifically calibrated climate are not implied by this release.

## Regional detail

**Regional detail** loads only the selected geographic tile, progressively at **33, 65 and 129 samples per side**. Zoom selects a finer address. LRU eviction enforces an **8 MiB typed-array budget**. Adjacent tiles and coincident LOD samples evaluate the same spherical residual field, including the antimeridian.

This is a regional equirectangular demand-paged viewer, **not a seamless global cube-sphere LOD renderer**. Fine relief is a visualization added to the global base raster. The main inspector and authored anchors retain base elevation. Sub-raster regional sculpting and independently stored high-resolution authored patches are not implemented.

## Project safety and compatibility

| Contract | Current behavior |
| --- | --- |
| Format | `orbis-project`, version 3 when new authoring/M4 data is present |
| Existing files | v0 migrates as before; v1/v2 remain readable without silently changing their generator |
| New collections | `features`, `caves.nodes`, `caves.edges`, `eras`, optional `generation_options` |
| Terrain edits | Ordered geographic `terrain_strokes`, not a giant embedded raster |
| Compressed file | `.orbis` is gzip-compressed validated JSON, **not ZIP** |
| Input cap | 2,000,000 bytes uncompressed; streaming decompression stops at the same cap |
| Object caps | 1,000 landmarks, drafts, features and cave nodes; 2,000 edges; 100 eras; 256 terrain strokes |
| Feature geometry | 2,048 vertices per feature, also subject to the project byte cap |
| Terrain presets | 360×181, 720×361, 1440×721 |
| Local cave 3D | First 256 visible nodes; the full graph remains saved |
| Recovery | Existing 30-edit history and 30 recovery backups |

Old builds reject new format versions rather than silently dropping fields. Export backups before updating or replacing important worlds. IndexedDB autosave is origin-specific and may be cleared by the browser. Saved feature/cave records persist; unfinished forms still require their explicit Save button.

Locks protect direct edits and brush intersections, including the interiors of long line segments. Regeneration never silently moves author records, but underlying terrain can change after explicit review. Accepted geography may make a fixed location physically implausible; the author must review that consequence.

## Production offline behavior

The production build emits a manifest, original SVG icon and versioned service worker. After the first successful load and **Offline ready**, app assets, lazy globe and workers are cached for offline reload. Development mode deliberately does not register it. This does not provide `file://` launch or a native desktop installer.

Only owned public build assets use cache-first behavior. Static cache updates do not delete IndexedDB. A new build waits for older clients to close rather than forcibly replacing their app. Cache eviction remains possible; keep portable backups.

## Validation and measured performance

On implementation HEAD `bbe171df9bfa5f0ac497b8726ca8175334546ed5`, the [quality verification run](https://github.com/RetrixAlfariz/Arline-Orbis/actions/runs/38195726366) passed:

- Svelte/TypeScript: **0 errors, 0 warnings**.
- **53 unit tests**, 7 test files.
- Production build.
- **22 production Chromium browser tests**, including all prior M0/M1/M2 scenarios.

The workflow checked out its transport commit, applied the checksum-verified original patch, recorded the above implementation HEAD, removed all temporary transport files and tested that resulting source. Subsequent PR checks independently validate the final branch.

New browser coverage includes saved geometry/lakes, caves, projection switching, generation cancellation and conflict review, regional loading, offline reload of lazy globe assets, and compressed project round-trip. Screenshots are captured from the running app, not generated mockups.

### Browser worker sample

The evidence artifact records Linux Chromium 156.0.8078.4 on a 4-logical-CPU GitHub runner reporting AMD EPYC 7763 and 15.61 GiB RAM. At 360×181, generation took approximately **705 ms**, with **50 main-thread heartbeat callbacks** during generation. End-to-end workflow time was 9,957 ms, including preview/apply/export/screenshot/reload; that is not generator latency. WebGL testing used software rendering, not a hardware GPU.

### Local CPU-kernel sample

Linux Node 22.16.0, Intel Xeon Platinum 8573C environment, 5 reported logical CPUs, approximately 5.81 GiB visible memory. Seed `orbis-complete-42`, 14 plates, optional stages enabled:

| Resolution | Single kernel sample | Derived numeric arrays |
| --- | ---: | ---: |
| 360×181 | about 398 ms | 2,019,960 bytes |
| 720×361 | about 850 ms | 8,057,520 bytes |

These are Node/Vite SSR kernel measurements, not FPS, peak application RAM or low-end laptop guarantees. Array totals exclude JS objects, strings, canvas, browser, GPU, temporary buffers and compiler. Broad real-device testing remains M5. Repeat with `node scripts/benchmark-m4.mjs output.json`.

The lazy Three.js module retains Vite's >500 kB advisory. No warning threshold was hidden.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
ORBIS_E2E_PREVIEW=1 npm run test:e2e
npm run preview
```

On PowerShell set `$env:ORBIS_E2E_PREVIEW='1'` before the browser-test command. Initial installation needs network access. M5 should expand hardware-GPU, Firefox/Safari, accessibility and deployment coverage.
