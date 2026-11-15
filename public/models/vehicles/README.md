# GTA-TriCity vehicle assets

The player garage loads these GLB files on demand:

- `pagani-zonda-cinque.glb`
- `1970-dodge-charger-rt.glb`
- `2015-dodge-challenger-rt.glb`
- `bike_black.glb`

Place the files in this folder by extracting the matching vehicle asset pack at the repository root. Keep the bike filename exactly `bike_black.glb` (underscore), matching `manifest.json`. A player vehicle is shown only after its GLB loads successfully; missing models are reported in the garage status.

## Credits and rights

- Pagani Zonda Cinque: user-supplied file; embedded source/licence metadata was not present in the inspected GLB.
- 1970 Dodge Charger R/T Fast & Furious Edition: user-supplied file; embedded source/licence metadata was not present in the inspected GLB.
- 2015 Dodge Challenger R/T Tuned with Armor: file metadata credits DisneyCars (https://sketchfab.com/supercarmodels), CC BY 4.0. Source: https://sketchfab.com/3d-models/2015-dodge-challenger-rt-tuned-with-armor-34af945791e74afb80bdd860a645ef91. Attribution: “2015 Dodge Challenger R/T Tuned with armor” by DisneyCars, CC BY 4.0.

- Black Bike: original source model by Nikitos & 3130 (`https://sketchfab.com/vrcityphoto`), titled “BIKE BLACK”, licensed CC BY 4.0. Source: `https://sketchfab.com/3d-models/bike-black-125180830cbe44818e1be482a509f0e8`. The currently committed file is the original 26 MB photogrammetry scan; a separate cropped/optimized 575 KB derivative is not installed in this folder. Attribute the original creator and preserve CC BY 4.0 terms.

Check and preserve the applicable model licences before distributing a build or using any model commercially.
