<script lang="ts">
  import { onMount } from 'svelte';
  import { SAMPLE_PLANET, createLandmark } from '../core/world';
  import type { Coordinate, Landmark, Position } from '../core/world';
  import { coordinate } from '../geo/coordinates';
  import { generateSample, sampleElevation, SAMPLE_SITES } from '../terrain/sample';
  import { terrainTexture } from '../render/terrainTexture';
  import Atlas from '../render/Atlas.svelte';
  import Globe from '../render/Globe.svelte';

  const planet = SAMPLE_PLANET;
  const started = performance.now();
  const raster = generateSample(planet.seed);
  const generationMs = performance.now() - started;
  let texture = $state<HTMLCanvasElement | null>(null);
  let mode = $state<'atlas' | 'globe'>('atlas');
  let showGrid = $state(true);
  let showLabels = $state(true);
  let selection = $state<Position | null>(null);
  let hover = $state<Coordinate | null>(null);
  let landmarks = $state<Landmark[]>([]);
  let name = $state('');
  let error = $state('');
  let graphicsError = $state('');
  let latitude = $state(30);
  let longitude = $state(-55);
  let notice = $state('');
  let selectedLandmark = $derived(landmarks.find((landmark) => selection &&
    landmark.position.lat_deg === selection.lat_deg && landmark.position.lon_deg === selection.lon_deg));
  let selectedSite = $derived(SAMPLE_SITES.find((site) => selection &&
    site.lat_deg === selection.lat_deg && site.lon_deg === selection.lon_deg));

  onMount(() => { texture = terrainTexture(raster); select(SAMPLE_SITES[0]); });

  function select(point: Coordinate) {
    selection = { ...coordinate(point.lat_deg, point.lon_deg), altitude_m: sampleElevation(raster, point) };
    latitude = selection.lat_deg;
    longitude = selection.lon_deg;
    name = landmarks.find((landmark) => landmark.position.lat_deg === point.lat_deg &&
      landmark.position.lon_deg === point.lon_deg)?.name ?? '';
    error = '';
    notice = '';
  }
  function goTo() {
    try { select(coordinate(latitude, longitude)); } catch (cause) { error = (cause as Error).message; }
  }
  function saveLandmark() {
    if (!selection) return;
    try {
      const updating = selectedLandmark !== undefined;
      const landmark = createLandmark(name, selection, selectedLandmark?.id ?? crypto.randomUUID());
      landmarks = selectedLandmark ? landmarks.map((item) => item.id === landmark.id ? landmark : item) : [...landmarks, landmark];
      name = landmark.name;
      error = '';
      notice = `${landmark.name} ${updating ? 'updated' : 'added'} for this session.`;
    } catch (cause) { error = (cause as Error).message; }
  }
  function globeError(message: string) {
    graphicsError = message;
    mode = 'atlas';
    hover = null;
  }
  function switchMode(next: 'atlas' | 'globe') { mode = next; hover = null; }
  function degrees(point: Coordinate) {
    return `${Math.abs(point.lat_deg).toFixed(2)}° ${point.lat_deg < 0 ? 'S' : 'N'}  ·  ${Math.abs(point.lon_deg).toFixed(2)}° ${point.lon_deg < 0 ? 'W' : 'E'}`;
  }
  function elevation(value: number) { return `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')} m`; }
</script>

<svelte:head><meta name="description" content="A local planetary atlas for storytelling. Explore a sample world in 2D and 3D." /></svelte:head>

<header class="app-header">
  <a class="brand" href="./" aria-label="Arline Orbis home"><svg class="brand-symbol" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" /><ellipse cx="16" cy="16" rx="5" ry="12" /><path d="M4 16h24M7 9h18M7 23h18" /></svg><span>ARLINE <strong>ORBIS</strong></span></a>
  <span class="header-note">/ PLANETARY ATLAS</span>
  <span class="local-indicator"><span class="status-dot"></span>LOCAL</span>
  <span class="stage-tag">M0 · PROTOTYPE</span>
</header>

