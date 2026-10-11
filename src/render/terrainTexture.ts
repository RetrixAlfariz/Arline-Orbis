import type { ElevationRaster } from '../terrain/sample';

export type AtlasStyle = 'natural' | 'survey';

/** Original Orbis palettes: geographic blue and verdant vellum; alternate archival survey ink. */
const stops: [number, [number, number, number]][] = [
  [-9000, [18, 48, 83]], [-6500, [29, 73, 112]], [-4500, [44, 102, 144]],
  [-2400, [72, 139, 172]], [-900, [111, 176, 195]], [-1, [161, 206, 207]],
  [0, [227, 213, 177]], [200, [221, 209, 162]], [650, [198, 204, 144]],
  [1500, [151, 176, 120]], [2900, [161, 152, 121]],
  [4300, [185, 174, 158]], [6000, [242, 236, 221]],
];
const surveyStops: typeof stops = [
  [-9000, [86, 124, 143]], [-6500, [121, 154, 163]], [-4500, [159, 183, 187]],
  [-2400, [191, 209, 210]], [-900, [217, 226, 220]], [-1, [224, 233, 230]],
  [0, [248, 243, 229]], [200, [247, 243, 231]], [650, [239, 232, 215]],
  [1500, [222, 210, 190]], [2900, [204, 191, 174]],
  [4300, [188, 176, 160]], [6000, [239, 231, 218]],
];

export function elevationColor(elevation: number, style: AtlasStyle = 'natural'): [number, number, number] {
  const palette = style === 'survey' ? surveyStops : stops;
  for (let i = 1; i < palette.length; i++) {
    if (elevation <= palette[i][0]) {
      const [low, a] = palette[i - 1];
      const [high, b] = palette[i];
      const fraction = Math.max(0, (elevation - low) / (high - low));
      return a.map((value, channel) => Math.round(value + (b[channel] - value) * fraction)) as [number, number, number];
    }
  }
  return palette[palette.length - 1][1];
}

export function terrainTexture(raster: ElevationRaster, options: {
  seaLevel: number; showWater: boolean; bathymetry: boolean; style?: AtlasStyle;
} = { seaLevel: 0, showWater: true, bathymetry: false }): HTMLCanvasElement {
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
    const style = options.style ?? 'natural';
    const [r, g, b] = !options.showWater && wet ? elevationColor(Math.max(0, height + 9000) / 3, style)
      : wet ? elevationColor(Math.min(-1, relative - (options.bathymetry ? 0 : options.seaLevel)), style)
      : options.bathymetry && options.showWater ? (style === 'survey' ? [229, 225, 210] : [192, 188, 144])
      : elevationColor(Math.max(0, height - options.seaLevel), style);
    const column = i % raster.width;
    const row = Math.floor(i / raster.width);
    const left = raster.samples[i - column + (column + raster.width - 1) % raster.width];
    const right = raster.samples[i - column + (column + 1) % raster.width];
    const north = raster.samples[Math.max(0, row - 1) * raster.width + column];
    const south = raster.samples[Math.min(raster.height - 1, row + 1) * raster.width + column];
    // Display-only northwest relief. Never modify authoritative elevation samples.
    // Northwest-illuminated cartographic relief, display-only. Shadowed steep sides
    // remain readable on both sea floor and mountains; geometry is not modified.
    const relief = Math.max(0.72, Math.min(1.18, 1 + (right - left + south - north) / 1950));
    image.data.set([Math.min(255, r * relief), Math.min(255, g * relief), Math.min(255, b * relief), 255], i * 4);
  }
  context.putImageData(image, 0, 0);

  // Original marching-squares isolines, sampled from the same raster as the inspector.
  // The last column wraps to the first; the texture edge remains geographic, not a border.
  const coast = options.seaLevel;
  const levels = [...new Set(options.bathymetry && options.showWater
    ? [coast - 9000, coast - 7500, coast - 6000, coast - 4500, coast - 3000, coast - 2000, coast - 1000, coast]
    : [-9000, -7500, -6000, -4500, -3000, -2000, -1000, coast, coast + 250, coast + 750, coast + 1500, coast + 2500, coast + 4000, coast + 5500])];
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
    context.strokeStyle = level === coast ? (options.style === 'survey' ? 'rgba(89, 101, 95, 0.8)' : 'rgba(233, 226, 182, 0.8)')
      : level < coast && options.showWater ? (options.style === 'survey' ? 'rgba(62, 102, 117, 0.35)' : 'rgba(212, 235, 226, 0.32)')
      : (options.style === 'survey' ? 'rgba(86, 77, 66, 0.3)' : 'rgba(91, 80, 58, 0.27)');
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
