import * as THREE from 'three';
import { geoToWorld } from './OSMStreamer.js';

// Panjab University occupies Sector 14 (North Campus) and Sector 25 (South Campus).
// Geographic anchors are from PU's AISHE submission and mapped/photo geotags.
export const PU_GEO = Object.freeze({
  north: { lat: 30.759871, lon: 76.7701576 },
  south: { lat: 30.751628, lon: 76.759158 },
  gandhiBhawan: { lat: 30.761556, lon: 76.771125 },
  fineArtsMuseum: { lat: 30.7623012, lon: 76.772183 },
  acJoshiLibrary: { lat: 30.76158, lon: 76.76994 },
  studentCentre: { lat: 30.762274, lon: 76.769227 }
});

const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xe2dfd3, roughness: 0.84 }),
  whiteShade: new THREE.MeshStandardMaterial({ color: 0xc7c5bd, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xa6a39a, roughness: 0.9 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x686d6b, roughness: 0.88 }),
  redSandstone: new THREE.MeshStandardMaterial({ color: 0x925448, roughness: 0.86 }),
  redLight: new THREE.MeshStandardMaterial({ color: 0xb16b58, roughness: 0.82 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x254654, metalness: 0.24, roughness: 0.22 }),
  glassLight: new THREE.MeshStandardMaterial({ color: 0x567f8c, metalness: 0.18, roughness: 0.24 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xd0c7b5, roughness: 0.7 }),
  pool: new THREE.MeshPhysicalMaterial({ color: 0x376d79, roughness: 0.14, metalness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xbcb8ad, roughness: 0.96 }),
  pavingDark: new THREE.MeshStandardMaterial({ color: 0x807e75, roughness: 0.98 }),
  lawn: new THREE.MeshStandardMaterial({ color: 0x61794f, roughness: 1 }),
  hedge: new THREE.MeshStandardMaterial({ color: 0x31593b, roughness: 1 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xb69b54, metalness: 0.48, roughness: 0.38 }),
  sign: new THREE.MeshStandardMaterial({ color: 0x1c343c, roughness: 0.7 })
};

function box(parent, w, h, d, material, x, y, z, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, rt, rb, h, material, x, y, z, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function label(parent, title, subtitle, width, height, x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#172b31'; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#d5bd85'; ctx.lineWidth = 9; ctx.strokeRect(12, 12, 1000, 232);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f1e8d5'; ctx.font = '700 74px Arial';
  ctx.fillText(title, 512, subtitle ? 96 : 128, 930);
  if (subtitle) {
    ctx.fillStyle = '#d5bd85'; ctx.font = '500 30px Arial';
    ctx.fillText(subtitle.toUpperCase(), 512, 184, 930);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, emissive: 0x1b1710, emissiveMap: texture, emissiveIntensity: 0.18, roughness: 0.65 })
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addPetalShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -5.2);
  shape.bezierCurveTo(9, -8.5, 20, -18.5, 36, -17.0);
  shape.bezierCurveTo(52, -15.5, 59, -7.5, 59, 0);
  shape.bezierCurveTo(59, 11.5, 47, 19.5, 33, 17.3);
  shape.bezierCurveTo(18, 15, 8, 8.0, 0, 5.2);
  shape.closePath();
  return shape;
}

