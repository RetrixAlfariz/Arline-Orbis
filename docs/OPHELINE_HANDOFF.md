# Handoff to Opheline

**Owner of implementation and subsequent polish:** Opheline.

**Aestem's role in this baseline:** capture agreed intent, inspect upstream compatibility, lay out technical constraints and acceptance tests. The original handoff was specification-first. Opheline has now implemented M0 and M1; see the [M1 implementation report](M1.md) and historical [M0 report](M0.md). The remaining instructions describe the development baseline and subsequent work.

## Objective

Implement **Arline Orbis**, a **lightweight local-first 2D/3D planetary atlas for storytelling**, as a complete **standalone application**. All its worlds, authored geographic places and local lore must work independently. An Arline Studio adapter is **not** part of the development assignment.

Read, in order:
1. [README](../README.md) — mission and status.
2. [PRODUCT_SPEC](PRODUCT_SPEC.md) — writer UX and non-goals.
3. [DATA_MODEL](DATA_MODEL.md) — coordinates, water-depth distinctions, stable IDs.
4. [ARCHITECTURE](ARCHITECTURE.md) — implementation boundaries, engine choices.
5. [ROADMAP](ROADMAP.md) — milestones and testable acceptance.
6. [REFERENCES](REFERENCES.md) — technical inspiration and license cautions.

## What to implement first

Work in small reviewed PRs, starting with **M0 and M1**. Do not build full tectonics, cave voxels, AI features, Rust extensions, a desktop installer, or direct Arline DB integration before a working MVP.

A good first PR:
- Bootstraps Svelte + TypeScript + Vite and minimal tests.
- Renders a **real interactive 2D atlas** with a georeferenced sample.
- Defines shared spatial coordinate/planet types and unit tests.
- Has an end-to-end running instruction and notes current limitations.
- Does not present mock buttons or screenshot-only UI as implemented functionality.

Follow with:
- 3D globe and synchronized selection / camera projection boundary.
- Physical planet scale, great-circle measuring, seam handling.
- Land + ocean floor, depth reading, sample underwater ridge and trench.
- Offline persistence, authored place locks and export/import round trip.

## Mandatory constraints

### Worldbuilding
- Ocean bathymetry is first-class, not a flat blue ocean texture.
- Geological features should eventually include ocean basins, shelves, ridges, rifts, trenches, seamounts, and submarine canyons.
- Planet radius and latitude/longitude are authoritative; projections are view-only.
- Underground uses sparse nodes/edges and local geometry, not planet-wide volumetric storage.
- Preserve authored edits and identity when changing procedural seeds or map styles.
- Optimize for story editing, not playable open-world rendering.

### Engineering
- Default: Svelte, TypeScript, D3-geo, Three.js, Web Workers, local persistence.
- Consider alternative dependencies only with documented trade-offs, tested baseline, and compatible licenses.
- Avoid running expensive generation during every drag/frame; add cancellation, progress and fallback views.
- Use clean separation among core coordinates, renderer, generated terrain, storage, story link adapters.
- Write deterministic fixtures and tests for latitude/longitude, radius/distances, dateline/poles, altitude/depth, and save/load.
- Do not copy GPL/AGPL reference code into Orbis without an explicit licensing decision.
- Do not invent a license for this repository without owner decision.

### Independence from Arline Studio (mandatory)

Arline Studio has its own evolving architecture and v1.1 feature freeze. The integration idea is **indefinitely deferred** from Orbis's active milestones:
- Do **not** implement an Arline API adapter, importer/sync, integration UI, or Studio-specific foreign keys.
- Do **not** alter or access Arline's live database.
- Do **not** require Arline Studio to launch, save, export, or author an Orbis world.
- Keep Orbis project data versioned, stable and portable for its own users.
- Ignore the parked [future interoperability issue #7](https://github.com/RetrixAlfariz/Arline-Orbis/issues/7) unless the project owner explicitly reactivates it after standalone Orbis is mature.
- M5 is **standalone packaging and polish**, not integration.

## Quality / proof of work expected

Each milestone report should include:
1. Implemented features versus planned (clearly distinguished).
2. Commands to install, run, test and build.
3. A short reproducible demo checklist.
4. Screenshots of *running* 2D/3D/bathymetry UI once present.
5. Automated test results and any failures.
6. Performance snapshots on available hardware with render detail settings specified.
7. Next steps and remaining risks, especially data loss, projection bugs and third-party licenses.

## UX direction

Professional creative software, not a developer debug console. Immediate map feedback, sensible interaction defaults, unobtrusive inspector, clear unit display, optional advanced geology controls, accessible controls, and no extravagant animation that makes navigation sluggish.

Use original or properly licensed visuals. Polish belongs to the implementation phase after real functionality is demonstrable.

## Important unknowns to resolve during implementation

- Stable map/package format (the sample manifest is explicitly **version 0 / draft**).
- IndexedDB autosave and portable binary asset packing.
- Degree of geographic accuracy versus deliberate fantasy overrides.
- Seam/cube-sphere LOD approach after measuring initial global texture limits.
- Standalone export/import contract and backwards-compatible project migration; integration with third-party tools is outside scope.
- Orbis license.

Escalate material scope/data-safety deviations in a GitHub issue or PR. Preserve the central principle: **the author controls what is canon**.
