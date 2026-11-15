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

## Build 0.18 — frame-time repair and rideable motorcycle

- Removes the American Road GLB overlay from the live OSM tile path. The old implementation instanced an entire 103 MB scene (including all selected meshes) across every road segment; the screenshot's roughly 465 million triangles and 1,975 draw calls are consistent with that repeated-instancing failure. The uploaded road asset remains in `src/other/` but is not loaded into the live game until it is reduced to a clean, low-poly road-only segment.
- Keeps OSM roads, sidewalks, junction patches, map routing and traffic road centerlines active. No navigation or OSM intersection geometry is removed.
- Integrated-GPU Performance preset is now 0.55 render pixel ratio, 2 AI cars and 5 pedestrians. Balanced is capped at 0.72, 3 cars and 8 pedestrians. Adaptive resolution can step down to 0.36 after sustained low FPS.
- Camera far plane reduced to 3.5 km; cached OSM chunks outside a 950 m radius are hidden; per-tile generic window instances capped at 1,800 and labels at 12.
- Ambient NPCs and traffic agents are visually culled when far from the player. The uploaded Mita Ashley model is used for one roaming NPC rather than every third NPC; other walkers stay lightweight procedural characters.
- Adds a player rider mount for the motorcycle. When the player drives the Black Bike, the existing player avatar appears at the bike seat with arms reaching toward the handlebar, knees/legs bent toward the pegs, and subtle turn lean. On foot or in cars, the rider mount is hidden and the normal walking avatar pose is restored.
- Motorcycle chassis mass is set from the bike profile (260 kg), with motorcycle-sized collision bounds and contact positions.
- The bike manifest currently points to the original uploaded photogrammetry scan (26,420,884 bytes), which includes surrounding scan geometry. The garage loads it with a dimension warning rather than rejecting it. The separate optimized 575 KB derivative is not installed in this folder yet.

### Required Black Bike binary replacement

The GitHub branch currently contains the original 26 MB `public/models/vehicles/bike_black.glb`. A separate optimized GLB derivative (about 19.4k triangles) is not currently installed. The garage keeps the manifest filename so the original bike remains selectable until the optimized asset is added. Then commit the replaced binary:

```bash
git add public/models/vehicles/bike_black.glb
git commit -m "Replace raw Black Bike scan with optimized rideable model"
git push origin main
```

The optimized model preserves the uploaded bike scan's attribution: “BIKE BLACK” by Nikitos & 3130 (vrcityphoto), CC BY 4.0. Attribution/source is documented under `public/models/vehicles/BIKE-ATTRIBUTION.txt`.

## Build 0.17 — uploaded girl pedestrians and American road asset

- Adds the uploaded Mita Ashley stylized T-pose GLB from `src/charachter/mita_ashley_-_anime_girl_-_3d_stylized_tpose.glb` as a roaming female pedestrian model.
- The character GLB is fetched only after the first OSM pedestrian spawns. It is normalized to approximately 1.66 m tall, then shared via skeleton-safe clones on roughly one out of every three ambient pedestrians. Other pedestrians keep the lightweight procedural character to preserve variety and reduce draw/memory cost.
- If the character GLB contains a walk/run clip, the NPC uses it. Otherwise, the system attempts a procedural bone walk using common upper-leg/arm bone names and applies a subtle body bob. The file name indicates a T-pose; uncommon bone names may require a Blender retarget/animation pass for a natural gait.
- The second uploaded girl model, `src/charachter/anime_girl_hot_outfit__stylized_3d_character.glb`, remains in the repository but is not loaded in this build. It is about 85 MB; loading both large character files would add unnecessary download and GPU memory pressure on the integrated-GPU target.
- Adds `src/world/RoadAssetRenderer.js` to load `src/other/american_road.glb` only after the first drivable OSM road tile is available.
- The American road asset is prepared once, then rendered as shared `InstancedMesh` road sections along OSM road centerlines. Flat road-like submeshes are preferred; tall scene props are filtered out when possible. Long OSM ways are split into repeated sections to avoid stretching one road texture over long streets.
- Original OSM road ribbons remain underneath the detailed road asset, preserving mapped intersections, junction geometry and a fallback if the uploaded road GLB fails. AI traffic and OSRM navigation continue to use OSM geometry, not the American road mesh.
- The 102.8 MB road GLB is lazy-loaded after city roads are requested, not downloaded with the initial HTML. It is instanced with shared geometry/materials rather than duplicated for every street.
- First-time road and character loading can still take time and temporarily raise CPU/memory use while GLTFLoader parses the large files.

