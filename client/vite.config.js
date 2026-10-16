import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  server: { host: true, port: 5173, fs:{allow:[fileURLToPath(new URL('.',import.meta.url)),fileURLToPath(new URL('../shared',import.meta.url))]}, proxy: { '/ws': { target: 'ws://127.0.0.1:8080', ws: true }, '/api': 'http://127.0.0.1:8080' } },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000, rollupOptions:{input:{index:'index.html',models:'model-review.html'}} },
});
