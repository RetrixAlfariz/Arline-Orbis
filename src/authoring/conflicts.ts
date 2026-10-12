import { geoContains, geoInterpolate, geoDistance } from 'd3-geo';
import { featureGeometry } from '../core/authoring';
import type { Project } from '../core/project';
import type { Coordinate } from '../core/world';
import type { ElevationRaster } from '../terrain/sample';
import { sampleElevation } from '../terrain/sample';
import { strokeTouches } from '../terrain/sculpt';
import type { TerrainStroke } from '../terrain/sculpt';
export function lockedStrokeConflicts(project:Project,stroke:TerrainStroke):string[]{
  const names:string[]=[];
  for(const l of project.landmarks)if(l.locked&&strokeTouches(l.position,stroke,project.planet.radius_m))names.push(l.name);
  for(const n of project.caves?.nodes??[])if(n.locked&&strokeTouches(n.position,stroke,project.planet.radius_m))names.push(n.name);
  for(const f of project.features??[])if(f.locked){
    const isArea=['polygon','region'].includes(f.kind);
    let hit=isArea&&geoContains(featureGeometry(f),[stroke.lon_deg,stroke.lat_deg]);
    const vertices=isArea?[...f.coordinates,f.coordinates[0]]:f.coordinates;
    for(let i=0;i<vertices.length&&!hit;i++){
      hit=strokeTouches(vertices[i],stroke,project.planet.radius_m);
      if(i){const a=vertices[i-1],b=vertices[i],interpolate=geoInterpolate([a.lon_deg,a.lat_deg],[b.lon_deg,b.lat_deg]);
        // Resolve to less than half a brush radius, bounded by feature input limits.
        const count=Math.min(10000,Math.max(2,Math.ceil(geoDistance([a.lon_deg,a.lat_deg],[b.lon_deg,b.lat_deg])*project.planet.radius_m/(stroke.radius_km*500))));
        for(let k=1;k<count&&!hit;k++){const [lon_deg,lat_deg]=interpolate(k/count);hit=strokeTouches({lat_deg,lon_deg},stroke,project.planet.radius_m);}}
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
