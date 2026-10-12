import type { TerrainInput, WorldData } from './pipeline';
export interface GenerationTask { result: Promise<WorldData>; cancel: () => void }
export function startGeneration(input:TerrainInput,onProgress:(stage:string,pct:number)=>void=()=>{}):GenerationTask {
  let worker:Worker|undefined,finished=false,rejectTask:(e:Error)=>void=()=>{};
  const result=new Promise<WorldData>((resolve,reject)=>{
    rejectTask=reject;
    try{
      worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(e)=>{
        if(finished)return;
        if(e.data.type==='progress'){onProgress(e.data.stage,e.data.pct);return;}
        finished=true;worker?.terminate();
        if(e.data.type==='result')resolve(e.data.result);else reject(new Error(e.data.message));
      };
      worker.onerror=(e)=>{e.preventDefault();if(!finished){finished=true;worker?.terminate();reject(new Error(e.message||'Generation worker failed. Existing project is unchanged.'));}};
      worker.postMessage(input);
    }catch(e){finished=true;worker?.terminate();reject(new Error('Background generation unavailable: '+(e as Error).message));}
  });
  return {result,cancel(){if(!finished){finished=true;worker?.terminate();rejectTask(new DOMException('Generation cancelled. Existing world is unchanged.','AbortError'));}}};
}
