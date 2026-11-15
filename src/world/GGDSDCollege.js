import * as THREE from 'three';
import { geoToWorld } from './OSMStreamer.js';

// GGDSD College, Sector 32-C, Chandigarh.
// The anchor is the mapped college feature (OSM way 129453731).
// Public campus photos are used for a recognisable, scale-oriented reconstruction:
// pink/red brick academic wings, cream bands, a landscaped courtyard and golden auditorium.
export const GGDSD_COLLEGE_GEO = Object.freeze({ lat: 30.70402, lon: 76.77231 });

const MAT = {
  brick: new THREE.MeshStandardMaterial({ color: 0xb96f68, roughness: 0.9 }),
  brickLight: new THREE.MeshStandardMaterial({ color: 0xc77e74, roughness: 0.88 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe2d7c2, roughness: 0.86 }),
  creamDark: new THREE.MeshStandardMaterial({ color: 0xb8aa91, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xaaa69b, roughness: 0.94 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xb9b5a9, roughness: 0.96 }),
  pavingAlt: new THREE.MeshStandardMaterial({ color: 0x9f9e96, roughness: 0.95 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x274b5a, metalness: 0.22, roughness: 0.22 }),
  glassLite: new THREE.MeshStandardMaterial({ color: 0x5d8792, metalness: 0.18, roughness: 0.2 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xe0d6c5, metalness: 0.12, roughness: 0.68 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xb89a43, metalness: 0.58, roughness: 0.34 }),
  goldGlass: new THREE.MeshStandardMaterial({ color: 0x9c8b4c, metalness: 0.48, roughness: 0.25, emissive: 0x30260e, emissiveIntensity: 0.12 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x57734d, roughness: 1 }),
  grassLight: new THREE.MeshStandardMaterial({ color: 0x6f875e, roughness: 1 }),
  hedge: new THREE.MeshStandardMaterial({ color: 0x31553a, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x61452f, roughness: 1 }),
  sign: new THREE.MeshStandardMaterial({ color: 0x203b43, roughness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x252d30, roughness: 0.78 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf1eee5, roughness: 0.9 })
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

function plane(parent, w, d, material, x, y, z, name = '') {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radiusTop, radiusBottom, height, material, x, y, z, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeSignTexture(title, subtitle = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#183039';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#d9c18a';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 1000, 232);
  ctx.fillStyle = '#f0e5c9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 76px Arial';
  ctx.fillText(title, 512, subtitle ? 100 : 128, 940);
  if (subtitle) {
    ctx.fillStyle = '#d9c18a';
    ctx.font = '500 31px Arial';
    ctx.fillText(subtitle.toUpperCase(), 512, 184, 940);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function sign(parent, title, subtitle, width, height, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: makeSignTexture(title, subtitle), roughness: 0.55, metalness: 0.08 })
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addFacadeWindows(parent, { x, z, width, depth, floors, cols, height, frontMaterial = MAT.glass }) {
  // Two InstancedMeshes keep hundreds of façade windows inexpensive to render.
  const perFloor = cols;
  const count = perFloor * floors;
  const frameMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.16), MAT.frame, count * 2);
  const glassMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.09), frontMaterial, count * 2);
  frameMesh.name = 'ggdsd-academic-window-frames';
  glassMesh.name = 'ggdsd-academic-window-glazing';
  const dummy = new THREE.Object3D();
  const windowW = Math.min(2.6, width / (cols + 1) * 0.66);
  const windowH = 1.72;
  let n = 0;
  for (let floor = 0; floor < floors; floor++) {
    const y = 2.1 + floor * 3.45;
    for (const side of [-1, 1]) {
      for (let col = 0; col < cols; col++) {
        const wx = x - width / 2 + (col + 1) * width / (cols + 1);
        const wz = z + side * (depth / 2 + 0.08);
        dummy.position.set(wx, y, wz);
        dummy.rotation.set(0, side < 0 ? Math.PI : 0, 0);
        dummy.scale.set(windowW, windowH, 1);
        dummy.updateMatrix();
        frameMesh.setMatrixAt(n, dummy.matrix);
        dummy.position.z -= side * 0.09;
        dummy.scale.set(windowW * 0.82, windowH * 0.83, 1);
        dummy.updateMatrix();
        glassMesh.setMatrixAt(n, dummy.matrix);
        n++;
      }
    }
  }
  frameMesh.count = glassMesh.count = n;
  frameMesh.instanceMatrix.needsUpdate = true;
  glassMesh.instanceMatrix.needsUpdate = true;
  parent.add(frameMesh, glassMesh);
}

