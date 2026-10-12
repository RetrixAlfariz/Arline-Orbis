import type { ElevationRaster } from '../terrain/sample';
export function cellAreas(width:number,height:number,radius_m:number):Float64Array {
  const dy=Math.PI/(height-1),dx=2*Math.PI/width;
  return Float64Array.from({length:height},(_,y)=>{
    const latitude=Math.PI/2-y*dy,upper=Math.min(Math.PI/2,latitude+dy/2),lower=Math.max(-Math.PI/2,latitude-dy/2);
    return radius_m*radius_m*dx*(Math.sin(upper)-Math.sin(lower));
  });
}
/** Area-conserving thermal relaxation on the versioned fixed reference mesh. */
export function metricErosion(raster:ElevationRaster,radius_m:number,iterations=8) {
  const {width,height}=raster,n=width*height,areas=cellAreas(width,height,radius_m);
  const values=Float64Array.from(raster.samples),sediment=new Float32Array(n),step=radius_m*Math.PI/(height-1);
  const volume=()=>values.reduce((sum,v,i)=>sum+v*areas[Math.floor(i/width)],0);
  const volumeBefore=volume();
  for(let iteration=0;iteration<iterations;iteration++){
    const changes=new Float64Array(n);
    for(let y=1;y<height-1;y++){
      const dx=2*Math.PI*radius_m/width*Math.cos((90-y*180/(height-1))*Math.PI/180);
      for(let x=0;x<width;x++){
        const i=y*width+x,candidates=[{i:y*width+(x+width-1)%width,d:dx},{i:y*width+(x+1)%width,d:dx},{i:i-width,d:step},{i:i+width,d:step}];
        let best=candidates[0],slope=0;
        for(const c of candidates){const gradient=(values[i]-values[c.i])/c.d;if(gradient>slope){slope=gradient;best=c;}}
        const drop=values[i]-values[best.i],excess=drop-.012*best.d;
        if(excess>0){
          const ratio=areas[y]/areas[Math.floor(best.i/width)];
          const transfer=Math.min(140,excess*.1,.2*drop/(1+ratio));
          changes[i]-=transfer;changes[best.i]+=transfer*ratio;sediment[best.i]+=transfer*ratio;
        }
      }
    }
    for(let i=0;i<n;i++)values[i]+=changes[i];
    for(const y of [0,height-1]){let sum=0;for(let x=0;x<width;x++)sum+=values[y*width+x];for(let x=0;x<width;x++)values[y*width+x]=sum/width;}
  }
  return {raster:{width,height,samples:Int16Array.from(values,v=>Math.round(v))},sediment,volumeBefore,volumeAfter:volume()};
}
