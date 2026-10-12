import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out='docs/design/terrain-math';await mkdir(out,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage();await page.goto('http://127.0.0.1:4180');
const result=await page.evaluate(async()=>{
  const {generateWorld}=await import('/src/generation/pipeline.ts');
  const {makeContinuousModel,M5_NOISE_DEFAULTS}=await import('/src/generation/continuous.ts');
  const {DEFAULT_OPTIONS}=await import('/src/generation/options.ts');
  const {newProject}=await import('/src/core/project.ts');
  const {terrainTexture}=await import('/src/render/terrainTexture.ts');
  const planet={...newProject().planet,algorithm_version:'m4-plates-v1'};
  const options={...DEFAULT_OPTIONS,climate:false,hydrology:false};
  const seeds=['aurelia-001','hd-quality-review','orbis-geology-001'];
  const cases=[];
  for(const seed of seeds){
    const before=generateWorld({planet:{...planet,seed},strokes:[],options,width:720,height:361});
    cases.push({seed,before:terrainTexture(before.raster).toDataURL(),landMask:Array.from(before.raster.samples,v=>v>=0?1:0)});
  }
  const seed='aurelia-001';
  const hash=async(samples)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',samples.buffer))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const legacy=generateWorld({planet:{...planet,seed:'geology-completion-42'},strokes:[],options:{...DEFAULT_OPTIONS},width:180,height:91});
  const start=performance.now();
  const standard=generateWorld({planet:{...planet,seed,algorithm_version:'m5-continuous-v1'},strokes:[],options:{...options,...M5_NOISE_DEFAULTS},width:720,height:361});
  const hd=generateWorld({planet:{...planet,seed,algorithm_version:'m5-continuous-v1'},strokes:[],options:{...options,...M5_NOISE_DEFAULTS},width:1440,height:721});
  let max=0,different=0;for(let y=0;y<361;y++)for(let x=0;x<720;x++){const d=Math.abs(standard.raster.samples[y*720+x]-hd.raster.samples[y*2*1440+x*2]);max=Math.max(max,d);if(d)different++;}
  const model=makeContinuousModel(seed,options,planet.radius_m);
  let worst=0;for(let lat=-80;lat<=80;lat+=5)for(let lon=-180;lon<180;lon+=5){const a=model.sample({lat_deg:lat,lon_deg:lon-.000001}),b=model.sample({lat_deg:lat,lon_deg:lon+.000001});worst=Math.max(worst,Math.abs(a.elevation_m-b.elevation_m));}
  return {cases,after:terrainTexture(standard.raster).toDataURL(),hd:terrainTexture(hd.raster).toDataURL(),metrics:{seed,algorithm:'m5-continuous-v1',options,elapsed_ms:performance.now()-start,commonSamples:720*361,different,maxDifference_m:max,worstTinyStep_m:worst,legacyHash:await hash(legacy.raster.samples)}};
});
for(let i=0;i<result.cases.length;i++){await writeFile(`${out}/legacy-${i}.png`,Buffer.from(result.cases[i].before.split(',')[1],'base64'));}
await writeFile(`${out}/candidates.json`,JSON.stringify(result.cases.map(({seed,landMask})=>({seed,landMask}))));
await writeFile(`${out}/m5-standard.png`,Buffer.from(result.after.split(',')[1],'base64'));
await writeFile(`${out}/m5-high.png`,Buffer.from(result.hd.split(',')[1],'base64'));
await writeFile(`${out}/metrics.json`,JSON.stringify(result.metrics,null,2));console.log(JSON.stringify(result.metrics));await browser.close();
