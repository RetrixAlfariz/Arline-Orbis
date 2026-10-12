<script lang="ts">
  import { onMount } from 'svelte';
  import type { Coordinate, Landmark } from '../core/world';
  import type { MapFeature } from '../core/authoring';
  import type { ElevationRaster } from '../terrain/sample';
  import type { createGlobe } from './globe';

  let { texture, raster, radius_m, selection, landmarks, features = [], onselect, onhover, onerror }: {
    texture: HTMLCanvasElement;
    raster: ElevationRaster;
    radius_m: number;
    selection: Coordinate | null;
    landmarks: Landmark[];
    features?: MapFeature[];
    onselect: (point: Coordinate) => void;
    onhover: (point: Coordinate | null) => void;
    onerror: (message: string) => void;
  } = $props();
  let host: HTMLDivElement;
  let controller = $state<ReturnType<typeof createGlobe> | null>(null);
  let loading = $state(true);

  onMount(() => {
    let cancelled = false;
    import('./globe').then(({ createGlobe }) => {
      if (cancelled) return;
      try {
        controller = createGlobe(host, texture, raster, radius_m, onselect, onhover, onerror);
        loading = false;
      } catch {
        onerror('WebGL is unavailable on this browser. Continue exploring in the 2D atlas.');
      }
    }).catch(() => { if (!cancelled) onerror('The globe could not load. Continue in the 2D atlas.'); });
    return () => { cancelled = true; controller?.dispose(); onhover(null); };
  });

  $effect(() => { controller?.update(selection, landmarks); });
  $effect(() => { controller?.setTexture(texture); });
  $effect(() => { controller?.setTerrain(raster, radius_m); });
  $effect(() => { controller?.setFeatures(features); });
</script>

<div class="globe" bind:this={host}>
  {#if loading}<p class="loading" role="status">Preparing globe…</p>{/if}
</div>
