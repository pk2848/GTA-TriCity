# Tricity Drive — Chandigarh × Mohali (Build 0.3)

A browser-based Three.js open-world driving prototype for the Chandigarh–Mohali region. Build 0.3 adds mouse orbit/zoom controls, an expandable interactive 2D OpenStreetMap navigator with a live player marker, and richer OSM-derived 3D geometry.

## Run locally

1. Install Node.js 20 or newer.
2. Clone the repository and open the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. An internet connection is required for live map data and map tiles.

## Controls

- W / Arrow Up: accelerate
- S / Arrow Down: reverse
- A / D or arrow keys: steer
- Space: brake
- Shift: boost
- R: reset vehicle to the Sector 17 origin
- Hold and drag left mouse on the 3D canvas: orbit camera around the vehicle
- Mouse wheel on the 3D canvas: zoom the follow camera in/out
- M: open/close the detailed 2D city map
- Esc: close the detailed map
- On the map: drag to pan, scroll to zoom, use **CENTER ON ME** or **FOLLOW PLAYER**

## Build 0.3 features

### Interactive navigation map

- Full-screen Leaflet map using the standard OpenStreetMap raster tile layer.
- Street-level zoom and normal map pan/zoom.
- Live player marker and heading line converted from the vehicle's local metric position to latitude/longitude.
- Follow-player toggle, center-on-player control, and coordinate display.
- Tiles are requested only for the visible map viewport; the game does not pre-download city tile archives.

### 3D OSM world

- Local metric projection centered near Sector 17, Chandigarh (30.7415, 76.7820).
- Progressive Overpass chunk loading, one chunk at a time with request pacing and retry.
- OSM road classes with width/lanes tags where present.
- Joined road ribbons, intersection patches, inferred raised sidewalk strips on urban road classes, and curb strips.
- OSM building ways and multipolygon relation outer/inner rings; building height and levels tags are used when available.
- Parks, woodland and water polygons where they exist in OSM.
- Selected named roads, amenities, tourism features and commercial places appear as 3D labels.
- HUD reports chunk, road, building, sidewalk and park/water counts.

## Map accuracy and limitations

The 2D map is a standard OpenStreetMap rendered map layer, so it provides a recognizable street map for the visible location at available zoom levels. It is not an aerial/satellite layer.

The 3D game world is generated from OSM vector data and is still a work in progress. The exact detail depends on local OSM mapping coverage. Sidewalks are inferred for many urban road classes when explicit sidewalk tags are absent; those are visual approximations, not guaranteed surveyed sidewalks. Building heights use OSM height/levels tags where present and a fallback estimate where missing. OSM does not provide consistent facade materials, window layouts, interiors, road markings, traffic signals, or terrain elevation everywhere. Those need additional assets, data sources, and manual/algorithmic modelling.

The project does not bundle the entire Chandigarh–Mohali dataset. It requests a map chunk around the player and adjacent chunks only as they become relevant. Loaded chunks are retained for the current session. Relation multipolygons are handled for basic outer and inner rings; complex multi-part relations and intricate building parts may need additional refinement.

## Architecture

```text
src/
  main.js                    # renderer, player vehicle, camera, HUD and game loop
  style.css                  # HUD, menus, map overlay and responsive styling
  world/
    OSMStreamer.js           # Overpass requests, projection and 3D geometry
    WorldMapView.js          # Leaflet 2D map and live player position

vite.config.js               # local development Overpass proxy
index.html                   # game shell
package.json                 # Vite, Three.js and Leaflet dependencies
```

Planned systems:
- `core/`: game lifecycle, input abstraction, asset loading
- `vehicles/`: vehicle physics, suspension, collision, vehicle switching
- `characters/`: walking/running controller, animation and interaction
- `traffic/`: lane graph, traffic lights and AI vehicles
- `gameplay/`: missions, economy, garage, wanted system and saves
- `public/models/`: optimized GLB vehicles, buildings, props and characters
- `public/audio/`: ambience, engines, traffic and UI sounds

## Next milestones

1. Verify OSM completeness in each Chandigarh sector and Mohali phase; improve relation and junction handling.
2. Add lane markings, better junction corner geometry, building facade/window detail, roofs, terrain and district-specific assets.
3. Add Rapier vehicle physics and road-aware collisions.
4. Add recognizable custom landmark models and high-quality GLB building/vehicle assets.
5. Add pedestrians, traffic AI, lighting, weather, missions, garages and persistence.
6. Optimize with instancing, LODs, frustum culling, texture compression and proper chunk unloading.

## OpenStreetMap attribution and licensing

Map data © OpenStreetMap contributors. OpenStreetMap data is licensed under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright. Review ODbL obligations when redistributing data or database derivatives.

The interactive 2D map uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Keep the visible attribution. OpenStreetMap's standard tile servers are community-funded and best-effort: do not bulk-download or prefetch tiles, honour caching, and use a dedicated OSM-derived provider or self-hosted tiles if the project grows beyond modest interactive use. See https://operations.osmfoundation.org/policies/tiles/.

Overpass instances are also shared services. The game queues map-data requests sequentially and spaces them; a production public deployment should use a service arrangement appropriate to its traffic rather than sending large volumes of requests to community instances.
