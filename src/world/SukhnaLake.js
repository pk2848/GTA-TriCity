import * as THREE from 'three';
import { geoToWorld } from './OSMStreamer.js';

// Sukhna Lake, Sector 1, Chandigarh. The base water outline is the OSM water
// polygon already streamed by OSMStreamer; this module adds the recognisable
// promenade, boating edge, island details, regulator-end garden and Shivalik backdrop.
export const SUKHNA_LAKE_GEO = Object.freeze({ lat: 30.7421, lon: 76.8188 });
export const GARDEN_OF_SILENCE_GEO = Object.freeze({ lat: 30.73834, lon: 76.82975 });

const M = {
  sandstone: new THREE.MeshStandardMaterial({ color: 0x8d8577, roughness: 0.96 }),
  sandstoneLight: new THREE.MeshStandardMaterial({ color: 0xb2a999, roughness: 0.94 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x777a75, roughness: 0.96 }),
  concreteLight: new THREE.MeshStandardMaterial({ color: 0xc1bdb2, roughness: 0.94 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xc3bdae, roughness: 0.98 }),
  pavingDark: new THREE.MeshStandardMaterial({ color: 0x827f75, roughness: 0.98 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x59754d, roughness: 1 }),
  grassLight: new THREE.MeshStandardMaterial({ color: 0x7a8c5d, roughness: 1 }),
  tree: new THREE.MeshStandardMaterial({ color: 0x315b3c, roughness: 1 }),
  treeLight: new THREE.MeshStandardMaterial({ color: 0x648052, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x61472f, roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x48565a, metalness: 0.58, roughness: 0.38 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x4c514d, metalness: 0.28, roughness: 0.72 }),
  sign: new THREE.MeshStandardMaterial({ color: 0x1a3034, roughness: 0.72 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe1ded3, roughness: 0.9 }),
  buddha: new THREE.MeshStandardMaterial({ color: 0xb8aa8c, roughness: 0.86 }),
  boatBlue: new THREE.MeshStandardMaterial({ color: 0x187a9a, roughness: 0.54 }),
  boatYellow: new THREE.MeshStandardMaterial({ color: 0xe2b844, roughness: 0.62 }),
  boatRed: new THREE.MeshStandardMaterial({ color: 0xc64d42, roughness: 0.6 }),
  boatGreen: new THREE.MeshStandardMaterial({ color: 0x43875f, roughness: 0.58 }),
  waterEdge: new THREE.MeshStandardMaterial({ color: 0x344e4e, roughness: 0.84 })
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

function cylinder(parent, rt, rb, h, material, x, y, z, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(parent, material, x, y, z, sx, sy, sz, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(6, segments - 2)), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function sign(parent, title, subtitle, width, height, x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#183035'; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#d4bd86'; ctx.lineWidth = 9; ctx.strokeRect(12, 12, 1000, 232);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f1e6cc'; ctx.font = '700 78px Arial';
  ctx.fillText(title, 512, subtitle ? 98 : 128, 940);
  if (subtitle) {
    ctx.fillStyle = '#d4bd86'; ctx.font = '500 30px Arial';
    ctx.fillText(subtitle.toUpperCase(), 512, 184, 940);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, metalness: 0.06 })
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function ribbon(parent, coordinates, width, y, material, name) {
  const points = coordinates.map(([lat, lon]) => geoToWorld(lat, lon));
  if (points.length < 2) return null;
  const positions = [], indices = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1;
    dx /= length; dz /= length;
    const nx = -dz * width / 2;
    const nz = dx * width / 2;
    const p = points[i];
    positions.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz);
    if (i < points.length - 1) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 2, k + 3, k + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  parent.add(mesh);
  return { mesh, points };
}

function tree(parent, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  cylinder(g, 0.17 * scale, 0.27 * scale, 3.0 * scale, M.trunk, 0, 1.5 * scale, 0, 8);
  sphere(g, M.tree, 0, 3.6 * scale, 0, 1.55 * scale, 1.8 * scale, 1.45 * scale, 9);
  sphere(g, M.treeLight, 0.55 * scale, 4.05 * scale, 0.25 * scale, 0.8 * scale, 0.9 * scale, 0.75 * scale, 8);
  parent.add(g);
  return g;
}

function bench(parent, x, z, angle = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  box(g, 3.0, 0.18, 0.72, M.sandstone, 0, 0.75, 0);
  box(g, 3.0, 0.16, 0.18, M.sandstoneLight, 0, 1.35, -0.25);
  for (const x of [-1.15, 1.15]) {
    box(g, 0.12, 0.7, 0.12, M.metal, x, 0.38, -0.12);
  }
  parent.add(g);
}

function createPedalo(parent, x, z, material, angle = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.52, z);
  g.rotation.y = angle;
  // Compact catamaran-style hull with two paddle seats.
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 3.8, 4, 8), material);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(0.55, 0.72, 1.0);
  hull.castShadow = true;
  g.add(hull);
  box(g, 4.8, 0.22, 2.3, M.white, 0, 0.38, 0);
  for (const zSeat of [-0.62, 0.62]) {
    box(g, 0.95, 0.22, 0.7, M.concreteLight, 0.2, 0.75, zSeat);
    cylinder(g, 0.09, 0.09, 0.9, M.metal, -0.3, 0.8, zSeat, 8);
  }
  parent.add(g);
  return g;
}

