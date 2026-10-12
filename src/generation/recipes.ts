import { DEFAULT_OPTIONS, type GenerationOptions } from './options';
export const RECIPES: { name: string; options: GenerationOptions; sea_level_m: number }[] = [
  { name: 'Balanced', options: { ...DEFAULT_OPTIONS }, sea_level_m: 0 },
  { name: 'Archipelago', options: { ...DEFAULT_OPTIONS, plate_count: 24, continental_fraction: .2, roughness: 1.2 }, sea_level_m: 0 },
  { name: 'Continental World', options: { ...DEFAULT_OPTIONS, plate_count: 8, continental_fraction: .65, roughness: .8 }, sea_level_m: 0 },
  { name: 'Drowned World', options: { ...DEFAULT_OPTIONS }, sea_level_m: 1000 },
  { name: 'Highlands', options: { ...DEFAULT_OPTIONS, roughness: 1.5, ridge_m: 3500 }, sea_level_m: 0 },
];
export const candidateSeeds = (seed: string) => [seed.trim(), `${seed.trim().slice(0, 88)}:candidate-2`, `${seed.trim().slice(0, 88)}:candidate-3`];
