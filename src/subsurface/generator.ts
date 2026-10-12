import { emptyScope, validateGraph, type CaveGraph, type CaveNode } from '../core/authoring';
import type { Coordinate } from '../core/world';
import { coordinate, distanceKm } from '../geo/coordinates';
import { randomSeed } from '../generation/plates';
import { sampleElevation, type ElevationRaster } from '../terrain/sample';
import { destination } from './model';

export interface CaveOptions {
  seed: string; chambers: number; min_depth_m: number; max_depth_m: number;
  chamber_radius_m: number; tunnel_radius_m: number; extent_m: number;
}
export const DEFAULT_CAVE_OPTIONS: CaveOptions = { seed: 'orbis-caves-001', chambers: 12,
  min_depth_m: 120, max_depth_m: 800, chamber_radius_m: 80, tunnel_radius_m: 8, extent_m: 1200 };
export function validateCaveOptions(options: CaveOptions): CaveOptions {
  const o = { ...options, seed: options.seed.trim() };
  if (!o.seed || o.seed.length > 64) throw new Error('Enter a cave seed of 1–64 characters.');
  for (const [key, lo, hi] of [['chambers', 3, 64], ['min_depth_m', 20, 12000], ['max_depth_m', 20, 16000],
    ['chamber_radius_m', 10, 250], ['tunnel_radius_m', 1, 30], ['extent_m', 100, 10000]] as const) {
    if (!Number.isFinite(o[key]) || o[key] < lo || o[key] > hi || !Number.isInteger(o[key])) throw new Error(`${key.replaceAll('_', ' ')} must be an integer between ${lo} and ${hi}.`);
  }
  if (o.max_depth_m < o.min_depth_m) throw new Error('Maximum depth must be at least the minimum depth.');
  if (o.min_depth_m < o.chamber_radius_m * .45 + 2) throw new Error('Minimum depth is too shallow for this chamber size. Increase depth or reduce chamber radius.');
  if (o.tunnel_radius_m > o.chamber_radius_m * .65) throw new Error('Tunnel radius must fit inside the smallest chamber.');
  return o;
}

/** Bounded seeded graph proposal, not a geological or voxel simulation. */
export function generateCaves(options: CaveOptions, origin: Coordinate, radius_m: number, raster: ElevationRaster, entrance?: CaveNode): CaveGraph {
  const o = validateCaveOptions(options), anchor = coordinate(origin.lat_deg, origin.lon_deg);
  if (!Number.isFinite(radius_m) || radius_m <= 0) throw new Error('Invalid planet radius.');
  if (entrance && (entrance.kind !== 'entrance' || distanceKm(anchor, entrance.position, radius_m) > .001)) throw new Error('Choose an entrance at the generation anchor.');
  const key = JSON.stringify({ algorithm: 'caves-v1', o, anchor, radius_m, entrance: entrance?.id });
  const rnd = randomSeed(key), prefix = Math.floor(rnd() * 2 ** 32).toString(16);
  const nodes: CaveNode[] = [], edges: CaveGraph['edges'] = [];
  const root: CaveNode = entrance ?? { ...emptyScope(), id: `caves-${prefix}-entrance`, name: 'Generated entrance', kind: 'entrance',
    position: { ...anchor, altitude_m: sampleElevation(raster, anchor) }, radius_m: o.tunnel_radius_m * 2, height_m: 10, locked: false };
  if (!entrance) nodes.push(root);
  for (let i = 0; i < o.chambers; i++) {
    const p = destination(anchor, o.extent_m * Math.sqrt((i + .5) / o.chambers) * (.8 + rnd() * .2), i * 137.508 + rnd() * 45, radius_m);
    const chamberRadius = Math.round(o.chamber_radius_m * (.65 + rnd() * .35));
    const height = Math.max(10, Math.round(chamberRadius * .9));
    const depth = Math.round(o.min_depth_m + rnd() * (o.max_depth_m - o.min_depth_m));
    const ground = sampleElevation(raster, p), altitude = ground - depth;
    if (altitude - height / 2 < -20000 || altitude + height / 2 > ground || altitude > 20000) throw new Error('Requested chambers exceed the local ground or −20,000 m datum limit. Reduce depth or size.');
    const node: CaveNode = { ...emptyScope(), id: `caves-${prefix}-${i}`, name: `Chamber ${i + 1}`, kind: 'chamber',
      position: { ...p, altitude_m: altitude }, radius_m: chamberRadius, height_m: height, locked: false,
      tags: ['generated:caves-v1', `seed:${o.seed}`], description: `Seeded chamber. Depth ${depth} m below local ground. Generation settings: ${JSON.stringify(o)}` };
    const candidates = i ? nodes.filter(n => n.kind === 'chamber') : [root];
    const parent = candidates.reduce((a, b) => {
      const metric = (n: CaveNode) => Math.hypot(distanceKm(n.position, p, radius_m) * 1000, n.position.altitude_m - altitude);
      return metric(a) <= metric(b) ? a : b;
    });
    nodes.push(node);
    edges.push({ id: `caves-${prefix}-passage-${i}`, name: i ? `Tunnel ${i}` : 'Entrance descent', from: parent.id, to: node.id,
      kind: i ? 'tunnel' : 'shaft', radius_m: o.tunnel_radius_m, locked: false });
  }
  // Validate references including an existing root without returning a duplicate authored node.
  validateGraph({ nodes: entrance ? [root, ...nodes] : nodes, edges }, new Set(root.era_id ? [root.era_id] : []));
  return { nodes, edges };
}

/** Review/apply only appends; existing authorship, locks and geometry are untouched. */
export function appendCaveProposal(existing: CaveGraph, proposal: CaveGraph): CaveGraph {
  const ids = new Set([...existing.nodes, ...existing.edges].map(n => n.id));
  if ([...proposal.nodes, ...proposal.edges].some(n => ids.has(n.id))) throw new Error('This network is already applied. Change the seed or parameters for another network.');
  return { nodes: [...existing.nodes, ...proposal.nodes], edges: [...existing.edges, ...proposal.edges] };
}
