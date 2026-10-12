# Celestial studio implementation

The UI now uses the two supplied celestial-atlas references: dark navy, ivory serif labels, antique-gold framing, compass marks and restrained orbital decoration. This delivery focuses on the existing editor and the references' visual language. The second reference's world-library/universe view is not implemented. Existing geographic terrain remains authoritative.

Implemented in an isolated checkout on `design/reference-studio`, based on `b5334893bb37a953b2524bbeb1a0ae40e4627f86`. Original checkout: `E:\Developen\Github\Arline-Orbis`; it remains unchanged.

## Changes

- `src/app/App.svelte`: branded header, functional Atlas/Globe/Terrain/Lore/Fieldwork shortcuts, world texture thumbnail, viewport heading, compass ornament and panel visibility classes.
- `src/app/StudioIcon.svelte`, `celestial.svg`, `celestial.css`: original SVG iconography and orbital backdrop, navy/gold theme, serif hierarchy, map gutters, panel frames, glow and responsive layout.
- `src/app/FloatingPanel.svelte`: panel defaults and bounds updated for the taller header and narrower side panels; pointer/keyboard movement, persistence, minimize and close are retained.
- `src/main.ts`: applies the new theme after existing studio styles.
- `playwright.config.ts`, `tests/browser/m0.spec.ts`: configurable test port and matching local-origin check, allowing isolated testing without touching the existing server.
- `tests/browser/studio.spec.ts`: drag and keyboard movement, minimize/restore/reset, repeated shortcut/workshop clicks, fieldwork close, lore access and menu Escape/outside dismissal, preserving elevation.
- `scripts/capture-studio.mjs`: reproducible screenshots of the actual editor.
- `src/render/globe.ts`: a 420 ms eased camera transition on selection; pointer, wheel and keyboard input finish the transition immediately. Reduced motion bypasses it. Panels, menus and generation feedback use restrained opacity animation without moving input targets.
- `src/subsurface/generator.ts`, `CaveGenerator.svelte`, `SubsurfacePanel.svelte`: seeded connected chamber/tunnel generation with count, depth, size and extent controls. Anchors at surface selection or an existing entrance, including a locked entrance. Section/plan/3D review, inspect, discard and explicit append apply preserve all existing nodes/edges/locks. Duplicate application is rejected. Applied geometry, seed and generation settings round trip through existing cave serialization; no new project version is required.
- `src/render/relief.ts`, `terrainTexture.ts`: geographic normalization of hillshade and global contour widths, without changing elevation samples or terrain generation.
- `tests/unit/cave-generation.test.ts`, `relief.test.ts`, `tests/browser/underground-generation.spec.ts`: reproducibility, graph connectivity, seam/pole anchoring, depth/size bounds, lock preservation, duplicate rejection, serialization/import/export, stale preview invalidation, camera input interruption and reduced motion.
- `scripts/capture-underground.mjs`, `inspect-hd.mjs`: actual review screenshots and matched-seed standard/HD comparisons.

## Preview

The isolated development server runs at http://127.0.0.1:4180. Screenshots: [atlas](atlas.png), [globe](globe.png), [generation workshop](workshop.png), [mobile](mobile.png). The in-app browser could not initialize on this host (missing Windows platform directory in its launcher); visual QA used installed Playwright Chromium with software WebGL. Opening the preview in Codex was queued; do not infer that it became visible.

Underground: [controls/review](underground-controls.png), [depth section](underground-section.png), [3D chamber envelopes and tunnels](underground-3d.png). Default generation is 12 chambers, 120–800 m below each chamber's own local ground, chamber radius up to 80 m, tunnel radius 8 m, and center extent 1,200 m. This is a deterministic authoring graph, not simulated geology or a navigable voxel cave.

Initial HD investigation: [before rendering normalization](hd-before.png), [after normalization](hd-comparison.png), [matched camera/lights/geometry globe comparison](hd-globes.png), [metrics](hd-metrics.json). In legacy M4, raw Standard/High elevations matched with erosion off; with erosion on, differences reached 672 m because erosion uses fixed grid-cell thresholds. Rendering normalization was the first repair. A subsequent request authorized a versioned underlying mathematical correction: [M5 terrain construction and evidence](../terrain-math/README.md). Legacy M4 retains its original semantics; M5 generation now uses continuous plate contributions, asymmetric trenches, fixed-reference metric erosion and controlled terrain-specific noise.

## Verification

- `npm run check`: zero errors, zero warnings.
- `npm test`: 74 tests across 11 files after the terrain-math extension.
- `npm run build`: succeeds. Existing Svelte static/dynamic import and large Three.js chunk warnings remain.
- Production browser suite: 29 tests including explicit M5 review/apply/import/reload, legacy M4, studio, underground generation and motion coverage. Aggregate checks rerun after the final source changes; see final task report for exact outcome.
- Original reported `workshop.spec.ts` regional sculpt failure passed on unchanged baseline and production runs. Its assertion and terrain engine were not changed. The earlier remote failure's root cause cannot be established from the supplied assertion alone; no claim is made that a terrain bug was fixed.
- A parallel dev-server attempt was interrupted after load/timeouts under host contention. Serial production tests cover the relevant functionality, including offline reload, region replacement, sculpt/undo, authoring locks, imports/exports, cancellation and WebGL fallback.

The actual reference files resolved as `image(20261012-160737).png` and `image(20261012-160738).png`. They were materialized with the current unchanged Library transfer helper using installed WSL because Windows Python does not expose filesystem xattrs; original files and Library identity remain together in WSL. Both reference images were inspected directly before design changes.

The implementation was subsequently published to `main` with explicit user authorization. Git history and GitHub Actions record publication and CI verification. No independent deployment is part of this change.

Library attachment delivery is blocked in this delegated runtime: the required unchanged batch upload helper's hosted-app discovery returned HTTP 401 in WSL; native Windows discovery then reported `Library prepare_uploads is not available`. Both failed before preparing any upload sessions. No confirmed Library file IDs exist. The skill forbids calling prepare/finalize separately or changing a started helper flow to direct writes; no unsupported upload workaround was used.
