import { describe, expect, it } from 'vitest';
import { SphereGeometry, Vector3 } from 'three';
import { coordinate, fromUV, fromVector, normalizeLongitude, toUV, toVector } from '../../src/geo/coordinates';

describe('geographic coordinates', () => {
  it('wraps the antimeridian and rejects invalid latitude/non-finite input', () => {
    expect(normalizeLongitude(180)).toBe(-180);
    expect(normalizeLongitude(-540)).toBe(-180);
    expect(normalizeLongitude(541)).toBe(-179);
    expect(() => coordinate(91, 0)).toThrow();
    expect(() => coordinate(NaN, 0)).toThrow();
    expect(() => coordinate(0, Infinity)).toThrow();
    expect(() => fromVector(0, 0, 0)).toThrow();
  });

  it.each([[30, -55], [-15, 40], [-20, 105], [0, -180], [89.999, 179.99], [-89.999, -179.99]])(
    'preserves latitude %s and longitude %s through both view transforms', (lat, lon) => {
      const point = coordinate(lat, lon);
      const uv = toUV(point);
      const restoredUV = fromUV(uv.u, uv.v);
      expect(restoredUV.lat_deg).toBeCloseTo(lat, 10);
      expect(restoredUV.lon_deg).toBeCloseTo(lon, 10);
      const restored = fromVector(...toVector(point));
      expect(restored.lat_deg).toBeCloseTo(lat, 6);
      expect(restored.lon_deg).toBeCloseTo(lon, 6);
    });

  it('aligns actual Three sphere vertices and texture UVs with the 2D raster', () => {
    const geometry = new SphereGeometry(1, 36, 18);
    const vertices = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let index = 37; index < vertices.count - 37; index++) {
      const point = fromUV(uv.getX(index), 1 - uv.getY(index));
      const expected = new Vector3(...toVector(point));
      const actual = new Vector3().fromBufferAttribute(vertices, index);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
    }
    geometry.dispose();
  });

  it('places both geographic poles on the sphere axis', () => {
    expect(toVector(coordinate(90, 120))[1]).toBe(1);
    expect(toVector(coordinate(-90, -20))[1]).toBe(-1);
    expect(fromUV(0.7, 0).lat_deg).toBe(90);
    expect(fromUV(1, 1)).toEqual(coordinate(-90, -180));
  });
});
