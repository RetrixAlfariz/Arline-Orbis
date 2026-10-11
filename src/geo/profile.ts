import { fromVector, toVector, distanceKm } from './coordinates';
import type { Coordinate } from '../core/world';
import { sampleElevation } from '../terrain/sample';
import type { ElevationRaster } from '../terrain/sample';

export interface ProfileSample extends Coordinate { distance_km: number; elevation_m: number }

/** Great-circle elevation section, independent of rendering projection. */
export function elevationProfile(raster: ElevationRaster, start: Coordinate, end: Coordinate,
  radius_m: number, count = 96): ProfileSample[] {
  if (!Number.isInteger(count) || count < 2 || count > 512) throw new Error('Invalid profile sample count.');
  const a = toVector(start), b = toVector(end);
  const cosine = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(cosine);
  const total = distanceKm(start, end, radius_m);
  // Nearly antipodal paths have no unique short arc. Use a stable perpendicular.
  const fallback = Math.abs(a[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const cross = [a[1] * fallback[2] - a[2] * fallback[1],
    a[2] * fallback[0] - a[0] * fallback[2],
    a[0] * fallback[1] - a[1] * fallback[0]];
  const length = Math.hypot(...cross);
  const perpendicular = cross.map(v => v / length);
  const result: ProfileSample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let pos: number[];
    if (omega < 1e-7) pos = a;
    else if (Math.PI - omega < 1e-6) pos = a.map((v, k) => Math.cos(Math.PI * t) * v + Math.sin(Math.PI * t) * perpendicular[k]);
    else {
      const s = Math.sin(omega);
      const left = Math.sin((1 - t) * omega) / s, right = Math.sin(t * omega) / s;
      pos = a.map((v, k) => left * v + right * b[k]);
    }
    const point = i === 0 ? start : i === count - 1 ? end : fromVector(pos[0], pos[1], pos[2]);
    result.push({ ...point, distance_km: total * t, elevation_m: sampleElevation(raster, point) });
  }
  return result;
}
