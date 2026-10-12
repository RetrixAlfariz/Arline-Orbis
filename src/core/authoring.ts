import { geoArea, geoContains } from 'd3-geo';
import type { Coordinate, Position } from './world';
import { coordinate, distanceKm } from '../geo/coordinates';

export interface Era { id: string; name: string; description: string }
export interface StoryScope { description: string; tags: string[]; references: string[]; era_id: string | null }
export interface MapFeature extends StoryScope {
  id: string; name: string; kind: 'point' | 'line' | 'polygon' | 'region';
  layer: 'landmark' | 'road' | 'river' | 'border' | 'lake' | 'region';
  coordinates: Coordinate[]; locked: boolean; source: 'authored'; water_level_m?: number;
}
export interface CaveNode extends StoryScope {
  id: string; name: string; kind: 'entrance' | 'chamber' | 'settlement';
  position: Position; radius_m: number; height_m: number; locked: boolean;
  water_level_m?: number;
}
export interface CaveEdge {
  id: string; name: string; from: string; to: string;
  kind: 'tunnel' | 'shaft' | 'portal'; radius_m: number; locked: boolean;
}
export interface CaveGraph { nodes: CaveNode[]; edges: CaveEdge[] }
export const emptyScope = (): StoryScope => ({ description: '', tags: [], references: [], era_id: null });
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
export function finite(value: unknown, lo: number, hi: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) throw new Error('Number outside allowed range.');
  return value;
}
export function text(value: unknown, max = 120, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error('Invalid text field.');
  return value;
}
export function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean.'); return value;
}
export function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error('Unknown kind.'); return value as T;
}
export function array(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid collection or collection limit exceeded.'); return value;
}
export function point(value: unknown): Coordinate {
  const p = record(value); return coordinate(finite(p.lat_deg, -90, 90), finite(p.lon_deg, -180, 180));
}
export function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map(x => x.id)).size !== values.length) throw new Error('Duplicate ID.'); return values;
}
function scope(p: Record<string, unknown>, eras: Set<string>): StoryScope {
  const era_id = p.era_id === null || p.era_id === undefined ? null : text(p.era_id);
  if (era_id !== null && !eras.has(era_id)) throw new Error('Unknown era reference.');
  return { era_id, description: text(p.description ?? '', 10000, true),
    tags: array(p.tags ?? [], 32).map(x => text(x, 80)), references: array(p.references ?? [], 32).map(x => text(x, 300)) };
}
export function validateEras(value: unknown): Era[] {
  return unique(array(value, 100).map(v => { const p = record(v); return { id: text(p.id), name: text(p.name), description: text(p.description ?? '', 10000, true) }; }));
}
export function validateFeatures(value: unknown, eras: Set<string>): MapFeature[] {
  return unique(array(value, 1000).map(v => {
    const p = record(v); const kind = enumValue(p.kind, ['point', 'line', 'polygon', 'region']);
    const coordinates = array(p.coordinates, 2048).map(point);
    const minimum = kind === 'point' ? 1 : kind === 'line' ? 2 : 3;
    if (coordinates.length < minimum || (kind === 'point' && coordinates.length !== 1)) throw new Error('Invalid geometry vertex count.');
    if (new Set(coordinates.map(c => c.lat_deg + ':' + c.lon_deg)).size < minimum) throw new Error('Degenerate geometry.');
    const layer = enumValue(p.layer, ['landmark', 'road', 'river', 'border', 'lake', 'region']);
    if (layer === 'lake' && !['polygon', 'region'].includes(kind)) throw new Error('Lake geometry must be an area.');
    if (p.source !== 'authored') throw new Error('Feature must have explicit authored provenance.');
    return { ...p, id: text(p.id), name: text(p.name), kind, layer, coordinates, locked: bool(p.locked), source: 'authored',
      ...scope(p, eras), ...(layer === 'lake' ? { water_level_m: finite(p.water_level_m, -20000, 20000) } : {}) } as MapFeature;
  }));
}
export function validateGraph(value: unknown, eras: Set<string>): CaveGraph {
  const raw = record(value);
  const nodes = unique(array(raw.nodes, 1000).map(v => {
    const p = record(v), pos = record(p.position);
    const result: CaveNode = { ...scope(p, eras), id: text(p.id), name: text(p.name),
      kind: enumValue(p.kind, ['entrance', 'chamber', 'settlement']), position: { ...point(pos), altitude_m: finite(pos.altitude_m, -20000, 20000) },
      radius_m: finite(p.radius_m, 1, 10000), height_m: finite(p.height_m, 1, 10000), locked: bool(p.locked) };
    if (p.water_level_m !== undefined) result.water_level_m = finite(p.water_level_m, -20000, 20000);
    return { ...p, ...result, position: { ...pos, ...result.position } } as CaveNode;
  }));
  const ids = new Set(nodes.map(x => x.id));
  const edges = unique(array(raw.edges, 2000).map(v => {
    const p = record(v); const from = text(p.from), to = text(p.to);
    if (from === to || !ids.has(from) || !ids.has(to)) throw new Error('Dangling or self-referencing passage.');
    return { id: text(p.id), name: text(p.name), from, to, kind: enumValue(p.kind, ['tunnel', 'shaft', 'portal']),
      radius_m: finite(p.radius_m, 1, 1000), locked: bool(p.locked) };
  }));
  if (new Set(edges.map(e => [e.from, e.to].sort().join(':'))).size !== edges.length) throw new Error('Duplicate passage.');
  return { nodes, edges };
}
/** Render small author-drawn areas with D3's clockwise spherical winding. */
export function featureGeometry(feature: Pick<MapFeature, 'coordinates' | 'kind'>) {
  const pts = feature.coordinates.map(p => [p.lon_deg, p.lat_deg]);
  if (feature.kind === 'point') return { type: 'Point' as const, coordinates: pts[0] };
  if (feature.kind === 'line') return { type: 'LineString' as const, coordinates: pts };
  const ring = [...pts, pts[0]];
  const polygon = { type: 'Polygon' as const, coordinates: [ring] };
  if (geoArea(polygon) > 2 * Math.PI) ring.reverse();
  return polygon;
}
export function visibleInEra(value: { era_id: string | null }, era: string | null): boolean {
  return value.era_id === null || era === null || value.era_id === era;
}
export function localWaterLevel(features: MapFeature[], at: Coordinate, terrain: number, sea: number, era: string | null): number {
  const levels = features.filter(f => f.layer === 'lake' && visibleInEra(f, era) && geoContains(featureGeometry(f), [at.lon_deg, at.lat_deg]))
    .map(f => f.water_level_m!).filter(l => l > terrain);
  return levels.length ? Math.max(...levels) : sea;
}
export function graphRoute(graph: CaveGraph, from: string, to: string, radius_m: number): { ids: string[]; distance_m: number; portals: number } | null {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  if (!nodes.has(from) || !nodes.has(to)) return null;
  const costs = new Map([[from, 0]]), previous = new Map<string, { id: string; portal: boolean }>(), settled = new Set<string>();
  while (settled.size < nodes.size) {
    const current = [...costs].filter(([id]) => !settled.has(id)).sort((a,b) => a[1]-b[1])[0];
    if (!current) break; const [id, cost] = current;
    if (id === to) {
      const ids = [to]; let portals = 0, end = to;
      while (previous.has(end)) { const p = previous.get(end)!; ids.unshift(p.id); portals += Number(p.portal); end = p.id; }
      return { ids, distance_m: cost, portals };
    }
    settled.add(id);
    for (const edge of graph.edges.filter(e => e.from === id || e.to === id)) {
      const other = edge.from === id ? edge.to : edge.from;
      const a = nodes.get(id)!.position, b = nodes.get(other)!.position;
      const length = edge.kind === 'portal' ? 0 : Math.hypot(distanceKm(a,b,radius_m)*1000, a.altitude_m-b.altitude_m);
      if (cost+length < (costs.get(other) ?? Infinity)) { costs.set(other, cost+length); previous.set(other,{id, portal:edge.kind==='portal'}); }
    }
  }
  return null;
}
export const belowGround = (surface_m: number, altitude_m: number) => surface_m - altitude_m;
