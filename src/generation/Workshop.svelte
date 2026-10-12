<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { Project } from '../core/project';
  import type { Coordinate } from '../core/world';
  import type { ElevationRaster } from '../terrain/sample';
  import { sampleElevation } from '../terrain/sample';
  import { DEFAULT_OPTIONS, validateOptions, type GenerationOptions } from './options';
  import { startGeneration, type GenerationTask } from './client';
  import type { WorldData } from './pipeline';
  import { STAGES, STAGE_LABELS, PREVIEW_LIMIT, worldBytes, type StageFrame, type StageId } from './stages';
  import { RECIPES, candidateSeeds } from './recipes';
  import { projectFingerprint, proposedWorld, type WorkshopView } from './workshop';
  import { terrainTexture } from '../render/terrainTexture';
  import { systemTexture, LAYER_LABELS, type SystemLayer } from '../render/systemTexture';
  import { regenerationConflicts } from '../authoring/conflicts';
  let { project, raster, active, visible, point, onpreview, onregion, onapply, onexit, onatlas }: {
    project:Project; raster:ElevationRaster; active:boolean; visible:boolean; point:Coordinate;
    onpreview:(view:WorkshopView|null)=>void; onregion:(region:{center:Coordinate;radius_km:number}|null)=>void; onapply:(p:Project,data:WorldData)=>void; onexit:()=>void; onatlas:()=>void;
  }=$props();
  type Candidate={seed:string; data:WorldData; image:string; proposed:Project};
  let options=$state<GenerationOptions>({...DEFAULT_OPTIONS}),seed=$state(''),sea=$state(0);
  let scope=$state<'world'|'region'|'remove'>('world'),radius=$state(500),center=$state<Coordinate>({lat_deg:30,lon_deg:-55});
  let selection=$state<Coordinate>({lat_deg:30,lon_deg:-55}),selected=$state(0),stage=$state<StageId>('review');
  let climateLayer=$state<'temperature'|'rainfall'>('temperature');
  let section=$state<'parameters'|'stages'|'review'>('parameters');
  let removed=$state<string[]>([]),candidates=$state.raw<(Candidate|null)[]>([null,null,null]);
  let frames=$state.raw<Partial<Record<StageId,StageFrame>>>({}),finalData=$state.raw<WorldData|null>(null);
  let finalProject=$state.raw<Project|null>(null),finalKey=$state('');
  let generationId=0,regionId=crypto.randomUUID(),task:GenerationTask|undefined,autoTimer:ReturnType<typeof setTimeout>|undefined;
  let busy=$state(false),progress=$state(''),pct=$state(0),error=$state(''),ack=$state(false),memory=$state(0);
  let lastWorld='',suspended=false;
  const fingerprint=$derived(projectFingerprint(project));
  const settings=$derived(JSON.stringify({options,seed,sea,scope,radius,center,removed}));
  const recipe=$derived(RECIPES.find(r=>JSON.stringify(r.options)===JSON.stringify(options)&&r.sea_level_m===sea)?.name??'Custom');
  const selectedCandidate=$derived(candidates[selected]);
  const conflicts=$derived(finalData?regenerationConflicts(project,raster,finalData.raster):[]);
  const runnable=$derived(active&&visible);
  const validFinal=$derived(!!finalData&&finalKey===settings+'|'+fingerprint+'|'+selected);
  const currentFrame=$derived(frames[stage]);
  const data=$derived(stage==='review'?(finalData??selectedCandidate?.data??frames.review?.data):currentFrame?.data);
  const layer=$derived<SystemLayer>(stage==='tectonics'?'plates':stage==='climate'?climateLayer:stage==='water'?'water':stage==='biomes'?'biomes':'relief');
  $effect(()=>{
    if(project.planet.id!==lastWorld){
      lastWorld=project.planet.id;
      untrack(()=>{options={...DEFAULT_OPTIONS,...project.generation_options};seed=project.planet.seed;sea=project.planet.sea_level_m;
        center={...project.selection};selection={...project.selection};removed=[];scope='world';});
    }
  });
  $effect(()=>{const p=point;untrack(()=>{selection={...p};if(scope==='region')center={...p};});});
  $effect(()=>{
    const key=settings+'|'+fingerprint; const enabled=runnable,shown=visible;
    untrack(()=>{
      cancel();
      if(!enabled){suspended=true;if(!shown){candidates=[null,null,null];frames={};finalData=null;finalProject=null;memory=0;}return;}
      suspended=false;
      candidates=[null,null,null];frames={};finalData=null;finalProject=null;ack=false;memory=0;
    });
    if(!enabled)return;
    const timer=setTimeout(()=>{autoTimer=undefined;void generate(false);},600);autoTimer=timer;
    return()=>clearTimeout(timer);
  });
  $effect(()=>{onregion(visible&&scope==='region'?{center:{...center},radius_km:radius}:null);});
  $effect(()=>{
    const frameData=data,region=scope==='region'?{center:{...center},radius_km:radius}:null;
    if(!visible){onpreview(null);return;}
    if(!frameData){onpreview(null);return;}
    const planet=(finalProject??selectedCandidate?.proposed)?.planet??{...project.planet,sea_level_m:sea};
    const actualLayer=currentFrame?.skipped?'relief':layer;
    onpreview({data:frameData,planet,selection,layer:actualLayer,
      texture:actualLayer==='relief'?terrainTexture(frameData.raster,{seaLevel:planet.sea_level_m,showWater:true,bathymetry:false,style:'natural'}):systemTexture(frameData,actualLayer),
      label:STAGE_LABELS[stage]+(currentFrame?.skipped?' · Skipped':''),final:stage==='review'&&validFinal,region});
  });
  function cancel(){if(autoTimer){clearTimeout(autoTimer);autoTimer=undefined;}generationId++;task?.cancel();task=undefined;busy=false;}
  function budget(){
    let bytes=(finalData?worldBytes(finalData):0)+candidates.reduce((sum,c)=>sum+(c?worldBytes(c.data)+c.image.length*2:0),0)+Object.values(frames).reduce((sum,f)=>sum+worldBytes(f!.data),0);
    for(let i=0;i<3&&bytes>PREVIEW_LIMIT;i++)if(i!==selected&&candidates[i]){bytes-=worldBytes(candidates[i]!.data)+candidates[i]!.image.length*2;candidates=candidates.map((c,j)=>j===i?null:c);}
    if(bytes>PREVIEW_LIMIT){frames={};bytes=(finalData?worldBytes(finalData):0)+candidates.reduce((s,c)=>s+(c?worldBytes(c.data)+c.image.length*2:0),0);}
    memory=bytes;if(bytes>PREVIEW_LIMIT)throw new Error('Preview exceeds the 64 MiB limit. Choose a lower final detail.');
  }
  function proposal(which:number){
    if(!seed.trim()||seed.length>100)throw new Error('Enter a seed of 1–100 characters.');
    const config=validateOptions(options);
    if(scope!=='world')config.resolution=raster.width as GenerationOptions['resolution'];
    return proposedWorld(project,candidateSeeds(seed)[which],config,sea,scope==='region'?{id:regionId,center,radius_km:radius}:null,removed,scope==='remove');
  }
  async function run(which:number,full:boolean,id:number):Promise<Candidate|null>{
    const proposed=proposal(which),config=proposed.generation_options!;
    const next=startGeneration({planet:proposed.planet,strokes:proposed.terrain_strokes??[],regions:proposed.regional_replacements??[],options:config,
      width:full?config.resolution:180,height:full?config.resolution/2+1:91},(s,p)=>{if(id===generationId){progress=s;pct=p;}},which===selected?f=>{if(id===generationId){frames={...frames,[f.id]:f};budget();}}:undefined);
    task=next;const result=await next.result;
    if(id!==generationId)return null;
    const image=terrainTexture(result.raster,{seaLevel:proposed.planet.sea_level_m,showWater:true,bathymetry:false,style:'natural'}).toDataURL();
    if(full){finalData=result;finalProject=proposed;finalKey=settings+'|'+fingerprint+'|'+selected;budget();return null;}
    return {seed:candidateSeeds(seed)[which],data:result,image,proposed};
  }
  async function generate(full:boolean,compare=false){
    cancel();if(full)stage='review';if(compare)section='stages';const id=generationId;busy=true;error='';ack=false;pct=0;frames={};finalData=null;finalProject=null;
    try{
      proposal(selected);
      const order=compare?[selected,...[0,1,2].filter(i=>i!==selected)]:[selected];
      for(const which of order){progress=`Candidate ${which+1}`;const c=await run(which,full,id);if(id!==generationId)return;
        if(c){candidates=candidates.map((item,i)=>i===which?c:item);budget();}}
      if(id===generationId){busy=false;task=undefined;progress=full?'Final result ready':'Draft ready';if(full)section='review';}
    }catch(e){if(id===generationId){busy=false;task=undefined;if((e as Error).name!=='AbortError'){error=(e as Error).message;if(error.includes('64 MiB')){finalData=null;frames={};onpreview(null);}}}}
  }
  function choose(i:number){cancel();selected=i;frames={};stage='review';finalData=null;finalProject=null;ack=false;void generate(false);}
  function apply(){
    if(!validFinal||!finalProject||!finalData||conflicts.length&&!ack)return;
    try{proposal(selected);onapply({...finalProject,selection:project.selection,drafts:project.drafts},finalData);regionId=crypto.randomUUID();onexit();}
    catch(e){error=(e as Error).message;}
  }
  function preset(name:string){const r=RECIPES.find(r=>r.name===name);if(r){options={...r.options,...(scope!=='world'?{resolution:raster.width as GenerationOptions['resolution']}: {})};sea=r.sea_level_m;}}
  function regionMode(){scope='region';options.resolution=raster.width as GenerationOptions['resolution'];center={...selection};onatlas();}
  onDestroy(()=>{cancel();onpreview(null);});
