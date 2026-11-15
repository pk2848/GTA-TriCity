import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VEHICLE_CATALOG = [
  {
    id: 'pagani-zonda-cinque',
    brand: 'Pagani',
    model: 'Zonda Cinque',
    displayName: 'Pagani Zonda Cinque',
    file: '/models/vehicles/pagani-zonda-cinque.glb',
    scale: 1,
    rotation: [0, Math.PI, 0],
    wheelPattern: null,
    wheelRadius: 0.36,
    physics: { width: 2.09, length: 4.43, wheelbase: 2.73, trackWidth: 1.76, engineMultiplier: 1.18, maxSpeed: 39, nitroMaxSpeed: 50 }
  },
  {
    id: 'dodge-charger-1970',
    brand: 'Dodge',
    model: 'Charger R/T (1970) · Fast & Furious',
    displayName: '1970 Dodge Charger R/T',
    file: '/models/vehicles/1970-dodge-charger-rt.glb',
    scale: 1,
    // Source scene is Z-up with its nose along +Y; convert to Y-up, then face -Z.
    rotation: [-Math.PI / 2, Math.PI, 0],
    wheelPattern: /^Wheel1A_(LF|RF|LR|RR)$/,
    wheelRadius: 0.39,
    physics: { width: 1.99, length: 5.27, wheelbase: 2.95, trackWidth: 1.61, engineMultiplier: 0.96, maxSpeed: 34, nitroMaxSpeed: 43 }
  },
  {
    id: 'dodge-challenger-2015',
    brand: 'Dodge',
    model: 'Challenger R/T (2015) · Tuned + Armor',
    displayName: '2015 Dodge Challenger R/T',
    file: '/models/vehicles/2015-dodge-challenger-rt.glb',
    // This Sketchfab GLB is authored at centimetre scale: multiply by 100 to get metres.
    scale: 100,
    rotation: [0, Math.PI, 0],
    wheelPattern: /^3DWheel (Front|Rear) [LR]_/,
    wheelRadius: 0.38,
    physics: { width: 2.18, length: 5.27, wheelbase: 2.95, trackWidth: 1.78, engineMultiplier: 1.04, maxSpeed: 37, nitroMaxSpeed: 47 }
  }
];