function createGandhiBhawan(scene, center) {
  const root = new THREE.Group();
  root.name = 'PU-Gandhi-Bhawan-three-winged-lotus';
  root.position.copy(center);
  scene.add(root);

  // Raised, shallow reflecting pool and pale stone forecourt.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(104, 0.8, 82), M.whiteShade);
  plinth.position.set(0, 0.42, 0); plinth.receiveShadow = true; root.add(plinth);
  const water = new THREE.Mesh(new THREE.BoxGeometry(98, 0.14, 76), M.pool);
  water.position.set(0, 0.9, 0); water.receiveShadow = true; root.add(water);
  box(root, 102, 0.55, 1.5, M.white, 0, 0.58, -39.2);
  box(root, 102, 0.55, 1.5, M.white, 0, 0.58, 39.2);
  box(root, 1.5, 0.55, 76, M.white, -50.2, 0.58, 0);
  box(root, 1.5, 0.55, 76, M.white, 50.2, 0.58, 0);

  const building = new THREE.Group();
  building.name = 'gandhi-bhawan-lotus-pavilion';
  root.add(building);
  const petal = addPetalShape();
  const wallGeometry = new THREE.ExtrudeGeometry(petal, {
    depth: 6.8, bevelEnabled: true, bevelSegments: 2,
    bevelSize: 0.32, bevelThickness: 0.24, curveSegments: 10
  });
  wallGeometry.rotateX(-Math.PI / 2);
  const roofGeometry = new THREE.ExtrudeGeometry(petal, {
    depth: 1.35, bevelEnabled: true, bevelSegments: 2,
    bevelSize: 0.35, bevelThickness: 0.22, curveSegments: 10
  });
  roofGeometry.rotateX(-Math.PI / 2);

  for (let wing = 0; wing < 3; wing++) {
    const angle = wing * Math.PI * 2 / 3;
    const wall = new THREE.Mesh(wallGeometry, M.white);
    wall.rotation.y = angle;
    wall.position.y = 1.0;
    wall.castShadow = true; wall.receiveShadow = true;
    building.add(wall);

    const roof = new THREE.Mesh(roofGeometry, M.whiteShade);
    roof.rotation.y = angle;
    roof.position.y = 7.25;
    roof.castShadow = true; roof.receiveShadow = true;
    building.add(roof);

    const slit = box(building, 0.55, 4.2, 5.0, M.glass, 34, 4.3, 0);
    slit.rotation.y = angle;
    slit.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  }

  cylinder(building, 12.0, 13.2, 7.3, M.whiteShade, 0, 4.5, 0, 48);
  cylinder(building, 8.1, 8.8, 0.9, M.glassLight, 0, 8.2, 0, 40);
  cylinder(building, 6.2, 6.2, 0.5, M.white, 0, 8.9, 0, 40);
  for (let i = 0; i < 18; i++) {
    const angle = i * Math.PI * 2 / 18;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 0.18), M.whiteShade);
    p.position.set(Math.cos(angle) * 12.4, 3.6, Math.sin(angle) * 12.4);
    building.add(p);
  }

  // Approach bridge and perimeter paving.
  box(root, 16, 0.65, 20, M.whiteShade, 0, 0.48, 49);
  for (let i = 0; i < 8; i++) {
    box(root, 12, 0.08, 1.15, M.paving, 0, 0.88, 42 + i * 2.4);
  }
  label(root, 'GANDHI BHAWAN', 'PANJAB UNIVERSITY · SECTOR 14', 36, 5.2, 0, 12.5, -2.0);

  return {
    obstacles: [{ id: 'pu-gandhi-bhawan', x: center.x, z: center.z, width: 78, depth: 66, height: 10.5, minHeight: 0, yaw: 0 }]
  };
}

function createHyperbolicRoof(parent, x, z, width, depth, baseY, lift = 2.2) {
  const positions = [], indices = [];
  const nx = 12, nz = 10;
  for (let iz = 0; iz <= nz; iz++) {
    const v = iz / nz - 0.5;
    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx - 0.5;
      const y = baseY + lift * (4 * u * v);
      positions.push(x + u * width, y, z + v * depth);
    }
  }
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = iz * (nx + 1) + ix;
    indices.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const roof = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x9d5948, roughness: 0.86, side: THREE.DoubleSide }));
  roof.castShadow = true; roof.receiveShadow = true;
  parent.add(roof);
}

