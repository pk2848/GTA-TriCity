import * as THREE from 'three';
import { OSMStreamer, CITY_ORIGIN } from './world/OSMStreamer.js';
import { WorldMapView } from './world/WorldMapView.js';
import { TrafficSystem } from './world/TrafficSystem.js';
import { VehiclePhysics } from './vehicles/VehiclePhysics.js';
import { createCP67Mall } from './world/CP67Mall.js';
import { createCP67Interior } from './world/CP67Interior.js';
import { VehicleGarage } from './vehicles/VehicleGarage.js';
import 'leaflet/dist/leaflet.css';
import './style.css';

const root = document.querySelector('#game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa6b5);
// Keep distant city detail clear; the old dense grey-green fog washed out the scene.
scene.fog = new THREE.FogExp2(0x8fa6b5, 0.00016);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 3500);
// Integrated-GPU friendly defaults: lower internal resolution, no MSAA and no
// real-time shadow-map pass. Quality can be raised from the in-game graphics menu.
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true
});
renderer.domElement.id = 'world';
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 0.85));
renderer.shadowMap.enabled = false;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdce9ed, 0x566052, 1.9));
const sun = new THREE.DirectionalLight(0xffe6c3, 2.35);
sun.position.set(-500, 900, 340);
sun.castShadow = false;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.left = -240; sun.shadow.camera.right = 240;
sun.shadow.camera.top = 240; sun.shadow.camera.bottom = -240;
sun.shadow.camera.far = 600;
scene.add(sun);

const world = new THREE.Group();
world.name = 'city-world';
scene.add(world);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x66745f, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.16;
ground.receiveShadow = true;
world.add(ground);

const vehicle = new THREE.Group();
vehicle.name = 'player-vehicle';
scene.add(vehicle);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b5360, metalness: 0.48, roughness: 0.3 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x194958, metalness: 0.38, roughness: 0.34 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x172c35, metalness: 0.32, roughness: 0.2 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x20282b, roughness: 0.65 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0x9ba8aa, metalness: 0.78, roughness: 0.24 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.82 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x9ca6a4, metalness: 0.7, roughness: 0.28 });
function addBox(parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
// Compact Chandigarh street SUV body with separate bonnet, cabin, glass and trim.
addBox(vehicle, 2.05, 0.66, 4.25, bodyMat, 0, 0.98, 0);
addBox(vehicle, 1.94, 0.28, 1.15, roofMat, 0, 1.34, -1.42);
addBox(vehicle, 1.92, 0.3, 0.92, roofMat, 0, 1.3, 1.52);
addBox(vehicle, 1.72, 0.78, 2.05, glassMat, 0, 1.63, -0.12);
addBox(vehicle, 1.78, 0.14, 1.52, roofMat, 0, 2.02, -0.12);
addBox(vehicle, 1.76, 0.1, 0.08, trimMat, 0, 1.66, -1.18);
addBox(vehicle, 1.76, 0.1, 0.08, trimMat, 0, 1.62, 0.92);
for (const side of [-1, 1]) {
  addBox(vehicle, 0.075, 0.58, 1.42, trimMat, side * 0.89, 1.61, -0.08);
  addBox(vehicle, 0.08, 0.14, 0.62, chromeMat, side * 1.03, 0.92, 0.05);
  addBox(vehicle, 0.16, 0.12, 0.28, trimMat, side * 1.1, 1.47, -0.62);
}
addBox(vehicle, 1.12, 0.22, 0.075, trimMat, 0, 0.9, -2.18);
addBox(vehicle, 1.45, 0.14, 0.1, chromeMat, 0, 0.63, -2.17);
addBox(vehicle, 1.7, 0.16, 0.11, trimMat, 0, 0.63, 2.16);
addBox(vehicle, 1.55, 0.1, 0.07, chromeMat, 0, 1.0, 2.14);
for (const side of [-0.78, 0.78]) {
  addBox(vehicle, 0.42, 0.19, 0.075, new THREE.MeshBasicMaterial({ color: 0xfff0c4 }), side, 1.08, -2.18);
  addBox(vehicle, 0.36, 0.2, 0.075, new THREE.MeshBasicMaterial({ color: 0xd9342c }), side, 1.0, 2.18);
}
const wheels = [];
const frontWheels = [];
for (const x of [-1.08, 1.08]) for (const z of [-1.36, 1.36]) {
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.48, z);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.28, 18), tireMat);
  tire.rotation.z = Math.PI / 2; tire.castShadow = true; wheel.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14), rimMat);
  rim.rotation.z = Math.PI / 2; wheel.add(rim);
  scene.add(wheel); wheels.push(wheel);
  if (z < 0) frontWheels.push(wheel);
}
for (const x of [-0.68, 0.68]) addBox(vehicle, 0.38, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0xffe9ba }), x, 1.04, -2.16);

const vehiclePhysics = new VehiclePhysics();
const cp67Mall = createCP67Mall(scene);
const cp67Interior = createCP67Interior(scene);
cp67Interior.group.position.y = 0.9;
vehiclePhysics.addBuildingObstacles(cp67Mall.obstacles, 'cp67-mall');
vehiclePhysics.syncVisuals(vehicle, wheels);

function createPlayerPedestrian() {
  const character = new THREE.Group();
  character.name = 'player-walking-character';
  const shirt = new THREE.MeshStandardMaterial({ color: 0x263f4b, roughness: 0.86 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x252b31, roughness: 0.94 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98c70, roughness: 0.96 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x211b18, roughness: 1 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x171a1c, roughness: 0.96 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.65, 4, 9), shirt);
  torso.position.y = 1.22; torso.castShadow = true; character.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skin);
  head.position.y = 1.92; head.castShadow = true; character.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  hairCap.position.y = 2.0; character.add(hairCap);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8), skin);
  neck.position.y = 1.68; character.add(neck);
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 1.48, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.46, 3, 7), shirt);
    arm.position.y = -0.31; arm.castShadow = true; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 7), skin);
    hand.position.y = -0.62; pivot.add(hand);
    character.add(pivot); arms.push(pivot);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.14, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.48, 3, 7), trousers);
    leg.position.y = -0.34; leg.castShadow = true; pivot.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.13, 0.42), shoe);
    foot.position.set(0, -0.68, -0.08); foot.castShadow = true; pivot.add(foot);
    character.add(pivot); legs.push(pivot);
  }
  const jacketLine = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.055, 0.32), new THREE.MeshStandardMaterial({ color: 0x8a9b9d, roughness: 0.8 }));
  jacketLine.position.set(0, 1.38, -0.255); character.add(jacketLine);
  character.userData.limbs = { arms, legs };
  return character;
}
const playerPedestrian = createPlayerPedestrian();
playerPedestrian.visible = false;
scene.add(playerPedestrian);
let gameMode = 'vehicle'; // vehicle | walking
let pedestrianHeading = 0;
let pedestrianFloor = 0;
let pedestrianInsideMall = false;
let pedestrianWalkPhase = 0;
const WALK_SPEED = 4.2;
const RUN_SPEED = 6.2;