function disposeModel(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (!object.material) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value && value.isTexture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

function getWheelNames(pattern, root) {
  if (!pattern) return [];
  const found = [];
  root.traverse((object) => {
    if (object.name && pattern.test(object.name)) found.push(object);
  });
  return found.slice(0, 4);
}

function createWheelPivots(assetRoot, profile) {
  const objects = getWheelNames(profile.wheelPattern, assetRoot);
  const pivots = [];
  for (const wheelObject of objects) {
    assetRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(wheelObject);
    if (bounds.isEmpty()) continue;
    const centerWorld = bounds.getCenter(new THREE.Vector3());
    const centerLocal = assetRoot.worldToLocal(centerWorld.clone());

    const pivot = new THREE.Group();
    pivot.name = `wheel-pivot-${wheelObject.name}`;
    pivot.position.copy(centerLocal);
    assetRoot.add(pivot);
    // Reparent while preserving the wheel's world transform, so its origin is at the axle.
    pivot.attach(wheelObject);
    pivots.push({
      pivot,
      front: /Front|_L[F]|_R[F]/i.test(wheelObject.name)
    });
  }
  return pivots;
}

function removeEmbeddedCameras(root) {
  const cameras = [];
  root.traverse((object) => {
    if (object.isCamera) cameras.push(object);
  });
  cameras.forEach((camera) => camera.parent?.remove(camera));
}

export class VehicleGarage {
  constructor({
    vehicle,
    physics,
    selector,
    statusElement,
    fallbackParts = [],
    nitroFlames = null,
    canSelect = () => true,
    onSelected = () => {}
  }) {
    this.vehicle = vehicle;
    this.physics = physics;
    this.selector = selector;
    this.statusElement = statusElement;
    this.fallbackParts = fallbackParts;
    this.nitroFlames = nitroFlames;
    this.canSelect = canSelect;
    this.onSelected = onSelected;
    this.loader = new GLTFLoader();
    this.activeId = null;
    this.activeSlot = null;
    this.activeWheels = [];
    this.requestId = 0;
    this.loading = false;

    if (this.selector) {
      this.selector.addEventListener('change', () => {
        this.selectVehicle(this.selector.value);
      });
      this.selector.value = VEHICLE_CATALOG[0].id;
    }

    this.selectVehicle(VEHICLE_CATALOG[0].id, { initial: true });
  }

  setStatus(message, state = 'idle') {
    if (!this.statusElement) return;
    this.statusElement.textContent = message;
    this.statusElement.dataset.state = state;
  }

  async selectVehicle(id, { initial = false } = {}) {
    const profile = VEHICLE_CATALOG.find((item) => item.id === id);
    if (!profile || this.loading) return;
    if (!initial && !this.canSelect()) {
      if (this.selector) this.selector.value = this.activeId || VEHICLE_CATALOG[0].id;
      this.setStatus('STOP THE CAR TO CHANGE VEHICLE', 'warning');
      return;
    }
    if (id === this.activeId) return;

    const request = ++this.requestId;
    this.loading = true;
    if (this.selector) this.selector.disabled = true;
    this.setStatus(`LOADING · ${profile.brand.toUpperCase()} ${profile.model.toUpperCase()}`, 'loading');

    try {
      const gltf = await this.loader.loadAsync(profile.file);
      if (request !== this.requestId) {
        disposeModel(gltf.scene);
        return;
      }

      const assetRoot = new THREE.Group();
      assetRoot.name = `vehicle-asset-${profile.id}`;
      assetRoot.rotation.set(...profile.rotation);
      assetRoot.scale.setScalar(profile.scale);
      removeEmbeddedCameras(gltf.scene);
      assetRoot.add(gltf.scene);

      assetRoot.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = true;
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { material.needsUpdate = true; });
        }
      });

      assetRoot.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(assetRoot);
      if (bounds.isEmpty()) throw new Error('The GLB contains no visible mesh geometry.');
      const center = bounds.getCenter(new THREE.Vector3());
      const minY = bounds.min.y;

      // Put each model on the same ground plane and centre it on the physics chassis.
      assetRoot.position.set(-center.x, 0.055 - minY, -center.z);
      const wheelPivots = createWheelPivots(assetRoot, profile);

      const slot = new THREE.Group();
      slot.name = `active-car-${profile.id}`;
      slot.add(assetRoot);
      this.vehicle.add(slot);

      if (this.activeSlot) {
        this.vehicle.remove(this.activeSlot);
        disposeModel(this.activeSlot);
      }

      this.activeSlot = slot;
      this.activeWheels = wheelPivots;
      this.activeId = profile.id;
      this.physics?.setVehicleProfile?.(profile.physics);

      // Switch away from the placeholder only after the new GLB has loaded successfully.
      this.fallbackParts.forEach((part) => { part.visible = false; });
      if (this.nitroFlames) this.nitroFlames.visible = false;
      if (this.selector) this.selector.value = profile.id;
      this.vehicle.userData.assetLoaded = true;
      this.vehicle.userData.assetName = profile.displayName;
      this.setStatus(`READY · ${profile.brand.toUpperCase()} ${profile.model.toUpperCase()}`, 'ready');
      this.onSelected(profile);
    } catch (error) {
      console.error(`[GTA-TriCity] Failed to load ${profile.displayName}`, error);
      if (this.selector) this.selector.value = this.activeId || VEHICLE_CATALOG[0].id;
      const fallbackName = this.activeId
        ? VEHICLE_CATALOG.find((item) => item.id === this.activeId)?.displayName
        : 'procedural starter vehicle';
      this.setStatus(`LOAD FAILED · KEEPING ${fallbackName?.toUpperCase() || 'STARTER CAR'}`, 'error');
      if (!this.activeSlot) this.fallbackParts.forEach((part) => { part.visible = true; });
    } finally {
      if (request === this.requestId) {
        this.loading = false;
        if (this.selector) this.selector.disabled = false;
      }
    }
  }

  update(deltaTime) {
    if (!this.activeWheels.length || !this.physics) return;
    const radius = VEHICLE_CATALOG.find((item) => item.id === this.activeId)?.wheelRadius || 0.38;
    const roll = -this.physics.speedMps * deltaTime / radius;
    const steer = this.physics.steering || 0;
    for (const wheel of this.activeWheels) {
      wheel.pivot.rotation.x += roll;
      wheel.pivot.rotation.y = wheel.front ? steer * 0.42 : 0;
    }
  }

  getActiveProfile() {
    return VEHICLE_CATALOG.find((item) => item.id === this.activeId) || null;
  }
}