</script>

<div class="generation-workshop" class:review-section={section==='review'} aria-label="Generation workshop controls">
  <nav class="workshop-nav" aria-label="Workshop sections">{#each ['parameters','stages','review'] as tab}<button aria-pressed={section===tab} onclick={()=>{section=tab as typeof section;if(tab==='review')stage='review';}}>{tab[0].toUpperCase()+tab.slice(1)}</button>{/each}</nav>
  <div class="workshop-pane" hidden={section!=='parameters'} aria-label="Generation parameters">
  <div class="workshop-scope"><button aria-pressed={scope==='world'} onclick={()=>scope='world'}>Whole world</button><button aria-pressed={scope==='region'} onclick={regionMode}>Replace region</button></div>
  {#if scope==='remove'}<p class="help-text">Review regional edit removals. Base seed and geological algorithm are preserved.</p>{/if}
  <label>World recipe<select aria-label="World recipe" value={recipe} onchange={e=>preset(e.currentTarget.value)}><option value="Custom" disabled>Custom</option>{#each RECIPES as r}<option>{r.name}</option>{/each}</select></label>
  <p class="help-text">Recipes guide the geography; individual results vary by seed.</p>
  <label>Geology seed<input aria-label="Workshop seed" bind:value={seed} maxlength="100" disabled={scope==='remove'} /></label>
  {#if scope==='region'}
    <p class="help-text">Pick a center in the atlas. Boundary includes a 20% blended edge. Locked content is protected.</p>
    <div class="coordinate-inputs"><label>Latitude<input aria-label="Region latitude" type="number" bind:value={center.lat_deg} min="-90" max="90" step="any" /></label><label>Longitude<input aria-label="Region longitude" type="number" bind:value={center.lon_deg} min="-180" max="180" step="any" /></label></div>
    <label>Radius (km)<input aria-label="Replacement radius" type="number" bind:value={radius} min="1" max="2500" /></label>
    <p class="help-text">Climate and water networks can change beyond this boundary. Final detail matches the current world to preserve outside elevation samples.</p>
  {/if}
  <label>Final detail<select aria-label="Workshop detail" bind:value={options.resolution} disabled={scope!=='world'}><option value={360}>Low · 360 × 181</option><option value={720}>Standard · 720 × 361</option><option value={1440}>High · 1440 × 721</option></select></label>
  <div class="coordinate-inputs"><label>Plates<input aria-label="Workshop plate count" type="number" bind:value={options.plate_count} min="4" max="32" /></label><label>Continental fraction<input aria-label="Workshop continental fraction" type="number" bind:value={options.continental_fraction} min=".1" max=".8" step=".01" /></label></div>
  <label>Roughness<input aria-label="Workshop roughness" type="range" bind:value={options.roughness} min="0" max="2" step=".1" /></label>
  <label>Sea level (m)<input aria-label="Workshop sea level" type="number" bind:value={sea} min="-20000" max="20000" /></label>
  <details><summary>Seafloor parameters</summary>{#each [['ridge_m','Ridge uplift',5000],['rift_m','Rift depression',2000],['trench_m','Trench incision',8000],['seamount_m','Seamount uplift',6000]] as [key,label,max]}
    <label>{label} (m)<input type="number" aria-label={`Workshop ${label}`} value={options[key as keyof GenerationOptions] as number} min="0" max={max} oninput={e=>options={...options,[key]:e.currentTarget.valueAsNumber}} /></label>{/each}</details>
  <label class="check-label"><input type="checkbox" bind:checked={options.erosion}/>Erosion and sediment</label>
  <label class="check-label"><input type="checkbox" bind:checked={options.climate}/>Climate and biomes</label>
  <label class="check-label"><input type="checkbox" bind:checked={options.hydrology}/>Lakes and rivers</label>
  {#if project.regional_replacements?.length}<details><summary>Saved regional replacements ({project.regional_replacements.length})</summary>{#each project.regional_replacements as r}<div class="region-operation"><span>{r.seed} · {r.radius_km} km</span><button aria-pressed={removed.includes(r.id)} onclick={()=>{removed=removed.includes(r.id)?removed.filter(id=>id!==r.id):[...removed,r.id];scope='remove';options.resolution=raster.width as GenerationOptions['resolution'];}}>{removed.includes(r.id)?'Keep':'Remove in preview'}</button></div>{/each}<p class="help-text">Removal takes effect only when a reviewed final result is applied.</p></details>{/if}
  </div>
  <div class="workshop-pane" hidden={section!=='stages'} aria-label="Pipeline inspection">
  <p class="help-text">Inspect each step. Tectonics shows plate regions; Review shows the resulting landscape.</p>
  <div class="seed-candidates">{#each candidates as c,i}<button aria-label={`Select candidate ${i+1}`} aria-pressed={selected===i} onclick={()=>choose(i)}>{#if c}<img src={c.image} alt={`Terrain for seed ${c.seed}`} />{/if}<span>Seed {i+1}</span><small>{c?.seed??'Not generated'}</small></button>{/each}</div>
  <ol class="generation-stages" aria-label="Generation stages">{#each STAGES as id}<li><button aria-pressed={stage===id} disabled={!frames[id]&&(id!=='review'||!selectedCandidate)} onclick={()=>stage=id}><span>{STAGE_LABELS[id]}</span><small>{frames[id]?.skipped?'Skipped':frames[id]?`${Math.round(frames[id]!.ms)} ms`:'Waiting'}</small></button></li>{/each}</ol>
  {#if stage==='climate'}<label>Climate layer<select aria-label="Preview climate layer" bind:value={climateLayer}><option value="temperature">Temperature</option><option value="rainfall">Rainfall</option></select></label>{/if}
  </div>
  <div class="workshop-pane" hidden={section!=='review'} aria-label="Review generated world">
  <p class="help-text">{validFinal?'Final landscape ready. Review the map before applying.':'This is a quick draft, not the saved world. Generate final to review the full-detail landscape.'}</p>
  {#if conflicts.length}<p>{conflicts.length} authored anchors have changed surroundings.</p><div class="conflict-list">{#each conflicts.slice(0,50) as c}<p>{c.name}: {c.before_m} → {c.after_m} m{c.locked?' · Locked':''}</p>{/each}</div><label class="check-label"><input aria-label="Accept workshop terrain changes" type="checkbox" bind:checked={ack}/>Keep authored coordinates, elevations and locks; accept changed surrounding terrain.</label>{/if}
  </div>
  <div class="workshop-actions">
  <div class="action-row"><button onclick={()=>generate(false,true)} disabled={!runnable||scope==='remove'}>Compare three seeds</button><button onclick={()=>generate(true)} disabled={!runnable}>Generate final</button></div>
  {#if busy}<p role="status">{progress} · {Math.round(pct)}%</p><progress max="100" value={pct}></progress><button class="secondary" onclick={()=>{cancel();progress='Generation cancelled';}}>Cancel generation</button>{/if}
  {#if data}<div class="workshop-review" data-testid="workshop-preview"><p>{validFinal&&stage==='review'?'Final result':'Draft preview'} · {data.raster.width} × {data.raster.height}</p><p>{LAYER_LABELS[currentFrame?.skipped?'relief':layer]} · {sampleElevation(data.raster,selection).toLocaleString()} m at preview selection</p><small>{(memory/1024/1024).toFixed(1)} / 64 MiB retained</small></div>{/if}
  <button class="primary" disabled={!validFinal||!!conflicts.length&&!ack} onclick={apply}>Apply reviewed world</button>
  <button class="secondary" onclick={()=>{cancel();candidates=[null,null,null];frames={};finalData=null;onpreview(null);onexit();}}>Discard preview / Return to world</button>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
</div>