// Twin exhaust flames illuminate only while N-key nitro is engaged.
const nitroFlames = new THREE.Group();
nitroFlames.name = 'nitro-exhaust-flames';
nitroFlames.visible = false;
for (const x of [-0.53, 0.53]) {
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 1.05, 9),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88, depthWrite: false })
  );
  flame.rotation.x = Math.PI / 2;
  flame.position.set(x, 0.58, 2.35);
  nitroFlames.add(flame);
}
const nitroGlow = new THREE.PointLight(0x39bfff, 0, 14);
nitroGlow.position.set(0, 0.7, 2.25);
nitroFlames.add(nitroGlow);
vehicle.add(nitroFlames);

// Multi-brand garage. GLB files live in public/models/vehicles/ and are loaded on demand.
const vehicleGarage = new VehicleGarage({
  vehicle,
  physics: vehiclePhysics,
  selector: document.querySelector('#car-select'),
  statusElement: document.querySelector('#car-select-status'),
  retryButton: document.querySelector('#car-retry'),
  countElement: document.querySelector('#garage-count'),
  rider: playerPedestrian,
  isDriving: () => gameMode === 'vehicle',
  fallbackParts: vehicle.children.filter((child) => child !== nitroFlames),
  wheelVisuals: wheels,
  nitroFlames,
  // Only uploaded GLB assets become visible player cars; no procedural vehicle fallback.
  // Allow a garage selection at any speed; the selected GLB replaces the
  // visual vehicle in-place while the current physics motion is preserved.
  canSelect: () => true,
  onSelected: (profile) => {
    console.info(`[GTA-TriCity] Selected ${profile.displayName}`);
  }
});

// Checkpoint is positioned in the first mapped neighbourhood, north-east of the start.
const checkpoint = new THREE.Group();
checkpoint.position.set(430, 0, -520);
scene.add(checkpoint);
const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.42, 10, 44), new THREE.MeshBasicMaterial({ color: 0xffd16b }));
ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; checkpoint.add(ring);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 15, 8), new THREE.MeshBasicMaterial({ color: 0xffd16b, transparent: true, opacity: 0.16 }));
beam.position.y = 7.4; checkpoint.add(beam);
const glow = new THREE.PointLight(0xffbd59, 38, 36); glow.position.y = 5; checkpoint.add(glow);

const mapState = document.querySelector('#map-state');
const mapCounts = document.querySelector('#map-counts');
const trafficCount = document.querySelector('#traffic-count');
const toast = document.querySelector('#toast');
const trafficSystem = new TrafficSystem(scene, counts => {
  trafficCount.textContent = `AI traffic · ${counts.cars} cars · ${counts.pedestrians} pedestrians · ${counts.signals || 0} signals · ${counts.crossings || 0} crossings`;
});
const streamer = new OSMStreamer(scene,
  status => {
    mapState.textContent = status.length > 22 ? status.slice(0, 20) + '…' : status;
    toast.textContent = status;
  },
  counts => {
    mapCounts.textContent = `${counts.chunks} chunks · ${counts.roads} roads · ${counts.buildings} buildings · ${counts.sidewalks || 0} sidewalks · ${counts.parks || 0} green/water areas`;
  },
  (roads, tileKey, features) => {
    // Keep OSM ribbons/junctions as the single road surface. The uploaded
    // 103 MB road scene is deliberately not instanced over each OSM segment.
    trafficSystem.addRoads(roads, tileKey, features);
  },
  (obstacles, tileKey) => vehiclePhysics.addBuildingObstacles(obstacles, tileKey)
);

// Graphics controls target integrated-GPU systems by default. Resolution adapts
// downward if the measured frame rate stays low; camera and physics remain full-rate.
const graphicsSelect = document.querySelector('#graphics-quality');
const graphicsStatus = document.querySelector('#graphics-status');
const GRAPHICS_PROFILES = {
  performance: { label: 'PERFORMANCE', pixelRatio: 0.65, minCars: 2, maxPedestrians: 5, shadows: false },
  balanced: { label: 'BALANCED', pixelRatio: 0.85, minCars: 3, maxPedestrians: 8, shadows: false },
  quality: { label: 'HIGH QUALITY', pixelRatio: 1.0, minCars: 4, maxPedestrians: 10, shadows: true }
};
let graphicsMode = 'performance';
let resolutionScale = 1;
let fpsWindowStart = performance.now();
let fpsFrames = 0;
let lowFpsSeconds = 0;
let highFpsSeconds = 0;
let lastFps = 60;

function applyRenderResolution() {
  const profile = GRAPHICS_PROFILES[graphicsMode];
  const pixelRatio = Math.min(devicePixelRatio || 1, profile.pixelRatio) * resolutionScale;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
}

function applyGraphicsQuality(mode) {
  graphicsMode = GRAPHICS_PROFILES[mode] ? mode : 'performance';
  resolutionScale = 1;
  lowFpsSeconds = 0;
  highFpsSeconds = 0;
  const profile = GRAPHICS_PROFILES[graphicsMode];

  // Real-time soft shadows are enabled only in High Quality to protect FPS on integrated GPUs.
  renderer.shadowMap.enabled = Boolean(profile.shadows);
  renderer.shadowMap.autoUpdate = Boolean(profile.shadows);
  sun.castShadow = Boolean(profile.shadows);
  if (profile.shadows) renderer.shadowMap.needsUpdate = true;
  applyRenderResolution();
  trafficSystem.setQuality({
    cars: profile.minCars,
    pedestrians: profile.maxPedestrians
  });
  if (graphicsSelect) graphicsSelect.value = graphicsMode;
  if (graphicsStatus) graphicsStatus.textContent = `${profile.label} · ADAPTIVE RESOLUTION ON`;
}

