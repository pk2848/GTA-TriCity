import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET_BASE = import.meta.env.BASE_URL || '/';
const MANIFEST_URL = `${ASSET_BASE}models/vehicles/manifest.json`;

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

function removeEmbeddedCameras(root) {
  const cameras = [];
  root.traverse((object) => {
    if (object.isCamera) cameras.push(object);
  });
  cameras.forEach((camera) => camera.parent?.remove(camera));
}

function normalizeProfile(entry) {
  const fileName = String(entry.file || entry.filename || '').split('/').pop();
  if (!fileName || !fileName.toLowerCase().endsWith('.glb')) {
    throw new Error(`Vehicle entry "${entry.id || entry.model || 'unknown'}" needs a .glb file name.`);
  }
  const wheelGroupPattern = entry.wheelGroupPattern
    ? new RegExp(entry.wheelGroupPattern, 'i')
    : null;
  return {
    ...entry,
    id: String(entry.id || fileName.replace(/\.glb$/i, '').toLowerCase()),
    brand: String(entry.brand || 'Other'),
    model: String(entry.model || fileName.replace(/\.glb$/i, '')),
    displayName: String(entry.displayName || `${entry.brand || 'Vehicle'} ${entry.model || fileName}`),
    file: `${ASSET_BASE}models/vehicles/${fileName}`,
    scale: Number(entry.scale) || 1,
    rotation: Array.isArray(entry.rotation) && entry.rotation.length === 3
      ? entry.rotation.map(Number)
      : [0, 0, 0],
    riderPosition: Array.isArray(entry.riderPosition) && entry.riderPosition.length === 3
      ? entry.riderPosition.map(Number)
      : [0, 0.35, 0.12],
    riderLean: Number(entry.riderLean) || 0.14,
    wheelGroupPattern,
    wheelRadius: Number(entry.wheelRadius) || 0.38,
    physics: entry.physics || {}
  };
}

function createWheelPivots(assetRoot, profile) {
  if (!profile.wheelGroupPattern) return [];

  const groups = new Map();
  assetRoot.traverse((object) => {
    if (!object.isMesh || !object.name) return;
    const match = object.name.match(profile.wheelGroupPattern);
    if (!match) return;
    const groupKey = match[1] || match[0];
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(object);
  });

  const pivots = [];
  for (const [groupKey, objects] of groups) {
    assetRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    for (const object of objects) bounds.union(new THREE.Box3().setFromObject(object));
    if (bounds.isEmpty()) continue;

    const centerLocal = assetRoot.worldToLocal(bounds.getCenter(new THREE.Vector3()));
    const pivot = new THREE.Group();
    pivot.name = `wheel-pivot-${groupKey}`;
    pivot.position.copy(centerLocal);
    assetRoot.add(pivot);

    // Move all tyre/rim pieces for this wheel together and preserve their world transforms.
    for (const object of objects) pivot.attach(object);
    pivots.push({
      pivot,
      front: /LF|RF|FRONT/i.test(groupKey)
    });
  }
  return pivots;
}