function academicBlock(root, options) {
  const {
    id, name, subtitle, x, z, width, depth, floors = 3,
    brick = MAT.brick, cols = Math.max(8, Math.floor(width / 4.3))
  } = options;
  const height = floors * 3.45 + 1.1;
  const y = height / 2;
  box(root, width, height, depth, brick, x, y, z, id);

  // Pale horizontal floor bands and a stronger cream parapet, matching campus photos.
  for (let floor = 0; floor <= floors; floor++) {
    const bandY = 0.7 + floor * 3.45;
    box(root, width + 0.65, 0.28, depth + 0.5, MAT.cream, x, bandY, z);
  }
  box(root, width + 1.0, 0.52, depth + 0.8, MAT.cream, x, height + 0.24, z);
  box(root, width + 1.15, 0.32, depth + 0.95, MAT.creamDark, x, 0.17, z);

  // Cream corner pilasters and inset window rows.
  for (const side of [-1, 1]) {
    box(root, 0.62, height - 0.9, depth + 0.35, MAT.cream, x + side * (width / 2 - 0.45), y, z);
  }
  addFacadeWindows(root, { x, z, width: width - 3.0, depth, floors, cols, height });
  sign(root, name, subtitle, Math.min(28, width * 0.56), 2.0, x, 1.3 + 3.45, z + depth / 2 + 0.18);

  // A simple projecting entrance canopy makes each block legible at street level.
  box(root, Math.min(15, width * 0.38), 0.34, 3.5, MAT.creamDark, x, 3.5, z + depth / 2 + 1.9);
  for (const dx of [-5.6, 5.6]) {
    if (Math.abs(dx) < width / 2 - 1) box(root, 0.28, 3.2, 0.28, MAT.cream, x + dx, 1.65, z + depth / 2 + 3.0);
  }

  return { id, x, z, width: width + 1.8, depth: depth + 1.8, height };
}

function addTree(parent, x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  cylinder(tree, 0.18 * scale, 0.3 * scale, 3.25 * scale, MAT.trunk, 0, 1.62 * scale, 0, 8);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.45 * scale, 9, 7), MAT.hedge);
  crown.position.y = 3.85 * scale;
  crown.scale.set(1, 1.16, 0.92);
  crown.castShadow = true;
  tree.add(crown);
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 8, 6), MAT.grassLight);
  highlight.position.set(0.55 * scale, 4.15 * scale, 0.16 * scale);
  tree.add(highlight);
  parent.add(tree);
}

function addShrub(parent, x, z, scale = 1) {
  const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.62 * scale, 8, 6), MAT.hedge);
  shrub.position.set(x, 0.55 * scale, z);
  shrub.scale.set(1.35, 0.85, 1);
  parent.add(shrub);
}

function addPaverPath(parent, x, z, width, depth, rotation = 0) {
  const path = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), MAT.paving);
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, 0.075, z);
  path.receiveShadow = true;
  parent.add(path);
  return path;
}

