import * as THREE from 'three';

// Original, lightweight Three.js reconstruction guided by CP67's public exterior references.
// Local origin is the mapped CP67 Mall point. One world unit is one metre.
const M = {
  concrete: new THREE.MeshStandardMaterial({ color: 0xc4bba9, roughness: 0.84 }),
  warmStone: new THREE.MeshStandardMaterial({ color: 0xd3c4aa, roughness: 0.82 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x5a5954, roughness: 0.9 }),
  charcoal: new THREE.MeshStandardMaterial({ color: 0x242c30, roughness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x59666a, metalness: 0.72, roughness: 0.32 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xaeb8b6, metalness: 0.76, roughness: 0.25 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x4e7885, metalness: 0.22, roughness: 0.19, transparent: true, opacity: 0.72 }),
  darkGlass: new THREE.MeshStandardMaterial({ color: 0x223b47, metalness: 0.25, roughness: 0.2, transparent: true, opacity: 0.82 }),
  canopyGlass: new THREE.MeshStandardMaterial({ color: 0x9ebbc0, metalness: 0.28, roughness: 0.16, transparent: true, opacity: 0.56, side: THREE.DoubleSide }),
  shopGlow: new THREE.MeshStandardMaterial({ color: 0xffd49b, emissive: 0xd77724, emissiveIntensity: 0.34, roughness: 0.65 }),
  pavement: new THREE.MeshStandardMaterial({ color: 0x8d908b, roughness: 0.97 }),
  pavingLight: new THREE.MeshStandardMaterial({ color: 0xc7c3b8, roughness: 0.94 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x343a39, roughness: 1 }),
  line: new THREE.MeshStandardMaterial({ color: 0xe7e2cf, roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x506d50, roughness: 1 }),
  planter: new THREE.MeshStandardMaterial({ color: 0x88877b, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x315c3b, roughness: 1 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x547b4e, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x644b36, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x478693, roughness: 0.2, metalness: 0.14, transparent: true, opacity: 0.8 })
};

