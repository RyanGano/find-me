/**
 * The ramp, with the time each rung is actually aiming at -- and what that time costs on
 * a calm painting against a busy one.
 *
 * `difficulty.ts` carries the rungs and `age.ts` turns a scan reading back into a hunting
 * time, and the two are read together often enough -- every time a play-test round is
 * read against what the ramp intended -- to be worth printing rather than doing in your
 * head. Derived, never a second copy: change either file and this moves.
 *
 * The two right-hand columns are the point of the exercise. A rung is a *time*, and the
 * scan reading that buys it is not the same number on every canvas: a busy painting is
 * already supplying difficulty the rung did not ask for, so the shape is allowed to be
 * bolder there. Before that was measured, both columns read the same, and the weeks came
 * out anywhere from nine times too fast to four times too slow.
 *
 *   node scripts/rungs.mjs
 */
import { RAMP, scanTarget } from '../src/game/difficulty.ts';
import { expectedSearchMs } from '../src/game/age.ts';
import { IMAGES, PUZZLES } from '../src/game/puzzles.ts';

const clutters = new Map(PUZZLES.map((p) => [p.image, p.clutter]));
const measured = IMAGES.map((i) => ({ id: i.id, clutter: clutters.get(i.id) })).filter(
  (i) => typeof i.clutter === 'number',
);
const calm = measured.reduce((a, b) => (b.clutter < a.clutter ? b : a));
const busy = measured.reduce((a, b) => (b.clutter > a.clutter ? b : a));

console.log(
  `rung  size   scan  ratio  texture  angle   asks for` +
    `   on the calmest (${calm.id})   on the busiest (${busy.id})`,
);
for (const r of RAMP) {
  const calmScan = scanTarget(r, calm.clutter);
  const busyScan = scanTarget(r, busy.clutter);
  console.log(
    `${r.key.padEnd(6)}${String(r.size).padStart(3)}` +
      `${r.scan.toFixed(3).padStart(7)}${r.ratio.toFixed(2).padStart(7)}` +
      `${String(r.texture).padStart(8)}${String(r.angle).padStart(7)}` +
      `${`${r.seconds}s`.padStart(11)}` +
      `${calmScan.toFixed(3).padStart(21)}${calmScan <= 0.3 ? '*' : ' '}` +
      `${busyScan.toFixed(3).padStart(21)}${busyScan >= 0.6 ? '*' : ' '}`,
  );
}
console.log(
  '\n* the target hit the end of the fitted range and was clamped: the day comes out' +
    '\n  easier than its rung asked for, and paint alone cannot close the gap.' +
    `\n\nAt the reference canvas the rungs read back as ` +
    RAMP.map((r) => `${Math.round(expectedSearchMs(r.scan) / 1000)}s`).join(', ') +
    '.',
);
