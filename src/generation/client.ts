import type { TerrainInput, WorldData } from './pipeline';
import type { StageFrame } from './stages';
export interface GenerationTask { result: Promise<WorldData>; cancel: () => void }
let cancelActive: (()=>void)|undefined;
export function startGeneration(input:TerrainInput,onProgress:(stage:string,pct:number)=>void=()=>{},onStage?: (frame:StageFrame)=>void):GenerationTask {
  cancelActive?.();
  let worker:Worker|undefined,finished=false,rejectTask:(e:Error)=>void=()=>{};
  const result=new Promise<WorldData>((resolve,reject)=>{
    rejectTask=reject;
    try{
      worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(e)=>{
        if(finished)return;
        try {
          if(e.data.type==='stage'){onStage?.(e.data.frame);return;}
          if(e.data.type==='progress'){onProgress(e.data.stage,e.data.pct);return;}
        } catch(cause) { finished=true;cancelActive=undefined;worker?.terminate();reject(cause);return; }
        finished=true;cancelActive=undefined;worker?.terminate();
        if(e.data.type==='result')resolve(e.data.result);else reject(new Error(e.data.message));
      };
      worker.onerror=(e)=>{e.preventDefault();if(!finished){finished=true;cancelActive=undefined;worker?.terminate();reject(new Error(e.message||'Generation worker failed. Existing project is unchanged.'));}};
      worker.postMessage({input, snapshots:!!onStage});
    }catch(e){finished=true;cancelActive=undefined;worker?.terminate();reject(new Error('Background generation unavailable: '+(e as Error).message));}
  });
  const cancel=()=>{if(!finished){finished=true;cancelActive=undefined;worker?.terminate();rejectTask(new DOMException('Generation cancelled. Existing world is unchanged.','AbortError'));}};
  cancelActive=finished?undefined:cancel;
  return {result,cancel};
}
