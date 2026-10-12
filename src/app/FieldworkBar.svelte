<script module lang="ts">
  import type { Coordinate } from '../core/world';
  export interface Visit extends Coordinate { name: string }
</script>
<script lang="ts">
  let { title, coordinates, stopIndex, stopCount, trail, focused, measuring, ready, onstep, onvisit, onname, onmeasure, onfocus }: {
    title: string; coordinates: string; stopIndex: number; stopCount: number; trail: Visit[];
    focused: boolean; measuring: boolean; ready: boolean;
    onstep: (offset: number) => void; onvisit: (visit: Visit) => void;
    onname: () => void; onmeasure: () => void; onfocus: () => void;
  } = $props();
</script>

<section class="fieldwork-bar" aria-label="Fieldwork">
  <div class="fieldwork-location">
    <span class="fieldwork-kicker">{stopIndex >= 0 ? `STOP ${String(stopIndex + 1).padStart(2, '0')} / ${String(stopCount).padStart(2, '0')}` : 'OFF THE BEATEN PATH'}</span>
    <strong>{title}</strong>
    <span class="fieldwork-coordinates">{coordinates}</span>
  </div>
  <div class="fieldwork-actions">
    <div class="stop-navigation" aria-label="Guided stops">
      <button disabled={!ready || stopIndex <= 0} onclick={() => onstep(-1)}>Previous stop</button>
      <button disabled={!ready || !stopCount || stopIndex === stopCount - 1} onclick={() => onstep(1)}>Next stop</button>
    </div>
    <button disabled={!ready} onclick={onname}>Name this place</button>
    <button disabled={!ready} aria-pressed={measuring} onclick={onmeasure}>{measuring ? 'Review route' : 'Start a route'}</button>
    <button class="focus-action" aria-pressed={focused} onclick={onfocus}>{focused ? 'Restore workspace' : 'Focus map'}</button>
  </div>
  {#if trail.length}
    <nav class="visit-trail" aria-label="Visited places">
      <span>Retrace</span>
      {#each trail as visit}
        <button title={visit.name} onclick={() => onvisit(visit)}>{visit.name}</button>
      {/each}
    </nav>
  {:else}
    <p class="fieldwork-invitation">{stopCount ? 'Follow the stops, or pick somewhere new. Your trail appears here as you explore.' : 'Pick a place and give it a name. Your world becomes an itinerary as you write.'}</p>
  {/if}
</section>
