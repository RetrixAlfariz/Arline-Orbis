import type { Coordinate } from '../core/world';
import type { ElevationRaster } from '../terrain/sample';
import { coordinate, distanceKm } from '../geo/coordinates';
import { validateOptions, type GenerationOptions } from './options';

export interface RegionalReplacement extends Coordinate {
  id: string;
  radius_km: number;
  seed: string;
  options: GenerationOptions;
  algorithm_version: 'regional-geology-v1' | 'regional-continuous-v2';
}
export const MAX_REGIONAL_REPLACEMENTS = 16;
export function validateRegions(value: unknown): RegionalReplacement[] {
  if (!Array.isArray(value) || value.length > MAX_REGIONAL_REPLACEMENTS) throw new Error('Maximum 16 regional replacements.');
  const ids = new Set<string>();
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid regional replacement.');
    const p = raw as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id || p.id.length > 100 || ids.has(p.id)) throw new Error('Invalid or duplicate regional replacement ID.');
    ids.add(p.id);
    if (p.algorithm_version !== 'regional-geology-v1' && p.algorithm_version !== 'regional-continuous-v2') throw new Error('Unsupported regional generation algorithm.');
    if (typeof p.seed !== 'string' || !p.seed.trim() || p.seed.length > 100) throw new Error('Invalid regional seed.');
    if (typeof p.radius_km !== 'number' || !Number.isFinite(p.radius_km) || p.radius_km < 1 || p.radius_km > 2500) throw new Error('Regional radius must be 1–2,500 km.');
    if (typeof p.lat_deg !== 'number' || !Number.isFinite(p.lat_deg) || p.lat_deg < -90 || p.lat_deg > 90 ||
        typeof p.lon_deg !== 'number' || !Number.isFinite(p.lon_deg) || p.lon_deg < -180 || p.lon_deg > 180) throw new Error('Invalid regional center.');
    return { id: p.id, ...coordinate(p.lat_deg, p.lon_deg), radius_km: p.radius_km, seed: p.seed,
      options: validateOptions(p.options), algorithm_version: p.algorithm_version };
  });
}

/** Blend only inside the geographic boundary. Returns the weights for derived geology. */
export function replaceRegion(base: ElevationRaster, replacement: ElevationRaster, region: RegionalReplacement, radius_m: number) {
  if (base.width !== replacement.width || base.height !== replacement.height) throw new Error('Regional raster dimensions differ.');
  const samples = new Int16Array(base.samples), weights = new Float32Array(samples.length);
  for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
    const i = y * base.width + x;
    const distance = distanceKm(region, { lat_deg: 90 - y * 180 / (base.height - 1), lon_deg: -180 + x * 360 / base.width }, radius_m);
    if (distance >= region.radius_km) continue;
    const t = Math.min(1, (region.radius_km - distance) / (region.radius_km * .2));
    const weight = t * t * (3 - 2 * t);
    weights[i] = weight;
    samples[i] = Math.round(base.samples[i] * (1 - weight) + replacement.samples[i] * weight);
  }
  return { raster: { width: base.width, height: base.height, samples }, weights };
}