function addPromenade(parent) {
  // The dam-top pedestrian promenade follows the south shore; a geotagged
  // Wikimedia photograph places the walking path near 30.736392, 76.819558.
  const route = [
    [30.7368, 76.8072],
    [30.7365, 76.8102],
    [30.7362, 76.8134],
    [30.73615, 76.8164],
    [30.73630, 76.8195],
    [30.73655, 76.8222],
    [30.73705, 76.8250],
    [30.73765, 76.8273],
    [30.73815, 76.82915]
  ];
  const path = ribbon(parent, route, 12.5, 0.17, M.paving, 'sukhna-dam-top-promenade');
  ribbon(parent, route, 1.1, 0.28, M.sandstoneLight, 'sukhna-promenade-lakeside-edge');

  if (path?.points) {
    const pts = path.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const angle = Math.atan2(-dx, -dz);
      const length = Math.hypot(dx, dz);
      const segments = Math.max(1, Math.floor(length / 55));
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const x = THREE.MathUtils.lerp(a.x, b.x, t);
        const z = THREE.MathUtils.lerp(a.z, b.z, t);
        if (s % 2 === 0) {
          const sideX = x + Math.cos(angle) * 5.0;
          const sideZ = z - Math.sin(angle) * 5.0;
          cylinder(parent, 0.14, 0.18, 1.25, M.metal, sideX, 0.85, sideZ, 8);
          sphere(parent, M.gold, sideX, 1.55, sideZ, 0.22, 0.16, 0.22, 7);
        }
        if (s % 3 === 1) bench(parent, x - Math.cos(angle) * 3.2, z + Math.sin(angle) * 3.2, angle);
      }
    }
  }

  // Low stone parapet between the pedestrian path and the water edge.
  const edge = new THREE.CatmullRomCurve3(path.points.map(p => new THREE.Vector3(p.x, 0.48, p.z)));
  const coping = new THREE.Mesh(new THREE.TubeGeometry(edge, 170, 0.3, 5, false), M.sandstone);
  coping.castShadow = true;
  parent.add(coping);
}

function createIsland(parent, center) {
  const island = new THREE.Group();
  island.name = 'Sukhna-Lake-landscaped-island';
  island.position.copy(center);
  parent.add(island);

  const rockBase = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 56), M.sandstone);
  rockBase.scale.set(102, 1.1, 48);
  rockBase.position.y = 0.45;
  rockBase.castShadow = true; rockBase.receiveShadow = true;
  island.add(rockBase);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 56), M.grass);
  top.scale.set(96, 0.45, 43);
  top.position.y = 1.15;
  top.receiveShadow = true;
  island.add(top);

  // Pale branching garden walk inspired by the distinctive landscaped island path.
  const localPath = [
    new THREE.Vector3(-49, 1.45, 2),
    new THREE.Vector3(-27, 1.45, -2),
    new THREE.Vector3(-7, 1.45, 0),
    new THREE.Vector3(9, 1.45, -3),
    new THREE.Vector3(34, 1.45, -1)
  ];
  const mainCurve = new THREE.CatmullRomCurve3(localPath);
  const mainWalk = new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 70, 2.6, 6, false), M.paving);
  island.add(mainWalk);
  for (const branch of [
    [[-4, 1.45, 0], [-8, 1.45, -16], [-18, 1.45, -26]],
    [[8, 1.45, -2], [14, 1.45, -15], [28, 1.45, -24]],
    [[8, 1.45, -2], [18, 1.45, 12], [37, 1.45, 24]]
  ]) {
    const curve = new THREE.CatmullRomCurve3(branch.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
    island.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 2.0, 6, false), M.paving));
  }

  // Circular viewing deck and a light sculptural centrepiece.
  cylinder(island, 8.8, 9.2, 0.55, M.sandstoneLight, 5, 1.5, -1, 40);
  cylinder(island, 5.4, 5.8, 0.25, M.paving, 5, 1.88, -1, 36);
  cylinder(island, 0.65, 0.85, 5.5, M.concreteLight, 5, 4.7, -1, 16);
  sphere(island, M.white, 5, 7.7, -1, 1.6, 1.0, 1.6, 10);

  for (const [x,z,s] of [
    [-72,-20,0.8],[-52,24,0.7],[-14,28,0.7],[42,28,0.7],[72,9,0.8],
    [58,-27,0.7],[-36,-28,0.75]
  ]) tree(island, x, z, s);
  for (const x of [-30, 0, 30]) bench(island, x, 16, Math.PI);
}

