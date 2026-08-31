/**
 * Does the corner badge show the colour the shape actually is?
 *
 * The badge is drawn in the target's *apparent* colour -- the fill composited over the
 * paint it hides in, at its own opacity and blend mode -- because a declared fill on
 * its own says very little: Hokusai's Monday star is cream in `puzzles.ts` and arrives
 * on the canvas the colour of wet sand. `src/game/apparent.ts` works that out on a 2D
 * canvas; this checks the answer against a completely separate render of the same
 * thing -- the browser's own CSS `mix-blend-mode` over a crop cut by sharp, averaged
 * over a mask the browser rasterised -- so a mistake in the canvas maths cannot agree
 * with itself into looking correct.
 *
 * Usage: npm run build && npx vite preview --port 4173 &
 *        node scripts/diag-badge.mjs [url] [puzzle-id...]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { getShape } from '../src/game/shapes.ts';
import { RAMP } from '../src/game/difficulty.ts';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const wanted = process.argv.slice(3);

/** How far apart the two renders may sit, per channel, before it is a real difference.
 *  Nothing lines up exactly: sharp resamples the crop with a different kernel than the
 *  canvas does, so a few levels of drift is the measurement, not the code. */
const TOLERANCE = 8;

/** Sample square, in screen pixels. Large enough that the mask has real edges. */
const S = 240;

const DAY_LINE =
  /\{ shape: '([\w-]+)', cx: (\d+), cy: (\d+), size: (\d+), angle: (-?\d+), fill: '(#[0-9a-f]+)', opacity: ([\d.]+), blend: '(\w+)', blur: ([\d.]+)/g;

/** The days, read out of puzzles.ts rather than duplicated -- as the tuner does. */
function days() {
  const source = readFileSync('src/game/puzzles.ts', 'utf8');
  const weeks = /image: '(\w+)',[\s\S]*?days: \[([\s\S]*?)\n    \],/g;
  const out = [];
  for (const w of source.matchAll(weeks)) {
    let d = 0;
    for (const m of w[2].matchAll(DAY_LINE)) {
      out.push({
        id: `${w[1]}-${RAMP[d].key}`,
        image: w[1],
        shape: m[1],
        cx: +m[2],
        cy: +m[3],
        size: +m[4],
        angle: +m[5],
        fill: m[6],
        opacity: +m[7],
        blend: m[8],
      });
      d++;
    }
  }
  return out;
}

/** The shape as the page draws it, or as a white stencil of itself for the mask. */
function svg(t, painted) {
  const def = getShape(t.shape);
  const paint = painted ? `opacity:${t.opacity};mix-blend-mode:${t.blend};` : '';
  return `<svg width="${S}" height="${S}" viewBox="0 0 100 100"
      style="position:absolute;left:0;top:0;transform:rotate(${t.angle}deg);${paint}">
      <path d="${def.path}" fill="${painted ? t.fill : '#fff'}"
            fill-rule="${def.fillRule ?? 'evenodd'}"/></svg>`;
}

/** Mean colour of `png` over the shape's own footprint, from the stencil in `mask`. */
async function meanOverShape(png, mask) {
  const a = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const m = await sharp(mask).raw().toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0, j = 0; i < a.data.length; i += a.info.channels, j += m.info.channels) {
    const w = m.data[j];
    if (w < 8) continue;
    r += a.data[i] * w;
    g += a.data[i + 1] * w;
    b += a.data[i + 2] * w;
    n += w;
  }
  return [r / n, g / n, b / n];
}

const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
const square = { x: 0, y: 0, width: S, height: S };
let worst = 0;
const off = [];

for (const t of days()) {
  if (wanted.length && !wanted.includes(t.id)) continue;

  // The paint under the shape, blown up to the sample square.
  const crop = await sharp(`public/puzzles/${t.image}.jpg`)
    .extract({
      left: Math.round(t.cx - t.size / 2),
      top: Math.round(t.cy - t.size / 2),
      width: t.size,
      height: t.size,
    })
    .resize(S, S, { kernel: 'nearest' })
    .png()
    .toBuffer();

  // Black ground, so the stencil is white-on-black and the mask means something.
  const stage = `<body style="margin:0;background:#000"><div style="position:relative;width:${S}px;height:${S}px;isolation:isolate">`;
  await page.setContent(
    `${stage}<img src="data:image/png;base64,${crop.toString('base64')}">${svg(t, true)}</div></body>`,
  );
  const composited = await page.screenshot({ clip: square });

  await page.setContent(`${stage}${svg(t, false)}</div></body>`);
  const mask = await page.screenshot({ clip: square });

  const real = await meanOverShape(composited, mask);

  // What the running page actually puts in the badge.
  await page.goto(`${URL}?puzzle=${t.id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.reference-well svg path');
  const badge = await page.evaluate(
    () => getComputedStyle(document.querySelector('.reference-well svg path')).fill,
  );
  const shown = badge.match(/\d+/g).map(Number);

  const drift = Math.max(...real.map((v, i) => Math.abs(v - shown[i])));
  worst = Math.max(worst, drift);
  if (drift > TOLERANCE) off.push(t.id);
  console.log(
    `${t.id.padEnd(14)} declared ${t.fill}  badge ${hex(shown)}  really ${hex(real)}  ` +
      `drift ${drift.toFixed(0).padStart(3)}${drift > TOLERANCE ? '  <-- off' : ''}`,
  );
}

await browser.close();
console.log(`\nworst drift ${worst.toFixed(1)}, tolerance ${TOLERANCE}`);
if (off.length) {
  console.error(`badge colour is wrong on: ${off.join(', ')}`);
  process.exit(1);
}