### Uploaded assets
- `src/charachter/mita_ashley_-_anime_girl_-_3d_stylized_tpose.glb` — ambient girl pedestrian.
- `src/charachter/anime_girl_hot_outfit__stylized_3d_character.glb` — retained for a future optional pedestrian variant; not loaded in Performance mode.
- `src/other/american_road.glb` — instanced visual road surface overlay.

The uploaded model files were provided by the project owner. Verify the original source licences before redistributing them in a public or commercial game.

## Build 0.16 — bike loading fix, integrated-GPU optimisation and camera follow

- Fixes the Black Bike manifest filename to match the actual uploaded repository asset: `public/models/vehicles/bike_black.glb` (underscore). The committed file is the original 26,420,884-byte scan. The manifest records its size; the optimized 575 KB derivative is not present at this path.
- Motorcycle scans now use motorcycle-specific road-axis validation. The strict car width/length ratio is retained for cars, but scan-footprint width no longer rejects a two-wheeler whose dominant forward axis is local -Z.
- Ambient AI car traffic excludes entries marked `physics.vehicleType: "motorcycle"` until a dedicated rider/two-wheel traffic system is implemented. This also avoids loading the 26 MB bike scan a second time into the traffic renderer.
- Adds an integrated-GPU Performance graphics preset: antialiasing off, renderer pixel ratio capped at 0.85, real-time shadow maps disabled, traffic/pedestrian budgets reduced, and adaptive resolution downscales further if frame rate stays low. A Balanced preset is also available.
- Adds a live frame-rate / draw-call / triangle readout in the garage graphics controls.
- Reduces generic OSM window instance cap from 12,000 to 5,000 per tile and hides cached city chunks beyond 1.8 km from the player to reduce far-scene rendering.
- The camera target height is now based on the vehicle's actual visual position, and the follow response tightens with speed. It does not increase the selected chase-camera distance while accelerating; mouse-wheel and C-key camera preset choices remain in control.

### Black Bike asset note
The repository currently contains the original 26 MB photogrammetry GLB at `public/models/vehicles/bike_black.glb`. It may include scan spill/ground geometry. The separate optimized 575 KB derivative is not installed; the garage now loads the committed raw scan instead of rejecting it for non-standard dimensions.

## Build 0.15 — Black Bike motorcycle asset

- Adds `bike-black.glb` to `public/models/vehicles/` and registers it in the manifest-driven player garage under **Motorcycle → Black Bike**.
- The uploaded 26 MB photogrammetry GLB was prepared as a browser-friendly 588 KB game asset: seven material sections retained, central bike scan cropped away from much of the surrounding paving, mesh reduced to approximately 19,440 triangles, and seven albedo textures reduced to 512 px. Position/normal/UV attributes use `KHR_mesh_quantization`.
- After the manifest transform, the target dimensions are approximately 0.80 m wide × 1.33 m high × 2.00 m long. The model's local forward axis is aligned to the game's -Z road-forward convention.
- Adds motorcycle-specific physics dimension limits so the bike's narrow body, shorter wheelbase and small tyre radius are not clamped to car-sized dimensions.
- The model is a textured photogrammetry scan without separately named wheel meshes; therefore its visible wheels are static in this first integration. The existing four-contact raycast physics is reused with a narrow track width; dedicated two-wheel motorcycle leaning/steering physics remains future work.
- The same manifest entry makes the bike eligible for the existing AI traffic model pool.

### Install the Black Bike binary asset

