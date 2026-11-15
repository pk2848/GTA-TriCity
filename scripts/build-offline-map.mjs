import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run build:offline-map -- data/tricity.geojson');
  process.exit(1);
}

const ORIGIN = { lat: 30.67697, lon: 76.72403 };
const TILE_DEGREES = 0.018;
const outputDir = path.resolve('public/maps/tricity-offline');
const inputPath = path.resolve(input);

function readTags(properties = {}) {
  const tags = properties.tags && typeof properties.tags === 'object'
    ? { ...properties.tags }
    : { ...properties };
  for (const key of ['id', '@id', 'osm_id', 'osm_type', 'type', 'timestamp', 'version', 'changeset', 'uid', 'user', 'way_id', 'relation_id', 'node_id', 'tags']) {
    delete tags[key];
  }
  return tags;
}

function readIdentity(feature, properties, fallbackIndex) {
  const raw = String(feature.id ?? properties['@id'] ?? properties.osm_id ?? properties.id ?? fallbackIndex);
  const typed = raw.match(/^(node|way|relation)[/:](.+)$/i);
  const type = String(properties.osm_type || properties.element_type || (typed ? typed[1] : '')).toLowerCase();
  const id = typed ? typed[2] : raw;
  return {
    type: ['node', 'way', 'relation'].includes(type) ? type : 'way',
    id
  };
}

function collectPositions(coordinates, output = []) {
  if (!Array.isArray(coordinates)) return output;
  if (coordinates.length >= 2 && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
    output.push([coordinates[0], coordinates[1]]);
    return output;
  }
  for (const child of coordinates) collectPositions(child, output);
  return output;
}

function ringToGeometry(ring) {
  return ring
    .filter(pair => Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([lon, lat]) => ({ lat, lon }));
}

function featureToElements(feature, index) {
  if (!feature || feature.type !== 'Feature' || !feature.geometry) return [];
  const properties = feature.properties || {};
  const tags = readTags(properties);
  const isRelevant = Boolean(
    tags.highway || (tags.building && tags.building !== 'no') ||
    tags.leisure || tags.landuse || tags.natural || tags.water ||
    tags.amenity || tags.tourism || tags.shop || tags.historic ||
    tags.crossing
  );
  if (!isRelevant) return [];

  const identity = readIdentity(feature, properties, index + 1);
  const geometry = feature.geometry;
  const base = { type: identity.type, id: identity.id, tags };

  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates || [];
    if (identity.type !== 'node' || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{ ...base, type: 'node', lat, lon }];
  }

  if (geometry.type === 'MultiPoint') {
    return (geometry.coordinates || []).map((pair, i) => ({
      ...base,
      type: 'node',
      id: `${identity.id}-${i}`,
      lon: pair[0],
      lat: pair[1]
    })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon));
  }

  if (geometry.type === 'LineString') {
    const line = ringToGeometry(geometry.coordinates || []);
    return line.length >= 2 ? [{ ...base, type: 'way', geometry: line }] : [];
  }

  if (geometry.type === 'MultiLineString') {
    return (geometry.coordinates || []).map((line, i) => ({
      ...base,
      type: 'way',
      id: `${identity.id}-${i}`,
      geometry: ringToGeometry(line)
    })).filter(item => item.geometry.length >= 2);
  }

  if (geometry.type === 'Polygon') {
    const rings = (geometry.coordinates || []).map(ringToGeometry).filter(ring => ring.length >= 4);
    if (!rings.length) return [];
    if (rings.length === 1) return [{ ...base, type: 'way', geometry: rings[0] }];
    return [{
      ...base,
      type: 'relation',
      members: [
        { role: 'outer', geometry: rings[0] },
        ...rings.slice(1).map(ring => ({ role: 'inner', geometry: ring }))
      ]
    }];
  }

  if (geometry.type === 'MultiPolygon') {
    const members = [];
    for (const polygon of geometry.coordinates || []) {
      const rings = (polygon || []).map(ringToGeometry).filter(ring => ring.length >= 4);
      if (!rings.length) continue;
      members.push({ role: 'outer', geometry: rings[0] });
      for (const ring of rings.slice(1)) members.push({ role: 'inner', geometry: ring });
    }
    return members.length ? [{ ...base, type: 'relation', members }] : [];
  }

  return [];
}