function createFineArtsMuseum(scene, center) {
  const root = new THREE.Group();
  root.name = 'PU-Fine-Arts-Museum-Courtyard';
  root.position.copy(center);
  scene.add(root);

  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(54, 0.4, 46), M.paving);
  courtyard.position.y = 0.2; courtyard.receiveShadow = true; root.add(courtyard);

  const galleries = [
    { x: 0, z: -17, w: 42, d: 10 },
    { x: 0, z: 17, w: 42, d: 10 },
    { x: -22, z: 0, w: 10, d: 25 },
    { x: 22, z: 0, w: 10, d: 25 }
  ];
  galleries.forEach((g, index) => {
    box(root, g.w, 4.8, g.d, M.redSandstone, g.x, 2.4, g.z, `fine-arts-gallery-${index + 1}`);
    box(root, g.w + 0.5, 0.32, g.d + 0.5, M.whiteShade, g.x, 4.95, g.z);
    if (g.w > g.d) {
      for (let x = g.x - g.w / 2 + 2.4; x < g.x + g.w / 2; x += 4.2) {
        box(root, 0.3, 3.4, 0.25, M.whiteShade, x, 2.45, g.z + g.d / 2 + 0.12);
      }
    }
  });

  // Umbrella-shaped hyperbolic-paraboloid gallery roofs around the courtyard.
  createHyperbolicRoof(root, 0, -17, 42, 13, 5.0, 2.6);
  createHyperbolicRoof(root, 0, 17, 42, 13, 5.0, -2.6);
  createHyperbolicRoof(root, -22, 0, 13, 25, 5.0, 2.4);
  createHyperbolicRoof(root, 22, 0, 13, 25, 5.0, -2.4);

  for (const [x, z] of [[-10, -5], [0, -5], [10, -5], [-10, 6], [0, 6], [10, 6]]) {
    cylinder(root, 0.15, 0.2, 2.7, M.redLight, x, 1.35, z, 8);
  }
  label(root, 'MUSEUM OF FINE ARTS', 'PANJAB UNIVERSITY', 30, 4.5, 0, 8.2, 23.4);

  return {
    obstacles: [{ id: 'pu-fine-arts-museum', x: center.x, z: center.z, width: 58, depth: 50, height: 8.5, minHeight: 0, yaw: 0 }]
  };
}

function createLibrary(scene, center) {
  const root = new THREE.Group();
  root.name = 'PU-AC-Joshi-Library';
  root.position.copy(center);
  scene.add(root);

  box(root, 42, 0.7, 36, M.whiteShade, 0, 0.35, 0);
  box(root, 38, 21.5, 32, M.concrete, 0, 11.1, 0, 'ac-joshi-library-main-shell');
  // Five-storey reading building with the characteristic red-sandstone front.
  for (let floor = 0; floor < 5; floor++) {
    const y = 2.3 + floor * 4.15;
    box(root, 39.6, 0.34, 33.6, M.whiteShade, 0, y, 0);
    for (let col = 0; col < 9; col++) {
      const x = -17 + col * 4.25;
      box(root, 3.0, 2.4, 0.16, M.glass, x, y + 1.75, 16.15);
      box(root, 0.13, 2.65, 0.28, M.frame, x - 1.6, y + 1.75, 16.15);
      box(root, 0.13, 2.65, 0.28, M.frame, x + 1.6, y + 1.75, 16.15);
    }
  }
  for (let col = 0; col < 6; col++) {
    const x = -15 + col * 6;
    box(root, 4.1, 17.5, 0.42, M.redSandstone, x, 11.0, 16.35);
  }
  box(root, 40, 0.5, 34, M.whiteShade, 0, 22.15, 0);
  box(root, 14, 3.4, 0.2, M.sign, 0, 14.5, 16.62);
  label(root, 'A.C. JOSHI LIBRARY', 'PANJAB UNIVERSITY', 20, 3.1, 0, 14.5, 16.78);
  label(root, 'A.C. JOSHI LIBRARY', 'SECTOR 14', 24, 3.5, 0, 25.0, 16.4);

  return {
    obstacles: [{ id: 'pu-ac-joshi-library', x: center.x, z: center.z, width: 42, depth: 36, height: 22.5, minHeight: 0, yaw: 0 }]
  };
}

