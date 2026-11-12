import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  // Engine shader modules are bundled up front as well: new maps cannot trigger
  // lazy JS downloads after the preload-ready barrier.
  build: { target: 'safari15', chunkSizeWarningLimit: 3500,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
