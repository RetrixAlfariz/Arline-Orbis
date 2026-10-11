<script lang="ts">
  import { onMount } from 'svelte';
  import type { Coordinate, Landmark } from '../core/world';
  import type { createGlobe } from './globe';

  let { texture, selection, landmarks, onselect, onhover, onerror }: {
    texture: HTMLCanvasElement;
    selection: Coordinate | null;
    landmarks: Landmark[];
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
        controller = createGlobe(host, texture, onselect, onhover, onerror);
        loading = false;
      } catch {
        onerror('WebGL is unavailable on this browser. Continue exploring in the 2D atlas.');
      }
    }).catch(() => { if (!cancelled) onerror('The globe could not load. Continue in the 2D atlas.'); });
    return () => { cancelled = true; controller?.dispose(); onhover(null); };
  });

  $effect(() => { controller?.update(selection, landmarks); });
</script>

<div class="globe" bind:this={host}>
  {#if loading}<p class="loading" role="status">Preparing globe…</p>{/if}
</div>
