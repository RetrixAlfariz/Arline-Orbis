import { toVector, fromVector } from '../geo/coordinates';
import type { Coordinate } from '../core/world';
import { sampleElevation, type ElevationRaster } from '../terrain/sample';
import { makePlateModel, randomSeed, fractal, type V3 } from './plates';
import type { GenerationOptions } from './options';
import { normalizePoles } from './hydrology';
import { metricErosion } from './metricErosion';

export const CONTINUOUS_VERSION = 'm5-continuous-v1' as const;
export const M5_NOISE_DEFAULTS = { hill_detail_m: 180, mountain_detail_m: 850, rock_detail_m: 90 };
// Distances are world-space meters, scaled with radius to preserve angular sampling.
// Earth reference: 180 km ownership blend; 160 km trench sigma; 220 km mountain belt.
export const M5_SCALES_KM = { ownership: 180, boundary: 800, warp: 260, trenchOffset: 180,
  trench: 160, mountains: 220, ridge: 160, rift: 80, hills: 900, crests: 600, rock: 240 };
const clamp = (x:number,lo=0,hi=1) => Math.max(lo,Math.min(hi,x));
const smooth = (lo:number,hi:number,x:number) => { const t=clamp((x-lo)/(hi-lo)); return t*t*(3-2*t); };
const dot = (a:V3,b:V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a:V3,b:V3):V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = (p:V3):V3 => {const d=Math.hypot(...p);return p.map(v=>v/d) as V3;};
const gaussian = (x:number,sigma:number) => Math.exp(-((x/sigma)**2)/2);
export function boundaryProfile(signed:number,converge:number,spread:number,oceanSign:number,mixed:boolean,bothContinental:boolean,scale=1){
  const m=(km:number)=>km*1000*scale,inland=mixed?-oceanSign*m(120):0;
  return {mountains:converge*gaussian(signed-inland,m(M5_SCALES_KM.mountains)),
    trenches:bothContinental?0:converge*gaussian(signed-oceanSign*m(M5_SCALES_KM.trenchOffset),m(M5_SCALES_KM.trench)),
    ridges:spread*gaussian(signed,m(M5_SCALES_KM.ridge)),rifts:spread*gaussian(signed,m(M5_SCALES_KM.rift)),
    fractures:(1-converge)*(1-spread)*gaussian(signed,m(120))};
}

