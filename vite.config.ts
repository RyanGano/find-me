import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { countWeeks } from './src/game/weekCount.ts';

/**
 * Stamped into the bundle and written to `version.json` beside it. The running page
 * compares the two to notice that a newer build has been deployed underneath it.
 */
const buildId = new Date().toISOString();

/**
 * `version.json` also says how many weeks this build's calendar holds, so the deployed
 * site itself answers "how long until the rotation wraps back to the first week" -- a
 * painting committed but not yet deployed does not count. See `weekCount.ts`.
 */
function buildVersion(): Plugin {
  return {
    name: 'find-me:build-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: buildId, weeks: countWeeks(readFileSync('src/game/puzzles.ts', 'utf8')) }),
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
