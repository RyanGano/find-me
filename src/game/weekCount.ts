/**
 * How many weeks `puzzles.ts` holds, counted from its source rather than by importing it.
 *
 * The build writes this into `version.json` beside the bundle, so anything reading the
 * live site can tell how far ahead the calendar runs and when it will wrap back to the
 * first week -- the end of the rotation must never arrive unnoticed.
 *
 * It is counted from source because `puzzles.ts` cannot be imported into `vite.config.ts`:
 * `build.ts` reads `import.meta.env`, which only exists inside the app's own build.
 * `weekCount.test.ts` holds the count to `IMAGES`, so a change to how the seeds are laid
 * out fails the build instead of publishing the wrong number.
 */
export function countWeeks(source: string): number {
  return source.match(/^ {4}image: '/gm)?.length ?? 0;
}