if (graphicsSelect) {
  graphicsSelect.addEventListener('change', () => applyGraphicsQuality(graphicsSelect.value));
}
applyGraphicsQuality('balanced');

function updatePerformanceReadout() {
  fpsFrames++;
  const now = performance.now();
  const sampleDuration = (now - fpsWindowStart) / 1000;
  if (sampleDuration < 1) return;

  lastFps = fpsFrames / sampleDuration;
  fpsFrames = 0;
  fpsWindowStart = now;

  if (lastFps < 30) {
    lowFpsSeconds += sampleDuration;
    highFpsSeconds = 0;
  } else if (lastFps > 50) {
    highFpsSeconds += sampleDuration;
    lowFpsSeconds = 0;
  } else {
    lowFpsSeconds = Math.max(0, lowFpsSeconds - sampleDuration);
    highFpsSeconds = 0;
  }

  // Reduce pixel count in small steps after sustained slow frames.
  if (lowFpsSeconds >= 1.5 && resolutionScale > 0.36) {
    resolutionScale = Math.max(0.36, resolutionScale - 0.07);
    applyRenderResolution();
    lowFpsSeconds = 0;
  } else if (highFpsSeconds >= 8 && resolutionScale < 1) {
    resolutionScale = Math.min(1, resolutionScale + 0.025);
    applyRenderResolution();
    highFpsSeconds = 0;
  }

  if (graphicsStatus) {
    const calls = renderer.info.render.calls || 0;
    const triangles = renderer.info.render.triangles || 0;
    graphicsStatus.textContent =
      `${Math.round(lastFps)} FPS · ${calls} CALLS · ${(triangles / 1000).toFixed(0)}K TRI`;
    graphicsStatus.dataset.state = lastFps < 30 ? 'slow' : lastFps < 45 ? 'medium' : 'good';
  }
}

let navigationGroup = null;
let destinationBeacon = null;
let destinationRing = null;

function clearNavigationObjects() {
  if (!navigationGroup) return;
  scene.remove(navigationGroup);
  navigationGroup.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material.dispose();
    }
  });
  navigationGroup = null;
  destinationBeacon = null;
  destinationRing = null;
}

function buildNavigationObjects(routeData) {
  clearNavigationObjects();
  if (!routeData) return;

  navigationGroup = new THREE.Group();
  navigationGroup.name = 'active-navigation-route';
  const routePoints = routeData.worldPoints || [];
  if (routePoints.length > 1) {
    const positions = [];
    const indices = [];
    const halfWidth = 1.05;
    for (let i = 0; i < routePoints.length; i++) {
      const point = routePoints[i];
      let dx = 0, dz = -1;
      if (i < routePoints.length - 1) {
        dx = routePoints[i + 1].x - point.x;
        dz = routePoints[i + 1].z - point.z;
      } else if (i > 0) {
        dx = point.x - routePoints[i - 1].x;
        dz = point.z - routePoints[i - 1].z;
      }
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length * halfWidth;
      const nz = dx / length * halfWidth;
      positions.push(point.x + nx, 0.19, point.z + nz, point.x - nx, 0.19, point.z - nz);
      if (i < routePoints.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    }
    const routeGeometry = new THREE.BufferGeometry();
    routeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    routeGeometry.setIndex(indices);
    routeGeometry.computeVertexNormals();
    const routeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc34f, transparent: true, opacity: 0.94, side: THREE.DoubleSide,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    });
    const routeMesh = new THREE.Mesh(routeGeometry, routeMaterial);
    routeMesh.name = 'navigation-route-ribbon';
    routeMesh.renderOrder = 5;
    navigationGroup.add(routeMesh);

    // Repeating road chevrons make the route legible from the driving camera.
    const arrowGeometry = new THREE.BufferGeometry();
    arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, -3.2,
      -1.75, 0, -0.05,
      -0.58, 0, -0.05,
      -0.58, 0, 1.85,
      0.58, 0, 1.85,
      0.58, 0, -0.05,
      1.75, 0, -0.05
    ], 3));
    arrowGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6]);
    arrowGeometry.computeVertexNormals();
    const totalLength = routePoints.reduce((sum, point, index) => {
      if (index === 0) return 0;
      return sum + Math.hypot(point.x - routePoints[index - 1].x, point.z - routePoints[index - 1].z);
    }, 0);
    const arrowCount = Math.min(24, Math.max(1, Math.floor(totalLength / 58)));
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe09a, side: THREE.DoubleSide, transparent: true, opacity: 0.98,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3
    });
    const arrowInstances = new THREE.InstancedMesh(arrowGeometry, arrowMaterial, arrowCount);
    arrowInstances.name = 'street-navigation-direction-chevrons';
    const arrowTransform = new THREE.Object3D();
    let routeDistance = 0, segmentIndex = 0;
    for (let i = 0; i < arrowCount; i++) {
      const targetDistance = totalLength * (i + 1) / (arrowCount + 1);
      while (segmentIndex < routePoints.length - 2) {
        const a = routePoints[segmentIndex], b = routePoints[segmentIndex + 1];
        const segmentLength = Math.hypot(b.x - a.x, b.z - a.z);
        if (routeDistance + segmentLength >= targetDistance) break;
        routeDistance += segmentLength;
        segmentIndex++;
      }
      const a = routePoints[segmentIndex], b = routePoints[Math.min(segmentIndex + 1, routePoints.length - 1)];
      const dx = b.x - a.x, dz = b.z - a.z;
      const segmentLength = Math.hypot(dx, dz) || 1;
      const t = THREE.MathUtils.clamp((targetDistance - routeDistance) / segmentLength, 0, 1);
      arrowTransform.position.set(a.x + dx * t, 0.27, a.z + dz * t);
      arrowTransform.rotation.set(0, Math.atan2(-dx, -dz), 0);
      arrowTransform.scale.setScalar(1);
      arrowTransform.updateMatrix();
      arrowInstances.setMatrixAt(i, arrowTransform.matrix);
    }
    arrowInstances.instanceMatrix.needsUpdate = true;
    arrowInstances.computeBoundingSphere();
    arrowInstances.renderOrder = 7;
    navigationGroup.add(arrowInstances);
  }

  destinationBeacon = new THREE.Group();
  destinationBeacon.name = 'destination-beacon';
  destinationBeacon.position.set(routeData.destinationWorld.x, 0, routeData.destinationWorld.z);
  const beaconStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.55, 22, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd36d, transparent: true, opacity: 0.24, depthWrite: false })
  );
  beaconStem.position.y = 11;
  destinationBeacon.add(beaconStem);
  destinationRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.2, 0.48, 10, 44),
    new THREE.MeshBasicMaterial({ color: 0xffc34f })
  );
  destinationRing.rotation.x = Math.PI / 2;
  destinationRing.position.y = 0.7;
  destinationBeacon.add(destinationRing);
  const beaconCap = new THREE.Mesh(
    new THREE.ConeGeometry(1.05, 2.6, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd36d })
  );
  beaconCap.position.y = 23.3;
  destinationBeacon.add(beaconCap);
  const beaconLight = new THREE.PointLight(0xffc34f, 42, 65);
  beaconLight.position.y = 6;
  destinationBeacon.add(beaconLight);
  navigationGroup.add(destinationBeacon);
  scene.add(navigationGroup);
}

