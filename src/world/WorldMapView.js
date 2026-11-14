import L from 'leaflet';
import { worldToGeo } from './OSMStreamer.js';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export class WorldMapView {
  constructor() {
    this.overlay = document.querySelector('#map-overlay');
    this.followButton = document.querySelector('#map-follow');
    this.map = null;
    this.playerMarker = null;
    this.headingLine = null;
    this.followPlayer = true;
    this.isOpen = false;
    this.lastPosition = { x: 0, z: 0, heading: 0 };
    this.coordinates = document.querySelector('#map-coordinates');

    document.querySelector('#open-map').addEventListener('click', () => this.open());
    document.querySelector('#close-map').addEventListener('click', () => this.close());
    document.querySelector('#map-center').addEventListener('click', () => this.centerOnPlayer());
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
    // The map requests only tiles needed for the visible viewport. Do not prefetch city tiles.
    L.tileLayer(OSM_TILE_URL, {
      minZoom: 11,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
    }).addTo(this.map);
    this.playerMarker = L.circleMarker([initial.lat, initial.lon], {
      radius: 9,
      color: '#101b19',
      weight: 3,
      fillColor: '#f1c96e',
      fillOpacity: 1
    }).addTo(this.map).bindTooltip('YOUR VEHICLE', { permanent: true, direction: 'top', offset: [0, -8], className: 'player-tooltip' });
    this.headingLine = L.polyline([], { color: '#d79e3e', weight: 4, opacity: 0.95, dashArray: '5 5' }).addTo(this.map);
    this.map.on('dragstart', () => {
      this.followPlayer = false;
      this.updateFollowButton();
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

  update(x, z, heading = 0, forceCenter = false) {
    this.lastPosition = { x, z, heading };
    if (!this.map) return;
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
  }
}
