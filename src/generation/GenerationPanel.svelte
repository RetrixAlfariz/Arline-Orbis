<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Project } from '../core/project';
  import { authoringProject } from '../core/project';
  import type { ElevationRaster } from '../terrain/sample';
  import { DEFAULT_OPTIONS,validateOptions } from './options';
  import type { GenerationOptions } from './options';
  import { startGeneration } from './client';
  import type { GenerationTask } from './client';
  import type { WorldData } from './pipeline';
  import { regenerationConflicts } from '../authoring/conflicts';
  let {project,raster,onapply}:{project:Project;raster:ElevationRaster;onapply:(p:Project,data:WorldData)=>void}=$props();
  let options=$state<GenerationOptions>({...DEFAULT_OPTIONS}),seed=$state('orbis-geology-001');
  let busy=$state(false),stage=$state(''),pct=$state(0),error=$state(''),ack=$state(false);
  let preview=$state<WorldData|null>(null);let proposed:Project|undefined,task:GenerationTask|undefined,fingerprint='';
  const snapshot=(p:Project)=>JSON.stringify({planet:p.planet,strokes:p.terrain_strokes,features:p.features,caves:p.caves,landmarks:p.landmarks,eras:p.eras});
  const conflicts=$derived(preview?regenerationConflicts(project,raster,preview.raster):[]);
  let lastWorld='';
  $effect(()=>{if(project.planet.id!==lastWorld){lastWorld=project.planet.id;options={...DEFAULT_OPTIONS,...project.generation_options};seed=project.planet.seed;}});
  async function generate(){
    task?.cancel();preview=null;error='';ack=false;
    try{const config=validateOptions(options);if(!seed.trim()||seed.length>100)throw new Error('Enter a nonempty seed, at most 100 characters.');
      proposed={...authoringProject(project),planet:{...project.planet,seed:seed.trim(),algorithm_version:'m4-plates-v1'},generation_options:config};
      fingerprint=snapshot(project);busy=true;pct=0;stage='Starting worker';
      const next=startGeneration({planet:proposed.planet,strokes:proposed.terrain_strokes!,options:config,width:config.resolution,height:config.resolution/2+1},(s,p)=>{stage=s;pct=p;});task=next;
      const result=await next.result;if(task===next){preview=result;busy=false;}
    }catch(e){busy=false;error=(e as Error).message;}
  }
  function accept(){
    if(!preview||!proposed)return;
    if(snapshot(project)!==fingerprint){error='The project changed during preview. Generate again before applying.';return;}
    if(conflicts.length&&!ack){error='Review the terrain changes at authored locations first.';return;}
    onapply({...proposed,selection:project.selection,drafts:project.drafts},preview);preview=null;error='';stage='Applied without moving authored anchors.';
  }
  onDestroy(()=>task?.cancel());
</script>
<details class="inspector-tool generation-panel">
  <summary>Planetary generation · M4</summary>
  <p class="help-text">Plate-inspired geology, then optional sediment, climate and drainage. Preview never overwrites the open world.</p>
  <fieldset disabled={busy}>
    <label>Geology seed<input aria-label="Geology seed" bind:value={seed} maxlength="100" /></label>
    <label>Global detail<select aria-label="Generation detail" bind:value={options.resolution}><option value={360}>Low · 360 × 181</option><option value={720}>Standard · 720 × 361</option><option value={1440}>High · 1440 × 721</option></select></label>
    <div class="brush-inputs"><label>Plates<input aria-label="Plate count" type="number" min="4" max="32" bind:value={options.plate_count}/></label><label>Continental fraction<input aria-label="Continental fraction" type="number" min=".1" max=".8" step=".01" bind:value={options.continental_fraction}/></label></div>
    <label>Terrain roughness<input aria-label="Terrain roughness" type="range" min="0" max="2" step=".1" bind:value={options.roughness}/></label>
    <details><summary>Seafloor parameters</summary>
      <label>Ridge uplift (m)<input type="number" aria-label="Ridge uplift (m)" min="0" max="5000" bind:value={options.ridge_m}/></label>
      <label>Rift depression (m)<input type="number" aria-label="Rift depression (m)" min="0" max="2000" bind:value={options.rift_m}/></label>
      <label>Trench incision (m)<input type="number" aria-label="Trench incision (m)" min="0" max="8000" bind:value={options.trench_m}/></label>
      <label>Seamount uplift (m)<input type="number" aria-label="Seamount uplift (m)" min="0" max="6000" bind:value={options.seamount_m}/></label>
    </details>
    <label class="check-label"><input type="checkbox" bind:checked={options.erosion}/>Erosion and sediment</label>
    <label class="check-label"><input type="checkbox" bind:checked={options.climate}/>Temperature, rainfall and biomes</label>
    <label class="check-label"><input type="checkbox" bind:checked={options.hydrology}/>Basins, lakes and rivers</label>
    <button class="secondary" onclick={generate}>Preview generation</button>
  </fieldset>
  {#if busy}<div role="status">{stage} · {Math.round(pct)}%</div><progress max="100" value={pct}></progress><button class="secondary" onclick={()=>task?.cancel()}>Cancel generation</button>{/if}
  {#if preview}<div class="generation-preview" data-testid="generation-preview">
    <p>Preview ready · {preview.raster.width} × {preview.raster.height} · {Math.round(preview.timings.total)} ms</p>
    <p>{preview.plate_centers.length} plates · {preview.hydro?.rivers.length??0} river paths · {preview.hydro?.lake_count??0} lake basins</p>
    {#if conflicts.length}<p>{conflicts.length} authored anchor(s) have different surrounding terrain.</p><div class="conflict-list">{#each conflicts.slice(0,50) as c}<p>{c.locked?'🔒 ':''}{c.name}: {c.before_m} → {c.after_m} m</p>{/each}</div>
    <label class="check-label"><input type="checkbox" aria-label="Accept reviewed terrain changes" bind:checked={ack}/>Keep all authored coordinates, elevations and locks; accept these surrounding terrain changes.</label>{/if}
    <div class="action-row"><button disabled={!!conflicts.length&&!ack} onclick={accept}>Apply generated world</button><button onclick={()=>{preview=null;stage='Preview discarded';}}>Discard preview</button></div>
  </div>{/if}
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  <p class="help-text">Heuristic worldbuilding model, not a scientifically validated tectonic or climate simulator.</p>
</details>
