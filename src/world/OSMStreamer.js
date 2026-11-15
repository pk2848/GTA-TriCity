import * as THREE from 'three';

// Local metric origin: Sector 17, Chandigarh. One Three.js unit represents one metre.
// CP67 Mall, Sector 67, Mohali (OSM node 13147982801).
export const CITY_ORIGIN = Object.freeze({ lat: 30.67697, lon: 76.72403 });
export const TILE_DEGREES = 0.018;
const METRES_PER_LAT_DEGREE = 110540;
const METRES_PER_LON_DEGREE = 111320 * Math.cos(CITY_ORIGIN.lat * Math.PI / 180);
// Use independently operated global instances. Private.coffee and VK Maps
// are fallbacks when the main public instance is busy or timing out.
const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

const roadWidths = {
  motorway: 15, trunk: 13, primary: 11, secondary: 9,
  tertiary: 7, unclassified: 5.5, residential: 5.5,
  living_street: 4.5, service: 3.6, pedestrian: 3.2,
  cycleway: 2.2, footway: 1.8, path: 1.8
};
const roadColors = {
  motorway: 0x343a3a, trunk: 0x393f3f, primary: 0x3b4140,
  secondary: 0x424744, tertiary: 0x494d48, unclassified: 0x4a4d48,
  residential: 0x51534d, living_street: 0x56564f, service: 0x62615a,
  pedestrian: 0x77776b, cycleway: 0x61736c, footway: 0x77776b, path: 0x747466
};
const urbanRoads = new Set(['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','service']);
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x92938a, roughness: 0.96, side: THREE.DoubleSide });
const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x666b65, roughness: 0.9, side: THREE.DoubleSide });
const parkMaterial = new THREE.MeshStandardMaterial({ color: 0x536f50, roughness: 1, side: THREE.DoubleSide });
const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x3f6044, roughness: 1, side: THREE.DoubleSide });
const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x527f8b, roughness: 0.24, metalness: 0.08, transparent: true, opacity: 0.9, side: THREE.DoubleSide });

