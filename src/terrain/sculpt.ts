import type { Coordinate } from '../core/world';
import type { ElevationRaster } from './sample';
import { coordinate, distanceKm } from '../geo/coordinates';

/** Author-owned elevation delta anchored to geography, never to a rendered pixel. */
export interface TerrainStroke extends Coordinate {
  id: string;
  radius_km: number;
  delta_m: number;
}
export const MAX_TERRAIN_STROKES = 256;
const MAX_ABS_ELEVATION = 20_000;

export function validateTerrainStroke(value: unknown): TerrainStroke {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid terrain stroke.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id.length < 1 || raw.id.length > 100) throw new Error('Invalid terrain stroke ID.');
  if (typeof raw.lat_deg !== 'number' || typeof raw.lon_deg !== 'number') throw new Error('Invalid terrain stroke coordinates.');
  const point = coordinate(raw.lat_deg, raw.lon_deg);
  if (typeof raw.radius_km !== 'number' || !Number.isFinite(raw.radius_km) || raw.radius_km < 1 || raw.radius_km > 2500) {
    throw new Error('Terrain brush radius must be between 1 and 2,500 km.');
  }
  if (typeof raw.delta_m !== 'number' || !Number.isFinite(raw.delta_m) || !Number.isInteger(raw.delta_m) ||
    raw.delta_m === 0 || Math.abs(raw.delta_m) > 3000) {
    throw new Error('Terrain brush change must be a nonzero integer within ±3,000 m.');
  }
  return { id: raw.id, ...point, radius_km: raw.radius_km, delta_m: raw.delta_m };
}

/** Geodesically circular, smooth-edged stroke; the input raster is never mutated. */
export function applyTerrainStrokes(base: ElevationRaster, strokes: TerrainStroke[], radius_m: number): ElevationRaster {
  if (!Number.isFinite(radius_m) || radius_m <= 0) throw new Error('Invalid planet radius.');
  if (strokes.length > MAX_TERRAIN_STROKES) throw new Error('Too many authored terrain strokes.');
  const samples = new Int16Array(base.samples);
  const { width, height } = base;
  const longitudes = Array.from({ length: width }, (_, x) => (-180 + x * 360 / width) * Math.PI / 180);
  const seen = new Set<string>();

  for (const input of strokes) {
    const stroke = validateTerrainStroke(input);
    if (seen.has(stroke.id)) throw new Error('Duplicate terrain stroke ID.');
    seen.add(stroke.id);
    const lat0 = stroke.lat_deg * Math.PI / 180;
    const lon0 = stroke.lon_deg * Math.PI / 180;
    const radius = Math.min(Math.PI, stroke.radius_km * 1000 / radius_m);
    const limit = Math.cos(radius);
    const sin0 = Math.sin(lat0), cos0 = Math.cos(lat0);
    const low = Math.max(-90, stroke.lat_deg - radius * 180 / Math.PI);
    const high = Math.min(90, stroke.lat_deg + radius * 180 / Math.PI);
    const yStart = Math.max(0, Math.ceil((90 - high) / 180 * (height - 1)));
    const yEnd = Math.min(height - 1, Math.floor((90 - low) / 180 * (height - 1)));

    for (let y = yStart; y <= yEnd; y++) {
      const lat = (90 - y * 180 / (height - 1)) * Math.PI / 180;
      const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
      for (let x = 0; x < width; x++) {
        const dot = Math.max(-1, Math.min(1, sinLat * sin0 + cosLat * cos0 * Math.cos(longitudes[x] - lon0)));
        if (dot <= limit) continue;
        const ratio = Math.acos(dot) / radius;
        const falloff = 1 - ratio * ratio * (3 - 2 * ratio);
        const index = y * width + x;
        samples[index] = Math.round(Math.max(-MAX_ABS_ELEVATION,
          Math.min(MAX_ABS_ELEVATION, samples[index] + stroke.delta_m * falloff)));
      }
    }
  }
  return { width, height, samples };
}

/** Protect an authored, locked anchor from unreviewed changes under that location. */
export function strokeTouches(point: Coordinate, stroke: TerrainStroke, planetRadius_m: number): boolean {
  return distanceKm(point, stroke, planetRadius_m) < stroke.radius_km;
}