function addBox(parent, width, height, depth, material, x, y, z, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}
function addCylinder(parent, radiusTop, radiusBottom, height, material, x, y, z, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function addPlane(parent, width, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function makeSignTexture(title, subtitle = '', accent = '#d6b66f') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1024, 256);
  gradient.addColorStop(0, '#15242a');
  gradient.addColorStop(0.55, '#1b3339');
  gradient.addColorStop(1, '#283a3e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 9;
  ctx.strokeRect(12, 12, 1000, 232);
  ctx.fillStyle = accent;
  ctx.font = '700 116px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 512, subtitle ? 106 : 128, 930);
  if (subtitle) {
    ctx.fillStyle = '#e7e5dd';
    ctx.font = '500 34px Arial';
    ctx.letterSpacing = '8px';
    ctx.fillText(subtitle.toUpperCase(), 512, 194, 900);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function addSign(parent, title, subtitle, width, height, x, y, z, rotationY = 0) {
  const texture = makeSignTexture(title, subtitle);
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: 0x23201a, emissiveMap: texture, emissiveIntensity: 0.42, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  sign.position.set(x, y, z);
  sign.rotation.y = rotationY;
  sign.castShadow = true;
  parent.add(sign);
  return sign;
}
function addFacadeGrid(parent, options) {
  const { width, depth, floors, baseY, frontZ, sideX, cols, material = M.darkGlass, windowWidth = 2.75, windowHeight = 2.05 } = options;
  const windows = [];
  const dummy = new THREE.Object3D();
  const geometry = new THREE.BoxGeometry(1, 1, 0.12);
  const count = cols * floors;
  const front = new THREE.InstancedMesh(geometry, material, count);
  const back = new THREE.InstancedMesh(geometry, material, count);
  front.name = 'cp67-office-facade-glazing';
  back.name = 'cp67-office-facade-glazing';
  let index = 0;
  for (let floor = 0; floor < floors; floor++) {
    const y = baseY + 1.75 + floor * 3.9;
    for (let col = 0; col < cols; col++) {
      const x = -width / 2 + (col + 0.5) * width / cols;
      dummy.position.set(x, y, frontZ);
      dummy.scale.set(Math.min(windowWidth, width / cols * 0.72), windowHeight, 1);
      dummy.updateMatrix();
      front.setMatrixAt(index, dummy.matrix);
      dummy.position.z = -depth / 2 - 0.06;
      dummy.updateMatrix();
      back.setMatrixAt(index, dummy.matrix);
      index++;
    }
  }
  front.count = index;
  back.count = index;
  front.instanceMatrix.needsUpdate = true;
  back.instanceMatrix.needsUpdate = true;
  parent.add(front, back);

  const sideGeometry = new THREE.BoxGeometry(0.12, 1, 1);
  const sideCount = Math.max(2, Math.floor(depth / 3.5)) * floors;
  const left = new THREE.InstancedMesh(sideGeometry, material, sideCount);
  const right = new THREE.InstancedMesh(sideGeometry, material, sideCount);
  let sideIndex = 0;
  for (let floor = 0; floor < floors; floor++) {
    const y = baseY + 1.75 + floor * 3.9;
    const sideCols = Math.max(2, Math.floor(depth / 3.5));
    for (let col = 0; col < sideCols; col++) {
      const z = -depth / 2 + (col + 0.5) * depth / sideCols;
      dummy.position.set(-width / 2 - 0.06, y, z);
      dummy.scale.set(1, windowHeight, Math.min(2.6, depth / sideCols * 0.7));
      dummy.updateMatrix();
      left.setMatrixAt(sideIndex, dummy.matrix);
      dummy.position.x = width / 2 + 0.06;
      dummy.updateMatrix();
      right.setMatrixAt(sideIndex, dummy.matrix);
      sideIndex++;
    }
  }
  left.count = right.count = sideIndex;
  left.instanceMatrix.needsUpdate = right.instanceMatrix.needsUpdate = true;
  parent.add(left, right);
}
function addTree(parent, x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  addCylinder(tree, 0.2 * scale, 0.32 * scale, 3.4 * scale, M.trunk, 0, 1.7 * scale, 0, 8);
  const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.65 * scale, 9, 7), M.leaf);
  crown1.position.set(0, 4.15 * scale, 0);
  crown1.scale.set(1, 1.08, 0.94);
  crown1.castShadow = true;
  tree.add(crown1);
  const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.05 * scale, 8, 6), M.leafLight);
  crown2.position.set(0.65 * scale, 4.6 * scale, 0.25 * scale);
  tree.add(crown2);
  parent.add(tree);
}
function addPalm(parent, x, z, scale = 1) {
  const palm = new THREE.Group();
  palm.position.set(x, 0, z);
  addCylinder(palm, 0.15 * scale, 0.24 * scale, 6.4 * scale, M.trunk, 0, 3.2 * scale, 0, 8);
  const leafMat = M.leafLight;
  for (let i = 0; i < 7; i++) {
    const angle = (Math.PI * 2 * i) / 7;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.32 * scale, 3.2 * scale, 5), leafMat);
    frond.position.set(Math.sin(angle) * 1.15 * scale, 6.25 * scale, Math.cos(angle) * 1.15 * scale);
    frond.rotation.z = -Math.cos(angle) * 0.72;
    frond.rotation.x = Math.sin(angle) * 0.72;
    frond.scale.set(1, 1, 0.34);
    palm.add(frond);
  }
  parent.add(palm);
}
function addLamp(parent, x, z) {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0, z);
  addCylinder(lamp, 0.07, 0.11, 7.5, M.metal, 0, 3.75, 0, 8);
  addCylinder(lamp, 0.34, 0.34, 0.16, M.warmStone, 0, 7.52, 0, 12);
  const glow = new THREE.PointLight(0xffd8a2, 7, 20);
  glow.position.set(0, 7.3, 0);
  lamp.add(glow);
  parent.add(lamp);
}
function addPlanter(parent, x, z, width, depth) {
  addBox(parent, width, 0.75, depth, M.planter, x, 0.38, z);
  addBox(parent, width - 0.5, 0.22, depth - 0.5, M.grass, x, 0.82, z);
  const count = Math.max(2, Math.floor(width / 2.1));
  for (let i = 0; i < count; i++) {
    const tx = x - width / 2 + (i + 0.5) * width / count;
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 7, 6), M.leaf);
    shrub.position.set(tx, 1.3, z);
    shrub.scale.set(1.05, 0.8, 0.8);
    parent.add(shrub);
  }
}
function addParkingMark(parent, x, z, count, spacing = 2.65) {
  for (let i = 0; i <= count; i++) {
    addBox(parent, 0.075, 0.035, 5.2, M.line, x - (count * spacing) / 2 + i * spacing, 0.065, z);
  }
  addBox(parent, count * spacing, 0.035, 0.075, M.line, x, 0.065, z - 2.6);
  addBox(parent, count * spacing, 0.035, 0.075, M.line, x, 0.065, z + 2.6);
}

