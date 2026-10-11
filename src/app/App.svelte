<script lang="ts">
  import { onMount } from 'svelte';
  import { createLandmark } from '../core/world';
  import type { Coordinate, Position } from '../core/world';
  import { coordinate, distanceKm } from '../geo/coordinates';
  import { newProject, decodeProject, anchorKey, waterDepth, MAX_PROJECT_BYTES } from '../core/project';
  import type { Project } from '../core/project';
  import { loadWorkspace, saveWorkspace } from '../core/storage';
  import type { Snapshot } from '../core/storage';
  import { generatePlanet, sampleElevation, SAMPLE_SITES } from '../terrain/sample';
  import { applyTerrainStrokes, validateTerrainStroke, strokeTouches, MAX_TERRAIN_STROKES } from '../terrain/sculpt';
  import { elevationProfile } from '../geo/profile';
  import { terrainTexture } from '../render/terrainTexture';
  import Atlas from '../render/Atlas.svelte';
  import Globe from '../render/Globe.svelte';

  let project = $state<Project>(newProject());
  const planet = $derived(project.planet);
  // Selection and landmark edits must never re-run global terrain synthesis.
  // Cache by the *geographic* inputs only, not by a whole mutable Project reference.
  let cachedTerrainKey = '';
  let cachedTerrain: { raster: ReturnType<typeof generatePlanet>; ms: number } | undefined;
  const terrain = $derived.by(() => {
    const key = planet.algorithm_version + '|' + planet.seed + '|' + planet.radius_m +
      '|' + JSON.stringify(project.terrain_strokes ?? []);
    if (key === cachedTerrainKey && cachedTerrain) return cachedTerrain;
    const start = performance.now();
    const base = generatePlanet(planet.seed, planet.algorithm_version);
    const raster = applyTerrainStrokes(base, project.terrain_strokes ?? [], planet.radius_m);
    cachedTerrain = { raster, ms: performance.now() - start };
    cachedTerrainKey = key;
    return cachedTerrain;
  });
  const isSampleWorld = $derived(planet.algorithm_version === 'm0-sample-v1');
  const raster = $derived(terrain.raster);
  const groundElevation = $derived(sampleElevation(raster, project.selection));
  const generationMs = $derived(terrain.ms);
  let texture = $state<HTMLCanvasElement | null>(null);
  let mode = $state<'atlas' | 'globe'>('atlas');
  let showGrid = $state(true);
  let showLabels = $state(true);
  const selection = $derived<Position>({ ...project.selection, altitude_m: project.landmarks.find((l) => anchorKey(l.position) === anchorKey(project.selection))?.position.altitude_m ?? sampleElevation(raster, project.selection) });
  let hover = $state<Coordinate | null>(null);
  const landmarks = $derived(project.landmarks);
  const draft = $derived(project.drafts.find((d) => anchorKey(d) === anchorKey(project.selection)));
  const authoredElevation = $derived(draft?.altitude_m ?? selection.altitude_m);
  let error = $state('');
  let graphicsError = $state('');
  let latitude = $state(30);
  let longitude = $state(-55);
  let notice = $state('');
  let ready = $state(false);
  let saveState = $state('Loading local world…');
  let storageError = $state('');
  let revision = 0;
  let history = $state<Snapshot[]>([]);
  let recovered = $state<Snapshot[]>([]);
  let saving = false;
  let pending = false;
  let journalKey = '';
  let search = $state('');
  let radiusKm = $state(6371);
  let seaLevel = $state(0);
  let seed = $state('aurelia-001');
  let showWater = $state(true);
  let bathymetry = $state(false);
  let mapStyle = $state<'natural' | 'survey'>('natural');
  let measureStart = $state<Coordinate | null>(null);
  let recoveryIndex = $state('');
  let worldName = $state('New world');
  let worldSeed = $state('orbis-world-001');
  let worldRadius = $state(6371);
  let sculptMode = $state(false);
  let brushRadius = $state(300);
  let brushDelta = $state(-800);
  const strokeCount = $derived(project.terrain_strokes?.length ?? 0);
  const profileData = $derived.by(() => {
    if (!measureStart) return null;
    const points = elevationProfile(raster, measureStart, project.selection, planet.radius_m, 96);
    const lows = points.map(p => p.elevation_m);
    const low = Math.min(planet.sea_level_m, ...lows) - 350;
    const high = Math.max(planet.sea_level_m, ...lows) + 350;
    const y = (e: number) => 106 - (e - low) / (high - low) * 88;
    return {
      line: points.map((p, i) => (10 + i / (points.length - 1) * 300).toFixed(1) + ',' + y(p.elevation_m).toFixed(1)).join(' '),
      zeroY: y(planet.sea_level_m),
      low, high, distanceKm: points.at(-1)?.distance_km ?? 0,
    };
  });
  let importInput: HTMLInputElement;
  const recoveryItems = $derived([...history, ...recovered]);
  const visibleLandmarks = $derived(landmarks.filter((l) => l.name.toLowerCase().includes(search.toLowerCase())));
  let selectedLandmark = $derived(landmarks.find((landmark) => selection &&
    landmark.position.lat_deg === selection.lat_deg && landmark.position.lon_deg === selection.lon_deg));
  let selectedSite = $derived(isSampleWorld ? SAMPLE_SITES.find((site) => selection &&
    site.lat_deg === selection.lat_deg && site.lon_deg === selection.lon_deg)) : undefined);
  const name = $derived(draft?.name ?? selectedLandmark?.name ?? '');

  $effect(() => { if (ready) texture = terrainTexture(raster, { seaLevel: planet.sea_level_m, showWater, bathymetry, style: mapStyle }); });
  $effect(() => { latitude = project.selection.lat_deg; longitude = project.selection.lon_deg; });
  $effect(() => { radiusKm = planet.radius_m / 1000; seaLevel = planet.sea_level_m; seed = planet.seed; });
  const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  onMount(() => {
    let active = true;
    (async () => {
      try {
        const saved = await loadWorkspace();
        if (!active) return;
        if (saved) { project = saved.project; history = saved.history; recovered = saved.backups ?? []; revision = saved.revision; }
        // A duplicated browser tab can inherit sessionStorage. Each document gets its own journal
        // so one tab cannot remove or overwrite another tab's pending changes.
        const previousTabId = sessionStorage.getItem('orbis-tab');
        const tabId = crypto.randomUUID();
        sessionStorage.setItem('orbis-tab', tabId);
        journalKey = `orbis-journal:${tabId}`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)!;
          if (!key.startsWith('orbis-journal:')) continue;
          try {
            const journal = JSON.parse(localStorage.getItem(key)!);
            const recoveredProject = decodeProject(journal.project);
            if (key === `orbis-journal:${previousTabId}` && journal.revision === revision) {
              project = recoveredProject;
              if (Array.isArray(journal.history)) history = journal.history.slice(-30).map((s: Snapshot) => ({ ...s, project: decodeProject(s.project) }));
              if (Array.isArray(journal.backups)) recovered = journal.backups.slice(-30).map((s: Snapshot) => ({ ...s, project: decodeProject(s.project) }));
              notice = 'Recovered your unfinished local changes.'; pending = true;
            } else recovered = [...recovered, { project: recoveredProject, at: journal.at, label: 'Unfinished workspace backup' }];
          } catch { storageError = 'An unreadable recovery backup was preserved in local storage.'; }
        }
        saveState = saved ? 'Saved locally' : 'Ready to save locally';
      } catch (cause) {
        storageError = `Local storage could not be opened: ${(cause as Error).message} Export changes before closing.`;
        saveState = 'Local save unavailable';
      } finally { if (active) { ready = true; if (pending) void flush(); } }
    })();
    const unload = (event: BeforeUnloadEvent) => { if (pending || saving || storageError) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => { active = false; window.removeEventListener('beforeunload', unload); };
  });

  function persist() {
    pending = true; saveState = 'Saving…';
    try { if (journalKey) localStorage.setItem(journalKey, JSON.stringify({ project, history, backups: recovered, revision, at: new Date().toISOString() })); }
    catch { storageError = 'Emergency backup is unavailable. Keep this tab open until the local save completes, or export.'; }
    if (ready) void flush();
  }
  async function flush() {
    if (saving || !pending || !ready || saveState === 'Save conflict') return;
    saving = true;
    try {
      while (pending) {
        pending = false;
        revision = await saveWorkspace(copy(project), copy(history), revision, copy(recovered));
        if (pending) {
          if (journalKey) localStorage.setItem(journalKey, JSON.stringify({ project, history, backups: recovered, revision, at: new Date().toISOString() }));
        } else { if (journalKey) localStorage.removeItem(journalKey); saveState = 'Saved locally'; storageError = ''; }
      }
    } catch (cause) {
      pending = true;
      storageError = (cause as Error).message;
      saveState = storageError.includes('Another tab') ? 'Save conflict' : 'Local save failed';
    } finally { saving = false; }
  }
  function change(next: Project, label: string) {
    if (!withinLimit(next)) return;
    history = [...history, { project: copy(project), at: new Date().toISOString(), label }].slice(-30);
    project = next; error = ''; notice = label; persist();
  }
  function withinLimit(next: Project): boolean {
    if (new TextEncoder().encode(JSON.stringify(next)).length <= MAX_PROJECT_BYTES) return true;
    error = 'This edit exceeds the 2 MB project limit. Export a backup and reduce project metadata first.'; return false;
  }

  function select(point: Coordinate) {
    if (!ready) return;
    const next = { ...project, selection: coordinate(point.lat_deg, point.lon_deg) };
    if (!withinLimit(next)) return;
    project = next;
    error = '';
    notice = '';
    persist();
  }
  function goTo() {
    try { select(coordinate(latitude, longitude)); } catch (cause) { error = (cause as Error).message; }
  }
  function saveLandmark() {
    if (!ready || selectedLandmark?.locked) return;
    try {
      if (!selectedLandmark && landmarks.length >= 1000) throw new Error('Maximum 1,000 landmarks per project.');
      if (!Number.isFinite(authoredElevation) || Math.abs(authoredElevation) > 20000) throw new Error('Elevation must be between −20,000 and +20,000 m.');
      const updating = selectedLandmark !== undefined;
      const landmark = { ...selectedLandmark, ...createLandmark(name, { ...selectedLandmark?.position, ...selection, altitude_m: authoredElevation }, selectedLandmark?.id ?? crypto.randomUUID()), locked: false };
      change({ ...project, landmarks: updating ? landmarks.map((item) => item.id === landmark.id ? landmark : item) : [...landmarks, landmark],
        drafts: project.drafts.filter((d) => anchorKey(d) !== anchorKey(selection)) }, `${landmark.name} ${updating ? 'updated' : 'added'}.`);
    } catch (cause) { error = (cause as Error).message; }
  }
  function editDraft(nextName: string, altitude_m: number) {
    if (!ready || selectedLandmark?.locked) return;
    if (!Number.isFinite(altitude_m) || Math.abs(altitude_m) > 20000) { error = 'Elevation must be between −20,000 and +20,000 m.'; return; }
    error = '';
    const drafts = project.drafts.filter((d) => anchorKey(d) !== anchorKey(selection));
    if (drafts.length >= 1000) { error = 'Maximum 1,000 unfinished drafts. Save or discard some drafts first.'; return; }
    const next = { ...project, drafts: [...drafts, { ...project.selection, name: nextName, altitude_m }] };
    if (!withinLimit(next)) return;
    project = next; persist();
  }
  function discardDraft() { project = { ...project, drafts: project.drafts.filter((d) => anchorKey(d) !== anchorKey(selection)) }; persist(); }
  function lockLandmark() {
    if (!selectedLandmark) return;
    change({ ...project, landmarks: landmarks.map((l) => l.id === selectedLandmark!.id ? { ...l, locked: !l.locked } : l) }, selectedLandmark.locked ? 'Landmark unlocked.' : 'Landmark locked.');
  }
  function deleteLandmark() {
    if (!selectedLandmark || selectedLandmark.locked) return;
    change({ ...project, landmarks: landmarks.filter((l) => l.id !== selectedLandmark!.id), drafts: project.drafts.filter((d) => anchorKey(d) !== anchorKey(selection)) }, 'Landmark deleted. Undo is available.');
  }
  function moveLandmark() {
    if (!selectedLandmark || selectedLandmark.locked) return;
    try {
      const position = { ...coordinate(latitude, longitude), altitude_m: selectedLandmark.position.altitude_m };
      if (landmarks.some((l) => l.id !== selectedLandmark!.id && anchorKey(l.position) === anchorKey(position))) throw new Error('There is already a landmark at that position.');
      change({ ...project, selection: position, landmarks: landmarks.map((l) => l.id === selectedLandmark!.id ? { ...l, position } : l) }, 'Landmark moved; authored elevation preserved.');
    } catch (cause) { error = (cause as Error).message; }
  }
  function makeNewWorld() {
    try {
      const title = worldName.trim();
      if (!title || title.length > 80 || !worldSeed.trim() || worldSeed.length > 100)
        throw new Error('Enter a world name (1–80 characters) and generator seed (1–100 characters).');
      if (!Number.isFinite(worldRadius) || worldRadius < 1 || worldRadius > 1_000_000)
        throw new Error('Planet radius must be between 1 and 1,000,000 km.');
      if ((project.landmarks.length || project.drafts.length || strokeCount) &&
        !window.confirm('Start a new world? Export the current world first if you want a portable backup. Undo/recovery will retain a local snapshot.')) return;
      const next: Project = {
        format: 'orbis-project', version: 2,
        planet: {
          id: crypto.randomUUID(), name: title, seed: worldSeed.trim(),
          radius_m: worldRadius * 1000, sea_level_m: 0, algorithm_version: 'm2-seeded-v1',
        },
        selection: coordinate(0, 0), landmarks: [], drafts: [], terrain_strokes: [],
      };
      change(next, 'Created ' + title + '.');
      mode = 'atlas'; sculptMode = false; measureStart = null;
    } catch (cause) { error = (cause as Error).message; }
  }
  function sculptAt(point: Coordinate) {
    if (!ready || mode !== 'atlas') return;
    try {
      const radius = Number(brushRadius), delta = Number(brushDelta);
      const stroke = validateTerrainStroke({ id: crypto.randomUUID(), ...point,
        radius_km: radius, delta_m: delta });
      if (strokeCount >= MAX_TERRAIN_STROKES) throw new Error('This project reached the 256-stroke limit. Undo or remove edits before adding more.');
      const protectedPlace = landmarks.find(l => l.locked && strokeTouches(l.position, stroke, planet.radius_m));
      if (protectedPlace) throw new Error('Brush overlaps locked landmark "' + protectedPlace.name + '". Unlock it or paint elsewhere.');
      const next = decodeProject({ ...copy(project), version: 2,
        selection: coordinate(point.lat_deg, point.lon_deg),
        terrain_strokes: [...(project.terrain_strokes ?? []), stroke] });
      change(next, (delta > 0 ? 'Raised' : 'Lowered') + ' terrain by up to ' + Math.abs(delta).toLocaleString() + ' m within ' + radius + ' km.');
    } catch (cause) { error = (cause as Error).message; }
  }
  function removeLastStroke() {
    if (!strokeCount) return;
    change({ ...project, terrain_strokes: project.terrain_strokes!.slice(0, -1) }, 'Removed last terrain stroke.');
  }
  function selectOrSculpt(point: Coordinate) {
    if (sculptMode && mode === 'atlas') sculptAt(point);
    else select(point);
  }
  function changeMode(next: 'atlas' | 'globe') {
    if (next === 'globe') sculptMode = false;
    switchMode(next);
  }
  function applySettings() {
    try {
      const next = decodeProject({ ...copy(project), planet: { ...planet, seed, radius_m: radiusKm * 1000, sea_level_m: seaLevel } });
      change(next, 'World settings updated. Authored anchors preserved.');
    } catch (cause) { error = (cause as Error).message; }
  }
  function undo() {
    const previous = history.at(-1); if (!previous) return;
    // Keep a forward snapshot in recovery so undo itself is recoverable.
    recovered = [...recovered, { project: copy(project), at: new Date().toISOString(), label: 'Before undo' }].slice(-30);
    history = history.slice(0, -1); project = copy(previous.project); notice = `Undid: ${previous.label}`; persist();
  }
  function restore() {
    const item = recoveryItems[Number(recoveryIndex)]; if (!item) return;
    change(copy(item.project), `Restored backup from ${new Date(item.at).toLocaleString()}.`); recoveryIndex = '';
  }
  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'orbis-world.orbis.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice = 'Project exported with authored landmarks, terrain edits, and world settings.';
  }
  async function importProject(event: Event) {
    const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
      const next = decodeProject(await file.text());
      change(next, 'Project imported. Previous world retained in recovery history.');
    } catch (cause) { error = `Import rejected: ${(cause as Error).message}`; }
    finally { input.value = ''; }
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
  <div class="brand" aria-label="Arline Orbis">
    <svg class="brand-symbol" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" /><ellipse cx="16" cy="16" rx="5" ry="12" /><path d="M4 16h24M7 9h18M7 23h18" /></svg>
    <span>Orbis<small>by Arline</small></span>
  </div>
  <div class="project-path"><span>World atlas</span><span aria-hidden="true">/</span><strong>{planet.name}</strong>{#if isSampleWorld}<span class="sample-badge">Sample</span>{/if}</div>
  <span class="local-indicator" role="status"><span class="status-dot"></span>{saveState}</span>
</header>

<main>
  <aside class="places-panel" aria-label="Places">
    <div class="panel-heading"><h2>Places</h2><span class="count">{(isSampleWorld ? SAMPLE_SITES.length : 0) + landmarks.length}</span></div>
    <details class="new-world-panel">
      <summary>+ Create new world</summary>
      <form onsubmit={(e) => { e.preventDefault(); makeNewWorld(); }}>
        <label>World name<input aria-label="New world name" bind:value={worldName} maxlength="80" required /></label>
        <label>Generator seed<input aria-label="New world seed" bind:value={worldSeed} maxlength="100" required /></label>
        <label>Radius (km)<input aria-label="New world radius (km)" type="number" bind:value={worldRadius} min="1" max="1000000" required /></label>
        <p class="help-text">Creates a separate planet with seed-varying fictional continents. Back up your current world before switching.</p>
        <button type="submit" class="secondary" disabled={!ready}>Create world</button>
      </form>
    </details>
    {#if isSampleWorld}
    <p class="section-label">Sample locations</p>
    <div class="sample-sites">
      {#each SAMPLE_SITES as site, index}
        <button class:chosen={selectedSite === site && !selectedLandmark} aria-pressed={selectedSite === site && !selectedLandmark} onclick={() => select(site)}>
          <span class="place-symbol" aria-hidden="true">{index === 0 ? '△' : index === 1 ? '≋' : '⌄'}</span>
          <span class="place-text"><span class="site-name">{site.name}</span><small>{index === 0 ? 'Highland' : index === 1 ? 'Ocean ridge' : 'Deep ocean'}</small></span>
          <span class="place-arrow" aria-hidden="true">›</span>
        </button>
      {/each}
    </div>
    {/if}
    <div class="landmark-list">
      <div class="list-heading"><p class="section-label">Your landmarks</p><span class="count">{landmarks.length}</span></div>
      <label class="sr-only" for="place-search">Search landmarks</label><input id="place-search" class="place-search" type="search" bind:value={search} placeholder="Search landmarks…" />
      {#each visibleLandmarks as landmark (landmark.id)}
        <button class:chosen={landmark.id === selectedLandmark?.id} aria-pressed={landmark.id === selectedLandmark?.id} onclick={() => select(landmark.position)}><span>{landmark.name}{landmark.locked ? ' · Locked' : ''}</span><small>{degrees(landmark.position)}</small></button>
      {:else}<div class="empty-places"><span aria-hidden="true">⌖</span><p>{search ? 'No matching landmarks.' : 'Your named places will appear here.'}</p><small>Select a position and add a landmark to begin.</small></div>{/each}
      {#if project.drafts.length}<details class="draft-list"><summary>Unfinished drafts ({project.drafts.length})</summary>{#each project.drafts as d}<button onclick={() => select(d)}><span>{d.name || 'Unnamed draft'}</span><small>{degrees(d)}</small></button>{/each}</details>{/if}
    </div>
    <div class="project-actions"><button class="secondary" disabled={!ready} onclick={() => { saveState = 'Saving…'; pending = true; void flush(); }}>Save world</button><div class="action-row"><button disabled={!ready} onclick={exportProject}>Export</button><button disabled={!ready} onclick={() => importInput.click()}>Import</button></div><input hidden bind:this={importInput} type="file" accept=".json,application/json" aria-label="Import project file" onchange={importProject} /><button class="secondary" disabled={!history.length || !ready} onclick={undo}>Undo last edit</button>
      <details class="recovery-panel"><summary>Recovery history ({recoveryItems.length})</summary><label for="recovery">Choose a backup</label><select id="recovery" bind:value={recoveryIndex}><option value="">Choose…</option>{#each recoveryItems as item, i}<option value={String(i)}>{new Date(item.at).toLocaleString()} · {item.label}</option>{/each}</select><button class="secondary" disabled={recoveryIndex === ''} onclick={restore}>Restore backup</button></details>
    </div>
    <div class="library-footer"><span class="status-dot"></span><span>Local world · project v{project.version}</span></div>
  </aside>

  <section class="workspace" aria-label="Planetary atlas">
    <div class="world-heading"><div><p class="eyebrow">PLANETARY ATLAS</p><h1>{planet.name}</h1></div>
      <div class="mode-switch" aria-label="View mode">
        <button class:active={mode === 'atlas'} aria-pressed={mode === 'atlas'} onclick={() => changeMode('atlas')}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m2 4 5-2 6 2 5-2v14l-5 2-6-2-5 2Zm5-2v14m6-12v14" /></svg>2D Atlas</button>
        <button class:active={mode === 'globe'} aria-pressed={mode === 'globe'} onclick={() => changeMode('globe')}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><ellipse cx="10" cy="10" rx="3.5" ry="8"/><path d="M2 10h16"/></svg>3D Globe</button>
      </div>
    </div>
    {#if graphicsError}<div class="graphics-notice" role="status">{graphicsError}</div>{/if}
    {#if storageError}<div class="graphics-notice" role="alert">{storageError}</div>{/if}
    <div class="chart">
      <div class="map-toolbar">
        <span class="view-caption">{mode === 'atlas' ? 'Equirectangular projection' : 'Spherical view'}</span>
        <div class="map-options">{#if mode === 'atlas'}<label><input type="checkbox" bind:checked={showGrid} />Grid</label><label><input type="checkbox" bind:checked={showLabels} />Region labels</label>{/if}<label><input type="checkbox" bind:checked={showWater} />Water</label><label><input type="checkbox" bind:checked={bathymetry} />Bathymetry</label>
          <label class="atlas-style-label">Style <select aria-label="Atlas map style" bind:value={mapStyle}><option value="natural">Natural atlas</option><option value="survey">Survey sheet</option></select></label>
          {#if mode === 'atlas'}<button type="button" class="tool-toggle" class:active={sculptMode} aria-label={sculptMode ? 'Sculpt ON' : 'Sculpt terrain'} aria-pressed={sculptMode} onclick={() => sculptMode = !sculptMode}><span aria-hidden="true">✦ </span>{sculptMode ? 'Sculpt ON' : 'Sculpt terrain'}</button>{/if}
        </div>
      </div>
      <div class="viewport" class:globe-mode={mode === 'globe'} class:sculpt-mode={sculptMode}>
        {#if texture}
          {#if mode === 'atlas'}<Atlas {texture} {selection} {landmarks} {showGrid} {showLabels} worldName={planet.name} sampleRegions={isSampleWorld} sculptMode={sculptMode} brushRadiusKm={brushRadius} planetRadius_m={planet.radius_m} onselect={selectOrSculpt} onhover={(point) => hover = point} />
          {:else}<Globe {texture} {raster} radius_m={planet.radius_m} {selection} {landmarks} onselect={select} onhover={(point) => hover = point} onerror={globeError} />{/if}
        {:else}<p class="loading" role="status">Preparing sample terrain…</p>{/if}
      </div>
      <div class="chart-bottom">
        <p class="view-instruction">{sculptMode ? 'SCULPT ACTIVE · Click the map to apply one geographic brush stroke · Drag to pan · Undo to reverse' : mode === 'atlas' ? 'Click to inspect · Drag to pan · + / − to zoom · Arrow keys move selection' : 'Drag to rotate · Scroll to zoom · Click to inspect'}</p>
        <div class="legend" aria-label={bathymetry && showWater ? 'Water depth legend' : showWater ? 'Sea-relative relief legend' : 'Exposed terrain legend'}><span>{!showWater ? 'Low terrain' : bathymetry ? '9,000+ m depth' : '−9,000 m from sea'}</span><div class="legend-ramp" class:bathymetry={bathymetry && showWater} class:exposed={!showWater}></div><span>{!showWater ? 'High terrain' : bathymetry ? '0 m · shore' : '+6,000 m from sea'}</span></div>
      </div>
    </div>
    <div class="atlas-footer"><span class="pointer-readout">{hover ? degrees(hover) : 'Move over the map to read coordinates'}</span><span>Radius { (planet.radius_m / 1000).toLocaleString('en-US') } km</span></div>
  </section>

  <aside class="inspector" aria-label="Position inspector">
    <div class="panel-heading"><h2>Inspector</h2><span class="inspector-symbol" aria-hidden="true">⌖</span></div>
    <div class="inspector-title"><p class="eyebrow">{selectedLandmark ? 'YOUR LANDMARK' : selectedSite ? 'SAMPLE LOCATION' : 'MAP POSITION'}</p><h2>{selectedLandmark?.name ?? selectedSite?.name ?? 'Selected position'}</h2><span class="record-classification">{groundElevation < planet.sea_level_m ? 'Ocean floor' : 'Land surface'}{selectedLandmark?.locked ? ' · Locked' : ''}</span></div>
    {#if selection}
      <div class="elevation-metric"><p class="section-label">{selectedLandmark ? 'Authored elevation' : groundElevation < planet.sea_level_m ? 'Seabed elevation' : 'Elevation'}</p><p data-testid="elevation">{elevation(selection.altitude_m)}</p><small>Relative to the fixed zero datum</small></div>
      <dl class="water-details">{#if selectedLandmark}<div><dt>Terrain elevation</dt><dd data-testid="terrain-elevation">{elevation(groundElevation)}</dd></div>{/if}<div><dt>Sea level</dt><dd>{elevation(planet.sea_level_m)}</dd></div><div><dt>Water depth</dt><dd data-testid="water-depth">{waterDepth(groundElevation, planet.sea_level_m).toLocaleString('en-US')} m</dd></div></dl>
      <dl class="position-details"><div><dt>Latitude</dt><dd data-testid="latitude">{selection.lat_deg.toFixed(4)}°</dd></div><div><dt>Longitude</dt><dd data-testid="longitude">{selection.lon_deg.toFixed(4)}°</dd></div></dl>
      <p class="observation-note">{selectedSite?.description ?? 'A geographic anchor for a place in your story.'}</p>
      <details class="inspector-tool terrain-editor" open={sculptMode}>
        <summary>Terrain sculpting <span class="tool-count">{strokeCount} / {MAX_TERRAIN_STROKES}</span></summary>
        <p class="help-text">Author-owned elevation changes are stored as geodesic brush strokes and survive save/export. Enable Sculpt on the 2D atlas to paint by clicking.</p>
        <div class="brush-inputs">
          <label>Brush radius (km)<input aria-label="Terrain brush radius (km)" type="number" min="1" max="2500" step="1" bind:value={brushRadius}/></label>
          <label>Height change (m)<input aria-label="Terrain height change (m)" type="number" min="-3000" max="3000" step="1" bind:value={brushDelta}/></label>
        </div>
        <p class="help-text">Positive raises land; negative carves basins or trenches. Locked landmarks cannot be painted over.</p>
        <div class="action-row"><button type="button" disabled={!ready || mode !== 'atlas' || strokeCount >= MAX_TERRAIN_STROKES} onclick={() => sculptAt(project.selection)}>Apply at selection</button><button type="button" disabled={!strokeCount} onclick={removeLastStroke}>Remove last</button></div>
      </details>
      <form class="landmark-form" onsubmit={(event) => { event.preventDefault(); saveLandmark(); }}>
        <label for="landmark-name">Landmark name</label><input id="landmark-name" value={name} oninput={(e) => editDraft(e.currentTarget.value, authoredElevation)} disabled={!ready || selectedLandmark?.locked} maxlength="80" placeholder="Name this place…" required />
        <label class="elevation-label" for="authored-elevation">Authored elevation (m)</label><input id="authored-elevation" type="number" value={authoredElevation} oninput={(e) => { if (e.currentTarget.value !== '') editDraft(name, e.currentTarget.valueAsNumber); }} disabled={!ready || selectedLandmark?.locked} min="-20000" max="20000" step="any" required />
        <button class="primary" disabled={!ready || selectedLandmark?.locked} type="submit">{selectedLandmark ? 'Update landmark' : 'Set landmark'}<span aria-hidden="true">{selectedLandmark ? '✓' : '+'}</span></button>
      </form>
      {#if draft}<p class="draft-notice" role="status">Draft retained at this position. <button onclick={discardDraft}>Discard draft</button></p>{/if}
      {#if selectedLandmark}<div class="action-row landmark-actions"><button onclick={lockLandmark}>{selectedLandmark.locked ? 'Unlock landmark' : 'Lock landmark'}</button><button class="delete-action" disabled={selectedLandmark.locked} onclick={deleteLandmark}>Delete landmark</button></div>{/if}
    {:else}<div class="empty-selection"><p>Select a place on the map</p><small>Inspect its coordinates and elevation, then give it a name.</small></div>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
    <details class="coordinate-disclosure"><summary>Go to coordinates</summary>
      <form class="coordinate-form" onsubmit={(event) => { event.preventDefault(); goTo(); }}><div class="coordinate-inputs"><label>Latitude<input type="number" bind:value={latitude} min="-90" max="90" step="any" required /></label><label>Longitude<input type="number" bind:value={longitude} step="any" required /></label></div><button type="submit" class="secondary">Inspect position</button></form>
      {#if selectedLandmark}<button class="secondary" disabled={selectedLandmark.locked} onclick={moveLandmark}>Move landmark to coordinates</button><p class="help-text">Moving keeps its authored elevation. Locked landmarks must be unlocked first.</p>{/if}
    </details>
    <details class="inspector-tool"><summary>Measure distance</summary><p class="help-text">Shortest great-circle distance using the world radius.</p><button class="secondary" onclick={() => measureStart = { ...project.selection }}>Set start at selection</button>{#if measureStart}<p class="help-text">From {degrees(measureStart)}</p><output class="distance-reading" data-testid="distance">{distanceKm(measureStart, selection, planet.radius_m).toLocaleString('en-US', { maximumFractionDigits: 2 })} km</output>
      {#if profileData}
        <div class="profile-section">
          <p class="section-label">Terrain & seabed cross-section</p>
          <svg viewBox="0 0 320 126" role="img" aria-label="Elevation profile along the shortest path between measured points" data-testid="elevation-profile">
            <rect x="9" y="13" width="302" height="97" rx="2" fill="#e5e8df"/>
            <line x1="10" x2="310" y1={profileData.zeroY} y2={profileData.zeroY} stroke="#477c95" stroke-width="1.5" stroke-dasharray="4 3"/>
            <polyline points={profileData.line} fill="none" stroke="#955b39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="12" font-size="9" fill="#5b584e">{Math.round(profileData.high).toLocaleString()} m</text>
            <text x="12" y="123" font-size="9" fill="#5b584e">{Math.round(profileData.low).toLocaleString()} m</text>
            <text x="308" y="123" font-size="9" text-anchor="end" fill="#5b584e">{Math.round(profileData.distanceKm).toLocaleString()} km</text>
          </svg>
          <p class="help-text">Blue dashed line: sea level. Profile follows a spherical great-circle route.</p>
        </div>
      {/if}
      <button class="secondary" onclick={() => measureStart = null}>Clear measurement</button>{/if}</details>
    <details class="inspector-tool"><summary>World settings</summary><form onsubmit={(e) => { e.preventDefault(); applySettings(); }}><label>Planet radius (km)<input type="number" bind:value={radiusKm} min="1" max="1000000" step="any" required /></label><label>Sea level (m)<input type="number" bind:value={seaLevel} min="-20000" max="20000" step="any" required /></label><label>Terrain seed<input bind:value={seed} maxlength="100" required /></label><button class="secondary" disabled={!ready} type="submit">Apply world settings</button></form><p class="help-text">Changing the seed regenerates sample terrain. Authored coordinates and elevations stay fixed. Sea level changes wet areas and water depth.</p></details>
    <div class="inspector-foot">
      <p class="session-note"><span aria-hidden="true">◷</span>{storageError ? 'Local save needs attention. Export before closing.' : 'Autosave in this browser. Export a backup to keep a portable copy.'}</p>
      <details class="prototype-details"><summary>About this sample</summary><p>Fictional terrain for exploring Orbis, not a scientific simulation. Authored landmarks are independent of regenerated terrain.</p><p>One {raster.width} × {raster.height} elevation raster powers both views. Water depth is sea level minus submerged elevation; it is not cave depth. Authored landmark elevation changes the anchor, while terrain strokes change the actual elevation raster.</p><p>Generation: {generationMs.toFixed(1)} ms · raster: {(raster.samples.byteLength / 1024).toFixed(0)} KiB · {planet.algorithm_version}. The globe uses visually exaggerated terrain geometry; all inspector elevations are measured from original data.</p></details>
    </div>
  </aside>
</main>
