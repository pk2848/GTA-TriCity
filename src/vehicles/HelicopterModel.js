import * as THREE from 'three';

const materials = {
  body: new THREE.MeshStandardMaterial({ color: 0x26343b, metalness: 0.56, roughness: 0.36 }),
  bodyLight: new THREE.MeshStandardMaterial({ color: 0x66747b, metalness: 0.48, roughness: 0.4 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x183d52, metalness: 0.28, roughness: 0.12, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x10171b, roughness: 0.72 }),
  rotor: new THREE.MeshStandardMaterial({ color: 0x171d20, metalness: 0.35, roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd52c25, emissive: 0x4b0805, emissiveIntensity: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe5e4d9, emissive: 0x292929, emissiveIntensity: 0.18 })
};

function addBox(parent, size, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radiusTop, radiusBottom, length, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 16),
    material
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * A self-contained, game-ready utility helicopter. It is procedural so the
 * game does not depend on a third-party aircraft binary or an external URL.
 * Local axes: Y up, nose toward -Z.
 */
export function createHelicopterModel() {
  const root = new THREE.Group();
  root.name = 'procedural-light-utility-helicopter';

  const fuselage = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 20),
    materials.body
  );
  fuselage.position.set(0, 1.28, 0.18);
  fuselage.scale.set(1.02, 0.72, 1.86);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  root.add(fuselage);

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 18),
    materials.bodyLight
  );
  nose.position.set(0, 1.24, -1.12);
  nose.scale.set(0.92, 0.58, 0.88);
  nose.castShadow = true;
  root.add(nose);

  // Panoramic cockpit glazing and side cabin windows.
  const windscreen = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0.08, Math.PI * 0.54),
    materials.glass
  );
  windscreen.position.set(0, 1.5, -1.22);
  windscreen.scale.set(0.86, 0.47, 0.74);
  windscreen.rotation.x = -0.13;
  root.add(windscreen);

  for (const side of [-1, 1]) {
    addBox(root, [0.055, 0.55, 1.08], materials.glass, [side * 0.965, 1.48, -0.08]);
    addBox(root, [0.055, 0.48, 0.78], materials.glass, [side * 0.91, 1.43, 0.95]);
    addBox(root, [0.07, 0.95, 0.075], materials.bodyLight, [side * 1.005, 1.22, 0.48]);
    addBox(root, [0.16, 0.12, 0.22], materials.dark, [side * 1.02, 1.05, -0.15]);
    addBox(root, [0.22, 0.08, 0.34], materials.bodyLight, [side * 0.92, 0.9, 1.55]);
  }

  // Lower belly, cabin floor and nose landing light.
  addBox(root, [1.28, 0.18, 2.2], materials.dark, [0, 0.78, 0.1]);
  const landingLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff0b6 })
  );
  landingLight.position.set(0, 1.02, -1.98);
  root.add(landingLight);

  // Tail boom and stabilizers.
  addCylinder(root, 0.17, 0.29, 3.85, materials.bodyLight, [0, 1.43, 2.48], [Math.PI / 2, 0, 0]);
  addBox(root, [0.18, 1.38, 0.82], materials.body, [0, 2.0, 4.16], [0.08, 0, 0]);
  addBox(root, [2.05, 0.11, 0.46], materials.bodyLight, [0, 1.65, 3.7]);

  // Tail rotor and protective hub.
  const tailRotor = new THREE.Group();
  tailRotor.name = 'helicopter-tail-rotor';
  tailRotor.position.set(0.27, 1.68, 4.28);
  addCylinder(tailRotor, 0.11, 0.11, 0.22, materials.bodyLight, [0, 0, 0], [0, 0, Math.PI / 2]);
  addBox(tailRotor, [0.13, 1.38, 0.075], materials.rotor, [0, 0, 0]);
  addBox(tailRotor, [1.38, 0.13, 0.075], materials.rotor, [0, 0, 0]);
  root.add(tailRotor);

  // Landing skids and their four support struts.
  for (const side of [-1, 1]) {
    addBox(root, [0.14, 0.14, 4.4], materials.dark, [side * 0.92, 0.2, 0.25]);
    for (const z of [-1.05, 1.43]) {
      addBox(root, [0.095, 0.76, 0.11], materials.bodyLight, [side * 0.78, 0.52, z], [0.1, 0, side * -0.08]);
    }
  }

  // Rotor mast, hub and animated twin main blades.
  addCylinder(root, 0.12, 0.16, 0.72, materials.bodyLight, [0, 2.13, 0.05]);
  const mainRotor = new THREE.Group();
  mainRotor.name = 'helicopter-main-rotor';
  mainRotor.position.set(0, 2.53, 0.05);
  addCylinder(mainRotor, 0.22, 0.22, 0.16, materials.bodyLight, [0, 0, 0]);
  addCylinder(mainRotor, 0.11, 0.11, 0.24, materials.dark, [0, 0.13, 0]);
  addBox(mainRotor, [7.5, 0.055, 0.2], materials.rotor, [0, 0.25, 0]);
  addBox(mainRotor, [7.5, 0.055, 0.2], materials.rotor, [0, 0.25, 0], [0, Math.PI / 2, 0]);
  root.add(mainRotor);

  // Anti-collision beacons and navigation lights.
  const beaconTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), materials.red);
  beaconTop.position.set(0, 2.0, 0.3);
  root.add(beaconTop);
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff3328 : 0x36e18b })
    );
    lamp.position.set(side * 1.1, 1.47, 0.2);
    root.add(lamp);
  }

  root.userData.rotorGroups = [
    { object: mainRotor, axis: 'y', speed: 34 },
    { object: tailRotor, axis: 'z', speed: 48 }
  ];
  root.userData.vehicleType = 'helicopter';
  return root;
}