export function createGGDSDCollege(scene) {
  const anchor = geoToWorld(GGDSD_COLLEGE_GEO.lat, GGDSD_COLLEGE_GEO.lon);
  const root = new THREE.Group();
  root.name = 'GGDSD-College-Sector-32C-Chandigarh';
  root.position.set(anchor.x, 0, anchor.z);
  scene.add(root);

  // Approximate site envelope around the mapped college feature.
  // This is a site-scale reconstruction, not a surveyed cadastral boundary.
  plane(root, 250, 250, MAT.grass, 0, 0.006, 0, 'ggdsd-campus-landscape');

  // Main circulation loop and paved central courtyard.
  addPaverPath(root, 0, 0, 190, 7.5, 0);
  addPaverPath(root, 0, -102, 214, 7, 0);
  addPaverPath(root, 0, 102, 214, 7, 0);
  addPaverPath(root, -104, 0, 7, 214, 0);
  addPaverPath(root, 104, 0, 7, 214, 0);
  plane(root, 100, 70, MAT.paving, 0, 0.085, 4, 'ggdsd-central-courtyard');
  plane(root, 66, 42, MAT.grassLight, -3, 0.095, 2, 'ggdsd-central-lawn');
  addPaverPath(root, -3, -21, 70, 3.5, 0);
  addPaverPath(root, -3, 24, 70, 3.5, 0);
  addPaverPath(root, -37, 1, 3.5, 45, 0);
  addPaverPath(root, 31, 1, 3.5, 45, 0);

  // Academic buildings arranged around the courtyard, with the pink/red brick,
  // cream concrete bands and repeated rectangular windows visible in references.
  const obstacles = [];
  const blocks = [
    academicBlock(root, { id: 'ggdsd-science-pg-block', name: 'SCIENCE BLOCK', subtitle: 'POST GRADUATE BLOCK', x: -24, z: -79, width: 104, depth: 25, floors: 4, brick: MAT.brickLight, cols: 19 }),
    academicBlock(root, { id: 'ggdsd-it-centre', name: 'I.T. CENTRE', subtitle: 'COMPUTER SCIENCE & IT', x: -82, z: -18, width: 48, depth: 28, floors: 3, brick: MAT.brick, cols: 9 }),
    academicBlock(root, { id: 'ggdsd-roshan-lal-verma-block', name: 'PROF. ROSHAN LAL VERMA BLOCK', subtitle: 'ACADEMIC BLOCK', x: 8, z: -18, width: 70, depth: 28, floors: 3, brick: MAT.brickLight, cols: 13 }),
    academicBlock(root, { id: 'ggdsd-administrative-block', name: 'ADMINISTRATIVE BLOCK', subtitle: 'G.G.D.S.D. COLLEGE', x: 76, z: -51, width: 54, depth: 30, floors: 3, brick: MAT.brick, cols: 10 }),
    academicBlock(root, { id: 'ggdsd-commerce-block', name: 'COMMERCE BLOCK', subtitle: 'CLASSROOMS & DEPARTMENTS', x: 12, z: 58, width: 86, depth: 26, floors: 3, brick: MAT.brick, cols: 16 })
  ];
  blocks.forEach(block => obstacles.push({
    id: block.id, x: block.x, z: block.z, width: block.width, depth: block.depth,
    height: block.height, minHeight: 0, yaw: 0
  }));

  // Distinctive golden auditorium volume shown in campus photographs.
  const auditorium = new THREE.Group();
  auditorium.name = 'ggdsd-golden-auditorium';
  auditorium.position.set(82, 0, 55);
  root.add(auditorium);
  box(auditorium, 46, 11.5, 30, MAT.gold, 0, 5.75, 0, 'ggdsd-auditorium-shell');
  box(auditorium, 44.8, 8.4, 0.24, MAT.goldGlass, 0, 5.7, 15.15, 'ggdsd-auditorium-glass-front');
  box(auditorium, 44.8, 8.4, 0.24, MAT.goldGlass, 0, 5.7, -15.15, 'ggdsd-auditorium-glass-rear');
  for (let x = -21; x <= 21; x += 3.5) {
    box(auditorium, 0.14, 8.5, 0.35, MAT.gold, x, 5.7, 15.0);
  }
  box(auditorium, 47.5, 0.52, 31.5, MAT.cream, 0, 11.65, 0);
  sign(auditorium, 'AUDITORIUM', 'G.G.D.S.D. COLLEGE', 24, 3.2, 0, 6.0, 15.34);
  obstacles.push({ id: 'ggdsd-golden-auditorium', x: 82, z: 55, width: 47, depth: 31, height: 12.4, minHeight: 0, yaw: 0 });

  // Landscaped seating court, planters and the college's broad garden setting.
  for (const [x, z] of [[-42, 5], [-25, 5], [-8, 5], [9, 5], [26, 5], [43, 5]]) {
    addShrub(root, x, z, 1.0);
  }
  for (const [x, z, s] of [
    [-102, -87, 1.0], [-78, -103, 0.85], [-46, -108, 0.9], [-5, -109, 0.9],
    [38, -108, 0.95], [88, -91, 0.95], [104, -44, 0.85], [106, 7, 0.9],
    [103, 93, 0.92], [62, 109, 0.9], [12, 110, 0.9], [-48, 109, 0.9],
    [-100, 82, 0.9], [-108, 27, 0.85], [-107, -34, 0.9]
  ]) addTree(root, x, z, s);
  for (let i = 0; i < 10; i++) {
    addShrub(root, -38 + i * 8.3, -30, 0.82);
    addShrub(root, -38 + i * 8.3, 31, 0.82);
  }

  // Entrance court and a visible gateway facing the southern campus approach.
  plane(root, 64, 24, MAT.paving, 0, 0.11, 111, 'ggdsd-main-entry-plaza');
  for (const x of [-17, 17]) {
    box(root, 2.4, 6.6, 2.4, MAT.brick, x, 3.3, 113, 'ggdsd-gate-pillar');
    box(root, 3.1, 0.48, 3.1, MAT.cream, x, 6.72, 113);
  }
  box(root, 36, 0.85, 1.2, MAT.cream, 0, 6.1, 113, 'ggdsd-entry-gate-beam');
  sign(root, 'G.G.D.S.D. COLLEGE', 'SECTOR 32-C · CHANDIGARH', 30, 4.4, 0, 7.4, 113.72);
  for (const x of [-12, -8, 8, 12]) cylinder(root, 0.16, 0.2, 1.2, MAT.creamDark, x, 0.6, 105, 8);

  // Paved arrival walk with alternating paver strips and low garden beds.
  addPaverPath(root, 0, 91, 58, 6, 0);
  for (const x of [-27, -18, -9, 9, 18, 27]) {
    box(root, 0.22, 0.06, 18, MAT.cream, x, 0.18, 80);
  }
  for (const x of [-90, -65, 65, 90]) {
    box(root, 12, 0.7, 3.0, MAT.concrete, x, 0.36, 105);
    box(root, 11, 0.16, 2.2, MAT.grass, x, 0.78, 105);
    for (let i = 0; i < 4; i++) addShrub(root, x - 4 + i * 2.6, 105, 0.76);
  }

  // Lamp columns around the courtyard add scale and campus-night identity.
  for (const [x, z] of [[-43, -40], [43, -40], [-43, 42], [43, 42], [-93, 5], [93, 5]]) {
    cylinder(root, 0.07, 0.11, 5.3, MAT.dark, x, 2.65, z, 8);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), MAT.white);
    lamp.position.set(x, 5.3, z);
    root.add(lamp);
  }

  return {
    group: root,
    center: new THREE.Vector3(anchor.x, 0, anchor.z),
    obstacles,
    bounds: { minX: anchor.x - 126, maxX: anchor.x + 126, minZ: anchor.z - 126, maxZ: anchor.z + 126 }
  };
}
