import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/last-live/',
  plugins: [react()],
  // Preserve the browser baseline used by the previous Vite 6 build.
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
});
