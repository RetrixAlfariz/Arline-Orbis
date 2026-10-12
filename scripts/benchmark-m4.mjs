/** CPU kernel benchmark. Does not measure GPU memory, browser FPS, or worker latency. */
import { createServer } from 'vite';
import os from 'node:os';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: false, server: { middlewareMode: true }, appType: 'custom',
});
try {
  const { generateWorld } = await server.ssrLoadModule('/src/generation/pipeline.ts');
  const { DEFAULT_OPTIONS } = await server.ssrLoadModule('/src/generation/options.ts');
  const reports = [];
  for (const resolution of [360, 720]) {
    const options = { ...DEFAULT_OPTIONS, resolution };
    const input = {
      planet: { id: 'benchmark', name: 'Benchmark', radius_m: 6371000, sea_level_m: 0,
        seed: 'orbis-complete-42', algorithm_version: 'm4-plates-v1' },
      strokes: [], options, width: resolution, height: resolution / 2 + 1,
    };
    const data = generateWorld(input);
    const arrays = [data.raster.samples, data.plates, data.landforms, data.temperature,
      data.rainfall, data.biome, data.sediment, ...(data.hydro ? [data.hydro.parent,
        data.hydro.accumulation, data.hydro.watershed, data.hydro.water_surface] : [])];
    reports.push({ resolution, samples: data.raster.samples.length, timings_ms: data.timings,
      data_array_bytes: arrays.reduce((sum, a) => sum + a.byteLength, 0),
      rivers: data.hydro?.rivers.length ?? 0, lakes: data.hydro?.lake_count ?? 0,
      landforms: [...new Set(data.landforms)], rss_process_mib: process.memoryUsage().rss / 2 ** 20 });
  }
  const report = { date: new Date().toISOString(), cpu: os.cpus()[0]?.model,
    logical_cpus: os.cpus().length, system_memory_gib: os.totalmem() / 2 ** 30,
    platform: os.platform(), node: process.version,
    note: 'Node + Vite SSR kernel sample. RSS includes Node, compiler and retained data; not browser/GPU or low-end-device performance.', reports };
  const json = JSON.stringify(report, null, 2);
  if (process.argv[2]) await writeFile(process.argv[2], json);
  console.log(json);
} finally { await server.close(); }
