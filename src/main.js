import * as THREE from 'three';
import { OSMStreamer, CITY_ORIGIN } from './world/OSMStreamer.js';
import { WorldMapView } from './world/WorldMapView.js';
import { TrafficSystem } from './world/TrafficSystem.js';
import { VehiclePhysics } from './vehicles/VehiclePhysics.js';
import 'leaflet/dist/leaflet.css';
import './style.css';

const root = document.querySelector('#game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91a6a6);
scene.fog = new THREE.FogExp2(0x91a6a6, 0.00042);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 12000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.domElement.id = 'world';
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdce9ed, 0x566052, 1.9));
const sun = new THREE.DirectionalLight(0xffe6c3, 2.35);
sun.position.set(-500, 900, 340);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -900; sun.shadow.camera.right = 900;
sun.shadow.camera.top = 900; sun.shadow.camera.bottom = -900;
sun.shadow.camera.far = 2200;
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
vehiclePhysics.syncVisuals(vehicle, wheels);

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
  (roads, tileKey, features) => trafficSystem.addRoads(roads, tileKey, features),
  (obstacles, tileKey) => vehiclePhysics.addBuildingObstacles(obstacles, tileKey)
);
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
      positions.push(point.x + nx, 0.29, point.z + nz, point.x - nx, 0.29, point.z - nz);
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
  if (event.code === 'KeyR') resetVehicle();
});
addEventListener('keyup', event => { keys[event.code] = false; });
function resetVehicle() {
  vehiclePhysics.reset();
  vehiclePhysics.syncVisuals(vehicle, wheels);
  speed = 0; heading = 0;
  vehicleCondition = 100; nitroFuel = 100; collisionCooldown = 0;
  streamer.requestAtWorld(vehicle.position.x, vehicle.position.z);
  toast.textContent = 'Vehicle reset and repaired · Nitro refilled';
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
  if (x > 7000) return 'EAST CHANDIGARH';
  if (x < -3500) return 'MOHALI SIDE';
  if (z < -1500) return 'NORTH CHANDIGARH';
  if (z > 2500) return 'SOUTH CHANDIGARH';
  return 'SECTOR 17 AREA';
}

