import type { ElevationRaster } from '../terrain/sample';

/** Geographic gradient at a 720×361 display reference, independent of raster density. */
export function reliefShade(raster: ElevationRaster & { span_lon?: number; span_lat?: number }, index: number): number {
  const column = index % raster.width, row = Math.floor(index / raster.width);
  const left = raster.samples[index - column + (column + raster.width - 1) % raster.width];
  const right = raster.samples[index - column + (column + 1) % raster.width];
  const north = raster.samples[Math.max(0, row - 1) * raster.width + column];
  const south = raster.samples[Math.min(raster.height - 1, row + 1) * raster.width + column];
  const xScale = raster.span_lon ? (raster.width - 1) * 360 / raster.span_lon / 720 : raster.width / 720;
  const yScale = (raster.height - 1) * 180 / (raster.span_lat ?? 180) / 360;
  return Math.max(.72, Math.min(1.18, 1 + ((right - left) * xScale + (south - north) * yScale) / 1950));
}