export function geoToWorld(lat, lon) {
  return { x: (lon - CITY_ORIGIN.lon) * METRES_PER_LON_DEGREE, z: -(lat - CITY_ORIGIN.lat) * METRES_PER_LAT_DEGREE };
}
export function worldToGeo(x, z) {
  return { lat: CITY_ORIGIN.lat - z / METRES_PER_LAT_DEGREE, lon: CITY_ORIGIN.lon + x / METRES_PER_LON_DEGREE };
}
function tileBounds(ix, iy) {
  const west = CITY_ORIGIN.lon + (ix - 0.5) * TILE_DEGREES;
  const south = CITY_ORIGIN.lat + (iy - 0.5) * TILE_DEGREES;
  return { south, west, north: south + TILE_DEGREES, east: west + TILE_DEGREES };
}
function tileKey(ix, iy) { return `${ix}:${iy}`; }
function stableHash(value) {
  let h = 2166136261;
  for (let i = 0; i < String(value).length; i++) h = Math.imul(h ^ String(value).charCodeAt(i), 16777619);
  return h >>> 0;
}
function validRing(ring) {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
function parseMetres(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
function parseTagColor(value, fallback) {
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim())) {
    return Number.parseInt(value.trim().replace('#', ''), 16);
  }
  return fallback;
}
function appendGeometry(target, geometry) {
  const positions = geometry.getAttribute('position').array;
  const base = target.positions.length / 3;
  for (let i = 0; i < positions.length; i++) target.positions.push(positions[i]);
  if (geometry.index) {
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i++) target.indices.push(base + indices[i]);
  } else {
    for (let i = 0; i < positions.length / 3; i++) target.indices.push(base + i);
  }
}
function makeMesh(data, material, name) {
  if (!data.positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = true;
  return mesh;
}
function makeShape(ring) {
  const points = ring.map(p => geoToWorld(p.lat, p.lon));
  const first = points[0], last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.z - last.z) > 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, -points[0].z);
  for (let i = 1; i < points.length - 1; i++) shape.lineTo(points[i].x, -points[i].z);
  shape.closePath();
  return shape;
}
function polygonCentroid(ring) {
  let x = 0, z = 0, count = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = geoToWorld(ring[i].lat, ring[i].lon);
    x += p.x; z += p.z; count++;
  }
  return count ? { x: x / count, z: z / count } : { x: 0, z: 0 };
}
function createLabel(name, x, z, category = 'place') {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 112;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12,22,21,0.88)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(4, 4, 632, 104, 13);
  else ctx.rect(4, 4, 632, 104);
  ctx.fill();
  ctx.strokeStyle = 'rgba(231,205,143,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ecd7a6';
  ctx.font = '700 36px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const safeName = String(name).toUpperCase().slice(0, 30);
  ctx.fillText(safeName, 320, 57, 590);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.name = `osm-label-${category}`;
  sprite.position.set(x, 7, z);
  sprite.scale.set(28, 4.9, 1);
  return sprite;
}
function pathOffsets(points, halfWidth) {
  const offsets = [];
  for (let i = 0; i < points.length; i++) {
    let prev = null, next = null;
    if (i > 0) {
      const dx = points[i].x - points[i - 1].x, dz = points[i].z - points[i - 1].z;
      const len = Math.hypot(dx, dz) || 1;
      prev = { x: dx / len, z: dz / len };
    }
    if (i < points.length - 1) {
      const dx = points[i + 1].x - points[i].x, dz = points[i + 1].z - points[i].z;
      const len = Math.hypot(dx, dz) || 1;
      next = { x: dx / len, z: dz / len };
    }
    const n1 = prev ? { x: -prev.z, z: prev.x } : { x: -next.z, z: next.x };
    const n2 = next ? { x: -next.z, z: next.x } : n1;
    let mx = n1.x + n2.x, mz = n1.z + n2.z;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const dot = Math.max(0.38, Math.abs(mx * n2.x + mz * n2.z));
    const scale = Math.min(halfWidth / dot, halfWidth * 2.5);
    offsets.push({ x: mx * scale, z: mz * scale });
  }
  return offsets;
}
function addRibbon(target, points, width, centerOffset = 0, y = 0.05) {
  if (points.length < 2) return;
  const offsets = pathOffsets(points, Math.abs(centerOffset) + width / 2);
  const base = target.positions.length / 3;
  for (let i = 0; i < points.length; i++) {
    const offset = offsets[i];
    const centerX = points[i].x + Math.sign(centerOffset) * offset.x * (Math.abs(centerOffset) / (Math.abs(centerOffset) + width / 2 || 1));
    const centerZ = points[i].z + Math.sign(centerOffset) * offset.z * (Math.abs(centerOffset) / (Math.abs(centerOffset) + width / 2 || 1));
    const halfX = offset.x * (width / 2) / (Math.abs(centerOffset) + width / 2 || 1);
    const halfZ = offset.z * (width / 2) / (Math.abs(centerOffset) + width / 2 || 1);
    target.positions.push(centerX + halfX, y, centerZ + halfZ, centerX - halfX, y, centerZ - halfZ);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = base + i * 2;
    target.indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
}
function addJunctionPatch(target, point, radius, y = 0.065) {
  const base = target.positions.length / 3;
  target.positions.push(point.x, y, point.z);
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const angle = Math.PI * 2 * i / steps;
    target.positions.push(point.x + Math.cos(angle) * radius, y, point.z + Math.sin(angle) * radius);
  }
  for (let i = 0; i < steps; i++) target.indices.push(base, base + 1 + i, base + 1 + ((i + 1) % steps));
}

export class OSMStreamer {
  constructor(scene, onStatus = () => {}, onCounts = () => {}, onRoads = () => {}, onObstacles = () => {}) {
    this.scene = scene;
    this.onStatus = onStatus;
    this.onCounts = onCounts;
    this.onRoads = onRoads;
    this.onObstacles = onObstacles;
    this.loaded = new Set();
    this.loading = new Set();
    this.failed = new Set();
    this.failedAt = new Map();
    this.retryAttempts = new Map();
    this.queue = [];
    this.active = false;
    this.tiles = new Map();
    this.totalRoads = 0;
    this.totalBuildings = 0;
    this.totalSidewalks = 0;
    this.totalParks = 0;
    this.currentTile = { ix: 0, iy: 0 };
    this.playerWorld = { x: 0, z: 0 };
    this.disposed = false;
  }