const minimapCanvas = document.querySelector('#minimap');
const minimapContext = minimapCanvas.getContext('2d');
function drawMinimap() {
  const ctx = minimapContext;
  ctx.clearRect(0, 0, 180, 180);
  ctx.fillStyle = '#182621'; ctx.fillRect(0, 0, 180, 180);
  const routeState = mapView.getMinimapState();
  const scale = 0.23; // roughly 700 metres across the circular radar at this zoom
  ctx.save();
  ctx.beginPath(); ctx.arc(90, 90, 82, 0, Math.PI * 2); ctx.clip();
  ctx.translate(90, 90);
  // Heading-up orientation: the vehicle's nose always points to the top of the radar.
  ctx.rotate(heading);
  ctx.strokeStyle = '#405249'; ctx.lineWidth = 1;
  for (let p = -180; p <= 180; p += 22.5) {
    ctx.beginPath(); ctx.moveTo(p, -90); ctx.lineTo(p, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-90, p); ctx.lineTo(90, p); ctx.stroke();
  }

  if (routeState?.worldPoints?.length > 1) {
    const points = routeState.worldPoints;
    let nearestIndex = 0, nearestDistance = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const l2 = dx * dx + dz * dz || 1;
      const t = THREE.MathUtils.clamp(((vehicle.position.x - a.x) * dx + (vehicle.position.z - a.z) * dz) / l2, 0, 1);
      const d = Math.hypot(vehicle.position.x - (a.x + t * dx), vehicle.position.z - (a.z + t * dz));
      if (d < nearestDistance) { nearestDistance = d; nearestIndex = i; }
    }

    const drawRoute = () => {
      ctx.beginPath();
      for (let i = nearestIndex; i < points.length; i++) {
        const x = (points[i].x - vehicle.position.x) * scale;
        const y = (points[i].z - vehicle.position.z) * scale;
        if (i === nearestIndex) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawRoute(); ctx.strokeStyle = '#111b17'; ctx.lineWidth = 8; ctx.stroke();
    drawRoute(); ctx.strokeStyle = routeState.offRoute ? '#e06d53' : '#f2b63f'; ctx.lineWidth = 4; ctx.stroke();

    // Screen-readable chevrons show route direction even when the 2D map is closed.
    let travelled = 0, nextArrowAt = 48;
    for (let i = nearestIndex; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const segmentLength = Math.hypot(dx, dz);
      if (segmentLength < 1) continue;
      if (travelled + segmentLength >= nextArrowAt) {
        const t = THREE.MathUtils.clamp((nextArrowAt - travelled) / segmentLength, 0, 1);
        const x = (a.x + dx * t - vehicle.position.x) * scale;
        const y = (a.z + dz * t - vehicle.position.z) * scale;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dz, dx));
        ctx.fillStyle = '#fff4d0'; ctx.strokeStyle = '#18211b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
        nextArrowAt += 78;
      }
      travelled += segmentLength;
    }
    const next = routeState.nextStep;
    if (next) {
      const x = (next.x - vehicle.position.x) * scale;
      const y = (next.z - vehicle.position.z) * scale;
      if (Math.hypot(x, y) < 76) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#a66b18'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#18211b'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(routeState.arrow || '↑', x, y + 0.5);
      }
    }
    const dest = routeState.destination;
    if (dest) {
      const x = (dest.x - vehicle.position.x) * scale;
      const y = (dest.z - vehicle.position.z) * scale;
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
  if (started && !mapView.isOpen) {
    const forward = keys.KeyW || keys.ArrowUp;
    const reverse = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft;
    const right = keys.KeyD || keys.ArrowRight;
    const steer = (left ? 1 : 0) - (right ? 1 : 0);

    // Cannon RaycastVehicle now owns engine force, braking, grip and suspension.
    nitroActive = Boolean(keys.KeyN && nitroFuel > 0 && forward);
    if (nitroActive) nitroFuel = Math.max(0, nitroFuel - 30 * dt);
    else nitroFuel = Math.min(100, nitroFuel + 8 * dt);

    vehiclePhysics.update(dt, {
      throttle: forward ? 1 : reverse ? -1 : 0,
      steer,
      brake: Boolean(keys.Space),
      nitro: nitroActive,
      boost: Boolean(keys.ShiftLeft || keys.ShiftRight),
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
    document.querySelector('#speed').textContent = String(Math.round(Math.abs(speed) * 3.6)).padStart(3, '0');
    document.querySelector('#area').textContent = areaName();
    nitroFill.style.width = `${nitroFuel.toFixed(1)}%`;
    nitroValue.textContent = `${Math.round(nitroFuel)}%`;
    conditionValue.textContent = `${Math.round(vehicleCondition)}%`;
    conditionValue.style.color = vehicleCondition < 35 ? '#e98269' : '#dce5d8';
  } else {
    nitroActive = false;
    nitroFlames.visible = false;
    nitroGlow.intensity = 0;
  }
  collisionCooldown = Math.max(0, collisionCooldown - dt);
  if (!impactFeedback.hidden) {
    impactTimer -= dt;
    if (impactTimer <= 0) impactFeedback.hidden = true;
  }
  if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 2.8);

  mapUiElapsed += dt;
  if (mapUiElapsed > 0.12) {
    mapView.update(vehicle.position.x, vehicle.position.z, heading);
    mapUiElapsed = 0;
  }
  const target = new THREE.Vector3(vehicle.position.x, 2.1, vehicle.position.z);
  const distance = cameraDistance;
  const behind = new THREE.Vector3(Math.sin(heading + cameraYaw) * distance, 4.7 + cameraPitch * 12, Math.cos(heading + cameraYaw) * distance);
  const desired = target.clone().add(behind);
  if (cameraShake > 0) {
    const shakeTime = performance.now() * 0.035;
    desired.x += Math.sin(shakeTime * 1.7) * cameraShake * 0.7;
    desired.y += Math.cos(shakeTime * 2.1) * cameraShake * 0.45;
  }
  camera.position.lerp(desired, 0.085);
  camera.lookAt(target.clone().add(new THREE.Vector3(0, 1.0, 0)));
  ring.rotation.z += dt * 0.7;
  if (destinationRing) destinationRing.rotation.z += dt * 0.85;
  if (destinationBeacon) {
    destinationBeacon.children[0].position.y = 11 + Math.sin(performance.now() * 0.0015) * 1.2;
  }
  checkpoint.position.y = Math.sin(performance.now() * 0.0018) * 0.22;
  renderer.render(scene, camera);
  drawMinimap();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
});

animate();
