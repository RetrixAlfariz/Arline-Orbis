import { describe, expect, it } from 'vitest';
import { DEFAULT_CAVE_OPTIONS, generateCaves, appendCaveProposal } from '../../src/subsurface/generator';
import { graphRoute, emptyScope, validateGraph, type CaveNode } from '../../src/core/authoring';
import { authoringProject, newProject, decodeProject } from '../../src/core/project';
import { distanceKm } from '../../src/geo/coordinates';
import { generateSample, sampleElevation } from '../../src/terrain/sample';
const raster = generateSample('aurelia-001', 360, 181), anchor = { lat_deg: 30, lon_deg: -55 }, radius = 6371000;
describe('seeded underground generation', () => {
  it('reproduces every node and edge, and changing seed changes geometry', () => {
    const a = generateCaves(DEFAULT_CAVE_OPTIONS, anchor, radius, raster);
    expect(generateCaves(DEFAULT_CAVE_OPTIONS, anchor, radius, raster)).toEqual(a);
    expect(generateCaves({ ...DEFAULT_CAVE_OPTIONS, seed: 'different' }, anchor, radius, raster)).not.toEqual(a);
    expect(validateGraph(a, new Set()).nodes).toHaveLength(13);
    for (const node of a.nodes) expect(graphRoute(a, a.nodes[0].id, node.id, radius)).not.toBeNull();
  });
  it('bounds each chamber by its local ground, requested depth, radius and geographic extent', () => {
    for (const point of [anchor, { lat_deg: 89.99, lon_deg: 179.99 }, { lat_deg: -20, lon_deg: -180 }]) {
      const graph = generateCaves({ ...DEFAULT_CAVE_OPTIONS, chambers: 64 }, point, radius, raster);
      for (const n of graph.nodes.filter(n => n.kind === 'chamber')) {
        const ground = sampleElevation(raster, n.position), depth = ground - n.position.altitude_m;
        expect(depth).toBeGreaterThanOrEqual(120); expect(depth).toBeLessThanOrEqual(800);
        expect(n.position.altitude_m + n.height_m / 2).toBeLessThanOrEqual(ground);
        expect(n.position.altitude_m - n.height_m / 2).toBeGreaterThanOrEqual(-20000);
        expect(n.radius_m).toBeLessThanOrEqual(80);
        expect(distanceKm(point, n.position, radius) * 1000).toBeLessThanOrEqual(1200.001);
      }
    }
  });
  it('appends to a locked entrance without modifying it, and persists through project serialization', () => {
    const entrance: CaveNode = { ...emptyScope(), id: 'authored', name: 'Protected gate', kind: 'entrance', position: { ...anchor, altitude_m: 5302 }, radius_m: 20, height_m: 10, locked: true };
    const existing = { nodes: [entrance], edges: [] }, before = JSON.stringify(existing);
    const proposal = generateCaves(DEFAULT_CAVE_OPTIONS, anchor, radius, raster, entrance);
    expect(proposal.nodes).toHaveLength(12); expect(proposal.edges[0].from).toBe('authored');
    const merged = appendCaveProposal(existing, proposal);
    for (const n of merged.nodes) expect(graphRoute(merged, 'authored', n.id, radius)).not.toBeNull();
    expect(JSON.stringify(existing)).toBe(before); expect(merged.nodes[0]).toEqual(entrance);
    const p = authoringProject(newProject()); p.caves = merged;
    expect(decodeProject(JSON.parse(JSON.stringify(p))).caves).toEqual(merged);
    expect(() => appendCaveProposal(merged, proposal)).toThrow(/already applied/);
  });
  it('rejects impossible and invalid depth/size settings instead of clamping elevations', () => {
    expect(() => generateCaves({ ...DEFAULT_CAVE_OPTIONS, min_depth_m: 20, chamber_radius_m: 200 }, anchor, radius, raster)).toThrow(/shallow/);
    expect(() => generateCaves({ ...DEFAULT_CAVE_OPTIONS, max_depth_m: 30 }, anchor, radius, raster)).toThrow(/Maximum depth/);
    expect(() => generateCaves({ ...DEFAULT_CAVE_OPTIONS, chambers: 1000 }, anchor, radius, raster)).toThrow();
    const deep = { width: 16, height: 9, samples: new Int16Array(144).fill(-19950) };
    expect(() => generateCaves(DEFAULT_CAVE_OPTIONS, anchor, radius, deep)).toThrow(/datum limit/);
  });
});
