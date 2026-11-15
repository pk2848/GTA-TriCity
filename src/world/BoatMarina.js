import * as THREE from 'three';

export function createBoatMarina(scene) {
  const group = new THREE.Group();
  group.name = 'TriCity-waterfront-marina';
  group.position.set(190, 0, 220);
  scene.add(group);

  const sand = new THREE.MeshStandardMaterial({ color: 0x958d72, roughness: 0.98 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x526b4d, roughness: 1 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x777e7b, roughness: 0.94 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x75543a, roughness: 0.86 });
  const darkTimber = new THREE.MeshStandardMaterial({ color: 0x3b3329, roughness: 0.92 });
  const water = new THREE.MeshPhysicalMaterial({
    color: 0x286779,
    roughness: 0.19,
    metalness: 0.16,
    clearcoat: 0.85,
    clearcoatRoughness: 0.11,
    transparent: true,
    opacity: 0.94
  });

  const shore = new THREE.Mesh(new THREE.BoxGeometry(142, 0.38, 104), sand);
  shore.position.set(0, -0.22, 0);
  shore.receiveShadow = true;
  group.add(shore);

  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(128, 84, 1, 1), water);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, 0.05, 0);
  waterMesh.receiveShadow = true;
  waterMesh.name = 'marina-water-surface';
  group.add(waterMesh);

  // A low retaining edge and planted shore make the artificial lake read as a place.
  for (const [x, z, w, d] of [
    [0, -44, 134, 3], [0, 44, 134, 3], [-67, 0, 3, 86], [67, 0, 3, 86]
  ]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.72, d), concrete);
    edge.position.set(x, 0.14, z);
    edge.castShadow = true;
    edge.receiveShadow = true;
    group.add(edge);
  }

  // Timber pier on the north bank, with bollards and warm approach lights.
  const pier = new THREE.Group();
  pier.name = 'marina-pier';
  pier.position.set(0, -0.16, 51);
  group.add(pier);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 0.42, 12), timber);
  deck.position.y = 0;
  deck.receiveShadow = true;
  deck.castShadow = true;
  pier.add(deck);
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.44, 11.7), darkTimber);
    plank.position.set(-13.1 + i * 2.02, 0.01, 0);
    pier.add(plank);
  }
  for (const x of [-12.5, 12.5]) for (const z of [-4.6, 4.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.7, 10), darkTimber);
    post.position.set(x, -0.3, z);
    pier.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), timber);
    cap.position.set(x, 0.55, z);
    pier.add(cap);
  }
  for (const x of [-9, 9]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), darkTimber);
    bollard.position.set(x, 0.6, -4.8);
    pier.add(bollard);
    const light = new THREE.PointLight(0xffd68c, 2.5, 13);
    light.position.set(x, 1.4, -4.8);
    pier.add(light);
  }

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 768;
  signCanvas.height = 192;
  const ctx = signCanvas.getContext('2d');
  ctx.fillStyle = '#17262a';
  ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
  ctx.strokeStyle = '#e0c27c';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 748, 172);
  ctx.fillStyle = '#f0dfb6';
  ctx.font = 'bold 82px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRICITY MARINA', 384, 80);
  ctx.font = 'bold 28px Arial';
  ctx.fillText('YACHT PIER  ·  MOHALI', 384, 145);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 4.2),
    new THREE.MeshBasicMaterial({ map: signTexture })
  );
  sign.position.set(0, 5.0, 57);
  sign.rotation.y = Math.PI;
  group.add(sign);

  const dockPosition = new THREE.Vector3(190, 0.05, 271);
  const boatPosition = new THREE.Vector3(190, 0.03, 218);
  return {
    group,
    waterMesh,
    boatPosition,
    dockPosition,
    waterBounds: { minX: -61, maxX: 61, minZ: -38, maxZ: 38 },
    dockRadius: 16,
    groundY: 0.03
  };
}
