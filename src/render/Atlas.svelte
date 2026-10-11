<script lang="ts">
  import { geoEquirectangular, geoGraticule, geoPath } from 'd3-geo';
  import type { Coordinate, Landmark } from '../core/world';
  import { coordinate, fromUV, toUV } from '../geo/coordinates';

  let { texture, selection, landmarks, showGrid, showLabels, onselect, onhover }: {
    texture: HTMLCanvasElement;
    selection: Coordinate | null;
    landmarks: Landmark[];
    showGrid: boolean;
    showLabels: boolean;
    onselect: (point: Coordinate) => void;
    onhover: (point: Coordinate | null) => void;
  } = $props();

  const width = 1000;
  const height = 500;
  const projection = geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, height / 2]);
  const grid = geoPath(projection)(geoGraticule().step([30, 30])());
  // Fictional sample annotations are view-only; they are not authored feature records.
  const regions = [
    { name: 'WESTERN REACH', lat_deg: 3, lon_deg: -73, ocean: false, angle: -14 },
    { name: 'EASTERN REACH', lat_deg: 30, lon_deg: 113, ocean: false, angle: 0 },
    { name: 'SOUTHERN ISLES', lat_deg: -39, lon_deg: 135, ocean: false, angle: 0 },
    { name: 'Aurelian Sea', lat_deg: 38, lon_deg: 28, ocean: true, angle: 0 },
    { name: 'Lantern Ridge', lat_deg: -27, lon_deg: 44, ocean: true, angle: -75 },
    { name: 'Veil Basin', lat_deg: -53, lon_deg: 67, ocean: true, angle: 0 },
  ];
  const image = $derived(texture.toDataURL());
  let surface: SVGSVGElement;

  function point(event: MouseEvent): Coordinate | null {
    const matrix = surface.getScreenCTM();
    if (!matrix) return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (local.x < 0 || local.x > width || local.y < 0 || local.y > height) return null;
    return fromUV(local.x / width, local.y / height);
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
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onselect(current);
    }
  }
</script>

<!-- Custom geographic widget: focus, Enter and arrow-key navigation are implemented above. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg bind:this={surface} class="atlas" viewBox="-25 -25 1050 550" role="application" tabindex="0"
  aria-label="2D planetary atlas. Click to select; arrow keys move selection, Shift moves ten degrees."
  onpointermove={(event) => onhover(point(event))} onpointerleave={() => onhover(null)}
  onclick={(event) => { const selected = point(event); if (selected) onselect(selected); }}
  onkeydown={key}>
  <rect x="-25" y="-25" width="1050" height="550" fill="#d9d4ba" />
  <path d="M0,-25V525 M1000,-25V525 M-25,0H1025 M-25,500H1025" fill="none" stroke="#7f8e84" stroke-width="0.7" />
  <image href={image} width={width} height={height} preserveAspectRatio="none" />
  {#if showGrid}<path data-testid="atlas-grid" d={grid ?? ''} fill="none" stroke="#dce6dc" stroke-opacity="0.13" stroke-width="0.65" />{/if}
  <g class="map-axis" pointer-events="none" aria-hidden="true">
    {#each [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150] as longitude}
      <text x={(longitude + 180) / 360 * width} y="-10" text-anchor="middle">{Math.abs(longitude)}°{longitude === 0 ? '' : longitude < 0 ? 'W' : 'E'}</text>
    {/each}
    {#each [60, 30, 0, -30, -60] as latitude}
      <text x="-12" y={(90 - latitude) / 180 * height + 3} text-anchor="middle" transform={`rotate(-90,-12,${(90 - latitude) / 180 * height + 3})`}>{Math.abs(latitude)}°{latitude === 0 ? '' : latitude < 0 ? 'S' : 'N'}</text>
    {/each}

    <text x="15" y="518">AURELIA · SAMPLE ATLAS</text>
    <text x="985" y="518" text-anchor="end">ELEVATIONS IN METERS</text>
  </g>
  {#if showLabels}<g data-testid="atlas-region-labels" pointer-events="none" aria-hidden="true">
    {#each regions as region}
      {@const uv = toUV(region)}
      <text transform={`translate(${uv.u * width},${uv.v * height}) rotate(${region.angle})`} text-anchor="middle" class:map-ocean-label={region.ocean} class:map-region-label={!region.ocean}>{region.name}</text>
    {/each}
  </g>{/if}
  {#each landmarks as landmark (landmark.id)}
    {@const uv = toUV(landmark.position)}
    <g transform={`translate(${uv.u * width},${uv.v * height})`} role="button" tabindex="0"
      aria-label={`Select ${landmark.name}`}
      onclick={(event) => { event.stopPropagation(); onselect(landmark.position); }}
      onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onselect(landmark.position); } }}>
      <circle r="12" fill="transparent" />
      <circle r="4" fill="#f0bb73" stroke="#172d38" stroke-width="2" />
      <text x={uv.u > 0.8 ? -10 : 10} y="-9" text-anchor={uv.u > 0.8 ? 'end' : 'start'} class="map-label">{landmark.name}</text>
    </g>
  {/each}
  {#if selection}
    {@const uv = toUV(selection)}
    <g transform={`translate(${uv.u * width},${uv.v * height})`} pointer-events="none">
      <circle r="10" fill="none" stroke="#ffd198" stroke-width="2" />
      <circle r="2" fill="#ffd198" />
      <path d="M-16,0h5 M11,0h5 M0,-16v5 M0,11v5" stroke="#ffd198" stroke-width="1.5" />
    </g>
  {/if}
</svg>
