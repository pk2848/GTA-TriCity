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

ASSET / LICENCE NOTES
- Pagani Zonda Cinque: supplied by the project owner in this conversation. The GLB does not contain embedded author/licence metadata; distribution rights have not been independently verified.
- 1970 Dodge Charger R/T Fast & Furious Edition: supplied by the project owner in this conversation. The GLB does not contain embedded author/licence metadata; distribution rights have not been independently verified.
- 2015 Dodge Challenger R/T Tuned with Armor: embedded GLB metadata identifies author DisneyCars (https://sketchfab.com/supercarmodels), source https://sketchfab.com/3d-models/2015-dodge-challenger-rt-tuned-with-armor-34af945791e74afb80bdd860a645ef91 and licence CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Attribution: “2015 Dodge Challenger R/T Tuned with armor” by DisneyCars, CC BY 4.0, via Sketchfab.

TECHNICAL NOTES
- The garage loads one selected car at a time and disposes the previous GLB to reduce memory use.
- The Challenger model is authored at 1/100 scale and is scaled to metres by the garage.
- The Charger model is converted from its Z-up source orientation into the game's Y-up coordinate system.
- The game uses a shared physics chassis profile per vehicle. Visual wheel pivot animation is enabled for the Dodge models where wheel groups are present.
- Keep the original files and licences with any public distribution. Do not assume a model is commercially redistributable merely because it loads in Three.js.
