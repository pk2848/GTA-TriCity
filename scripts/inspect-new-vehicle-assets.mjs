import fs from 'node:fs';
import path from 'node:path';

const directory = path.resolve('public/models/vehicles');
const names = [
  'Model No-08.glb',
  'animated_civilian_helicopter.glb',
  'animated_yacht.glb',
  'helipad.glb'
];

for (const name of names) {
  const file = path.join(directory, name);
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ file: name, exists: false }));
    continue;
  }
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'glTF') {
    console.log(JSON.stringify({ file: name, validGLB: false, bytes: buffer.length }));
    continue;
  }
  const jsonLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString('ascii', 16, 20);
  if (chunkType !== 'JSON' || jsonLength <= 0 || 20 + jsonLength > buffer.length) {
    console.log(JSON.stringify({ file: name, validGLB: false, bytes: buffer.length, chunkType }));
    continue;
  }
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/\\0+$/u, '').trim());
  const nodeNames = (gltf.nodes || []).map(node => node.name).filter(Boolean);
  const meshNames = (gltf.meshes || []).map(mesh => mesh.name).filter(Boolean);
  const animationNames = (gltf.animations || []).map(animation => animation.name || 'unnamed');
  const extras = gltf.asset?.extras || {};
  const ext = gltf.extensionsUsed || [];
  const accessorBounds = (gltf.accessors || [])
    .filter(accessor => accessor.min && accessor.max)
    .slice(0, 24)
    .map(accessor => ({ type: accessor.type, min: accessor.min, max: accessor.max }));
  console.log(JSON.stringify({
    file: name,
    bytes: buffer.length,
    generator: gltf.asset?.generator,
    version: gltf.asset?.version,
    extras,
    sceneNames: (gltf.scenes || []).map(scene => scene.name).filter(Boolean),
    nodeNames: nodeNames.slice(0, 90),
    meshNames: meshNames.slice(0, 60),
    animations: animationNames,
    extensions: ext,
    accessorBounds
  }));
}
