<script lang="ts">
  import { authoringProject,decodeProject } from '../core/project';
  import type { Project } from '../core/project';
  import type { Coordinate, Position } from '../core/world';
  import { emptyScope,graphRoute,visibleInEra,belowGround } from '../core/authoring';
  import type { CaveNode,CaveEdge,CaveGraph } from '../core/authoring';
  import { sampleElevation } from '../terrain/sample';
  import type { ElevationRaster } from '../terrain/sample';
  import { distanceKm } from '../geo/coordinates';
  import { caveProposal } from './model';
  import CaveScene from './CaveScene.svelte';
  let {project,selection,raster,era,onchange,onselect}:{project:Project;selection:Coordinate;raster:ElevationRaster;era:string|null;onchange:(p:Project,label:string)=>void;onselect:(p:Coordinate)=>void}=$props();
  const graph=$derived(project.caves??{nodes:[],edges:[]});
  let id=$state(''),name=$state(''),kind=$state<CaveNode['kind']>('chamber'),depth=$state(250),height=$state(40),radius=$state(80),description=$state('');
  let latitude=$state(0),longitude=$state(0),altitude=$state(-1000),nodeEra=$state('');
  let from=$state(''),to=$state(''),edgeKind=$state<CaveEdge['kind']>('tunnel'),routeStart=$state(''),routeEnd=$state('');
  let flooded=$state(false),floodLevel=$state(-1000);
  let err=$state(''),slice=$state(-1000),sliceEnabled=$state(false),show3d=$state(false),proposal=$state<CaveGraph|null>(null);
  const node=$derived(graph.nodes.find(n=>n.id===id));
  const nodes=$derived(graph.nodes.filter(n=>visibleInEra(n,era)));
  const nodeIds=$derived(new Set(nodes.map(n=>n.id)));
  const edges=$derived(graph.edges.filter(e=>nodeIds.has(e.from)&&nodeIds.has(e.to)));
  const route=$derived(graphRoute(graph,routeStart,routeEnd,project.planet.radius_m));
  const diagram=$derived.by(()=>{
    const origin=nodes[0]?.position??selection;
    const xs=nodes.map(n=>distanceKm(origin,n.position,project.planet.radius_m));
    const high=Math.max(0,...nodes.map(n=>sampleElevation(raster,n.position)),...nodes.map(n=>n.position.altitude_m+n.height_m/2))+100;
    const low=Math.min(0,...nodes.map(n=>n.position.altitude_m-n.height_m/2))-100;
    const maxX=Math.max(.2,...xs);const y=(m:number)=>215-(m-low)/(high-low)*180;
    return {points:nodes.map((n,i)=>({n,x:35+xs[i]/maxX*630,y:y(n.position.altitude_m),ground:y(sampleElevation(raster,n.position)),r:Math.max(3,Math.min(16,n.height_m/(high-low)*180/2))})),high,low,maxX,seaY:y(project.planet.sea_level_m),sliceY:y(slice)};
  });
  const origin=$derived(nodes[0]?.position??selection);
  const lonDelta=(lon:number)=>((lon-origin.lon_deg+540)%360)-180;
  const spanLon=$derived(Math.max(.02,...nodes.map(n=>Math.abs(lonDelta(n.position.lon_deg)))));
  const spanLat=$derived(Math.max(.02,...nodes.map(n=>Math.abs(n.position.lat_deg-origin.lat_deg))));
  function change(p:Project,label:string){try{onchange(decodeProject(p),label);err='';}catch(e){err=(e as Error).message;}}
  function choose(n:CaveNode){id=n.id;name=n.name;kind=n.kind;height=n.height_m;radius=n.radius_m;description=n.description;latitude=n.position.lat_deg;longitude=n.position.lon_deg;altitude=n.position.altitude_m;nodeEra=n.era_id??'';flooded=n.water_level_m!==undefined;floodLevel=n.water_level_m??n.position.altitude_m;onselect(n.position);show3d=false;}
  function add(){try{
    const p=authoringProject(project);let position:Position;
    if(node){if(node.locked)throw new Error('Unlock this node before editing.');position={lat_deg:latitude,lon_deg:longitude,altitude_m:altitude};}
    else {if(!Number.isFinite(depth)||depth<0)throw new Error('Depth below ground must be nonnegative.');position={...selection,altitude_m:sampleElevation(raster,selection)-depth};}
    if(kind!=='entrance'&&position.altitude_m+height/2>sampleElevation(raster,position))throw new Error('Chamber ceiling must lie below local ground.');
    if(node&&graph.edges.some(e=>e.locked&&(e.from===node.id||e.to===node.id))&&JSON.stringify(position)!==JSON.stringify(node.position))throw new Error('Unlock connected passages before moving their endpoint.');
    const n:CaveNode={...(node??emptyScope()),id:id||crypto.randomUUID(),name:name.trim(),kind,position,radius_m:radius,height_m:height,description,era_id:nodeEra||null,locked:false};
    if(flooded)n.water_level_m=floodLevel;else delete n.water_level_m;
    p.caves={nodes:[...graph.nodes.filter(x=>x.id!==n.id),n],edges:graph.edges};const valid=decodeProject(p);onchange(valid,'Saved underground node '+n.name);choose(n);err='';
  }catch(e){err=(e as Error).message;}}
  function lock(){if(!node)return;const p=authoringProject(project);p.caves={...graph,nodes:graph.nodes.map(n=>n.id===id?{...n,locked:!n.locked}:n)};change(p,'Underground lock changed');}
  function remove(){if(!node||node.locked)return;if(graph.edges.some(e=>(e.from===id||e.to===id)&&e.locked)){err='Unlock connected passages before deleting this node.';return;}const p=authoringProject(project);p.caves={nodes:graph.nodes.filter(n=>n.id!==id),edges:graph.edges.filter(e=>e.from!==id&&e.to!==id)};change(p,'Deleted node and its unlocked passages. Undo is available.');id='';}
  function connect(){const p=authoringProject(project);p.caves={...graph,edges:[...graph.edges,{id:crypto.randomUUID(),name:edgeKind,from,to,kind:edgeKind,radius_m:8,locked:false}]};change(p,'Connected underground passage');}
  function deleteEdge(edge:CaveEdge){if(edge.locked)return;const p=authoringProject(project);p.caves={...graph,edges:graph.edges.filter(e=>e.id!==edge.id)};change(p,'Removed passage');}
  function toggleEdge(edge:CaveEdge){const p=authoringProject(project);p.caves={...graph,edges:graph.edges.map(e=>e.id===edge.id?{...e,locked:!e.locked}:e)};change(p,'Passage lock changed');}
  function acceptProposal(){if(!proposal)return;const p=authoringProject(project);p.caves={nodes:[...graph.nodes,...proposal.nodes],edges:[...graph.edges,...proposal.edges]};try{const v=decodeProject(p);onchange(v,'Accepted cave-network proposal');proposal=null;err='';}catch(e){err=(e as Error).message;}}