  requestAtWorld(x, z, force = false) {
    const { lat, lon } = worldToGeo(x, z);
    const ix = Math.floor((lon - CITY_ORIGIN.lon) / TILE_DEGREES + 0.5);
    const iy = Math.floor((lat - CITY_ORIGIN.lat) / TILE_DEGREES + 0.5);
    this.currentTile = { ix, iy };
    this.playerWorld = { x, z };
    this.updateVisibility(x, z);
    // Discard stale prefetches when the player travels on. The current tile is
    // always first in the queue, followed by only the immediate neighbours.
    this.queue = this.queue.filter(tile => Math.abs(tile.ix - ix) <= 1 && Math.abs(tile.iy - iy) <= 1);
    this.requestTile(ix, iy, force, true);
    this.prefetchAt(lat, lon, ix, iy);
  }

  // Hide distant, already-loaded city chunks instead of rendering every chunk
  // the player has ever visited. Their geometry remains cached for quick return.
  updateVisibility(x, z, radius = 1650) {
    const radiusSq = radius * radius;
    for (const tile of this.tiles.values()) {
      const dx = x - tile.centerX;
      const dz = z - tile.centerZ;
      tile.group.visible = (dx * dx + dz * dz) <= radiusSq;
    }
  }

  prefetchAt(lat, lon, ix, iy) {
    const b = tileBounds(ix, iy);
    const margin = TILE_DEGREES * 0.23;
    if (lat > b.north - margin) this.requestTile(ix, iy + 1);
    if (lat < b.south + margin) this.requestTile(ix, iy - 1);
    if (lon > b.east - margin) this.requestTile(ix + 1, iy);
    if (lon < b.west + margin) this.requestTile(ix - 1, iy);
  }

  retryCurrent() {
    const { ix, iy } = this.currentTile;
    const key = tileKey(ix, iy);
    if (this.loaded.has(key)) {
      this.onStatus('CURRENT CHUNK ALREADY LOADED');
      return;
    }
    this.failed.delete(key);
    this.failedAt.delete(key);
    this.retryAttempts.delete(key);
    this.requestTile(ix, iy, true, true);
  }

  requestTile(ix, iy, force = false, priority = false) {
    const key = tileKey(ix, iy);
    if (this.loaded.has(key) || this.loading.has(key)) return;
    if (this.failed.has(key) && !force) {
      const failedAt = this.failedAt.get(key) || 0;
      if (Date.now() - failedAt < 30000) return;
      this.failed.delete(key);
      this.failedAt.delete(key);
      this.retryAttempts.delete(key);
    }
    if (force) {
      this.failed.delete(key);
      this.failedAt.delete(key);
      this.retryAttempts.delete(key);
    }
    const queuedIndex = this.queue.findIndex(tile => tile.key === key);
    if (queuedIndex >= 0) {
      if (priority && queuedIndex > 0) {
        const [queued] = this.queue.splice(queuedIndex, 1);
        this.queue.unshift(queued);
      }
      return;
    }
    const entry = { ix, iy, key };
    if (priority) this.queue.unshift(entry);
    else this.queue.push(entry);
    this.processQueue();
  }

  async processQueue() {
    if (this.active || this.disposed) return;
    this.active = true;
    try {
      while (this.queue.length && !this.disposed) {
        const tile = this.queue.shift();
        if (tile.retryDelayMs) await new Promise(resolve => setTimeout(resolve, tile.retryDelayMs));
        if (this.disposed) break;
        await this.fetchTile(tile);
        // Be polite to public OSM infrastructure and avoid bursts while moving.
        if (this.queue.length) await new Promise(resolve => setTimeout(resolve, 1400));
      }
    } finally {
      this.active = false;
      if (this.queue.length && !this.disposed) this.processQueue();
    }
  }

