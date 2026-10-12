import type { Planet, Coordinate } from '../core/world';
import type { ElevationRaster } from '../terrain/sample';
import { generatePlanet } from '../terrain/sample';
import { applyTerrainStrokes } from '../terrain/sculpt';
import type { TerrainStroke } from '../terrain/sculpt';
import { makePlateModel } from './plates';
import { DEFAULT_OPTIONS, validateOptions } from './options';
import type { GenerationOptions } from './options';
import { erode, drain, climate, normalizePoles } from './hydrology';
import type { Hydro } from './hydrology';
export interface TerrainInput { planet: Planet; strokes: TerrainStroke[]; options?: GenerationOptions; width?: number; height?: number }
export interface WorldData {
  raster: ElevationRaster; plates: Uint8Array; landforms: Uint8Array;
  temperature: Float32Array; rainfall: Uint16Array; biome: Uint8Array; sediment: Float32Array;
  hydro: Hydro | null; plate_centers: (Coordinate & {id:number;continental:boolean})[];
  timings: Record<string,number>; options: GenerationOptions | null;
}
export const inputKey=(input:TerrainInput)=>JSON.stringify(input);
export function generateWorld(input:TerrainInput,progress:(stage:string,pct:number)=>void=()=>{}):WorldData{
  const w=input.width??720,h=input.height??361;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<16||h<9||w>1440||h>721||w*h>1040000)throw new Error('Invalid generation dimensions.');
  if(!Number.isFinite(input.planet.radius_m)||input.planet.radius_m<=0)throw new Error('Invalid planet radius.');
  const now=()=>performance.now();const timings:Record<string,number>={};let start=now();const n=w*h;
  let raster:ElevationRaster={width:w,height:h,samples:new Int16Array(n)};
  const plates=new Uint8Array(n),landforms=new Uint8Array(n);let centers:WorldData['plate_centers']=[];
  const options=input.planet.algorithm_version==='m4-plates-v1'?validateOptions(input.options??DEFAULT_OPTIONS):null;
  progress('Continents and bathymetry',2);
  if(options){const model=makePlateModel(input.planet.seed,options);centers=model.plateCenters;
    for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*w+x,point={lat_deg:90-y*180/(h-1),lon_deg:-180+x*360/w};const s=model.sample(point);raster.samples[i]=s.elevation_m;plates[i]=s.plate;landforms[i]=s.landform;}
      if(y%24===0)progress('Continents and bathymetry',5+y/h*48);}
    normalizePoles(raster.samples,w,h);
  }else raster=generatePlanet(input.planet.seed,input.planet.algorithm_version as 'm0-sample-v1'|'m2-seeded-v1',w,h);
  timings.geology=now()-start;start=now();let sediment:Float32Array=new Float32Array(n);
  if(options?.erosion){progress('Erosion and sediment',57);const e=erode(raster);raster=e.raster;sediment=e.sediment;}
  timings.erosion=now()-start;start=now();
  raster=applyTerrainStrokes(raster,input.strokes,input.planet.radius_m);timings.authored=now()-start;start=now();
  let temperature=new Float32Array(n),rainfall=new Uint16Array(n),biome=new Uint8Array(n);
  if(options?.climate){progress('Temperature and rainfall',65);({temperature,rainfall,biome}=climate(raster,input.planet.sea_level_m,input.planet.seed.length));}
  timings.climate=now()-start;start=now();let hydro:Hydro|null=null;
  if(options?.hydrology){progress('Basins, lakes and river routing',78);hydro=drain(raster,input.planet.sea_level_m,options.climate?rainfall:undefined);
    if(options.climate)for(let i=0;i<n;i++)if(hydro.water_surface[i]>input.planet.sea_level_m)biome[i]=8;}
  timings.hydrology=now()-start;timings.total=Object.values(timings).reduce((a,b)=>a+b,0);progress('Ready for review',100);
  return {raster,plates,landforms,temperature,rainfall,biome,sediment,hydro,plate_centers:centers,timings,options};
}
