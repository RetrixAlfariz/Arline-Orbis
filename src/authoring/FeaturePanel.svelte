<script lang="ts">
  import type { Coordinate } from '../core/world';
  import type { Project } from '../core/project';
  import { authoringProject, decodeProject } from '../core/project';
  import { emptyScope } from '../core/authoring';
  import type { MapFeature } from '../core/authoring';
  let {project,selection,vertices,drawing,onstart,onclear,onchange,oninspect} : {
    project:Project;selection:Coordinate;vertices:Coordinate[];drawing:MapFeature['kind']|null;
    onstart:(kind:MapFeature['kind'])=>void;onclear:()=>void;onchange:(p:Project,label:string)=>void;
    oninspect:(p:Coordinate)=>void;
  }=$props();
  let id=$state(''),name=$state(''),kind=$state<MapFeature['kind']>('line'),layer=$state<MapFeature['layer']>('road');
  let coordinates=$state(''),description=$state(''),tags=$state(''),references=$state(''),era=$state(''),water=$state(100),err=$state('');
  const chosen=$derived(project.features?.find(f=>f.id===id));
  let eraName=$state('');
  $effect(()=>{if(drawing)coordinates=vertices.map(p=>p.lat_deg.toFixed(6)+', '+p.lon_deg.toFixed(6)).join('\n');});
  function choose(f:MapFeature){id=f.id;name=f.name;kind=f.kind;layer=f.layer;description=f.description;tags=f.tags.join(', ');references=f.references.join('\n');era=f.era_id??'';water=f.water_level_m??100;onclear();coordinates=f.coordinates.map(p=>p.lat_deg+', '+p.lon_deg).join('\n');oninspect(f.coordinates[0]);err='';}
  function commit(next:Project,label:string){try{onchange(decodeProject(next),label);err='';}catch(e){err=(e as Error).message;}}
  function save(){try{
    if(chosen?.locked)throw new Error('Unlock the feature before editing.');
    const points=coordinates.trim().split('\n').filter(Boolean).map(line=>{const parts=line.split(',').map(Number);if(parts.length!==2||parts.some(n=>!Number.isFinite(n)))throw new Error('Use latitude, longitude on each line.');return {lat_deg:parts[0],lon_deg:parts[1]};});
    const p=authoringProject(project);const f:MapFeature={...emptyScope(),id:id||crypto.randomUUID(),name:name.trim(),kind,layer,coordinates:points,source:'authored',locked:false,
      description,tags:tags.split(',').map(x=>x.trim()).filter(Boolean),references:references.split('\n').map(x=>x.trim()).filter(Boolean),era_id:era||null,...(layer==='lake'?{water_level_m:water}:{})};
    p.features=[...(p.features??[]).filter(x=>x.id!==f.id),f];const valid=decodeProject(p);onchange(valid,'Saved map feature '+f.name);id=f.id;onclear();err='';
  }catch(e){err=(e as Error).message;}}
  function lock(){if(!chosen)return;const p=authoringProject(project);p.features=p.features!.map(f=>f.id===id?{...f,locked:!f.locked}:f);commit(p,chosen.locked?'Feature unlocked':'Feature locked');}
  function remove(){if(!chosen||chosen.locked)return;const p=authoringProject(project);p.features=p.features!.filter(f=>f.id!==id);commit(p,'Feature deleted. Undo is available.');id='';name='';coordinates='';}
  function newFeature(){id='';name='';coordinates='';description='';tags='';references='';err='';onstart(kind);}
  function addEra(){try{const p=authoringProject(project);const entry={id:crypto.randomUUID(),name:eraName.trim(),description:''};p.eras=[...p.eras!,entry];const valid=decodeProject(p);onchange(valid,'Added story era '+entry.name);era=entry.id;eraName='';err='';}catch(e){err=(e as Error).message;}}
</script>
<details class="inspector-tool authoring-panel">
  <summary>Map features &amp; lore <span class="tool-count">{project.features?.length??0}</span></summary>
  <p class="help-text">Author lines, regions and lakes in geographic coordinates. Labels, lore and locks survive projection changes.</p>
  <label>Feature record<select aria-label="Feature record" value={id} onchange={e=>{const f=project.features?.find(x=>x.id===e.currentTarget.value);if(f)choose(f);else{id='';onclear();}}}><option value="">New feature</option>{#each project.features??[] as f}<option value={f.id}>{f.name}{f.locked?' · locked':''}</option>{/each}</select></label>
  <form onsubmit={e=>{e.preventDefault();save();}}>
    <label>Feature name<input aria-label="Feature name" bind:value={name} disabled={chosen?.locked} required maxlength="120" /></label>
    <div class="action-row">
      <label>Geometry<select aria-label="Feature geometry" bind:value={kind} disabled={chosen?.locked}><option value="point">Point</option><option value="line">Polyline</option><option value="polygon">Polygon</option><option value="region">Region</option></select></label>
      <label>Layer<select aria-label="Feature layer" bind:value={layer} disabled={chosen?.locked}><option value="road">Road</option><option value="border">Border</option><option value="river">River</option><option value="lake">Lake</option><option value="region">Region</option><option value="landmark">Landmark</option></select></label>
    </div>
    <div class="action-row"><button type="button" disabled={chosen?.locked} onclick={newFeature}>Start drawing</button><button type="button" disabled={chosen?.locked||!!drawing} onclick={()=>coordinates+=(coordinates?'\n':'')+selection.lat_deg+', '+selection.lon_deg}>Add selection</button></div>
    {#if drawing}<p class="draft-notice">Drawing {drawing}: click map vertices. <button type="button" onclick={onclear}>Stop drawing</button></p>{/if}
    <label>Vertices: latitude, longitude<textarea aria-label="Feature coordinates" rows="4" bind:value={coordinates} disabled={chosen?.locked} required spellcheck="false"></textarea></label>
    {#if layer==='lake'}<label>Lake surface altitude (m)<input type="number" aria-label="Lake surface altitude (m)" bind:value={water} disabled={chosen?.locked} min="-20000" max="20000" required /></label>{/if}
    <label>Lore<textarea aria-label="Feature lore" rows="3" bind:value={description} disabled={chosen?.locked} maxlength="10000"></textarea></label>
    <label>Tags, separated by commas<input aria-label="Feature tags" bind:value={tags} disabled={chosen?.locked} /></label>
    <label>Story references, one per line<textarea aria-label="Story references" rows="2" bind:value={references} disabled={chosen?.locked}></textarea></label>
    <label>Story era<select aria-label="Feature story era" bind:value={era} disabled={chosen?.locked}><option value="">All eras / timeless</option>{#each project.eras??[] as e}<option value={e.id}>{e.name}</option>{/each}</select></label>
    <button class="primary" disabled={chosen?.locked}>Save feature</button>
  </form>
  {#if chosen}<div class="action-row"><button onclick={lock}>{chosen.locked?'Unlock feature':'Lock feature'}</button><button disabled={chosen.locked} onclick={remove}>Delete feature</button></div>{/if}
  <details><summary>Manage local eras</summary><label>New era name<input aria-label="New era name" bind:value={eraName} maxlength="120" /></label><button class="secondary" onclick={addEra}>Add era</button></details>
  {#if err}<p role="alert" class="error">{err}</p>{/if}
</details>
