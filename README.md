# GTA-TriCity — Chandigarh × Mohali

GTA-TriCity is an actively developed browser-based open-world driving game built with Three.js. The game world is anchored to Chandigarh–Mohali geography using OpenStreetMap (OSM) data.

## Run locally

1. Install Node.js 20 or newer.
2. Clone this repository and open the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. Internet access is required for OSM data, map tiles and route calculation.

## Driving controls

- **W / Arrow Up:** accelerate in the direction the car faces.
- **S / Arrow Down:** reverse.
- **A / D or arrow keys:** steer the front wheels.
- **Space:** brake.
- **N (hold while accelerating):** nitro. It drains a finite tank and increases engine force and top speed; the tank refills after release.
- **Shift (hold):** secondary engine boost.
- **R:** reset vehicle at the Sector 17 origin and repair/refill it.
- **Hold and drag left mouse on the 3D canvas:** orbit camera.
- **Mouse wheel on the 3D canvas:** zoom follow camera.
- **M:** open/close the detailed city map.
- **Esc:** close the detailed city map.

## Build 0.6 — vehicle dynamics and city traffic

### Player vehicle physics
- Player motion is now driven by `cannon-es` `RaycastVehicle`, not direct position integration.
- Four raycast wheels provide suspension travel, spring stiffness, compression/relaxation damping, tire grip and braking.
- Front wheels steer; rear wheels receive engine force.
- Vehicle rotation, body weight and suspension transforms feed the third-person camera and minimap.
- N-key nitro changes engine force and the speed cap; Shift remains a separate smaller boost.
- Impact events apply a velocity impulse and yaw response. Vehicle condition reduces available engine power.
- The player SUV model now has a more complete bonnet/cabin/roof/window/bumper/light silhouette.

### AI traffic and junctions
- OSM road centerlines are passed to the traffic simulation as connected road segments.
- AI cars follow offset lane paths and choose connected roads at segment endpoints, preferring a continuation that avoids an immediate U-turn.
- OSM `oneway` tags constrain allowed movement.
- AI traffic uses procedural hatchback, sedan, SUV, van and auto-rickshaw silhouettes.
- Cars approach mapped traffic-signal nodes and stop for the red phase. Signal heads animate red, amber and green phases.
- Traffic is generated from map geometry; it is simulated game traffic, not a live Chandigarh traffic feed.

### Pedestrians and crossings
- Pedestrians walk along generated sidewalk paths beside urban streets.
- OSM crossing nodes create zebra crossing markings and pedestrian crossing paths.
- Where a nearby signal exists, crossing walkers wait for the vehicle red phase; crossings without a mapped signal use timed gaps.
- Human meshes include head/hair/clothing/limbs and a walk cycle.
- Player contact produces a non-graphic stumble/recovery reaction and reduces vehicle condition.

### Chandigarh building detail
- Building heights and floor levels use OSM `height`, `building:levels`, `min_height` and `building:min_level` tags where available.
- Building use receives different Chandigarh-appropriate residential, commercial, industrial and civic palettes.
- Facade window frames and glazing are generated with `THREE.InstancedMesh` to keep repeated details efficient.
- Parks, woodland, water, raised sidewalks and selected named POIs are rendered from OSM features.

## Destination routing

1. Press **M** or click **OPEN MAP**.
2. Click a destination on the OpenStreetMap view.
3. OSRM calculates a drivable route from the current vehicle position.
4. The map shows a highlighted route with screen-sized direction chevrons, destination pin, distance and ETA.
5. Close the map to see the next manoeuvre and remaining distance/time in the HUD.
6. A gold route ribbon and destination beacon are rendered in the 3D world.
7. Use **CLEAR PIN** or click another location to change/cancel the destination.

## Real-world data architecture

### 2D navigation
- Leaflet displays standard OpenStreetMap raster map tiles.
- The player's live position and heading are converted between a local metric coordinate system and latitude/longitude.
- The map supports pan, zoom, follow player and center on player.

### 3D streamed city
- Local metric origin is near Sector 17, Chandigarh (30.7415, 76.7820).
- Overpass queries load nearby OSM chunks as the player moves.
- Road widths use OSM `width` and `lanes` tags where present.
- Road junction patches, sidewalks, curbs, parks, woodland and water are generated from mapped geometry.
- OSM traffic signal and crossing nodes are sent to the traffic simulation.
- Building footprints and supported multipolygon outer/inner rings are extruded to tagged/estimated heights.

## Accuracy and production considerations

The geography, mapped road positions and feature footprints come from OpenStreetMap, but coverage varies. Sidewalks are inferred where specific sidewalk tags are missing. Building heights use estimates where OSM tags are absent. Facades are procedural, not surveyed architectural models; windows and building palettes are visual estimates. Traffic cars and pedestrians are procedural game characters. AI traffic is not synchronized to live traffic-control systems.

The physics world currently uses a simplified flat ground collision plane plus raycast suspension. The next physics pass should add OSM building/curb collision bodies, terrain elevation, road surface grip variation and more complete collisions between AI vehicles and the player. Current AI vehicles use lane paths with endpoint junction selection; full lane topology, turn signals, queueing, safe-distance following and complex intersection conflict resolution remain future work.

The whole city is not downloaded at start. OSM chunks stream around the player's position and remain loaded for the current session. Production-scale use needs chunk unloading/LOD, memory budgets, persistent world state and a suitable map-data/routing service.

## Architecture

```text
src/
  main.js                    # renderer, player car, camera, HUD and game loop
  style.css                  # game HUD, navigation, nitro and impact UI
  vehicles/
    VehiclePhysics.js         # cannon-es raycast car, suspension, steering and impact response
  world/
    OSMStreamer.js            # Overpass requests, projection and 3D map geometry
    WorldMapView.js           # Leaflet map, destination pins, OSRM routes and guidance
    TrafficSystem.js          # connected-road AI traffic, signals, crossings and pedestrians

vite.config.js               # local development Overpass proxy
index.html                   # game shell and interface
package.json                 # Vite, Three.js, Leaflet and cannon-es
.github/workflows/ci.yml      # production build verification
```

## Next production priorities

1. OSM building and road collision bodies; terrain and road-surface physics.
2. More complete lane graphs, right/left turn choice, junction conflict rules, traffic queues and safe following distances.
3. Better procedural and authored local vehicle/character GLB assets with animation, LOD and instancing.
4. Traffic signal groups with directional heads, pedestrian countdown phases and smarter crossing behaviour.
5. Distinct Chandigarh landmarks, sector markets, civic buildings and facade/roof kits.
6. Chunk unload/LOD, profiling, asset streaming and persistent player/world state.
7. A dedicated routing, map-tile and OSM-data backend before a public high-traffic release.

## Map data, attribution and service policies

Map data © OpenStreetMap contributors. OpenStreetMap data is licensed under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright. Review ODbL requirements when redistributing data or database derivatives.

The interactive map uses standard OSM raster tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Keep visible attribution, honour caching and request only the viewport. The OSM Foundation standard tile servers are community-funded and best-effort, with no SLA.

3D map data uses public Overpass instances with sequential chunk requests. Shared Overpass instances can be busy or rate-limited; production traffic should use a suitable hosted service or self-hosted OSM backend.

The default route provider is the OSRM public demo server. It is for modest development/testing use, not a production service guarantee. Use a hosted routing provider or self-host OSRM for a public release.

Relevant policies:
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
