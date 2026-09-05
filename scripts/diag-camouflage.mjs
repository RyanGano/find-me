/**
 * Look at what the player actually sees, at both views that matter.
 *
 * Everything else that judged camouflage in this repo did the compositing with sharp,
 * and was confidently wrong: the browser applies element opacity and `mix-blend-mode` in
 * a different order, so a shape sharp called a whisper rendered as a bright white
 * snowflake. Anything judging camouflage has to look at what the page actually paints.
 *
 * Each variant is captured twice, because the shape has two jobs that pull against each
 * other:
 *   fitted  -- the whole painting on screen. A scanner must NOT be able to pick it out.
 *   matched -- the winning framing. A searcher who is on it MUST be able to see it.
 * Size is the lever for the first, opacity for the second.
 *
 *   node scripts/diag-camouflage.mjs mona '[{"size":40,"opacity":0.4}]' out.jpg
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const URL = process.env.FIND_ME_URL ?? 'http://localhost:4173/';
const id = process.argv[2] ?? 'mona';
const variants = JSON.parse(process.argv[3] ?? '[{}]');
const out = process.argv[4] ?? '.scratch/real.jpg';

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });

const rows = [];
let tile = { w: 900, h: 700 };

/** Apply a variant's overrides and return the geometry needed to frame the match. */
async function applyVariant(v) {
  return page.evaluate((variant) => {
    const freeze = document.createElement('style');
    freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.appendChild(freeze);
    document.querySelector('.stage-viewport').classList.remove('is-blurred');

    const targetEl = document.querySelector('.stage-target');
    const svg = targetEl.querySelector('svg');
    const path = svg.querySelector('path');

    // Recover the centre before touching the size, then re-place around it.
    const oldSize = Number(svg.getAttribute('width'));
    const cx = parseFloat(targetEl.style.left) + oldSize / 2;
    const cy = parseFloat(targetEl.style.top) + oldSize / 2;

    const size = variant.size === undefined ? oldSize : variant.size;
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    targetEl.style.left = cx - size / 2 + 'px';
    targetEl.style.top = cy - size / 2 + 'px';

    if (variant.fill) path.setAttribute('fill', variant.fill);
    if (variant.opacity !== undefined) svg.style.opacity = String(variant.opacity);
    if (variant.blend) svg.style.mixBlendMode = variant.blend;
    if (variant.blur !== undefined) svg.style.filter = 'blur(' + variant.blur + 'px)';

    const targetPx = Number(document.querySelector('.reference-well svg').getAttribute('width'));
    const angle = Number((svg.style.transform.match(/rotate\((-?[\d.]+)deg\)/) || [0, 0])[1]);
    return { cx, cy, size, targetPx, angle };
  }, v);
}

async function shoot(label) {
  const shot = await page.locator('.stage').screenshot();
  const dim = await sharp(shot).metadata();
  tile = { w: dim.width, h: dim.height };
  const capt = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim.width + '" height="' + dim.height + '">' +
      '<text x="10" y="24" font-size="17" fill="#ff00ff" font-family="monospace">' + label + '</text></svg>',
  );
  const overlay = await sharp(capt).resize(dim.width, dim.height, { fit: 'fill' }).png().toBuffer();
  return sharp(shot).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
}

for (const v of variants) {
  const label =
    'size ' + (v.size === undefined ? '-' : v.size) + '  op ' + (v.opacity === undefined ? '-' : v.opacity) +
    (v.blur === undefined ? '' : '  blur ' + v.blur) + (v.fill ? '  ' + v.fill : '');

  await page.goto(URL + '?puzzle=' + id, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stage-image');
  await page.waitForFunction(() => {
    const img = document.querySelector('.stage-image');
    return img && img.complete && img.naturalWidth > 0;
  });
  const start = await page.$('button:has-text("Start")');
  if (start) await start.click();
  await page.waitForTimeout(150);

  const g = await applyVariant(v);

  // Fitted: the app's own starting transform, untouched.
  const fitted = await shoot(label + '  [fitted -- can it be scanned?]');

  // Matched: the exact winning framing, shape dead centre.
  await page.evaluate((geo) => {
    const scale = geo.targetPx / geo.size;
    const rot = (-geo.angle * Math.PI) / 180;
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const x = stage.width / 2 - (c * geo.cx * scale - s * geo.cy * scale);
    const y = stage.height / 2 - (s * geo.cx * scale + c * geo.cy * scale);
    const canvas = document.querySelector('.stage-canvas');
    // Set `--stage-zoom` with the transform, or the shape is drawn with the fitted
    // view's edge softening at the match -- see index.css.
    const fitScale = new DOMMatrix(getComputedStyle(canvas).transform).a;
    canvas.style.transform =
      'translate(' + x + 'px, ' + y + 'px) rotate(' + (rot * 180) / Math.PI + 'deg) scale(' + scale + ')';
    canvas.style.setProperty('--stage-zoom', String(Math.max(1, scale / fitScale)));
  }, g);
  await page.waitForTimeout(150);
  const matched = await shoot(label + '  [matched -- can it be found?]');

  rows.push(
    await sharp({ create: { width: tile.w * 2, height: tile.h, channels: 3, background: '#111' } })
      .composite([{ input: fitted, left: 0, top: 0 }, { input: matched, left: tile.w, top: 0 }])
      .png()
      .toBuffer(),
  );
  console.log('captured', label);
}

mkdirSync(dirname(out), { recursive: true });
await sharp({ create: { width: tile.w * 2, height: tile.h * rows.length, channels: 3, background: '#111' } })
  .composite(rows.map((input, i) => ({ input, left: 0, top: i * tile.h })))
  .jpeg({ quality: 92 })
  .toFile(out);

await browser.close();
console.log('wrote', out);
