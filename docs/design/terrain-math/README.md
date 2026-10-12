# Versioned continuous terrain

The new screenshot `image(20261012-165921).png` was materialized through the current Library helper and inspected directly. Its dominant defects are long paired/tripled seafloor bands, abrupt branch junctions, cliff strips crossing continental land, and fine detail spread broadly across plains.

## Diagnosis from the legacy model

`plates.ts` uses absolute distance to the nearest plate pair. The trench is centered at `abs(distance) = 0.016 rad`, creating two mirror trenches roughly 102 km from the boundary on an Earth-radius planet. Ridge/trench/orogen formulae switch at divergence ±0.14 and continental fraction 0.85. Nearest-pair changes also switch ocean age, transform rotation and the coastline's denominator. These are elevation discontinuities; increasing pixel count cannot repair them.

The existing screenshot's outline matches the `aurelia-001` / Balanced candidate closely: approximately 97% land-mask agreement after aligning the reference raster. Other tested seeds had only 52–59% agreement. This is a strong visual match, but the user's exact preset, parameter overrides and exported project are not supplied, so these comparisons remain a representative matching candidate rather than a confirmed exact-case replay.

## M5 construction

New generation defaults to `m5-continuous-v1`; the UI explicitly offers M5 Continuous Terrain and M4 Legacy Plates. Applying a reviewed generation is required to change the saved algorithm. Existing M0/M2/M4 worlds retain their original terrain. Existing `regional-geology-v1` instructions retain M4 replay; new regional replacements use `regional-continuous-v2` and retain the old base outside their boundary.

- Plate ownership is a continuous geodesic-distance soft blend. Ocean age and continental material blend across all contributors; discrete plate IDs remain categorical metadata.
- Canonically ordered pairs use signed spherical distance, fixed ocean/subducting-side selection, one ocean-side trench, broad overriding-side uplift and continental collision belts.
- Convergence/divergence weights change smoothly. Remote pair extensions fade with zero endpoint derivative; normalized junction influence bounds uplift/trench combinations.
- Terrain is constructed on a fixed 720 × 361 reference mesh, about 55.6 km per equatorial sample on an Earth-radius world. Both Standard and High sample this same field, so neither physical erosion distance nor feature size changes with output resolution.
- Thermal relaxation uses latitude-aware spherical edge lengths, exact latitudinal band cell areas, a 0.012 slope threshold, eight steps and bounded transfer. Removed height × donor area equals deposited height × receiver area. Volume is conserved before final one-meter rounding. This is a bounded authoring heuristic, not validated tectonic/fluvial physics.
- Broad calm hills use two smooth spherical noise scales, 900/450 km. Ridged mountain crests use 600/300 km and a mountain-belt mask. Fine mountain relief uses a single 240 km cell scale and crest/belt masks. These scales remain resolvable by the 55.6 km Standard mesh; kilometer-scale rock texture is not injected into a global raster. All scales multiply by planet radius / Earth radius.
- Default detail amplitudes are 180 m hills, 850 m crests and 90 m fine relief, multiplied by existing roughness and bounded terrain masks. Controls allow separate amplitude adjustment; zero disables the corresponding detail layer. Plains remain relatively calm.

| Feature | Earth reference scale |
| --- | --- |
| Ownership blend | 180 km |
| Trench center | 180 km on ocean/subducting side |
| Trench Gaussian sigma | 160 km (~377 km FWHM) |
| Mountain-belt sigma | 220 km (~518 km FWHM) |
| Ridge sigma / rift sigma | 160 / 80 km |
| Boundary relevance fade | 1,200–2,400 km from nearest material neighborhood |

## Evidence and reproduction

Use `node scripts/compare-terrain-math.mjs` with the development server on port 4180. It renders legacy and M5 from the same seed/parameters and compares every shared Standard/High elevation, including poles and erosion. `node scripts/capture-terrain-math.mjs` captures the actual studio atlas/globe with the same seed, camera and detail settings. The terrain-specific noise controls are demonstrated through the M5 review/apply browser test.

Images: [legacy matched candidate](legacy-0.png), [M5 Standard](m5-standard.png), [M5 High](m5-high.png), [legacy studio atlas](studio-legacy-atlas.png), [M5 studio atlas](studio-continuous-atlas.png), [legacy globe](studio-legacy-globe.png), [M5 globe](studio-continuous-globe.png). Numerical output: [metrics](metrics.json).

Tests cover same-seed repeatability, shared-coordinate Standard/High equality (259,920 common samples), antimeridian/poles, finite bounded heights, boundary continuity as separation shrinks, one-sided trench profiles, continental collision uplift, mask-controlled detail, area-weighted volume conservation, protected authored content, codecs/import/export/reload and regional replay. A legacy M4 raster fixture remains SHA-256 `43675927ada3c0c3c32ef9c351a8c80c615a8d69a17fd2fb24d56f08181022d9`.

The original math was not blurred or silently modified. Switching a legacy world to M5 deliberately changes surrounding terrain and requires the existing conflict review/acknowledgement while retaining authored coordinates, elevations, geometry and locks. River routing remains the existing pipeline; it was not redesigned.

All work remains local on `design/reference-studio`; no push, merge, deployment or publication was performed. Native Library upload remains blocked by the delegated runtime's helper capabilities/authentication, as recorded in the studio delivery report.
