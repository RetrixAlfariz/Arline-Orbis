import { chromium } from '@playwright/test';

// Run against an already-started local dev/preview server. No thresholds: this is evidence, not a portable FPS claim.
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(process.env.ORBIS_BENCH_URL ?? 'http://127.0.0.1:4173');
  await page.getByRole('application').waitFor();
  await page.locator('details').evaluate((element) => { element.open = true; });
  const detail = await page.locator('details').innerText();
  const heap = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return Math.round(metrics.find((metric) => metric.name === 'JSHeapUsedSize').value / 1024 / 1024 * 100) / 100;
  };
  const atlasHeapMiB = await heap();
  const selectionMs = await page.evaluate(async () => {
    const times = [];
    const button = [...document.querySelectorAll('.sample-sites button')][0];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      button.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      times.push(performance.now() - start);
    }
    return times.sort((a, b) => a - b);
  });
  const startGlobe = performance.now();
  await page.getByRole('button', { name: '3D Globe', exact: true }).click();
  await page.locator('.globe canvas').waitFor();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const globeReadyMs = performance.now() - startGlobe;
  const globeHeapMiB = await heap();
  const dragIntervals = await page.locator('.globe canvas').evaluate(async (canvas) => {
    const bounds = canvas.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const intervals = [];
    const event = (type, dx) => new PointerEvent(type, { pointerId: 1, pointerType: 'mouse',
      clientX: x + dx, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true });
    canvas.dispatchEvent(event('pointerdown', 0));
    let previous = performance.now();
    for (let i = 1; i <= 40; i++) {
      canvas.dispatchEvent(event('pointermove', i * 3));
      const timestamp = await new Promise((resolve) => requestAnimationFrame(resolve));
      intervals.push(timestamp - previous);
      previous = timestamp;
    }
    canvas.dispatchEvent(event('pointerup', 120));
    return intervals.slice(1).sort((a, b) => a - b);
  });
  const stats = (values) => ({ median: +values[Math.floor(values.length / 2)].toFixed(2),
    p95: +values[Math.floor(values.length * 0.95)].toFixed(2) });
  console.log(JSON.stringify({ browser: browser.version(), viewport: '1440x1000', renderer: 'ANGLE SwiftShader software WebGL',
    detail, atlasHeapMiB, globeHeapMiB, globeReadyMs: +globeReadyMs.toFixed(2),
    selectionTwoFrameMs: stats(selectionMs), globeDragFrameIntervalMs: stats(dragIntervals) }, null, 2));
} finally { await browser.close(); }
