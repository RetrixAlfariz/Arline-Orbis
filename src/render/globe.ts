import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Coordinate, Landmark } from '../core/world';
import { coordinate, fromVector, toVector } from '../geo/coordinates';
import { sampleElevation } from '../terrain/sample';
import { geoInterpolate } from 'd3-geo';
import type { MapFeature } from '../core/authoring';
import type { ElevationRaster } from '../terrain/sample';

export function createGlobe(host: HTMLElement, textureCanvas: HTMLCanvasElement,
  initialRaster: ElevationRaster, initialRadius_m: number,
  onselect: (point: Coordinate) => void, onhover: (point: Coordinate | null) => void,
  onerror: (message: string) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-label', '3D globe. Drag to rotate, scroll or plus and minus to zoom, click or arrow keys to select.');
  renderer.domElement.setAttribute('role', 'application');
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(3, 1, 2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.45;
  controls.maxDistance = 6;
  controls.enableDamping = false;
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  const geometry = new THREE.SphereGeometry(1, 144, 96);
  const originalPositions = new Float32Array(geometry.attributes.position.array);
  let activeRaster = initialRaster;
  let activeRadius_m = initialRadius_m;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  scene.add(new THREE.AmbientLight('#ffffff', 1.7));
  const sun = new THREE.DirectionalLight('#fff5df', 2.2);
  sun.position.set(-3, 5, 6);
  scene.add(sun);
  // Purposefully exaggerated but bounded relief to keep planetary curvature stable.
  // 3D styling never mutates elevation data or the datum reported by the inspector.
  function visualRadius(point: Coordinate): number {
    const lift = sampleElevation(activeRaster, point) / activeRadius_m * 18;
    return 1 + Math.max(-0.03, Math.min(0.03, lift));
  }
  function rebuildTerrain(nextRaster: ElevationRaster, radius_m: number) {
    activeRaster = nextRaster; activeRadius_m = radius_m;
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const x = originalPositions[i * 3], y = originalPositions[i * 3 + 1], z = originalPositions[i * 3 + 2];
      const loc = fromVector(x, y, z);
      const radius = visualRadius(loc);
      positions.setXYZ(i, x * radius, y * radius, z * radius);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  rebuildTerrain(initialRaster, initialRadius_m);
  // Geographic graticule is display-only, slightly above the shared terrain texture.
  const gridPoints: number[] = [];
  for (const latitude of [-60, -30, 0, 30, 60]) {
    for (let longitude = -180; longitude < 180; longitude += 3) {
      gridPoints.push(...toVector({ lat_deg: latitude, lon_deg: longitude }, 1.031),
        ...toVector({ lat_deg: latitude, lon_deg: longitude + 3 }, 1.031));
    }
  }
  for (let longitude = -180; longitude < 180; longitude += 30) {
    for (let latitude = -90; latitude < 90; latitude += 3) {
      gridPoints.push(...toVector({ lat_deg: latitude, lon_deg: longitude }, 1.031),
        ...toVector({ lat_deg: latitude + 3, lon_deg: longitude }, 1.031));
    }
  }
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  const gridMaterial = new THREE.LineBasicMaterial({ color: '#a6c3b8', transparent: true, opacity: 0.19 });
  scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));
  const vectors = new THREE.Group(); scene.add(vectors);
  const vectorMaterial = new THREE.LineBasicMaterial({ color: 0xb34b3b });
  const markers = new THREE.Group();
  scene.add(markers);
  const markerGeometry = new THREE.SphereGeometry(0.012, 12, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: '#f2ba75' });
  const selectedMarker = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffe1b6' }));
  selectedMarker.visible = false;
  scene.add(selectedMarker);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let frame = 0;
  let disposed = false;
  let currentSelection: Coordinate | null = null;

  function draw() {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) renderer.render(scene, camera);
    });
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }
  controls.addEventListener('change', draw);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  controls.update();

  function pick(event: PointerEvent): Coordinate | null {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([sphere, ...markers.children]);
    const hit = hits[0];
    if (!hit) return null;
    if (hit.object.userData.position) return hit.object.userData.position as Coordinate;
    return fromVector(hit.point.x, hit.point.y, hit.point.z);
  }
  let down: { x: number; y: number; id: number } | null = null;
  const pointerdown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY, id: event.pointerId }; };
  const pointerup = (event: PointerEvent) => {
    if (down?.id === event.pointerId && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5) {
      const point = pick(event);
      if (point) onselect(point);
    }
    down = null;
  };
  const pointermove = (event: PointerEvent) => onhover(pick(event));
  const pointerleave = () => onhover(null);
  const pointercancel = () => { down = null; };
  const contextlost = (event: Event) => {
    event.preventDefault();
    onerror('The graphics context was lost. The 2D atlas is still available.');
  };
  const canvas = renderer.domElement;
  const keydown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1;
    const offsets: Record<string, [number, number]> = { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] };
    if (offsets[event.key]) {
      event.preventDefault(); const [lat, lon] = offsets[event.key]; const point = currentSelection ?? coordinate(0, 0);
      onselect(coordinate(Math.max(-90, Math.min(90, point.lat_deg + lat)), point.lon_deg + lon));
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault(); const distance = Math.max(controls.minDistance, Math.min(controls.maxDistance, camera.position.length() * (event.key === '-' ? 1.2 : 1 / 1.2)));
      camera.position.setLength(distance); controls.update(); draw();
    }
  };
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('pointerdown', pointerdown);
  canvas.addEventListener('pointerup', pointerup);
  canvas.addEventListener('pointermove', pointermove);
  canvas.addEventListener('pointerleave', pointerleave);
  canvas.addEventListener('pointercancel', pointercancel);
  canvas.addEventListener('webglcontextlost', contextlost);

  function updateMarkerPosition() {
    if (currentSelection) selectedMarker.position.set(...toVector(currentSelection, visualRadius(currentSelection) + 0.012));
  }
  return {
    setFeatures(features: MapFeature[]) {
      for (const object of [...vectors.children]) { (object as THREE.Line).geometry.dispose(); vectors.remove(object); }
      for (const feature of features) {
        const points: THREE.Vector3[] = [];
        const vertices = ['polygon','region'].includes(feature.kind) ? [...feature.coordinates,feature.coordinates[0]] : feature.coordinates;
        if (vertices.length === 1) { const p=vertices[0]; const q={lat_deg:Math.min(90,p.lat_deg+.2),lon_deg:p.lon_deg}; points.push(new THREE.Vector3(...toVector(p,visualRadius(p)+.005)),new THREE.Vector3(...toVector(q,visualRadius(q)+.005))); }
        for (let i=1;i<vertices.length;i++) {const a=vertices[i-1],b=vertices[i],along=geoInterpolate([a.lon_deg,a.lat_deg],[b.lon_deg,b.lat_deg]);
          for(let k=0;k<=16;k++){const [lon_deg,lat_deg]=along(k/16),p={lat_deg,lon_deg};points.push(new THREE.Vector3(...toVector(p,visualRadius(p)+.005)));}}
        if (points.length) vectors.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),vectorMaterial));
      } draw();
    },
    setTexture(canvas: HTMLCanvasElement) { texture.image = canvas; texture.needsUpdate = true; draw(); },
    setTerrain(raster: ElevationRaster, radius_m: number) {
      rebuildTerrain(raster, radius_m);
      for (const marker of markers.children) { const p=marker.userData.position as Coordinate; marker.position.set(...toVector(p,visualRadius(p)+.008)); }
      if (currentSelection) updateMarkerPosition();
      draw();
    },
    update(selection: Coordinate | null, landmarks: Landmark[]) {
      currentSelection = selection;
      markers.clear();
      for (const landmark of landmarks) {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(...toVector(landmark.position, visualRadius(landmark.position) + 0.008));
        marker.userData.position = landmark.position;
        markers.add(marker);
      }
      selectedMarker.visible = selection !== null;
      if (selection) {
        updateMarkerPosition();
        camera.position.set(...toVector(selection, camera.position.length()));
        controls.update();
      }
      draw();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('pointerdown', pointerdown);
      canvas.removeEventListener('pointerup', pointerup);
      canvas.removeEventListener('pointermove', pointermove);
      canvas.removeEventListener('pointerleave', pointerleave);
      canvas.removeEventListener('pointercancel', pointercancel);
      canvas.removeEventListener('webglcontextlost', contextlost);
      for (const object of vectors.children) (object as THREE.Line).geometry.dispose(); vectorMaterial.dispose();
      geometry.dispose(); material.dispose(); texture.dispose();
      gridGeometry.dispose(); gridMaterial.dispose();
      markerGeometry.dispose(); markerMaterial.dispose();
      selectedMarker.geometry.dispose(); selectedMarker.material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
