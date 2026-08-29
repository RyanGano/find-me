/// <reference types="vite/client" />

/** Build stamp baked in by `vite.config.ts`; matched against `version.json`. */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  /**
   * Where the daily tally is posted, baked in by the deploy workflow. Absent in dev and
   * in forks, which leaves the counting a no-op. See `src/game/count.ts`.
   */
  readonly VITE_COUNT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