</script>
<section class="subsurface-workbench" aria-label="Underground workspace">
  <header><div><p class="eyebrow">BENEATH THE ATLAS</p><h2>Underground passages</h2></div><span>{nodes.length} chambers / entrances · {edges.length} passages</span></header>
  <div class="subsurface-layout">
    <div class="cave-diagrams">
      <div class="map-toolbar"><label class="check-label"><input type="checkbox" bind:checked={sliceEnabled}/>Depth slice</label><label>Altitude (m)<input aria-label="Underground slice altitude" type="number" min="-20000" max="20000" bind:value={slice}/></label><button class="secondary" onclick={()=>show3d=!show3d}>{show3d?'Show section':'Local 3D cave'}</button></div>
      {#if show3d}{#key JSON.stringify(graph)}<CaveScene graph={{nodes,edges}} radius_m={project.planet.radius_m}/>{/key}
      {:else}<svg viewBox="0 0 700 250" role="img" aria-label="Underground depth section" data-testid="cave-section">
        <rect width="700" height="250" fill="#ede5d7"/><line x1="30" x2="675" y1={diagram.seaY} y2={diagram.seaY} stroke="#53879e" stroke-dasharray="5 4"/>
        {#if sliceEnabled}<line x1="30" x2="675" y1={diagram.sliceY} y2={diagram.sliceY} stroke="#ac4236" stroke-dasharray="3 3"/>{/if}
        {#each edges as e}{@const a=diagram.points.find(p=>p.n.id===e.from)}{@const b=diagram.points.find(p=>p.n.id===e.to)}{#if a&&b}<line x1={a.x} x2={b.x} y1={a.y} y2={b.y} stroke={e.kind==='portal'?'#a54d83':'#85735f'} stroke-width="3" stroke-dasharray={e.kind==='portal'?'5 4':'none'}/>{/if}{/each}
        {#each diagram.points as p}<line x1={p.x} x2={p.x} y1={p.ground} y2={p.y} stroke="#89977d" stroke-dasharray="2 3"/><circle cx={p.x} cy={p.ground} r="2" fill="#617655"/>
          <g role="button" tabindex="0" aria-label={'Inspect cave '+p.n.name} onclick={()=>choose(p.n)} onkeydown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(p.n);}}} opacity={sliceEnabled&&Math.abs(p.n.position.altitude_m-slice)>p.n.height_m/2?.25:1}>
            <ellipse cx={p.x} cy={p.y} rx="12" ry={p.r} fill={p.n.id===id?'#ac4236':'#3f686e'}/><text x={p.x+14} y={p.y-8} font-size="11" fill="#363d39">{p.n.name}</text>
          </g>{/each}
        <text x="8" y="15" font-size="11">{Math.round(diagram.high)} m</text><text x="8" y="243" font-size="11">{Math.round(diagram.low)} m</text><text x="675" y="241" text-anchor="end" font-size="11">0–{diagram.maxX.toFixed(2)} km from first visible node</text>
      </svg>
      <p class="help-text">Green points sample local ground; dotted verticals show depth below it. Blue: sea level. Horizontal position is distance from the first visible node, not a tunnel route.</p>
      <svg viewBox="0 0 700 220" role="img" aria-label="Underground plan" data-testid="cave-plan">
        <rect width="700" height="220" fill="#e5e7dd"/>
        {#each edges as e}{@const a=nodes.find(n=>n.id===e.from)}{@const b=nodes.find(n=>n.id===e.to)}{#if a&&b}<line x1={350+lonDelta(a.position.lon_deg)/spanLon*280} x2={350+lonDelta(b.position.lon_deg)/spanLon*280} y1={110-(a.position.lat_deg-origin.lat_deg)/spanLat*75} y2={110-(b.position.lat_deg-origin.lat_deg)/spanLat*75} stroke="#8b7764" stroke-width="3" stroke-dasharray={e.kind==='portal'?'5 4':'none'}/>{/if}{/each}
        {#each nodes as n}<circle cx={350+lonDelta(n.position.lon_deg)/spanLon*280} cy={110-(n.position.lat_deg-origin.lat_deg)/spanLat*75} r="6" fill="#3f686e" opacity={sliceEnabled&&Math.abs(n.position.altitude_m-slice)>n.height_m/2?.2:1}/>{/each}
        <text x="20" y="25" font-size="12">PLAN · north ↑ · schematic local lon/lat</text>
      </svg>{/if}
      <button class="secondary" onclick={()=>{proposal=caveProposal(project.planet.seed,selection,project.planet.radius_m,raster);err='';}}>Suggest cave network at selection</button>
      {#if proposal}<div class="generation-preview"><p>Proposal: {proposal.nodes.length} nodes and {proposal.edges.length} passages. Nothing is canon until accepted.</p><div class="action-row"><button onclick={acceptProposal}>Accept cave proposal</button><button onclick={()=>proposal=null}>Discard cave proposal</button></div></div>{/if}
      <details class="inspector-tool"><summary>Find a passage route</summary><label>From<select aria-label="Route from" bind:value={routeStart}><option value="">Choose…</option>{#each nodes as n}<option value={n.id}>{n.name}</option>{/each}</select></label><label>To<select aria-label="Route to" bind:value={routeEnd}><option value="">Choose…</option>{#each nodes as n}<option value={n.id}>{n.name}</option>{/each}</select></label>
        {#if route}<output data-testid="cave-route">{route.ids.length} nodes · {(route.distance_m/1000).toFixed(3)} km · {route.portals} portals</output>{:else if routeStart&&routeEnd}<p>No connected route.</p>{/if}
      </details>
    </div>
    <div class="cave-form">
      <label>Underground node<select aria-label="Underground node" value={id} onchange={e=>{const n=graph.nodes.find(x=>x.id===e.currentTarget.value);if(n)choose(n);else{id='';name='';}}}><option value="">New at surface selection</option>{#each graph.nodes as n}<option value={n.id}>{n.name}{n.locked?' · locked':''}</option>{/each}</select></label>
      <form onsubmit={e=>{e.preventDefault();add();}}>
        <label>Node name<input aria-label="Cave node name" bind:value={name} required disabled={node?.locked}/></label>
        <label>Type<select aria-label="Cave node kind" bind:value={kind} disabled={node?.locked}><option value="chamber">Chamber</option><option value="entrance">Entrance</option><option value="settlement">Underground settlement</option></select></label>
        {#if node}<label>Latitude<input type="number" aria-label="Cave latitude" bind:value={latitude} step="any" disabled={node.locked}/></label><label>Longitude<input type="number" aria-label="Cave longitude" bind:value={longitude} step="any" disabled={node.locked}/></label><label>Altitude, fixed datum (m)<input aria-label="Cave altitude (m)" type="number" min="-20000" max="20000" bind:value={altitude} disabled={node.locked}/></label>
          <p>Ground: {sampleElevation(raster,node.position)} m<br/>Depth below ground: <strong data-testid="cave-depth">{belowGround(sampleElevation(raster,node.position),node.position.altitude_m)} m</strong></p>
        {:else}<label>Depth below selected ground (m)<input type="number" aria-label="Cave depth below ground (m)" min="0" max="20000" bind:value={depth}/></label><p class="help-text">Ground at selection: {sampleElevation(raster,selection)} m. Cave altitude will be ground minus depth.</p>{/if}
        <div class="brush-inputs"><label>Radius (m)<input aria-label="Cave radius (m)" type="number" min="1" max="10000" bind:value={radius} disabled={node?.locked}/></label><label>Height (m)<input aria-label="Cave height (m)" type="number" min="1" max="10000" bind:value={height} disabled={node?.locked}/></label></div>
        <label>Lore<textarea aria-label="Cave lore" bind:value={description} rows="3" disabled={node?.locked}></textarea></label>
        <label>Era<select aria-label="Cave era" bind:value={nodeEra} disabled={node?.locked}><option value="">Timeless</option>{#each project.eras??[] as e}<option value={e.id}>{e.name}</option>{/each}</select></label>
        <label class="check-label"><input type="checkbox" aria-label="Flooded chamber" bind:checked={flooded} disabled={node?.locked}/>Flooded chamber</label>
        {#if flooded}<label>Flood surface altitude (m)<input type="number" aria-label="Cave water surface (m)" min="-20000" max="20000" bind:value={floodLevel} disabled={node?.locked}/></label>{/if}
        <button class="primary" disabled={node?.locked}>Save underground node</button>
      </form>
      {#if node}<div class="action-row"><button onclick={lock}>{node.locked?'Unlock node':'Lock node'}</button><button disabled={node.locked} onclick={remove}>Delete node</button></div>{/if}
      <details class="inspector-tool"><summary>Connect passages</summary><label>Start node<select aria-label="Passage from" bind:value={from}><option value="">Choose…</option>{#each graph.nodes as n}<option value={n.id}>{n.name}</option>{/each}</select></label><label>End node<select aria-label="Passage to" bind:value={to}><option value="">Choose…</option>{#each graph.nodes as n}<option value={n.id}>{n.name}</option>{/each}</select></label><label>Passage type<select aria-label="Passage type" bind:value={edgeKind}><option value="tunnel">Tunnel</option><option value="shaft">Shaft</option><option value="portal">Portal</option></select></label><button class="secondary" onclick={connect}>Connect nodes</button>
        {#each graph.edges as e}<div class="passage-row"><span>{e.name}</span><button onclick={()=>toggleEdge(e)}>{e.locked?'Unlock':'Lock'}</button><button disabled={e.locked} onclick={()=>deleteEdge(e)}>Remove</button></div>{/each}
      </details>
      {#if err}<p role="alert" class="error">{err}</p>{/if}
    </div>
  </div>
</section>
