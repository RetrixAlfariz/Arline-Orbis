import type { Coordinate } from '../core/world';
import type { ElevationRaster } from '../terrain/sample';
export interface Hydro {
  parent: Int32Array; accumulation: Float32Array; watershed: Int32Array;
  water_surface: Float32Array; rivers: Coordinate[][]; lake_count: number;
}
class MinHeap {
  private q: {i:number;h:number}[]=[];
  get length(){return this.q.length;}
  push(i:number,h:number){let p=this.q.length;this.q.push({i,h});while(p){const a=(p-1)>>1;if(this.less(this.q[a],this.q[p]))break;[this.q[a],this.q[p]]=[this.q[p],this.q[a]];p=a;}}
  private less(a:{i:number;h:number},b:{i:number;h:number}){return a.h<b.h||(a.h===b.h&&a.i<b.i);}
  pop(){const first=this.q[0],last=this.q.pop()!;if(this.q.length){this.q[0]=last;let p=0;while(p*2+1<this.q.length){let c=p*2+1;if(c+1<this.q.length&&this.less(this.q[c+1],this.q[c]))c++;if(this.less(this.q[p],this.q[c]))break;[this.q[p],this.q[c]]=[this.q[c],this.q[p]];p=c;}}return first;}
}
export function neighbors(i:number,w:number,h:number):number[]{
  const x=i%w,y=(i/w)|0, a=[y*w+(x+w-1)%w,y*w+(x+1)%w];
  if(y>0)a.push(i-w);if(y<h-1)a.push(i+w);return a;
}
export function normalizePoles(samples:Int16Array,w:number,h:number){
  for(const y of [0,h-1]){let sum=0;for(let x=0;x<w;x++)sum+=samples[y*w+x];const mean=Math.round(sum/w);for(let x=0;x<w;x++)samples[y*w+x]=mean;}
}
/** Conservative thermal relaxation; exported elevations retain a fixed sea-level datum. */
export function erode(raster:ElevationRaster,iterations=2):{raster:ElevationRaster;sediment:Float32Array}{
  const {width:w,height:h}=raster;let values=Float64Array.from(raster.samples);const sediment=new Float32Array(values.length);
  for(let step=0;step<iterations;step++){
    const changes=new Float64Array(values.length);
    for(let i=w;i<values.length-w;i++){
      let dest=i;for(const n of neighbors(i,w,h))if(values[n]<values[dest])dest=n;
      const excess=values[i]-values[dest]-90;
      if(excess>0){const amount=Math.min(120,excess*.12);changes[i]-=amount;changes[dest]+=amount;sediment[dest]+=amount;}
    }
    for(let i=0;i<values.length;i++)values[i]+=changes[i];
  }
  const samples=Int16Array.from(values,v=>Math.round(v));normalizePoles(samples,w,h);
  return {raster:{width:w,height:h,samples},sediment};
}
/** Priority-flood routing: every dry cell has an earlier parent, so cycles cannot occur on flats. */
export function drain(raster:ElevationRaster,sea:number,rain?:Uint16Array):Hydro{
  const {width:w,height:h,samples}=raster,n=samples.length;
  const parent=new Int32Array(n).fill(-1),watershed=new Int32Array(n).fill(-1),water_surface=new Float32Array(n).fill(NaN);
  const visited=new Uint8Array(n),filled=Float32Array.from(samples),order:number[]=[],heap=new MinHeap();
  // Label disconnected ocean basins before drainage; this includes below-datum inland basins.
  let basin=0;
  for(let i=0;i<n;i++)if(samples[i]<sea&&!visited[i]){
    const queue=[i];visited[i]=1;
    for(let k=0;k<queue.length;k++){const p=queue[k];watershed[p]=basin;filled[p]=sea;water_surface[p]=sea;heap.push(p,sea);
      for(const j of neighbors(p,w,h))if(!visited[j]&&samples[j]<sea){visited[j]=1;queue.push(j);}}
    basin++;
  }
  if(!heap.length){let outlet=0;for(let i=1;i<n;i++)if(samples[i]<samples[outlet])outlet=i;visited[outlet]=1;watershed[outlet]=0;heap.push(outlet,samples[outlet]);}
  while(heap.length){const {i,h:level}=heap.pop();order.push(i);
    for(const j of neighbors(i,w,h))if(!visited[j]){
      visited[j]=1;parent[j]=i;watershed[j]=watershed[i];filled[j]=Math.max(samples[j],level);
      if(filled[j]>samples[j]+5&&filled[j]>sea)water_surface[j]=filled[j];heap.push(j,filled[j]);
    }
  }
  const accumulation=Float32Array.from(samples,(_,i)=> (rain?.[i]??1000)/1000*Math.max(.01,Math.cos((90-((i/w)|0)*180/(h-1))*Math.PI/180)));
  for(let k=order.length-1;k>=0;k--){const i=order[k];if(parent[i]>=0)accumulation[parent[i]]+=accumulation[i];}
  let lake_count=0;const lakeSeen=new Uint8Array(n);
  for(let i=0;i<n;i++)if(Number.isFinite(water_surface[i])&&water_surface[i]>sea&&!lakeSeen[i]){
    lake_count++;const queue=[i];lakeSeen[i]=1;
    for(let k=0;k<queue.length;k++)for(const j of neighbors(queue[k],w,h))if(!lakeSeen[j]&&water_surface[j]===water_surface[i]){lakeSeen[j]=1;queue.push(j);}
  }
  const rivers:Coordinate[][]=[],used=new Uint8Array(n),threshold=Math.max(8,n/4500);
  const sources=Array.from({length:n},(_,i)=>i).filter(i=>samples[i]>sea+80&&accumulation[i]>threshold)
    .sort((a,b)=>accumulation[b]-accumulation[a]||a-b);
  for(const source of sources){
    if(used[source]||rivers.length>=80)continue;
    const path:Coordinate[]=[];let j=source;
    while(j>=0&&!used[j]&&path.length<1000){
      used[j]=1;path.push({lat_deg:90-((j/w)|0)*180/(h-1),lon_deg:-180+(j%w)*360/w});
      if(samples[j]<sea)break;j=parent[j];
    }
    if(path.length>=4)rivers.push(path);
  }
  return {parent,accumulation,watershed,water_surface,rivers,lake_count};
}
export const BIOMES=['Ocean','Ice','Tundra','Boreal forest','Temperate forest','Grassland','Desert','Tropical forest','Wetland'] as const;
export function climate(raster:ElevationRaster,sea:number,seed:number){
  const {width:w,height:h,samples}=raster;const temperature=new Float32Array(samples.length),rainfall=new Uint16Array(samples.length),biome=new Uint8Array(samples.length);
  // A bounded geographic heuristic, not a circulation or weather forecast model.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,lat=90-y*180/(h-1),abs=Math.abs(lat),height=Math.max(0,samples[i]-sea);
    const upwind=y*w+(x+w-(abs<30?1:-1))%w;
    const coastal=neighbors(i,w,h).some(j=>samples[j]<sea);
    const t=29-58*Math.sin(abs*Math.PI/180)**2-height*.0065;
    const belt=1800*Math.exp(-((abs/15)**2))+900*Math.exp(-(((abs-52)/14)**2));
    const rain=Math.max(50,300+belt+(coastal?350:0)-Math.max(0,samples[i]-samples[upwind])*.8 +120*Math.sin((x+seed%997)*.09));
    temperature[i]=Math.round(t*10)/10;rainfall[i]=Math.round(rain);
    biome[i]=samples[i]<sea?0:t< -8?1:t<0?2:rain<350?6:t<10?3:rain<800?5:t>22?7:4;
  }
  return {temperature,rainfall,biome};
}
