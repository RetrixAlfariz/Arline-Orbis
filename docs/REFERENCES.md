# Inspiration and research references

These projects are **references, not Orbis dependencies by default**. Always inspect current upstream code and licenses before adapting, vendoring, distributing, or linking anything.

## Fantasy geography and editing

- **Azgaar's Fantasy Map Generator** — https://github.com/Azgaar/Fantasy-Map-Generator
  - Worldbuilding layers, settlements, culture, nations, map editing, geographic data export.
  - Especially helpful reference for rich 2D atlas UI.
- **World Orogen** — https://github.com/raguilar011095/planet_heightmap_generation
  - Spherical procedural planetary terrain, tectonic and bathymetric structure, planetary display.
  - Inspiration for geological modeling. **License implications must be checked before reuse.**
- **Red Blob Games Mapgen4** — https://github.com/redblobgames/mapgen4
  - Fast editable terrain, rivers, mesh-oriented procedural geometry.
- **Nortantis** — https://github.com/jeheydorn/nortantis
  - Illustrated map composition and visual styling.
  - **Check copyleft obligations before reusing implementation.**
- **WorldEngine** — https://github.com/Mindwerks/worldengine
  - Heightmaps, rain/temperature/biomes and simulated geography.

## Underground and scalable terrain

- **Watabou Cave/Glade Generator** — https://watabou.github.io/cave.html
  - Conceptual 2D chamber/tunnel map workflows.
- **Godot Voxel Tools** — https://github.com/Zylann/godot_voxel
  - Techniques for 3D volumetric cave terrain, not a proposed Orbis core dependency.
- **Quadtree Planet** — https://github.com/dkarpliuk/quadtree-planet
  - Experimental reference for cube-sphere quadtree LOD in Three.js.

## Geographic projection and bathymetry

- **D3-geo** — https://github.com/d3/d3-geo
  - Projection calculations and path utilities.
- **Three.js** — https://threejs.org/
  - WebGL rendering used for globe inspection.
- **GEBCO** — https://www.gebco.net/
  - Earth elevation/bathymetry reference data; verify use terms and appropriate attribution for any assets.
- **NOAA Ocean Exploration** — https://oceanexplorer.noaa.gov/
  - Ocean trenches, mid-ocean ridges, seamounts and other underwater features.
- **GPlates** — https://github.com/GPlates/GPlates
  - Inspiration for plate motions and geological reconstructions; not intended as a direct embedded dependency.

## Integration reference

- **Arline Studio** — https://github.com/RetrixAlfariz/Arline-Studio
  - Local-first writing and worldbuilding workspace. The v1.1 release line is feature frozen. Map/location interop should be a future explicit adapter.

## Third-party code policy

1. Independent reimplementation of general ideas is preferred for the initial Orbis engine.
2. When copying or transforming source code, record repository URL, exact commit, files, license, and required notices.
3. Do not assume the license of Orbis is inherited from Arline Studio or that links authorize code reuse.
4. Avoid sources without a clear license until permission is established.
5. External geographic datasets and art have their **own** use and attribution requirements, separate from code licenses.
