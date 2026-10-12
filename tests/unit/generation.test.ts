import { describe,it,expect } from 'vitest';
import { DEFAULT_OPTIONS,validateOptions } from '../../src/generation/options';
import { generateWorld } from '../../src/generation/pipeline';
import { makePlateModel } from '../../src/generation/plates';
import { drain,erode,climate } from '../../src/generation/hydrology';
import { SAMPLE_PLANET } from '../../src/core/world';
import { sampleElevation } from '../../src/terrain/sample';
import { makeTile,TileCache,tileAddress } from '../../src/terrain/regions';
const input={planet:{...SAMPLE_PLANET,seed:'geology-completion-42',algorithm_version:'m4-plates-v1' as const},strokes:[],options:{...DEFAULT_OPTIONS},width:180,height:91};

describe('M4 deterministic staged geography',()=>{
  it('reproduces all derived layers by version, seed, options and resolution',()=>{
    const a=generateWorld(input),b=generateWorld(input);
    for(const key of ['plates','landforms','temperature','rainfall','biome','sediment'] as const)expect(b[key]).toEqual(a[key]);
    expect(b.raster.samples).toEqual(a.raster.samples);expect(b.hydro).toEqual(a.hydro);
    expect(new Set(a.plates).size).toBe(DEFAULT_OPTIONS.plate_count);
    expect(a.raster.samples.some(e=>e>0)).toBe(true);expect(a.raster.samples.some(e=>e< -5500)).toBe(true);
    const kinds=new Set(a.landforms);for(const kind of [0,1,2,3,4,5,6,7])expect(kinds.has(kind),`missing landform ${kind}`).toBe(true);
  });
  it('parameters meaningfully change bathymetry and optional stages remain inspectable',()=>{
    const a=generateWorld(input);
    const b=generateWorld({...input,options:{...DEFAULT_OPTIONS,ridge_m:0,trench_m:0,seamount_m:0,erosion:false,climate:false,hydrology:false}});
    expect(b.raster.samples).not.toEqual(a.raster.samples);expect(b.hydro).toBeNull();expect(b.temperature.every(v=>v===0)).toBe(true);expect(b.sediment.every(v=>v===0)).toBe(true);
    expect(generateWorld({...input,planet:{...input.planet,seed:'other-geology'}}).raster.samples).not.toEqual(a.raster.samples);
  });
  it('uses resolution-independent plates with continuous seams and polar points',()=>{
    const model=makePlateModel(input.planet.seed,DEFAULT_OPTIONS);
    for(const lat of [-90,-40,0,50,90])expect(model.sample({lat_deg:lat,lon_deg:180})).toEqual(model.sample({lat_deg:lat,lon_deg:-180}));
    for(const lat of [-90,90])expect(model.sample({lat_deg:lat,lon_deg:-70}).elevation_m).toBe(model.sample({lat_deg:lat,lon_deg:140}).elevation_m);
  });
  it('applies authored strokes after generation stages and preserves baseline arrays',()=>{
    const a=generateWorld(input),point={lat_deg:0,lon_deg:0};
    const b=generateWorld({...input,strokes:[{id:'edit',...point,radius_km:1200,delta_m:-1000}]});
    expect(sampleElevation(b.raster,point)).toBe(sampleElevation(a.raster,point)-1000);
    expect(a.options).toEqual(DEFAULT_OPTIONS);
  });
  it('rejects invalid options and unbounded allocations',()=>{
    expect(()=>generateWorld({...input,width:100000})).toThrow();expect(()=>validateOptions({...DEFAULT_OPTIONS,plate_count:2})).toThrow();
    expect(()=>validateOptions({...DEFAULT_OPTIONS,climate:'yes'})).toThrow();expect(()=>validateOptions({...DEFAULT_OPTIONS,resolution:500})).toThrow();
  });
});

describe('hydrology, climate, terrain sections',()=>{
  it('priority-flood parent links are acyclic, flow-conserving, and lake levels use their own datum',()=>{
    const width=20,height=11,samples=new Int16Array(width*height).fill(800);
    for(let x=0;x<width;x++)samples[x]=-100;
    samples[5*width+10]=100;samples[5*width+11]=150;
    const result=drain({width,height,samples},0);
    expect(result.water_surface[5*width+10]).toBe(800);expect(result.lake_count).toBeGreaterThan(0);
    for(let i=0;i<samples.length;i++){
      const seen=new Set<number>();let p=i;
      while(p>=0){expect(seen.has(p)).toBe(false);seen.add(p);const next=result.parent[p];if(next>=0)expect(result.accumulation[next]).toBeGreaterThanOrEqual(result.accumulation[p]);p=next;}
    }
  });
  it('climate distinguishes latitude, altitude, ocean and dry land; erosion is deterministic',()=>{
    const samples=new Int16Array(360*181).fill(200),raster={width:360,height:181,samples};
    const c=climate(raster,0,1);expect(c.temperature[90*360]).toBeGreaterThan(c.temperature[0]);expect(new Set(c.biome).size).toBeGreaterThan(2);
    const spiky={width:16,height:9,samples:new Int16Array(144)};spiky.samples[60]=5000;
    const eroded=erode(spiky);expect(eroded.raster.samples[60]).toBeLessThan(5000);expect(eroded.sediment.some(v=>v>0)).toBe(true);expect(spiky.samples[60]).toBe(5000);
    expect(erode(spiky).raster.samples).toEqual(eroded.raster.samples);
  });
});

describe('regional demand paging',()=>{
  const raster=generateWorld({...input,width:90,height:46,options:{...DEFAULT_OPTIONS,hydrology:false}}).raster;
  it('adjacent tiles share border samples and crossing the dateline wraps',()=>{
    const a=makeTile(raster,{level:3,x:2,y:3},'A',100,33),b=makeTile(raster,{level:3,x:3,y:3},'A',100,33);
    for(let y=0;y<33;y++)expect(a.samples[y*33+32]).toBe(b.samples[y*33]);
    const left=makeTile(raster,{level:3,x:0,y:3},'A',100,33),right=makeTile(raster,{level:3,x:7,y:3},'A',100,33);
    for(let y=0;y<33;y++)expect(left.samples[y*33]).toBe(right.samples[y*33+32]);
    expect(tileAddress({lat_deg:-90,lon_deg:180},3)).toEqual({level:3,x:0,y:7});
  });
  it('coincident LOD samples agree and the cache has an enforced memory ceiling',()=>{
    const address={level:3,x:2,y:3},a=makeTile(raster,address,'A',100,33),b=makeTile(raster,address,'A',100,65);
    for(let y=0;y<33;y++)for(let x=0;x<33;x++)expect(a.samples[y*33+x]).toBe(b.samples[y*2*65+x*2]);
    const cache=new TileCache(a.samples.byteLength*2);cache.put('a',a);cache.put('b',a);cache.get('a');cache.put('c',a);
    expect(cache.get('b')).toBeUndefined();expect(cache.get('a')).toBeDefined();expect(cache.size).toBe(2);expect(cache.bytes).toBeLessThanOrEqual(cache.limitBytes);
    cache.clear();expect(cache.bytes).toBe(0);
  });
});
