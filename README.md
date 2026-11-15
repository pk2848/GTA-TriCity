# GTA-TriCity — Chandigarh × Mohali

GTA-TriCity is an actively developed browser-based open-world driving and exploration game built with Three.js. The world is anchored to Chandigarh–Mohali geography using OpenStreetMap data. The current game start is the CP67 Mall arrival plaza in Sector 67, Mohali.

## CP67 reference material

The exterior reconstruction uses the supplied aerial/front photograph as its principal shape reference, checked against publicly available CP67 photographs. The interior layout is based on the publicly available first-floor general-arrangement drawing and interior photographs.

- [CP67 official gallery](https://cp67.co.in/gallery/)
- [CP67 official site and stacking-plan gallery](https://cp67.in/)
- [CP67 first-floor general arrangement drawing (PDF)](https://www.cp67.co.in/wp-content/themes/cp67-web/assets/images/pdf/first-floor.pdf)
- [CP67 basement 1 general arrangement drawing (PDF)](https://www.cp67.co.in/wp-content/themes/cp67-web/assets/images/pdf/basement1-floor.pdf)
- [CP67 architectural project brief — GPM Architects](https://gpmindia.com/portfolio/commercial/cp-67/)
- [CP67 exterior elevation reference photograph — CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:CP67_Mall_Mohali.jpg)
- [Interior atrium reference photograph](https://akshanshestates.com/wp-content/uploads/2024/01/retail-home-img.jpg)
- [Upper-floor store corridor reference photograph](https://akshanshestates.com/wp-content/uploads/2024/01/sept-img-7.jpg)
- [PVR lobby reference photograph](https://files.yappe.in/place/full/pvr-cinemas-cp67-mall-11268442.webp)

The available architectural brief identifies two basement parking levels, two retail floors, two floors for restaurants/food court/FEC, a seven-screen multiplex, seven office floors and open-to-sky dining areas. The published first-floor drawing labels a retail passage, Lifestyle/Home Centre, Croma, M&S Fountain, an atrium/void, escalator provisions and lift lobbies.

**Accuracy note:** the public material located for this build does not include a complete current as-built BIM model, surveyed façade elevations or every current interior floor plan. The model is a detailed, scale-oriented reconstruction using the published project brief, one published general-arrangement floor drawing and public photos. It is not yet an exact architectural replica of every room, tenant boundary or façade detail. Tenant signs can also change over time. A current as-built CAD/BIM package and verified tenant directory would be needed for a room-by-room exact match.

## Run locally

1. Install Node.js 20 or newer.
2. Clone the repository and open the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. Internet access is required for live OSM data, map tiles and route calculation.

## Starting location

- **Spawn:** CP67 Mall arrival/drop-off forecourt, Sector 67, Mohali.
- **Map origin:** CP67 Mall, approximately 30.67697° N, 76.72403° E.
- The local metric map origin is centred near CP67; Chandigarh and wider Mohali remain in the same connected world.

## Controls

### Driving
- **W / Arrow Up:** drive forward toward the vehicle's nose.
- **S / Arrow Down:** reverse.
- **A / Arrow Left:** steer left.
- **D / Arrow Right:** steer right.
- **Space:** brake.
- **N (hold while accelerating):** nitro; drains and recharges a finite tank.
- **Shift (hold):** secondary engine boost.
- **F:** exit the vehicle when stationary. If overturned, F recovers the car upright.
- **R:** reset the car to the CP67 Mall forecourt, repair vehicle condition and refill nitro.
- **Hold and drag left mouse:** orbit the camera.
- **Mouse wheel:** zoom the follow camera.
- **M:** open/close the detailed city map.
- **Esc:** close the detailed city map.

### Walking and mall exploration
- **F:** leave the parked car; press F near the car to enter it again.
- Walk toward the CP67 entrance to enter the mall interior. The entrance trigger loads the walkable interior.
- **W / S:** walk forwards/backwards.
- **A / D:** turn.
- **Shift:** run.
- **E:** use the lift when standing in the lift lobby; cycles through the modeled public levels.
- Walk back to the ground-floor entrance and press F (or cross the exit threshold) to return outside.
- **M:** map.

## Build 0.12 — driving direction, steering stability and uploaded-only garage

- Fixes the Cannon wheel axis/engine-force sign so **W / Arrow Up drives toward the car's nose** (local -Z); S / Arrow Down reverses.
- Aligns the wheel axle to +X so the raycast tyre-forward vector, steering pivots and the game's -Z vehicle-forward axis agree. A / Left turn left; D / Right turn right.
- Adds speed-sensitive front steering, reduced tyre roll influence and grounded upright-stability torque to reduce flips during normal cornering.
- Removes random roll/pitch impulses from ordinary collision response; impacts now primarily reduce speed and add a controlled yaw response.
- The procedural starter body and procedural wheels are never shown as a player car. A player vehicle becomes visible only after a GLB listed in `public/models/vehicles/manifest.json` loads successfully. If loading fails, the garage reports the failed asset and does not substitute the old truck.
- The garage now builds brand groups and car choices dynamically from `manifest.json`. To add a future car, copy its GLB into `public/models/vehicles/` and add one entry to the manifest; the UI count and options update automatically.
- Charger wheel meshes are grouped by their LF/RF/LR/RR names, so tyre and rim sub-meshes rotate together when the source file exposes separate wheel meshes.

### Add another uploaded player car

1. Copy the new GLB into `public/models/vehicles/`.
2. Add a record to the `vehicles` array in `public/models/vehicles/manifest.json` with:
   - `id`, `brand`, `model`, `displayName`, `file`
   - `scale` and `rotation` (to convert the source model to Y-up with its nose facing local -Z)
   - `wheelRadius`
   - `physics` dimensions/performance: `width`, `length`, `height`, `wheelbase`, `trackWidth`, `engineMultiplier`, `maxSpeed`, `nitroMaxSpeed`
   - optional `wheelGroupPattern` only when separate wheel meshes have stable names
3. Refresh the game. The garage reads the updated manifest—no HTML or JavaScript catalog edit is required.

The GLB's model-axis orientation must be checked before adding it. The garage centres and scales models, but does not guess which end is the bonnet; the manifest's `rotation` must make the front of the car point along local -Z.

## Build 0.11 — vehicle GLB loading repair

- Vehicle model URLs now respect Vite's `BASE_URL`, so GLBs load from the correct public asset root in local and subpath deployments.
- Garage selection is allowed while the player is on foot because the parked car can be replaced safely; while driving, the vehicle must be stopped.
- Adds an explicit retry button for the selected GLB. Failed load errors are preserved in the status tooltip and browser console rather than being silently hidden by the previous generic warning.
- The source files in `src/vehicles/` contain the garage loader; the actual binary GLB models must stay in `public/models/vehicles/` because Vite serves `public` files by URL. The current main branch contains all three required assets at those exact paths.
- Verified source asset sizes and manifest SHA-256 values: Pagani Zonda Cinque 16,747,784 bytes; 1970 Dodge Charger R/T 32,946,792 bytes; 2015 Dodge Challenger R/T 14,853,732 bytes.
- Fixed the garage help text: vehicle selection is available while parked or on foot; use V to focus the selector.

If a model still does not appear, check the garage status. Hover over **LOAD FAILED** for the detailed loader error and inspect the browser console/network tab for the request to `/models/vehicles/<filename>.glb`. The procedural fallback remains visible when a model cannot be loaded.

## Build 0.10 — multi-brand player garage

- Adds a top-right **Player Garage** selector grouped by brand: Pagani and Dodge.
- Available models: Pagani Zonda Cinque, 1970 Dodge Charger R/T Fast & Furious Edition, and 2015 Dodge Challenger R/T Tuned with Armor.
- GLB models are loaded on demand; only the selected car is retained in memory, and the previous model's GPU resources are disposed when switching.
- The Dodge models receive source-coordinate correction and scale normalization. The 2015 Challenger GLB is scaled from centimetre units; the 1970 Charger is converted from its Z-up source orientation.
- The game keeps the procedural starter car visible if the selected GLB is missing or fails to load.
- Vehicle collision dimensions, wheelbase, track width and basic performance profile are updated with the selected model.
- The Dodge GLBs include discoverable wheel groups and receive wheel spin/steering pivots where those groups are available. The Zonda's combined wheel geometry remains visually static unless its source model is re-authored with wheel pivots.

### Install the uploaded vehicle models

The GLB files are binary assets and are supplied in a separate ZIP. Extract the ZIP into the repository root, merging its `public/models/vehicles/` folder:

```text
public/models/vehicles/
  pagani-zonda-cinque.glb
  1970-dodge-charger-rt.glb
  2015-dodge-challenger-rt.glb
```

Then run `npm run dev`. The garage displays a load error and keeps the procedural car if the corresponding GLB is not present. The repo contains `public/models/vehicles/README.md` with the asset credits and rights notes.

The 2015 Dodge Challenger GLB's embedded metadata attributes it to DisneyCars / Sketchfab under CC BY 4.0; attribution is recorded in the asset README. The Zonda and 1970 Charger files were supplied by the project owner without embedded licence metadata, so their redistribution/commercial rights still need to be verified.

## Build 0.9 — CP67 visual and walkable-interior pass

### Exterior
- Reworks the main podium from a solid placeholder block into a perimeter shell with an open interior volume.
- Adds a more recognisable long retail elevation with stone cladding bands, vertical piers, upper glass curtain wall, mullions, signage panels and the distinctive raised CP67 logo feature.
- Adds a glazed office/atrium volume and extra detail to the office-tower grid.
- Adds return-street glazing and signage on both side elevations, so the complex reads as a four-side-open mixed-use site rather than a single flat billboard.
- Uses labels based on visible/source-supported tenants and project uses: PVR, Lifestyle, Home Centre, Max, Trends, Croma, M&S, dining/cafés, food court and office/residential zones.
- Preserves the arrival forecourt, drop-off loop, landscaped edges, parking markings and collision walls.
- The exterior is still a procedural Three.js reconstruction; detailed photography-derived facade materials and exact surveyed geometry remain future work.

### Walkable interior
- Adds a separate interior scene that loads when the player walks through the front entrance.
- Builds a polished stone retail promenade, glass-fronted shop bays, signboards, mall directory signs, central atrium void, glass balustrades, escalator pairs, pendant lights, seating and planters.
- Models four playable public levels: Ground Floor retail, First Floor retail, Second Floor food court/FEC and a PVR seven-auditorium level.
- The food court has labelled stalls, seating and table groups. The PVR level includes seven labelled auditorium rooms with screen walls and seating rows.
- The lift lobby is interactive: press E near it to move between floors.
- Walking character has a third-person follow camera and a procedural human model with arm/leg walk animation.
- The car remains parked and visible after the player exits; F near it returns the player to driving mode.
- F is context-sensitive: exit/enter vehicle, enter/exit the mall, or recover an overturned vehicle.

### Documented layout versus reconstruction
- The first-floor reference drawing is an issued General Arrangement Plan dated 26 September 2017 and identifies retail spaces, shop bays, Life Style & Home Center, Croma, M&S Fountain, passages, atrium/void, lift lobbies and escalator provisions.
- The architect's brief supports the mixed-use vertical programme: two retail floors, two restaurant/food court/FEC floors, seven-screen multiplex, seven office floors and two basement parking levels.
- The playable interior uses those uses and circulation cues, but tenant boundaries, shop assignments, exact escalator locations and the allocation of PVR/food-court rooms across levels remain approximate where a current complete plan was not publicly available.

## Vehicle and city systems

### Vehicle
- `cannon-es` raycast vehicle with four suspension wheels, spring stiffness, damping, tire grip, rear-wheel drive and front-wheel steering.
- Nitro/secondary boost, speed/condition HUD, collision impulses, camera shake and F-key rollover recovery.
- OSM building collision boxes are registered as static physics bodies (capped for browser performance). Road-surface grip variation, curbs and terrain elevation remain future work.

### AI traffic and pedestrians
- OSM road centerlines, one-way tags, signal nodes and crossing nodes feed the traffic simulation.
- AI cars include hatchback, sedan, SUV, van and auto-rickshaw silhouettes; agents can select connected mapped road segments at endpoints.
- Mapped signal/crossing nodes produce traffic lights, zebra crossings and pedestrian waiting behaviour when present in the OSM data.
- Pedestrians use procedural character meshes and walk cycles.
- Traffic is simulated game traffic, not a live Chandigarh traffic-sensor feed. AI cars are not yet rigid-body vehicles in the Cannon world.

### Navigation
- Click a point on the Leaflet map to pin a destination.
- OSRM calculates a drivable route from the current player location.
- The map shows a route line, direction chevrons, destination pin, distance and ETA.
- The circular minimap and 3D road ribbon show remaining route direction and next manoeuvre.
- If walking away from the planned driving route, the navigator may report off-route; use the detailed map to re-pin a destination.

## Architecture

```text
src/
  main.js                    # renderer, driving/walking modes, camera, HUD and interactions
  style.css                  # game HUD, minimap, walking prompt and floor label
  vehicles/
    VehiclePhysics.js         # cannon-es raycast vehicle, suspension and collision bodies
  world/
    OSMStreamer.js            # OSM queries, projection, 3D geometry and obstacle data
    WorldMapView.js           # Leaflet map, route calculation and navigation state
    TrafficSystem.js          # road-following traffic, signals, crossings and pedestrians
    CP67Mall.js               # detailed exterior shell, facade and forecourt
    CP67Interior.js           # walkable retail, atrium, escalators, food court and cinema

index.html                   # game shell and interaction controls
package.json                 # Vite, Three.js, Leaflet and cannon-es
.github/workflows/ci.yml     # production build verification
```

## Next production priorities

1. Obtain current as-built architectural drawings or BIM for accurate façade and room-by-room geometry.
2. Replace procedural facade and interior pieces with high-detail authored GLB assets and correct PBR texture sets.
3. Add accurate tenant/shop boundaries, directory listings, escalator positions, lift/stair cores and the latest PVR/food-court floor allocation.
4. Add walkable store interiors, escalator animation, lift doors/ride animation and indoor NPC shoppers.
5. Add photogrammetry or licensed multi-view façade references for the other CP67 elevations.
6. Add terrain/road surface physics, smarter lane AI and world chunk unloading/LOD.

## Attribution and service policies

- OpenStreetMap data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
- CP67 project information and floor-plan references: Unity/Homeland CP67 project website and GPM Architects & Planners (links above).
- CP67 exterior Commons photo: Iamnegi01, CC BY-SA 4.0 (link above). The photo is used as a visual reference, not as a full-building texture.
- Standard OSM raster tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- OSRM demo-server policy: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
