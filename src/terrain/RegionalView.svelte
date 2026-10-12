<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Coordinate } from '../core/world';
  import type { ElevationRaster } from './sample';
  import { TileCache,tileAddress } from './regions';
  import type { RegionTile } from './regions';
  import { terrainTexture } from '../render/terrainTexture';
  let {raster,selection,seed,detail_m,seaLevel,onselect}:{raster:ElevationRaster;selection:Coordinate;seed:string;detail_m:number;seaLevel:number;onselect:(p:Coordinate)=>void}=$props();
  let level=$state(4),tile=$state<RegionTile|null>(null),status=$state(''),busy=$state(false),error=$state(''),revision=0;
  const cache=new TileCache(8*1024*1024);let worker:Worker|undefined;let lastRaster:ElevationRaster|undefined;
  const address=$derived(tileAddress(selection,level));
  const image=$derived(tile?terrainTexture(tile,{seaLevel,showWater:true,bathymetry:false}).toDataURL():'');
  let cacheBytes=$state(0),cacheSize=$state(0);
  $effect(()=>{
    const a=address,base=raster,s=seed,d=detail_m;
    if(lastRaster!==base){cache.clear();lastRaster=base;revision++;}
    const key=[revision,a.level,a.x,a.y,s,d].join(':');worker?.terminate();error='';
    const hit=cache.get(key);if(hit){tile=hit;busy=false;status='Cached tile';return;}
    let active=true;busy=true;status='Loading overview';tile=null;
    try{
      const task=new Worker(new URL('./region.worker.ts',import.meta.url),{type:'module'});worker=task;
      task.onmessage=e=>{if(!active)return;if(e.data.type==='error'){error=e.data.message;busy=false;task.terminate();return;}
        tile=e.data.tile;status=tile!.width+' × '+tile!.height+(e.data.final?' · detailed tile':' · refining');
        if(e.data.final){cache.put(key,tile!);cacheBytes=cache.bytes;cacheSize=cache.size;busy=false;task.terminate();}};
      task.onerror=e=>{e.preventDefault();error=e.message;busy=false;task.terminate();};
      task.postMessage({base,address:a,seed:s,detail_m:d});
    }catch(e){error=(e as Error).message;busy=false;}
    return()=>{active=false;worker?.terminate();};
  });
  onDestroy(()=>worker?.terminate());
  function selectPixel(e:MouseEvent){if(!tile)return;if(e.detail===0){onselect({lat_deg:tile.north-tile.span_lat/2,lon_deg:tile.west+tile.span_lon/2});return;}const box=e.currentTarget as HTMLImageElement;const r=box.getBoundingClientRect();onselect({lat_deg:tile.north-(e.clientY-r.top)/r.height*tile.span_lat,lon_deg:tile.west+(e.clientX-r.left)/r.width*tile.span_lon});}
</script>
<section class="region-workbench" aria-label="Regional detail workspace">
  <header><div><p class="eyebrow">DETAIL ON DEMAND</p><h2>Regional survey</h2></div><span>LOD {level} · tile {address.x}/{address.y}</span></header>
  <div class="map-toolbar"><button disabled={level<=0} onclick={()=>level--}>− Zoom out</button><button disabled={level>=10} onclick={()=>level++}>+ Zoom in</button><span role="status">{status}</span>{#if busy}<button onclick={()=>{worker?.terminate();busy=false;status='Cancelled';}}>Cancel regional detail</button>{/if}</div>
  {#if image}
    <button class="region-image-button" aria-label="Inspect regional terrain" onclick={selectPixel}><img src={image} alt="Detailed geographic terrain tile" class="region-map"/></button>
  {:else}<div class="region-placeholder">{busy?'Generating only the selected region…':'No tile loaded.'}</div>{/if}
  <p class="help-text">Select another point in the atlas to survey a different region. Zoom refines only the selected tile; neighboring tile boundaries share the same geographic samples. Fine relief is a seeded procedural addition, not surveyed geology.</p>
  <p data-testid="tile-cache">Cache: {cacheSize} tiles · {(cacheBytes/1024).toFixed(0)} KiB / 8192 KiB</p>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
</section>
