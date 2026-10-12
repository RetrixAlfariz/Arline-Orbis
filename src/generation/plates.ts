import { toVector, fromVector } from '../geo/coordinates';
import type { Coordinate } from '../core/world';
import type { GenerationOptions } from './options';
export type V3 = [number, number, number];
export interface Plate { id: number; center: V3; rotation: V3; continental: boolean; age_ma: number }
export interface Geology { elevation_m: number; plate: number; landform: number }
export const LANDFORMS = ['Ocean basin','Continental crust','Shelf / slope','Spreading ridge','Rift valley','Subduction trench','Transform fracture','Seamount'] as const;
export const dot = (a: V3,b: V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: V3,b: V3): V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = (a: V3): V3 => { const d=Math.hypot(...a)||1; return a.map(x=>x/d) as V3; };
const sub = (a: V3,b: V3): V3 => a.map((x,i)=>x-b[i]) as V3;
const clamp=(x:number,l=-1,h=1)=>Math.max(l,Math.min(h,x));
export function randomSeed(seed: string): () => number {
  let s=2166136261; for(const c of seed) s=Math.imul(s^c.charCodeAt(0),16777619);
  return ()=> { s=(s+0x6d2b79f5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
}
function hash(x:number,y:number,z:number,seed:number): number {
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^seed;
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967295*2-1;
}
export function noise3(x:number,y:number,z:number,seed=1337): number {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const smooth=(v:number)=>v*v*(3-2*v); const tx=smooth(x-ix),ty=smooth(y-iy),tz=smooth(z-iz);
  let n=0; for(let k=0;k<2;k++) for(let j=0;j<2;j++) for(let i=0;i<2;i++)
    n+=hash(ix+i,iy+j,iz+k,seed)*(i?tx:1-tx)*(j?ty:1-ty)*(k?tz:1-tz);
  return n;
}
export function fractal(v: V3, seed: number, frequency=3, octaves=4): number {
  let n=0,amp=1,total=0;
  for(let i=0;i<octaves;i++){ n+=amp*noise3(v[0]*frequency,v[1]*frequency,v[2]*frequency,seed+i*1973);total+=amp;frequency*=2; amp*=.5; }
  return n/total;
}
export function makePlateModel(seed: string, options: GenerationOptions) {
  const rng=randomSeed(seed), salt=Math.floor(rng()*2**31);
  const direction=():V3=>toVector({lat_deg:Math.asin(2*rng()-1)*180/Math.PI,lon_deg:rng()*360-180});
  const plates: Plate[]=[];
  for(let i=0;i<options.plate_count;i++){
    // Farthest-candidate sampling avoids pathological sliver plates without Earth-specific coordinates.
    let center=direction(), best=-Infinity;
    for(let c=0;c<12;c++){ const trial=direction(),distance=plates.length?Math.min(...plates.map(p=>1-dot(p.center,trial))):rng(); if(distance>best){best=distance;center=trial;} }
    plates.push({id:i,center,rotation:direction().map(x=>x*(.2+rng()*.8)) as V3,continental:i<Math.max(1,Math.round(options.plate_count*options.continental_fraction)),age_ma:10+rng()*140});
  }
  const hotspots=Array.from({length:10},()=>({center:direction(),radius:.012+rng()*.025,height:.5+rng()*.5}));
  function sample(at: Coordinate): Geology {
    const p=toVector(at); let a=plates[0],b=plates[1],da=-2,db=-2;
    let continent=plates.find(v=>v.continental)!,ocean=plates.find(v=>!v.continental)!,dc=-2,docean=-2;
    for(const plate of plates){const d=dot(p,plate.center);if(d>da){b=a;db=da;a=plate;da=d;}else if(d>db){b=plate;db=d;}
      if(plate.continental&&d>dc){continent=plate;dc=d;}else if(!plate.continental&&d>docean){ocean=plate;docean=d;}}
    const diff=sub(b.center,a.center), normal=unit(diff);
    const distance=Math.abs(Math.asin(clamp((da-db)/(Math.hypot(...diff)||1))));
    const relative=sub(cross(b.rotation,p),cross(a.rotation,p));
    const divergence=dot(relative,normal),shear=Math.abs(dot(relative,unit(cross(p,normal))));
    const broad=fractal(p,salt,3,4),fine=fractal(p,salt+71,24,3);
    // Crust material and shore geometry are continuous fields, not straight Voronoi
    // polygon borders. Domain perturbation is deterministic and spherical at seams.
    const materialDistance=Math.asin(clamp((dc-docean)/(Math.hypot(...sub(continent.center,ocean.center))||1)));
    const coastline=materialDistance+options.roughness*(.20*fractal(p,salt+431,7,4)+.035*fine);
    const blend=clamp((coastline+.028)/.066,0,1),continental=blend*blend*(3-2*blend);
    const land=750+options.roughness*(1600*broad+420*fine);
    const floor=-4200-1000*Math.sqrt(a.age_ma/160)+options.roughness*300*fine;
    let elevation=floor*(1-continental)+land*continental;
    let landform=continental>.8?1:continental>.12?2:0;
    const dryCrust=continental>.85;
    const influence=Math.exp(-((distance/.05)**2));
    if(divergence>.14 && !dryCrust){
      elevation+=options.ridge_m*influence-options.rift_m*Math.exp(-((distance/.009)**2));
      if(distance<.05)landform=distance<.008?4:3;
    } else if(divergence<-.14){
      if(dryCrust){elevation+=4200*influence*(.7+.6*Math.abs(fine));}
      else {elevation-=options.trench_m*Math.exp(-(((distance-.016)/.009)**2));elevation+=900*Math.exp(-(((distance-.07)/.018)**2));if(distance<.045)landform=5;}
    }else if(shear>.12){
      elevation-=500*influence*(.5+.5*Math.sin(dot(p,a.rotation)*120));if(distance<.02)landform=6;
    }
    for(const h of hotspots){const d=1-dot(p,h.center),r=h.radius*h.radius; if(d<r*8 && !dryCrust){elevation+=options.seamount_m*h.height*Math.exp(-d/r); if(d<r)landform=7;}}
    return {elevation_m:Math.round(clamp(elevation,-20000,20000)),plate:a.id,landform};
  }
  return {plates,salt,sample,plateCenters:plates.map(p=>({...fromVector(...p.center),id:p.id,continental:p.continental}))};
}
