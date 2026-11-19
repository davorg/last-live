import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveLastFmConfig } from './src/api/config.js';

const sharedConfig = {
  base: '/last-live/',
  plugins: [react()],
  // Publish only the effective configuration below. A leftover direct API key
  // must not enter a proxy build or the development client's environment.
  envPrefix: [],
  // Preserve the browser baseline used by the previous Vite 6 build.
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
};

export default defineConfig(({ mode, isPreview }) => {
  // Preview serves an already configured bundle; it needs no build credentials.
  if (isPreview) return sharedConfig;
  const env = loadEnv(mode, process.cwd(), 'VITE_LASTFM_');
  const config = resolveLastFmConfig({
    apiURL: env.VITE_LASTFM_API_URL,
    apiKey: env.VITE_LASTFM_API_KEY,
  });
  return {
    ...sharedConfig,
    define: {
      'import.meta.env.VITE_LASTFM_API_URL': JSON.stringify(config.endpoint),
      'import.meta.env.VITE_LASTFM_API_KEY': JSON.stringify(config.apiKey),
    },
  };
});