function createBoatLanding(parent) {
  const dockGeo = geoToWorld(30.741377, 76.812961);
  const dock = new THREE.Group();
  dock.name = 'Sukhna-Lake-boating-pier';
  dock.position.set(dockGeo.x, 0, dockGeo.z);
  parent.add(dock);

  // Access apron and floating pontoon.
  box(dock, 34, 0.5, 24, M.sandstoneLight, 0, 0.35, 0);
  box(dock, 8, 0.4, 74, M.concreteLight, 0, 0.45, -45);
  box(dock, 26, 0.55, 34, M.sandstone, 0, 0.35, -92);
  box(dock, 23.5, 0.18, 31, M.paving, 0, 0.74, -92);
  for (const x of [-11, 11]) for (const z of [-104, -92, -80]) {
    cylinder(dock, 0.24, 0.3, 4.8, M.metal, x, -1.55, z, 10);
  }
  for (const x of [-10, 10]) {
    box(dock, 0.25, 1.1, 28, M.rail, x, 1.18, -89);
  }
  sign(dock, 'SUKHNA LAKE', 'BOATING · PEDAL BOATS · ROWING', 20, 4.0, 0, 5.0, -16);

  createPedalo(dock, -6, -98, M.boatBlue, 0.08);
  createPedalo(dock, 1, -111, M.boatYellow, -0.1);
  createPedalo(dock, 7, -100, M.boatRed, 0.12);
  createPedalo(dock, 0, -80, M.boatGreen, 0);
}

function createLakeClub(parent) {
  const anchor = geoToWorld(30.7417, 76.8120);
  const root = new THREE.Group();
  root.name = 'Sukhna-Lake-Club';
  root.position.set(anchor.x + 50, 0, anchor.z + 72);
  parent.add(root);

  box(root, 58, 0.65, 42, M.paving, 0, 0.3, 0);
  box(root, 52, 4.2, 28, M.concreteLight, 0, 2.3, 0);
  box(root, 55, 0.55, 31, M.white, 0, 4.7, 0);
  for (const x of [-23,-12,0,12,23]) {
    cylinder(root, 0.35, 0.45, 4.5, M.white, x, 2.45, 14.2, 12);
  }
  box(root, 48, 0.38, 19, M.whiteShade, 0, 4.72, 13.5);
  for (let i=0;i<8;i++) {
    box(root, 5.2, 2.1, 0.18, M.glassLight, -21+i*6, 2.4, 14.25);
  }
  sign(root, 'LAKE CLUB', 'SUKHNA LAKE · CHANDIGARH', 22, 4.0, 0, 6.4, 14.6);
  for (const x of [-30,30]) tree(root,x,22,0.85);
}

