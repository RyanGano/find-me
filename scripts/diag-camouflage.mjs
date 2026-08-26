/**
 * Look at what the player actually sees.
 *
 * Everything else in this repo judges camouflage from a sharp-composited preview, which
 * is a guess at two things it cannot know: how the browser implements `mix-blend-mode`,
 * and how big the shape really is on screen at the moment of the match. This drives the
 * real page in a real browser, snaps it to the exact winning transform, and screenshots
 * the stage. That is the only picture that counts.
 *
 *   node scripts/diag-camouflage.mjs <puzzleId> '[{"fill":"#888","opacity":0.2}]' out.png
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const URL = process.env.FIND_ME_URL ?? 'http://localhost:4173/find-me/';
const id = process.argv[2] ?? 'mona';
const variants = JSON.parse(process.argv[3] ?? '[{}]');
const out = process.argv[4] ?? '.source-images/real.png';

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

const tiles = [];
let tileSize = { w: 900, h: 700 };

for (const v of variants) {
  await page.goto(`${URL}?puzzle=${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stage-image');
  const start = await page.$('button:has-text("Start")');
  if (start) await start.click();

  const label = await page.evaluate((variant) => {
    // Lift the pre-start blur without touching the transform.
    document.querySelector('.stage-viewport')?.classList.remove('is-blurred');

    const targetEl = document.querySelector('.stage-target');
    const svg = targetEl.querySelector('svg');
    const path = svg.querySelector('path');
    if (variant.fill) path.setAttribute('fill', variant.fill);
    if (variant.opacity !== undefined) svg.style.opacity = String(variant.opacity);
    if (variant.blend) svg.style.mixBlendMode = variant.blend;
    // A razor-sharp vector edge on a painting shown above its native resolution is a
    // giveaway on its own. Softening the shape to match costs nothing at the fitted
    // view and removes the "pasted on" tell at the match.
    if (variant.blur) svg.style.filter = `blur(${variant.blur}px)`;

    const size = Number(svg.getAttribute('width'));
    const cx = parseFloat(targetEl.style.left) + size / 2;
    const cy = parseFloat(targetEl.style.top) + size / 2;
    const ref = document.querySelector('.reference-well svg');
    const targetPx = Number(ref.getAttribute('width'));

    // The exact winning framing: matched scale, matched angle, shape dead centre.
    const angle = Number((svg.style.transform.match(/rotate\((-?[\d.]+)deg\)/) ?? [0, 0])[1]);
    const scale = targetPx / size;
    const rot = (-angle * Math.PI) / 180;
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const x = stage.width / 2 - (c * cx * scale - s * cy * scale);
    const y = stage.height / 2 - (s * cx * scale + c * cy * scale);

    // React will not re-render without a gesture, so writing the style directly holds.
    const canvas = document.querySelector('.stage-canvas');
    canvas.style.transform =
      `translate(${x}px, ${y}px) rotate(${(rot * 180) / Math.PI}deg) scale(${scale})`;

    return `${variant.fill ?? 'as-is'} op ${variant.opacity ?? '-'} ${variant.blend ?? ''}${variant.blur ? ' blur' + variant.blur : ''}`;
  }, v);

  await page.waitForTimeout(200);
  const shot = await page.locator('.stage').screenshot();
  const dim = await sharp(shot).metadata();
  const capt = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim.width}" height="${dim.height}">` +
      `<text x="10" y="24" font-size="18" fill="#ff00ff" font-family="monospace">${label}</text></svg>`,
  );
  const overlay = await sharp(capt).resize(dim.width, dim.height, { fit: 'fill' }).png().toBuffer();
  tiles.push(await sharp(shot).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer());
  tileSize = { w: dim.width, h: dim.height };
  console.log('captured', label);
}

const cols = Math.min(2, tiles.length);
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: tileSize.w * cols, height: tileSize.h * rows, channels: 3, background: '#111' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * tileSize.w, top: Math.floor(i / cols) * tileSize.h })))
  .jpeg({ quality: 92 })
  .toFile(out);

await browser.close();
console.log('wrote', out);
