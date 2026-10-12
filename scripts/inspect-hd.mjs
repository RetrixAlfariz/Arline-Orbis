import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'docs/design/celestial-studio'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}); const page = await browser.newPage({viewport:{width:1440,height:800}});
await page.goto('http://127.0.0.1:4180');
const result = await page.evaluate(async () => {
  const { generateWorld } = await import('/src/generation/pipeline.ts');
  const { DEFAULT_OPTIONS } = await import('/src/generation/options.ts');
  const { newProject } = await import('/src/core/project.ts');
  const { terrainTexture } = await import('/src/render/terrainTexture.ts');
  const { createGlobe } = await import('/src/render/globe.ts');
  const planet = { ...newProject().planet, seed: 'hd-quality-review', algorithm_version: 'm4-plates-v1' };
  const data = [];
  for (const erosion of [false, true]) {
    const normal = generateWorld({ planet, strokes: [], options: { ...DEFAULT_OPTIONS, erosion, climate: false, hydrology: false }, width: 720, height: 361 });
    const hd = generateWorld({ planet, strokes: [], options: { ...DEFAULT_OPTIONS, erosion, climate: false, hydrology: false }, width: 1440, height: 721 });
    let max = 0, sum = 0, different = 0;
    for (let y = 1; y < 360; y++) for (let x = 0; x < 720; x++) { const d = Math.abs(normal.raster.samples[y * 720 + x] - hd.raster.samples[y * 2 * 1440 + x * 2]); max = Math.max(max, d); sum += d; if (d) different++; }
    data.push({ erosion, different, maxDifference_m: max, meanDifference_m: sum / (359 * 720) });
    if (erosion) { const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 750; const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a151d'; ctx.fillRect(0, 0, 1440, 750); ctx.fillStyle = '#efd09a'; ctx.font = '20px Georgia';
      ctx.fillText('STANDARD · 720 × 361 · same seed / view', 20, 30); ctx.fillText('HD · 1440 × 721 · same seed / view', 20, 402);
      ctx.drawImage(terrainTexture(normal.raster), 0, 42, 1440, 320); ctx.drawImage(terrainTexture(hd.raster), 0, 415, 1440, 320);
      const container = document.createElement('div'); container.id = 'hd-globe-comparison';
      container.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;grid-template-columns:1fr 1fr;background:#08121b;color:#efcc88;font:20px Georgia';
      document.body.appendChild(container);
      for (const [label, world] of [['STANDARD · 720 × 361', normal], ['HD · 1440 × 721', hd]]) {
        const column = document.createElement('div'); column.style.cssText = 'display:flex;flex-direction:column;min-width:0';
        const heading = document.createElement('p'); heading.textContent = label; heading.style.padding = '16px';
        const host = document.createElement('div'); host.style.cssText = 'flex:1;min-height:0'; column.append(heading,host); container.appendChild(column);
        const globe = createGlobe(host,terrainTexture(world.raster),world.raster,planet.radius_m,()=>{},()=>{},()=>{}); globe.update({lat_deg:30,lon_deg:-55},[]);
      }
      return { metrics: data, image: canvas.toDataURL('image/png') }; }
  }
});
await writeFile(`${out}/hd-comparison.png`, Buffer.from(result.image.split(',')[1], 'base64'));
await writeFile(`${out}/hd-metrics.json`, JSON.stringify(result.metrics, null, 2));
await page.waitForTimeout(500); await page.screenshot({path:`${out}/hd-globes.png`});
console.log(JSON.stringify(result.metrics)); await browser.close();