/** Continuous spherical plate contributions, without nearest-pair elevation switches. */
export function makeContinuousModel(seed:string, options:GenerationOptions, radius_m:number) {
  const legacy=makePlateModel(seed,options),plates=legacy.plates,salt=legacy.salt;
  const scale=radius_m/6371000, meters=(km:number)=>km*1000*scale;
  const frequency=(km:number)=>radius_m/meters(km);
  const pairs:{i:number;j:number;normal:V3;rotation:V3;oceanSign:number}[]=[];
  for(let i=0;i<plates.length;i++)for(let j=i+1;j<plates.length;j++){
    const a=plates[i],b=plates[j],normal=norm(b.center.map((v,k)=>v-a.center[k]) as V3);
    const rotation=b.rotation.map((v,k)=>v-a.rotation[k]) as V3;
    pairs.push({i,j,normal,rotation,oceanSign:a.continental!==b.continental?(a.continental?1:-1):(a.age_ma>=b.age_ma?-1:1)});
  }
  const rnd=randomSeed(seed+':continuous-hotspots');
  const hotspots=Array.from({length:10},()=>({center:toVector({lat_deg:Math.asin(2*rnd()-1)*180/Math.PI,lon_deg:rnd()*360-180}),height:.5+rnd()*.5}));
  function sample(at:Coordinate) {
    const p=toVector(at),warpFrequency=frequency(1500);
    const warped=norm(p.map((v,i)=>v+meters(M5_SCALES_KM.warp)/radius_m*fractal(p,salt+401+i*37,warpFrequency,2)) as V3);
    const distances=plates.map(a=>Math.acos(clamp(dot(warped,a.center),-1,1))*radius_m),min=Math.min(...distances);
    const weights=distances.map(d=>Math.exp(-(d-min)/meters(M5_SCALES_KM.ownership))),total=weights.reduce((a,b)=>a+b,0);
    const ownership=weights.map(v=>v/total),continental=ownership.reduce((s,w,i)=>s+(plates[i].continental?w:0),0);
    const land=smooth(.12,.88,continental),ocean=1-land;
    const age=ownership.reduce((s,w,i)=>s+w*plates[i].age_ma,0);
    const hills=fractal(p,salt+17,frequency(M5_SCALES_KM.hills),2);
    let height=(-4200-1000*Math.sqrt(age/160))*ocean+(700+900*fractal(p,salt+31,frequency(2600),2))*land;
    let mountains=0,ridges=0,trenches=0,rifts=0,fractures=0,pairWeight=0;
    for(const pair of pairs){
      const gap=Math.max(distances[pair.i],distances[pair.j])-min;
      // Local support suppresses remote great-circle extensions. The fade reaches
      // zero with a zero derivative before a pair is omitted from computation.
      if(gap>=meters(2400))continue;
      const signed=Math.asin(clamp(dot(warped,pair.normal),-1,1))*radius_m;
      if(Math.abs(signed)>meters(1400))continue;
      // A soft relevance window fades nonlocal pair extensions, including triple junctions.
      const relevance=Math.exp(-gap/meters(M5_SCALES_KM.boundary))*(1-smooth(meters(1200),meters(2400),gap))*(1-smooth(meters(1000),meters(1400),Math.abs(signed)));
      const divergence=dot(cross(pair.rotation,warped),pair.normal);
      const converge=smooth(.03,.22,-divergence),spread=smooth(.03,.22,divergence);
      const boundary=gaussian(signed,meters(360));
      pairWeight+=relevance*boundary;
      const mixed=plates[pair.i].continental!==plates[pair.j].continental;
      const profile=boundaryProfile(signed,converge,spread,pair.oceanSign,mixed,plates[pair.i].continental&&plates[pair.j].continental,scale);
      mountains+=relevance*profile.mountains;
      // One ocean-side trench, never mirrored across continental crust.
      trenches+=relevance*profile.trenches;ridges+=relevance*profile.ridges;rifts+=relevance*profile.rifts;fractures+=relevance*profile.fractures;
    }
    const denominator=Math.max(1,pairWeight);
    mountains=clamp(mountains/denominator)*land;
    ridges=clamp(ridges/denominator)*ocean;trenches=clamp(trenches/denominator)*ocean;
    rifts=clamp(rifts/denominator)*ocean;fractures=clamp(fractures/denominator)*ocean;
    height+=5600*mountains+options.ridge_m*ridges-options.rift_m*rifts-options.trench_m*trenches-250*fractures;
    const crest=1-Math.abs(fractal(p,salt+71,frequency(M5_SCALES_KM.crests),2));
    const crestShape=crest**3;
    const rock=fractal(p,salt+97,frequency(M5_SCALES_KM.rock),1);
    // Plains receive broad low-amplitude hills; ridged and rock layers require an orogenic mask.
    height+=options.roughness*((options.hill_detail_m??M5_NOISE_DEFAULTS.hill_detail_m)*hills*land*(1-mountains)
      +(options.mountain_detail_m??M5_NOISE_DEFAULTS.mountain_detail_m)*(crestShape-.45)*mountains
      +(options.rock_detail_m??M5_NOISE_DEFAULTS.rock_detail_m)*rock*mountains*smooth(.25,.7,crestShape));
    let hotspot=0;
    for(const h of hotspots){const distance=Math.acos(clamp(dot(p,h.center),-1,1))*radius_m;hotspot+=h.height*gaussian(distance,meters(160));}
    height+=options.seamount_m*clamp(hotspot)*ocean;
    const plate=ownership.indexOf(Math.max(...ownership));
    const landform=hotspot*ocean>.35?7:trenches>.25?5:rifts>.6?4:ridges>.25?3:fractures>.3?6:land>.85?1:land>.15?2:0;
    return {elevation_m:Math.round(clamp(height,-20000,20000)),plate,landform,mountainMask:mountains,continental:land};
  }
  return {sample,plateCenters:plates.map(p=>({...fromVector(...p.center),id:p.id,continental:p.continental}))};
}

/** Fixed physical/angular reference mesh: output detail cannot change erosion's length scale. */
export function continuousTerrain(seed:string,options:GenerationOptions,radius_m:number,progress:(pct:number)=>void=()=>{}) {
  const model=makeContinuousModel(seed,options,radius_m),width=720,height=361,n=width*height;
  const raw:ElevationRaster={width,height,samples:new Int16Array(n)},plates=new Uint8Array(n),landforms=new Uint8Array(n);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){const i=y*width+x,s=model.sample({lat_deg:90-y*180/(height-1),lon_deg:-180+x*360/width});raw.samples[i]=s.elevation_m;plates[i]=s.plate;landforms[i]=s.landform;}
    if(y%24===0)progress(y/height*100);
  }
  normalizePoles(raw.samples,width,height);
  const erosion=options.erosion?metricErosion(raw,radius_m):{raster:raw,sediment:new Float32Array(n)};
  const eroded=erosion.raster,sediment=erosion.sediment;
  function at(point:Coordinate){const x=((point.lon_deg+180)%360+360)%360/360*width,y=(90-point.lat_deg)/180*(height-1);const index=Math.round(y)*width+Math.floor(x)%width;
    return {raw:sampleElevation(raw,point),elevation:sampleElevation(eroded,point),plate:plates[index],landform:landforms[index],sediment:sediment[index]};}
  return {at,raw,eroded,sediment,plateCenters:model.plateCenters};
}
