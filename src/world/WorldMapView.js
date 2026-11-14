import L from 'leaflet';
import { geoToWorld, worldToGeo } from './OSMStreamer.js';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ROUTING_URL = (import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org/route/v1/driving').replace(/[/]+$/, '');
const REQUEST_GAP_MS = 1100;

function haversineMetres(a, b) {
  const toRad = value => value * Math.PI / 180;
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const dLat = lat2 - lat1, dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(metres) {
  if (!Number.isFinite(metres)) return '—';
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
function directionText(modifier = '') {
  const map = {
    straight: ['↑', 'Continue straight'],
    left: ['↰', 'Turn left'],
    right: ['↱', 'Turn right'],
    'slight left': ['↖', 'Keep slightly left'],
    'slight right': ['↗', 'Keep slightly right'],
    'sharp left': ['⤺', 'Turn sharply left'],
    'sharp right': ['⤻', 'Turn sharply right'],
    uturn: ['↶', 'Make a U-turn']
  };
  return map[modifier] || ['↑', 'Continue'];
}
function describeStep(step) {
  const maneuver = step?.maneuver || {};
  const type = maneuver.type || 'continue';
  const modifier = maneuver.modifier || 'straight';
  const road = step?.name ? ` onto ${step.name}` : '';
  if (type === 'arrive') return { arrow: '⚑', text: 'Arrive at destination' };
  if (type === 'depart') return { arrow: '↑', text: 'Head out' + road };
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return { arrow: '⟳', text: 'Enter roundabout' + road };
  if (type === 'on ramp') return { arrow: '↗', text: 'Take the ramp' + road };
  if (type === 'off ramp') return { arrow: '↘', text: 'Take the exit' + road };
  if (type === 'merge') return { arrow: '⇢', text: 'Merge' + road };
  if (type === 'fork') return { arrow: modifier.includes('left') ? '↖' : '↗', text: `At the fork, keep ${modifier}` + road };
  if (type === 'end of road') {
    const turn = directionText(modifier);
    return { arrow: turn[0], text: `${turn[1]} at the end of the road` + road };
  }
  if (type === 'turn' || type === 'new name' || type === 'continue') {
    const turn = directionText(modifier);
    return { arrow: turn[0], text: turn[1] + road };
  }
  const turn = directionText(modifier);
  return { arrow: turn[0], text: turn[1] + road };
}

export class WorldMapView {
  constructor({ onRouteChange = () => {}, onGuidance = () => {}, onStatus = () => {} } = {}) {
    this.overlay = document.querySelector('#map-overlay');
    this.followButton = document.querySelector('#map-follow');
    this.map = null;
    this.playerMarker = null;
    this.headingLine = null;
    this.destinationMarker = null;
    this.routeLayer = null;
    this.routeOutline = null;
    this.routeArrows = [];
    this.followPlayer = true;
    this.isOpen = false;
    this.lastPosition = { x: 0, z: 0, heading: 0 };
    this.coordinates = document.querySelector('#map-coordinates');
    this.routeStatus = document.querySelector('#route-status');
    this.routeSummary = document.querySelector('#route-summary');
    this.clearButton = document.querySelector('#clear-route');
    this.onRouteChange = onRouteChange;
    this.onGuidance = onGuidance;
    this.onStatus = onStatus;
    this.route = null;
    this.routeRequestId = 0;
    this.routeAbortController = null;
    this.lastRouteRequestAt = 0;

    document.querySelector('#open-map').addEventListener('click', () => this.open());
    document.querySelector('#close-map').addEventListener('click', () => this.close());
    document.querySelector('#map-center').addEventListener('click', () => this.centerOnPlayer());
    document.querySelector('#clear-route').addEventListener('click', () => this.clearRoute());
    document.querySelector('#nav-clear').addEventListener('click', () => this.clearRoute());
    this.followButton.addEventListener('click', () => {
      this.followPlayer = !this.followPlayer;
      this.updateFollowButton();
      if (this.followPlayer) this.centerOnPlayer();
    });
  }

  ensureMap() {
    if (this.map) return;
    const initial = worldToGeo(this.lastPosition.x, this.lastPosition.z);
    this.map = L.map('world-map', {
      center: [initial.lat, initial.lon],
      zoom: 16,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true,
      scrollWheelZoom: true,
      preferCanvas: true
    });
    L.tileLayer(OSM_TILE_URL, {
      minZoom: 11,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
    }).addTo(this.map);
    this.playerMarker = L.circleMarker([initial.lat, initial.lon], {
      radius: 9, color: '#101b19', weight: 3, fillColor: '#f1c96e', fillOpacity: 1
    }).addTo(this.map).bindTooltip('YOUR VEHICLE', {
      permanent: true, direction: 'top', offset: [0, -8], className: 'player-tooltip'
    });
    this.headingLine = L.polyline([], { color: '#d79e3e', weight: 4, opacity: 0.95, dashArray: '5 5' }).addTo(this.map);
    this.map.on('dragstart', () => {
      this.followPlayer = false;
      this.updateFollowButton();
    });
    this.map.on('click', event => {
      this.followPlayer = false;
      this.updateFollowButton();
      this.setDestination(event.latlng);
    });
  }

  open() {
    this.isOpen = true;
    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.ensureMap();
    this.update(this.lastPosition.x, this.lastPosition.z, this.lastPosition.heading, true);
    this.updateFollowButton();
    requestAnimationFrame(() => this.map.invalidateSize({ pan: false }));
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  updateFollowButton() {
    this.followButton.textContent = this.followPlayer ? 'FOLLOW PLAYER: ON' : 'FOLLOW PLAYER: OFF';
    this.followButton.classList.toggle('is-active', this.followPlayer);
  }

  centerOnPlayer() {
    if (!this.map) return;
    const geo = worldToGeo(this.lastPosition.x, this.lastPosition.z);
    this.map.setView([geo.lat, geo.lon], Math.max(this.map.getZoom(), 16), { animate: true });
    this.followPlayer = true;
    this.updateFollowButton();
  }

  setRouteMessage(title, summary) {
    this.routeStatus.textContent = title;
    this.routeSummary.textContent = summary;
  }

  async setDestination(latlng) {
    const requestId = ++this.routeRequestId;
    if (this.routeAbortController) this.routeAbortController.abort();
    this.routeAbortController = null;
    this.setRouteMessage('CALCULATING ROUTE…', 'Finding a drivable route from your current position.');
    this.clearButton.disabled = false;
    this.onStatus('Calculating driving route…');

    const start = worldToGeo(this.lastPosition.x, this.lastPosition.z);
    const destination = { lat: latlng.lat, lon: latlng.lng };
    if (this.destinationMarker) this.map.removeLayer(this.destinationMarker);
    this.destinationMarker = L.circleMarker(latlng, {
      radius: 10, color: '#14201b', weight: 3, fillColor: '#f2b84f', fillOpacity: 1
    }).addTo(this.map).bindPopup('<strong>Selected destination</strong><br>Calculating driving route…');
    this.map.panTo(latlng, { animate: true });

    // The public OSRM demo asks clients to stay at or below one request per second.
    const wait = Math.max(0, REQUEST_GAP_MS - (Date.now() - this.lastRouteRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    if (requestId !== this.routeRequestId) return;
    this.lastRouteRequestAt = Date.now();

    const controller = new AbortController();
    this.routeAbortController = controller;
    const url = `${ROUTING_URL}/${start.lon},${start.lat};${destination.lon},${destination.lat}?steps=true&overview=full&geometries=geojson&alternatives=false`;
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Routing service HTTP ${response.status}`);
      const data = await response.json();
      if (requestId !== this.routeRequestId) return;
      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new Error(data.code === 'NoRoute' ? 'No drivable route was found for this pin. Try a nearby road.' : (data.message || data.code || 'No route found'));
      }
      const route = data.routes[0];
      const coordinates = route.geometry?.coordinates || [];
      if (coordinates.length < 2) throw new Error('The routing service returned an empty route.');
      // Route engines snap pins to the nearest routable road. Use that snapped coordinate
      // for navigation progress and the 3D arrival beacon so a pin in a lake/building
      // does not create an unreachable arrival target.
      const snapped = data.waypoints?.[1]?.location;
      const navigationDestination = snapped
        ? { lat: snapped[1], lon: snapped[0] }
        : destination;
      const latLngs = coordinates.map(([lon, lat]) => [lat, lon]);
      if (this.routeLayer) this.map.removeLayer(this.routeLayer);
      if (this.routeOutline) this.map.removeLayer(this.routeOutline);
      this.routeArrows.forEach(marker => this.map.removeLayer(marker));
      this.routeArrows = [];

      // Dark casing keeps the route legible over map labels, even at city-wide zoom.
      this.routeOutline = L.polyline(latLngs, {
        color: '#14231e', weight: 13, opacity: 0.88, lineCap: 'round', lineJoin: 'round'
      }).addTo(this.map);
      this.routeLayer = L.polyline(latLngs, {
        color: '#f2a928', weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round'
      }).addTo(this.map);

      // Screen-sized direction chevrons remain visible when the user zooms out.
      const arrowCount = Math.min(12, Math.max(1, Math.floor(coordinates.length / 22)));
      for (let i = 1; i <= arrowCount; i++) {
        const index = Math.max(0, Math.min(coordinates.length - 1,
          Math.round(i * (coordinates.length - 1) / (arrowCount + 1))));
        const previous = coordinates[Math.max(0, index - 1)];
        const next = coordinates[Math.min(coordinates.length - 1, index + 1)];
        const bearing = Math.atan2(next[0] - previous[0], (next[1] - previous[1]) * Math.cos(next[0] * Math.PI / 180)) * 180 / Math.PI;
        const icon = L.divIcon({
          className: 'route-direction-marker',
          html: `<span class="route-direction-chevron" style="transform:rotate(${bearing}deg)">➤</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        const marker = L.marker(latLngs[index], { icon, interactive: false, keyboard: false, zIndexOffset: 900 });
        marker.addTo(this.map);
        this.routeArrows.push(marker);
      }
      this.routeOutline.bringToFront();
      this.routeLayer.bringToFront();
      this.routeArrows.forEach(marker => marker.bringToFront());
      this.playerMarker.bringToFront();
      this.destinationMarker.setLatLng([navigationDestination.lat, navigationDestination.lon]);
      this.destinationMarker.setPopupContent(snapped
        ? '<strong>Destination pinned</strong><br>Route endpoint snapped to the nearest drivable road.'
        : '<strong>Destination pinned</strong><br>Driving route ready.');
      const steps = route.legs?.flatMap(leg => leg.steps || []) || [];
      this.route = {
        destination: navigationDestination,
        selectedDestination: destination,
        coordinates,
        worldPoints: coordinates.map(([lon, lat]) => geoToWorld(lat, lon)),
        steps,
        stepWorld: steps.map(step => {
          const location = step.maneuver?.location;
          return location ? geoToWorld(location[1], location[0]) : null;
        }),
        stepIndex: Math.min(1, Math.max(0, steps.length - 1)),
        distance: route.distance || 0,
        duration: route.duration || 0,
        isArrived: false
      };
      const destinationWorld = geoToWorld(navigationDestination.lat, navigationDestination.lon);
      this.onRouteChange({
        active: true,
        destination: navigationDestination,
        selectedDestination: destination,
        destinationWorld,
        worldPoints: this.route.worldPoints,
        distance: this.route.distance,
        duration: this.route.duration
      });
      this.setRouteMessage('DESTINATION PINNED', `${formatDistance(route.distance)} · ${formatDuration(route.duration)} · Click another point to change destination.`);
      this.onStatus(`Route ready · ${formatDistance(route.distance)} · ${formatDuration(route.duration)}`);
      this.map.fitBounds(this.routeLayer.getBounds(), { padding: [56, 56], maxZoom: 17 });
      this.clearButton.disabled = false;
      this.emitGuidance(true);
    } catch (error) {
      if (error.name === 'AbortError' || requestId !== this.routeRequestId) return;
      console.warn('Route request failed:', error);
      const message = error.message || 'Could not calculate route.';
      this.setRouteMessage('ROUTE NOT AVAILABLE', message);
      this.onStatus(message);
      if (this.routeLayer) { this.map.removeLayer(this.routeLayer); this.routeLayer = null; }
      if (this.routeOutline) { this.map.removeLayer(this.routeOutline); this.routeOutline = null; }
      this.routeArrows.forEach(marker => this.map.removeLayer(marker));
      this.routeArrows = [];
      this.route = null;
      this.onRouteChange(null);
      this.onGuidance(null);
    } finally {
      if (requestId === this.routeRequestId) this.routeAbortController = null;
    }
  }

  clearRoute() {
    this.routeRequestId++;
    if (this.routeAbortController) this.routeAbortController.abort();
    this.routeAbortController = null;
    if (this.routeLayer && this.map) this.map.removeLayer(this.routeLayer);
    if (this.routeOutline && this.map) this.map.removeLayer(this.routeOutline);
    this.routeArrows.forEach(marker => { if (this.map) this.map.removeLayer(marker); });
    if (this.destinationMarker && this.map) this.map.removeLayer(this.destinationMarker);
    this.routeLayer = null;
    this.routeOutline = null;
    this.routeArrows = [];
    this.destinationMarker = null;
    this.route = null;
    this.clearButton.disabled = true;
    this.setRouteMessage('SET A DESTINATION', 'Click a point on the map to calculate a driving route.');
    this.onRouteChange(null);
    this.onGuidance(null);
    this.onStatus('Destination cleared. Click the map to choose a new destination.');
  }

  nearestRouteDistance(x, z) {
    const points = this.route?.worldPoints || [];
    if (points.length < 2) return Infinity;
    let minimum = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const lengthSquared = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared));
      const px = a.x + t * dx, pz = a.z + t * dz;
      minimum = Math.min(minimum, Math.hypot(x - px, z - pz));
    }
    return minimum;
  }

  emitGuidance(force = false) {
    if (!this.route) {
      this.onGuidance(null);
      return;
    }
    const route = this.route;
    if (route.isArrived) {
      this.onGuidance({
        arrived: true, arrow: '⚑', instruction: 'You have arrived',
        details: 'Destination reached.', distanceToTurn: 0, remainingDistance: 0, remainingDuration: 0
      });
      return;
    }
    const player = { x: this.lastPosition.x, z: this.lastPosition.z };
    const destinationWorld = geoToWorld(route.destination.lat, route.destination.lon);
    const destinationDistance = Math.hypot(player.x - destinationWorld.x, player.z - destinationWorld.z);
    if (destinationDistance < 24) {
      route.isArrived = true;
      this.emitGuidance(true);
      this.setRouteMessage('YOU HAVE ARRIVED', 'Destination reached. Click elsewhere to choose another place.');
      this.onStatus('You have arrived at your destination.');
      return;
    }

    while (route.stepIndex < route.steps.length - 1) {
      const stepPoint = route.stepWorld[route.stepIndex];
      if (!stepPoint) { route.stepIndex++; continue; }
      if (Math.hypot(player.x - stepPoint.x, player.z - stepPoint.z) < 22) route.stepIndex++;
      else break;
    }
    const step = route.steps[route.stepIndex] || route.steps[route.steps.length - 1];
    const point = route.stepWorld[route.stepIndex] || destinationWorld;
    const distanceToTurn = Math.hypot(player.x - point.x, player.z - point.z);
    let remainingDistance = distanceToTurn;
    let remainingDuration = 0;
    for (let i = route.stepIndex + 1; i < route.steps.length; i++) remainingDistance += route.steps[i].distance || 0;
    for (let i = route.stepIndex; i < route.steps.length; i++) remainingDuration += route.steps[i].duration || 0;

    const nearestDistance = this.nearestRouteDistance(player.x, player.z);
    const offRoute = nearestDistance > 90 && route.distance > 100;
    const instruction = describeStep(step);
    const roadPart = step?.name ? ` · ${step.name}` : '';
    const details = offRoute
      ? `You are ${formatDistance(nearestDistance)} from the route. Open the map and pin again to recalculate.`
      : `In ${formatDistance(distanceToTurn)}${roadPart} · ${formatDistance(remainingDistance)} left · ${formatDuration(remainingDuration)}`;
    this.onGuidance({
      arrived: false, offRoute, arrow: offRoute ? '!' : instruction.arrow,
      instruction: offRoute ? 'You are off route' : instruction.text,
      details, distanceToTurn, remainingDistance, remainingDuration
    });
    if (this.isOpen && this.routeSummary) {
      this.routeSummary.textContent = `${formatDistance(remainingDistance)} remaining · ${formatDuration(remainingDuration)} · ${offRoute ? 'Off route' : 'Follow highlighted line'}`;
    }
  }

  update(x, z, heading = 0, forceCenter = false) {
    this.lastPosition = { x, z, heading };
    if (!this.map) {
      this.emitGuidance();
      return;
    }
    const geo = worldToGeo(x, z);
    const position = L.latLng(geo.lat, geo.lon);
    this.playerMarker.setLatLng(position);
    const directionX = x - Math.sin(heading) * 28;
    const directionZ = z - Math.cos(heading) * 28;
    const direction = worldToGeo(directionX, directionZ);
    this.headingLine.setLatLngs([[geo.lat, geo.lon], [direction.lat, direction.lon]]);
    this.coordinates.textContent = `PLAYER POSITION · ${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}`;
    if (this.isOpen && (forceCenter || (this.followPlayer && position.distanceTo(this.map.getCenter()) > 65))) {
      this.map.panTo(position, { animate: false });
    }
    if (this.route) this.emitGuidance();
  }
}
