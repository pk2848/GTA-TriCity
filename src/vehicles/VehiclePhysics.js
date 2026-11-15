import * as CANNON from 'cannon-es';

const FIXED_STEP = 1 / 60;
// The imported GLB models sit on y=0; the physics chassis centre is lower than
// the old placeholder SUV so the centre of mass is not excessively high.
const MODEL_ORIGIN_OFFSET = new CANNON.Vec3(0, 0.9, 0);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function lerpValue(a, b, t) {
  return a + (b - a) * t;
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
      mass: 1320,
      material: this.groundMaterial,
      linearDamping: 0.035,
      angularDamping: 0.72,
      allowSleep: false
    });
    this.defaultMass = 1320;
    this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1.02, 0.48, 2.05)));
    this.chassisBody.position.set(0, 0.92, 0);
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
      suspensionStiffness: 52,
      suspensionRestLength: 0.42,
      frictionSlip: 4.5,
      dampingRelaxation: 3.2,
      dampingCompression: 6.0,
      maxSuspensionForce: 145000,
      maxSuspensionTravel: 0.22,
      // Keep lateral tyre impulses close to the centre of mass to resist rollovers.
      rollInfluence: 0.009,
      // +X is the right axle. With +Y up, Y × X gives the game's -Z forward.
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      customSlidingRotationalSpeed: -22,
      useCustomSlidingRotationalSpeed: true
    };

    // Front wheels steer. Rear wheels receive engine force.
    const wheelConnections = [
      [-0.88, -0.08, -1.38],
      [0.88, -0.08, -1.38],
      [-0.88, -0.08, 1.36],
      [0.88, -0.08, 1.36]
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
    this.engineMultiplier = 1;
    this.maxSpeed = 36;
    this.nitroMaxSpeed = 47;
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.nitroMultiplier = 1;
    this.nitroBlend = 0;
    this.accumulator = 0;
    this.obstacleIds = new Set();
    this.obstacleBodies = [];
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.reset();
  }

  reset() {
    // Spawn at the CP67 Mall public drop-off plaza, facing the main entrance.
    this.spawnPosition = this.spawnPosition || { x: 0, z: 112 };
    this.chassisBody.position.set(this.spawnPosition.x, 0.92, this.spawnPosition.z);
    this.chassisBody.quaternion.set(0, 0, 0, 1);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.force.set(0, 0, 0);
    this.chassisBody.torque.set(0, 0, 0);
    this.steering = 0;
    this.speedMps = 0;
    this.heading = 0;
    this.nitroBlend = 0;
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.chassisBody.wakeUp();
    this.chassisBody.aabbNeedsUpdate = true;
  }

  setVehicleProfile(profile = {}) {
    const isMotorcycle = profile.vehicleType === 'motorcycle';
    const width = clamp(Number(profile.width) || 2.04, isMotorcycle ? 0.55 : 1.7, isMotorcycle ? 1.1 : 2.5);
    const length = clamp(Number(profile.length) || 4.1, isMotorcycle ? 1.5 : 3.8, isMotorcycle ? 2.7 : 5.8);
    const height = clamp(Number(profile.height) || 1.0, isMotorcycle ? 0.8 : 0.7, isMotorcycle ? 1.6 : 1.32);
    const trackWidth = clamp(Number(profile.trackWidth) || width * 0.82, isMotorcycle ? 0.05 : 1.45, isMotorcycle ? 0.75 : 2.0);
    const wheelbase = clamp(Number(profile.wheelbase) || 2.74, isMotorcycle ? 0.9 : 2.45, isMotorcycle ? 1.8 : 3.25);
    const wheelRadius = clamp(Number(profile.wheelRadius) || 0.38, isMotorcycle ? 0.25 : 0.32, isMotorcycle ? 0.42 : 0.46);

    // Keep the collision box and all four suspension attachment points matched to the GLB.
    for (const shape of [...this.chassisBody.shapes]) this.chassisBody.removeShape(shape);
    this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, length / 2)));
    this.chassisBody.mass = isMotorcycle
      ? clamp(Number(profile.mass) || 260, 180, 360)
      : clamp(Number(profile.mass) || this.defaultMass, 900, 2200);
    this.chassisBody.updateMassProperties();
    this.chassisBody.aabbNeedsUpdate = true;

    const positions = [
      [-trackWidth / 2, -0.08, -wheelbase / 2],
      [trackWidth / 2, -0.08, -wheelbase / 2],
      [-trackWidth / 2, -0.08, wheelbase / 2],
      [trackWidth / 2, -0.08, wheelbase / 2]
    ];
    positions.forEach(([x, y, z], index) => {
      const wheel = this.raycastVehicle.wheelInfos[index];
      wheel.chassisConnectionPointLocal.set(x, y, z);
      wheel.radius = wheelRadius;
      wheel.rollInfluence = isMotorcycle ? 0.055 : 0.018;
    });

    this.engineMultiplier = clamp(Number(profile.engineMultiplier) || 1, 0.65, 1.4);
    this.maxSpeed = clamp(Number(profile.maxSpeed) || 36, 25, 55);
    this.nitroMaxSpeed = clamp(Number(profile.nitroMaxSpeed) || 47, this.maxSpeed, 65);
    this.chassisBody.wakeUp();
    this.raycastVehicle.updateWheelTransform(0);
    this.chassisBody.updateAABB();
  }
  update(deltaTime, controls = {}) {
    const dt = clamp(deltaTime, 0, 0.05);
    const throttle = clamp(Number(controls.throttle) || 0, -1, 1);
    const steer = clamp(Number(controls.steer) || 0, -1, 1);
    const braking = Boolean(controls.brake);
    const nitro = Boolean(controls.nitro);
    const condition = clamp(Number(controls.condition ?? 100) / 100, 0.45, 1);

    // Reduce steering angle as speed rises: full lock at high speed is a major
    // rollover trigger in a raycast vehicle.
    const horizontalSpeed = Math.hypot(this.chassisBody.velocity.x, this.chassisBody.velocity.z);
    const maxSteer = 0.48 / (1 + horizontalSpeed / 12);
    const targetSteering = steer * maxSteer;
    this.steering += (targetSteering - this.steering) * Math.min(1, dt * 7.0);
    this.raycastVehicle.setSteeringValue(this.steering, 0);
    this.raycastVehicle.setSteeringValue(this.steering, 1);

    // Nitro ramps in smoothly and adds modest acceleration. A large instant force
    // spike at the rear wheels creates a wheelie and can launch a light supercar.
    const nitroTarget = nitro && throttle > 0 ? 1 : 0;
    this.nitroBlend += (nitroTarget - this.nitroBlend) * Math.min(1, dt * 2.4);
    const baseEngineForce = 3900 * condition * this.engineMultiplier * (controls.boost ? 1.05 : 1);
    const engineForce = throttle * baseEngineForce * (1 + this.nitroBlend * 0.13);
    // The chassis and imported vehicles face local -Z. With +X wheel axles,
    // positive engine force drives the vehicle forward toward -Z.
    this.raycastVehicle.applyEngineForce(engineForce, 2);
    this.raycastVehicle.applyEngineForce(engineForce, 3);

    const serviceBrake = braking ? 9200 : (throttle === 0 ? 90 : 0);
    for (let i = 0; i < 4; i++) this.raycastVehicle.setBrake(serviceBrake, i);

    // Fixed-step integration keeps suspension behaviour stable across frame rates.
    this.world.step(FIXED_STEP, dt, 8);

    const forward = new CANNON.Vec3(0, 0, -1);
    this.chassisBody.quaternion.vmult(forward, forward);
    this.speedMps = this.chassisBody.velocity.dot(forward);
    this.heading = Math.atan2(-forward.x, -forward.z);

    const speedCap = lerpValue(this.maxSpeed, this.nitroMaxSpeed, this.nitroBlend);
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

    const chassisUp = new CANNON.Vec3(0, 1, 0);
    this.chassisBody.quaternion.vmult(chassisUp, chassisUp);
    const worldUp = new CANNON.Vec3(0, 1, 0);
    const groundedWheels = this.raycastVehicle.wheelInfos.reduce(
      (count, wheel) => count + (wheel.isInContact ? 1 : 0), 0
    );

    // Electronic stability assist: gently counter body roll and pitch while at least
    // two wheels are on the ground. It does not affect steering/yaw.
    if (groundedWheels >= 2 && chassisUp.y > 0.22) {
      const correctionAxis = chassisUp.cross(worldUp);
      const correctionStrength = 1500;
      const angularDamping = 520;
      this.chassisBody.torque.x += correctionAxis.x * correctionStrength
        - this.chassisBody.angularVelocity.x * angularDamping;
      this.chassisBody.torque.z += correctionAxis.z * correctionStrength
        - this.chassisBody.angularVelocity.z * angularDamping;
    }

    // Speed-dependent tyre downforce keeps the chassis planted during nitro.
    // Apply only while tyres are grounded; never pull an airborne car down abruptly.
    if (groundedWheels >= 2) {
      const downforce = Math.min(2600, horizontalSpeed * horizontalSpeed * 2.25);
      this.chassisBody.force.y -= downforce;
    }

    // Limit extreme roll/pitch angular rates without restricting yaw/steering.
    this.chassisBody.angularVelocity.x = clamp(this.chassisBody.angularVelocity.x, -1.05, 1.05);
    this.chassisBody.angularVelocity.z = clamp(this.chassisBody.angularVelocity.z, -1.05, 1.05);

    const rolled = chassisUp.y < 0.18 || this.chassisBody.position.y < -1;
    this.rolloverTimer = rolled ? this.rolloverTimer + dt : Math.max(0, this.rolloverTimer - dt * 2);
    this.isUpsideDown = this.rolloverTimer > 1.0;
  }

  syncVisuals(chassisObject, wheelObjects = []) {
    const offset = new CANNON.Vec3();
    this.chassisBody.quaternion.vmult(MODEL_ORIGIN_OFFSET, offset);
    // Render the interpolated Cannon pose, not the last 60 Hz physics pose.
    // The game can render at 120+ FPS; using body.position directly makes the
    // vehicle visibly step/judder between physics ticks.
    const renderPosition = this.chassisBody.interpolatedPosition || this.chassisBody.position;
    const renderQuaternion = this.chassisBody.interpolatedQuaternion || this.chassisBody.quaternion;
    renderQuaternion.vmult(MODEL_ORIGIN_OFFSET, offset);
    chassisObject.position.set(
      renderPosition.x - offset.x,
      renderPosition.y - offset.y,
      renderPosition.z - offset.z
    );
    chassisObject.quaternion.set(
      renderQuaternion.x,
      renderQuaternion.y,
      renderQuaternion.z,
      renderQuaternion.w
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

  recoverUpright() {
    const x = this.chassisBody.position.x;
    const z = this.chassisBody.position.z;
    const yaw = this.heading || 0;
    this.chassisBody.position.set(x, 1.08, z);
    this.chassisBody.quaternion.setFromEuler(0, yaw, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.force.set(0, 0, 0);
    this.chassisBody.torque.set(0, 0, 0);
    this.chassisBody.wakeUp();
    this.chassisBody.aabbNeedsUpdate = true;
    this.chassisBody.updateAABB();
    for (const wheel of this.raycastVehicle.wheelInfos) {
      wheel.suspensionLength = wheel.suspensionRestLength;
      wheel.suspensionRelativeVelocity = 0;
      wheel.suspensionForce = 0;
      wheel.isInContact = false;
    }
    this.rolloverTimer = 0;
    this.isUpsideDown = false;
    this.speedMps = 0;
    this.heading = yaw;
  }

  applyImpact(intensity = 0.5, direction = 1) {
    const amount = clamp(intensity, 0, 1);
    this.chassisBody.velocity.scale(1 - amount * 0.74, this.chassisBody.velocity);
    // Contacts yaw the car but do not inject random roll/pitch that can flip it.
    this.chassisBody.angularVelocity.y += direction * amount * 0.85;
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
