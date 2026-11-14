import { defineConfig } from 'vite';

// In local development, proxy Overpass through Vite to avoid browser CORS
// configuration issues. Production builds fall back to public Overpass endpoints.
export default defineConfig({
  server: {
    proxy: {
      '/osm-query': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/osm-query$/, '/api/interpreter')
      }
    }
  }
});