export function createCP67Mall(scene) {
  const root = new THREE.Group();
  root.name = 'CP67-Mall-Sector-67-Mohali';
  scene.add(root);

  // The 4-side-open plot is represented as a compact mall campus with a broad frontage.
  addPlane(root, 178, 170, M.pavement, 0, 0.012, 37);
  addPlane(root, 166, 62, M.asphalt, 0, 0.025, 82);
  addBox(root, 168, 0.2, 1.1, M.pavingLight, 0, 0.12, 51);
  addBox(root, 168, 0.2, 1.1, M.pavingLight, 0, 0.12, 112);

  // Main retail podium: two retail levels plus restaurant/F&B and entertainment decks.
  addBox(root, 132, 18, 70, M.concrete, 0, 9, -22, 'CP67-retail-podium');
  addBox(root, 133, 0.7, 71, M.warmStone, 0, 18.1, -22);
  addBox(root, 134, 0.9, 72, M.charcoal, 0, 0.45, -22);
  addBox(root, 134, 0.42, 72, M.metal, 0, 18.55, -22);

  // Ground-floor high-street storefronts, individually framed and lit.
  const shopCount = 20;
  const frontageWidth = 126;
  const shopWidth = frontageWidth / shopCount;
  for (let i = 0; i < shopCount; i++) {
    const x = -frontageWidth / 2 + shopWidth * (i + 0.5);
    addBox(root, shopWidth - 0.28, 5.15, 0.18, M.darkGlass, x, 3.45, 13.18);
    addBox(root, 0.12, 5.6, 0.34, M.silver, x - shopWidth / 2 + 0.08, 3.35, 13.12);
    addBox(root, 0.12, 5.6, 0.34, M.silver, x + shopWidth / 2 - 0.08, 3.35, 13.12);
    addBox(root, shopWidth - 0.12, 0.2, 0.32, M.metal, x, 6.2, 13.08);
    addBox(root, shopWidth - 0.42, 0.32, 0.2, M.shopGlow, x, 6.47, 13.18);
    if (i % 2 === 0) {
      addBox(root, shopWidth - 0.34, 4.4, 0.14, M.glass, x, 10.35, 13.2);
    } else {
      addBox(root, shopWidth - 0.34, 4.4, 0.14, M.darkGlass, x, 10.35, 13.2);
    }
  }

  // The entrance atrium is a tall glazed volume with the real-world canopy language.
  addBox(root, 27, 14.4, 0.42, M.glass, 0, 7.4, 13.0, 'CP67-glazed-main-entrance');
  for (const x of [-13.5, -9, -4.5, 0, 4.5, 9, 13.5]) addBox(root, 0.16, 14.7, 0.34, M.metal, x, 7.4, 12.7);
  addBox(root, 27.8, 0.28, 0.5, M.silver, 0, 14.8, 12.7);
  addSign(root, 'CP67', 'MOHALI · SECTOR 67', 20, 5.0, 0, 18.1, 13.0);

  // Entrance canopy: slim steel outriggers and translucent roof panels.
  addBox(root, 34, 0.42, 18, M.canopyGlass, 0, 14.65, 22.0, 'CP67-main-entry-canopy');
  for (const x of [-16, -8, 0, 8, 16]) {
    addBox(root, 0.22, 0.2, 18.5, M.metal, x, 14.9, 22.0);
  }
  for (const z of [13.2, 17.5, 22, 26.5, 31]) addBox(root, 34, 0.12, 0.12, M.metal, 0, 14.82, z);
  for (const x of [-15.5, 15.5]) addCylinder(root, 0.18, 0.22, 14.6, M.silver, x, 7.3, 31, 12);
  addBox(root, 36, 0.18, 0.22, M.silver, 0, 15.0, 31);

  // Commercial/office tower at the east end, with a curtain-wall grid.
  const office = new THREE.Group();
  office.position.set(42, 18, -26);
  root.add(office);
  addBox(office, 50, 32, 44, M.concrete, 0, 16, 0, 'CP67-office-tower');
  addFacadeGrid(office, { width: 50, depth: 44, floors: 8, baseY: 0, frontZ: 22.08, cols: 14, material: M.darkGlass, windowWidth: 2.8, windowHeight: 2.45 });
  for (let floor = 0; floor <= 8; floor++) {
    addBox(office, 50.4, 0.22, 44.3, M.silver, 0, floor * 3.9 + 1.4, 0);
  }
  for (const x of [-24, 24]) addBox(office, 0.85, 32.4, 44.4, M.warmStone, x, 16, 0);
  addBox(office, 52, 0.75, 46, M.charcoal, 0, 32.3, 0);
  addSign(office, 'CP67', 'OFFICE TOWER', 18, 4.2, 0, 29.8, 22.28);

  // Serviced-residence / hospitality wing with a lighter vertical rhythm.
  const residence = new THREE.Group();
  residence.position.set(-48, 18, -27);
  root.add(residence);
  addBox(residence, 34, 36, 40, M.warmStone, 0, 18, 0, 'CP67-serviced-residences');
  addFacadeGrid(residence, { width: 34, depth: 40, floors: 9, baseY: 0, frontZ: 20.08, cols: 9, material: M.glass, windowWidth: 2.25, windowHeight: 2.2 });
  for (let floor = 0; floor <= 9; floor++) addBox(residence, 34.6, 0.18, 40.4, M.silver, 0, floor * 3.8 + 1.2, 0);
  addBox(residence, 35.4, 0.8, 41.4, M.charcoal, 0, 36.3, 0);
  addSign(residence, 'HOMELAND', 'SERVICED RESIDENCES', 19, 3.2, 0, 32.2, 20.3);

  // Seven-screen multiplex volume and its separate illuminated street-facing sign.
  const cinema = new THREE.Group();
  cinema.position.set(-6, 18, -27);
  root.add(cinema);
  addBox(cinema, 39, 12, 27, M.darkStone, 0, 6, 0, 'CP67-seven-screen-cinema');
  addBox(cinema, 39.5, 0.55, 27.5, M.charcoal, 0, 12.2, 0);
  for (let i = 0; i < 7; i++) {
    const strip = addBox(cinema, 4.7, 0.18, 0.1, M.shopGlow, -16.2 + i * 5.4, 9.2, 13.62);
    strip.material = M.shopGlow;
  }
  addSign(cinema, 'PVR CINEMAS', '7 SCREEN MULTIPLEX', 25, 4.4, 0, 10.5, 13.72);

  // Food-court terrace and rooftop dining deck with glass balustrades.
  addPlane(root, 42, 19, M.pavingLight, -12, 18.9, -2);
  addBox(root, 42, 0.16, 0.18, M.silver, -12, 20.05, -11.4);
  addBox(root, 42, 0.16, 0.18, M.silver, -12, 20.05, 7.4);
  for (const x of [-32, -22, -12, -2, 8]) {
    addBox(root, 0.16, 1.1, 0.16, M.glass, x, 19.5, -11.4);
    addBox(root, 0.16, 1.1, 0.16, M.glass, x, 19.5, 7.4);
  }
  addBox(root, 26, 0.28, 8, M.charcoal, -12, 22.8, -2);
  for (const x of [-24, 0]) addBox(root, 0.2, 4.6, 0.2, M.metal, x, 20.4, -2);
  addSign(root, 'FOOD HALL', 'DINING · CAFES · TERRACE', 18, 2.7, -12, 22.1, 7.52);

  // Rooftop plant beds, screen walls and mechanical enclosures.
  for (let i = 0; i < 8; i++) addPlanter(root, -59 + i * 16.8, -58, 8.2, 2.2);
  addBox(root, 21, 3.5, 12, M.charcoal, 12, 20.3, -44, 'CP67-roof-plant-room');
  addBox(root, 17, 2.6, 11, M.darkStone, -3, 20, -46, 'CP67-roof-service-block');

  // Basement parking access: down-ramp, portal, clearance beam and a small valet booth.
  addBox(root, 12, 0.38, 23, M.asphalt, -59, 0.08, 30);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 18), M.asphalt);
  ramp.position.set(-59, -1.0, 40);
  ramp.rotation.x = -0.16;
  root.add(ramp);
  addBox(root, 12.5, 0.45, 0.6, M.charcoal, -59, 2.8, 18);
  addSign(root, 'PARKING', 'BASEMENT · B1 / B2', 9.5, 2.5, -59, 4.4, 18.34);
  addBox(root, 4.8, 3.2, 4.2, M.warmStone, -68, 1.6, 34, 'CP67-valet-booth');
  addBox(root, 3.8, 0.4, 0.2, M.charcoal, -68, 3.5, 31.8);

  // Forecourt paving, drop-off lane and parking bays.
  addPlane(root, 146, 50, M.pavingLight, 0, 0.035, 53);
  addPlane(root, 28, 36, M.asphalt, 0, 0.055, 61);
  const dropOff = new THREE.Mesh(new THREE.RingGeometry(13.5, 17, 56), M.line);
  dropOff.rotation.x = -Math.PI / 2;
  dropOff.position.set(0, 0.085, 63);
  root.add(dropOff);
  const centreIsland = new THREE.Mesh(new THREE.CircleGeometry(11.8, 48), M.grass);
  centreIsland.rotation.x = -Math.PI / 2;
  centreIsland.position.set(0, 0.075, 63);
  root.add(centreIsland);
  addPalm(root, -5, 63, 1.15);
  addPalm(root, 5, 63, 1.15);
  addParkingMark(root, -48, 55, 8);
  addParkingMark(root, 48, 55, 8);
  addParkingMark(root, -48, 70, 8);
  addParkingMark(root, 48, 70, 8);
  for (const x of [-65, -48, -31, 31, 48, 65]) {
    addBox(root, 0.18, 0.1, 15, M.line, x, 0.09, 62);
  }

  // Landscape, bollards and pedestrian realm around the open four-side plot.
  for (const x of [-72, -55, -38, 38, 55, 72]) {
    addPlanter(root, x, 35, 10, 3.2);
    addTree(root, x, 43, 0.9);
    addTree(root, x, 82, 0.9);
  }
  for (const x of [-60, -40, -20, 20, 40, 60]) {
    addPalm(root, x, 28, 0.78);
    addPalm(root, x, 98, 0.75);
  }
  for (const x of [-68, -34, 34, 68]) {
    addLamp(root, x, 48);
    addLamp(root, x, 91);
  }
  for (let i = 0; i < 15; i++) {
    const x = -35 + i * 5;
    addCylinder(root, 0.12, 0.16, 1.0, M.silver, x, 0.5, 34, 8);
  }

  // A long illuminated fascia and subtle rooftop logo make the mall readable from a distance.
  addSign(root, 'CP67', 'SHOPPING · DINING · ENTERTAINMENT', 30, 6.0, 0, 20.4, 13.0);
  const roofLogo = addSign(root, 'CP67', 'MOHALI', 12, 2.8, 42, 50.7, -3.7);
  roofLogo.rotation.y = 0;
  const accent = new THREE.Mesh(new THREE.BoxGeometry(126, 0.18, 0.22), M.shopGlow);
  accent.position.set(0, 16.6, 13.34);
  root.add(accent);

  // Building-collision boxes are also sent to Cannon; the forecourt remains drivable.
  const obstacles = [
    { id: 'cp67-podium', x: 0, z: -22, width: 130, depth: 68, height: 18, minHeight: 0, yaw: 0 },
    { id: 'cp67-office-tower', x: 42, z: -26, width: 49, depth: 43, height: 32, minHeight: 18, yaw: 0 },
    { id: 'cp67-serviced-residence', x: -48, z: -27, width: 33, depth: 39, height: 36, minHeight: 18, yaw: 0 },
    { id: 'cp67-cinema-roof', x: -6, z: -27, width: 38, depth: 25, height: 12, minHeight: 18, yaw: 0 }
  ];

  return {
    group: root,
    obstacles,
    spawn: { x: 0, z: 112, heading: 0 },
    dispose() {
      root.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material.map) material.map.dispose();
            if (material.emissiveMap) material.emissiveMap.dispose();
            material.dispose();
          }
        }
      });
      scene.remove(root);
    }
  };
}
