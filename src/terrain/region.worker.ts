import { makeTile } from './regions';
self.onmessage=e=>{
  try{for(const resolution of [33,65,129]){
    const tile=makeTile(e.data.base,e.data.address,e.data.seed,e.data.detail_m,resolution);
    self.postMessage({type:'tile',tile,final:resolution===129},{transfer:[tile.samples.buffer]});
  }}catch(e){self.postMessage({type:'error',message:(e as Error).message});}
};
