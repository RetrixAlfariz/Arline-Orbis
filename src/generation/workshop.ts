import { authoringProject, decodeProject, type Project } from '../core/project';
import type { Coordinate, Planet } from '../core/world';
import { lockedStrokeConflicts } from '../authoring/conflicts';
import { validateRegions, type RegionalReplacement } from './regions';
import { validateOptions, type GenerationOptions } from './options';
import type { WorldData } from './pipeline';
import type { SystemLayer } from '../render/systemTexture';
export interface WorkshopView {
  data: WorldData; planet: Planet; texture: HTMLCanvasElement; selection: Coordinate;
  layer: SystemLayer; label: string; final: boolean;
  region: { center: Coordinate; radius_km: number } | null;
}
export const projectFingerprint = (p: Project) => JSON.stringify({ planet:p.planet, strokes:p.terrain_strokes,
  regions:p.regional_replacements, options:p.generation_options, landmarks:p.landmarks, features:p.features, caves:p.caves, eras:p.eras });
export function proposedWorld(project: Project, seed: string, options: GenerationOptions, seaLevel: number,
  regional: { id: string; center: Coordinate; radius_km: number } | null, removed: string[], preserveBase = false, algorithm: 'm4-plates-v1'|'m5-continuous-v1' = 'm5-continuous-v1'): Project {
  if (!seed.trim() || seed.trim().length > 100) throw new Error('Enter a seed of 1–100 characters.');
  if (!Number.isFinite(seaLevel) || Math.abs(seaLevel) > 20000) throw new Error('Sea level must be between −20,000 and +20,000 m.');
  const config = validateOptions(options);
  let regions = (project.regional_replacements ?? []).filter(r => !removed.includes(r.id));
  for (const r of project.regional_replacements ?? []) if (removed.includes(r.id)) protectRegion(project,r);
  if (regional) {
    const [r] = validateRegions([{ id:regional.id, lat_deg:regional.center.lat_deg, lon_deg:regional.center.lon_deg,
      radius_km:regional.radius_km, seed:seed.trim(), options:config, algorithm_version:algorithm==='m5-continuous-v1'?'regional-continuous-v2':'regional-geology-v1' }]);
    protectRegion(project,r); regions = validateRegions([...regions,r]);
  }
  return decodeProject({ ...authoringProject(project),
    version:regional || project.version === 4 ? 4 : 3,
    ...(regional || project.version === 4 ? {regional_replacements:regions} : {}),
    planet:{...project.planet,sea_level_m:seaLevel,...(!regional && !preserveBase ? {seed:seed.trim(),algorithm_version:algorithm} : {})},
    generation_options:config });
}
function protectRegion(project:Project,r:RegionalReplacement) {
  const names=lockedStrokeConflicts(project,{...r,delta_m:1});
  if(names.length)throw new Error('Region intersects locked content: '+names.join(', ')+'. Choose another region or unlock it first.');
}