<main>
  <section class="workspace" aria-label="Planetary atlas">
    <div class="world-heading"><div><p class="eyebrow">CHART 01 / SPHERICAL REFERENCE</p><h1>{planet.name}<span>Give every story a world.</span></h1></div>
      <div class="mode-switch" aria-label="View mode"><button class:active={mode === 'atlas'} aria-pressed={mode === 'atlas'} onclick={() => switchMode('atlas')}>2D Atlas</button><button class:active={mode === 'globe'} aria-pressed={mode === 'globe'} onclick={() => switchMode('globe')}>3D Globe</button></div>
    </div>
    {#if graphicsError}<div class="graphics-notice" role="status">{graphicsError}</div>{/if}
    <div class="map-toolbar">
      <div class="view-caption"><span class="status-dot"></span>{mode === 'atlas' ? 'EQUIRECTANGULAR' : 'SPHERICAL'} <span> / RELIEF ATLAS</span></div>
      {#if mode === 'atlas'}<div class="map-options"><label><input type="checkbox" bind:checked={showGrid} />Grid</label><label><input type="checkbox" bind:checked={showLabels} />Region labels</label></div>{:else}<span class="toolbar-hint">Drag to explore your world</span>{/if}
    </div>
    <div class="viewport" class:globe-mode={mode === 'globe'}>
      {#if texture}
        {#if mode === 'atlas'}<Atlas {texture} {selection} {landmarks} {showGrid} {showLabels} onselect={select} onhover={(point) => hover = point} />
        {:else}<Globe {texture} {selection} {landmarks} onselect={select} onhover={(point) => hover = point} onerror={globeError} />{/if}
      {:else}<p class="loading" role="status">Preparing sample terrain…</p>{/if}
    </div>
    <div class="atlas-footer"><span class="pointer-readout">{hover ? degrees(hover) : 'Move over the world to read coordinates'}</span><span>R { (planet.radius_m / 1000).toLocaleString('en-US') } km</span></div>
    <p class="view-instruction">{mode === 'atlas' ? 'Click to inspect · Arrow keys to move selection' : 'Drag to rotate · Scroll to zoom · Click to inspect'}</p>
    <div class="legend" aria-label="Elevation legend"><span>Seafloor</span><span>−9,000 m</span><div class="legend-ramp"></div><span>+6,000 m</span><span>Highland</span></div>
    <div class="sample-intro"><div><p class="eyebrow">FIELD GUIDE</p><p>Places worth exploring</p></div><span>Original seeded terrain · illustrative geology</span></div>
    <div class="sample-sites">{#each SAMPLE_SITES as site, index}<button onclick={() => select(site)}><span class="site-index" aria-hidden="true">0{index + 1}</span><span class="site-name">{site.name}</span><small>{site.description}</small><span class="site-elevation">{elevation(sampleElevation(raster, site))} ↗</span></button>{/each}</div>
  </section>

  <aside class="inspector" aria-label="Position inspector">
    <div class="inspector-title"><p class="eyebrow">FIELD RECORD / 001</p><h2>{selectedLandmark?.name ?? selectedSite?.name ?? 'Selected position'}</h2><span class="record-classification">{selection && selection.altitude_m < 0 ? 'OCEAN FLOOR TOPOGRAPHY' : 'CONTINENTAL TOPOGRAPHY'}</span></div>
    {#if selection}
      <div class="elevation-metric"><p class="eyebrow">ELEVATION / DATUM</p><p>{elevation(selection.altitude_m)}</p></div>
      <p class="selection-coordinates" data-testid="selection-coordinates">{degrees(selection)}</p>
      <dl class="position-details"><div><dt>Latitude</dt><dd data-testid="latitude">{selection.lat_deg.toFixed(4)}°</dd></div><div><dt>Longitude</dt><dd data-testid="longitude">{selection.lon_deg.toFixed(4)}°</dd></div><div><dt>Elevation</dt><dd data-testid="elevation">{elevation(selection.altitude_m)}</dd></div><div><dt>Environment</dt><dd>{selection.altitude_m < planet.sea_level_m ? 'Seafloor' : 'Land'}</dd></div></dl>
      <p class="observation-note">{selectedSite?.description ?? 'A geographic anchor for a place in your story.'}</p>
      <form class="landmark-form" onsubmit={(event) => { event.preventDefault(); saveLandmark(); }}>
        <label for="landmark-name">LANDMARK NAME</label><input id="landmark-name" bind:value={name} maxlength="80" placeholder="Give this place a name" required />
        <button class="primary" type="submit">{selectedLandmark ? 'Update landmark' : 'Set landmark'}</button>
      </form>
    {:else}<div class="empty-selection"><span>⌖</span><p>Select a place on the map</p><small>Inspect its coordinates and elevation, then give it a name.</small></div>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
    <form class="coordinate-form" onsubmit={(event) => { event.preventDefault(); goTo(); }}><p class="eyebrow">GO TO COORDINATES</p><div class="coordinate-inputs"><label>Latitude<input type="number" bind:value={latitude} min="-90" max="90" step="any" required /></label><label>Longitude<input type="number" bind:value={longitude} step="any" required /></label></div><button type="submit" class="secondary">Inspect position</button></form>
    <div class="landmark-list"><div class="list-heading"><p class="eyebrow">SESSION LANDMARKS</p><span>{landmarks.length.toString().padStart(2, '0')}</span></div>{#each landmarks as landmark (landmark.id)}<button class:chosen={landmark.id === selectedLandmark?.id} onclick={() => select(landmark.position)}><span>{landmark.name}</span><small>{degrees(landmark.position)}</small></button>{:else}<p class="muted">Your named places will appear here.</p>{/each}</div>
    <p class="session-note">Landmarks live in this session only. Refresh clears edits. Save, export and author locks arrive in M1.</p>
    <details class="prototype-details"><summary>About this prototype</summary><p>One {raster.width} × {raster.height} elevation raster powers both views. Terrain is fictional, not a scientific simulation. Elevation is in meters relative to sea level; it is not cave depth.</p><p>Generation: {generationMs.toFixed(1)} ms · raster: {(raster.samples.byteLength / 1024).toFixed(0)} KiB · {planet.algorithm_version}</p></details>
  </aside>
</main>
<footer class="app-footer"><span>ORBIS / A WORLD FOR YOUR WORDS</span><span>Local prototype · No account or external service</span></footer>
