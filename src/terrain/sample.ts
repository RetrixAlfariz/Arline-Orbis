import type { Coordinate } from '../core/world';
import { toUV, toVector } from '../geo/coordinates';

export interface ElevationRaster {
  width: number;
  height: number;
  samples: Int16Array;
}

export const SAMPLE_SITES = [
  { name: 'Crown mountain', lat_deg: 30, lon_deg: -55, description: 'A highland above the sea-level datum.' },
  { name: 'Lantern ridge', lat_deg: -15, lon_deg: 40, description: 'A raised ridge on the ocean floor.' },
  { name: 'Veil trench', lat_deg: -20, lon_deg: 105, description: 'A deep depression below the datum.' },
] as const;

function seedPhase(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 0xffffffff * Math.PI * 2;
}

function bump(point: Coordinate, lat: number, lon: number, width: number): number {
  const a = toVector(point);
  const b = toVector({ lat_deg: lat, lon_deg: lon });
  const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  return Math.exp(-((angle / (width * Math.PI / 180)) ** 2));
}

/** Original illustrative terrain. Spherical terms are continuous at the seam/poles. */
export function prototypeElevation(point: Coordinate, seed: string): number {
  const [x, y, z] = toVector(point);
  const phase = seedPhase(seed);
  const noise = 380 * Math.sin(11 * x + phase) * Math.sin(8 * z - phase) * Math.cos(9 * y)
    + 130 * Math.sin(27 * x + 13 * y + phase) * Math.cos(21 * z);
  const continents = 6900 * bump(point, 25, -65, 30) + 4800 * bump(point, -20, -80, 23)
    + 6300 * bump(point, 35, 115, 32) + 5500 * bump(point, -38, 135, 20)
    + 4000 * bump(point, 0, -5, 12);
  const mountain = 2700 * bump(point, 30, -55, 7);
  const ridge = 2700 * bump(point, -15, 40, 11) + 1800 * bump(point, 8, 42, 13)
    + 1900 * bump(point, -38, 35, 13);
  const trench = -4600 * bump(point, -20, 105, 6) - 2100 * bump(point, -2, 99, 7);
  return Math.round(-3600 + continents + mountain + ridge + trench + noise);
}

export function generateSample(seed: string, width = 720, height = 361): ElevationRaster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error('Raster dimensions must be integers >= 2.');
  }
  const samples = new Int16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      samples[y * width + x] = prototypeElevation({ lat_deg: 90 - y * 180 / (height - 1),
        lon_deg: -180 + x * 360 / width }, seed);
    }
  }
  return { width, height, samples };
}

export function sampleElevation(raster: ElevationRaster, point: Coordinate): number {
  const { u, v } = toUV(point);
  const x = u * raster.width;
  const y = v * (raster.height - 1);
  const x0 = Math.floor(x) % raster.width;
  const y0 = Math.floor(y);
  const x1 = (x0 + 1) % raster.width;
  const y1 = Math.min(y0 + 1, raster.height - 1);
  const tx = x - Math.floor(x);
  const ty = y - y0;
  const a = raster.samples[y0 * raster.width + x0] * (1 - tx) + raster.samples[y0 * raster.width + x1] * tx;
  const b = raster.samples[y1 * raster.width + x0] * (1 - tx) + raster.samples[y1 * raster.width + x1] * tx;
  return Math.round(a * (1 - ty) + b * ty);
}


/** Seed-varying fictional continents and seabed. This is NOT tectonic simulation. */
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Landform { direction: [number, number, number]; width: number; height: number }

export function generateSeededWorld(seed: string, width = 720, height = 361): ElevationRaster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error('Raster dimensions must be integers >= 2.');
  }
  const random = seededRandom(seed);
  const forms: Landform[] = [];
  for (let i = 0; i < 16; i++) {
    const lon = random() * 360 - 180;
    const lat = Math.asin(2 * random() - 1) * 180 / Math.PI;
    const continent = i < 8;
    const ridge = i >= 8 && i < 13;
    forms.push({
      direction: toVector({ lat_deg: lat, lon_deg: lon }),
      width: (continent ? 17 + random() * 22 : ridge ? 5 + random() * 10 : 4 + random() * 8) * Math.PI / 180,
      height: continent ? 4800 + random() * 5500 : ridge ? 900 + random() * 3200 : -(2500 + random() * 4000),
    });
  }
  const phase = seedPhase(seed);
  const samples = new Int16Array(width * height);
  for (let y = 0; y < height; y++) {
    const lat_deg = 90 - y * 180 / (height - 1);
    for (let x = 0; x < width; x++) {
      const lon_deg = -180 + x * 360 / width;
      const [vx, vy, vz] = toVector({ lat_deg, lon_deg });
      let elevation = -3800 + 320 * Math.sin(13 * vx + phase) * Math.cos(12 * vy - phase) * Math.sin(9 * vz)
        + 150 * Math.sin(31 * vx + 23 * vz) * Math.cos(19 * vy + phase);
      for (const feature of forms) {
        const dot = Math.max(-1, Math.min(1, vx * feature.direction[0] + vy * feature.direction[1] + vz * feature.direction[2]));
        const ratio = Math.acos(dot) / feature.width;
        if (ratio < 3) elevation += feature.height * Math.exp(-ratio * ratio);
      }
      samples[y * width + x] = Math.round(Math.max(-20000, Math.min(20000, elevation)));
    }
  }
  return { width, height, samples };
}

/** Existing Aurelia projects keep their exact original M0 terrain recipe. */
export function generatePlanet(seed: string, algorithm: 'm0-sample-v1' | 'm2-seeded-v1',
  width = 720, height = 361): ElevationRaster {
  return algorithm === 'm0-sample-v1'
    ? generateSample(seed, width, height)
    : generateSeededWorld(seed, width, height);
}
