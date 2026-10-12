import type { WorldData } from '../generation/pipeline';
export type SystemLayer='relief'|'plates'|'landforms'|'temperature'|'rainfall'|'biomes'|'water';
export const LAYER_LABELS:Record<SystemLayer,string>={relief:'Surface relief',plates:'Tectonic plates',landforms:'Seafloor structures',temperature:'Temperature (°C)',rainfall:'Rainfall (mm/year)',biomes:'Biomes',water:'Lakes and basins'};
const palette=['#47718a','#a6ba7a','#dbca9e','#d99e5b','#aa5b3e','#654780','#708994','#ddbc75'];
const biomePalette=['#467c9a','#f3f6ed','#b6c6ba','#647e63','#729168','#c3bc79','#d9c391','#427550','#7ba5aa'];
function rgb(hex:string):[number,number,number]{return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
export function systemTexture(data:WorldData,layer:Exclude<SystemLayer,'relief'>):HTMLCanvasElement{
  const {width,height,samples}=data.raster;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!,img=ctx.createImageData(width,height);
  for(let i=0;i<samples.length;i++){
    let c:[number,number,number];
    if(layer==='plates'){const id=data.plates[i];c=rgb(palette[id%palette.length]);const factor=1-Math.floor(id/palette.length)*.09;c=c.map(v=>v*factor) as typeof c;}
    else if(layer==='landforms')c=rgb(palette[data.landforms[i]%palette.length]);
    else if(layer==='biomes')c=rgb(biomePalette[data.biome[i]]);
    else if(layer==='temperature'){const t=Math.max(0,Math.min(1,(data.temperature[i]+40)/75));c=[50+190*t,130+60*(1-Math.abs(2*t-1)),210-160*t];}
    else if(layer==='rainfall'){const r=Math.min(1,data.rainfall[i]/3000);c=[228-195*r,213-80*r,167+10*r];}
    else c=data.hydro&&Number.isFinite(data.hydro.water_surface[i])?rgb(data.hydro.water_surface[i]>0?'#67b9c2':'#32597c'):rgb('#d3ccae');
    img.data[i*4]=c[0];img.data[i*4+1]=c[1];img.data[i*4+2]=c[2];img.data[i*4+3]=255;
  }
  ctx.putImageData(img,0,0);return canvas;
}
