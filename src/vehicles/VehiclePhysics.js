import * as CANNON from 'cannon-es';

const FIXED_STEP = 1 / 60;
const MODEL_ORIGIN_OFFSET = new CANNON.Vec3(0, 1, 0);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class VehiclePhysics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 12;
    this.world.defaultContactMaterial.friction = 0.42;
    this.world.defaultContactMaterial.restitution = 0;

    this.groundMaterial = new CANNON.Material('city-ground');
    this.tireMaterial = new CANNON.Material('vehicle-tires');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.tireMaterial, this.groundMaterial, {
      friction: 0.72,
      restitution: 0,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3
    }));

    const ground = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);

    this.chassisBody = new CANNON.Body({
      mass: 1280,
      material: this.groundMaterial,
      linearDamping: 0.055,
      angularDamping: 0.42,
      allowSleep: false
    });
    this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1.02, 0.43, 2.05)));
    this.chassisBody.position.set(0, 1.02, 0);
    this.chassisBody.updateMassProperties();

    this.raycastVehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    });

    const wheelOptions = {
      radius: 0.43,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 36,
      suspensionRestLength: 0.43,
      frictionSlip: 3.9,
      dampingRelaxation: 2.5,
      dampingCompression: 4.8,
      maxSuspensionForce: 140000,
      maxSuspensionTravel: 0.28,
      rollInfluence: 0.075,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      customSlidingRotationalSpeed: -22,
      useCustomSlidingRotationalSpeed: true
    };

    // Front wheels steer. Rear wheels receive engine force.
    const wheelConnections = [
      [-0.88, -0.16, -1.38],
      [0.88, -0.16, -1.38],
      [-0.88, -0.16, 1.36],
      [0.88, -0.16, 1.36]
    ];
    wheelConnections.forEach(([x, y, z], index) => {
      wheelOptions.chassisConnectionPointLocal.set(x, y, z);
      wheelOptions.isFrontWheel = index < 2;
      this.raycastVehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(x, y, z) });
    });
    this.raycastVehicle.addToWorld(this.world);

    this.steering = 0;
    this.speedMps = 0;
    this.heading = 0;
    this.nitroMultiplier = 1;
    this.accumulator = 0;
    this.obstacleIds = new Set();
    this.obstacleBodies = [];
    this.reset();
  }

  reset() {
    this.chassisBody.position.set(0, 1.02, 0);
    this.chassisBody.quaternion.set(0, 0, 0, 1);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.force.set(0, 0, 0);
    this.chassisBody.torque.set(0, 0, 0);
    this.steering = 0;
    this.speedMps = 0;
    this.heading = 0;
  }

  update(deltaTime, controls = {}) {
    const dt = clamp(deltaTime, 0, 0.05);
    const throttle = clamp(Number(controls.throttle) || 0, -1, 1);
    const steer = clamp(Number(controls.steer) || 0, -1, 1);
    const braking = Boolean(controls.brake);
    const nitro = Boolean(controls.nitro);
    const condition = clamp(Number(controls.condition ?? 100) / 100, 0.45, 1);

    const maxSteer = 0.48;
    const targetSteering = steer * maxSteer;
    this.steering += (targetSteering - this.steering) * Math.min(1, dt * 5.8);
    this.raycastVehicle.setSteeringValue(this.steering, 0);
    this.raycastVehicle.setSteeringValue(this.steering, 1);

    const baseEngineForce = 5200 * condition * (controls.boost ? 1.16 : 1);
    const engineForce = throttle * baseEngineForce * (nitro && throttle > 0 ? 1.85 : 1);
    this.raycastVehicle.applyEngineForce(-engineForce, 2);
    this.raycastVehicle.applyEngineForce(-engineForce, 3);

    const serviceBrake = braking ? 9800 : (throttle === 0 ? 240 : 0);
    for (let i = 0; i < 4; i++) this.raycastVehicle.setBrake(serviceBrake, i);

    // Fixed-step integration keeps suspension behaviour stable across frame rates.
    this.world.step(FIXED_STEP, dt, 4);

    const forward = new CANNON.Vec3(0, 0, -1);
    this.chassisBody.quaternion.vmult(forward, forward);
    this.speedMps = this.chassisBody.velocity.dot(forward);
    this.heading = Math.atan2(-forward.x, -forward.z);

    const speedCap = nitro ? 47 : 36;
    const speed = this.chassisBody.velocity.length();
    if (speed > speedCap) {
      const scale = speedCap / speed;
      this.chassisBody.velocity.scale(scale, this.chassisBody.velocity);
    }

    // Small aerodynamic drag and steering stabilization at speed.
    if (!throttle && !braking && speed > 0.15) {
      const drag = Math.min(0.035 * dt, 0.002);
      this.chassisBody.velocity.scale(1 - drag, this.chassisBody.velocity);
    }
  }

  syncVisuals(chassisObject, wheelObjects = []) {
    const offset = new CANNON.Vec3();
    this.chassisBody.quaternion.vmult(MODEL_ORIGIN_OFFSET, offset);
    chassisObject.position.set(
      this.chassisBody.position.x - offset.x,
      this.chassisBody.position.y - offset.y,
      this.chassisBody.position.z - offset.z
    );
    chassisObject.quaternion.set(
      this.chassisBody.quaternion.x,
      this.chassisBody.quaternion.y,
      this.chassisBody.quaternion.z,
      this.chassisBody.quaternion.w
    );

    for (let i = 0; i < Math.min(wheelObjects.length, this.raycastVehicle.wheelInfos.length); i++) {
      this.raycastVehicle.updateWheelTransform(i);
      const transform = this.raycastVehicle.getWheelTransformWorld(i);
      wheelObjects[i].position.set(transform.position.x, transform.position.y, transform.position.z);
      wheelObjects[i].quaternion.set(
        transform.quaternion.x,
        transform.quaternion.y,
        transform.quaternion.z,
        transform.quaternion.w
      );
    }
  }

  addBuildingObstacles(obstacles = [], tileKey = '') {
    let added = 0;
    for (const obstacle of obstacles) {
      if (this.obstacleBodies.length >= 3500) break;
      const id = String(obstacle.id || `${tileKey}:${obstacle.x}:${obstacle.z}`);
      if (this.obstacleIds.has(id)) continue;
      const width = Number(obstacle.width), depth = Number(obstacle.depth), height = Number(obstacle.height);
      if (![obstacle.x, obstacle.z, width, depth, height].every(Number.isFinite)) continue;
      if (width < 2.2 || depth < 2.2 || width > 120 || depth > 120 || height < 2.5) continue;
      const body = new CANNON.Body({ mass: 0, material: this.groundMaterial });
      body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
      body.position.set(obstacle.x, (Number(obstacle.minHeight) || 0) + height / 2, obstacle.z);
      body.quaternion.setFromEuler(0, Number(obstacle.yaw) || 0, 0);
      body.userData = { kind: 'building', osmId: id };
      this.world.addBody(body);
      this.obstacleIds.add(id);
      this.obstacleBodies.push(body);
      added++;
    }
    return added;
  }

  applyImpact(intensity = 0.5, direction = 1) {
    const amount = clamp(intensity, 0, 1);
    this.chassisBody.velocity.scale(1 - amount * 0.74, this.chassisBody.velocity);
    this.chassisBody.angularVelocity.y += direction * amount * 1.7;
    this.chassisBody.angularVelocity.x += (Math.random() - 0.5) * amount * 0.65;
    this.chassisBody.wakeUp();
  }

  getSpeedKmh() {
    return Math.abs(this.speedMps) * 3.6;
  }

  getHeading() {
    return this.heading;
  }

  dispose() {
    this.raycastVehicle.removeFromWorld(this.world);
    for (const body of this.obstacleBodies) this.world.removeBody(body);
    this.obstacleBodies.length = 0;
    this.obstacleIds.clear();
  }
}
