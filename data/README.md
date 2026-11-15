# Build the Tricity offline map

This folder is for the one-time source extract. The downloaded GeoJSON is not committed to Git.

1. Open https://extract.bbbike.org/extract.html
2. Select a rectangle covering Chandigarh, Mohali and Panchkula. Suggested bounds:
   - West: 76.60
   - East: 76.98
   - South: 30.55
   - North: 30.83
3. Choose **GeoJSON** format and request the extract.
4. Save the downloaded file as `data/tricity.geojson` (create this folder if it does not exist).
5. From the repository root, run:

   ```bash
   npm install
   npm run build:offline-map -- data/tricity.geojson
   ```

The builder writes a static tile pack under `public/maps/tricity-offline/`. Start the game normally with `npm run dev`. The 3D streamer reads the local pack before trying Overpass.

To ship the offline map in a deployed build, include the generated `public/maps/tricity-offline/` directory in the deployment. Keep the OpenStreetMap attribution and ODbL notice.

The browser also saves individual live-fetched tiles in IndexedDB. Those cached tiles are local to that browser/device; the generated static pack is what makes the complete selected region portable.
