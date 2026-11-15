import * as THREE from 'three';

function makePadLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#172027';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#f3d36f';
  ctx.lineWidth = 12;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = '#f8e9b5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 100px Arial';
  ctx.fillText('CP67 HELIPAD', 512, 112);
  ctx.font = 'bold 38px Arial';
  ctx.fillText('SECTOR 67  ·  MOHALI', 512, 194);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHelipad(scene) {
  // Open forecourt apron adjacent to the CP67 Mall campus (world units are metres).
  const position = new THREE.Vector3(91, 0, 79);
  const group = new THREE.Group();
  group.name = 'CP67-helipad-sector-67';
  group.position.copy(position);

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x353d40, roughness: 0.94 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8b918d, roughness: 0.96 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf1c94d, roughness: 0.76 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x161e21, roughness: 0.9 });

  const apron = new THREE.Mesh(new THREE.BoxGeometry(38, 0.28, 38), concrete);
  apron.position.y = 0.02;
  apron.receiveShadow = true;
  group.add(apron);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(15.7, 15.7, 0.16, 64), asphalt);
  pad.position.y = 0.23;
  pad.receiveShadow = true;
  group.add(pad);

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(14.3, 0.22, 8, 72), yellow);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.325;
  group.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(11.6, 0.105, 6, 72), white);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.326;
  group.add(innerRing);

  // Large H marking with an outer circle and clear landing-zone typography.
  for (const x of [-2.15, 2.15]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 5.3), white);
    upright.position.set(x, 0.33, 0);
    group.add(upright);
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.035, 0.58), white);
  crossbar.position.set(0, 0.33, 0);
  group.add(crossbar);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 4.25),
    new THREE.MeshBasicMaterial({ map: makePadLabel(), transparent: false })
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.34, 10.4);
  group.add(label);

  for (const x of [-16.5, 16.5]) {
    for (const z of [-16.5, 16.5]) {
      const light = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.32, 10), yellow);
      light.position.set(x, 0.35, z);
      group.add(light);
      const glow = new THREE.PointLight(0xffd86b, 2.2, 8);
      glow.position.set(x, 0.8, z);
      group.add(glow);
    }
  }

  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.6, 10), dark);
  signPole.position.set(20, 2.3, 15);
  group.add(signPole);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 1.55),
    new THREE.MeshStandardMaterial({ map: makePadLabel(), roughness: 0.58, emissive: 0x292014, emissiveIntensity: 0.3 })
  );
  sign.position.set(20, 4.35, 15);
  sign.rotation.y = -0.4;
  group.add(sign);

  scene.add(group);
  return {
    group,
    position: new THREE.Vector3(position.x, 0.32, position.z),
    landingRadius: 13.5,
    groundY: 0.32
  };
}
