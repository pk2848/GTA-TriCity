import * as THREE from 'three';

const CAR_PALETTE = [0xb83f35, 0xd3d6d0, 0x263f69, 0x9b9b91, 0x262b2e, 0xc3a45e, 0x58735a, 0x733f72];
const PERSON_PALETTE = [0x335b8a, 0x8d493e, 0x536846, 0xb18a45, 0x55515f, 0x8b6b58, 0x3e7774];
const CAR_LIMIT = 44;
const PEDESTRIAN_LIMIT = 84;

const shared = {
  tire: new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.92 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1c3038, roughness: 0.3, metalness: 0.12 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x252b2d, roughness: 0.68 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x9ba5a2, metalness: 0.75, roughness: 0.28 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb98c70, roughness: 0.95 }),
  trouser: new THREE.MeshStandardMaterial({ color: 0x26323c, roughness: 1 })
};

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return total;
}

function offsetPath(points, offset) {
  return points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    dx /= length; dz /= length;
    // Perpendicular offset in the local X/Z ground plane.
    return { x: point.x - dz * offset, z: point.z + dx * offset };
  });
}

function samplePath(points, distance) {
  let remaining = Math.max(0, distance);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const segment = Math.hypot(dx, dz);
    if (segment < 0.01) continue;
    if (remaining <= segment || i === points.length - 2) {
      const t = THREE.MathUtils.clamp(remaining / segment, 0, 1);
      return {
        x: THREE.MathUtils.lerp(a.x, b.x, t),
        z: THREE.MathUtils.lerp(a.z, b.z, t),
        heading: Math.atan2(-dx, -dz)
      };
    }
    remaining -= segment;
  }
  const last = points[points.length - 1] || { x: 0, z: 0 };
  return { x: last.x, z: last.z, heading: 0 };
}

function box(parent, width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeTrafficCar(color) {
  const group = new THREE.Group();
  group.name = 'ai-traffic-vehicle';
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.26, roughness: 0.42 });
  const roofMaterial = bodyMaterial.clone();
  box(group, 1.88, 0.62, 4.05, bodyMaterial, 0, 0.78, 0);
  box(group, 1.62, 0.72, 2.12, shared.glass, 0, 1.39, -0.12);
  box(group, 1.65, 0.12, 1.88, roofMaterial, 0, 1.78, -0.12);
  for (const x of [-0.99, 0.99]) {
    for (const z of [-1.28, 1.28]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 12), shared.tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.43, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.07), new THREE.MeshBasicMaterial({ color: 0xffe5ae }));
    headlight.position.set(x * 0.72, 0.88, -2.05);
    group.add(headlight);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.07), new THREE.MeshBasicMaterial({ color: 0xc63730 }));
    tail.position.set(x * 0.72, 0.83, 2.05);
    group.add(tail);
  }
  return group;
}

function makePedestrian(color) {
  const group = new THREE.Group();
  group.name = 'ai-pedestrian';
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.58, 4, 7), shirt);
  torso.position.y = 1.1; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), shared.skin);
  head.position.y = 1.72; head.castShadow = true; group.add(head);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27, 1.34, 0);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.56, 7), shared.skin);
  arm1.position.y = -0.27; arm1.castShadow = true; leftArm.add(arm1); group.add(leftArm);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.27, 1.34, 0);
  const arm2 = arm1.clone(); arm2.position.y = -0.27; rightArm.add(arm2); group.add(rightArm);
  const legs = [];
  for (const x of [-0.12, 0.12]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.76, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.72, 7), shared.trouser);
    leg.position.y = -0.36; leg.castShadow = true; pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), shared.trim);
    shoe.position.set(0, -0.7, -0.05); pivot.add(shoe);
    group.add(pivot); legs.push(pivot);
  }
  group.userData.limbs = { leftArm, rightArm, legs };
  group.userData.torso = torso;
  return group;
}

export class TrafficSystem {
  constructor(scene, onCounts = () => {}) {
    this.scene = scene;
    this.onCounts = onCounts;
    this.registeredTiles = new Set();
    this.knownRoads = new Set();
    this.cars = [];
    this.pedestrians = [];
    this.elapsed = 0;
    this.collisionCooldown = 0;
    this.onCounts({ cars: 0, pedestrians: 0 });
  }

