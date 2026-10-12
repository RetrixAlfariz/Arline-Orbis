import type { CaveGraph, CaveNode } from '../core/authoring';
import { emptyScope } from '../core/authoring';
import { coordinate, toVector } from '../geo/coordinates';
import type { Coordinate } from '../core/world';
import type { ElevationRaster } from '../terrain/sample';
import { sampleElevation } from '../terrain/sample';
import { randomSeed } from '../generation/plates';
export function destination(origin:Coordinate,distance_m:number,bearing:number,radius_m:number):Coordinate{
  const d=distance_m/radius_m,b=bearing*Math.PI/180,lat=origin.lat_deg*Math.PI/180,lon=origin.lon_deg*Math.PI/180;
  const phi=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(b));
  const lambda=lon+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(phi));
  return coordinate(phi*180/Math.PI,lambda*180/Math.PI);
}
export function caveProposal(seed:string,origin:Coordinate,radius_m:number,raster:ElevationRaster):CaveGraph{
  const rnd=randomSeed(seed+':'+origin.lat_deg+':'+origin.lon_deg),prefix=Math.floor(rnd()*2**32).toString(16);
  const nodes:CaveNode[]=[];
  for(let i=0;i<7;i++){
    const p=i?destination(origin,180+i*150+rnd()*100,i%2?70+rnd()*45:250+rnd()*40,radius_m):origin;
    const depth=i?120+i*90+rnd()*100:0;
    nodes.push({...emptyScope(),id:`cave-${prefix}-${i}`,name:i?'Chamber '+i:'Surface entrance',kind:i?'chamber':'entrance',
      position:{...p,altitude_m:Math.max(-19900,sampleElevation(raster,p)-Math.round(depth))},radius_m:i?50+Math.round(rnd()*80):20,height_m:i?30+Math.round(rnd()*50):10,locked:false});
  }
  return {nodes,edges:nodes.slice(1).map((n,i)=>({id:`passage-${prefix}-${i}`,name:'Passage '+(i+1),from:nodes[i<2?0:i-1].id,to:n.id,kind:i===0?'shaft':'tunnel',radius_m:8,locked:false}))};
}
/** Earth-centered positions projected into a local east/north/up frame (meters). */
export function localPoint(origin:Coordinate,point:Coordinate,altitude_m:number,radius_m:number):[number,number,number]{
  const a=toVector(origin,radius_m),b=toVector(point,radius_m+altitude_m),delta=b.map((x,i)=>x-a[i]);
  const lat=origin.lat_deg*Math.PI/180,lon=origin.lon_deg*Math.PI/180;
  const east=[-Math.sin(lon),0,-Math.cos(lon)],north=[-Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)];
  const up=toVector(origin);return [delta.reduce((s,x,i)=>s+x*east[i],0),delta.reduce((s,x,i)=>s+x*up[i],0),delta.reduce((s,x,i)=>s+x*north[i],0)];
}
