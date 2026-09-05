/**
 * The ramp, with the time each rung is actually aiming at.
 *
 * `difficulty.ts` carries `scan` targets and `age.ts` turns a scan reading into a
 * hunting time, and the two are read together often enough -- every time a play-test
 * round is read against what the ramp intended -- to be worth printing rather than
 * doing in your head. Derived, never a second copy: change either file and this moves.
 *
 *   node scripts/rungs.mjs
 */
import { RAMP } from '../src/game/difficulty.ts';
import { expectedSearchMs } from '../src/game/age.ts';

console.log('rung  size  scan   ratio  texture  angle   intended search');
for (const r of RAMP) {
  console.log(
    `${r.key.padEnd(6)}${String(r.size).padStart(3)}` +
      `${r.scan.toFixed(3).padStart(7)}${r.ratio.toFixed(2).padStart(7)}` +
      `${String(r.texture).padStart(8)}${String(r.angle).padStart(7)}` +
      `${`${Math.round(expectedSearchMs(r.scan) / 1000)}s`.padStart(17)}`,
  );
}
