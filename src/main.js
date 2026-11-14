import * as THREE from 'three';
import { OSMStreamer, CITY_ORIGIN } from './world/OSMStreamer.js';
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
for (const x of [-1.08, 1.08]) for (const z of [-1.36, 1.36]) {
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.48, z);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.28, 18), tireMat);
  tire.rotation.z = Math.PI / 2; tire.castShadow = true; wheel.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14), rimMat);
  rim.rotation.z = Math.PI / 2; wheel.add(rim);
  vehicle.add(wheel); wheels.push(wheel);
}
for (const x of [-0.68, 0.68]) addBox(vehicle, 0.38, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0xffe9ba }), x, 1.04, -2.16);

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
const toast = document.querySelector('#toast');
const streamer = new OSMStreamer(scene,
  status => {
    mapState.textContent = status.length > 22 ? status.slice(0, 20) + '…' : status;
    toast.textContent = status;
  },
  counts => {
    mapCounts.textContent = `${counts.chunks} chunks · ${counts.roads} roads · ${counts.buildings} buildings`;
  }
);

let speed = 0;
let heading = 0;
let missionDone = false;
let started = false;
let cameraYaw = 0;
let cameraPitch = 0.12;
const keys = Object.create(null);
addEventListener('keydown', event => {
  keys[event.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'KeyR') resetVehicle();
});
addEventListener('keyup', event => { keys[event.code] = false; });
function resetVehicle() {
  vehicle.position.set(0, 0, 0);
  speed = 0; heading = 0; vehicle.rotation.y = heading;
  streamer.requestAt(vehicle.position.x, vehicle.position.z);
}

let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', event => {
  dragging = true; lastX = event.clientX; lastY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });
renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging) return;
  cameraYaw -= (event.clientX - lastX) * 0.004;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + (event.clientY - lastY) * 0.002, -0.05, 0.55);
  lastX = event.clientX; lastY = event.clientY;
});

document.querySelector('#start').addEventListener('click', () => {
  started = true;
  document.querySelector('#start-screen').style.display = 'none';
  streamer.requestAt(vehicle.position.x, vehicle.position.z);
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
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  if (started) {
    const forward = keys.KeyW || keys.ArrowUp;
    const reverse = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft;
    const right = keys.KeyD || keys.ArrowRight;
    if (forward) speed += 22 * dt;
    else if (reverse) speed -= 16 * dt;
    else speed *= Math.pow(0.982, dt * 60);
    if (keys.Space) speed *= Math.pow(0.87, dt * 60);
    if (keys.ShiftLeft || keys.ShiftRight) speed += Math.sign(speed || 1) * 7 * dt;
    speed = THREE.MathUtils.clamp(speed, -12, 38);
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    if (Math.abs(speed) > 0.2) heading += steer * dt * (1.5 + Math.min(Math.abs(speed) / 24, 1.1)) * Math.sign(speed);
    vehicle.rotation.y = heading;
    vehicle.position.x -= Math.sin(heading) * speed * dt;
    vehicle.position.z -= Math.cos(heading) * speed * dt;
    wheels.forEach(wheel => { wheel.rotation.x -= speed * dt * 1.8; });
    mapCheckElapsed += dt;
    if (mapCheckElapsed > 1.5) {
      streamer.requestAt(vehicle.position.x, vehicle.position.z);
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
  }
  const target = new THREE.Vector3(vehicle.position.x, 2.1, vehicle.position.z);
  const distance = 13.5;
  const behind = new THREE.Vector3(Math.sin(heading + cameraYaw) * distance, 5.3 + cameraPitch * 10, Math.cos(heading + cameraYaw) * distance);
  const desired = target.clone().add(behind);
  camera.position.lerp(desired, 0.085);
  camera.lookAt(target.clone().add(new THREE.Vector3(0, 1.0, 0)));
  ring.rotation.z += dt * 0.7;
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
