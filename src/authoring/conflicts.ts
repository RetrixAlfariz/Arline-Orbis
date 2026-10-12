import { geoContains, geoDistance } from 'd3-geo';
import { toVector } from '../geo/coordinates';
import { featureGeometry } from '../core/authoring';
import type { Project } from '../core/project';
import type { Coordinate } from '../core/world';
import type { ElevationRaster } from '../terrain/sample';
import { sampleElevation } from '../terrain/sample';
import { strokeTouches } from '../terrain/sculpt';
import type { TerrainStroke } from '../terrain/sculpt';
/** Angular distance to the minor great-circle arc. No sample-density blind spots. */
export function arcDistanceRadians(point:Coordinate,start:Coordinate,end:Coordinate):number {
  const a=toVector(start),b=toVector(end),p=toVector(point);
  const dot=(x:number[],y:number[])=>x.reduce((sum,v,i)=>sum+v*y[i],0);
  const angle=(x:number[],y:number[])=>Math.acos(Math.max(-1,Math.min(1,dot(x,y))));
  const arc=angle(a,b),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // Antipodal endpoints do not define a unique arc. Conservatively protect it.
  if(Math.PI-arc<1e-8)return 0;
  let best=Math.min(geoDistance([point.lon_deg,point.lat_deg],[start.lon_deg,start.lat_deg]),geoDistance([point.lon_deg,point.lat_deg],[end.lon_deg,end.lat_deg]));
  const length=Math.hypot(...normal);if(length<1e-12)return best;
  const n=normal.map(v=>v/length),alongNormal=dot(p,n),q=p.map((v,i)=>v-alongNormal*n[i]);
  const qLength=Math.hypot(...q);if(qLength<1e-12)return best;
  const candidate=q.map(v=>v/qLength);
  if(Math.abs(angle(a,candidate)+angle(candidate,b)-arc)<1e-7)best=Math.min(best,Math.asin(Math.min(1,Math.abs(alongNormal))));
  return best;
}
export function lockedStrokeConflicts(project:Project,stroke:TerrainStroke):string[]{
  const names:string[]=[],radius=stroke.radius_km*1000/project.planet.radius_m;
  const intersects=(a:Coordinate,b:Coordinate)=>arcDistanceRadians(stroke,a,b)<=radius+1e-12;
  for(const l of project.landmarks)if(l.locked&&strokeTouches(l.position,stroke,project.planet.radius_m))names.push(l.name);
  const caveNodes=project.caves?.nodes??[];
  for(const n of caveNodes)if(n.locked&&strokeTouches(n.position,stroke,project.planet.radius_m))names.push(n.name);
  const nodeMap=new Map(caveNodes.map(n=>[n.id,n]));
  for(const e of project.caves?.edges??[])if(e.locked&&e.kind!=='portal'){
    const a=nodeMap.get(e.from),b=nodeMap.get(e.to);if(a&&b&&intersects(a.position,b.position))names.push(e.name);
  }
  for(const f of project.features??[])if(f.locked){
    const isArea=['polygon','region'].includes(f.kind);
    let hit=isArea&&geoContains(featureGeometry(f),[stroke.lon_deg,stroke.lat_deg]);
    const vertices=isArea?[...f.coordinates,f.coordinates[0]]:f.coordinates;
    for(let i=0;i<vertices.length&&!hit;i++){
      hit=strokeTouches(vertices[i],stroke,project.planet.radius_m)||(i>0&&intersects(vertices[i-1],vertices[i]));
    }
    if(hit)names.push(f.name);
  }
  return names;
}
export interface RegenerationConflict { id:string; name:string; locked:boolean; before_m:number; after_m:number }
export function regenerationConflicts(project:Project,before:ElevationRaster,after:ElevationRaster):RegenerationConflict[]{
  const anchors:{id:string;name:string;locked:boolean;position:Coordinate}[]=[
    ...project.landmarks.map(l=>({...l,locked:!!l.locked})),
    ...(project.features??[]).flatMap(f=>f.coordinates.map((p,i)=>({id:f.id+':'+i,name:f.name,locked:f.locked,position:p}))),
    ...(project.caves?.nodes??[]).map(n=>({id:n.id,name:n.name,locked:n.locked,position:n.position})),
  ];
  return anchors.map(a=>({id:a.id,name:a.name,locked:a.locked,before_m:sampleElevation(before,a.position),after_m:sampleElevation(after,a.position)}))
    .filter(a=>a.before_m!==a.after_m);
}