export class VehicleGarage {
  constructor({
    vehicle,
    physics,
    selector,
    statusElement,
    fallbackParts = [],
    wheelVisuals = [],
    nitroFlames = null,
    retryButton = null,
    countElement = null,
    rider = null,
    isDriving = () => false,
    canSelect = () => true,
    onSelected = () => {}
  }) {
    this.vehicle = vehicle;
    this.physics = physics;
    this.selector = selector;
    this.statusElement = statusElement;
    this.fallbackParts = fallbackParts;
    this.wheelVisuals = wheelVisuals;
    this.nitroFlames = nitroFlames;
    this.retryButton = retryButton;
    this.countElement = countElement;
    this.rider = rider;
    this.isDriving = isDriving;
    this.riderPoseApplied = false;
    this._riderOffset = new THREE.Vector3();
    this.canSelect = canSelect;
    this.onSelected = onSelected;
    this.loader = new GLTFLoader();
    this.catalog = [];
    this.activeId = null;
    this.activeSlot = null;
    this.activeWheels = [];
    this.requestId = 0;
    this.loading = false;
    this.pendingSelection = null;

    // No procedural player-car is rendered. Only a GLB listed in the public manifest
    // can make the player vehicle visible.
    this.vehicle.visible = false;
    this.fallbackParts.forEach((part) => { part.visible = false; });
    this.wheelVisuals.forEach((wheel) => { wheel.visible = false; });
    if (this.nitroFlames) this.nitroFlames.visible = false;

    if (this.selector) {
      this.selector.disabled = true;
      this.selector.replaceChildren(new Option('Loading uploaded vehicles…', ''));
      this.selector.addEventListener('change', () => {
        this.selectVehicle(this.selector.value);
      });
    }
    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => {
        const selected = this.selector?.value || this.activeId;
        if (selected) this.selectVehicle(selected, { force: true });
      });
    }

    this.initialize();
  }

  setStatus(message, state = 'idle', detail = '') {
    if (!this.statusElement) return;
    this.statusElement.textContent = message;
    this.statusElement.dataset.state = state;
    this.statusElement.title = detail || message;
    this.statusElement.setAttribute('aria-label', detail ? `${message}. ${detail}` : message);
  }

  buildSelector() {
    if (!this.selector) return;
    this.selector.replaceChildren();
    const brands = new Map();
    for (const profile of this.catalog) {
      if (!brands.has(profile.brand)) brands.set(profile.brand, []);
      brands.get(profile.brand).push(profile);
    }
    for (const [brand, profiles] of brands) {
      const group = document.createElement('optgroup');
      group.label = brand.toUpperCase();
      for (const profile of profiles) {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.model;
        group.appendChild(option);
      }
      this.selector.appendChild(group);
    }
    this.selector.disabled = this.catalog.length === 0;
    if (this.countElement) this.countElement.textContent = `${this.catalog.length} VEHICLES`;
  }

  async initialize() {
    this.setStatus('READING UPLOADED VEHICLE ASSETS…', 'loading');
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Vehicle manifest request failed: HTTP ${response.status}`);
      const manifest = await response.json();
      if (!Array.isArray(manifest.vehicles) || manifest.vehicles.length === 0) {
        throw new Error('manifest.json has no vehicles array entries.');
      }
      this.catalog = manifest.vehicles.map(normalizeProfile);
      this.buildSelector();
      const defaultId = manifest.defaultVehicle && this.catalog.some((item) => item.id === manifest.defaultVehicle)
        ? manifest.defaultVehicle
        : this.catalog[0].id;
      if (this.selector) this.selector.value = defaultId;
      await this.selectVehicle(defaultId, { initial: true });
    } catch (error) {
      console.error('[GTA-TriCity] Vehicle manifest failed to load', error);
      this.vehicle.visible = false;
      this.setStatus('VEHICLE ASSET LIST FAILED', 'error', error?.message || String(error));
      if (this.selector) this.selector.disabled = true;
      if (this.retryButton) {
        this.retryButton.textContent = 'CHECK VEHICLE MANIFEST';
        this.retryButton.disabled = true;
      }
    }
  }

  async selectVehicle(id, { initial = false, force = false } = {}) {
    const profile = this.catalog.find((item) => item.id === id);
    if (!profile) return;
    if (this.loading) {
      // Keep the selector interactive while a large GLB loads. The last chosen
      // vehicle is queued and loaded immediately after the current request ends.
      this.pendingSelection = id;
      this.setStatus(`QUEUED · ${profile.brand.toUpperCase()} ${profile.model.toUpperCase()}`, 'loading');
      return;
    }
    if (!initial && !this.canSelect()) {
      if (this.selector) this.selector.value = this.activeId || id;
      this.setStatus('STOP THE VEHICLE BEFORE SWITCHING', 'warning');
      return;
    }
    if (id === this.activeId && !force) return;

    const request = ++this.requestId;
    this.loading = true;
    if (this.selector) this.selector.disabled = false;
    if (this.retryButton) {
      this.retryButton.disabled = true;
      this.retryButton.textContent = 'LOADING MODEL…';
    }
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
      let bounds = new THREE.Box3().setFromObject(assetRoot);
      if (bounds.isEmpty()) throw new Error('The GLB contains no visible mesh geometry.');
      let size = bounds.getSize(new THREE.Vector3());

      // Some supplied vehicle scans are authored with the long axis on X.
      // Preserve the manifest's up-axis correction, then try yaw-only alignment
      // so the longest horizontal dimension points down the game's -Z road axis.
      const isMotorcycle = profile.physics?.vehicleType === 'motorcycle';
      const validAxes = (dimensions) => isMotorcycle
        ? (dimensions.x >= 0.55 && dimensions.x <= 1.3 &&
           dimensions.y >= 0.95 && dimensions.y <= 1.7 &&
           dimensions.z >= 1.55 && dimensions.z <= 2.55)
        : (dimensions.z >= dimensions.y * 1.45 && dimensions.z >= dimensions.x * 1.45);
      if (!validAxes(size) && !isMotorcycle) {
        const baseYaw = profile.rotation[1];
        for (const yawOffset of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
          assetRoot.rotation.y = baseYaw + yawOffset;
          assetRoot.updateMatrixWorld(true);
          const candidateBounds = new THREE.Box3().setFromObject(assetRoot);
          const candidateSize = candidateBounds.getSize(new THREE.Vector3());
          if (validAxes(candidateSize)) {
            bounds = candidateBounds;
            size = candidateSize;
            console.warn(`[GTA-TriCity] Auto-corrected ${profile.displayName} yaw by ${Math.round(yawOffset * 180 / Math.PI)} degrees.`);
            break;
          }
        }
      }
      if (!validAxes(size)) {
        const bikeHint = isMotorcycle
          ? 'Check the optimized bike GLB orientation and scale in public/models/vehicles/manifest.json.'
          : 'The GLB dimensions do not match a road car after automatic yaw correction.';
        throw new Error(
          `Vehicle dimensions are not game-ready. Expected Y-up and nose along local -Z; ` +
          `got X=${size.x.toFixed(2)}m, Y=${size.y.toFixed(2)}m, Z=${size.z.toFixed(2)}m. ${bikeHint}`
        );
      }

      console.info(
        `[GTA-TriCity] ${profile.displayName} aligned bounds: ` +
        `X=${size.x.toFixed(2)}m, Y=${size.y.toFixed(2)}m, Z=${size.z.toFixed(2)}m` +
        (isMotorcycle ? ' (motorcycle scan bounds; not a clean tyre-to-tyre measurement)' : '')
      );

      const minY = bounds.min.y;
      assetRoot.position.set(-center.x, 0.055 - minY, -center.z);
      const wheelPivots = createWheelPivots(assetRoot, profile);

      const slot = new THREE.Group();
      slot.name = `active-car-${profile.id}`;
      slot.add(assetRoot);
      this.vehicle.add(slot);

      const oldSlot = this.activeSlot;
      this.activeSlot = slot;
      this.activeWheels = wheelPivots;
      this.activeId = profile.id;
      this.physics?.setVehicleProfile?.({
        ...profile.physics,
        wheelRadius: profile.wheelRadius
      });

      if (oldSlot) {
        this.vehicle.remove(oldSlot);
        disposeModel(oldSlot);
      }

      this.vehicle.visible = true;
      this.fallbackParts.forEach((part) => { part.visible = false; });
      this.wheelVisuals.forEach((wheel) => { wheel.visible = false; });
      if (this.nitroFlames) this.nitroFlames.visible = false;
      if (this.selector) {
        this.selector.value = profile.id;
        this.selector.disabled = false;
      }
      this.vehicle.userData.assetLoaded = true;
      this.vehicle.userData.assetName = profile.displayName;
      this.setStatus(`READY · ${profile.brand.toUpperCase()} ${profile.model.toUpperCase()}`, 'ready');
      if (this.retryButton) {
        this.retryButton.textContent = 'RELOAD SELECTED MODEL';
        this.retryButton.disabled = false;
      }
      this.onSelected(profile);
    } catch (error) {
      console.error(`[GTA-TriCity] Failed to load ${profile.displayName}`, error);
      if (this.selector) {
        this.selector.value = this.activeId || profile.id;
        this.selector.disabled = false;
      }
      const message = error?.message || error?.target?.statusText || String(error);
      this.setStatus(
        `LOAD FAILED · ${profile.displayName.toUpperCase()}`,
        'error',
        `Asset: ${profile.file} · Error: ${message}`
      );
      this.vehicle.visible = Boolean(this.activeSlot);
      if (this.retryButton) {
        this.retryButton.textContent = 'RETRY MODEL LOAD';
        this.retryButton.disabled = false;
      }
    } finally {
      if (request === this.requestId) {
        this.loading = false;
        if (this.selector) this.selector.disabled = false;
        if (this.retryButton) this.retryButton.disabled = false;
        const queuedId = this.pendingSelection;
        this.pendingSelection = null;
        if (queuedId && queuedId !== this.activeId) {
          queueMicrotask(() => this.selectVehicle(queuedId));
        }
      }
    }
  }

  applyRiderPose() {
    if (!this.rider || this.riderPoseApplied) return;
    const limbs = this.rider.userData.limbs;
    if (limbs) {
      // Arms reach the handlebars; knees bend toward the foot pegs.
      limbs.arms.forEach(arm => { arm.rotation.set(1.18, 0, 0); });
      limbs.legs.forEach(leg => { leg.rotation.set(0.72, 0, 0); });
    }
    this.riderPoseApplied = true;
  }

  resetRiderPose() {
    if (!this.rider) return;
    const limbs = this.rider.userData.limbs;
    if (limbs) {
      limbs.arms.forEach(arm => { arm.rotation.set(0, 0, 0); });
      limbs.legs.forEach(leg => { leg.rotation.set(0, 0, 0); });
    }
    this.riderPoseApplied = false;
  }

  syncRider() {
    if (!this.rider || !this.isDriving()) return;
    const profile = this.getActiveProfile();
    const isMotorcycle = profile?.physics?.vehicleType === 'motorcycle';
    if (!isMotorcycle) {
      this.rider.visible = false;
      this.resetRiderPose();
      return;
    }

    this.applyRiderPose();
    const offset = profile.riderPosition || [0, 0.35, 0.12];
    this._riderOffset.set(offset[0], offset[1], offset[2]).applyQuaternion(this.vehicle.quaternion);
    this.rider.position.copy(this.vehicle.position).add(this._riderOffset);
    this.rider.quaternion.copy(this.vehicle.quaternion);
    this.rider.rotateX(profile.riderLean || 0.14);
    const speedLean = THREE.MathUtils.clamp(Math.abs(this.physics?.speedMps || 0) / 18, 0, 1);
    const turnLean = -(this.physics?.steering || 0) * speedLean * 0.22;
    this.rider.rotateZ(turnLean);
    this.rider.visible = true;
  }

  update(deltaTime) {
    if (this.activeWheels.length && this.physics) {
      const profile = this.catalog.find((item) => item.id === this.activeId);
      const radius = profile?.wheelRadius || 0.38;
      const roll = -this.physics.speedMps * deltaTime / radius;
      const steer = this.physics.steering || 0;
      for (const wheel of this.activeWheels) {
        wheel.pivot.rotation.x += roll;
        wheel.pivot.rotation.y = wheel.front ? steer : 0;
      }
    }
    this.syncRider();
  }

  getActiveProfile() {
    return this.catalog.find((item) => item.id === this.activeId) || null;
  }
}
