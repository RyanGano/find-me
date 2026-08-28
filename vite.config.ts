import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Stamped into the bundle and written to `version.json` beside it. The running page
 * compares the two to notice that a newer build has been deployed underneath it.
 */
const buildId = new Date().toISOString();

function buildVersion(): Plugin {
  return {
    name: 'find-me:build-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: buildId }),
      });
    },
  };
}

// Served from https://findme.ryangano.com/, so assets are rooted at /.
export default defineConfig({
  base: '/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), buildVersion()],
});
