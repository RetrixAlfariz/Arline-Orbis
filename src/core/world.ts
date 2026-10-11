export interface Coordinate {
  lat_deg: number;
  lon_deg: number;
}

export interface Position extends Coordinate {
  altitude_m: number;
}

export interface Landmark {
  id: string;
  name: string;
  position: Position;
  source: 'authored';
  locked?: boolean;
}

export interface Planet {
  id: string;
  name: string;
  radius_m: number;
  sea_level_m: number;
  seed: string;
  algorithm_version: 'm0-sample-v1';
}

export const SAMPLE_PLANET: Planet = {
  id: 'orbis-sample-aurelia',
  name: 'Aurelia',
  radius_m: 6_371_000,
  sea_level_m: 0,
  seed: 'aurelia-001',
  algorithm_version: 'm0-sample-v1',
};

export function createLandmark(name: string, position: Position, id: string): Landmark {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error('Use a name between 1 and 80 characters.');
  return { id, name: trimmed, position: { ...position }, source: 'authored' };
}
