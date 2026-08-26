/**
 * Camouflage has to be tuned per painting: the same fill and opacity that vanish into
 * Leonardo's glazed landscape sit up and wave on Hokusai's flat woodblock. Rather than
 * eyeball each one, measure the thing that actually decides whether a shape is spotted
 * -- how far it shifts the pixels underneath it -- and solve for the opacity that hits
 * a chosen contrast.
 *
 * The metric is a signal-to-noise ratio: the mean absolute luminance shift inside the
 * shape's own mask, divided by the standard deviation of the painting around it. A flat
 * shift of 24 levels is plainly visible on Leonardo's smooth glazes and completely
 * swamped by Hokusai's hard-edged waves, so an absolute shift is the wrong target --
 * what decides whether a shape is spotted is how far it rises above the local texture.
 *
 * Report mode prints the ratio for the puzzles as they stand; tune mode binary-searches
 * the opacity that lands on --target.
 *
 *   npx vite-node scripts/tune-camouflage.ts                 # report current
 *   npx vite-node scripts/tune-camouflage.ts -- --target 2   # solve for each puzzle
 */
import sharp from 'sharp';
import { PUZZLES } from '../src/game/puzzles';
import { getShape } from '../src/game/shapes';
import type { Puzzle } from '../src/game/types';

type Blend = 'soft-light' | 'multiply' | 'screen' | 'overlay' | 'hard-light';

function overlaySvg(p: Puzzle, opacity: number, w: number, h: number): Buffer {
  const def = getShape(p.target.shape);
  const t = p.target;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<g transform="translate(${t.cx} ${t.cy}) rotate(${t.angle}) scale(${t.size / 100}) translate(-50 -50)">` +
      `<path d="${def.path}" fill="${t.fill}" fill-rule="${def.fillRule ?? 'evenodd'}" ` +
      `fill-opacity="${opacity}"/></g></svg>`,
  );
}

/** Solid white shape on black: the mask of which pixels the shape actually covers. */
function maskSvg(p: Puzzle, w: number, h: number): Buffer {
  const def = getShape(p.target.shape);
  const t = p.target;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="${w}" height="${h}" fill="#000"/>` +
      `<g transform="translate(${t.cx} ${t.cy}) rotate(${t.angle}) scale(${t.size / 100}) translate(-50 -50)">` +
      `<path d="${def.path}" fill="#fff" fill-rule="${def.fillRule ?? 'evenodd'}"/></g></svg>`,
  );
}

/** A window around the shape, big enough for context but small enough to stay fast. */
function windowFor(p: Puzzle) {
  const side = Math.min(Math.round(p.target.size * 4), p.width, p.height);
  return {
    left: Math.max(0, Math.min(p.width - side, Math.round(p.target.cx - side / 2))),
    top: Math.max(0, Math.min(p.height - side, Math.round(p.target.cy - side / 2))),
    width: side,
    height: side,
  };
}

async function contrast(p: Puzzle, opacity: number): Promise<number> {
  const src = `public/puzzles/${p.id}.jpg`;
  const win = windowFor(p);

  // sharp runs extract before composite whatever order they are called in, so the
  // composite has to be finished into its own buffer before the window is cut.
  const rasterise = (svg: Buffer) =>
    sharp(svg).resize(p.width, p.height, { fit: 'fill' }).png().toBuffer();

  const base = await sharp(src).extract(win).greyscale().raw().toBuffer();

  const composed = await sharp(src)
    .composite([{ input: await rasterise(overlaySvg(p, opacity, p.width, p.height)), blend: p.target.blend as Blend }])
    .toBuffer();
  const painted = await sharp(composed).extract(win).greyscale().raw().toBuffer();

  const maskFull = await rasterise(maskSvg(p, p.width, p.height));
  const mask = await sharp(maskFull).flatten({ background: '#000' }).extract(win).greyscale().raw().toBuffer();

  let sum = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 200) {
      sum += Math.abs(painted[i] - base[i]);
      n++;
    }
  }
  const signal = n === 0 ? 0 : sum / n;

  // Texture the shape has to compete with: the spread of the painting around it.
  let total = 0;
  for (let i = 0; i < base.length; i++) total += base[i];
  const mean = total / base.length;
  let variance = 0;
  for (let i = 0; i < base.length; i++) variance += (base[i] - mean) ** 2;
  const noise = Math.sqrt(variance / base.length);

  return noise < 1 ? signal : signal / noise;
}

/** Opacity whose contrast lands closest to `target`. */
async function solve(p: Puzzle, target: number): Promise<{ opacity: number; got: number }> {
  let lo = 0.02;
  let hi = 1;
  let best = { opacity: p.target.opacity ?? 1, got: 0 };
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const got = await contrast(p, mid);
    best = { opacity: Math.round(mid * 100) / 100, got: Math.round(got * 100) / 100 };
    if (got < target) lo = mid;
    else hi = mid;
  }
  return best;
}

/**
 * Hunting for somewhere to hide a shape. Very busy regions swallow it whole -- no
 * opacity makes it findable -- and dead-flat regions leave nothing for it to sit in.
 * Report the candidate positions whose local texture is in a workable middle band.
 */
async function scan(p: Puzzle): Promise<void> {
  const src = `public/puzzles/${p.id}.jpg`;
  const side = p.target.size * 4;
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });

  const spots: Array<{ x: number; y: number; std: number; mean: number }> = [];
  const step = Math.round(side / 2);
  for (let y = side; y < info.height - side; y += step) {
    for (let x = side; x < info.width - side; x += step) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let dy = -side / 2; dy < side / 2; dy += 3) {
        for (let dx = -side / 2; dx < side / 2; dx += 3) {
          const v = data[(y + dy | 0) * info.width + (x + dx | 0)];
          sum += v;
          sumSq += v * v;
          n++;
        }
      }
      const mean = sum / n;
      spots.push({ x, y, mean, std: Math.sqrt(sumSq / n - mean * mean) });
    }
  }

  // A middle band: enough texture to hide in, little enough to be found once you look.
  const usable = spots.filter((s) => s.std >= 8 && s.std <= 20 && s.mean > 25 && s.mean < 225);
  usable.sort((a, b) => Math.abs(a.std - 13) - Math.abs(b.std - 13));
  console.log(`  ${p.id}: ${usable.length} workable spots of ${spots.length}`);
  for (const s of usable.slice(0, 4)) {
    console.log(`      cx ${s.x} cy ${s.y}   texture ${s.std.toFixed(1)}  brightness ${s.mean.toFixed(0)}`);
  }
}

if (process.argv.includes('--scan')) {
  console.log('Candidate hiding places (texture in the workable band)');
  for (const p of PUZZLES) await scan(p);
  process.exit(0);
}

const targetArg = process.argv.indexOf('--target');
const target = targetArg >= 0 ? Number(process.argv[targetArg + 1]) : null;

console.log(
  target === null
    ? 'Luminance shift under the shape, relative to local texture (higher = easier to spot)'
    : `Solving each puzzle for a signal-to-texture ratio of ${target}`,
);

for (const p of PUZZLES) {
  if (target === null) {
    const got = await contrast(p, p.target.opacity ?? 1);
    console.log(`  ${p.id.padEnd(10)} ${p.target.blend?.padEnd(11)} opacity ${String(p.target.opacity).padEnd(5)} -> ${got.toFixed(2)}`);
  } else {
    const { opacity, got } = await solve(p, target);
    console.log(`  ${p.id.padEnd(10)} ${p.target.blend?.padEnd(11)} opacity ${String(opacity).padEnd(5)} -> ${got.toFixed(2)}`);
  }
}
