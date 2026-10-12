<script module lang="ts">
  let front = 30;
</script>

<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';

  let { id, title, side = 'left', open = $bindable(true), minimized = $bindable(false), reset = 0, children }: {
    id: string; title: string; side?: 'left' | 'right' | 'center'; open?: boolean;
    minimized?: boolean; reset?: number; children: Snippet;
  } = $props();
  let panel: HTMLElement;
  let x = $state(16), y = $state(150), z = $state(30);
  let mounted = $state(false);
  let drag: { id: number; x: number; y: number; originX: number; originY: number } | null = null;
  const key = $derived(`orbis.panel.${id}.v1`);
  const mobile = () => window.innerWidth <= 760;

  function clamp() {
    const width = panel.offsetWidth || Math.min(324, window.innerWidth - 16);
    x = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    y = Math.max(112, Math.min(y, window.innerHeight - 100));
  }
  function defaults() {
    x = side === 'right' ? window.innerWidth - 340 : side === 'center' ? (window.innerWidth - 324) / 2 : 16;
    y = side === 'center' ? window.innerHeight - 320 : 160;
    clamp();
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify({ x, y })); } catch { /* Layout is optional. */ }
  }
  function raise() { z = ++front; }
  function start(event: PointerEvent) {
    raise();
    if (mobile() || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: x, originY: y };
    event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    x = drag.originX + event.clientX - drag.x;
    y = drag.originY + event.clientY - drag.y;
    clamp();
  }
  function end() { if (drag) { drag = null; save(); } }
  function keyboard(event: KeyboardEvent) {
    if (mobile() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    raise();
    const amount = event.shiftKey ? 40 : 10;
    if (event.key === 'Home') defaults();
    else { x += event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0;
      y += event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0; clamp(); }
    save();
  }
  onMount(() => {
    defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        x = saved.x; y = saved.y; clamp();
      }
    } catch { /* Ignore malformed layout, without touching project data. */ }
    mounted = true;
    const resize = () => { if (!mobile()) clamp(); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  });
  $effect(() => { if (mounted && reset > 0) { untrack(() => { defaults(); minimized = false; save(); }); } });
  $effect(() => { if (mounted && open && !minimized) untrack(() => { clamp(); raise(); }); });
</script>

<section bind:this={panel} class="floating-panel" data-panel={id} hidden={!open || minimized}
  style:left={`${x}px`} style:top={`${y}px`} style:z-index={z}
  style:--panel-space={`calc(100dvh - ${y + 16}px)`} aria-label={`${title} panel`}>
  <div class="floating-titlebar">
    <button class="panel-handle" aria-label={`Move ${title} panel`} title="Drag to move. Arrow keys move; Home resets."
      onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} onkeydown={keyboard}>
      {title}
    </button>
    <button class="panel-control" aria-label={`Minimize ${title}`} onclick={() => minimized = true}>Minimize</button>
    <button class="panel-control" aria-label={`Close ${title}`} onclick={() => open = false}>Close</button>
  </div>
  <div class="floating-content">{@render children()}</div>
</section>