  buildQuery(bounds) {
    const { south, west, north, east } = bounds;
    const bbox = `${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
    return `[out:json][timeout:35];(
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|cycleway|footway|path)$"](${bbox});
      way["building"](${bbox});
      relation["type"="multipolygon"]["building"](${bbox});
      way["leisure"~"^(park|garden|playground|recreation_ground)$"](${bbox});
      way["landuse"~"^(grass|forest|meadow|recreation_ground)$"](${bbox});
      way["natural"~"^(water|wood)$"](${bbox});
      way["water"](${bbox});
      way["amenity"~"^(school|university|hospital|marketplace|place_of_worship|parking)$"]["name"](${bbox});
      node["amenity"~"^(school|university|hospital|marketplace|place_of_worship|parking)$"]["name"](${bbox});
      node["tourism"]["name"](${bbox});
      node["shop"="mall"]["name"](${bbox});
      node["highway"="traffic_signals"](${bbox});
      node["highway"="crossing"](${bbox});
      node["crossing"](${bbox});
      way["highway"="crossing"](${bbox});
      way["tourism"]["name"](${bbox});
    );out geom;`;
  }

  async postQuery(url, query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 42000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchData(query) {
    const attempts = [];
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') attempts.push('/osm-query');
    attempts.push(...OVERPASS_ENDPOINTS);
    const errors = [];
    for (const endpoint of attempts) {
      try {
        const data = await this.postQuery(endpoint, query);
        if (!data || !Array.isArray(data.elements)) throw new Error('Overpass returned an invalid response');
        return data;
      } catch (error) {
        errors.push(`${new URL(endpoint, location.href).hostname}: ${error?.name === 'AbortError' ? 'timeout' : (error?.message || 'network error')}`);
      }
    }
    throw new Error(errors.length ? errors.join(' · ') : 'No Overpass endpoint could be reached');
  }

  async fetchTile(tile) {
    this.loading.add(tile.key);
    const bounds = tileBounds(tile.ix, tile.iy);
    this.onStatus(`FETCHING ${tile.key.replace(':', ' / ')}…`);
    try {
      const data = await this.fetchData(this.buildQuery(bounds));
      const result = this.createTileGeometry(Array.isArray(data.elements) ? data.elements : []);
      const roadAssetGroup = (result.trafficRoads.length || result.trafficFeatures.length)
        ? this.onRoads(result.trafficRoads, tile.key, result.trafficFeatures)
        : null;
      if (result.obstacles.length) this.onObstacles(result.obstacles, tile.key);
      const group = new THREE.Group();
      group.name = `osm-tile-${tile.key}`;
      [...result.roadMeshes, ...result.sidewalkMeshes, ...result.landMeshes, ...result.buildingMeshes, ...result.detailMeshes, ...result.labels].forEach(mesh => group.add(mesh));
      // The road GLB is an instanced visual overlay. OSM ribbons remain underneath
      // for correct map geometry, intersections and fallback if the GLB fails.
      if (roadAssetGroup) group.add(roadAssetGroup);
      this.scene.add(group);
      const tileCenter = geoToWorld(
        (bounds.south + bounds.north) / 2,
        (bounds.west + bounds.east) / 2
      );
      const playerDx = tileCenter.x - this.playerWorld.x;
      const playerDz = tileCenter.z - this.playerWorld.z;
      group.visible = (playerDx * playerDx + playerDz * playerDz) <= 1650 * 1650;
      this.tiles.set(tile.key, {
        group,
        bounds,
        centerX: tileCenter.x,
        centerZ: tileCenter.z,
        roads: result.roadCount,
        buildings: result.buildingCount
      });
      this.loaded.add(tile.key);
      this.failed.delete(tile.key);
      this.failedAt.delete(tile.key);
      this.retryAttempts.delete(tile.key);
      this.totalRoads += result.roadCount;
      this.totalBuildings += result.buildingCount;
      this.totalSidewalks += result.sidewalkCount;
      this.totalParks += result.parkCount;
      this.onStatus(`LOADED ${tile.key.replace(':', ' / ')} · ${result.roadCount} roads · ${result.buildingCount} buildings`);
      this.emitCounts();
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'request timed out' : (error?.message || 'network error');
      const attempt = (this.retryAttempts.get(tile.key) || 0) + 1;
      this.retryAttempts.set(tile.key, attempt);
      if (attempt <= 2 && !this.disposed) {
        this.failed.delete(tile.key);
        this.queue.unshift({ ...tile, retryDelayMs: 2200 * attempt });
        this.onStatus(`MAP SERVER BUSY · RETRY ${attempt}/2 · ${reason}`);
      } else {
        this.failed.add(tile.key);
        this.failedAt.set(tile.key, Date.now());
        this.onStatus(`MAP LOAD FAILED · ${reason} · RETRY CURRENT AREA`);
      }
      console.warn('OSM chunk could not be loaded:', tile.key, error);
    } finally {
      this.loading.delete(tile.key);
      this.emitCounts();
    }
  }

  createTileGeometry(elements) {
    // Deduplicate only inside this tile. A global set can suppress a road in
    // a later tile after the earlier tile has been culled from the scene.
    const tileSeen = new Set();
    const roads = new Map(), sidewalks = { positions: [], indices: [] }, curbs = { positions: [], indices: [] };
    const land = new Map(), buildings = new Map(), labels = [];
    const trafficRoads = [];
    const trafficFeatures = [];
    const obstacles = [];
    const windowMatrices = [];
    const junctionNodes = new Map();
    let roadCount = 0, buildingCount = 0, sidewalkCount = 0, parkCount = 0;
    let labelCount = 0;

    const addLabel = (name, x, z, category) => {
      if (!name || labelCount >= 12) return;
      labels.push(createLabel(name, x, z, category));
      labelCount++;
    };

    for (const element of elements) {
      const tags = element.tags || {};
      const idKey = `${element.type || 'way'}/${element.id}`;
      if (tileSeen.has(idKey)) continue;

      // OSM point features feed traffic controls and pedestrian crossings as well as POI labels.
      if (element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
        const p = geoToWorld(element.lat, element.lon);
        if (tags.highway === 'traffic_signals') {
          trafficFeatures.push({ id: element.id, type: 'signal', x: p.x, z: p.z, direction: tags.direction || '' });
          tileSeen.add(idKey);
        }
        if (tags.highway === 'crossing' || tags.crossing) {
          trafficFeatures.push({ id: element.id, type: 'crossing', x: p.x, z: p.z, crossing: tags.crossing || 'unmarked' });
          tileSeen.add(idKey);
        }
        const important = tags.amenity || tags.tourism || tags.shop || tags.historic;
        if (tags.name && important) {
          addLabel(tags.name, p.x, p.z, 'poi');
          tileSeen.add(idKey);
        }
        continue;
      }

      let rings = [];
      if (element.type === 'relation' && Array.isArray(element.members)) {
        rings = element.members.filter(member => member.role === 'outer' && validRing(member.geometry)).map(member => member.geometry);
      } else if (validRing(element.geometry)) {
        rings = [element.geometry];
      }
      if (!rings.length) continue;

      if (tags.highway === 'crossing') {
        const p = polygonCentroid(rings[0]);
        trafficFeatures.push({ id: element.id, type: 'crossing', x: p.x, z: p.z, crossing: tags.crossing || 'marked' });
        tileSeen.add(idKey);
        continue;
      }

      if (tags.highway) {
        const type = tags.highway;
        const widthTag = parseMetres(tags.width);
        const laneCount = parseMetres(tags.lanes);
        const width = THREE.MathUtils.clamp(widthTag || ((laneCount && laneCount > 0) ? laneCount * 3.2 : (roadWidths[type] || 4.5)), 1.8, 28);
        const points = rings[0].map(point => geoToWorld(point.lat, point.lon));
        if (points.length < 2) continue;
        const roadData = roads.get(type) || { positions: [], indices: [] };
        addRibbon(roadData, points, width, 0, 0.055);
        roads.set(type, roadData);
        trafficRoads.push({
          id: element.id,
          type,
          width,
          points: points.map(point => ({ x: point.x, z: point.z })),
          oneway: ['yes', '1', 'true'].includes(String(tags.oneway || '').toLowerCase()),
          sidewalk: tags.sidewalk !== 'no' && tags.foot !== 'no'
        });
        roadCount++;
        for (const point of points) {
          const key = `${point.x.toFixed(1)}:${point.z.toFixed(1)}`;
          const node = junctionNodes.get(key) || { point, ways: 0, radius: 0 };
          node.ways++;
          node.radius = Math.max(node.radius, width / 2 + 0.8);
          junctionNodes.set(key, node);
        }

        if (urbanRoads.has(type) && tags.sidewalk !== 'no' && tags.foot !== 'no') {
          const sidewalkWidth = THREE.MathUtils.clamp(parseMetres(tags['sidewalk:width']) || 1.55, 0.9, 3.5);
          const generic = tags.sidewalk;
          const leftOn = generic === 'right' ? false : (tags['sidewalk:left'] !== 'no');
          const rightOn = generic === 'left' ? false : (tags['sidewalk:right'] !== 'no');
          if (leftOn) {
            addRibbon(sidewalks, points, sidewalkWidth, width / 2 + sidewalkWidth / 2 + 0.05, 0.13);
            addRibbon(curbs, points, 0.18, width / 2 + 0.02, 0.105);
          }
          if (rightOn) {
            addRibbon(sidewalks, points, sidewalkWidth, -(width / 2 + sidewalkWidth / 2 + 0.05), 0.13);
            addRibbon(curbs, points, 0.18, -(width / 2 + 0.02), 0.105);
          }
          if (leftOn || rightOn) sidewalkCount++;
        }
        if (tags.name && /^(primary|secondary|tertiary|residential|unclassified)$/u.test(type) && labelCount < 8) {
          const middle = points[Math.floor(points.length / 2)];
          addLabel(tags.name, middle.x, middle.z, 'road');
        }
        tileSeen.add(idKey);
        continue;
      }

      const isBuilding = Boolean(tags.building && tags.building !== 'no');
      if (isBuilding) {
        const outerRings = rings;
        for (const outerRing of outerRings) {
          const mallCenter = polygonCentroid(outerRing);
          // The bespoke CP67 landmark replaces the coarse OSM outline in this footprint.
          if (Math.abs(mallCenter.x) < 72 && mallCenter.z > -64 && mallCenter.z < 17) {
            tileSeen.add(idKey);
            continue;
          }
          const shape = makeShape(outerRing);
          if (!shape) continue;
          if (element.type === 'relation') {
            for (const member of element.members || []) {
              if (member.role !== 'inner' || !validRing(member.geometry)) continue;
              const innerPoints = member.geometry.map(point => geoToWorld(point.lat, point.lon));
              if (innerPoints.length < 4) continue;
              const path = new THREE.Path();
              path.moveTo(innerPoints[0].x, -innerPoints[0].z);
              for (let i = 1; i < innerPoints.length - 1; i++) path.lineTo(innerPoints[i].x, -innerPoints[i].z);
              path.closePath();
              shape.holes.push(path);
            }
          }
          const explicitHeight = parseMetres(tags.height);
          const levels = parseMetres(tags['building:levels']);
          const minHeight = THREE.MathUtils.clamp(parseMetres(tags.min_height) || ((parseMetres(tags['building:min_level']) || 0) * 3), 0, 20);
          const totalHeight = explicitHeight || (levels ? levels * 3 : 6 + (stableHash(element.id) % 5) * 2.1);
          const height = THREE.MathUtils.clamp(totalHeight - minHeight, 3, 70);

          // Oriented footprint bounds become static physics boxes so the player car
          // collides with real mapped building blocks rather than driving through them.
          const footprint = outerRing.map(point => geoToWorld(point.lat, point.lon));
          const origin = footprint[0], nextPoint = footprint[1] || footprint[0];
          let ux = nextPoint.x - origin.x, uz = nextPoint.z - origin.z;
          const axisLength = Math.hypot(ux, uz) || 1;
          ux /= axisLength; uz /= axisLength;
          const vx = -uz, vz = ux;
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (const point of footprint) {
            const u = point.x * ux + point.z * uz;
            const v = point.x * vx + point.z * vz;
            minU = Math.min(minU, u); maxU = Math.max(maxU, u);
            minV = Math.min(minV, v); maxV = Math.max(maxV, v);
          }
          const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
          if (obstacles.length < 1200 && maxU - minU > 2.2 && maxV - minV > 2.2) {
            obstacles.push({
              id: `${idKey}:${Math.round(midU)}:${Math.round(midV)}`,
              x: ux * midU + vx * midV,
              z: uz * midU + vz * midV,
              width: maxU - minU,
              depth: maxV - minV,
              height,
              minHeight,
              yaw: Math.atan2(-uz, ux)
            });
          }
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
          geometry.rotateX(-Math.PI / 2);
          geometry.translate(0, minHeight, 0);
          const p = polygonCentroid(outerRing);
          const colorIndex = stableHash(element.id) % 8;
          const buildingType = String(tags.building || '').toLowerCase();
          const materialTag = String(tags['building:material'] || '').toLowerCase();
          const palettes = {
            residential: [0xd2c7b4,0xc3b8a7,0xb7b4a9,0xe0d7c6,0xb9ad98,0x9faaa5,0xcbb99f,0xaaa394],
            commercial: [0xb8b1a1,0xaaa59a,0xc2b4a0,0x9ba5a1,0xc9c2b5,0xa59d90,0xb6ada0,0x929e9e],
            industrial: [0x969995,0x858c8d,0xa5a49a,0x777f80,0xb1aea5,0x888a84,0x9b9f99,0x858b8a],
            civic: [0xd1c7b6,0xbcb4a6,0xd8d1c3,0xaeb5b0,0xc4bbaa,0xe0d7c8,0xb5afa2,0x9fa9a7]
          };
          const palette = ['apartments','house','residential','detached','semidetached_house','terrace','dormitory'].includes(buildingType)
            ? palettes.residential
            : ['commercial','retail','office','hotel','supermarket'].includes(buildingType)
              ? palettes.commercial
              : ['industrial','warehouse','manufacture','garages'].includes(buildingType)
                ? palettes.industrial
                : ['school','university','public','hospital','government','train_station'].includes(buildingType)
                  ? palettes.civic
                  : [0xc8c0b2,0xb8b1a3,0xd2c8b8,0xa9aaa2,0x9eaaa4,0xc8b59c,0x9c9387,0xb0aaa0];
          const materialColor = parseTagColor(tags.colour || tags['building:colour'],
            materialTag.includes('brick') ? 0x9b7665 : materialTag.includes('glass') ? 0x91a8ae : palette[colorIndex]);
          const list = buildings.get(materialColor) || { positions: [], indices: [] };
          appendGeometry(list, geometry);
          buildings.set(materialColor, list);
          geometry.dispose();

          // Instanced windows add readable facades without creating hundreds of draw calls.
          const facadePoints = outerRing.map(point => geoToWorld(point.lat, point.lon));
          let signedArea = 0;
          for (let edge = 0; edge < facadePoints.length - 1; edge++) {
            const a = facadePoints[edge], b = facadePoints[edge + 1];
            signedArea += a.x * b.z - b.x * a.z;
          }
          const winding = signedArea >= 0 ? 1 : -1;
          const floorCount = Math.min(16, Math.max(1, Math.floor(height / 3.15)));
          for (let edge = 0; edge < facadePoints.length - 1 && windowMatrices.length < 1800; edge++) {
            const a = facadePoints[edge], b = facadePoints[edge + 1];
            const dx = b.x - a.x, dz = b.z - a.z;
            const edgeLength = Math.hypot(dx, dz);
            if (edgeLength < 4.2) continue;
            const count = Math.min(9, Math.max(1, Math.floor(edgeLength / 2.65)));
            const nx = (dz / edgeLength) * winding;
            const nz = (-dx / edgeLength) * winding;
            const yaw = Math.atan2(nx, nz);
            const paneWidth = Math.min(1.28, edgeLength / (count + 1) * 0.68);
            for (let floor = 0; floor < floorCount && windowMatrices.length < 1800; floor++) {
              const y = minHeight + 1.55 + floor * 3.05;
              if (y + 0.55 > minHeight + height) continue;
              for (let pane = 0; pane < count && windowMatrices.length < 1800; pane++) {
                const t = (pane + 1) / (count + 1);
                windowMatrices.push({
                  x: a.x + dx * t + nx * 0.075,
                  y,
                  z: a.z + dz * t + nz * 0.075,
                  yaw,
                  width: paneWidth,
                  height: 1.05
                });
              }
            }
          }
          if ((tags.name || tags['name:en']) && (tags.amenity || tags.shop || tags.office || tags.tourism || tags.building === 'commercial' || tags.building === 'retail')) {
            addLabel(tags.name || tags['name:en'], p.x, p.z, 'building');
          }
          buildingCount++;
        }
        tileSeen.add(idKey);
        continue;
      }

      const isWater = tags.natural === 'water' || tags.water || tags.landuse === 'reservoir';
      const isWood = tags.natural === 'wood' || tags.landuse === 'forest';
      const isPark = tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'playground' || tags.landuse === 'grass' || tags.landuse === 'meadow' || tags.landuse === 'recreation_ground';
      if (isWater || isWood || isPark) {
        for (const ring of rings) {
          const shape = makeShape(ring);
          if (!shape) continue;
          const geometry = new THREE.ShapeGeometry(shape);
          geometry.rotateX(-Math.PI / 2);
          const kind = isWater ? 'water' : (isWood ? 'wood' : 'park');
          const list = land.get(kind) || { positions: [], indices: [] };
          appendGeometry(list, geometry);
          land.set(kind, list);
          geometry.dispose();
          if (tags.name && labelCount < 22) {
            const p = polygonCentroid(ring);
            addLabel(tags.name, p.x, p.z, kind);
          }
          parkCount++;
        }
        tileSeen.add(idKey);
      }
    }

    const roadMeshes = [];
    for (const [type, data] of roads) {
      const mesh = makeMesh(data, new THREE.MeshStandardMaterial({ color: roadColors[type] || 0x4a4d48, roughness: 0.98, side: THREE.DoubleSide }), `road-${type}`);
      if (mesh) roadMeshes.push(mesh);
    }

    // Junction disks stitch the gaps where multiple OSM ways meet.
    const junctionData = { positions: [], indices: [] };
    for (const node of junctionNodes.values()) {
      if (node.ways >= 2) addJunctionPatch(junctionData, node.point, node.radius);
    }
    const junctionMesh = makeMesh(junctionData, new THREE.MeshStandardMaterial({ color: 0x414642, roughness: 0.98, side: THREE.DoubleSide }), 'road-junctions');
    if (junctionMesh) roadMeshes.push(junctionMesh);

    const sidewalkMesh = makeMesh(sidewalks, sidewalkMaterial, 'raised-sidewalks');
    const curbMesh = makeMesh(curbs, curbMaterial, 'street-curbs');
    const sidewalkMeshes = [sidewalkMesh, curbMesh].filter(Boolean);

    const landMeshes = [];
    for (const [kind, data] of land) {
      const material = kind === 'water' ? waterMaterial : (kind === 'wood' ? woodMaterial : parkMaterial);
      const mesh = makeMesh(data, material, `land-${kind}`);
      if (mesh) { mesh.position.y = kind === 'water' ? 0.025 : 0.012; landMeshes.push(mesh); }
    }

    const buildingMeshes = [];
    for (const [color, data] of buildings) {
      const mesh = makeMesh(data, new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide }), 'osm-buildings');
      if (mesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        buildingMeshes.push(mesh);
      }
    }
    const windowMeshes = this.createWindowInstances(windowMatrices);
    const detailMeshes = windowMeshes || [];
    return { roadMeshes, sidewalkMeshes, landMeshes, buildingMeshes, labels, trafficRoads, trafficFeatures, obstacles, detailMeshes, roadCount, buildingCount, sidewalkCount, parkCount };
  }

  createWindowInstances(records) {
    if (!records.length) return null;
    const frameGeometry = new THREE.BoxGeometry(1.18, 1.16, 0.075);
    const glassGeometry = new THREE.BoxGeometry(1.0, 0.94, 0.045);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x756f63, roughness: 0.86, metalness: 0.02 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x263d49, roughness: 0.24, metalness: 0.16, emissive: 0x111d24, emissiveIntensity: 0.22 });
    const frames = new THREE.InstancedMesh(frameGeometry, frameMaterial, records.length);
    const panes = new THREE.InstancedMesh(glassGeometry, glassMaterial, records.length);
    frames.name = 'procedural-building-window-frames';
    panes.name = 'procedural-building-glazing';
    const dummy = new THREE.Object3D();
    records.forEach((record, index) => {
      dummy.position.set(record.x, record.y, record.z);
      dummy.rotation.set(0, record.yaw, 0);
      dummy.scale.set(record.width, record.height, 1);
      dummy.updateMatrix();
      frames.setMatrixAt(index, dummy.matrix);
      dummy.position.y += 0.015;
      dummy.scale.set(record.width * 0.82, record.height * 0.82, 1);
      dummy.updateMatrix();
      panes.setMatrixAt(index, dummy.matrix);
    });
    frames.instanceMatrix.needsUpdate = true;
    panes.instanceMatrix.needsUpdate = true;
    frames.computeBoundingSphere();
    panes.computeBoundingSphere();
    return [frames, panes];
  }

  emitCounts() {
    this.onCounts({
      chunks: this.loaded.size,
      roads: this.totalRoads,
      buildings: this.totalBuildings,
      sidewalks: this.totalSidewalks,
      parks: this.totalParks,
      queued: this.queue.length,
      loading: this.loading.size
    });
  }

  dispose() {
    this.disposed = true;
    this.queue.length = 0;
    for (const { group } of this.tiles.values()) {
      group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
          else object.material.dispose();
        }
      });
      this.scene.remove(group);
    }
    this.tiles.clear();
    this.loaded.clear();
    this.emitCounts();
  }
}
