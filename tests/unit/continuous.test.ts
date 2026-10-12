import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { makeContinuousModel, boundaryProfile, M5_NOISE_DEFAULTS } from '../../src/generation/continuous';
import { metricErosion,cellAreas } from '../../src/generation/metricErosion';
import { makePlateModel } from '../../src/generation/plates';
import { DEFAULT_OPTIONS } from '../../src/generation/options';
import { generateWorld } from '../../src/generation/pipeline';
import { SAMPLE_PLANET,createLandmark } from '../../src/core/world';
import { newProject,decodeProject,authoringProject } from '../../src/core/project';
import { proposedWorld } from '../../src/generation/workshop';
import { regenerationConflicts } from '../../src/authoring/conflicts';

const radius=SAMPLE_PLANET.radius_m,options={...DEFAULT_OPTIONS,climate:false,hydrology:false,...M5_NOISE_DEFAULTS};
describe('M5 continuous spherical terrain',()=>{
  it('keeps the legacy algorithm byte-for-byte and makes M5 migration explicit',()=>{
    const legacy=generateWorld({planet:{...SAMPLE_PLANET,seed:'geology-completion-42',algorithm_version:'m4-plates-v1'},strokes:[],options:DEFAULT_OPTIONS,width:180,height:91});
    expect(createHash('sha256').update(Buffer.from(legacy.raster.samples.buffer)).digest('hex')).toBe('43675927ada3c0c3c32ef9c351a8c80c615a8d69a17fd2fb24d56f08181022d9');
    const p=authoringProject(newProject());p.planet.algorithm_version='m4-plates-v1';
    expect(decodeProject(JSON.stringify(p)).planet.algorithm_version).toBe('m4-plates-v1');
    const next=proposedWorld(p,'aurelia-001',options,0,null,[]);
    expect(next.planet.algorithm_version).toBe('m5-continuous-v1');expect(decodeProject(JSON.stringify(next))).toEqual(next);
    expect(()=>decodeProject({...next,version:2})).toThrow();
  });
  it('has a single ocean-side trench and broad continental collision uplift',()=>{
    for(const sign of [-1,1]){
      const profile=Array.from({length:181},(_,i)=>({x:(i-90)*10000,v:boundaryProfile((i-90)*10000,1,0,sign,true,false)}));
      const peaks=profile.filter((p,i)=>i>0&&i<profile.length-1&&p.v.trenches>profile[i-1].v.trenches&&p.v.trenches>profile[i+1].v.trenches);
      expect(peaks).toHaveLength(1);expect(Math.sign(peaks[0].x)).toBe(sign);
      expect(boundaryProfile(-sign*180000,1,0,sign,true,false).trenches).toBeLessThan(.09);
      expect(boundaryProfile(0,1,0,sign,false,true).trenches).toBe(0);
      expect(boundaryProfile(0,1,0,sign,false,true).mountains).toBe(1);
      expect(boundaryProfile(200000,1,0,sign,false,true).mountains).toBeGreaterThan(.5);
    }
  });
  it('remains continuous across owner boundaries as the coordinate separation shrinks',()=>{
    const model=makeContinuousModel('aurelia-001',options,radius),legacy=makePlateModel('aurelia-001',options);
    let crossings=0,worst=0;
    for(const lat of [-60,-30,0,30,60])for(let lon=-179;lon<179;lon+=4){
      if(legacy.sample({lat_deg:lat,lon_deg:lon}).plate===legacy.sample({lat_deg:lat,lon_deg:lon+4}).plate)continue;
      let lo=lon,hi=lon+4;const plate=legacy.sample({lat_deg:lat,lon_deg:lo}).plate;
      for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(legacy.sample({lat_deg:lat,lon_deg:mid}).plate===plate)lo=mid;else hi=mid;}
      const a=model.sample({lat_deg:lat,lon_deg:lo-.000001}),b=model.sample({lat_deg:lat,lon_deg:hi+.000001});
      worst=Math.max(worst,Math.abs(a.elevation_m-b.elevation_m));crossings++;
    }
    expect(crossings).toBeGreaterThan(20);expect(worst).toBeLessThanOrEqual(1);
  });
  it('is finite, bounded, deterministic and seam/pole coherent for multiple seeds and roughness extremes',()=>{
    for(const seed of ['aurelia-001','different'])for(const roughness of [0,2]){
      const m=makeContinuousModel(seed,{...options,roughness},radius);
      for(const lat of [-90,-60,0,60,90]){
        expect(m.sample({lat_deg:lat,lon_deg:180}).elevation_m).toBe(m.sample({lat_deg:lat,lon_deg:-180}).elevation_m);
        if(Math.abs(lat)===90)expect(m.sample({lat_deg:lat,lon_deg:50}).elevation_m).toBe(m.sample({lat_deg:lat,lon_deg:-130}).elevation_m);
        for(let lon=-170;lon<180;lon+=20){const s=m.sample({lat_deg:lat,lon_deg:lon});expect(Number.isFinite(s.elevation_m)).toBe(true);expect(Math.abs(s.elevation_m)).toBeLessThanOrEqual(20000);expect(s.mountainMask).toBeLessThanOrEqual(1);expect(s).toEqual(m.sample({lat_deg:lat,lon_deg:lon}));}
      }
    }
  });
  it('gates fine mountain relief out of plains while hills remain broad and bounded',()=>{
    const flat=makeContinuousModel('aurelia-001',{...options,hill_detail_m:0,mountain_detail_m:0,rock_detail_m:0},radius);
    const rock=makeContinuousModel('aurelia-001',{...options,hill_detail_m:0,mountain_detail_m:0,rock_detail_m:200},radius);
    let plains=0,mountains=0,plainMax=0,crestMax=0;
    for(let lat=-75;lat<=75;lat+=5)for(let lon=-180;lon<180;lon+=5){
      const p={lat_deg:lat,lon_deg:lon},a=flat.sample(p),b=rock.sample(p),d=Math.abs(a.elevation_m-b.elevation_m);
      if(a.continental>.95&&a.mountainMask<.02){plains++;plainMax=Math.max(plainMax,d);}
      if(a.mountainMask>.25){mountains++;crestMax=Math.max(crestMax,d);}
    }
    expect(plains).toBeGreaterThan(30);expect(mountains).toBeGreaterThan(10);expect(plainMax).toBeLessThanOrEqual(4);expect(crestMax).toBeGreaterThan(plainMax);
  });
  it('matches every common Standard/High elevation exactly with metric erosion and authored strokes',()=>{
    const input={planet:{...SAMPLE_PLANET,algorithm_version:'m5-continuous-v1' as const},options,strokes:[{id:'author',lat_deg:30,lon_deg:-55,radius_km:300,delta_m:900}]};
    const a=generateWorld({...input,width:720,height:361}),b=generateWorld({...input,width:1440,height:721});
    for(let y=0;y<361;y++)for(let x=0;x<720;x++){const i=y*720+x,j=y*2*1440+x*2;expect(b.raster.samples[j]).toBe(a.raster.samples[i]);expect(b.plates[j]).toBe(a.plates[i]);}
    const repeat=generateWorld({...input,width:720,height:361});expect(repeat.raster.samples).toEqual(a.raster.samples);
    expect(repeat.sediment).toEqual(a.sediment);expect(new Set(a.raster.samples.slice(0,720)).size).toBe(1);
    const p=authoringProject(newProject());p.landmarks=[{...createLandmark('Protected',{lat_deg:30,lon_deg:-55,altitude_m:4800},'locked'),locked:true}];
    const before=JSON.stringify(p);expect(regenerationConflicts(p,{...a.raster,samples:new Int16Array(a.raster.samples.length)},a.raster).some(c=>c.locked)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  },30000);
});

it('metric thermal transport conserves spherical volume, including polar cell-area differences',()=>{
  const width=36,height=19,samples=new Int16Array(width*height).fill(1000);samples.fill(8000,width,width*2);samples[9*width+8]=6000;
  const original=new Int16Array(samples),raster={width,height,samples};
  const testRadius=radius*.1,result=metricErosion(raster,testRadius);expect(result.raster.samples[width+5]).toBeLessThan(8000);expect(result.sediment[5]).toBeGreaterThan(0);expect(samples).toEqual(original);
  expect(Math.abs(result.volumeAfter-result.volumeBefore)/Math.abs(result.volumeBefore)).toBeLessThan(1e-12);
  const areas=cellAreas(width,height,radius);expect(Array.from(areas).reduce((s,a)=>s+a*width,0)).toBeCloseTo(4*Math.PI*radius*radius,-1);
});
