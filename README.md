# Tricity Drive — Chandigarh × Mohali (Build 0.2)

A browser-based Three.js open-world driving prototype. Build 0.2 adds live OpenStreetMap chunk loading: OSM highway ways become 3D road surfaces and OSM building ways become extruded building footprints.

## Run locally

1. Install Node.js 20 or newer.
2. Extract this project and open the folder in a terminal.
3. Run:

```bash
npm install
npm run dev
```

4. Open the Vite URL (normally http://localhost:5173).
5. Press **ENTER THE CITY**. An internet connection is required to fetch live map data.

For a production/static deployment, the app falls back to public Overpass endpoints. For a reliable public launch, run your own Overpass proxy/cache and respect provider usage policies.

## Controls

- W / Arrow Up: accelerate
- S / Arrow Down: reverse
- A / D or arrow keys: steer
- Space: brake
- Shift: boost
- R: reset to Sector 17 starting point
- Drag mouse: orbit the follow camera

## What is implemented

- Third-person drivable car and follow camera
- Metric world projection centered near Sector 17, Chandigarh (30.7415, 76.7820)
- Live Overpass API query for OSM road ways and building ways
- Real map geometry converted to 3D road strips and extruded building footprints
- Sequential tile request queue with pacing, retry state and adjacent-chunk prefetch
- Map status, chunk/road/building counts, checkpoint, speedometer and HUD
- Visible OpenStreetMap / ODbL attribution link

## Map coverage and accuracy

The game does **not** bundle the entire Chandigarh–Mohali dataset. It requests one approximately 2 km × 2 km map chunk around the player, then requests the next neighbouring chunk as the player approaches a tile edge. This progressive approach avoids downloading and rendering the entire metro area at once. The starting chunk is centred around Sector 17.

The current importer handles OSM `way` elements tagged as `highway` and `building`. It does not yet reconstruct relation-based multipolygon buildings, building interiors, lane markings, road junction topology, terrain elevation, traffic rules, or collisions. Building heights are read from OSM `height` / `building:levels` tags when available and estimated otherwise. The driving physics are arcade-style, not simulation-grade.

## Architecture

```text
src/
  main.js                  # renderer, player vehicle, camera, HUD, game loop
  style.css                # game HUD and menu
  world/
    OSMStreamer.js         # Overpass query, tile queue, projection, 3D geometry

vite.config.js             # local development Overpass proxy
index.html                 # game shell
```

Planned modules as the project grows:

```text
src/
  core/                     # Game lifecycle, input, asset manager
  world/                    # OSM relation parser, roads, district data, chunk LOD
  vehicles/                 # Rapier physics, suspension, vehicle switching
  characters/               # player controller, animation, interaction
  traffic/                  # lane graph, traffic signals, AI agents
  gameplay/                 # mission manager, economy, wanted system, saves
  ui/                       # map, minimap, menus, garage and settings
public/models/              # optimized GLB vehicles, buildings, props, characters
public/audio/               # ambience, engine, traffic and UI sounds
```

## Development roadmap

1. Verify real OSM coverage around Sector 17 and tune chunk geometry / road widths.
2. Add relation-based multipolygon buildings, road junction joins, sidewalks, parks and water.
3. Add Rapier physics and road-aware vehicle collisions.
4. Replace generic extrusions with optimized GLB assets, PBR materials, LODs and instancing.
5. Expand into Chandigarh sectors and Mohali phases with district-aware streaming.
6. Add pedestrians, traffic AI, day/night, missions, garages and persistence.
7. Profile and optimize: instancing, merged geometry, frustum culling, texture compression, chunk disposal and a server-side OSM cache.

## OpenStreetMap attribution and licensing

Map data © OpenStreetMap contributors. OpenStreetMap data is licensed under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright. If you redistribute a database derived from OSM, review the ODbL obligations and provide the required notices.

## Important service note

Overpass instances are shared community infrastructure intended for reasonable query volumes. This app queues one chunk request at a time and spaces consecutive requests. Do not turn it into a high-volume public service without a dedicated provider, cache, or self-hosted Overpass instance. The public endpoints can be busy, unavailable, or rate-limited; use **RETRY CURRENT AREA** when necessary.
