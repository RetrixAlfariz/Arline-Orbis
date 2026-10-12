<script lang="ts">
  import { readProjectFile, compressedProject } from '../core/portable';
  import { onMount } from 'svelte';
  import { createLandmark } from '../core/world';
  import type { Coordinate, Position } from '../core/world';
  import { coordinate, distanceKm } from '../geo/coordinates';
  import { newProject, decodeProject, anchorKey, waterDepth, MAX_PROJECT_BYTES } from '../core/project';
  import type { Project } from '../core/project';
  import { authoringProject } from '../core/project';
  import { visibleInEra, localWaterLevel } from '../core/authoring';
  import type { MapFeature } from '../core/authoring';
  import { lockedStrokeConflicts, regenerationConflicts } from '../authoring/conflicts';
  import FeaturePanel from '../authoring/FeaturePanel.svelte';
  import GenerationPanel from '../generation/GenerationPanel.svelte';
  import Workshop from '../generation/Workshop.svelte';
  import type { WorkshopView } from '../generation/workshop';
  import SubsurfacePanel from '../subsurface/SubsurfacePanel.svelte';
  import RegionalView from '../terrain/RegionalView.svelte';
  import { startGeneration } from '../generation/client';
  import type { WorldData, TerrainInput } from '../generation/pipeline';
  import { DEFAULT_OPTIONS } from '../generation/options';
  import { systemTexture, LAYER_LABELS } from '../render/systemTexture';
  import type { SystemLayer } from '../render/systemTexture';
  import type { ProjectionKind } from '../geo/projections';
  import { LANDFORMS } from '../generation/plates';
  import { BIOMES } from '../generation/hydrology';
  import { loadWorkspace, saveWorkspace } from '../core/storage';
  import type { Snapshot } from '../core/storage';
  import { generatePlanet, sampleElevation, SAMPLE_SITES } from '../terrain/sample';
  import { applyTerrainStrokes, validateTerrainStroke, strokeTouches, MAX_TERRAIN_STROKES } from '../terrain/sculpt';
  import { elevationProfile } from '../geo/profile';
  import { terrainTexture } from '../render/terrainTexture';
  import Atlas from '../render/Atlas.svelte';
  import Globe from '../render/Globe.svelte';
  import FieldworkBar from './FieldworkBar.svelte';
  import FloatingPanel from './FloatingPanel.svelte';
  import WorkspaceMenu from './WorkspaceMenu.svelte';
  import type { Visit } from './FieldworkBar.svelte';

  let project = $state<Project>(newProject());
  const planet = $derived(project.planet);
  let systemsData = $state<WorldData | null>(null);
  let systemsKey = $state('');
  let systemsLoading = $state(false);
  let systemsError = $state('');
  let retryGeneration = $state(0);
  function terrainInput(p:Project):TerrainInput { return {planet:p.planet,strokes:p.terrain_strokes??[],regions:p.regional_replacements??[],
    options:p.generation_options??{...DEFAULT_OPTIONS},width:p.generation_options?.resolution??360,height:(p.generation_options?.resolution??360)/2+1}; }
  const systemInput = $derived(terrainInput(project));
  const workerTerrain = $derived(planet.algorithm_version==='m4-plates-v1'||project.version===4);
  let workshopOpen=$state(false),workshopMinimized=$state(false);
  let workshopPreview=$state.raw<WorkshopView|null>(null);
  let workshopPoint=$state<Coordinate>({lat_deg:30,lon_deg:-55});
  let workshopBoundary=$state<{center:Coordinate;radius_km:number}|null>(null);
  function openWorkshop(){if(!workshopOpen)workshopPoint={...project.selection};workshopOpen=true;workshopMinimized=false;placesOpen=false;inspectorOpen=false;fieldworkOpen=false;focusMap=false;pane='world';sculptMode=false;stopDrawing();}
  function exitWorkshop(){workshopOpen=false;workshopPreview=null;workshopBoundary=null;inspectorOpen=true;placesOpen=window.innerWidth>760;}
  function previewPick(p:Coordinate){workshopPoint={...p};}
  $effect(()=>{if(!workshopOpen){workshopPreview=null;workshopBoundary=null;}});
  const currentSystemKey = $derived(JSON.stringify(systemInput));
  const fallbackRaster = {width:16,height:9,samples:new Int16Array(144)};

  // Selection and landmark edits must never re-run global terrain synthesis.
  // Cache by the *geographic* inputs only, not by a whole mutable Project reference.
  let cachedTerrainKey = '';
  let cachedTerrain: { raster: ReturnType<typeof generatePlanet>; ms: number } | undefined;
  const terrain = $derived.by(() => {
    if (workerTerrain) return {raster:systemsData?.raster??fallbackRaster,ms:systemsData?.timings.total??0};
    const key = planet.algorithm_version + '|' + planet.seed + '|' + planet.radius_m +
      '|' + JSON.stringify(project.terrain_strokes ?? []);
    if (key === cachedTerrainKey && cachedTerrain) return cachedTerrain;
    const start = performance.now();
    const base = generatePlanet(planet.seed, planet.algorithm_version as 'm0-sample-v1'|'m2-seeded-v1');
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
  const viewTexture=$derived(workshopPreview?.texture??texture);
  const viewRaster=$derived(workshopPreview?.data.raster??raster);
  const viewSelection=$derived(workshopPreview?{...workshopPreview.selection,altitude_m:sampleElevation(viewRaster,workshopPreview.selection)}:selection);
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
  const canEdit = $derived(ready && !workshopOpen && (!workerTerrain || systemsKey === currentSystemKey));
  let saveState = $state('Loading local world…');
  let offlineState = $state('Local preview');
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
  let focusMap = $state(false);
  let placesOpen = $state(true);
  let placesMinimized = $state(false);
  let fieldworkMinimized = $state(false);
  let inspectorOpen = $state(true);
  let inspectorMinimized = $state(false);
  let fieldworkOpen = $state(false);
  let layoutReset = $state(0);
  function revealInspector() {
    focusMap = false; inspectorOpen = true; inspectorMinimized = false;
    if (window.innerWidth <= 760) { if (!placesMinimized) placesOpen = false; if (!fieldworkMinimized) fieldworkOpen = false; }
  }
  function togglePanel(panel: 'places' | 'inspector' | 'fieldwork') {
    const show = focusMap || (panel === 'places' ? placesMinimized || !placesOpen : panel === 'inspector' ? inspectorMinimized || !inspectorOpen : fieldworkMinimized || !fieldworkOpen);
    if (window.innerWidth <= 760) {
      if (!placesMinimized) placesOpen = false;
      if (!inspectorMinimized) inspectorOpen = false;
      if (!fieldworkMinimized) fieldworkOpen = false;
    }
    if (panel === 'places') { placesOpen = show; placesMinimized = false; }
    else if (panel === 'inspector') { inspectorOpen = show; inspectorMinimized = false; }
    else { fieldworkOpen = show; fieldworkMinimized = false; }
    focusMap = false;pane='world';
  }
  function resetLayout() {
    focusMap = false;
    placesOpen = window.innerWidth > 760;
    inspectorOpen = true;
    fieldworkOpen = false;
    placesMinimized = inspectorMinimized = fieldworkMinimized = workshopMinimized = false;
    layoutReset++;
  }
  function restorePanels() {
    focusMap = false;
    placesMinimized = inspectorMinimized = fieldworkMinimized = workshopMinimized = false;
    placesOpen = fieldworkOpen = window.innerWidth > 760;
    inspectorOpen = true;
  }
  async function openTool(selector: string, inPlaces = false) {
    if (inPlaces) { placesOpen = true; placesMinimized = false; focusMap = false;
      if (window.innerWidth <= 760) { inspectorOpen = false; fieldworkOpen = false; }
    } else revealInspector();
    const { tick } = await import('svelte'); await tick();
    const tool = document.querySelector<HTMLDetailsElement>(selector);
    if (tool) { tool.open = true; tool.scrollIntoView({ block: 'nearest' }); tool.querySelector('summary')?.focus(); }
  }
  let visits = $state<Visit[]>([]);
  let visitWorldId = '';
  let landmarkNameInput = $state<HTMLInputElement>();
  let measurePanel: HTMLDetailsElement;
  const itinerary = $derived([
    ...(isSampleWorld ? SAMPLE_SITES.filter((s) => !landmarks.some((l) => anchorKey(l.position) === anchorKey(s))).map((s) => ({ ...s, name: s.name })) : []),
    ...landmarks.map((l) => ({ ...l.position, name: l.name })),
  ]);
  const stopIndex = $derived(itinerary.findIndex((s) => anchorKey(s) === anchorKey(project.selection)));
  let recoveryIndex = $state('');
  let worldName = $state('New world');
  let worldSeed = $state('orbis-world-001');
  let worldRadius = $state(6371);
  let sculptMode = $state(false);
  let pane = $state<'world' | 'underground' | 'region'>('world');
  let projectionKind = $state<ProjectionKind>('equirectangular');
  let projectionCenter = $state<Coordinate>({lat_deg:0,lon_deg:0});
  let displayLayer = $state<SystemLayer>('relief');
  let currentEra = $state('');
  let drawingKind = $state<MapFeature['kind'] | null>(null);
  let drawingVertices = $state<Coordinate[]>([]);
  const visibleFeatures = $derived((project.features??[]).filter(f=>visibleInEra(f,currentEra||null)));
  const hydroIndex = $derived(Math.min(raster.height-1,Math.round((90-project.selection.lat_deg)/180*(raster.height-1)))*raster.width + Math.min(raster.width-1,Math.floor((project.selection.lon_deg+180)/360*raster.width)));
  const localSeaLevel = $derived(localWaterLevel(visibleFeatures,project.selection,groundElevation,
    workerTerrain && Number.isFinite(systemsData?.hydro?.water_surface[hydroIndex]) ? systemsData!.hydro!.water_surface[hydroIndex] : planet.sea_level_m,currentEra||null));
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
    site.lat_deg === selection.lat_deg && site.lon_deg === selection.lon_deg) : undefined);
  const name = $derived(draft?.name ?? selectedLandmark?.name ?? '');
  const fieldTitle = $derived(selectedLandmark?.name ?? selectedSite?.name ?? 'Uncharted position');

  $effect(()=>{if(workerTerrain&&systemsData&&systemsKey===currentSystemKey){
    if((['temperature','rainfall','biomes'].includes(displayLayer)&&!systemsData.options?.climate)||(displayLayer==='water'&&!systemsData.hydro)||(['plates','landforms'].includes(displayLayer)&&!systemsData.plate_centers.length))displayLayer='relief';
  }});
  $effect(() => {
    if (ready) texture = displayLayer !== 'relief' && workerTerrain && systemsData && systemsKey === currentSystemKey
      ? systemTexture(systemsData,displayLayer)
      : terrainTexture(raster, { seaLevel: planet.sea_level_m, showWater, bathymetry, style: mapStyle });
  });
  $effect(() => {
    if (!ready || !workerTerrain) return;
    const key=currentSystemKey; void retryGeneration;
    if (systemsKey === key) return;
    let active=true; systemsLoading=true; systemsError='';
    const task=startGeneration(JSON.parse(key));
    task.result.then(data=>{if(active){systemsData=data;systemsKey=key;systemsLoading=false;}}).catch(e=>{if(active){systemsError=(e as Error).message;systemsLoading=false;}});
    return()=>{active=false;task.cancel();};
  });
  $effect(() => { latitude = project.selection.lat_deg; longitude = project.selection.lon_deg; });
  $effect(() => { radiusKm = planet.radius_m / 1000; seaLevel = planet.sea_level_m; seed = planet.seed; });
  const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  onMount(() => {
    let active = true;
    if (window.innerWidth <= 760) { placesOpen = false; inspectorOpen = false; }
    const smallScreen = window.matchMedia('(max-width: 760px)');
    const adaptPanels = () => {
      if (smallScreen.matches && inspectorOpen) { placesOpen = false; fieldworkOpen = false; }
      else if (smallScreen.matches && fieldworkOpen) placesOpen = false;
    };
    smallScreen.addEventListener('change', adaptPanels);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      offlineState='Preparing offline app';
      navigator.serviceWorker.register(new URL('sw.js',document.baseURI)).then(()=>navigator.serviceWorker.ready)
        .then(()=>new Promise<void>(resolve=>{
          if(navigator.serviceWorker.controller){resolve();return;}
          navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true});
        })).then(()=>{if(active)offlineState='Offline ready';}).catch(()=>{if(active)offlineState='Offline cache unavailable';});
    }
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
    return () => { active = false; window.removeEventListener('beforeunload', unload); smallScreen.removeEventListener('change', adaptPanels); };
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
    if (!canEdit) return;
    if (visitWorldId !== planet.id) { visits = []; visitWorldId = planet.id; }
    const previous = { ...project.selection, name: fieldTitle === 'Uncharted position' ? degrees(project.selection) : fieldTitle };
    const next = { ...project, selection: coordinate(point.lat_deg, point.lon_deg) };
    if (!withinLimit(next)) return;
    project = next;
    if (anchorKey(previous) !== anchorKey(project.selection)) visits = [...visits.filter((v) => anchorKey(v) !== anchorKey(previous)), previous].slice(-6);
    error = '';
    notice = '';
    persist();
  }
  function goTo() {
    try { select(coordinate(latitude, longitude)); } catch (cause) { error = (cause as Error).message; }
  }
  function stepStop(offset: number) {
    const index = stopIndex < 0 ? 0 : stopIndex + offset;
    if (itinerary[index]) select(itinerary[index]);
  }
  async function namePlace() {
    revealInspector();
    const { tick } = await import('svelte'); await tick();
    landmarkNameInput?.scrollIntoView({ block: 'nearest' }); landmarkNameInput?.focus({ preventScroll: true });
  }
  async function startRoute() {
    revealInspector();
    if (!measureStart) measureStart = { ...project.selection };
    const { tick } = await import('svelte'); await tick();
    measurePanel.open = true; measurePanel.scrollIntoView({ block: 'nearest' });
    measurePanel.querySelector('summary')?.focus({ preventScroll: true });
  }
  function saveLandmark() {
    if (!canEdit || selectedLandmark?.locked) return;
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
      mode = 'atlas'; sculptMode = false; measureStart = null; displayLayer='relief'; pane='world';currentEra='';stopDrawing();
    } catch (cause) { error = (cause as Error).message; }
  }
  function sculptAt(point: Coordinate) {
    if (!canEdit || mode !== 'atlas') return;
    try {
      const radius = Number(brushRadius), delta = Number(brushDelta);
      const stroke = validateTerrainStroke({ id: crypto.randomUUID(), ...point,
        radius_km: radius, delta_m: delta });
      if (strokeCount >= MAX_TERRAIN_STROKES) throw new Error('This project reached the 256-stroke limit. Undo or remove edits before adding more.');
      const conflicts = lockedStrokeConflicts(project,stroke);
      if (conflicts.length) throw new Error('Brush overlaps locked landmark or geometry: ' + conflicts.join(', ') + '. Unlock it or paint elsewhere.');
      const next = decodeProject({ ...copy(project), version: project.version >= 3 ? project.version : 2,
        selection: coordinate(point.lat_deg, point.lon_deg),
        terrain_strokes: [...(project.terrain_strokes ?? []), stroke] });
      change(next, (delta > 0 ? 'Raised' : 'Lowered') + ' terrain by up to ' + Math.abs(delta).toLocaleString() + ' m within ' + radius + ' km.');
    } catch (cause) { error = (cause as Error).message; }
  }
  function removeLastStroke() {
    if (!strokeCount) return;
    const protectedNames=lockedStrokeConflicts(project,project.terrain_strokes!.at(-1)!);
    if(protectedNames.length){error='Unlock affected geometry before removing this terrain stroke: '+protectedNames.join(', ');return;}
    change({ ...project, terrain_strokes: project.terrain_strokes!.slice(0, -1) }, 'Removed last terrain stroke.');
  }
  function selectOrSculpt(point: Coordinate) {
    if (!canEdit) return;
    if (drawingKind) { drawingVertices = drawingKind === 'point' ? [point] : [...drawingVertices,point]; select(point); }
    else if (sculptMode && mode === 'atlas') sculptAt(point);
    else select(point);
  }
  function applyGenerated(next:Project,data:WorldData) {
    // Validate before swapping either the terrain renderer or the saved project.
    next=decodeProject(next);
    const key=JSON.stringify(terrainInput(next));
    systemsData=data; systemsKey=key; systemsLoading=false; systemsError='';
    change(decodeProject(next),'Applied reviewed planetary generation. Authored anchors preserved.');
    displayLayer='relief'; pane='world';
  }
  function commitAuthoring(next:Project,label:string) { change(decodeProject(next),label); }
  function startDrawing(kind:MapFeature['kind']) { drawingKind=kind;drawingVertices=[];sculptMode=false;pane='world';mode='atlas'; }
  function stopDrawing() { drawingKind=null;drawingVertices=[]; }

  function changeMode(next: 'atlas' | 'globe') {
    if (next === 'globe') sculptMode = false;
    switchMode(next);
  }
  function applySettings() {
    try {
      if (workerTerrain && seed !== planet.seed) throw new Error('Use Planetary generation to preview and review a new geology seed.');
      if ((seed !== planet.seed || radiusKm*1000 !== planet.radius_m || seaLevel !== planet.sea_level_m) &&
          ((project.features??[]).some(f=>f.locked)||(project.caves?.nodes??[]).some(n=>n.locked)) &&
          !window.confirm('World settings change surrounding terrain or scale. Authored coordinates and elevations stay fixed. Review and apply this change?')) return;
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
  async function exportCompressed() {
    try {const blob=await compressedProject(JSON.stringify(project));const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='orbis-world.orbis';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice='Compressed project exported.';}
    catch(e){error=(e as Error).message;}
  }
  async function importProject(event: Event) {
    const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
      const next = decodeProject(await readProjectFile(file));
      change(next, 'Project imported. Previous world retained in recovery history.');
      currentEra='';displayLayer='relief';stopDrawing();
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

<header class="app-header menu-header">
  <nav class="application-menu" aria-label="Application menu">
    <WorkspaceMenu label="ORBIS">
      <span class="menu-caption">Orbis / Terrain studio</span>
      <button onclick={() => openTool('.prototype-details')}>About this world</button>
      <button onclick={resetLayout}>Reset workspace</button>
    </WorkspaceMenu>
    <WorkspaceMenu label="File">
      <button disabled={!ready} onclick={() => openTool('.new-world-panel', true)}>New world…</button>
      <button disabled={!ready} onclick={() => { saveState = 'Saving…'; pending = true; void flush(); }}>Save world</button>
      <button disabled={!ready} onclick={() => importInput.click()}>Import project…</button>
      <hr />
      <button disabled={!ready} onclick={exportProject}>Export project</button>
      <button disabled={!ready} onclick={exportCompressed}>Export compressed .orbis</button>
      <hr />
      <button disabled={!history.length || !ready} onclick={undo}>Undo last edit</button>
      <button onclick={() => openTool('.recovery-panel', true)}>Recovery history…</button>
    </WorkspaceMenu>
    <WorkspaceMenu label="View">
      <button aria-pressed={mode === 'atlas'} onclick={() => { pane = 'world'; changeMode('atlas'); }}>2D Atlas</button>
      <button aria-pressed={mode === 'globe'} onclick={() => { pane = 'world'; changeMode('globe'); }}>3D Globe</button>
      <hr />
      <button disabled={!canEdit} onclick={() => { pane = 'underground'; stopDrawing(); sculptMode = false; }}>Underground</button>
      <button disabled={!canEdit} onclick={() => { pane = 'region'; stopDrawing(); sculptMode = false; }}>Regional detail</button>
      <button onclick={() => focusMap = !focusMap}>{focusMap ? 'Restore panels' : 'Focus viewport'}</button>
    </WorkspaceMenu>
    <WorkspaceMenu label="Tools">
      <button disabled={!canEdit} onclick={namePlace}>Name this place…</button>
      <button disabled={!canEdit} onclick={startRoute}>Measure distance…</button>
      <button disabled={!canEdit} onclick={() => { pane = 'world'; changeMode('atlas'); sculptMode = true; void openTool('.terrain-editor'); }}>Sculpt terrain…</button>
      <button disabled={!canEdit} onclick={() => openTool('.authoring-panel')}>Features and lore…</button>
      <button disabled={!ready||systemsLoading} onclick={openWorkshop}>Generation Workshop</button>
      <button disabled={!canEdit} onclick={() => openTool('.generation-panel')}>Planetary generation…</button>
      <button onclick={() => openTool('.world-settings')}>World settings…</button>
    </WorkspaceMenu>
    <WorkspaceMenu label="Layout">
      <button onclick={() => togglePanel('places')}>Places & files</button>
      <button onclick={() => togglePanel('inspector')}>Inspector</button>
      <button onclick={() => togglePanel('fieldwork')}>Fieldwork</button>
      <button onclick={openWorkshop}>Generation Workshop</button>
      <hr />
      <button onclick={() => { placesMinimized = placesOpen; inspectorMinimized = inspectorOpen; fieldworkMinimized = fieldworkOpen; workshopMinimized = workshopOpen; focusMap = false; }}>Minimize all panels</button>
      <button onclick={restorePanels}>Restore all panels</button>
      <button onclick={resetLayout}>Reset layout</button>
    </WorkspaceMenu>
  </nav>
  <div class="project-path"><strong>{planet.name}</strong>{#if isSampleWorld}<span class="sample-badge">Sample</span>{/if}</div>
  <span class="offline-indicator" role="status">{offlineState}</span>
  <span class="local-indicator" role="status"><span class="status-dot"></span>{saveState}</span>
</header>
<nav class="panel-tray" aria-label="Minimized panels">
  {#if placesOpen && placesMinimized}<button onclick={() => togglePanel('places')} aria-label="Restore Places & files">Places & files <span>Restore</span></button>{/if}
  {#if inspectorOpen && inspectorMinimized}<button onclick={() => togglePanel('inspector')} aria-label="Restore Inspector">Inspector <span>Restore</span></button>{/if}
  {#if fieldworkOpen && fieldworkMinimized}<button onclick={() => togglePanel('fieldwork')} aria-label="Restore Fieldwork">Fieldwork <span>Restore</span></button>{/if}
  {#if workshopOpen && workshopMinimized}<button onclick={()=>workshopMinimized=false} aria-label="Restore Generation Workshop">Generation <span>Restore</span></button>{/if}
</nav>
<main class:focus-map={focusMap} class:alternate-workspace={pane!=='world'} class:generation-active={workshopOpen}>
  <FloatingPanel id="places" title="Places & files" bind:open={placesOpen} bind:minimized={placesMinimized} reset={layoutReset}>
  <aside class="places-panel" aria-label="Places">
    <div class="panel-heading"><h2>Field journal</h2><span class="count">{(isSampleWorld ? SAMPLE_SITES.length : 0) + landmarks.length}</span></div>
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
          <span class="place-symbol" aria-hidden="true">0{index + 1}</span>
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
    <div class="project-actions"><button class="secondary" disabled={!ready} onclick={() => { saveState = 'Saving…'; pending = true; void flush(); }}>Save world</button><div class="action-row"><button disabled={!ready} onclick={exportProject}>Export</button><button disabled={!ready} onclick={() => importInput.click()}>Import</button></div><input hidden bind:this={importInput} type="file" accept=".json,.orbis,application/json,application/gzip" aria-label="Import project file" onchange={importProject} /><button class="secondary" disabled={!ready} onclick={exportCompressed}>Export compressed .orbis</button><button class="secondary" disabled={!history.length || !ready} onclick={undo}>Undo last edit</button>
      <details class="recovery-panel"><summary>Recovery history ({recoveryItems.length})</summary><label for="recovery">Choose a backup</label><select id="recovery" bind:value={recoveryIndex}><option value="">Choose…</option>{#each recoveryItems as item, i}<option value={String(i)}>{new Date(item.at).toLocaleString()} · {item.label}</option>{/each}</select><button class="secondary" disabled={recoveryIndex === ''} onclick={restore}>Restore backup</button></details>
    </div>
    <div class="library-footer"><span class="status-dot"></span><span>Local world · project v{project.version}</span></div>
  </aside>
  </FloatingPanel>

  <section class="workspace" aria-label="Planetary atlas">
    <div class="workspace-top"><div class="world-heading"><div class="viewport-title"><h1>{planet.name}</h1><span>Viewport</span></div>
      <div class="mode-switch" aria-label="View mode">
        <button class:active={mode === 'atlas'} aria-pressed={mode === 'atlas'} onclick={() => changeMode('atlas')}>2D Atlas</button>
        <button class:active={mode === 'globe'} aria-pressed={mode === 'globe'} onclick={() => changeMode('globe')}>3D Globe</button>
      </div>
    </div>
    <nav class="workspace-tabs" aria-label="World workspace">
      <button class:active={pane==='world'} onclick={()=>pane='world'}>Surface atlas</button>
      <button class:active={pane==='underground'} disabled={!canEdit} onclick={()=>{pane='underground';stopDrawing();sculptMode=false;}}>Underground</button>
      <button class:active={pane==='region'} disabled={!canEdit} onclick={()=>{pane='region';stopDrawing();sculptMode=false;}}>Regional detail</button>
      {#if project.eras?.length}<label>Era<select aria-label="Visible story era" bind:value={currentEra}><option value="">All eras</option>{#each project.eras as e}<option value={e.id}>{e.name}</option>{/each}</select></label>{/if}
    </nav></div>

    {#if workshopOpen}<div class="generation-preview-banner" role="status"><div><strong>Generation preview</strong><span>{workshopPreview?`${workshopPreview.label} · ${workshopPreview.final?'Final result':'Draft'} · ${workshopPreview.data.raster.width} × ${workshopPreview.data.raster.height}`:'Preparing draft…'}</span></div><button onclick={()=>workshopMinimized=false}>Generation controls</button><button onclick={exitWorkshop}>Return to world</button></div>{/if}
    {#if systemsLoading}<p role="status">Rebuilding geographic layers in background…</p>{/if}
    {#if systemsError}<div role="alert" class="graphics-notice">{systemsError}<button onclick={()=>retryGeneration++}>Retry terrain generation</button></div>{/if}
    {#if graphicsError}<div class="graphics-notice" role="status">{graphicsError}</div>{/if}
    {#if storageError}<div class="graphics-notice" role="alert">{storageError}</div>{/if}
    {#if pane==='underground'}
      <SubsurfacePanel {project} {selection} {raster} era={currentEra||null} onchange={commitAuthoring} onselect={select}/>
    {:else if pane==='region'}
      <RegionalView {raster} selection={project.selection} seed={planet.seed} detail_m={project.generation_options?.detail_m??60} seaLevel={planet.sea_level_m} onselect={select}/>
    {:else}
    <div class="chart">
      <div class="map-toolbar">
        <span class="view-caption">{workshopOpen ? 'Preview viewport' : mode === 'atlas' ? 'Geographic projection' : 'Spherical view'}</span>
        {#if mode === 'atlas'}<label class="projection-picker">Projection<select aria-label="Map projection" bind:value={projectionKind}><option value="equirectangular">Equirectangular</option><option value="equal-earth">Equal Earth</option><option value="orthographic">Orthographic</option><option value="regional">Azimuthal regional</option></select></label>{#if projectionKind==='orthographic'||projectionKind==='regional'}<button onclick={()=>projectionCenter={...viewSelection}}>Center projection on selection</button>{/if}{/if}
        {#if workshopOpen}<span class="preview-layer" aria-label="Preview layer">{workshopPreview?LAYER_LABELS[workshopPreview.layer]:'Preparing preview…'}</span>{:else if workerTerrain&&systemsData}<label>Layer<select aria-label="Geographic system layer" bind:value={displayLayer}><option value="relief">Surface relief</option>{#if systemsData.plate_centers.length}<option value="plates">Tectonic plates</option><option value="landforms">Seafloor structures</option>{/if}{#if systemsData.options?.climate}<option value="temperature">Temperature</option><option value="rainfall">Rainfall</option><option value="biomes">Biomes</option>{/if}{#if systemsData.hydro}<option value="water">Lakes and basins</option>{/if}</select></label>{/if}
        <div class="map-options">{#if mode === 'atlas'}<label><input type="checkbox" bind:checked={showGrid} />Grid</label><label><input type="checkbox" bind:checked={showLabels} />Region labels</label>{/if}{#if !workshopOpen}<label><input type="checkbox" bind:checked={showWater} />Water</label><label><input type="checkbox" bind:checked={bathymetry} />Bathymetry</label>
          <label class="atlas-style-label">Style <select aria-label="Atlas map style" disabled={workshopOpen} bind:value={mapStyle}><option value="natural">Natural atlas</option><option value="survey">Survey sheet</option></select></label>
          {#if mode === 'atlas'}<button type="button" class="tool-toggle" class:active={sculptMode} aria-label={sculptMode ? 'Sculpt ON' : 'Sculpt terrain'} aria-pressed={sculptMode} disabled={workshopOpen} onclick={() => sculptMode = !sculptMode}><span aria-hidden="true">✦ </span>{sculptMode ? 'Sculpt ON' : 'Sculpt terrain'}</button>{/if}
          {/if}
        </div>
      </div>
      <div class="viewport" class:globe-mode={mode === 'globe'} class:sculpt-mode={sculptMode}>
        {#if viewTexture}
          {#if mode === 'atlas'}<Atlas texture={viewTexture} selection={viewSelection} {landmarks} {showGrid} {showLabels} worldName={planet.name} sampleRegions={isSampleWorld&&!workshopOpen} sculptMode={sculptMode&&!workshopOpen} brushRadiusKm={brushRadius} planetRadius_m={planet.radius_m} projectionKind={projectionKind} projectionCenter={projectionCenter} features={visibleFeatures} drawingVertices={drawingVertices} rivers={workshopPreview?.data.hydro?.rivers??(workerTerrain?systemsData?.hydro?.rivers??[]:[])} regionBoundary={workshopBoundary} disableExport={workshopOpen} measurementStart={measureStart} onselect={workshopOpen?previewPick:selectOrSculpt} onhover={(point) => hover = point} />
          {:else}<Globe texture={viewTexture} raster={viewRaster} radius_m={planet.radius_m} selection={viewSelection} {landmarks} features={visibleFeatures} onselect={workshopOpen?previewPick:select} onhover={(point) => hover = point} onerror={globeError} />{/if}
        {:else}<p class="loading" role="status">Preparing sample terrain…</p>{/if}
      </div>
      <div class="chart-bottom">
        <p class="view-instruction">{drawingKind ? 'DRAWING '+drawingKind+' · Click vertices; save in Map features & lore' : sculptMode ? 'SCULPT ACTIVE · Click the map to apply one geographic brush stroke · Drag to pan · Undo to reverse' : mode === 'atlas' ? 'Click to inspect · Drag to pan · + / − to zoom · Arrow keys move selection' : 'Drag to rotate · Scroll to zoom · Click to inspect'}</p>
        {#if workshopPreview}<div class="system-legend">{LAYER_LABELS[workshopPreview.layer]}{workshopPreview.layer==='temperature'?' · −40 to +35 °C':workshopPreview.layer==='rainfall'?' · 0 to 3000 mm/year':workshopPreview.layer==='plates'?' · numbered plate regions':workshopPreview.layer==='water'?' · ocean and inland water':''}</div>{:else if displayLayer!=='relief'&&workerTerrain}<div class="system-legend" aria-label="Geographic layer legend">{LAYER_LABELS[displayLayer]}{#if displayLayer==='temperature'} · blue −40 °C → red +35 °C{:else if displayLayer==='rainfall'} · pale 0 → dark 3000 mm/year{:else if displayLayer==='biomes'} · {BIOMES.join(' / ')}{:else if displayLayer==='landforms'} · {LANDFORMS.join(' / ')}{:else if displayLayer==='plates'} · numbered plate regions, colors repeat after 8{:else} · blue: ocean · teal: inland water{/if}</div>{:else}<div class="legend" aria-label={bathymetry && showWater ? 'Water depth legend' : showWater ? 'Sea-relative relief legend' : 'Exposed terrain legend'}><span>{!showWater ? 'Low terrain' : bathymetry ? '9,000+ m depth' : '−9,000 m from sea'}</span><div class="legend-ramp" class:bathymetry={bathymetry && showWater} class:exposed={!showWater}></div><span>{!showWater ? 'High terrain' : bathymetry ? '0 m · shore' : '+6,000 m from sea'}</span></div>{/if}
      </div>
    </div>
    <div class="atlas-footer"><span class="pointer-readout">{hover ? degrees(hover) : 'Move over the map to read coordinates'}</span><span>Radius { (planet.radius_m / 1000).toLocaleString('en-US') } km</span></div>
    {/if}
  </section>

  <FloatingPanel id="inspector" title="Inspector" side="right" bind:open={inspectorOpen} bind:minimized={inspectorMinimized} reset={layoutReset}>
  <aside class="inspector" aria-label="Position inspector">
    <div class="panel-heading"><h2>Field record</h2><span class="inspector-symbol" aria-hidden="true">⌖</span></div>
    <div class="inspector-title"><p class="eyebrow">{selectedLandmark ? 'YOUR LANDMARK' : selectedSite ? 'SAMPLE LOCATION' : 'MAP POSITION'}</p><h2>{selectedLandmark?.name ?? selectedSite?.name ?? 'Selected position'}</h2><span class="record-classification">{groundElevation < localSeaLevel ? (localSeaLevel !== planet.sea_level_m ? 'Inland water bed' : 'Ocean floor') : 'Land surface'}{selectedLandmark?.locked ? ' · Locked' : ''}</span></div>
    {#if selection}
      <div class="elevation-metric"><p class="section-label">{selectedLandmark ? 'Authored elevation' : groundElevation < planet.sea_level_m ? 'Seabed elevation' : 'Elevation'}</p><p data-testid="elevation">{elevation(selection.altitude_m)}</p><small>Relative to the fixed zero datum</small></div>
      <dl class="water-details">{#if selectedLandmark}<div><dt>Terrain elevation</dt><dd data-testid="terrain-elevation">{elevation(groundElevation)}</dd></div>{/if}<div><dt>Sea level</dt><dd>{elevation(planet.sea_level_m)}</dd></div>{#if localSeaLevel !== planet.sea_level_m}<div><dt>Local water surface</dt><dd data-testid="local-water-level">{elevation(localSeaLevel)}</dd></div>{/if}<div><dt>Water depth</dt><dd data-testid="water-depth">{waterDepth(groundElevation, localSeaLevel).toLocaleString('en-US')} m</dd></div></dl>
      {#if localSeaLevel!==planet.sea_level_m}<p class="help-text">Local water surface: {elevation(localSeaLevel)}; separate from ocean sea level.</p>{/if}
      {#if workerTerrain&&systemsData&&canEdit}<dl class="water-details">{#if systemsData.plate_centers.length}<div><dt>Plate</dt><dd>{systemsData.plates[hydroIndex]+1}</dd></div><div><dt>Landform</dt><dd>{LANDFORMS[systemsData.landforms[hydroIndex]]}</dd></div>{/if}{#if systemsData.options?.climate}<div><dt>Temperature</dt><dd>{systemsData.temperature[hydroIndex]?.toFixed(1)} °C</dd></div><div><dt>Rainfall</dt><dd>{systemsData.rainfall[hydroIndex]} mm/year</dd></div><div><dt>Biome</dt><dd>{BIOMES[systemsData.biome[hydroIndex]]}</dd></div>{/if}</dl>{/if}
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
        <div class="action-row"><button type="button" disabled={!canEdit || mode !== 'atlas' || strokeCount >= MAX_TERRAIN_STROKES} onclick={() => sculptAt(project.selection)}>Apply at selection</button><button type="button" disabled={!strokeCount} onclick={removeLastStroke}>Remove last</button></div>
      </details>
      <form class="landmark-form" onsubmit={(event) => { event.preventDefault(); saveLandmark(); }}>
        <label for="landmark-name">Landmark name</label><input bind:this={landmarkNameInput} id="landmark-name" value={name} oninput={(e) => editDraft(e.currentTarget.value, authoredElevation)} disabled={!canEdit || selectedLandmark?.locked} maxlength="80" placeholder="Name this place…" required />
        <label class="elevation-label" for="authored-elevation">Authored elevation (m)</label><input id="authored-elevation" type="number" value={authoredElevation} oninput={(e) => { if (e.currentTarget.value !== '') editDraft(name, e.currentTarget.valueAsNumber); }} disabled={!canEdit || selectedLandmark?.locked} min="-20000" max="20000" step="any" required />
        <button class="primary" disabled={!canEdit || selectedLandmark?.locked} type="submit">{selectedLandmark ? 'Update landmark' : 'Set landmark'}<span aria-hidden="true">{selectedLandmark ? '✓' : '+'}</span></button>
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
    <details bind:this={measurePanel} class="inspector-tool"><summary>Measure distance</summary><p class="help-text">Shortest great-circle distance using the world radius.</p><button class="secondary" onclick={() => measureStart = { ...project.selection }}>Set start at selection</button>{#if measureStart}<p class="help-text">From {degrees(measureStart)}</p><output class="distance-reading" data-testid="distance">{distanceKm(measureStart, selection, planet.radius_m).toLocaleString('en-US', { maximumFractionDigits: 2 })} km</output>
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
    <details class="inspector-tool world-settings"><summary>World settings</summary><form onsubmit={(e) => { e.preventDefault(); applySettings(); }}><label>Planet radius (km)<input type="number" bind:value={radiusKm} min="1" max="1000000" step="any" required /></label><label>Sea level (m)<input type="number" bind:value={seaLevel} min="-20000" max="20000" step="any" required /></label><label>Terrain seed<input bind:value={seed} maxlength="100" required /></label><button class="secondary" disabled={!ready} type="submit">Apply world settings</button></form><p class="help-text">Changing the seed regenerates sample terrain. Authored coordinates and elevations stay fixed. Sea level changes wet areas and water depth.</p></details>
    {#if canEdit}
      <FeaturePanel {project} selection={project.selection} vertices={drawingVertices} drawing={drawingKind} onstart={startDrawing} onclear={stopDrawing} onchange={commitAuthoring} oninspect={select}/>
      <GenerationPanel {project} {raster} onapply={applyGenerated}/>
    {/if}
    <div class="inspector-foot">
      <p class="session-note"><span aria-hidden="true">◷</span>{storageError ? 'Local save needs attention. Export before closing.' : 'Autosave in this browser. Export a backup to keep a portable copy.'}</p>
      <details class="prototype-details"><summary>About this sample</summary><p>Fictional terrain for exploring Orbis, not a scientific simulation. Authored landmarks are independent of regenerated terrain.</p><p>One {raster.width} × {raster.height} elevation raster powers both views. Water depth is sea level minus submerged elevation; it is not cave depth. Authored landmark elevation changes the anchor, while terrain strokes change the actual elevation raster.</p><p>Generation: {generationMs.toFixed(1)} ms · raster: {(raster.samples.byteLength / 1024).toFixed(0)} KiB · {planet.algorithm_version}. The globe uses visually exaggerated terrain geometry; all inspector elevations are measured from original data.</p></details>
    </div>
  </aside>
  </FloatingPanel>
  <FloatingPanel id="generation" title="Generation Workshop" side="right" bind:open={workshopOpen} bind:minimized={workshopMinimized} reset={layoutReset}>
    <Workshop {project} {raster} visible={workshopOpen} active={workshopOpen&&!workshopMinimized&&!systemsLoading} point={workshopPoint}
      onpreview={view=>workshopPreview=view} onregion={region=>workshopBoundary=region} onapply={applyGenerated} onexit={exitWorkshop} onatlas={()=>{pane='world';changeMode('atlas');}}/>
  </FloatingPanel>
  <FloatingPanel id="fieldwork" title="Fieldwork" side="center" bind:open={fieldworkOpen} bind:minimized={fieldworkMinimized} reset={layoutReset}>
    <FieldworkBar title={fieldTitle} coordinates={degrees(project.selection)} {stopIndex} stopCount={itinerary.length} trail={visits} focused={focusMap} measuring={measureStart !== null} ready={canEdit} onstep={stepStop} onvisit={select} onname={namePlace} onmeasure={startRoute} onfocus={() => focusMap = !focusMap} />
  </FloatingPanel>
</main>
