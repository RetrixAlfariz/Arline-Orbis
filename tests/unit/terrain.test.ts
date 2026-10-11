import { describe, expect, it } from 'vitest';
import { SAMPLE_PLANET, createLandmark } from '../../src/core/world';
import { generateSample, prototypeElevation, sampleElevation, SAMPLE_SITES } from '../../src/terrain/sample';

describe('original seeded sample', () => {
  const seed = SAMPLE_PLANET.seed;
  const raster = generateSample(seed, 360, 181);

  it('reproduces elevations by seed, and a different seed changes terrain', () => {
    expect(generateSample(seed, 360, 181).samples).toEqual(raster.samples);
    expect(generateSample('another-seed', 360, 181).samples).not.toEqual(raster.samples);
    expect(() => generateSample(seed, 1, 1)).toThrow();
  });

  it('includes land, coast, raised ocean floor and a deeper trench', () => {
    const [mountain, ridge, trench] = SAMPLE_SITES.map((point) => sampleElevation(raster, point));
    expect(mountain).toBeGreaterThan(3000);
    expect(ridge).toBeGreaterThan(-2500);
    expect(ridge).toBeLessThan(0);
    expect(trench).toBeLessThan(-6000);
    expect(raster.samples.some((height) => Math.abs(height) < 50)).toBe(true);
  });

  it('is continuous across the dateline and consistent at the poles', () => {
    for (const latitude of [-90, -30, 0, 40, 90]) {
      expect(prototypeElevation({ lat_deg: latitude, lon_deg: -180 }, seed))
        .toBe(prototypeElevation({ lat_deg: latitude, lon_deg: 180 }, seed));
      expect(sampleElevation(raster, { lat_deg: latitude, lon_deg: -180 }))
        .toBe(sampleElevation(raster, { lat_deg: latitude, lon_deg: 180 }));
      expect(Math.abs(sampleElevation(raster, { lat_deg: latitude, lon_deg: -179.999 }) -
        sampleElevation(raster, { lat_deg: latitude, lon_deg: 179.999 }))).toBeLessThanOrEqual(1);
    }
    for (const latitude of [-90, 90]) {
      expect(prototypeElevation({ lat_deg: latitude, lon_deg: -120 }, seed))
        .toBe(prototypeElevation({ lat_deg: latitude, lon_deg: 60 }, seed));
    }
  });

  it('interpolates with longitude wrap and north-to-south rows', () => {
    const tiny = { width: 2, height: 2, samples: new Int16Array([10, 20, 30, 40]) };
    expect(sampleElevation(tiny, { lat_deg: 90, lon_deg: -180 })).toBe(10);
    expect(sampleElevation(tiny, { lat_deg: -90, lon_deg: 0 })).toBe(40);
    expect(sampleElevation(tiny, { lat_deg: 0, lon_deg: 90 })).toBe(25);
  });

  it('copies geographic positions and keeps identity through rename', () => {
    const position = { lat_deg: 30, lon_deg: -55, altitude_m: 4800 };
    const original = createLandmark('  Crown  ', position, 'authored-1');
    position.lat_deg = 0;
    expect(original.position.lat_deg).toBe(30);
    expect(original.name).toBe('Crown');
    const renamed = createLandmark('New Crown', original.position, original.id);
    expect(renamed.id).toBe(original.id);
    expect(renamed.position).toEqual(original.position);
    expect(() => createLandmark(' ', original.position, 'another')).toThrow();
  });
});
