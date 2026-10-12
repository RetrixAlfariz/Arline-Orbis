import { describe,it,expect } from 'vitest';
import { generateWorld } from '../../src/generation/pipeline';
import { DEFAULT_OPTIONS } from '../../src/generation/options';
import { STAGES, type StageFrame } from '../../src/generation/stages';
import { replaceRegion,validateRegions } from '../../src/generation/regions';
import { newProject,decodeProject,authoringProject } from '../../src/core/project';
import { proposedWorld } from '../../src/generation/workshop';
import { SAMPLE_PLANET,createLandmark } from '../../src/core/world';
import { distanceKm } from '../../src/geo/coordinates';
import { candidateSeeds,RECIPES } from '../../src/generation/recipes';
import { compressedProject,readProjectFile } from '../../src/core/portable';
import { sampleElevation } from '../../src/terrain/sample';

const options={...DEFAULT_OPTIONS};
const region={id:'region-A',lat_deg:40,lon_deg:179,radius_km:1800,seed:'regional-coasts',options,algorithm_version:'regional-geology-v1' as const};
const input={planet:{...SAMPLE_PLANET,algorithm_version:'m4-plates-v1' as const},strokes:[],options,width:90,height:46};
describe('generation workshop',()=>{
  it('stage delivery leaves final deterministic outputs unchanged and owns its buffers',()=>{
    const frames:StageFrame[]=[];
    const a=generateWorld(input),b=generateWorld(input,()=>{},f=>frames.push(f));
    expect(frames.map(f=>f.id)).toEqual(STAGES);
    expect(b.raster.samples).toEqual(a.raster.samples);expect(b.hydro).toEqual(a.hydro);
    expect(b.temperature).toEqual(a.temperature);expect(b.biome).toEqual(a.biome);
    expect(frames[1].data.raster.samples.buffer).not.toBe(b.raster.samples.buffer);
    frames[1].data.raster.samples.fill(123);
    expect(b.raster.samples).toEqual(a.raster.samples);
  });
  it('caps snapshots and marks optional stages skipped',()=>{
    const frames:StageFrame[]=[];
    generateWorld({...input,width:720,height:361,options:{...options,erosion:false,climate:false,hydrology:false}},()=>{},f=>frames.push(f));
    expect(frames.every(f=>f.data.raster.width<=360)).toBe(true);
    for(const id of ['erosion','climate','water','biomes'])expect(frames.find(f=>f.id===id)?.skipped).toBe(true);
  });
  it('regional replay preserves every outside elevation sample across the dateline',()=>{
    const a=generateWorld(input),b=generateWorld({...input,regions:[region]});
    let changed=0;
    for(let y=0;y<a.raster.height;y++)for(let x=0;x<a.raster.width;x++){
      const i=y*a.raster.width+x,p={lat_deg:90-y*180/(a.raster.height-1),lon_deg:-180+x*360/a.raster.width};
      if(distanceKm(region,p,input.planet.radius_m)>=region.radius_km)expect(b.raster.samples[i]).toBe(a.raster.samples[i]);
      else if(b.raster.samples[i]!==a.raster.samples[i])changed++;
    }
    expect(changed).toBeGreaterThan(0);expect(generateWorld({...input,regions:[region]}).raster.samples).toEqual(b.raster.samples);
  });
  it('feather weights approach zero at the boundary and polar samples remain coherent',()=>{
    const base={width:360,height:181,samples:new Int16Array(360*181)},replacement={...base,samples:new Int16Array(360*181).fill(1000)};
    const r={...region,lat_deg:90,lon_deg:0,radius_km:1100};const result=replaceRegion(base,replacement,r,SAMPLE_PLANET.radius_m);
    expect(new Set(result.raster.samples.slice(0,360)).size).toBe(1);
    expect(result.raster.samples[0]).toBe(1000);
    expect(result.weights.some(w=>w>0&&w<1)).toBe(true);
    expect(result.raster.samples[90*360]).toBe(0);
  });
  it('regional proposals preserve legacy algorithms, ownership, and version 4 through authoring',()=>{
    const p=newProject();p.landmarks=[createLandmark('Anchor',{lat_deg:-30,lon_deg:0,altitude_m:777},'anchor')];
    const next=proposedWorld(p,'regional',options,0,{id:'r',center:region,radius_km:region.radius_km},[]);
    expect(next.version).toBe(4);expect(next.planet.algorithm_version).toBe(p.planet.algorithm_version);
    expect(next.landmarks).toEqual(decodeProject(p).landmarks);expect(decodeProject(JSON.stringify(next))).toEqual(next);
    expect(authoringProject(next).version).toBe(4);
    expect(()=>decodeProject({...next,version:3})).toThrow();
  });
  it('rejects intersections with locked content and bounds saved instructions',()=>{
    const p=newProject();p.landmarks=[{...createLandmark('Locked',{...region,altitude_m:777},'locked'),locked:true}];
    expect(()=>proposedWorld(p,'regional',options,0,{id:'r',center:region,radius_km:500},[])).toThrow(/locked content/);
    expect(()=>validateRegions(Array.from({length:17},(_,i)=>({...region,id:String(i)})))).toThrow();
    expect(()=>validateRegions([{...region,lat_deg:NaN}])).toThrow();
    expect(()=>validateRegions([{...region,radius_km:0}])).toThrow();
  });
  it('keeps candidate seeds bounded and recipe values explicit',()=>{
    const seeds=candidateSeeds('a'.repeat(100));expect(new Set(seeds).size).toBe(3);expect(seeds.every(s=>s.length<=100)).toBe(true);
    expect(RECIPES.find(r=>r.name==='Drowned World')?.sea_level_m).toBe(1000);
    expect(RECIPES.find(r=>r.name==='Archipelago')?.options.plate_count).toBe(24);
  });
  it('replays authored strokes after replacement and removing an edit restores the legacy base',()=>{
    const legacy={...input,planet:{...SAMPLE_PLANET},regions:[region]};
    const before=generateWorld(legacy);
    const withStroke=generateWorld({...legacy,strokes:[{id:'authored',lat_deg:40,lon_deg:179,radius_km:1200,delta_m:1000}]});
    expect(sampleElevation(withStroke.raster,{lat_deg:40,lon_deg:179})).toBeGreaterThan(sampleElevation(before.raster,{lat_deg:40,lon_deg:179}));
    const p=proposedWorld(newProject(),'region',options,0,{id:'r',center:region,radius_km:1800},[]);
    const removed=proposedWorld(p,'unchanged',options,0,null,['r'],true);
    expect(removed.planet.algorithm_version).toBe('m0-sample-v1');expect(removed.planet.seed).toBe(p.planet.seed);
    expect(removed.regional_replacements).toEqual([]);
  });
  it('round trips regional instructions through compressed project files',async()=>{
    const p=proposedWorld(newProject(),'region',options,0,{id:'r',center:region,radius_km:1800},[]);
    const blob=await compressedProject(JSON.stringify(p));
    expect(decodeProject(await readProjectFile(new File([blob],'regional.orbis')))).toEqual(p);
  });
});
