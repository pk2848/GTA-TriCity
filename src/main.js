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
const glassMat = new THREE.MeshStandardMaterial({ color: 0x283b40, metalness: 0.25, roughness: 0.24 });
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
addBox(vehicle, 2.05, 0.66, 4.25, bodyMat, 0, 0.98, 0);
addBox(vehicle, 1.72, 0.78, 2.05, glassMat, 0, 1.63, -0.12);
addBox(vehicle, 1.78, 0.1, 1.45, new THREE.MeshStandardMaterial({ color: 0xa8c2c3, roughness: 0.2, metalness: 0.18 }), 0, 2.02, -0.12);
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
}, event => {
  // Collision events are also surfaced to gameplay and telemetry hooks.
  if (event.type === 'vehicle') showImpact('TRAFFIC CONTACT', 'AI vehicle collision detected', true);
});
const streamer = new OSMStreamer(scene,
  status => {
    mapState.textContent = status.length > 22 ? status.slice(0, 20) + '…' : status;
    toast.textContent = status;
  },
  counts => {
    mapCounts.textContent = `${counts.chunks} chunks · ${counts.roads} roads · ${counts.buildings} buildings · ${counts.sidewalks || 0} sidewalks · ${counts.parks || 0} green/water areas`;
  },
  (roads, tileKey, features) => trafficSystem.addRoads(roads, tileKey, features)
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
  ctx.save();
  ctx.translate(90, 90); ctx.rotate(-heading);
  // A subdued orientation grid; actual OSM geometry is visible in the 3D world.
  ctx.strokeStyle = '#536359'; ctx.lineWidth = 1;
  for (let p = -90; p <= 90; p += 22.5) {
    ctx.beginPath(); ctx.moveTo(p, -90); ctx.lineTo(p, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-90, p); ctx.lineTo(90, p); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#f4d17c'; ctx.beginPath(); ctx.moveTo(90, 79); ctx.lineTo(83, 98); ctx.lineTo(97, 98); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d7bd7c'; ctx.beginPath(); ctx.arc(90, 90, 5, 0, Math.PI * 2); ctx.stroke();
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
    nitroActive = Boolean(keys.KeyN && nitroFuel > 0);
    if (nitroActive) nitroFuel = Math.max(0, nitroFuel - 30 * dt);
    else nitroFuel = Math.min(100, nitroFuel + 8 * dt);

    vehiclePhysics.update(dt, {
      throttle: forward ? 1 : reverse ? -1 : 0,
      steer,
      brake: Boolean(keys.Space),
      nitro: nitroActive,
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
