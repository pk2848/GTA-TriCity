# GTA-TriCity — Chandigarh × Mohali

GTA-TriCity is an actively developed browser-based open-world driving game built with Three.js. The playable world uses OpenStreetMap geography and currently starts at CP67 Mall, Sector 67, Mohali.

## CP67 Mall visual references

The custom CP67 landmark is an original Three.js reconstruction guided by publicly available exterior photographs and the published architectural brief. The Commons photograph below is included as a reference link/image, not copied as a facade texture into the game.

![CP67 Mall entrance reference](https://upload.wikimedia.org/wikipedia/commons/6/67/CP67_Mall_Mohali.jpg)

Photo: Iamnegi01, *CP67 Mall Mohali*, 4 August 2024, licensed CC BY-SA 4.0. [File page and licence](https://commons.wikimedia.org/wiki/File:CP67_Mall_Mohali.jpg). The reference photo is not modified or redistributed as a game texture.

Additional reference material:
- [Official CP67 Mall gallery](https://cp67.co.in/gallery/)
- [Official CP67 Mall website](https://cp67.co.in/)
- [CP67 project architectural description — GPM Architects](https://gpmindia.com/portfolio/commercial/cp-67/)
- [CP67 Mall on OpenStreetMap-derived Mapcarta map](https://mapcarta.com/N13147982801)

The architect's published project description identifies a four-side-open site of 181,781 sq ft, 1,057,317 sq ft built-up area, two basement parking levels, retail floors, restaurant/food-court/FEC levels, a seven-screen multiplex, office floors and open-to-sky dining areas. The in-game geometry is a scale-oriented visual reconstruction, not an approved as-built BIM model.

## Run locally

1. Install Node.js 20 or newer.
2. Clone the repository and open the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. An internet connection is required for live OSM data, map tiles and driving-route calculation.

## Starting location

- **Spawn:** CP67 Mall arrival/drop-off plaza, Sector 67, Mohali.
- **Map origin:** CP67 Mall OSM point 13147982801, approximately 30.67697° N, 76.72403° E.
- The world coordinate system is a local metric projection centred on CP67 Mall, so Chandigarh and the wider Mohali area remain in the same connected map.

## Driving controls

- **W / Arrow Up:** accelerate in the direction the car faces.
- **S / Arrow Down:** reverse.
- **A / D or arrow keys:** steer.
- **Space:** brake.
- **N (hold while accelerating):** nitro; consumes a finite tank and recharges after release.
- **Shift (hold):** secondary engine boost.
- **F:** recover an overturned vehicle at its current location.
- **R:** reset the car to the CP67 Mall drop-off plaza, repair condition and refill nitro.
- **Hold and drag left mouse on the 3D canvas:** orbit the camera.
- **Mouse wheel on the 3D canvas:** zoom the follow camera.
- **M:** open/close the detailed city map.
- **Esc:** close the detailed city map.

## Build 0.8 — vehicle recovery and route guidance correction

- Adds rollover detection to the Cannon vehicle controller. When the chassis stays tipped, the HUD displays **VEHICLE OVERTURNED · PRESS F TO RECOVER**.
- Press **F** to stand the vehicle upright at its current location, retain its heading, clear linear/angular velocity, refresh suspension state and continue driving. Press **R** to respawn at CP67 Mall instead.
- Throttle and boost are suppressed while the car is overturned.
- Corrects map direction-arrow rotation so northbound and eastbound route arrows point in the proper screen direction.
- Navigation progress is measured along the route polyline instead of straight-line distance to the next turn, reducing premature instruction skipping at parallel streets and junctions.
- The circular minimap starts the remaining route at the vehicle's projected route position, draws future direction chevrons and displays the next manoeuvre with distance to turn.
- The full-screen map toolbar displays the current next manoeuvre, distance to turn, remaining distance and ETA.
- The 3D street route includes repeated direction chevrons along the highlighted road path.

Route quality still depends on the routing service and mapped road network. The circular minimap is a compact forward view of the remaining route, not a full city-scale overview; use the full map for distant destinations. If no route is active, the minimap displays “NO ACTIVE ROUTE”. If the player leaves the road network, navigation shows the distance back to the highlighted route.

## Build 0.7 — CP67 Mall and navigation update

### CP67 Mall landmark
- Replaces the default Sector 17 spawn with the CP67 Mall public drop-off plaza.
- Adds an original procedural model for the retail podium, glazed main atrium, steel-and-glass entrance canopy, multi-storey office tower, serviced-residence wing, seven-screen cinema volume, food-court/restaurant terrace, rooftop plant rooms, basement parking ramp, valet booth, forecourt, drop-off loop, parking bays, planters, palms, trees and lamps.
- Adds building collision volumes so the vehicle cannot drive through the main mall structure.
- Suppresses the coarse OSM building extrusion in the custom mall footprint to avoid two overlapping building models.
- Uses a facade-window InstancedMesh system and reusable materials so repeated window details do not create one draw call per pane.
- The ground-floor storefronts and entrance atrium are visible from outside. The interior is not yet a complete walkable/enterable mall; indoor shops, floor navigation, escalators, lifts and detailed cinema/food-court interiors are future work.

### Route display
- Fixes the Leaflet error caused by calling `bringToFront()` on Marker objects. Route Paths use `bringToFront()`; markers now use their supported z-index offset.
- The circular minimap now draws the pinned route in heading-up orientation, repeats direction chevrons along the path, highlights the next manoeuvre, and shows the next instruction and distance-to-turn.
- The full-size map retains the route line and turn direction markers.

## Vehicle and world systems

### Vehicle
- `cannon-es` raycast vehicle with four suspension wheels, spring stiffness, damping, tire grip, rear-wheel engine force and front-wheel steering.
- Nitro/secondary boost, speed and condition HUD, collision impulses and camera shake.
- Current ground is a flat plane. Terrain elevation, road-surface grip and curb physics are still pending.

### AI traffic and pedestrians
- Traffic agents use OSM road centre-lines, mapped one-way tags and connected road endpoints.
- Simulated cars include hatchback, sedan, SUV, van and auto-rickshaw silhouettes.
- Mapped signal/crossing nodes generate signal heads and zebra-crossing behaviour where the source data contains those features.
- Pedestrians use procedural character meshes and walk cycles along inferred sidewalk paths.
- AI traffic is simulated game traffic, not a live feed from Chandigarh/Mohali road sensors. AI cars are not yet rigid bodies in the Cannon physics world.

### 3D map
- Overpass streams OSM roads, buildings, sidewalks/curbs, parks, woodland, water and selected named places in geographic chunks.
- Building footprint/height uses OSM data when available, with estimates when tags are absent.
- The custom CP67 mall model replaces the coarse OSM building geometry in its campus footprint.

## Destination navigation

1. Press **M** or click **OPEN MAP**.
2. Click a destination on the OpenStreetMap view.
3. OSRM calculates a drivable route from the current vehicle location.
4. The full map draws the route and direction chevrons.
5. The circular minimap also draws the route, direction arrows and next-turn cue.
6. The HUD displays the next instruction and remaining distance/time.
7. Use **CLEAR PIN** or choose another map point to replace the destination.

## Architecture

```text
src/
  main.js                    # renderer, player vehicle, camera, HUD and game loop
  style.css                  # HUD, navigation and game interface
  vehicles/
    VehiclePhysics.js         # cannon-es raycast vehicle, suspension and static collision bodies
  world/
    OSMStreamer.js            # OSM queries, projection, 3D map geometry and obstacle data
    WorldMapView.js           # Leaflet map, routes, direction guidance and minimap state
    TrafficSystem.js          # road-following traffic, signal heads, crossings and pedestrians
    CP67Mall.js               # custom CP67 Mall campus landmark and collision footprints

index.html                   # game shell and HUD
package.json                 # Vite, Three.js, Leaflet and cannon-es
.github/workflows/ci.yml     # production build verification
```

## Production considerations

- The CP67 geometry is a custom visual approximation guided by the linked photo and published project brief, not an exact surveyed building model or architectural BIM.
- Public Overpass, OpenStreetMap raster tiles and OSRM demo routing are development services. Use dedicated hosted/self-hosted infrastructure before a public high-traffic release.
- World chunks currently stream around the player; unloading/LOD and persistent city state are future work.
- The 3D world is not a photogrammetric replica. Accurate building facade assets, terrain, interiors, roads markings, traffic lights and vehicle/character assets need continuing development.

## Attribution and service policies

- OpenStreetMap data © OpenStreetMap contributors, licensed under ODbL: https://www.openstreetmap.org/copyright
- CP67 reference photograph: Iamnegi01, CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
- CP67 architectural program reference: GPM Architects & Planners, CP 67 project page.
- OpenStreetMap tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- OSRM demo-server policy: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
