<script lang="ts">
  let { kind = 'compass' }: { kind?: 'compass' | 'atlas' | 'globe' | 'terrain' | 'journal' | 'places' } = $props();
</script>
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
  {#if kind === 'compass'}
    <circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9"/><path d="M16 0v32M0 16h32M5 5l22 22M5 27L27 5M16 5l3 11-3 11-3-11Z"/><circle cx="16" cy="16" r="2"/>
  {:else if kind === 'globe'}
    <circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5" ry="12"/><path d="M4 16h24M6 10h20M6 22h20"/>
  {:else if kind === 'atlas'}
    <path d="m3 7 8-3 10 4 8-3v22l-8 3-10-4-8 3ZM11 4v22M21 8v22M6 13l2-1M14 12l4 2M24 12l2-1"/>
  {:else if kind === 'terrain'}
    <path d="m2 27 10-17 5 9 5-14 9 22ZM9 16l3 3 3-3M20 11l2 3 3-2M25 3h6M28 0v6"/>
  {:else if kind === 'journal'}
    <path d="M7 3h20v26H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM7 3v26M11 9h11M11 14h11M11 19h7"/>
  {:else}
    <path d="M16 29S5 18 5 11a11 11 0 0 1 22 0c0 7-11 18-11 18Z"/><circle cx="16" cy="11" r="4"/>
  {/if}
</svg>
