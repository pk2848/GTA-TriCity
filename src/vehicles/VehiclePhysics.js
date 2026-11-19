import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const FIXED_STEP = 1 / 60;
const MAX_FRAME_STEP = 0.05;
const MODEL_ORIGIN_OFFSET = new THREE.Vector3(0, 0.9, 0);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const vec = (x, y, z) => ({ x, y, z });

export class VehiclePhysics {
  constructor() {
    this.ready = this.initialize();
    this.obstacleIds = new Set();
    this.obstacleBodies = [];
    this.maxObstacleBodies = 10000;
    this.steering = 0;
    this.speedMps = 0;
    this.heading = 0;
    this.engineMultiplier = 1;
    this.maxSpeed = 36;
    this.nitroMaxSpeed = 47;
    this.nitroBlend = 0;
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.accumulator = 0;
    this.wheelRadius = 0.43;
    this.wheelbase = 2.74;
    this.trackWidth = 1.76;
    this.mass = 1320;
    this.spawnPosition = { x: 0, z: 112 };
    this.wheelStates = [];
  }

  async initialize() {
    await RAPIER.init();
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World(vec(0, -9.82, 0));
    this.world.timestep = FIXED_STEP;
    this.groundCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(25000, 0.12, 25000)
        .setTranslation(0, -0.12, 0)
        .setFriction(0.9)
        .setRestitution(0)
    );
    this.createChassis();
    return this;
  }

  createChassis() {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.spawnPosition.x, 0.92, this.spawnPosition.z)
      .setLinearDamping(0.035)
      .setAngularDamping(0.82)
      .setCanSleep(false)
      .setCcdEnabled(true);
    this.chassisBody = this.world.createRigidBody(desc);
    this.chassisCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.02, 0.48, 2.05)
        .setDensity(this.mass / (2.04 * 0.96 * 4.1))
        .setFriction(0.65)
        .setRestitution(0),
      this.chassisBody
    );
    this.wheelStates = this.makeWheelStates();
  }

  makeWheelStates() {
    const out = [];
    for (const z of [-this.wheelbase / 2, this.wheelbase / 2]) {
      for (const x of [-this.trackWidth / 2, this.trackWidth / 2]) {
        out.push({ local: new THREE.Vector3(x, -0.08, z), steering: 0, rotation: 0, suspension: 0.42, grounded: false, world: new THREE.Vector3() });
      }
    }
    return out;
  }

  reset() {
    this.spawnPosition = this.spawnPosition || { x: 0, z: 112 };
    this.chassisBody.setTranslation(vec(this.spawnPosition.x, 0.92, this.spawnPosition.z), true);
    this.chassisBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.chassisBody.setLinvel(vec(0, 0, 0), true);
    this.chassisBody.setAngvel(vec(0, 0, 0), true);
    this.chassisBody.resetForces(true);
    this.chassisBody.resetTorques(true);
    this.steering = 0;
    this.speedMps = 0;
    this.heading = 0;
    this.nitroBlend = 0;
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.accumulator = 0;
    this.wheelStates.forEach(w => { w.rotation = 0; w.suspension = 0.42; w.grounded = false; });
  }

  spawnAt(x, z, heading = 0) {
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) throw new TypeError('Vehicle spawn coordinates must be finite numbers.');
    this.spawnPosition = { x: Number(x), z: Number(z) };
    this.reset();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Number(heading) || 0);
    this.chassisBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.heading = Number(heading) || 0;
  }

  setVehicleProfile(profile = {}) {
    const motorcycle = profile.vehicleType === 'motorcycle';
    const width = clamp(Number(profile.width) || 2.04, motorcycle ? 0.55 : 1.7, motorcycle ? 1.1 : 2.5);
    const length = clamp(Number(profile.length) || 4.1, motorcycle ? 1.5 : 3.8, motorcycle ? 2.7 : 5.8);
    const height = clamp(Number(profile.height) || 1, motorcycle ? 0.8 : 0.7, motorcycle ? 1.6 : 1.32);
    this.trackWidth = clamp(Number(profile.trackWidth) || width * 0.82, motorcycle ? 0.55 : 1.45, motorcycle ? 0.85 : 2);
    this.wheelbase = clamp(Number(profile.wheelbase) || 2.74, motorcycle ? 0.9 : 2.45, motorcycle ? 1.8 : 3.25);
    this.wheelRadius = clamp(Number(profile.wheelRadius) || 0.38, motorcycle ? 0.25 : 0.32, motorcycle ? 0.42 : 0.46);
    this.mass = motorcycle ? clamp(Number(profile.mass) || 260, 180, 360) : clamp(Number(profile.mass) || 1320, 900, 2200);
    this.world.removeCollider(this.chassisCollider, true);
    this.chassisCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2, length / 2)
        .setDensity(this.mass / (width * height * length))
        .setFriction(0.65),
      this.chassisBody
    );
    this.wheelStates = this.makeWheelStates();
    this.engineMultiplier = clamp(Number(profile.engineMultiplier) || 1, 0.65, 1.4);
    this.maxSpeed = clamp(Number(profile.maxSpeed) || 36, 25, 55);
    this.nitroMaxSpeed = clamp(Number(profile.nitroMaxSpeed) || 47, this.maxSpeed, 65);
    this.chassisBody.wakeUp();
  }

  update(deltaTime, controls = {}) {
    const dt = clamp(Number(deltaTime) || 0, 0, MAX_FRAME_STEP);
    if (!dt) return;
    const throttle = clamp(Number(controls.throttle) || 0, -1, 1);
    const steer = clamp(Number(controls.steer) || 0, -1, 1);
    const braking = Boolean(controls.brake);
    const nitro = Boolean(controls.nitro);
    const condition = clamp(Number(controls.condition ?? 100) / 100, 0.45, 1);
    const body = this.chassisBody;
    const rotation = body.rotation();
    const q = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const velocity = body.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const maxSteer = 0.48 / (1 + horizontalSpeed / 12);
    this.steering += (steer * maxSteer - this.steering) * Math.min(1, dt * 7);
    const nitroTarget = nitro && throttle > 0 ? 1 : 0;
    this.nitroBlend += (nitroTarget - this.nitroBlend) * Math.min(1, dt * 2.4);
    const engineForce = 7600 * condition * this.engineMultiplier * throttle * (1 + this.nitroBlend * 0.13) * (controls.boost ? 1.05 : 1);
    const speedAlong = velocity.x * forward.x + velocity.z * forward.z;
    const wheelOffsets = this.wheelStates;
    const origin = body.translation();
    let grounded = 0;

    for (let i = 0; i < wheelOffsets.length; i++) {
      const wheel = wheelOffsets[i];
      const local = wheel.local.clone();
      if (i < 2) local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.steering);
      const worldOffset = local.clone().applyQuaternion(q);
      const wheelOrigin = new THREE.Vector3(origin.x, origin.y, origin.z).add(worldOffset);
      const rayOrigin = vec(wheelOrigin.x, wheelOrigin.y, wheelOrigin.z);
      const rayDir = vec(0, -1, 0);
      const ray = new RAPIER.Ray(rayOrigin, rayDir);
      const hit = this.world.castRay(ray, 1.55, true, undefined, undefined, undefined, body);
      wheel.grounded = Boolean(hit);
      if (hit) {
        grounded++;
        const suspensionLength = clamp(hit.timeOfImpact - this.wheelRadius, 0.12, 0.68);
        wheel.suspension = suspensionLength;
        const compression = Math.max(0, 0.42 - suspensionLength);
        const pointVelocity = body.velocityAtPoint(rayOrigin);
        const spring = clamp(compression * 52000 - pointVelocity.y * 4600, 0, 72000);
        const contactPoint = new THREE.Vector3(rayOrigin.x, rayOrigin.y - hit.timeOfImpact, rayOrigin.z);
        body.addForceAtPoint(vec(0, spring, 0), vec(contactPoint.x, contactPoint.y, contactPoint.z), true);
        const wheelForward = forward.clone();
        if (i < 2) wheelForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.steering);
        const wheelRight = right.clone();
        const lateralSpeed = pointVelocity.x * wheelRight.x + pointVelocity.z * wheelRight.z;
        const lateralImpulse = clamp(-lateralSpeed * this.mass * 0.22, -this.mass * 2.8, this.mass * 2.8);
        body.addImpulseAtPoint(vec(wheelRight.x * lateralImpulse * dt, 0, wheelRight.z * lateralImpulse * dt), vec(contactPoint.x, contactPoint.y, contactPoint.z), true);
        const drive = i >= 2 ? engineForce / 2 : 0;
        const rollingBrake = braking ? 9800 : (throttle === 0 ? 110 : 0);
        const traction = drive - Math.sign(speedAlong || throttle) * rollingBrake;
        body.addForceAtPoint(vec(wheelForward.x * traction, 0, wheelForward.z * traction), vec(contactPoint.x, contactPoint.y, contactPoint.z), true);
        wheel.rotation += speedAlong * dt / this.wheelRadius;
      } else {
        wheel.suspension = 0.42;
      }
      wheel.world.copy(wheelOrigin).add(new THREE.Vector3(0, -wheel.suspension, 0));
    }

    // Apply steering yaw only while tyres have grip; the chassis remains a real rigid body.
    if (grounded >= 2 && Math.abs(speedAlong) > 0.2) {
      const yawTorque = -this.steering * speedAlong * 430;
      body.addTorque(vec(0, yawTorque, 0), true);
    }
    if (grounded >= 2) body.addForce(vec(0, -Math.min(2600, horizontalSpeed * horizontalSpeed * 2.25), 0), true);
    if (!throttle && !braking && horizontalSpeed > 0.15) {
      body.setLinvel(vec(velocity.x * (1 - Math.min(0.035 * dt, 0.002)), velocity.y, velocity.z * (1 - Math.min(0.035 * dt, 0.002))), true);
    }
    this.accumulator += dt;
    while (this.accumulator >= FIXED_STEP) {
      this.world.timestep = FIXED_STEP;
      this.world.step();
      this.accumulator -= FIXED_STEP;
    }

    const current = body.linvel();
    const speed = Math.hypot(current.x, current.z);
    const speedCap = this.maxSpeed + (this.nitroMaxSpeed - this.maxSpeed) * this.nitroBlend;
    if (speed > speedCap) body.setLinvel(vec(current.x * speedCap / speed, current.y, current.z * speedCap / speed), true);
    const r = body.rotation();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    this.speedMps = current.x * f.x + current.z * f.z;
    this.heading = Math.atan2(-f.x, -f.z);
    this.rolloverTimer = up.y < 0.18 || body.translation().y < -1 ? this.rolloverTimer + dt : Math.max(0, this.rolloverTimer - dt * 2);
    this.isUpsideDown = this.rolloverTimer > 1;
  }

  syncVisuals(chassisObject, wheelObjects = []) {
    const p = this.chassisBody.translation();
    const r = this.chassisBody.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const offset = MODEL_ORIGIN_OFFSET.clone().applyQuaternion(q);
    chassisObject.position.set(p.x - offset.x, p.y - offset.y, p.z - offset.z);
    chassisObject.quaternion.copy(q);
    for (let i = 0; i < Math.min(wheelObjects.length, this.wheelStates.length); i++) {
      const state = this.wheelStates[i];
      const position = state.world;
      wheelObjects[i].position.copy(position);
      const steering = i < 2 ? this.steering : 0;
      wheelObjects[i].quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), steering));
      wheelObjects[i].rotateX(state.rotation);
    }
  }

  addBuildingObstacles(obstacles = [], tileKey = '') {
    let added = 0;
    for (const obstacle of obstacles) {
      if (this.obstacleBodies.length >= this.maxObstacleBodies) break;
      const id = String(obstacle.id || `${tileKey}:${obstacle.x}:${obstacle.z}`);
      if (this.obstacleIds.has(id)) continue;
      const width = Number(obstacle.width), depth = Number(obstacle.depth), height = Number(obstacle.height);
      if (![obstacle.x, obstacle.z, width, depth, height].every(Number.isFinite)) continue;
      if (width < 2.2 || depth < 2.2 || width > 500 || depth > 500 || height < 2.5) continue;
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
        .setTranslation(Number(obstacle.x), (Number(obstacle.minHeight) || 0) + height / 2, Number(obstacle.z))
        .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Number(obstacle.yaw) || 0)));
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setFriction(0.8).setRestitution(0),
        body
      );
      collider.userData = { kind: 'building', osmId: id };
      this.obstacleIds.add(id);
      this.obstacleBodies.push({ body, collider, id, x: Number(obstacle.x), z: Number(obstacle.z), width, depth, height, minHeight: Number(obstacle.minHeight) || 0, yaw: Number(obstacle.yaw) || 0 });
      added++;
    }
    return added;
  }

  isBuildingBlocked(x, z, radius = 0.35, height = 2.2, baseY = 0) {
    if (![x, z, radius, height, baseY].every(Number.isFinite)) return false;
    const topY = baseY + height;
    for (const obstacle of this.obstacleBodies) {
      if (topY <= obstacle.minHeight || baseY >= obstacle.minHeight + obstacle.height) continue;
      const dx = x - obstacle.x, dz = z - obstacle.z;
      const c = Math.cos(obstacle.yaw), s = Math.sin(obstacle.yaw);
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (Math.abs(lx) <= obstacle.width / 2 + radius && Math.abs(lz) <= obstacle.depth / 2 + radius) return true;
    }
    return false;
  }

  stop() {
    this.chassisBody.setLinvel(vec(0, 0, 0), true);
    this.chassisBody.setAngvel(vec(0, 0, 0), true);
    this.chassisBody.resetForces(true);
    this.chassisBody.resetTorques(true);
  }

  recoverUpright() {
    const p = this.chassisBody.translation();
    this.chassisBody.setTranslation(vec(p.x, 1.08, p.z), true);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading || 0);
    this.chassisBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.chassisBody.setLinvel(vec(0, 0, 0), true);
    this.chassisBody.setAngvel(vec(0, 0, 0), true);
    this.chassisBody.resetForces(true);
    this.chassisBody.resetTorques(true);
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.speedMps = 0;
  }

  applyImpact(intensity = 0.5, direction = 1) {
    const amount = clamp(intensity, 0, 1);
    const v = this.chassisBody.linvel();
    this.chassisBody.setLinvel(vec(v.x * (1 - amount * 0.74), v.y, v.z * (1 - amount * 0.74)), true);
    this.chassisBody.applyTorqueImpulse(vec(0, direction * amount * 0.85 * this.mass, 0), true);
    this.chassisBody.wakeUp();
  }

  getSpeedKmh() { return Math.abs(this.speedMps) * 3.6; }
  getHeading() { return this.heading; }

  dispose() {
    if (!this.world) return;
    for (const obstacle of this.obstacleBodies) this.world.removeRigidBody(obstacle.body);
    this.obstacleBodies.length = 0;
    this.obstacleIds.clear();
    this.world.free();
  }
}