function createGardenOfSilence(parent) {
  const anchor = geoToWorld(GARDEN_OF_SILENCE_GEO.lat, GARDEN_OF_SILENCE_GEO.lon);
  const root = new THREE.Group();
  root.name = 'Sukhna-Garden-of-Silence';
  root.position.set(anchor.x, 0, anchor.z);
  parent.add(root);

  // Concentric circular steps and a seated Buddha, matching the official tourism description.
  for (let i = 0; i < 7; i++) {
    const radius = 48 - i * 5.8;
    const height = 0.48;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 1.5, height, 80), i % 2 ? M.paving : M.sandstoneLight);
    step.position.y = i * 0.42 + 0.24;
    step.receiveShadow = true; step.castShadow = true;
    root.add(step);
  }
  cylinder(root, 10.5, 11.5, 0.9, M.sandstone, 0, 3.45, 0, 56);
  cylinder(root, 8.2, 8.8, 0.45, M.paving, 0, 4.12, 0, 56);

  const buddha = new THREE.Group();
  buddha.name = 'seated-buddha-sculpture';
  buddha.position.set(0, 4.3, 0);
  root.add(buddha);
  sphere(buddha, M.buddha, 0, 3.0, 0, 5.3, 5.7, 3.8, 14); // torso
  sphere(buddha, M.buddha, 0, 7.7, 0.2, 3.0, 3.2, 2.8, 14); // head
  sphere(buddha, M.buddha, 0, 9.0, -0.05, 2.3, 1.1, 2.25, 12); // topknot
  sphere(buddha, M.buddha, 0, 0.9, 3.0, 7.4, 1.55, 5.0, 12); // crossed legs
  sphere(buddha, M.buddha, -4.0, 3.1, 2.5, 1.5, 3.0, 1.55, 10);
  sphere(buddha, M.buddha, 4.0, 3.1, 2.5, 1.5, 3.0, 1.55, 10);
  sphere(buddha, M.buddha, 0, 2.0, 5.4, 3.4, 0.65, 2.3, 10);

  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI * 2 / 20;
    const x = Math.cos(angle) * 52, z = Math.sin(angle) * 52;
    cylinder(root, 0.14, 0.18, 1.15, M.metal, x, 0.58, z, 8);
  }
  sign(root, 'GARDEN OF SILENCE', 'SUKHNA LAKE · SECTOR 1', 35, 4.6, 0, 7.4, 58);
  tree(root, -60, -20, 0.9);
  tree(root, 60, -20, 0.9);
  tree(root, -55, 42, 0.85);
  tree(root, 55, 42, 0.85);
  return { center: new THREE.Vector3(anchor.x, 0, anchor.z) };
}

function createShivalikBackdrop(parent, center) {
  // A lightweight, low-poly foothill ridge beyond the northern shore. OSM forest
  // and reserve polygons remain visible beneath/around this distant silhouette.
  const width = 3300, depth = 580, cols = 44, rows = 10;
  const positions = [], indices = [];
  for (let iz = 0; iz <= rows; iz++) {
    const v = iz / rows;
    for (let ix = 0; ix <= cols; ix++) {
      const u = ix / cols;
      const x = (u - 0.5) * width;
      const z = (v - 0.5) * depth;
      const envelope = Math.sin(v * Math.PI);
      const peakMix = 0.45 + 0.35 * Math.sin(u * Math.PI * 5.2 + 0.35) + 0.16 * Math.sin(u * Math.PI * 10.0);
      const y = 9 + Math.max(0, peakMix) * envelope * 96;
      positions.push(x, y, z);
      if (ix < cols && iz < rows) {
        const a = iz * (cols + 1) + ix;
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const hill = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x53694b, roughness: 1, side: THREE.DoubleSide }));
  hill.name = 'Shivalik-foothill-backdrop';
  hill.position.set(center.x, 0, center.z - 1160);
  hill.receiveShadow = true;
  parent.add(hill);
}

export function createSukhnaLake(scene) {
  const centerGeo = geoToWorld(SUKHNA_LAKE_GEO.lat, SUKHNA_LAKE_GEO.lon);
  const center = new THREE.Vector3(centerGeo.x, 0, centerGeo.z);
  const root = new THREE.Group();
  root.name = 'Sukhna-Lake-Sector-1-Chandigarh';
  scene.add(root);

  addPromenade(root);
  createIsland(root, new THREE.Vector3(center.x + 115, 0, center.z - 55));
  createBoatLanding(root);
  createLakeClub(root);
  const garden = createGardenOfSilence(root);
  createShivalikBackdrop(root, center);

  // A broad low planting belt suggests the reserve-forest edge without replacing
  // the actual OSM land-use and water polygons.
  for (let i = 0; i < 26; i++) {
    const x = center.x - 1120 + i * 88;
    const z = center.z - 850 + Math.sin(i * 0.42) * 50;
    if (i % 2 === 0) tree(root, x, z, 1.0 + (i % 3) * 0.12);
  }

  return {
    group: root,
    center,
    gardenCenter: garden.center,
    bounds: { minX: center.x - 1850, maxX: center.x + 1850, minZ: center.z - 1500, maxZ: center.z + 900 }
  };
}
