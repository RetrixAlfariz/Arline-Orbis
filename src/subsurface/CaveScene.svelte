<script lang="ts">
  import { onMount } from 'svelte';
  import type { CaveGraph } from '../core/authoring';
  import { localPoint } from './model';
  let {graph,radius_m}:{graph:CaveGraph;radius_m:number}=$props();
  let host:HTMLDivElement;let error=$state('');
  onMount(()=>{
    let disposed=false,cleanup=()=>{};
    (async()=>{
      const THREE=await import('three');const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
      if(disposed)return;
      let renderer:InstanceType<typeof THREE.WebGLRenderer>;
      try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{error='3D is unavailable; plan and section remain usable.';return;}
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Local cave geometry preview');
      const scene=new THREE.Scene();scene.background=new THREE.Color('#243333');
      const origin=graph.nodes[0]?.position??{lat_deg:0,lon_deg:0};
      const group=new THREE.Group();scene.add(group);const positions=new Map<string,InstanceType<typeof THREE.Vector3>>();
      const geometries:InstanceType<typeof THREE.BufferGeometry>[]=[],materials:InstanceType<typeof THREE.Material>[]=[];
      for(const n of graph.nodes.slice(0,256)){
        const point=new THREE.Vector3(...localPoint(origin,n.position,n.position.altitude_m,radius_m));positions.set(n.id,point);
        const geometry=new THREE.SphereGeometry(1,16,10);geometries.push(geometry);
        const material=new THREE.MeshStandardMaterial({color:n.kind==='entrance'?'#d8b273':'#89b2a7',roughness:1,transparent:true,opacity:.75});materials.push(material);
        const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(n.radius_m,n.height_m/2,n.radius_m);mesh.position.copy(point);group.add(mesh);
      }
      for(const e of graph.edges){const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b||e.kind==='portal')continue;
        const length=a.distanceTo(b);if(length<.001)continue;
        const geometry=new THREE.CylinderGeometry(e.radius_m,e.radius_m,length,8);geometries.push(geometry);
        const material=new THREE.MeshStandardMaterial({color:'#9c9080',roughness:1});materials.push(material);
        const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(mesh);
      }
      const box=new THREE.Box3().setFromObject(group),center=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());group.position.sub(center);
      const extent=box.isEmpty()?500:Math.max(100,box.getSize(new THREE.Vector3()).length());
      const camera=new THREE.PerspectiveCamera(40,1,.1,extent*30);camera.position.set(extent,.4*extent,extent);
      const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.minDistance=10;controls.maxDistance=extent*10;
      scene.add(new THREE.AmbientLight('#fff6e0',2));const sun=new THREE.DirectionalLight('#ffffff',2);sun.position.set(extent,extent,extent);scene.add(sun);
      let frame=0;const draw=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});};
      const resize=()=>{const r=host.getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();draw();}};
      const obs=new ResizeObserver(resize);obs.observe(host);controls.addEventListener('change',draw);resize();controls.update();
      cleanup=()=>{cancelAnimationFrame(frame);obs.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
      if(disposed)cleanup();
    })().catch(e=>{if(!disposed)error=(e as Error).message;});
    return()=>{disposed=true;cleanup();};
  });
</script>
<div class="cave-scene" bind:this={host}>{#if error}<p role="status">{error}</p>{/if}</div>
<p class="help-text">Local chamber envelopes and passage geometry only. Portals are non-spatial links. At most 256 chambers are rendered; no planet-wide voxels.</p>
