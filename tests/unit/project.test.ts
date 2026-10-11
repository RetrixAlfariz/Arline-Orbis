import { describe, expect, it } from 'vitest';
import { decodeProject, newProject, waterDepth } from '../../src/core/project';
import { createLandmark } from '../../src/core/world';
import { coordinate, distanceKm } from '../../src/geo/coordinates';

describe('M1 project portability and numeric contracts', () => {
  it('round-trips authored IDs, locks, elevations, scale, drafts and optional metadata', () => {
    const project = newProject();
    project.planet.radius_m = 3_000_000;
    project.planet.sea_level_m = 125;
    project.landmarks = [{ ...createLandmark('Seam station', { ...coordinate(-20, 180), altitude_m: -7000 }, 'station-1'), locked: true }];
    project.drafts = [{ ...coordinate(90, 35), name: 'North draft', altitude_m: 120 }];
    project.notes = { owner: 'Vian' };
    expect(decodeProject(JSON.stringify(project))).toEqual(project);
  });
  it('migrates version 0 without losing the original or optional metadata', () => {
    const legacy = { ...newProject(), version: 0, landmarks: [createLandmark('Old station', { ...coordinate(0, 10), altitude_m: -923 }, 'legacy')] };
    const migrated = decodeProject(legacy);
    expect(migrated.version).toBe(1);
    expect(migrated.landmarks[0].locked).toBe(false);
    expect(migrated.migration_source).toEqual(legacy);
    expect(decodeProject(JSON.stringify(migrated))).toEqual(migrated);
  });
  it.each([
    (p: ReturnType<typeof newProject>) => { p.version = 5 as 1; },
    (p: ReturnType<typeof newProject>) => { p.planet.radius_m = NaN; },
    (p: ReturnType<typeof newProject>) => { p.planet.sea_level_m = 20001; },
    (p: ReturnType<typeof newProject>) => { p.selection.lat_deg = 91; },
    (p: ReturnType<typeof newProject>) => { p.planet.algorithm_version = 'future' as 'm0-sample-v1'; },
    (p: ReturnType<typeof newProject>) => { p.landmarks = [{ ...createLandmark('A', { ...coordinate(0, 0), altitude_m: 0 }, '1'), locked: 'yes' as unknown as boolean }]; },
    (p: ReturnType<typeof newProject>) => { const mark = createLandmark('A', { ...coordinate(0, 0), altitude_m: 0 }, '1'); p.landmarks = [mark, { ...mark, id: '2' }]; },
  ])('rejects unsupported, malformed and ambiguous projects', (modify) => {
    const project = newProject(); modify(project); expect(() => decodeProject(project)).toThrow();
  });
  it('rejects oversized imports and does not mutate input while validating', () => {
    expect(() => decodeProject(' '.repeat(2_000_001))).toThrow(/2 MB/);
    const project = newProject(); const original = JSON.stringify(project);
    decodeProject(project); expect(JSON.stringify(project)).toBe(original);
    expect(() => decodeProject({ ...project, version: 0, notes: 'a'.repeat(1_100_000) })).toThrow(/2 MB/);
  });
  it('keeps seabed elevation fixed when sea level changes and dries exposed terrain', () => {
    expect(waterDepth(-923, 0)).toBe(923);
    expect(waterDepth(-923, 125)).toBe(1048);
    expect(waterDepth(-7511, 0)).toBe(7511);
    expect(waterDepth(5302, 0)).toBe(0);
    expect(waterDepth(-923, -1000)).toBe(0);
  });
  it('measures shortest spherical distances across seams and poles and scales with radius', () => {
    const radius = 6371000;
    expect(distanceKm(coordinate(0, 0), coordinate(0, 90), radius)).toBeCloseTo(Math.PI * radius / 2000, 8);
    expect(distanceKm(coordinate(0, 179), coordinate(0, -179), radius)).toBeCloseTo(222.389853, 5);
    expect(distanceKm(coordinate(90, 100), coordinate(90, -120), radius)).toBeCloseTo(0, 8);
    expect(distanceKm(coordinate(90, 0), coordinate(-90, 180), radius)).toBeCloseTo(Math.PI * radius / 1000, 8);
    expect(distanceKm(coordinate(0, 0), coordinate(0, 90), radius / 2)).toBeCloseTo(Math.PI * radius / 4000, 8);
    expect(() => distanceKm(coordinate(0, 0), coordinate(0, 0), 0)).toThrow();
  });
});
