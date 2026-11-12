import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  build: { target: 'safari15', chunkSizeWarningLimit: 650 }
});
