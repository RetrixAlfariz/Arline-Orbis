import type { WorldData } from './pipeline';
export const STAGES = ['tectonics', 'terrain', 'erosion', 'edits', 'climate', 'water', 'biomes', 'review'] as const;
export type StageId = typeof STAGES[number];
export const STAGE_LABELS: Record<StageId, string> = {
  tectonics: 'Tectonics', terrain: 'Terrain', erosion: 'Erosion', edits: 'Terrain edits',
  climate: 'Climate', water: 'Water', biomes: 'Biomes', review: 'Review',
};
export interface StageFrame { id: StageId; skipped: boolean; ms: number; data: WorldData }
export const PREVIEW_LIMIT = 64 * 1024 * 1024;

export function worldBytes(data: WorldData): number {
  return data.raster.samples.byteLength + data.plates.byteLength + data.landforms.byteLength +
    data.temperature.byteLength + data.rainfall.byteLength + data.biome.byteLength + data.sediment.byteLength +
    (data.hydro ? data.hydro.parent.byteLength + data.hydro.accumulation.byteLength + data.hydro.watershed.byteLength + data.hydro.water_surface.byteLength : 0) +
    (data.hydro?.rivers.reduce((n, river) => n + river.length * 32, 0) ?? 0) + data.plate_centers.length * 64;
}

/** Independent, geographically sampled buffers; no pipeline buffer is transferred. */
export function stageCopy(data: WorldData, maxWidth = 360): WorldData {
  const width = Math.min(maxWidth, data.raster.width), height = Math.min(data.raster.height, Math.round(width / 2) + 1);
  const indices = Array.from({ length: width * height }, (_, i) =>
    Math.round(Math.floor(i / width) * (data.raster.height - 1) / (height - 1)) * data.raster.width + Math.floor(i % width * data.raster.width / width));
  return { ...data, raster: { width, height, samples: Int16Array.from(indices, i => data.raster.samples[i]) },
    plates: Uint8Array.from(indices, i => data.plates[i]), landforms: Uint8Array.from(indices, i => data.landforms[i]),
    temperature: Float32Array.from(indices, i => data.temperature[i]), rainfall: Uint16Array.from(indices, i => data.rainfall[i]),
    biome: Uint8Array.from(indices, i => data.biome[i]), sediment: Float32Array.from(indices, i => data.sediment[i]),
    timings: { ...data.timings }, options: data.options ? { ...data.options } : null,
    plate_centers: data.plate_centers.map(p => ({ ...p })),
    hydro: data.hydro ? { ...data.hydro, parent: Int32Array.from(indices, i => data.hydro!.parent[i]),
      accumulation: Float32Array.from(indices, i => data.hydro!.accumulation[i]), watershed: Int32Array.from(indices, i => data.hydro!.watershed[i]),
      water_surface: Float32Array.from(indices, i => data.hydro!.water_surface[i]), rivers: data.hydro.rivers.map(r => r.map(p => ({ ...p }))) } : null };
}
