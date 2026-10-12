<script lang="ts">
  import { geoGraticule, geoPath, geoCircle } from 'd3-geo';
  import { makeProjection, projectPoint, invertPoint, reprojectTexture } from '../geo/projections';
  import type { ProjectionKind } from '../geo/projections';
  import type { MapFeature } from '../core/authoring';
  import { featureGeometry } from '../core/authoring';
  import type { Coordinate, Landmark } from '../core/world';
  import { coordinate, fromUV, toUV } from '../geo/coordinates';

  let { texture, selection, landmarks, showGrid, showLabels, worldName, sampleRegions, sculptMode, brushRadiusKm, planetRadius_m, projectionKind = 'equirectangular', projectionCenter = {lat_deg:0,lon_deg:0}, features = [], drawingVertices = [], rivers = [], measurementStart = null, regionBoundary = null, disableExport = false, onselect, onhover }: {
    texture: HTMLCanvasElement;
    selection: Coordinate | null;
    landmarks: Landmark[];
    showGrid: boolean;
    showLabels: boolean;
    worldName: string;
    sampleRegions: boolean;
    sculptMode: boolean;
    brushRadiusKm: number;
    planetRadius_m: number;
    projectionKind?: ProjectionKind;
    projectionCenter?: Coordinate;
    features?: MapFeature[];
    drawingVertices?: Coordinate[];
    rivers?: Coordinate[][];
    measurementStart?: Coordinate | null;
    disableExport?: boolean;
    regionBoundary?: {center:Coordinate;radius_km:number}|null;
    onselect: (point: Coordinate) => void;
    onhover: (point: Coordinate | null) => void;
  } = $props();

  const width = 1000;
  const height = 500;
  const projection = $derived(makeProjection(projectionKind, projectionCenter, width, height));
  const path = $derived(geoPath(projection));
  const grid = $derived(path(geoGraticule().step([30,30])()));
  const locate = (p:Coordinate) => projectPoint(projection,projectionKind,projectionCenter,p);
  // Fictional sample annotations are view-only; they are not authored feature records.
  const regions = [
    { name: 'WESTERN REACH', lat_deg: 3, lon_deg: -73, ocean: false, angle: -14 },
    { name: 'EASTERN REACH', lat_deg: 30, lon_deg: 113, ocean: false, angle: 0 },
    { name: 'SOUTHERN ISLES', lat_deg: -39, lon_deg: 135, ocean: false, angle: 0 },
    { name: 'Aurelian Sea', lat_deg: 38, lon_deg: 28, ocean: true, angle: 0 },
    { name: 'Lantern Ridge', lat_deg: -27, lon_deg: 44, ocean: true, angle: -75 },
    { name: 'Veil Basin', lat_deg: -53, lon_deg: 67, ocean: true, angle: 0 },
  ];
  const image = $derived(reprojectTexture(texture, projection, projectionKind, projectionCenter));
  let surface: SVGSVGElement;
  let zoom = $state(1);
  let originX = $state(-25);
  let originY = $state(-25);
  let drag: { x: number; y: number; originX: number; originY: number; inverse: DOMMatrix; id: number } | null = null;
  let dragged = false;
  function constrain() {
    originX = Math.max(-25, Math.min(1025 - 1050 / zoom, originX));
    originY = Math.max(-25, Math.min(525 - 550 / zoom, originY));
  }
  function magnify(factor: number) {
    const next = Math.max(1, Math.min(8, zoom * factor));
    originX += (1050 / zoom - 1050 / next) / 2;
    originY += (550 / zoom - 550 / next) / 2;
    zoom = next; constrain();
  }
  function reset() { zoom = 1; originX = -25; originY = -25; }
  function down(event: PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest('[role="button"]')) return;
    const matrix = surface.getScreenCTM(); if (!matrix) return;
    event.preventDefault(); surface.focus({ preventScroll: true });
    drag = { x: event.clientX, y: event.clientY, originX, originY, inverse: matrix.inverse(), id: event.pointerId };
    dragged = false;
    surface.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (drag && event.pointerId === drag.id) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) dragged = true;
      if (dragged) {
        const start = new DOMPoint(drag.x, drag.y).matrixTransform(drag.inverse);
        const end = new DOMPoint(event.clientX, event.clientY).matrixTransform(drag.inverse);
        originX = drag.originX + start.x - end.x; originY = drag.originY + start.y - end.y; constrain();
      }
    }
    onhover(point(event));
  }

  function point(event: MouseEvent): Coordinate | null {
    const matrix = surface.getScreenCTM();
    if (!matrix) return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (local.x < 0 || local.x > width || local.y < 0 || local.y > height) return null;
    return invertPoint(projection, projectionKind, projectionCenter, local.x, local.y);
  }

  function key(event: KeyboardEvent) {
    const current = selection ?? coordinate(0, 0);
    const step = event.shiftKey ? 10 : 1;
    const offsets: Record<string, [number, number]> = {
      ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step],
    };
    if (offsets[event.key]) {
      event.preventDefault();
      const [lat, lon] = offsets[event.key];
      onselect(coordinate(Math.max(-90, Math.min(90, current.lat_deg + lat)), current.lon_deg + lon));
    } else if (event.key === '+' || event.key === '=') { event.preventDefault(); magnify(1.5);
    } else if (event.key === '-') { event.preventDefault(); magnify(1 / 1.5);
    } else if (event.key === '0') { event.preventDefault(); reset();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onselect(current);
    }
  }
  function exportAtlas(){
    const copy=surface.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width','1600');copy.setAttribute('height','840');
    const originals=surface.querySelectorAll('*'), clones=copy.querySelectorAll('*');
    for(let i=0;i<originals.length;i++)for(const prop of ['fill','stroke','font-size','font-family','font-style','font-weight','letter-spacing','paint-order','stroke-width']){
      const value=getComputedStyle(originals[i]).getPropertyValue(prop);if(value)(clones[i] as SVGElement).style.setProperty(prop,value);
    }
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download='orbis-atlas.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
</script>

<div class="atlas-navigation" aria-label="Atlas navigation"><button disabled={disableExport} aria-label="Export atlas SVG" onclick={exportAtlas}>SVG</button><button aria-label="Zoom in atlas" disabled={zoom >= 8} onclick={() => magnify(1.5)}>+</button><button aria-label="Zoom out atlas" disabled={zoom <= 1} onclick={() => magnify(1 / 1.5)}>−</button><button aria-label="Reset atlas view" onclick={reset}>{zoom.toFixed(1)}×</button></div>

<!-- Custom geographic widget: focus, Enter and arrow-key navigation are implemented above. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg bind:this={surface} class="atlas" viewBox={`${originX} ${originY} ${1050 / zoom} ${550 / zoom}`} role="application" tabindex="0"
  aria-label={sculptMode ? '2D atlas in sculpt mode. Click terrain to apply elevation stroke. Drag to pan.' : '2D planetary atlas. Click to select; arrow keys move selection, Shift moves ten degrees.'}
  onpointerdown={down} onpointermove={move} onpointerup={() => drag = null} onpointercancel={() => { drag = null; dragged = false; }} onpointerleave={() => onhover(null)}
  onclick={(event) => { if (dragged) { dragged = false; return; } const selected = point(event); if (selected) onselect(selected); }}
  onkeydown={key}>
  <rect x="-25" y="-25" width="1050" height="550" fill="#d9d4ba" />
  <path d="M0,-25V525 M1000,-25V525 M-25,0H1025 M-25,500H1025" fill="none" stroke="#7f8e84" stroke-width="0.7" />
  <image href={image} width={width} height={height} preserveAspectRatio="none" />
  {#if showGrid}<path data-testid="atlas-grid" d={grid ?? ''} fill="none" stroke="#dce6dc" stroke-opacity="0.13" stroke-width="0.65" />{/if}
  {#if projectionKind === 'equirectangular'}<g class="map-axis" pointer-events="none" aria-hidden="true">
    {#each [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150] as longitude}
      <text x={(longitude + 180) / 360 * width} y="-10" text-anchor="middle">{Math.abs(longitude)}°{longitude === 0 ? '' : longitude < 0 ? 'W' : 'E'}</text>
    {/each}
    {#each [60, 30, 0, -30, -60] as latitude}
      <text x="-12" y={(90 - latitude) / 180 * height + 3} text-anchor="middle" transform={`rotate(-90,-12,${(90 - latitude) / 180 * height + 3})`}>{Math.abs(latitude)}°{latitude === 0 ? '' : latitude < 0 ? 'S' : 'N'}</text>
    {/each}

    <text x="15" y="518">{worldName.toUpperCase()} · PLANETARY ATLAS</text>
    <text x="985" y="518" text-anchor="end">ELEVATIONS IN METERS</text>
  </g>
  {/if}
  {#if showLabels && sampleRegions}<g data-testid="atlas-region-labels" pointer-events="none" aria-hidden="true">
    {#each regions as region}
      {@const position = locate(region)}
      {#if position}{@const uv = {u:position[0]/width,v:position[1]/height}}
      <text transform={`translate(${uv.u * width},${uv.v * height}) rotate(${region.angle})`} text-anchor="middle" class:map-ocean-label={region.ocean} class:map-region-label={!region.ocean}>{region.name}</text>{/if}
    {/each}
  </g>{/if}
  {#each rivers as river}<path d={path({type:'LineString',coordinates:river.map(p=>[p.lon_deg,p.lat_deg])})??''} fill="none" stroke="#306b91" stroke-width="1" pointer-events="none"/>{/each}
  {#each features as feature (feature.id)}
    <path data-testid="map-feature" d={path(featureGeometry(feature))??''} fill={['polygon','region'].includes(feature.kind)?feature.layer==='lake'?'#699daf88':'#b2784655':'none'} stroke={feature.layer==='lake'||feature.layer==='river'?'#367692':feature.locked?'#9b4439':'#6b5e49'} stroke-width={feature.kind==='point'?3:1.5} stroke-dasharray={feature.layer==='border'?'5 3':'none'}><title>{feature.name}</title></path>
  {/each}
  {#if drawingVertices.length}<path d={path(featureGeometry({kind:drawingVertices.length===1?'point':'line',coordinates:drawingVertices}))??''} fill="none" stroke="#c33c31" stroke-width="2" stroke-dasharray="4 3"/>{/if}
  {#if measurementStart&&selection}<path d={path({type:'LineString',coordinates:[[measurementStart.lon_deg,measurementStart.lat_deg],[selection.lon_deg,selection.lat_deg]]})??''} stroke="#b14332" stroke-width="1.7" stroke-dasharray="6 3" fill="none" pointer-events="none"/>{/if}
  {#each landmarks as landmark (landmark.id)}
    {@const position = locate(landmark.position)}
    {#if position}{@const uv={u:position[0]/width,v:position[1]/height}}
    <g transform={`translate(${uv.u * width},${uv.v * height})`} role="button" tabindex="0"
      aria-label={`Select ${landmark.name}`}
      onclick={(event) => { event.stopPropagation(); onselect(landmark.position); }}
      onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onselect(landmark.position); } }}>
      <circle r="12" fill="transparent" />
      <circle r="4" fill="#f0bb73" stroke="#172d38" stroke-width="2" />
      <text x={uv.u > 0.8 ? -10 : 10} y="-9" text-anchor={uv.u > 0.8 ? 'end' : 'start'} class="map-label">{landmark.name}</text>
    </g>{/if}
  {/each}
  {#if regionBoundary}<path data-testid="replacement-boundary" d={path(geoCircle().center([regionBoundary.center.lon_deg,regionBoundary.center.lat_deg]).radius(Math.min(179,regionBoundary.radius_km*1000/planetRadius_m*180/Math.PI))())??''} fill="#d9ad51" fill-opacity=".12" stroke="#f0c46e" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"/>{/if}
  {#if selection}
    {@const position = locate(selection)}
    {#if position}{@const uv = {u:position[0]/width,v:position[1]/height}}
    {#if sculptMode}
      <path d={path(geoCircle().center([selection.lon_deg,selection.lat_deg]).radius(Math.min(179,brushRadiusKm*1000/planetRadius_m*180/Math.PI))())??''} fill="#ad473d" fill-opacity=".1" stroke="#b7372e" stroke-width="1.8" stroke-dasharray="5 4" pointer-events="none"/>
    {/if}
    <g transform={`translate(${uv.u * width},${uv.v * height})`} pointer-events="none">
      <circle r="10" fill="none" stroke="#ffd198" stroke-width="2" />
      <circle r="2" fill="#ffd198" />
      <path d="M-16,0h5 M11,0h5 M0,-16v5 M0,11v5" stroke="#ffd198" stroke-width="1.5" />
    </g>
    {/if}
  {/if}
</svg>
