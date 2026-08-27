/**
 * Can a painting hold a whole week?
 *
 *   npx vite-node scripts/rate-painting.mjs public/puzzles/*.jpg .source-images/gypsy.jpg
 *
 * The ramp needs a painting to offer somewhere quiet for Monday and somewhere chaotic for
 * Sunday, and the failure it is guarding against is real: Bosch's Garden of Earthly
 * Delights has no quiet paint anywhere on it, so its Monday could not be made easy at any
 * fill or opacity, and every day of that week sat up and waved at anyone scanning the
 * whole canvas. A painting that cannot span the ramp should be replaced, not tuned
 * around.
 *
 * Two ends have to work, and a painting can fail either. Bosch had no quiet paint at all,
 * so its Monday could not be made easy at any fill or opacity. Turner is the opposite and
 * was caught later: a median texture of 8.2 means there is nothing anywhere for a shape to
 * hide *in*, so every day of that week had to be raised back up to stay visible once
 * framed, and none of them could be made hard. A canvas needs both a quiet corner and
 * somewhere busy.
 *
 * Reported as the texture the flattest, typical and busiest usable spots offer, at the
 * same window the planner surveys with, and a verdict against what each end wants.
 */
import sharp from 'sharp';
import { RAMP } from '../src/game/difficulty.ts';

const files = process.argv.slice(2);
const EASIEST = RAMP[0];
const HARDEST = RAMP[RAMP.length - 1];

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))];
}

console.log(
  'texture available, at the planner\'s window  (Monday wants ~' + EASIEST.texture +
    ', Sunday wants ~' + HARDEST.texture + ')\n',
);

for (const file of files) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const margin = EASIEST.size * 3;
  const side = 200;
  const stds = [];
  for (let y = margin; y < info.height - margin; y += 32) {
    for (let x = margin; x < info.width - margin; x += 32) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let dy = -side / 2; dy < side / 2; dy += 3) {
        for (let dx = -side / 2; dx < side / 2; dx += 3) {
          const v = data[(y + dy) * info.width + (x + dx)];
          sum += v;
          sumSq += v * v;
          n++;
        }
      }
      const mean = sum / n;
      if (mean < 28 || mean > 228) continue;
      stds.push(Math.sqrt(Math.max(0, sumSq / n - mean * mean)));
    }
  }
  stds.sort((a, b) => a - b);
  // The quietest and busiest spots a week would actually be given, rather than the
  // extremes, which are usually one freak patch of canvas.
  const quiet = quantile(stds, 0.02);
  const busy = quantile(stds, 0.98);
  const median = quantile(stds, 0.5);
  // How long a scanner has to work on this canvas before the odd one out turns up:
  // how much ground there is to cover, and how much of it looks like something.
  //
  // Both are needed. Contrast is already measured relative to the paint immediately
  // around the shape, so what is left over is the size of the search and the number of
  // things in it worth a second look. Rousseau is small and largely smooth, and a shape
  // there is found in seconds at a contrast that takes minutes on the Mona Lisa.
  const search = Math.sqrt((info.width * info.height) / (2600 * 1841)) * Math.sqrt(median / 24.6);
  const name = file.split(/[\\/]/).pop().replace(/\.\w+$/, '');
  // Calibrated against the eight paintings that were already tuned, rather than guessed.
  // Bosch failed with a quietest of 29.9; Bruegel's Proverbs is the busiest painting that
  // solved cleanly, at 18.5. The bar sits between them, and the browser tuner remains the
  // authority -- this is a filter for candidates, not a verdict on a tuned week.
  const verdict =
    quiet > 25
      ? 'NO QUIET PAINT -- Monday cannot be made easy here'
      : median < 15
        ? 'TOO SMOOTH -- the hard end of the week cannot hide here'
        : busy < HARDEST.texture
          ? 'NOTHING BUSY -- Sunday has nowhere to hide'
          : quiet > 20
            ? 'tight -- workable, but Monday will not be very easy'
            : 'ok';
  console.log(
    `  ${name.padEnd(12)} ${String(info.width).padStart(5)}x${String(info.height).padEnd(5)}` +
      `  quietest ${quiet.toFixed(1).padStart(5)}  busiest ${busy.toFixed(1).padStart(5)}` +
      `  median ${median.toFixed(1).padStart(5)}  search ${search.toFixed(2).padStart(5)}   ${verdict}`,
  );
}