function boundsOfElement(element) {
  const points = element.type === 'node'
    ? [[element.lon, element.lat]]
    : element.geometry
      ? element.geometry.map(point => [point.lon, point.lat])
      : (element.members || []).flatMap(member => (member.geometry || []).map(point => [point.lon, point.lat]));
  if (!points.length) return null;
  const lons = points.map(point => point[0]);
  const lats = points.map(point => point[1]);
  return {
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats)
  };
}

function tileRange(bounds) {
  return {
    minX: Math.floor((bounds.west - ORIGIN.lon) / TILE_DEGREES + 0.5),
    maxX: Math.floor((bounds.east - ORIGIN.lon) / TILE_DEGREES + 0.5),
    minY: Math.floor((bounds.south - ORIGIN.lat) / TILE_DEGREES + 0.5),
    maxY: Math.floor((bounds.north - ORIGIN.lat) / TILE_DEGREES + 0.5)
  };
}

function tileKey(ix, iy) {
  return `${ix}:${iy}`;
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8');
  const geojson = JSON.parse(raw);
  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Input must be a GeoJSON FeatureCollection. Choose GeoJSON in the BBBike extract form.');
  }

  const tiles = new Map();
  let acceptedFeatures = 0;
  let totalPlacements = 0;
  let skippedFeatures = 0;

  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i];
    const elements = featureToElements(feature, i);
    if (!elements.length) {
      skippedFeatures++;
      continue;
    }
    acceptedFeatures++;

    for (const element of elements) {
      const bounds = boundsOfElement(element);
      if (!bounds) continue;
      const range = tileRange(bounds);
      for (let ix = range.minX; ix <= range.maxX; ix++) {
        for (let iy = range.minY; iy <= range.maxY; iy++) {
          const key = tileKey(ix, iy);
          if (!tiles.has(key)) tiles.set(key, []);
          tiles.get(key).push(element);
          totalPlacements++;
        }
      }
    }
  }

  if (!tiles.size) throw new Error('No usable OSM road/building/landmark features were found in this GeoJSON extract.');

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const tileKeys = [...tiles.keys()].sort((a, b) => {
    const [ax, ay] = a.split(':').map(Number);
    const [bx, by] = b.split(':').map(Number);
    return ay - by || ax - bx;
  });

  let bytesWritten = 0;
  for (const key of tileKeys) {
    const [ix, iy] = key.split(':').map(Number);
    const payload = JSON.stringify({ tile: key, elements: tiles.get(key) });
    const filename = `${ix}_${iy}.json`;
    await fs.writeFile(path.join(outputDir, filename), payload);
    bytesWritten += Buffer.byteLength(payload);
  }

  const allPositions = geojson.features.flatMap(feature => collectPositions(feature.geometry?.coordinates));
  const manifest = {
    format: 'tricity-osm-offline-v1',
    source: 'OpenStreetMap contributors',
    licence: 'Open Database License (ODbL)',
    origin: ORIGIN,
    tileDegrees: TILE_DEGREES,
    createdAt: new Date().toISOString(),
    sourceFile: path.basename(inputPath),
    featureCount: geojson.features.length,
    acceptedFeatureCount: acceptedFeatures,
    skippedFeatureCount: skippedFeatures,
    elementPlacements: totalPlacements,
    tileCount: tileKeys.length,
    bytes: bytesWritten,
    bounds: allPositions.length ? {
      west: Math.min(...allPositions.map(point => point[0])),
      south: Math.min(...allPositions.map(point => point[1])),
      east: Math.max(...allPositions.map(point => point[0])),
      north: Math.max(...allPositions.map(point => point[1]))
    } : null,
    tiles: tileKeys
  };
  await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Offline map generated: ${tileKeys.length} tiles`);
  console.log(`Included features: ${acceptedFeatures} / ${geojson.features.length}`);
  console.log(`Tile data: ${(bytesWritten / (1024 * 1024)).toFixed(2)} MiB`);
  console.log(`Output: ${outputDir}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
