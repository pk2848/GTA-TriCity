# GTA-TriCity — Chandigarh × Mohali

GTA-TriCity is an actively developed browser-based open-world driving game built with Three.js. The game world is anchored to real Chandigarh–Mohali geography using OpenStreetMap (OSM) data. Build 0.4 adds click-to-pin destination selection, road-based driving routes, turn-by-turn instructions and an in-world navigation beacon.

## Run locally

1. Install Node.js 20 or newer.
2. Clone this repository and open the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. An internet connection is required for map data, map tiles and route calculation.

## Driving controls

- W / Arrow Up: accelerate
- S / Arrow Down: reverse
- A / D or arrow keys: steer
- Space: brake
- Shift: boost
- R: reset vehicle to the Sector 17 origin
- Hold and drag left mouse on the 3D canvas: orbit camera around the car
- Mouse wheel on the 3D canvas: zoom the follow camera
- M: open/close the detailed city map
- Esc: close the detailed city map

## Destination and route guidance (Build 0.4)

1. Press **M** or click **OPEN MAP**.
2. Click the destination anywhere on the OpenStreetMap view.
3. The game places a destination pin and requests a driving route from the current vehicle position.
4. The map draws the route and shows estimated distance and travel time.
5. Close the map. A navigation panel displays the next manoeuvre, distance to the manoeuvre and remaining route distance/time.
6. A gold route ribbon and pulsing beacon are rendered in the 3D game world.
7. Click another map point to replace the destination, or use **CLEAR PIN** / the HUD X button to clear it.

The vehicle is paused while the full-screen map is open. Map dragging pans the map; **FOLLOW PLAYER** and **CENTER ON ME** return the map to the vehicle.

### Routing service configuration

The default route provider is the public OSRM demo service:

`https://router.project-osrm.org/route/v1/driving`

It is useful for development and testing, not a production service guarantee. The OSRM demo server is best-effort, intended for reasonable non-commercial usage, and documents a maximum of one request per second. The game spaces route requests by at least 1.1 seconds per browser session. For a public or commercial release, configure a suitable routing provider or host your own OSRM service and set:

```env
VITE_ROUTING_URL=https://your-routing-host/route/v1/driving
```

The value is the route endpoint prefix; the client appends the coordinates and OSRM route options. Configure the environment variable before running/building Vite.

## Real-world map systems

### Interactive 2D navigation
- Leaflet displays standard OpenStreetMap raster map tiles.
- The live vehicle marker and heading are projected from the game's local metric coordinates.
- Clicking the map pins a destination and invokes the driving routing service.
- The route, pin, current location, and coordinates update with game position.
- Map tiles are requested for the visible viewport only.

### Streamed 3D world
- Local metric coordinate projection anchored near Sector 17, Chandigarh (30.7415, 76.7820).
- Overpass queries load nearby OSM data in geographic chunks as the vehicle moves.
- Roads use OSM road classes and `width` / `lanes` tags where present.
- Joined road strips and intersection patches reduce gaps between mapped ways.
- Sidewalks and curbs are generated for many urban road classes. Where explicit sidewalk data is missing, they are visual estimates.
- Building footprints include supported way and multipolygon relation geometry; height and floor-count tags are used where available.
- Parks, woodland and water polygons are rendered where present in OSM.
- Selected named roads and places are labelled in the world.

## Accuracy and production considerations

GTA-TriCity uses the real geographic positions and mapped features available in OpenStreetMap. Detail varies by local mapping coverage. OSM data does not consistently include surveyed building heights, facade materials, windows, interiors, road markings, terrain elevation, traffic signals or pedestrian assets. Where data is missing, the game uses visual estimates or requires dedicated art/content work. A real geographic map is not the same as a photogrammetric reconstruction.

The world streams chunks rather than downloading the whole Chandigarh–Mohali region at launch. Loaded chunks are retained during the game session. Continued development should add chunk unloading/LOD, persistent route recovery, lane-level navigation and better handling of complex OSM relations.

## Architecture

```text
src/
  main.js                    # Three.js renderer, player vehicle, camera, HUD and game loop
  style.css                  # game HUD, responsive navigation panel and map overlay
  world/
    OSMStreamer.js           # Overpass requests, projection and 3D road/building/land geometry
    WorldMapView.js          # Leaflet map, destination pins, OSRM routes and manoeuvre guidance

vite.config.js               # local development Overpass proxy
index.html                   # game shell and navigation UI
package.json                 # Vite, Three.js and Leaflet dependencies
```

Planned game systems:
- `core/`: game lifecycle, input management, asset loading and save state
- `vehicles/`: vehicle physics, suspension, collision and vehicle switching
- `characters/`: walking/running controller, animation and interactions
- `traffic/`: lane graph, traffic lights and AI vehicles
- `gameplay/`: missions, economy, garages, wanted system and progression
- `public/models/`: optimized GLB vehicles, buildings, props and characters
- `public/audio/`: city ambience, engines, traffic and UI sounds

## Map data, attribution and service policies

Map data © OpenStreetMap contributors. OpenStreetMap data is licensed under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright. Review ODbL requirements when redistributing data or database derivatives.

The interactive map uses the standard raster tile endpoint `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Keep visible attribution, honour caching and request only tiles the player is viewing. OSM Foundation tile servers are community-funded and best-effort, without an SLA; the official policy prohibits bulk downloads and prefetching. For public/commercial traffic, choose a suitable tile provider or operate your own tile infrastructure.

The 3D map data uses public Overpass instances with sequential chunk requests. Shared Overpass services can be busy or rate-limited; a production release should use a suitable hosted service or self-hosted OSM extract/query backend.

The default routing endpoint is the OSRM public demo service. Its documented usage is reasonable non-commercial use, no more than one request per second, and no uptime/latency guarantee. Use a dedicated hosted routing provider or self-host OSRM for production traffic.

Relevant policies:
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
