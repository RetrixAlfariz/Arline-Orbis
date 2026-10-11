# Data model and semantic contracts (proposed)

**Status:** design draft, not a published import schema. Opheline should implement a schema validator before declaring the format stable.

## Coordinate and unit invariants

- World/body IDs are stable and globally unique within Orbis.
- Geometry is geodetic **latitude/longitude plus altitude in meters** on a specified body, never pixel X/Y.
- Latitude: -90..90; longitude: normalized to [-180,180).
- Altitude: meters above reference level (can be negative).
- "Below local surface" = sampled terrain altitude - feature altitude.
- "Water depth" = water body's surface altitude - sampled bottom altitude, clamped to wet areas.
- Radius (meters), axial tilt (degrees), gravity (m/s²), sea level (meters) are explicit optional/required fields as appropriate.
- A projection identifier is view state; a geographic feature must not change position when map projection changes.
- Use meters for internal physical quantities; localize km/miles/fathoms only in formatting.
- Keep story timeline and planetary-geological timescales conceptually separate.

## Entity taxonomy

| Object | Geometric model | Ownership |
| --- | --- | --- |
| Planet/world body | radius, datum, configuration | Orbis |
| Terrain/bathymetry | sampled global elevation + optional tiles | Orbis |
| Water body | connected basin, surface elevation and optional water-column data | Orbis |
| Feature | point, line, polygon or region + category and metadata | Orbis |
| Underground node | geodetic anchor, altitude/depth range, chamber info | Orbis |
| Underground connection | node IDs, route, vertical extent, traversability | Orbis |
| Historical/branch state | event or variant referencing stable features | Orbis until mapped |
| Optional external reference (future) | namespaced opaque IDs, if explicitly imported | External mapping, never required for core Orbis data |

## Illustrative JSON manifest (not final file specification)

~~~json
{
  "format": "arline-orbis-world",
  "schema_version": 0,
  "world": {
    "id": "orbis-world-001",
    "name": "Example Planet",
    "body": {
      "shape": "sphere",
      "radius_m": 6371000,
      "axial_tilt_deg": 23.44,
      "sea_level_m": 0
    },
    "generation": {
      "seed": "example-seed-001",
      "algorithm_version": "prototype"
    }
  },
  "terrain": {
    "global_elevation": {
      "asset": "tiles/global-elevation.bin",
      "projection": "equirectangular",
      "width": 4096,
      "height": 2048,
      "sample_type": "int16",
      "scale_m_per_unit": 1,
      "offset_m": 0
    }
  },
  "features": [
    {
      "id": "orbis-place-001",
      "kind": "settlement",
      "name": "Example Port",
      "source": "authored",
      "locked": true,
      "position": {
        "lat_deg": -6.2,
        "lon_deg": 106.8,
        "altitude_m": 12
      },
      "external_refs": []
    }
  ],
  "water_bodies": [],
  "subsurface_nodes": [],
  "subsurface_edges": [],
  "authored_overrides": [],
  "history": []
}
~~~

All values are illustrative only. The example references a binary asset and thus represents a **package manifest**, not a standalone complete JSON project. A standalone MVP JSON export must embed or otherwise account for its elevation data and pass a round-trip test. The file/schema version 0 signals **proposal only**.

## Authorship and generation provenance

Each editable record needs, at minimum:
- Stable ID and creation/update revisions.
- Source: **authored**, **generated**, or **imported**.
- Locked status and, where relevant, generator seed/version.
- Optional Orbis-local branch/timeline scope. Do not require Arline-specific foreign IDs or adapters.
- Conflict detection when regeneration moves terrain around a locked anchor.

Regeneration must create a proposal or new generated layer, then merge following authored-lock rules. Rejected generated results must not modify canonical user edits. A change of radius or datum can invalidate coordinates/depths and must be explicitly reviewed.

## Water and subsurface semantics

Do **not** combine these into one misleading generic "depth":
- A trench floor at altitude -8,000 m under a sea surface at 0 m has water depth 8,000 m.
- A chamber at altitude -2,000 m beneath ground at +500 m has depth below surface 2,500 m.
- A marker suspended at altitude -1,000 m in an ocean does not automatically lie on the seafloor.
- Inland lakes can have water surface altitude other than zero.
- A flooded cave can have both subsurface nodes and a connected water body.

Cave graph edges may be shafts, tunnels, natural conduits or explicitly fictional portals. Portal links should not be assumed physically traversable through ordinary local space.

## Branch/history contract

Orbis's own worlds, local story variants and historical states must reference stable **Orbis feature IDs**. Historical maps should use non-destructive deltas or snapshots rather than duplicated worlds by default. Viewing a different time or branch must not silently rewrite original authored places. Do not assume a name identifies the same place across different Orbis worlds.

## External interoperability (unscheduled)

A portable, versioned Orbis project format is useful by itself. Orbis does **not** currently need knowledge of any Arline Studio world, branch, Library entity or API contract. If interoperability is considered in a distant future phase, propose an explicit optional namespaced link format and reviewed import/export contract **then**, using the current state of both applications. No integration work is in the scheduled roadmap.
