GTA-TriCity vehicle asset pack

HOW TO INSTALL
1. Extract this ZIP into the root folder of your GTA-TriCity checkout.
2. Merge the included public/ folder with your existing public/ folder.
3. Confirm the files exist at the exact paths listed below.
4. Run npm run dev and select the car in the top-right Player Garage.

FILES
- public/models/vehicles/pagani-zonda-cinque.glb
- public/models/vehicles/1970-dodge-charger-rt.glb
- public/models/vehicles/2015-dodge-challenger-rt.glb
- public/models/vehicles/bike_black.glb (original 26 MB uploaded scan; optimized derivative not currently installed)
- public/models/vehicles/Model No-08.glb
- public/models/vehicles/animated_civilian_helicopter.glb
- public/models/vehicles/animated_yacht.glb
- public/models/vehicles/helipad.glb

The animated civilian helicopter and yacht GLBs play their embedded animation clips through `THREE.AnimationMixer`. The CP67 helipad overlays the uploaded helipad GLB with a procedural fallback. The yacht spawns at the custom TriCity Marina in `src/world/BoatMarina.js`.

ASSET / LICENCE NOTES
- Pagani Zonda Cinque: supplied by the project owner in this conversation. The GLB does not contain embedded author/licence metadata; distribution rights have not been independently verified.
- 1970 Dodge Charger R/T Fast & Furious Edition: supplied by the project owner in this conversation. The GLB does not contain embedded author/licence metadata; distribution rights have not been independently verified.
- 2015 Dodge Challenger R/T Tuned with Armor: embedded GLB metadata identifies author DisneyCars (https://sketchfab.com/supercarmodels), source https://sketchfab.com/3d-models/2015-dodge-challenger-rt-tuned-with-armor-34af945791e74afb80bdd860a645ef91 and licence CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Attribution: “2015 Dodge Challenger R/T Tuned with armor” by DisneyCars, CC BY 4.0, via Sketchfab.

TECHNICAL NOTES
- The garage reads the four entries in manifest.json and loads the selected GLB into the player vehicle. It disposes the previous GLB after a successful replacement.
- The Challenger model is authored at 1/100 scale and is scaled to metres by the garage.
- The Charger GLB is loaded with Y-up orientation and a 180-degree yaw; do not add the old -90-degree X rotation, which makes the car stand vertically.
- The game uses a shared physics chassis profile per vehicle. Visual wheel pivot animation is enabled for the Dodge models where wheel groups are present.
- Keep the original files and licences with any public distribution. Do not assume a model is commercially redistributable merely because it loads in Three.js.
