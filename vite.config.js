import { defineConfig } from 'vite';

// base './' so the build works from any sub-path (GitHub Pages, Cloudflare Pages, itch.io...)
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
