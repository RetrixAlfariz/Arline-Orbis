<script lang="ts">
  import { untrack, onDestroy } from 'svelte';
  import type { Project } from '../core/project';
  import type { CaveGraph } from '../core/authoring';
  import type { Coordinate } from '../core/world';
  import { sampleElevation, type ElevationRaster } from '../terrain/sample';
  import { DEFAULT_CAVE_OPTIONS, generateCaves, appendCaveProposal, type CaveOptions } from './generator';
  let { project, raster, selection, onpreview, onapply }: { project: Project; raster: ElevationRaster; selection: Coordinate;
    onpreview: (graph: CaveGraph | null) => void; onapply: (graph: CaveGraph) => void } = $props();
  let options = $state<CaveOptions>({ ...DEFAULT_CAVE_OPTIONS });
  let entranceId = $state(''), draft = $state<CaveGraph | null>(null), error = $state(''), busy = $state(false), status = $state('Choose parameters, then generate a review.');
  let request = 0;
  const graph = $derived(project.caves ?? { nodes: [], edges: [] });
  const entrance = $derived(graph.nodes.find(n => n.id === entranceId && n.kind === 'entrance'));
  const anchor = $derived(entrance?.position ?? selection);
  const fingerprint = $derived(JSON.stringify({ options, entranceId, anchor, graph, planet: project.planet, strokes: project.terrain_strokes, regions: project.regional_replacements }));
  const ranges = $derived(draft?.nodes.filter(n => n.kind === 'chamber').map(n => sampleElevation(raster, n.position) - n.position.altitude_m) ?? []);
  $effect(() => { void fingerprint; void raster; untrack(() => { request++; busy = false; draft = null; onpreview(null); status = 'Choose parameters, then generate a fresh review.'; }); });
  onDestroy(() => { request++; });
  function discard() { request++; busy = false; draft = null; error = ''; onpreview(null); status = 'Preview discarded. Your saved caves are unchanged.'; }
  async function generate() {
    const id = ++request; busy = true; error = ''; draft = null; onpreview(null); status = 'Building connected chambers and passages…';
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (id !== request) return;
    try {
      const proposal = generateCaves(options, anchor, project.planet.radius_m, raster, entrance);
      appendCaveProposal(graph, proposal);
      if (graph.nodes.length + proposal.nodes.length > 1000 || graph.edges.length + proposal.edges.length > 2000) throw new Error('Network exceeds the project cave limit. Reduce chamber count.');
      draft = proposal; onpreview(proposal); status = 'Ready for review. No saved caves have changed.';
    } catch (e) { error = (e as Error).message; status = 'Generation needs attention.'; }
    finally { if (id === request) busy = false; }
  }
  function apply() {
    if (!draft || busy) return;
    try { onapply(appendCaveProposal(graph, draft)); draft = null; onpreview(null); error = ''; status = 'Network applied. Existing caves and locks are preserved.'; }
    catch (e) { error = (e as Error).message; }
  }
</script>

<section class="cave-generator" aria-label="Underground generation">
  <header><div><p class="eyebrow">SEEDED EXPEDITION</p><h3>Generate an underground network</h3></div><span class="generation-state" class:working={busy}>{busy ? 'Generating' : draft ? 'Review' : 'Draft'}</span></header>
  <p class="help-text">Connected chamber envelopes and schematic tunnels beneath local ground. Review in the section, plan or 3D view, then add to your world.</p>
  <div class="cave-generator-grid">
    <label>Seed<input aria-label="Underground generation seed" bind:value={options.seed} maxlength="64" /></label>
    <label>Anchor<select aria-label="Underground generation anchor" bind:value={entranceId}><option value="">Current surface selection</option>{#each graph.nodes.filter(n => n.kind === 'entrance') as n}<option value={n.id}>{n.name}{n.locked ? ' · locked, preserved' : ''}</option>{/each}</select></label>
    <label>Chambers<input aria-label="Generated chamber count" type="number" min="3" max="64" step="1" bind:value={options.chambers}/></label>
    <label>Network extent (m)<input aria-label="Generated network extent (m)" type="number" min="100" max="10000" step="1" bind:value={options.extent_m}/></label>
    <label>Minimum depth (m)<input aria-label="Generated minimum depth (m)" type="number" min="20" max="12000" step="1" bind:value={options.min_depth_m}/></label>
    <label>Maximum depth (m)<input aria-label="Generated maximum depth (m)" type="number" min="20" max="16000" step="1" bind:value={options.max_depth_m}/></label>
    <label>Chamber radius up to (m)<input aria-label="Generated chamber radius (m)" type="number" min="10" max="250" step="1" bind:value={options.chamber_radius_m}/></label>
    <label>Tunnel radius (m)<input aria-label="Generated tunnel radius (m)" type="number" min="1" max="30" step="1" bind:value={options.tunnel_radius_m}/></label>
  </div>
  <p class="help-text">Anchor {anchor.lat_deg.toFixed(4)}°, {anchor.lon_deg.toFixed(4)}° · depth measured below each chamber's local ground. Existing authored and locked records are retained.</p>
  <div class="action-row"><button class="secondary" disabled={busy} onclick={generate}>Generate underground preview</button>{#if busy}<button onclick={discard}>Cancel underground generation</button>{/if}</div>
  <p role="status" class="cave-generation-status">{status}</p>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  {#if draft}<div class="cave-preview-review" data-testid="underground-generation-preview"><strong>{options.chambers} chambers · {draft.edges.length} connected passages</strong><p>Depth {Math.min(...ranges)}–{Math.max(...ranges)} m below local ground. {entrance ? 'Attaches to your existing entrance.' : 'Includes a new surface entrance.'}</p><small>Click a preview chamber in the diagram to inspect it. Apply adds this network; it never replaces existing content.</small></div>{/if}
  <div class="action-row"><button class="primary" disabled={!draft || busy} onclick={apply}>Apply underground network</button><button disabled={!draft && !busy} onclick={discard}>Discard underground preview</button></div>
</section>
