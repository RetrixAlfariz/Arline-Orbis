import { SAMPLE_PLANET, createLandmark } from './world';
import type { Coordinate, Landmark, Planet } from './world';
import { coordinate } from '../geo/coordinates';
import { validateTerrainStroke, MAX_TERRAIN_STROKES } from '../terrain/sculpt';
import type { TerrainStroke } from '../terrain/sculpt';

export interface Draft extends Coordinate { name: string; altitude_m: number }
export interface Project {
  format: 'orbis-project';
  version: 1 | 2;
  terrain_strokes?: TerrainStroke[];
  planet: Planet;
  landmarks: Landmark[];
  drafts: Draft[];
  selection: Coordinate;
  [field: string]: unknown;
}
export const MAX_PROJECT_BYTES = 2_000_000;
export function newProject(): Project {
  return { format: 'orbis-project', version: 1, planet: { ...SAMPLE_PLANET }, landmarks: [], drafts: [],
    selection: coordinate(30, -55) };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an Orbis object.');
  return value as Record<string, unknown>;
}
function number(value: unknown, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw new Error('Invalid or out-of-range numeric value.');
  return value;
}
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) throw new Error('Invalid project text.');
  return value;
}
function location(value: unknown): Coordinate {
  const p = object(value);
  return coordinate(number(p.lat_deg, -90, 90), number(p.lon_deg, -180, 180));
}
export function decodeProject(input: string | unknown): Project {
  if (typeof input === 'string' && new TextEncoder().encode(input).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
  const root = object(typeof input === 'string' ? JSON.parse(input) : input);
  if (typeof input !== 'string' && new TextEncoder().encode(JSON.stringify(root)).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
  if (root.format !== 'orbis-project' || (root.version !== 2 && root.version !== 1 && root.version !== 0)) throw new Error('Unsupported Orbis project format or version.');
  const p = object(root.planet);
  if (p.algorithm_version !== 'm0-sample-v1' && p.algorithm_version !== 'm2-seeded-v1') throw new Error('Unsupported terrain algorithm. Import has not changed your workspace.');
  const planet = { ...p, id: text(p.id, 100), name: text(p.name, 80), seed: text(p.seed, 100),
    radius_m: number(p.radius_m, 1000, 1_000_000_000), sea_level_m: number(p.sea_level_m, -20_000, 20_000),
    algorithm_version: p.algorithm_version as Planet['algorithm_version'] } as Planet;
  if (!Array.isArray(root.landmarks) || root.landmarks.length > 1000) throw new Error('Invalid landmark collection (maximum 1,000).');
  const ids = new Set<string>();
  const anchors = new Set<string>();
  const landmarks = root.landmarks.map((value) => {
    const item = object(value);
    const pos = object(item.position);
    const point = location(pos);
    const id = text(item.id, 100);
    if (ids.has(id) || anchors.has(anchorKey(point))) throw new Error('Duplicate landmark ID or coordinate.');
    if (item.source !== 'authored' || (item.locked !== undefined && typeof item.locked !== 'boolean')) throw new Error('Invalid landmark ownership or lock.');
    ids.add(id); anchors.add(anchorKey(point));
    return { ...item, ...createLandmark(text(item.name, 80), { ...point, altitude_m: number(pos.altitude_m, -20_000, 20_000) }, id),
      position: { ...pos, ...point, altitude_m: pos.altitude_m as number }, locked: item.locked ?? false } as Landmark;
  });
  const draftsInput = root.drafts ?? [];
  if (!Array.isArray(draftsInput) || draftsInput.length > 1000) throw new Error('Invalid draft collection.');
  const draftKeys = new Set<string>();
  const drafts = draftsInput.map((value) => {
    const item = object(value); const point = location(item);
    if (draftKeys.has(anchorKey(point))) throw new Error('Duplicate draft coordinate.');
    draftKeys.add(anchorKey(point));
    return { ...point, name: text(item.name, 80, true), altitude_m: number(item.altitude_m, -20_000, 20_000) };
  });
  const rawStrokes = root.terrain_strokes;
  if (root.version === 2 && (!Array.isArray(rawStrokes) || rawStrokes.length > MAX_TERRAIN_STROKES)) {
    throw new Error('Invalid authored terrain strokes (maximum 256).');
  }
  if (root.version !== 2 && rawStrokes !== undefined) throw new Error('Terrain edits require version 2.');
  const strokeIds = new Set<string>();
  const terrain_strokes = root.version === 2 ? (rawStrokes as unknown[]).map((value) => {
    const stroke = validateTerrainStroke(value);
    if (strokeIds.has(stroke.id)) throw new Error('Duplicate terrain stroke ID.');
    strokeIds.add(stroke.id);
    return stroke;
  }) : undefined;
  // Version 0 is the explicit pre-lock JSON format; migration retains the original in recovery history.
  const result: Project = { ...root, ...(root.version === 0 ? { migration_source: root } : {}), format: 'orbis-project', version: root.version === 0 ? 1 : root.version as 1 | 2, planet, landmarks, drafts,
    ...(root.version === 2 ? { terrain_strokes } : {}),
    selection: root.selection ? location(root.selection) : coordinate(30, -55) };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_PROJECT_BYTES) throw new Error('Migrated project exceeds the 2 MB limit including its original backup.');
  return result;
}
export function anchorKey(p: Coordinate): string { return `${p.lat_deg}:${p.lon_deg}`; }
export function waterDepth(elevation_m: number, sea_level_m: number): number {
  return Math.max(0, sea_level_m - elevation_m);
}
