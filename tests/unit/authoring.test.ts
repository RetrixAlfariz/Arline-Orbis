import { describe,it,expect } from 'vitest';
import { authoringProject,decodeProject,newProject } from '../../src/core/project';
import { emptyScope,validateFeatures,validateGraph,featureGeometry,localWaterLevel,belowGround,graphRoute } from '../../src/core/authoring';
import type { MapFeature,CaveGraph } from '../../src/core/authoring';
import { makeProjection,invertPoint,projectPoint } from '../../src/geo/projections';
import { lockedStrokeConflicts,regenerationConflicts } from '../../src/authoring/conflicts';
import { generateSample } from '../../src/terrain/sample';
import { caveProposal } from '../../src/subsurface/model';
const region:MapFeature={...emptyScope(),id:'region-1',name:'Canon coast',kind:'polygon',layer:'region',coordinates:[{lat_deg:1,lon_deg:179},{lat_deg:1,lon_deg:-179},{lat_deg:-1,lon_deg:-179},{lat_deg:-1,lon_deg:179}],source:'authored',locked:true};
const graph:CaveGraph={nodes:[{...emptyScope(),id:'a',name:'Entrance',kind:'entrance',position:{lat_deg:0,lon_deg:0,altitude_m:500},height_m:10,radius_m:5,locked:false},{...emptyScope(),id:'b',name:'Chamber',kind:'chamber',position:{lat_deg:0,lon_deg:0,altitude_m:-2000},height_m:60,radius_m:80,locked:true}],edges:[{id:'ab',name:'Shaft',from:'a',to:'b',kind:'shaft',radius_m:5,locked:false}]};

describe('M2/M3 authoring contracts',()=>{
  it('round trips v3 geometry, cave graph, eras and metadata without mutating input',()=>{
    const p=authoringProject(newProject());p.eras=[{id:'age1',name:'First Age',description:'before the flood'}];
    p.features=[{...region,era_id:'age1',description:'Canon shore',tags:['coast'],references:['story:opening']}];p.caves=graph;p.extra={preserve:true};
    const json=JSON.stringify(p),v=decodeProject(json);expect(v).toEqual(p);expect(JSON.stringify(p)).toBe(json);
    expect(decodeProject(JSON.stringify(v))).toEqual(p);
  });
  it.each([0,1,2])('keeps legacy v%i terrain and IDs importable',version=>{
    const p={...newProject(),version,...(version===2?{terrain_strokes:[]}: {})};
    expect(decodeProject(p).planet).toEqual(p.planet);
  });
  it('preserves exact geographic feature anchors across projections and inverse transforms',()=>{
    const center={lat_deg:30,lon_deg:60},point={lat_deg:35,lon_deg:70};
    for(const kind of ['equirectangular','equal-earth','orthographic','regional'] as const){
      const projection=makeProjection(kind,center);const xy=projectPoint(projection,kind,center,point)!;expect(xy).not.toBeNull();
      const back=invertPoint(projection,kind,center,...xy)!;expect(back.lat_deg).toBeCloseTo(point.lat_deg,7);expect(back.lon_deg).toBeCloseTo(point.lon_deg,7);
    }
    const globe=makeProjection('orthographic',center);expect(projectPoint(globe,'orthographic',center,{lat_deg:-30,lon_deg:-120})).toBeNull();
  });
  it('handles an authored lake and locked area spanning the antimeridian',()=>{
    const lake={...region,layer:'lake' as const,water_level_m:250};
    expect(featureGeometry(lake).type).toBe('Polygon');
    expect(localWaterLevel([lake],{lat_deg:0,lon_deg:180},100,0,null)).toBe(250);
    expect(localWaterLevel([lake],{lat_deg:0,lon_deg:0},100,0,null)).toBe(0);
    const p=authoringProject(newProject());p.features=[region];
    expect(lockedStrokeConflicts(p,{id:'brush',lat_deg:0,lon_deg:179.9,radius_km:5,delta_m:-400})).toContain(region.name);
  });
  it('rejects underspecified, degenerate, duplicate and dangling data',()=>{
    expect(()=>validateFeatures([{...region,coordinates:[region.coordinates[0]]}],new Set())).toThrow();
    expect(()=>validateFeatures([{...region,kind:'line',layer:'lake',water_level_m:100}],new Set())).toThrow();
    expect(()=>validateFeatures([{...region,era_id:'unknown'}],new Set())).toThrow(/era/);
    expect(()=>validateFeatures([region,region],new Set())).toThrow(/Duplicate/);
    expect(()=>validateGraph({...graph,edges:[{...graph.edges[0],to:'missing'}]},new Set())).toThrow(/Dangling/);
    expect(()=>validateGraph({...graph,edges:[{...graph.edges[0],to:'a'}]},new Set())).toThrow();
    expect(()=>validateGraph({...graph,nodes:graph.nodes.map(n=>({...n,position:{...n.position,altitude_m:Infinity}}))},new Set())).toThrow();
  });
  it('distinguishes cave depth, altitude, and physical route from a portal',()=>{
    expect(belowGround(500,-2000)).toBe(2500);
    expect(graphRoute(graph,'a','b',6371000)?.distance_m).toBe(2500);
    expect(graphRoute(graph,'a','missing',6371000)).toBeNull();
    const portal={...graph,edges:[{...graph.edges[0],kind:'portal' as const}]};
    expect(graphRoute(portal,'a','b',6371000)).toEqual({ids:['a','b'],distance_m:0,portals:1});
  });
  it('cave proposals are reproducible, geographically anchored, and validated before acceptance',()=>{
    const raster=generateSample('aurelia-001',90,46),anchor={lat_deg:30,lon_deg:-55};
    const a=caveProposal('A',anchor,6371000,raster);expect(caveProposal('A',anchor,6371000,raster)).toEqual(a);
    expect(validateGraph(a,new Set()).nodes).toHaveLength(7);
    expect(graphRoute(a,a.nodes[0].id,a.nodes[6].id,6371000)).not.toBeNull();
    expect(a.nodes[0].position.lat_deg).toBe(anchor.lat_deg);
  });
  it('regeneration previews changes without editing author-owned records',()=>{
    const p=authoringProject(newProject());p.caves=graph;
    const a={width:16,height:9,samples:new Int16Array(144).fill(500)},b={...a,samples:new Int16Array(144).fill(900)};
    const before=JSON.stringify(p),changes=regenerationConflicts(p,a,b);
    expect(changes).toHaveLength(2);expect(changes.find(c=>c.locked)?.after_m).toBe(900);expect(JSON.stringify(p)).toBe(before);
  });
});

it('protects a narrow brush against a long great-circle segment and locked passage',()=>{
  const p=authoringProject(newProject());
  p.features=[{...region,kind:'line',name:'Long protected boundary',coordinates:[{lat_deg:0,lon_deg:-80},{lat_deg:0,lon_deg:80}]}];
  const narrow={id:'narrow',lat_deg:0.001,lon_deg:0.012345,radius_km:1,delta_m:-300};
  expect(lockedStrokeConflicts(p,narrow)).toContain('Long protected boundary');
  expect(lockedStrokeConflicts(p,{...narrow,lat_deg:2})).not.toContain('Long protected boundary');
  p.features=[];p.caves={nodes:graph.nodes.map((n,i)=>({...n,locked:false,position:{...n.position,lat_deg:0,lon_deg:i?80:-80}})),edges:[{...graph.edges[0],kind:'tunnel',locked:true}]};
  expect(lockedStrokeConflicts(p,narrow)).toContain('Shaft');
});