const mapView = new WorldMapView({
  onRouteChange: routeData => buildNavigationObjects(routeData),
  onStatus: message => { toast.textContent = message; },
  onGuidance: guidance => {
    const panel = document.querySelector('#nav-guidance');
    panel.hidden = !guidance;
    if (!guidance) return;
    document.querySelector('#nav-arrow').textContent = guidance.arrow || '↑';
    document.querySelector('#nav-instruction').textContent = guidance.instruction || 'Follow the route';
    document.querySelector('#nav-details').textContent = guidance.details || '';
    document.querySelector('#nav-kicker').textContent = guidance.arrived
      ? 'DESTINATION REACHED'
      : (guidance.offRoute ? 'NAVIGATION WARNING' : 'UPCOMING MANEUVER');
    panel.classList.toggle('is-warning', Boolean(guidance.offRoute));
    panel.classList.toggle('is-arrived', Boolean(guidance.arrived));
  }
});

let speed = 0;
let heading = 0;
let missionDone = false;
let started = false;
let cameraYaw = 0;
let cameraPitch = 0.12;
const CAMERA_PRESETS = [
  { label: 'REAR CHASE', distance: 14, height: 4.7, lookHeight: 1.0, side: 0 },
  { label: 'CLOSE CHASE', distance: 8.5, height: 3.0, lookHeight: 0.8, side: 0 },
  { label: 'FAR CHASE', distance: 23, height: 8.2, lookHeight: 1.4, side: 0 },
  { label: 'CINEMATIC SIDE', distance: 12, height: 4.6, lookHeight: 1.0, side: 7.0 },
  { label: 'BONNET / FIRST PERSON', type: 'hood' }
];
let cameraModeIndex = 0;
let nitroFuel = 100;
let nitroActive = false;
let vehicleCondition = 100;
let collisionCooldown = 0;
let impactTimer = 0;
let cameraShake = 0;
const impactFeedback = document.querySelector('#impact-feedback');
const impactTitle = document.querySelector('#impact-title');
const impactCopy = document.querySelector('#impact-copy');
const nitroFill = document.querySelector('#nitro-fill');
const nitroValue = document.querySelector('#nitro-value');
const conditionValue = document.querySelector('#condition-value');
const rolloverHint = document.querySelector('#rollover-hint');

function showImpact(title, copy, warning = false) {
  impactTitle.textContent = title;
  impactCopy.textContent = copy;
  impactFeedback.hidden = false;
  impactFeedback.classList.toggle('is-warning', warning);
  impactTimer = 2.2;
  cameraShake = warning ? 0.85 : 0.55;
}
const keys = Object.create(null);
addEventListener('keydown', event => {
  if (event.code === 'KeyM' && !event.repeat) {
    Object.keys(keys).forEach(key => { keys[key] = false; });
    mapView.toggle(); event.preventDefault(); return;
  }
  if (event.code === 'Escape' && mapView.isOpen) { mapView.close(); return; }
  if (mapView.isOpen) return;
  keys[event.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'KeyR' && gameMode === 'vehicle') resetVehicle();
  if (event.code === 'KeyF' && !event.repeat) interactF();
  if (event.code === 'KeyE' && !event.repeat && gameMode === 'walking') useMallElevator();
  if (event.code === 'KeyV' && !event.repeat && gameMode === 'vehicle') {
    event.preventDefault();
    document.querySelector('#car-select')?.focus();
  }
  if (event.code === 'KeyC' && !event.repeat) {
    cameraModeIndex = (cameraModeIndex + 1) % CAMERA_PRESETS.length;
    const preset = CAMERA_PRESETS[cameraModeIndex];
    if (preset.distance) cameraDistance = preset.distance;
    cameraPitch = 0.12;
    toast.textContent = `CAMERA · ${preset.label} · PRESS C TO CHANGE VIEW`;
    event.preventDefault();
  }
});
addEventListener('keyup', event => { keys[event.code] = false; });
function recoverVehicle() {
  vehiclePhysics.recoverUpright();
  vehiclePhysics.syncVisuals(vehicle, wheels);
  speed = 0;
  heading = vehiclePhysics.getHeading();
  cameraPitch = 0.12;
  cameraDistance = 14;
  nitroActive = false;
  nitroFlames.visible = false;
  nitroGlow.intensity = 0;
  rolloverHint.hidden = true;
  Object.keys(keys).forEach(key => { keys[key] = false; });
  toast.textContent = 'Vehicle recovered upright · Continue driving';
}

function resetVehicle() {
  vehiclePhysics.reset();
  vehiclePhysics.syncVisuals(vehicle, wheels);
  speed = 0; heading = 0;
  vehicleCondition = 100; nitroFuel = 100; collisionCooldown = 0;
  rolloverHint.hidden = true;
  streamer.requestAtWorld(vehicle.position.x, vehicle.position.z);
  toast.textContent = 'Returned to CP67 Mall · Vehicle repaired · Nitro refilled';
}

const interactionHint = document.querySelector('#interaction-hint');
const mallFloorLabel = document.querySelector('#mall-floor-label');
const controlsHelp = document.querySelector('#controls-help');
const floorNames = ['GROUND FLOOR', 'FIRST FLOOR · RETAIL', 'SECOND FLOOR · FOOD COURT / FEC', 'PVR CINEMAS'];

function activeWorldPosition() {
  return gameMode === 'walking' ? playerPedestrian.position : vehicle.position;
}

