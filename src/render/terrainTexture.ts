import type { ElevationRaster } from '../terrain/sample';

const stops: [number, [number, number, number]][] = [
  [-9000, [21, 42, 55]], [-5000, [32, 64, 79]], [-2500, [45, 94, 110]],
  [-1, [94, 145, 147]], [0, [165, 183, 152]], [450, [142, 165, 135]],
  [1800, [114, 145, 115]], [3400, [164, 165, 127]], [6000, [221, 215, 184]],
];

export function elevationColor(elevation: number): [number, number, number] {
  for (let i = 1; i < stops.length; i++) {
    if (elevation <= stops[i][0]) {
      const [low, a] = stops[i - 1];
      const [high, b] = stops[i];
      const fraction = Math.max(0, (elevation - low) / (high - low));
      return a.map((value, channel) => Math.round(value + (b[channel] - value) * fraction)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

export function terrainTexture(raster: ElevationRaster, options = { seaLevel: 0, showWater: true, bathymetry: false }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const image = context.createImageData(raster.width, raster.height);
  for (let i = 0; i < raster.samples.length; i++) {
    const height = raster.samples[i];
    const wet = height < options.seaLevel;
    const relative = options.bathymetry && wet ? height - options.seaLevel : height;
    const [r, g, b] = !options.showWater && wet ? elevationColor(Math.max(0, height + 9000) / 3)
      : wet ? elevationColor(Math.min(-1, relative - (options.bathymetry ? 0 : options.seaLevel)))
      : options.bathymetry && options.showWater ? [139, 153, 126] : elevationColor(Math.max(0, height - options.seaLevel));
    const column = i % raster.width;
    const row = Math.floor(i / raster.width);
    const left = raster.samples[i - column + (column + raster.width - 1) % raster.width];
    const right = raster.samples[i - column + (column + 1) % raster.width];
    const north = raster.samples[Math.max(0, row - 1) * raster.width + column];
    const south = raster.samples[Math.min(raster.height - 1, row + 1) * raster.width + column];
    // Display-only northwest relief. Never modify authoritative elevation samples.
    const relief = Math.max(0.76, Math.min(1.16, 1 + (right - left + south - north) / 2200));
    image.data.set([Math.min(255, r * relief), Math.min(255, g * relief), Math.min(255, b * relief), 255], i * 4);
  }
  context.putImageData(image, 0, 0);

  // Original marching-squares isolines, sampled from the same raster as the inspector.
  // The last column wraps to the first; the texture edge remains geographic, not a border.
  const coast = options.seaLevel;
  const levels = [...new Set(options.bathymetry && options.showWater
    ? [coast - 6000, coast - 4000, coast - 2000, coast - 1000, coast]
    : [-6000, -4000, -2000, -1000, coast, 1000, 2000, 4000])];
  for (const level of levels) {
    context.beginPath();
    for (let y = 0; y < raster.height - 1; y++) {
      for (let x = 0; x < raster.width; x++) {
        const nextX = (x + 1) % raster.width;
        const values = [raster.samples[y * raster.width + x], raster.samples[y * raster.width + nextX],
          raster.samples[(y + 1) * raster.width + nextX], raster.samples[(y + 1) * raster.width + x]];
        if (values.every((value) => value >= level) || values.every((value) => value < level)) continue;
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        const crossings: number[][] = [];
        for (let edge = 0; edge < 4; edge++) {
          const next = (edge + 1) % 4;
          if ((values[edge] >= level) === (values[next] >= level)) continue;
          const t = (level - values[edge]) / (values[next] - values[edge]);
          crossings.push([corners[edge][0] + t * (corners[next][0] - corners[edge][0]),
            corners[edge][1] + t * (corners[next][1] - corners[edge][1])]);
        }
        // Resolve saddle cells using their center; no zero-denominator intersections.
        if (crossings.length === 4 && (values.reduce((sum, value) => sum + value, 0) / 4 >= level) !== (values[0] >= level)) {
          crossings.push(crossings.shift()!);
        }
        for (let edge = 0; edge < crossings.length; edge += 2) {
          context.moveTo(...crossings[edge] as [number, number]);
          context.lineTo(...crossings[edge + 1] as [number, number]);
        }
      }
    }
    context.strokeStyle = level === coast ? 'rgba(235, 225, 181, 0.65)' : level < coast && options.showWater ? 'rgba(165, 205, 210, 0.18)' : 'rgba(77, 75, 46, 0.17)';
    context.lineWidth = level === coast ? 2 : 0.5;
    context.stroke();
    if (level === coast) {
      context.strokeStyle = '#576d64';
      context.lineWidth = 0.65;
      context.stroke();
    }
  }
  return canvas;
}
