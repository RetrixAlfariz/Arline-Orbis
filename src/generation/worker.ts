import { generateWorld } from './pipeline';
import type { TerrainInput } from './pipeline';
// Dedicated module worker. The main thread cancels immediately with terminate().
self.onmessage=(event:MessageEvent<TerrainInput>)=>{
  try{
    const result=generateWorld(event.data,(stage,pct)=>self.postMessage({type:'progress',stage,pct}));
    const arrays=[result.raster.samples,result.plates,result.landforms,result.temperature,result.rainfall,result.biome,result.sediment,
      ...(result.hydro?[result.hydro.parent,result.hydro.accumulation,result.hydro.watershed,result.hydro.water_surface]:[])];
    self.postMessage({type:'result',result}, {transfer:arrays.map(a=>a.buffer)});
  }catch(e){self.postMessage({type:'error',message:(e as Error).message});}
};