The garage manifest and motorcycle physics profile are already in the repository. The optimized binary is supplied as a separate ZIP because this GitHub connection can commit source text but cannot upload binary GLB bytes directly. Download the provided `GTA-TriCity-Bike-Asset.zip` and extract it at the repository root; it contains `public/models/vehicles/bike-black.glb` and its attribution text.

Verify the file after extraction:

```bash
sha256sum public/models/vehicles/bike-black.glb
```

Expected SHA-256: `a243216ddcf11d2179a7e90966ec4dca04177b8507c94aab61e7de0537403d12`.

Then commit the model to your GitHub repository:

```bash
git add public/models/vehicles/bike-black.glb public/models/vehicles/BIKE-ATTRIBUTION.txt
git commit -m "Add optimized Black Bike motorcycle asset"
git push origin main
```

### Black Bike attribution

Original model: **“BIKE BLACK”** by **Nikitos & 3130 (vrcityphoto)**, CC BY 4.0. Source: https://sketchfab.com/3d-models/bike-black-125180830cbe44818e1be482a509f0e8. Acknowledge the creator and include the licence link when redistributing the asset.

## Build 0.14 — 1970 Charger axis correction

- Corrects the 1970 Dodge Charger source orientation: its supplied GLB is Z-up, with the long axis along source Y. The manifest now applies **X = -90°, Y = 0°, Z = 0°**. This maps its height to game +Y and its nose/longitudinal axis to game -Z.
- Removes the erroneous additional 180° Y rotation that flipped the up axis under Three.js's XYZ Euler composition.
- Corrects the Charger wheel group pattern to match the actual source node names `Wheel1A_LF`, `Wheel1A_RF`, `Wheel1A_LR`, and `Wheel1A_RR`.
- The GLB dimensions after correction are approximately 1.98 m wide × 5.27 m long × 1.42 m high.
- Adds a runtime axis check to the garage. A vehicle must have its length along local Z and height along local Y before it can appear. Misaligned future assets produce a clear manifest rotation error rather than a car standing vertically.
- Traffic uses the same manifest transform, so the Charger orientation is corrected for ambient AI cars as well.
- Road direction remains handled by the vehicle chassis yaw: each uploaded model's local nose points down local -Z, and the physics heading rotates that axis to follow mapped road segments in world X/Z.

## Build 0.13 — nitro stability, uploaded-model traffic and camera presets

- Reduces the rear-wheel engine force from the previous 1.85x nitro spike to a gradual 1.13x acceleration increase. Nitro now ramps in/out over time and increases the speed cap progressively rather than applying an instant force impulse.
- Adds grounded speed-dependent downforce and firmer suspension damping so high-speed/nitro acceleration is less likely to lift the front axle or bounce the vehicle. Stability correction is softened and high roll/pitch angular rates are limited. Severe crashes and off-road jumps can still lift or overturn the car.
- Keeps the three uploaded GLB models as the only player-car options.
- Replaces box-built AI traffic cars with random clones of the uploaded Pagani Zonda Cinque, 1970 Dodge Charger R/T and 2015 Dodge Challenger R/T models. Traffic follows the existing OSM road paths in both directions where the mapped road is not one-way.
- Traffic models are loaded from `public/models/vehicles/manifest.json`, shared as cached templates and merged by material to reduce the 2015 Challenger's large mesh count. The traffic cap is 12 vehicles to protect performance on integrated-GPU desktops.
- Keeps the garage selector interactive while a large GLB is loading. If another model is chosen during a load, the latest selection is queued and loaded next.
- Adds **C** camera cycling: Rear Chase, Close Chase, Far Chase, Cinematic Side and Bonnet/First-Person. Mouse drag still orbits and the mouse wheel still zooms chase views.
- Adds C CAMERA to the HUD control legend.

### Traffic model behaviour
AI traffic uses only uploaded models present in the manifest. Adding a new GLB and manifest entry makes it eligible for both the top-right player garage and the random ambient traffic pool. The traffic system shares model geometry/material resources between repeated cars; wheels are not independently animated on traffic clones yet.

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
    RoadAssetRenderer.js      # Instanced uploaded American road surface over OSM centerlines
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
