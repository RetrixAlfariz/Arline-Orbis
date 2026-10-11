import type { Coordinate } from '../core/world';

const radians = Math.PI / 180;

export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new Error('Longitude must be finite.');
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

export function coordinate(latitude: number, longitude: number): Coordinate {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90 degrees.');
  }
  return { lat_deg: latitude, lon_deg: normalizeLongitude(longitude) };
}

/** Equirectangular UV: north at v=0, antimeridian at u=0/1. */
export function toUV(point: Coordinate): { u: number; v: number } {
  return { u: (normalizeLongitude(point.lon_deg) + 180) / 360, v: (90 - point.lat_deg) / 180 };
}

export function fromUV(u: number, v: number): Coordinate {
  return coordinate(90 - Math.max(0, Math.min(1, v)) * 180, u * 360 - 180);
}

/** Matches Three SphereGeometry's default equirectangular UV convention. */
export function toVector(point: Coordinate, radius = 1): [number, number, number] {
  const latitude = point.lat_deg * radians;
  const longitude = point.lon_deg * radians;
  return [radius * Math.cos(latitude) * Math.cos(longitude), radius * Math.sin(latitude),
    -radius * Math.cos(latitude) * Math.sin(longitude)];
}

export function fromVector(x: number, y: number, z: number): Coordinate {
  const radius = Math.hypot(x, y, z);
  if (!Number.isFinite(radius) || radius === 0) throw new Error('Invalid sphere position.');
  return coordinate(Math.asin(Math.max(-1, Math.min(1, y / radius))) / radians,
    Math.atan2(-z, x) / radians);
}
