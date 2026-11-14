# GTA-TriCity — Chandigarh × Mohali

GTA-TriCity is an actively developed browser-based open-world driving game built with Three.js. The world is anchored to real Chandigarh–Mohali geography using OpenStreetMap (OSM) data.

## Run locally

1. Install Node.js 20 or newer.
2. Clone the repository and open the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. Internet access is required for OSM data, map tiles and route calculation.

## Driving controls

- **W / Arrow Up:** accelerate forward in the direction the car is facing.
- **S / Arrow Down:** reverse.
- **A / D or arrow keys:** steer.
- **Space:** brake.
- **N (hold):** nitro boost. Nitro is a finite tank that recharges after release; it also increases the vehicle's top speed while active.
- **Shift (hold):** secondary boost.
- **R:** reset the vehicle at the Sector 17 origin and restore vehicle condition/nitro.
- **Hold and drag left mouse on the 3D canvas:** orbit camera around the vehicle.
- **Mouse wheel on the 3D canvas:** zoom the follow camera.
- **M:** open/close the detailed city map.
- **Esc:** close the detailed city map.

## Build 0.5 — driving, traffic and route guidance

### Vehicle and nitro
- Forward acceleration follows the vehicle's nose direction; steering changes the vehicle heading and the front wheels visibly steer.
- Holding N applies a stronger acceleration and higher speed cap while the nitro tank drains.
- Nitro refills gradually after the key is released; exhaust flames and a blue nitro glow show when it is engaged.
- Vehicle condition is reduced by collisions and influences the available top speed.
- Collision feedback, camera shake and a vehicle-condition HUD communicate impacts.

### AI traffic and pedestrians
- OSM road ways are passed from the map streamer into a traffic simulation.
- AI cars are placed on road lanes and follow the mapped road polylines. Two-way roads use opposing lanes; OSM one-way roads remain one-way.
- Pedestrian agents walk along sidewalk offsets beside mapped urban roads, with simple procedural character meshes and walk animation.
- The player can collide with AI vehicles or pedestrians. Vehicle impacts reduce speed and vehicle condition; pedestrians stumble and recover after a short period. No graphic injury effects are rendered.
- The map panel reports the number of AI cars and pedestrians currently loaded in the streamed world.

**Traffic is simulated game traffic, not a live feed of Chandigarh traffic.** Vehicles and pedestrians are generated from the loaded OSM road network. Their density and paths are game simulation values, not real-time traffic counts or live tracking of actual people.

### Map destinations and navigation
- Click a point in the full-screen OpenStreetMap view to pin a destination.
- OSRM calculates a drivable route from the vehicle's current position.
- The map displays a highlighted route with direction chevrons, destination pin, route distance and ETA.
- Direction chevrons are fixed screen-space markers and remain visible when the map is zoomed out.
- The in-game navigation HUD gives the next maneuver and remaining distance/time.
- A gold 3D route ribbon and destination beacon appear in the world.
- Route endpoints are snapped to the nearest drivable road returned by the routing service.
- Use **CLEAR PIN** to cancel navigation, or click another point to replace the destination.

## Real-world map systems

### Interactive 2D map
- Leaflet displays standard OpenStreetMap raster tiles.
- The live vehicle marker and heading are projected from the game's local metric coordinates.
- The map supports pan, zoom, follow-player and center-on-player controls.
- Tiles are requested for the visible map viewport only.

### Streamed 3D world
- Local metric projection centered near Sector 17, Chandigarh (30.7415, 76.7820).
- Overpass queries load nearby OSM data in geographic chunks as the vehicle moves.
- OSM road classes use `width` / `lanes` tags where present.
- Joined road strips, intersection patches, sidewalk/curb strips, parks, woodland and water areas are rendered where mapped.
- Building ways and supported multipolygon relation rings use OSM height/floor-count tags where available.
- Selected named roads and places are labelled in the world.

## Accuracy and production considerations

GTA-TriCity uses real geographic positions and mapped features available in OpenStreetMap. Detail varies by local OSM mapping coverage. Sidewalks are inferred for some urban road classes when specific sidewalk tags are missing. Building heights use estimates where tags are missing. OSM does not consistently include facade detail, windows, interiors, lane markings, traffic signals, terrain elevation or pedestrian assets. High-quality landmarks, building facades, interiors, road markings and environment dressing require additional assets and development.

The world streams chunks rather than downloading all of Chandigarh and Mohali at launch. Loaded chunks and their AI agents are retained for the current game session. A production-scale world still needs chunk unloading/LOD, persistent world state, asset streaming and performance profiling.

## Architecture

```text
src/
  main.js                    # Three.js renderer, player car, camera, HUD and game loop
  style.css                  # game HUD, navigation, nitro and impact UI
  world/
    OSMStreamer.js           # Overpass requests, projection and 3D map geometry
    WorldMapView.js          # Leaflet map, destination pins, OSRM routes and guidance
    TrafficSystem.js         # mapped-road vehicle AI, pedestrians and collision events

vite.config.js               # local development Overpass proxy
index.html                   # game shell and interface
package.json                 # Vite, Three.js and Leaflet dependencies
.github/workflows/ci.yml     # production build verification
```

## Next development priorities

1. Replace procedural traffic meshes and pedestrians with rigged, optimized GLB assets.
2. Add traffic lights, stop rules, lane-aware junction turning, vehicle following and collision avoidance.
3. Improve vehicle physics, suspension, braking, road grip, damage states and repair garages.
4. Add pedestrian crossing points, sidewalk/footway topology, crowd density controls and safe recovery behaviours.
5. Add building facade kits, recognizable Chandigarh/Mohali landmarks, road markings, signage and lighting.
6. Add chunk unloading, LOD, instancing, persistent world state and performance budgets.
7. Move public map-data and route requests to suitable hosted services or self-hosted infrastructure for production scale.

## Map data, attribution and service policies

Map data © OpenStreetMap contributors. OpenStreetMap data is licensed under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright. Review ODbL requirements when redistributing data or database derivatives.

The interactive map uses the standard raster tile endpoint `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Keep visible attribution, honour caching and request only tiles currently viewed. The OSM Foundation tile servers are community-funded and best-effort, without an SLA. Use suitable tile infrastructure for public traffic.

The 3D map data uses public Overpass instances with sequential chunk requests. Shared Overpass services can be busy or rate-limited; use an appropriate hosted service or self-hosted OSM data backend for production.

The default route provider is the OSRM public demo server. It is suitable for modest development/testing use, not a service guarantee. Use a dedicated hosted routing provider or self-host OSRM for a public release.

Relevant policies:
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
