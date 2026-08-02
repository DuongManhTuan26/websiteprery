import { defineConfig } from 'vite';
import path from 'node:path';

// Builds to a single, dependency-free IIFE — a widget embedded on a
// third-party page must not bring a framework runtime or leak globals that
// could collide with the host page's own scripts.
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/widget.ts'),
      name: 'SaasWidget',
      formats: ['iife'],
      fileName: () => 'widget.js'
    },
    outDir: 'dist',
    minify: true,
    emptyOutDir: true
  }
});