function setWalkingMode(enabled) {
  gameMode = enabled ? 'walking' : 'vehicle';
  playerPedestrian.visible = enabled;
  if (enabled) {
    if (vehicleGarage) vehicleGarage.resetRiderPose();
    playerPedestrian.rotation.set(0, pedestrianHeading, 0);
  }
  vehicle.visible = Boolean(vehicle.userData.assetLoaded);
  wheels.forEach(wheel => { wheel.visible = false; });
  document.querySelector('#vehicle-status').style.display = enabled ? 'none' : '';
  nitroActive = false;
  nitroFlames.visible = false;
  nitroGlow.intensity = 0;
  Object.keys(keys).forEach(key => { keys[key] = false; });
  controlsHelp.innerHTML = enabled
    ? 'W / ↑ · S / ↓ <i>WALK</i> &nbsp; A/D / ←→ <i>TURN</i> &nbsp; SHIFT <i>RUN</i> &nbsp; E <i>USE LIFT</i> &nbsp; F <i>ENTER / EXIT</i> &nbsp; C <i>CAMERA</i> &nbsp; M <i>MAP</i>'
    : 'W / ↑ <i>FORWARD</i> &nbsp; S / ↓ <i>REVERSE</i> &nbsp; A/D / ←→ <i>STEER</i> &nbsp; SPACE <i>BRAKE</i> &nbsp; F <i>EXIT / RECOVER</i> &nbsp; N <i>NITRO</i> &nbsp; C <i>CAMERA</i> &nbsp; M <i>MAP</i>';
}

function exitVehicle() {
  if (vehiclePhysics.isUpsideDown) {
    recoverVehicle();
    return;
  }
  if (Math.abs(speed) > 1.5) {
    toast.textContent = 'Bring the vehicle to a complete stop before getting out.';
    return;
  }
  const sideX = -Math.cos(heading) * 2.3;
  const sideZ = Math.sin(heading) * 2.3;
  playerPedestrian.position.set(vehicle.position.x + sideX, Math.max(0, vehicle.position.y), vehicle.position.z + sideZ);
  pedestrianHeading = heading;
  pedestrianInsideMall = false;
  pedestrianFloor = 0;
  setWalkingMode(true);
  toast.textContent = 'On foot · Walk to the CP67 glass entrance to enter the mall.';
}

function enterVehicle() {
  if (Math.hypot(playerPedestrian.position.x - vehicle.position.x, playerPedestrian.position.z - vehicle.position.z) > 4.5) {
    toast.textContent = 'Move closer to your vehicle to get back in.';
    return;
  }
  if (pedestrianInsideMall) {
    cp67Interior.group.visible = false;
    pedestrianInsideMall = false;
  }
  playerPedestrian.visible = false;
  pedestrianFloor = 0;
  mallFloorLabel.hidden = true;
  setWalkingMode(false);
  speed = vehiclePhysics.speedMps;
  heading = vehiclePhysics.getHeading();
  toast.textContent = 'Back in your vehicle.';
}

function enterMallInterior() {
  pedestrianInsideMall = true;
  pedestrianFloor = 0;
  cp67Interior.group.visible = true;
  playerPedestrian.position.set(cp67Interior.spawn.x, 0.9, cp67Interior.spawn.z);
  playerPedestrian.rotation.y = pedestrianHeading;
  mallFloorLabel.hidden = false;
  mallFloorLabel.textContent = 'CP67 · ' + floorNames[pedestrianFloor];
  toast.textContent = 'Welcome to CP67 Mall · Explore the retail atrium and use E at the lift to change floors.';
}

function exitMallInterior() {
  if (pedestrianFloor !== 0) {
    toast.textContent = 'Use the lift (E) to return to the ground floor before exiting.';
    return;
  }
  pedestrianInsideMall = false;
  cp67Interior.group.visible = false;
  playerPedestrian.position.set(0, 0.05, 16.5);
  mallFloorLabel.hidden = true;
  toast.textContent = 'You are outside CP67 Mall · F near your vehicle to enter.';
}

function useMallElevator() {
  if (!pedestrianInsideMall || !cp67Interior.nearElevator(playerPedestrian.position.x, playerPedestrian.position.z)) {
    toast.textContent = 'Move to the lift lobby on the east side of the atrium to change floors.';
    return;
  }
  pedestrianFloor = (pedestrianFloor + 1) % cp67Interior.floorCount;
  playerPedestrian.position.set(
    cp67Interior.collision.elevator.x - 2.2,
    0.9 + pedestrianFloor * cp67Interior.floorHeight,
    cp67Interior.collision.elevator.z
  );
  mallFloorLabel.textContent = 'CP67 · ' + floorNames[pedestrianFloor];
  toast.textContent = 'Lift arrived · ' + floorNames[pedestrianFloor];
}

function interactF() {
  if (gameMode === 'vehicle') {
    exitVehicle();
    return;
  }
  if (pedestrianInsideMall) {
    if (pedestrianFloor === 0 && playerPedestrian.position.z > 5.5 && Math.abs(playerPedestrian.position.x) < 12) exitMallInterior();
    else if (Math.hypot(playerPedestrian.position.x - vehicle.position.x, playerPedestrian.position.z - vehicle.position.z) < 4.5) enterVehicle();
    else toast.textContent = 'Walk to the entrance to leave the mall, or return to your car outside.';
    return;
  }
  if (Math.hypot(playerPedestrian.position.x - vehicle.position.x, playerPedestrian.position.z - vehicle.position.z) < 4.5) {
    enterVehicle();
  } else if (Math.abs(playerPedestrian.position.x) < 12 && playerPedestrian.position.z < 19 && playerPedestrian.position.z > 8) {
    enterMallInterior();
  } else {
    toast.textContent = 'Walk to the CP67 entrance or back to your vehicle.';
  }
}

