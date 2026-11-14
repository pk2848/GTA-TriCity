import * as THREE from 'three';

// Sector 17, Chandigarh is the local origin. World units are metres.
export const CITY_ORIGIN = Object.freeze({ lat: 30.7415, lon: 76.7820 });
export const TILE_DEGREES = 0.018; // about 2 km per tile at this latitude
const METRES_PER_LAT_DEGREE = 110540;
const METRES_PER_LON_DEGREE = 111320 * Math.cos(CITY_ORIGIN.lat * Math.PI / 180);
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
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

export function geoToWorld(lat, lon) {
  return {
    x: (lon - CITY_ORIGIN.lon) * METRES_PER_LON_DEGREE,
    z: -(lat - CITY_ORIGIN.lat) * METRES_PER_LAT_DEGREE
  };
}
export function worldToGeo(x, z) {
  return {
    lat: CITY_ORIGIN.lat - z / METRES_PER_LAT_DEGREE,
    lon: CITY_ORIGIN.lon + x / METRES_PER_LON_DEGREE
  };
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
function finiteGeometry(geometry) {
  return Array.isArray(geometry) && geometry.length >= 2 && geometry.every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

export class OSMStreamer {
  constructor(scene, onStatus = () => {}, onCounts = () => {}) {
    this.scene = scene;
    this.onStatus = onStatus;
    this.onCounts = onCounts;
    this.loaded = new Set();
    this.loading = new Set();
    this.failed = new Set();
    this.queue = [];
    this.active = false;
    this.tiles = new Map();
    this.totalRoads = 0;
    this.totalBuildings = 0;
    this.currentTile = { ix: 0, iy: 0 };
  }

  requestAtWorld(x, z, force = false) {
    const { lat, lon } = worldToGeo(x, z);
    const ix = Math.floor((lon - CITY_ORIGIN.lon) / TILE_DEGREES + 0.5);
    const iy = Math.floor((lat - CITY_ORIGIN.lat) / TILE_DEGREES + 0.5);
    this.currentTile = { ix, iy };
    this.requestTile(ix, iy, force);
    this.prefetchAt(lat, lon, ix, iy);
  }

  prefetchAt(lat, lon, ix, iy) {
    const b = tileBounds(ix, iy);
    const margin = TILE_DEGREES * 0.23;
    // Fetch only the next chunk in the direction of travel, not a 3x3 burst.
    if (lat > b.north - margin) this.requestTile(ix, iy + 1);
    if (lat < b.south + margin) this.requestTile(ix, iy - 1);
    if (lon > b.east - margin) this.requestTile(ix + 1, iy);
    if (lon < b.west + margin) this.requestTile(ix - 1, iy);
  }

  retryCurrent() {
    const { ix, iy } = this.currentTile;
    const key = tileKey(ix, iy);
    if (this.failed.has(key)) this.failed.delete(key);
    if (this.loaded.has(key)) {
      this.onStatus('CURRENT CHUNK ALREADY LOADED');
      return;
    }
    this.requestTile(ix, iy, true);
  }

  requestTile(ix, iy, force = false) {
    const key = tileKey(ix, iy);
    if (this.loaded.has(key) || this.loading.has(key) || (!force && this.failed.has(key))) return;
    if (this.queue.some(t => t.key === key)) return;
    this.queue.push({ ix, iy, key });
    this.processQueue();
  }

  async processQueue() {
    if (this.active) return;
    this.active = true;
    while (this.queue.length) {
      const tile = this.queue.shift();
      await this.fetchTile(tile);
      // Public Overpass instances are shared resources. Keep requests sequential and paced.
      if (this.queue.length) await new Promise(resolve => setTimeout(resolve, 1100));
    }
    this.active = false;
  }

  buildQuery(bounds) {
    const { south, west, north, east } = bounds;
    const bbox = `${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
    return `[out:json][timeout:35];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|cycleway|footway|path)$"](${bbox});way["building"](${bbox}););out geom;`;
  }

  async postQuery(url, query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
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
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      attempts.push('/osm-query');
    }
    attempts.push(...OVERPASS_ENDPOINTS);
    let lastError;
    for (const endpoint of attempts) {
      try { return await this.postQuery(endpoint, query); }
      catch (error) { lastError = error; }
    }
    throw lastError || new Error('No Overpass endpoint could be reached');
  }

  async fetchTile(tile) {
    this.loading.add(tile.key);
    const bounds = tileBounds(tile.ix, tile.iy);
    this.onStatus(`FETCHING ${tile.key.replace(':', ' / ')}…`);
    try {
      const data = await this.fetchData(this.buildQuery(bounds));
      const elements = Array.isArray(data.elements) ? data.elements : [];
      const result = this.createTileGeometry(elements);
      const group = new THREE.Group();
      group.name = `osm-tile-${tile.key}`;
      result.roadMeshes.forEach(mesh => group.add(mesh));
      result.buildingMeshes.forEach(mesh => group.add(mesh));
      this.scene.add(group);
      this.tiles.set(tile.key, { group, bounds, roads: result.roadCount, buildings: result.buildingCount });
      this.loaded.add(tile.key);
      this.totalRoads += result.roadCount;
      this.totalBuildings += result.buildingCount;
      this.onStatus(`LOADED CHUNK ${tile.key.replace(':', ' / ')}`);
      this.emitCounts();
    } catch (error) {
      this.failed.add(tile.key);
      const reason = error?.name === 'AbortError' ? 'request timed out' : (error?.message || 'network error');
      this.onStatus(`MAP LOAD FAILED · ${reason}`);
      console.warn('OSM chunk could not be loaded:', tile.key, error);
    } finally {
      this.loading.delete(tile.key);
      this.emitCounts();
    }
  }

  createTileGeometry(elements) {
    const roadsByType = new Map();
    const buildingsByColor = new Map();
    let roadCount = 0, buildingCount = 0;

    for (const element of elements) {
      const tags = element.tags || {};
      const geometry = element.geometry;
      if (!finiteGeometry(geometry)) continue;
      if (tags.highway) {
        const type = tags.highway;
        const width = roadWidths[type] || 4.5;
        const list = roadsByType.get(type) || { positions: [], indices: [] };
        const points = geometry.map(p => geoToWorld(p.lat, p.lon));
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i], b = points[i + 1];
          const dx = b.x - a.x, dz = b.z - a.z;
          const length = Math.hypot(dx, dz);
          if (length < 0.5) continue;
          const nx = -dz / length * width / 2;
          const nz = dx / length * width / 2;
          const base = list.positions.length / 3;
          list.positions.push(
            a.x + nx, 0.035, a.z + nz,
            a.x - nx, 0.035, a.z - nz,
            b.x + nx, 0.035, b.z + nz,
            b.x - nx, 0.035, b.z - nz
          );
          list.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        if (list.positions.length) { roadsByType.set(type, list); roadCount++; }
      } else if (tags.building && tags.building !== 'no' && geometry.length >= 4) {
        const points = geometry.map(p => geoToWorld(p.lat, p.lon));
        const first = points[0], last = points[points.length - 1];
        if (Math.hypot(first.x - last.x, first.z - last.z) > 3) continue;
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, -points[0].z);
        for (let i = 1; i < points.length - 1; i++) shape.lineTo(points[i].x, -points[i].z);
        shape.closePath();
        const rawHeight = Number.parseFloat(tags.height);
        const levels = Number.parseFloat(tags['building:levels']);
        const height = THREE.MathUtils.clamp(Number.isFinite(rawHeight) ? rawHeight : (Number.isFinite(levels) ? levels * 3 : 6 + (stableHash(element.id) % 4) * 2.2), 3, 48);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
        geo.rotateX(-Math.PI / 2);
        const colorIndex = stableHash(element.id) % 6;
        const list = buildingsByColor.get(colorIndex) || { positions: [], indices: [] };
        const pos = geo.attributes.position.array;
        const base = list.positions.length / 3;
        list.positions.push(...pos);
        if (geo.index) {
          for (const value of geo.index.array) list.indices.push(base + value);
        } else {
          for (let i = 0; i < pos.length / 3; i++) list.indices.push(base + i);
        }
        buildingsByColor.set(colorIndex, list);
        geo.dispose();
        buildingCount++;
      }
    }

    const roadMeshes = [];
    for (const [type, list] of roadsByType) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(list.positions, 3));
      geometry.setIndex(list.indices);
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: roadColors[type] || 0x4a4d48, roughness: 0.98, metalness: 0.0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      roadMeshes.push(mesh);
    }

    const buildingMeshes = [];
    const buildingColors = [0xb7b1a3, 0xc7bcaa, 0xa9aaa2, 0x979d98, 0xc8c5b8, 0x9c9387];
    for (const [colorIndex, list] of buildingsByColor) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(list.positions, 3));
      geometry.setIndex(list.indices);
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: buildingColors[colorIndex], roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      buildingMeshes.push(mesh);
    }
    return { roadMeshes, buildingMeshes, roadCount, buildingCount };
  }

  emitCounts() {
    this.onCounts({ chunks: this.loaded.size, roads: this.totalRoads, buildings: this.totalBuildings, queued: this.queue.length, loading: this.loading.size });
  }

  dispose() {
    for (const { group } of this.tiles.values()) {
      group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
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