function createStudentCentre(scene, center) {
  const root = new THREE.Group();
  root.name = 'PU-Student-Centre-Spiral-Ramp';
  root.position.copy(center);
  scene.add(root);

  cylinder(root, 22, 24, 1.2, M.concreteDark, 0, 0.6, 0, 48);
  cylinder(root, 19.5, 20.5, 15.8, M.concrete, 0, 8.5, 0, 48);
  for (let floor = 1; floor <= 4; floor++) {
    cylinder(root, 20.7, 20.7, 0.45, M.whiteShade, 0, floor * 3.4 + 0.5, 0, 48);
  }
  for (let i = 0; i < 36; i++) {
    const angle = i * Math.PI * 2 / 36;
    const slit = box(root, 0.48, 10.8, 0.18, M.glass, Math.cos(angle) * 20.05, 8.2, Math.sin(angle) * 20.05);
    slit.rotation.y = -angle + Math.PI / 2;
  }

  // The characteristic circular ramp spirals around the cylindrical centre.
  const rampPoints = [];
  const turns = 1.75;
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const angle = t * Math.PI * 2 * turns - Math.PI / 2;
    const radius = 23.5;
    rampPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 1.0 + t * 12.8, Math.sin(angle) * radius));
  }
  const rampCurve = new THREE.CatmullRomCurve3(rampPoints);
  const ramp = new THREE.Mesh(new THREE.TubeGeometry(rampCurve, 260, 0.95, 7, false), M.whiteShade);
  ramp.castShadow = true; ramp.receiveShadow = true; root.add(ramp);
  cylinder(root, 7.0, 7.5, 2.0, M.whiteShade, 0, 17.6, 0, 36);
  label(root, 'STUDENT CENTRE', 'PANJAB UNIVERSITY · STU-C', 31, 4.4, 0, 19.2, 20.2);

  return {
    obstacles: [{ id: 'pu-student-centre', x: center.x, z: center.z, width: 50, depth: 50, height: 18, minHeight: 0, yaw: 0 }]
  };
}

function addCampusSign(scene, position, title, subtitle) {
  const root = new THREE.Group();
  root.position.copy(position);
  scene.add(root);
  box(root, 1.4, 8.0, 1.4, M.whiteShade, -14, 4, 0);
  box(root, 1.4, 8.0, 1.4, M.whiteShade, 14, 4, 0);
  box(root, 32, 1.2, 1.4, M.concrete, 0, 7.5, 0);
  label(root, title, subtitle, 29, 5.0, 0, 7.55, 0.76);
}

export function createPanjabUniversity(scene) {
  const north = geoToWorld(PU_GEO.north.lat, PU_GEO.north.lon);
  const south = geoToWorld(PU_GEO.south.lat, PU_GEO.south.lon);
  const landmarks = [
    { id: 'gandhi-bhawan', position: geoToWorld(PU_GEO.gandhiBhawan.lat, PU_GEO.gandhiBhawan.lon) },
    { id: 'fine-arts-museum', position: geoToWorld(PU_GEO.fineArtsMuseum.lat, PU_GEO.fineArtsMuseum.lon) },
    { id: 'ac-joshi-library', position: geoToWorld(PU_GEO.acJoshiLibrary.lat, PU_GEO.acJoshiLibrary.lon) },
    { id: 'student-centre', position: geoToWorld(PU_GEO.studentCentre.lat, PU_GEO.studentCentre.lon) }
  ];
  const obstacles = [];
  obstacles.push(...createGandhiBhawan(scene, landmarks[0].position).obstacles);
  obstacles.push(...createFineArtsMuseum(scene, landmarks[1].position).obstacles);
  obstacles.push(...createLibrary(scene, landmarks[2].position).obstacles);
  obstacles.push(...createStudentCentre(scene, landmarks[3].position).obstacles);

  const northSign = new THREE.Vector3(north.x - 130, 0, north.z + 210);
  addCampusSign(scene, northSign, 'PANJAB UNIVERSITY', 'SECTOR 14 · NORTH CAMPUS');
  const southSign = new THREE.Vector3(south.x, 0, south.z + 95);
  addCampusSign(scene, southSign, 'PANJAB UNIVERSITY', 'SECTOR 25 · SOUTH CAMPUS');

  return {
    northCenter: new THREE.Vector3(north.x, 0, north.z),
    southCenter: new THREE.Vector3(south.x, 0, south.z),
    landmarks,
    obstacles
  };
}