function updateInteractionHint() {
  if (!started || mapView.isOpen) {
    interactionHint.hidden = true;
    return;
  }
  interactionHint.hidden = false;
  if (gameMode === 'vehicle') {
    interactionHint.textContent = vehiclePhysics.isUpsideDown
      ? 'F  ·  RECOVER VEHICLE'
      : Math.abs(speed) < 1.5 ? 'F  ·  EXIT VEHICLE' : 'STOP TO EXIT  ·  F';
  } else if (pedestrianInsideMall) {
    const atLift = cp67Interior.nearElevator(playerPedestrian.position.x, playerPedestrian.position.z);
    const atExit = pedestrianFloor === 0 && playerPedestrian.position.z > 5.5 && Math.abs(playerPedestrian.position.x) < 12;
    interactionHint.textContent = atExit
      ? 'F  ·  EXIT CP67 MALL'
      : atLift ? 'E  ·  USE LIFT  /  CHANGE FLOOR' : floorNames[pedestrianFloor] + '  ·  EXPLORE';
  } else {
    const nearCar = Math.hypot(playerPedestrian.position.x - vehicle.position.x, playerPedestrian.position.z - vehicle.position.z) < 4.5;
    const nearDoor = Math.abs(playerPedestrian.position.x) < 12 && playerPedestrian.position.z < 19 && playerPedestrian.position.z > 8;
    interactionHint.textContent = nearCar ? 'F  ·  ENTER VEHICLE' : nearDoor ? 'F  ·  ENTER CP67 MALL' : 'WASD  ·  WALK  /  F  ·  INTERACT';
  }
}

let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.style.cursor = 'grab';
renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
renderer.domElement.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  dragging = true; lastX = event.clientX; lastY = event.clientY;
  renderer.domElement.style.cursor = 'grabbing';
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointerup', () => { dragging = false; renderer.domElement.style.cursor = 'grab'; });
renderer.domElement.addEventListener('pointercancel', () => { dragging = false; renderer.domElement.style.cursor = 'grab'; });
renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging || mapView.isOpen) return;
  cameraYaw -= (event.clientX - lastX) * 0.005;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + (event.clientY - lastY) * 0.003, -0.12, 0.68);
  lastX = event.clientX; lastY = event.clientY;
});
let cameraDistance = 14;
renderer.domElement.addEventListener('wheel', event => {
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.012, 7.5, 32);
}, { passive: true });

document.querySelector('#start').addEventListener('click', () => {
  started = true;
  document.querySelector('#start-screen').style.display = 'none';
  streamer.requestAtWorld(vehicle.position.x, vehicle.position.z);
  toast.textContent = `Loading roads and building footprints near ${CITY_ORIGIN.lat.toFixed(4)}, ${CITY_ORIGIN.lon.toFixed(4)}…`;
});
document.querySelector('#retry-map').addEventListener('click', () => streamer.retryCurrent());

function areaName() {
  const x = vehicle.position.x, z = vehicle.position.z;
  if (Math.abs(x) < 900 && z > -650 && z < 1050) return 'CP67 MALL · SECTOR 67';
  if (x > 3200) return 'CHANDIGARH · SECTOR 17 SIDE';
  if (x < -1400) return 'MOHALI · WEST SIDE';
  if (z < -1800) return 'NORTH TRICITY';
  if (z > 2500) return 'SOUTH MOHALI';
  return 'MOHALI · SECTOR 67';
}

