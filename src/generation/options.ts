import { record, finite, bool } from '../core/authoring';
export interface GenerationOptions {
  resolution: 360 | 720 | 1440;
  plate_count: number; continental_fraction: number; roughness: number;
  ridge_m: number; rift_m: number; trench_m: number; seamount_m: number;
  erosion: boolean; hydrology: boolean; climate: boolean;
  detail_m: number;
}
export const DEFAULT_OPTIONS: GenerationOptions = {
  resolution: 360, plate_count: 14, continental_fraction: 0.38, roughness: 1,
  ridge_m: 2200, rift_m: 600, trench_m: 4000, seamount_m: 2800,
  erosion: true, hydrology: true, climate: true, detail_m: 100,
};
export function validateOptions(value: unknown): GenerationOptions {
  const p = record(value);
  const plate_count = finite(p.plate_count, 4, 32);
  if (!Number.isInteger(plate_count)) throw new Error('Plate count must be an integer.');
  const resolution = finite(p.resolution ?? 360, 360, 1440);
  if (![360,720,1440].includes(resolution)) throw new Error('Unsupported detail preset.');
  return { resolution: resolution as 360|720|1440, plate_count, continental_fraction: finite(p.continental_fraction, .1, .8), roughness: finite(p.roughness, 0, 2),
    ridge_m: finite(p.ridge_m, 0, 5000), rift_m: finite(p.rift_m, 0, 2000), trench_m: finite(p.trench_m, 0, 8000),
    seamount_m: finite(p.seamount_m, 0, 6000), erosion: bool(p.erosion), hydrology: bool(p.hydrology), climate: bool(p.climate),
    detail_m: finite(p.detail_m, 0, 400) };
}
