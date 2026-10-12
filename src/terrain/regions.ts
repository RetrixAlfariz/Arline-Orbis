import type { Coordinate } from '../core/world';
import type { ElevationRaster } from './sample';
import { sampleElevation } from './sample';
import { toVector } from '../geo/coordinates';
import { fractal, randomSeed } from '../generation/plates';
export interface TileAddress { level:number; x:number; y:number }
export interface RegionTile extends TileAddress { width:number; height:number; samples:Int16Array; west:number; north:number; span_lon:number; span_lat:number }
export function tileAddress(point:Coordinate,level:number):TileAddress {
  if(!Number.isInteger(level)||level<0||level>10)throw new Error('Invalid regional level.');const n=2**level;
  const lon=((point.lon_deg+180)%360+360)%360;
  return {level,x:Math.min(n-1,Math.floor(lon/360*n)),y:Math.min(n-1,Math.floor((90-point.lat_deg)/180*n))};
}
export function makeTile(base:ElevationRaster,tile:TileAddress,seed:string,detail_m:number,resolution=129):RegionTile{
  const n=2**tile.level;
  if(!Number.isInteger(tile.x)||!Number.isInteger(tile.y)||tile.x<0||tile.x>=n||tile.y<0||tile.y>=n||![33,65,129,257].includes(resolution))throw new Error('Invalid regional tile.');
  const west=-180+tile.x/n*360,north=90-tile.y/n*180,span_lon=360/n,span_lat=180/n,samples=new Int16Array(resolution*resolution);
  const salt=Math.floor(randomSeed(seed)()*2**31);
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const p={lat_deg:north-y/(resolution-1)*span_lat,lon_deg:west+x/(resolution-1)*span_lon};
    const v=toVector(p);
    // The same residual field is evaluated at every tile level, never reseeded per tile.
    const detail=detail_m*fractal(v,salt,256,3);
    samples[y*resolution+x]=Math.round(Math.max(-20000,Math.min(20000,sampleElevation(base,p)+detail)));
  }
  return {...tile,width:resolution,height:resolution,samples,west,north,span_lon,span_lat};
}
export class TileCache {
  private entries=new Map<string,RegionTile>(); private used=0;
  constructor(readonly limitBytes=8*1024*1024){}
  get bytes(){return this.used;}get size(){return this.entries.size;}
  get(key:string){const v=this.entries.get(key);if(v){this.entries.delete(key);this.entries.set(key,v);}return v;}
  put(key:string,tile:RegionTile){if(this.entries.has(key)){this.used-=this.entries.get(key)!.samples.byteLength;this.entries.delete(key);}const bytes=tile.samples.byteLength;if(bytes>this.limitBytes)return;
    while(this.used+bytes>this.limitBytes){const first=this.entries.keys().next().value!;this.used-=this.entries.get(first)!.samples.byteLength;this.entries.delete(first);}
    this.entries.set(key,tile);this.used+=bytes;
  }
  clear(){this.entries.clear();this.used=0;}
}
