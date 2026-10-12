import { it, expect } from 'vitest';
import { reliefShade } from '../../src/render/relief';
it('keeps hillshade stable for the same geographic slope at standard, HD and regional densities without changing samples', () => {
  const field = (width: number, height: number, span_lon = 360, span_lat = 180) => ({ width, height, span_lon, span_lat,
    samples: Int16Array.from({ length: width * height }, (_, i) => Math.round((i % width) / (width - 1) * span_lon * 12 + Math.floor(i / width) / (height - 1) * span_lat * 6)) });
  const a = field(721, 361), b = field(1441, 721), region = field(129, 129, 22.5, 11.25);
  const before = new Int16Array(b.samples);
  const normal = reliefShade(a, 180 * 721 + 360), hd = reliefShade(b, 360 * 1441 + 720), local = reliefShade(region, 64 * 129 + 64);
  expect(hd).toBeCloseTo(normal, 3); expect(local).toBeCloseTo(normal, 2); expect(b.samples).toEqual(before);
});
