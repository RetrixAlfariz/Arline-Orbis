import { describe, expect, it } from 'vitest';
import { applyTerrainStrokes, strokeTouches, validateTerrainStroke } from '../../src/terrain/sculpt';
import { elevationProfile } from '../../src/geo/profile';
import { generateSample, generateSeededWorld, sampleElevation } from '../../src/terrain/sample';
import { decodeProject, newProject } from '../../src/core/project';

describe('M2 authored terrain and world portability', () => {
  it('raises and lowers terrain without mutating a deterministic source', () => {
    const source = generateSample('aurelia-001', 360, 181);
    const position = { lat_deg: -20, lon_deg: 105 };
    const before = sampleElevation(source, position);
    const changed = applyTerrainStrokes(source, [{
      id: 'trench-1', ...position, radius_km: 600, delta_m: -1500,
    }], 6_371_000);
    expect(sampleElevation(changed, position)).toBeLessThan(before - 1400);
    expect(sampleElevation(source, position)).toBe(before);
    expect(applyTerrainStrokes(source, [{ id: 'trench-1', ...position, radius_km: 600, delta_m: -1500 }], 6_371_000).samples)
      .toEqual(changed.samples);
  });

  it('paints across the antimeridian, preserves polar symmetry, and detects locked anchors', () => {
    const raster = generateSample('aurelia-001', 360, 181);
    const stroke = { id: 'seam', lat_deg: 0, lon_deg: 179.5, radius_km: 500, delta_m: 800 };
    const edited = applyTerrainStrokes(raster, [stroke], 6_371_000);
    for (const longitude of [-179, 179]) {
      expect(sampleElevation(edited, { lat_deg: 0, lon_deg: longitude }))
        .toBeGreaterThan(sampleElevation(raster, { lat_deg: 0, lon_deg: longitude }) + 300);
    }
    expect(strokeTouches({ lat_deg: 0, lon_deg: -179 }, stroke, 6_371_000)).toBe(true);
    expect(strokeTouches({ lat_deg: 0, lon_deg: 15 }, stroke, 6_371_000)).toBe(false);
    const pole = applyTerrainStrokes(raster, [{ id: 'pole', lat_deg: 90, lon_deg: 40, radius_km: 400, delta_m: -200 }], 6_371_000);
    expect(sampleElevation(pole, { lat_deg: 90, lon_deg: -150 })).toBe(sampleElevation(pole, { lat_deg: 90, lon_deg: 45 }));
  });

  it('rejects malformed edits and oversized or duplicate stroke collections', () => {
    expect(() => validateTerrainStroke({ id: 'bad', lat_deg: 91, lon_deg: 0, delta_m: -5, radius_km: 30 })).toThrow();
    expect(() => validateTerrainStroke({ id: 'bad', lat_deg: 0, lon_deg: 0, delta_m: 0, radius_km: 30 })).toThrow();
    const v2 = { ...newProject(), version: 2, terrain_strokes: [{ id: 'one', lat_deg: 0, lon_deg: 0, delta_m: -100, radius_km: 50 }] };
    const decoded = decodeProject(v2);
    expect(decoded.version).toBe(2);
    expect(decoded.terrain_strokes?.length).toBe(1);
    expect(decodeProject(JSON.stringify(decoded))).toEqual(decoded);
    expect(() => decodeProject({ ...v2, terrain_strokes: [v2.terrain_strokes[0], v2.terrain_strokes[0]] })).toThrow(/Duplicate/);
    expect(() => decodeProject({ ...v2, terrain_strokes: undefined })).toThrow();
    // Pre-M2 files remain importable and do not acquire an incompatible version.
    const legacy = decodeProject(newProject());
    expect(legacy.version).toBe(1);
  });

  it('creates different geography for different seeds and stable reruns', () => {
    const a = generateSeededWorld('north-chronicle', 90, 46);
    expect(generateSeededWorld('north-chronicle', 90, 46).samples).toEqual(a.samples);
    expect(generateSeededWorld('other-chronicle', 90, 46).samples).not.toEqual(a.samples);
  });

  it('returns a geodesic cross section with correctly scaled length and endpoints', () => {
    const raster = generateSample('aurelia-001', 360, 181);
    const start = { lat_deg: -20, lon_deg: 105 }, end = { lat_deg: -20, lon_deg: 135 };
    const points = elevationProfile(raster, start, end, 6_371_000, 32);
    expect(points).toHaveLength(32);
    expect(points[0].elevation_m).toBe(sampleElevation(raster, start));
    expect(points[31].elevation_m).toBe(sampleElevation(raster, end));
    expect(points[31].distance_km).toBeGreaterThan(3000);
    expect(elevationProfile(raster, start, end, 3_185_500, 32)[31].distance_km).toBeCloseTo(points[31].distance_km / 2);
  });
});
