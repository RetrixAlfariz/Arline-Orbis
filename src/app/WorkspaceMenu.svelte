<script lang="ts">
  import type { Snippet } from 'svelte';
  let { label, children }: { label: string; children: Snippet } = $props();
  let menu: HTMLDetailsElement;
  function dismiss(event: PointerEvent) {
    if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  }
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && menu?.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  }
  function selectCommand(event: MouseEvent) {
    if (event.target instanceof Element && menu?.contains(event.target) && event.target.closest('button:not(:disabled)')) menu.open = false;
  }
</script>

<svelte:window onpointerdown={dismiss} onkeydown={escape} onclick={selectCommand} />
<details bind:this={menu} class="workspace-menu" name="workspace-menu">
  <summary>{label}</summary>
  <div class="workspace-menu-items" role="group" aria-label={`${label} commands`}>
    {@render children()}
  </div>
</details>