  addRoads(roads, tileKey) {
    if (this.registeredTiles.has(tileKey)) return;
    this.registeredTiles.add(tileKey);
    for (const road of roads || []) {
      const key = String(road.id);
      if (this.knownRoads.has(key)) continue;
      this.knownRoads.add(key);
      const points = road.points || [];
      const length = pathLength(points);
      if (points.length < 2 || length < 100) continue;
      const width = Number.isFinite(road.width) ? road.width : 5.2;
      const type = road.type || 'residential';
      const isDriveable = !['footway', 'path', 'pedestrian', 'cycleway', 'steps'].includes(type);
      const isUrban = ['primary','secondary','tertiary','unclassified','residential','living_street','service'].includes(type);

      if (isDriveable && this.cars.length < CAR_LIMIT) {
        const directions = road.oneway ? [1] : [1, -1];
        for (const direction of directions) {
          if (this.cars.length >= CAR_LIMIT) break;
          const lane = -width * 0.17;
          const lanePoints = offsetPath(direction === 1 ? points : [...points].reverse(), lane);
          const laneLength = pathLength(lanePoints);
          if (laneLength < 65) continue;
          const color = CAR_PALETTE[Math.floor(Math.random() * CAR_PALETTE.length)];
          const object = makeTrafficCar(color);
          const progress = Math.random() * Math.max(1, laneLength - 16);
          const agent = {
            object, basePoints: points, lane, direction, points: lanePoints,
            length: laneLength, progress, speed: 4.8 + Math.random() * 4.4,
            targetSpeed: 5.5 + Math.random() * 4.8, pause: Math.random() * 2,
            collisionCooldown: 0, roadType: type, oneway: Boolean(road.oneway)
          };
          const p = samplePath(agent.points, agent.progress);
          object.position.set(p.x, 0, p.z);
          object.rotation.y = p.heading;
          this.scene.add(object);
          this.cars.push(agent);
        }
      }

      if (isUrban && this.pedestrians.length < PEDESTRIAN_LIMIT) {
        const sides = [-1, 1];
        for (const side of sides) {
          if (this.pedestrians.length >= PEDESTRIAN_LIMIT) break;
          const walkOffset = side * (width / 2 + 2.0);
          const walkPoints = offsetPath(points, walkOffset);
          const walkLength = pathLength(walkPoints);
          if (walkLength < 90) continue;
          const object = makePedestrian(PERSON_PALETTE[this.pedestrians.length % PERSON_PALETTE.length]);
          const progress = Math.random() * walkLength;
          const agent = {
            object, points: walkPoints, length: walkLength, progress,
            speed: 0.75 + Math.random() * 0.55, phase: Math.random() * Math.PI * 2,
            fallen: false, fallTimer: 0, collisionCooldown: 0,
            direction: 1
          };
          const p = samplePath(agent.points, agent.progress);
          object.position.set(p.x, 0, p.z); object.rotation.y = p.heading;
          this.scene.add(object);
          this.pedestrians.push(agent);
        }
      }
    }
    this.emitCounts();
  }

  update(dt, player) {
    this.elapsed += dt;
    const events = [];
    for (const car of this.cars) {
      car.collisionCooldown = Math.max(0, car.collisionCooldown - dt);
      car.pause = Math.max(0, car.pause - dt);
      if (car.pause <= 0) {
        // Keep AI vehicles moving at city speeds, with gentle speed variation.
        car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 0.35);
      } else car.speed *= Math.max(0, 1 - dt * 3);
      car.progress += car.speed * dt;
      if (car.progress >= car.length) {
        if (car.oneway) {
          // One-way vehicles loop at the end rather than driving against the mapped direction.
          car.progress = 0;
        } else {
          // Two-way vehicles turn around at the end of the OSM way.
          car.direction *= -1;
          const base = car.direction === 1 ? car.basePoints : [...car.basePoints].reverse();
          car.points = offsetPath(base, car.lane);
          car.length = pathLength(car.points);
          car.progress = 0;
        }
      }
      const p = samplePath(car.points, car.progress);
      car.object.position.set(p.x, 0, p.z);
      car.object.rotation.y = p.heading;

      const distance = Math.hypot(player.x - p.x, player.z - p.z);
      if (distance < 3.15 && Math.abs(player.speed) > 4 && car.collisionCooldown <= 0) {
        car.collisionCooldown = 2.4;
        car.pause = 1.8;
        events.push({ type: 'vehicle', impact: THREE.MathUtils.clamp(Math.abs(player.speed) / 28, 0.35, 1), agent: car });
      }
    }

    for (const person of this.pedestrians) {
      person.collisionCooldown = Math.max(0, person.collisionCooldown - dt);
      if (person.fallen) {
        person.fallTimer -= dt;
        person.object.rotation.z = THREE.MathUtils.lerp(person.object.rotation.z, Math.PI / 2, Math.min(1, dt * 5));
        person.object.position.y = Math.max(0, 0.08 + Math.sin(this.elapsed * 8) * 0.025);
        if (person.fallTimer <= 0) {
          person.fallen = false;
          person.object.rotation.z = 0;
          person.object.position.y = 0;
          person.collisionCooldown = 2.5;
        }
        continue;
      }
      person.progress += person.speed * person.direction * dt;
      if (person.progress >= person.length) { person.direction = -1; person.progress = person.length; }
      if (person.progress <= 0) { person.direction = 1; person.progress = 0; }
      const p = samplePath(person.points, person.progress);
      person.object.position.set(p.x, 0, p.z);
      person.object.rotation.y = p.heading + (person.direction < 0 ? Math.PI : 0);
      const limbs = person.object.userData.limbs;
      const stride = Math.sin(this.elapsed * 7 * person.speed + person.phase) * 0.42;
      limbs.legs[0].rotation.x = stride;
      limbs.legs[1].rotation.x = -stride;
      limbs.leftArm.rotation.x = -stride * 0.65;
      limbs.rightArm.rotation.x = stride * 0.65;

      const distance = Math.hypot(player.x - p.x, player.z - p.z);
      if (distance < 2.35 && Math.abs(player.speed) > 2.5 && person.collisionCooldown <= 0) {
        person.fallen = true;
        person.fallTimer = 3.5;
        person.object.rotation.z = (Math.random() > 0.5 ? 1 : -1) * 0.35;
        person.collisionCooldown = 8;
        events.push({ type: 'pedestrian', impact: THREE.MathUtils.clamp(Math.abs(player.speed) / 24, 0.2, 0.8), agent: person });
      }
    }
    if (events.length) this.onCounts({ cars: this.cars.length, pedestrians: this.pedestrians.length });
    return events;
  }

  getCounts() {
    return { cars: this.cars.length, pedestrians: this.pedestrians.length };
  }

  emitCounts() {
    this.onCounts(this.getCounts());
  }

  dispose() {
    for (const car of this.cars) this.scene.remove(car.object);
    for (const person of this.pedestrians) this.scene.remove(person.object);
    this.cars.length = 0;
    this.pedestrians.length = 0;
    this.registeredTiles.clear();
    this.knownRoads.clear();
    this.emitCounts();
  }
}
