import { defineConfig } from 'vite';

// In local development, proxy Overpass through a dedicated instance to avoid
// browser CORS issues. OSMStreamer has additional public fallbacks for production.
export default defineConfig({
  server: {
    proxy: {
      '/osm-query': {
        target: 'https://overpass.private.coffee',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/osm-query$/, '/api/interpreter')
      }
    }
  }
});