const minimapCanvas = document.querySelector('#minimap');
const minimapContext = minimapCanvas.getContext('2d');
function drawMinimap() {
  const ctx = minimapContext;
  ctx.clearRect(0, 0, 180, 180);
  ctx.fillStyle = '#182621'; ctx.fillRect(0, 0, 180, 180);
  const routeState = mapView.getMinimapState();
  const playerPosition = activeWorldPosition();
  const playerHeading = gameMode === 'walking' ? pedestrianHeading : heading;
  const scale = 0.23; // roughly 700 metres across the circular radar at this zoom
  ctx.save();
  ctx.beginPath(); ctx.arc(90, 90, 82, 0, Math.PI * 2); ctx.clip();
  ctx.translate(90, 90);
  // Heading-up orientation: the vehicle's nose always points to the top of the radar.
  ctx.rotate(playerHeading);
  ctx.strokeStyle = '#405249'; ctx.lineWidth = 1;
  for (let p = -180; p <= 180; p += 22.5) {
    ctx.beginPath(); ctx.moveTo(p, -90); ctx.lineTo(p, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-90, p); ctx.lineTo(90, p); ctx.stroke();
  }

  if (routeState?.worldPoints?.length > 1) {
    const points = routeState.worldPoints;
    const segmentIndex = THREE.MathUtils.clamp(routeState.segmentIndex || 0, 0, points.length - 2);
    const segmentT = THREE.MathUtils.clamp(routeState.segmentT || 0, 0, 1);
    const segmentA = points[segmentIndex], segmentB = points[segmentIndex + 1];
    const routeStart = {
      x: THREE.MathUtils.lerp(segmentA.x, segmentB.x, segmentT),
      z: THREE.MathUtils.lerp(segmentA.z, segmentB.z, segmentT)
    };

    const drawRoute = () => {
      ctx.beginPath();
      ctx.moveTo((routeStart.x - playerPosition.x) * scale, (routeStart.z - playerPosition.z) * scale);
      for (let i = segmentIndex + 1; i < points.length; i++) {
        const x = (points[i].x - playerPosition.x) * scale;
        const y = (points[i].z - playerPosition.z) * scale;
        ctx.lineTo(x, y);
      }
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawRoute(); ctx.strokeStyle = '#111b17'; ctx.lineWidth = 8; ctx.stroke();
    drawRoute(); ctx.strokeStyle = routeState.offRoute ? '#e06d53' : '#f2b63f'; ctx.lineWidth = 4; ctx.stroke();

    // Screen-readable chevrons show route direction even when the 2D map is closed.
    let travelled = 0, nextArrowAt = 48;
    for (let i = segmentIndex; i < points.length - 1; i++) {
      const a = i === segmentIndex ? routeStart : points[i];
      const b = points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const segmentLength = Math.hypot(dx, dz);
      if (segmentLength < 1) continue;
      while (travelled + segmentLength >= nextArrowAt) {
        const t = THREE.MathUtils.clamp((nextArrowAt - travelled) / segmentLength, 0, 1);
        const x = (a.x + dx * t - playerPosition.x) * scale;
        const y = (a.z + dz * t - playerPosition.z) * scale;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dz, dx));
        ctx.fillStyle = '#fff4d0'; ctx.strokeStyle = '#18211b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
        nextArrowAt += 62;
      }
      travelled += segmentLength;
    }
    const next = routeState.nextStep;
    if (next) {
      const x = (next.x - playerPosition.x) * scale;
      const y = (next.z - playerPosition.z) * scale;
      if (Math.hypot(x, y) < 76) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#a66b18'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#18211b'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(routeState.arrow || '↑', x, y + 0.5);
      }
    }
    const dest = routeState.destination;
    if (dest) {
      const x = (dest.x - playerPosition.x) * scale;
      const y = (dest.z - playerPosition.z) * scale;
      if (Math.hypot(x, y) < 80) {
        ctx.fillStyle = '#f2b63f'; ctx.strokeStyle = '#18211b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();

  // Player heading marker.
  ctx.fillStyle = '#f4d17c'; ctx.strokeStyle = '#15211b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(90, 78); ctx.lineTo(82, 99); ctx.lineTo(90, 95); ctx.lineTo(98, 99); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d7bd7c'; ctx.beginPath(); ctx.arc(90, 90, 5, 0, Math.PI * 2); ctx.stroke();

  const navLabel = document.querySelector('#minimap-nav');
  if (routeState) {
    const distance = Number.isFinite(routeState.distanceToTurn)
      ? (routeState.distanceToTurn >= 1000 ? `${(routeState.distanceToTurn / 1000).toFixed(1)}km` : `${Math.round(routeState.distanceToTurn)}m`)
      : '';
    const status = routeState.arrived ? 'ARRIVED' : routeState.offRoute ? 'OFF ROUTE' : `${routeState.arrow} ${routeState.instruction}`;
    navLabel.textContent = distance && !routeState.arrived ? `${status} · ${distance}` : status;
    navLabel.classList.toggle('is-warning', routeState.offRoute);
    navLabel.classList.toggle('is-arrived', routeState.arrived);
  } else {
    navLabel.textContent = 'NO ACTIVE ROUTE';
    navLabel.classList.remove('is-warning', 'is-arrived');
  }
}

const clock = new THREE.Clock();
let mapCheckElapsed = 0;
let mapUiElapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  if (started && !mapView.isOpen && gameMode === 'vehicle') {
    const forward = keys.KeyW || keys.ArrowUp;
    const reverse = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft;
    const right = keys.KeyD || keys.ArrowRight;
    const steer = (left ? 1 : 0) - (right ? 1 : 0);

    // Cannon RaycastVehicle now owns engine force, braking, grip and suspension.
    nitroActive = Boolean(keys.KeyN && nitroFuel > 0 && forward);
    if (nitroActive) nitroFuel = Math.max(0, nitroFuel - 30 * dt);
    else nitroFuel = Math.min(100, nitroFuel + 8 * dt);

    const overturned = vehiclePhysics.isUpsideDown;
    vehiclePhysics.update(dt, {
      throttle: overturned ? 0 : (forward ? 1 : reverse ? -1 : 0),
      steer: overturned ? 0 : steer,
      brake: overturned || Boolean(keys.Space),
      nitro: nitroActive && !overturned,
      boost: Boolean(keys.ShiftLeft || keys.ShiftRight) && !overturned,
      condition: vehicleCondition
    });
    vehiclePhysics.syncVisuals(vehicle, wheels);
    speed = vehiclePhysics.speedMps;
    heading = vehiclePhysics.heading;
    nitroFlames.visible = nitroActive;
    nitroGlow.intensity = nitroActive ? 24 : 0;

    // Ambient vehicles and pedestrians follow the actual OSM road centerlines.
    const impacts = trafficSystem.update(dt, {
      x: vehicle.position.x, z: vehicle.position.z, heading, speed
    });
    if (impacts.length && collisionCooldown <= 0) {
      const impact = impacts[0];
      collisionCooldown = 1.05;
      if (impact.type === 'vehicle') {
        vehiclePhysics.applyImpact(impact.impact, Math.random() > 0.5 ? 1 : -1);
        vehicleCondition = Math.max(0, vehicleCondition - (9 + impact.impact * 11));
        showImpact('TRAFFIC COLLISION', 'Vehicle impact · chassis jolted · vehicle condition reduced', true);
      } else {
        vehiclePhysics.applyImpact(impact.impact * 0.55, Math.random() > 0.5 ? 1 : -1);
        vehicleCondition = Math.max(0, vehicleCondition - (3 + impact.impact * 5));
        showImpact('PEDESTRIAN IMPACT', 'Pedestrian stumbled and is recovering · drive carefully', true);
      }
      vehiclePhysics.syncVisuals(vehicle, wheels);
      speed = vehiclePhysics.speedMps;
      heading = vehiclePhysics.heading;
    }

    mapCheckElapsed += dt;
    if (mapCheckElapsed > 1.5) {
      streamer.requestAtWorld(vehicle.position.x, vehicle.position.z);
      mapCheckElapsed = 0;
    }
    if (!missionDone && Math.hypot(vehicle.position.x - checkpoint.position.x, vehicle.position.z - checkpoint.position.z) < 12) {
      missionDone = true;
      document.querySelector('#mission-title').textContent = 'AREA DISCOVERED';
      document.querySelector('#mission-copy').textContent = 'Checkpoint reached · Keep exploring';
      toast.textContent = 'CHECKPOINT REACHED · Explore the mapped streets';
    }
    rolloverHint.hidden = !vehiclePhysics.isUpsideDown;
    if (vehiclePhysics.isUpsideDown) {
      nitroActive = false;
      nitroFlames.visible = false;
      nitroGlow.intensity = 0;
    }
    document.querySelector('#speed').textContent = String(Math.round(Math.abs(speed) * 3.6)).padStart(3, '0');
    document.querySelector('#area').textContent = areaName();
    nitroFill.style.width = `${nitroFuel.toFixed(1)}%`;
    nitroValue.textContent = `${Math.round(nitroFuel)}%`;
    conditionValue.textContent = `${Math.round(vehicleCondition)}%`;
    conditionValue.style.color = vehicleCondition < 35 ? '#e98269' : '#dce5d8';
  } else if (started && !mapView.isOpen && gameMode === 'walking') {
    const forward = keys.KeyW || keys.ArrowUp;
    const reverse = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft;
    const right = keys.KeyD || keys.ArrowRight;
    const turn = (left ? 1 : 0) - (right ? 1 : 0);
    pedestrianHeading += turn * dt * 2.25;
    const moving = forward || reverse;
    const walkSpeed = (keys.ShiftLeft || keys.ShiftRight) ? RUN_SPEED : WALK_SPEED;
    const direction = (forward ? 1 : 0) - (reverse ? 1 : 0);
    const moveX = -Math.sin(pedestrianHeading) * direction * walkSpeed * dt;
    const moveZ = -Math.cos(pedestrianHeading) * direction * walkSpeed * dt;
    const nextX = playerPedestrian.position.x + moveX;
    const nextZ = playerPedestrian.position.z + moveZ;

    // Walk through the real entrance threshold; the interior is a separate walkable scene.
    if (!pedestrianInsideMall && Math.abs(nextX) < 12 && nextZ < 13.4 && nextZ > 7.5) {
      enterMallInterior();
    } else if (pedestrianInsideMall && pedestrianFloor === 0 && Math.abs(nextX) < 12 && nextZ > 8.8) {
      exitMallInterior();
    } else if (!pedestrianInsideMall) {
      playerPedestrian.position.x = nextX;
      playerPedestrian.position.z = nextZ;
    } else if (cp67Interior.isWalkable(nextX, nextZ, pedestrianFloor)) {
      playerPedestrian.position.x = nextX;
      playerPedestrian.position.z = nextZ;
    }

    playerPedestrian.position.y = pedestrianInsideMall
      ? 0.9 + pedestrianFloor * cp67Interior.floorHeight
      : 0.05;
    playerPedestrian.rotation.y = pedestrianHeading;
    // Keep ambient traffic and pedestrians animated while the player explores on foot.
    trafficSystem.update(dt, {
      x: playerPedestrian.position.x,
      z: playerPedestrian.position.z,
      heading: pedestrianHeading,
      speed: 0
    });
    pedestrianWalkPhase += dt * (moving ? (walkSpeed > WALK_SPEED ? 11 : 7.5) : 0);
    const limbs = playerPedestrian.userData.limbs;
    const stride = moving ? Math.sin(pedestrianWalkPhase) * 0.48 : 0;
    limbs.legs[0].rotation.x = stride;
    limbs.legs[1].rotation.x = -stride;
    limbs.arms[0].rotation.x = -stride * 0.72;
    limbs.arms[1].rotation.x = stride * 0.72;

    speed = 0;
    heading = pedestrianHeading;
    nitroActive = false;
    nitroFlames.visible = false;
    nitroGlow.intensity = 0;
    document.querySelector('#vehicle-status').style.display = 'none';
    document.querySelector('#speed').textContent = '000';
    document.querySelector('#area').textContent = pedestrianInsideMall ? 'CP67 MALL INTERIOR' : 'SECTOR 67 · ON FOOT';

    if (!pedestrianInsideMall) {
      mapCheckElapsed += dt;
      if (mapCheckElapsed > 1.5) {
        streamer.requestAtWorld(playerPedestrian.position.x, playerPedestrian.position.z);
        mapCheckElapsed = 0;
      }
    }
  } else {
    nitroActive = false;
    nitroFlames.visible = false;
    nitroGlow.intensity = 0;
  }
  // This also mounts the player avatar when a motorcycle is selected.
  vehicleGarage.update(dt);
  updateInteractionHint();
  collisionCooldown = Math.max(0, collisionCooldown - dt);
  if (!impactFeedback.hidden) {
    impactTimer -= dt;
    if (impactTimer <= 0) impactFeedback.hidden = true;
  }
  if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 2.8);

  mapUiElapsed += dt;
  if (mapUiElapsed > 0.16) {
    const playerPosition = activeWorldPosition();
    mapView.update(playerPosition.x, playerPosition.z, heading);
    drawMinimap();
    mapUiElapsed = 0;
  }
  const playerPosition = activeWorldPosition();
  const playerHeading = gameMode === 'walking' ? pedestrianHeading : heading;
  const target = new THREE.Vector3(
    playerPosition.x,
    gameMode === 'walking' ? playerPosition.y + 1.45 : vehicle.position.y + 1.2,
    playerPosition.z
  );
  const preset = CAMERA_PRESETS[cameraModeIndex];
  let desired;
  let lookTarget;

  if (gameMode === 'vehicle' && preset.type === 'hood') {
    // First-person bonnet camera mounted just ahead of the driver.
    const forwardX = -Math.sin(playerHeading + cameraYaw);
    const forwardZ = -Math.cos(playerHeading + cameraYaw);
    desired = new THREE.Vector3(
      playerPosition.x + forwardX * 1.18,
      playerPosition.y + 1.42 + cameraPitch * 2,
      playerPosition.z + forwardZ * 1.18
    );
    lookTarget = new THREE.Vector3(
      playerPosition.x + forwardX * 18,
      playerPosition.y + 1.25,
      playerPosition.z + forwardZ * 18
    );
  } else {
    const distance = gameMode === 'walking' ? 7.2 : cameraDistance;
    const height = gameMode === 'walking' ? 2.6 + cameraPitch * 6.5 : preset.height + cameraPitch * 12;
    const yaw = playerHeading + cameraYaw;
    const side = gameMode === 'walking' ? 0 : (preset.side || 0);
    const behind = new THREE.Vector3(
      Math.sin(yaw) * distance + Math.cos(yaw) * side,
      height,
      Math.cos(yaw) * distance - Math.sin(yaw) * side
    );
    desired = target.clone().add(behind);
    lookTarget = target.clone().add(new THREE.Vector3(
      0,
      gameMode === 'walking' ? 1.0 : (preset.lookHeight || 1.0),
      0
    ));
  }

  if (cameraShake > 0) {
    const shakeTime = performance.now() * 0.035;
    desired.x += Math.sin(shakeTime * 1.7) * cameraShake * 0.7;
    desired.y += Math.cos(shakeTime * 2.1) * cameraShake * 0.45;
  }
  // Use delta-time smoothing with a faster response as vehicle speed rises.
  // The selected preset / mouse-wheel distance stays fixed; only follow lag changes.
  const followSpeed = gameMode === 'vehicle'
    ? 28 + Math.min(18, Math.abs(speed) * 1.1)
    : 16;
  const followAlpha = 1 - Math.exp(-followSpeed * dt);
  camera.position.lerp(desired, followAlpha);
  camera.lookAt(lookTarget);
  ring.rotation.z += dt * 0.7;
  if (destinationRing) destinationRing.rotation.z += dt * 0.85;
  if (destinationBeacon) {
    destinationBeacon.children[0].position.y = 11 + Math.sin(performance.now() * 0.0015) * 1.2;
  }
  checkpoint.position.y = Math.sin(performance.now() * 0.0018) * 0.22;
  renderer.render(scene, camera);
  updatePerformanceReadout();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyRenderResolution();
});

animate();
