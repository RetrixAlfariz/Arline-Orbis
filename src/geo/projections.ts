import { geoEquirectangular, geoEqualEarth, geoOrthographic, geoAzimuthalEquidistant, geoDistance } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { Coordinate } from '../core/world';
import { coordinate } from './coordinates';
export type ProjectionKind = 'equirectangular' | 'equal-earth' | 'orthographic' | 'regional';
export function makeProjection(kind:ProjectionKind,center:Coordinate={lat_deg:0,lon_deg:0},width=1000,height=500):GeoProjection {
  switch(kind){
    case 'equirectangular':return geoEquirectangular().scale(width/(2*Math.PI)).translate([width/2,height/2]);
    case 'equal-earth':return geoEqualEarth().fitExtent([[4,4],[width-4,height-4]],{type:'Sphere'});
    case 'orthographic':return geoOrthographic().rotate([-center.lon_deg,-center.lat_deg]).scale(Math.min(width,height)/2-6).translate([width/2,height/2]).clipAngle(90);
    case 'regional':return geoAzimuthalEquidistant().rotate([-center.lon_deg,-center.lat_deg]).scale(Math.min(width,height)/Math.PI).translate([width/2,height/2]).clipAngle(85).clipExtent([[0,0],[width,height]]);
  }
}
export function projectPoint(projection:GeoProjection,kind:ProjectionKind,center:Coordinate,p:Coordinate):[number,number]|null{
  if(['orthographic','regional'].includes(kind)&&geoDistance([center.lon_deg,center.lat_deg],[p.lon_deg,p.lat_deg])>(kind==='orthographic'?Math.PI/2:85*Math.PI/180)+1e-8)return null;
  return projection([p.lon_deg,p.lat_deg]);
}
export function invertPoint(projection:GeoProjection,kind:ProjectionKind,center:Coordinate,x:number,y:number):Coordinate|null{
  const p=projection.invert?.([x,y]);if(!p||!p.every(Number.isFinite)||Math.abs(p[1])>90+1e-8)return null;
  const result=coordinate(Math.max(-90,Math.min(90,p[1])),p[0]),xy=projectPoint(projection,kind,center,result);
  return xy&&Math.hypot(xy[0]-x,xy[1]-y)<.05?result:null;
}
/** View-only raster reprojection; authoritative geometry remains geographic. */
export function reprojectTexture(source:HTMLCanvasElement,projection:GeoProjection,kind:ProjectionKind,center:Coordinate):string{
  if(kind==='equirectangular')return source.toDataURL();
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=500;
  const input=source.getContext('2d')!.getImageData(0,0,source.width,source.height).data;
  const ctx=canvas.getContext('2d')!,output=ctx.createImageData(1000,500);
  for(let y=0;y<500;y++)for(let x=0;x<1000;x++){
    const p=invertPoint(projection,kind,center,x+.5,y+.5);if(!p)continue;
    const col=Math.min(source.width-1,Math.floor((p.lon_deg+180)/360*source.width));
    const row=Math.min(source.height-1,Math.floor((90-p.lat_deg)/180*(source.height-1)));
    const s=(row*source.width+col)*4,d=(y*1000+x)*4;
    output.data[d]=input[s];output.data[d+1]=input[s+1];output.data[d+2]=input[s+2];output.data[d+3]=255;
  }
  ctx.putImageData(output,0,0);return canvas.toDataURL();
}
