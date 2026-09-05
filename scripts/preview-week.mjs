/**
 * Look at a whole week at once: seven days down the page, each shown as the player
 * meets it and again at the winning framing.
 *
 *   npm run preview:week -- mona            # one painting's week
 *   npm run preview:week -- mona out.jpg
 *
 * The ramp is a set of numbers in difficulty.ts and a set of measurements from
 * tune-camouflage. This is the third thing, and the only one that can catch a Monday
 * that reads as a sticker or a Sunday that is simply not there.
 *
 * Needs the site running: npx vite preview --port 4173
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { RAMP } from '../src/game/difficulty.ts';

const URL = process.env.FIND_ME_URL ?? 'http://localhost:4173/';
const image = process.argv[2] ?? 'mona';
const out = process.argv[3] ?? `.source-images/week-${image}.jpg`;
const SCALE = 0.62;

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

/** Ring the hidden shape, so the answer is visible without hunting for it. */
async function mark(geo) {
  await page.evaluate((g) => {
    const el = document.querySelector('.stage-target');
    const box = el.getBoundingClientRect();
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'preview-ring';
    const r = Math.max(28, box.width * 1.6);
    Object.assign(ring.style, {
      position: 'fixed',
      left: box.left + box.width / 2 - r - stage.left + 'px',
      top: box.top + box.height / 2 - r - stage.top + 'px',
      width: r * 2 + 'px',
      height: r * 2 + 'px',
      border: '2px solid #ff00ff',
      borderRadius: '50%',
      pointerEvents: 'none',
      zIndex: '99',
    });
    document.querySelector('.stage').appendChild(ring);
    return g;
  }, geo);
}

async function unmark() {
  await page.evaluate(() => document.querySelectorAll('.preview-ring').forEach((n) => n.remove()));
}

async function shoot(label) {
  const shot = await page.locator('.stage').screenshot();
  const meta = await sharp(shot).metadata();
  const w = Math.round(meta.width * SCALE);
  const h = Math.round(meta.height * SCALE);
  const caption = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect x="0" y="0" width="${w}" height="26" fill="#000" opacity="0.55"/>` +
      `<text x="8" y="19" font-size="15" fill="#ff00ff" font-family="monospace">${label}</text></svg>`,
  );
  return sharp(shot)
    .resize(w, h)
    .composite([{ input: await sharp(caption).png().toBuffer(), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

const rows = [];
let tile = null;

for (const rung of RAMP) {
  const id = `${image}-${rung.key}`;
  await page.goto(URL + '?puzzle=' + id, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stage-image');
  await page.waitForFunction(() => {
    const img = document.querySelector('.stage-image');
    return img && img.complete && img.naturalWidth > 0;
  });
  const start = await page.$('button:has-text("Start")');
  if (start) await start.click();
  await page.waitForTimeout(150);

  const geo = await page.evaluate(() => {
    const freeze = document.createElement('style');
    freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.appendChild(freeze);
    document.querySelector('.stage-viewport').classList.remove('is-blurred');
    const el = document.querySelector('.stage-target');
    const svg = el.querySelector('svg');
    const size = Number(svg.getAttribute('width'));
    return {
      cx: parseFloat(el.style.left) + size / 2,
      cy: parseFloat(el.style.top) + size / 2,
      size,
      targetPx: Number(document.querySelector('.reference-well svg').getAttribute('width')),
      angle: Number((svg.style.transform.match(/rotate\((-?[\d.]+)deg\)/) || [0, 0])[1]),
      shape: document.querySelector('.reference svg')?.dataset.shape ?? '',
    };
  });

  // As the player meets it: the whole painting, shape somewhere in it.
  const plain = await shoot(`${rung.label.toUpperCase()}  as it opens`);
  await mark(geo);
  const ringed = await shoot(`${rung.label.toUpperCase()}  where it is`);
  await unmark();

  // The winning framing.
  await page.evaluate((g) => {
    const scale = g.targetPx / g.size;
    const rot = (-g.angle * Math.PI) / 180;
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const canvas = document.querySelector('.stage-canvas');
    // With the transform goes `--stage-zoom`, or the ramp is judged on a softening the
    // player never sees at the match -- see index.css.
    const fitScale = new DOMMatrix(getComputedStyle(canvas).transform).a;
    canvas.style.transform =
      'translate(' + (stage.width / 2 - (c * g.cx * scale - s * g.cy * scale)) + 'px, ' +
      (stage.height / 2 - (s * g.cx * scale + c * g.cy * scale)) + 'px) rotate(' +
      (rot * 180) / Math.PI + 'deg) scale(' + scale + ')';
    canvas.style.setProperty('--stage-zoom', String(Math.max(1, scale / fitScale)));
  }, geo);
  await page.waitForTimeout(150);
  const matched = await shoot(`${rung.label.toUpperCase()}  solved  size ${rung.size}  ratio ${rung.ratio}`);

  const meta = await sharp(plain).metadata();
  tile = { w: meta.width, h: meta.height };
  rows.push(
    await sharp({ create: { width: tile.w * 3, height: tile.h, channels: 3, background: '#111' } })
      .composite([
        { input: plain, left: 0, top: 0 },
        { input: ringed, left: tile.w, top: 0 },
        { input: matched, left: tile.w * 2, top: 0 },
      ])
      .png()
      .toBuffer(),
  );
  console.log('captured', id);
}

await sharp({ create: { width: tile.w * 3, height: tile.h * rows.length, channels: 3, background: '#111' } })
  .composite(rows.map((input, i) => ({ input, left: 0, top: i * tile.h })))
  .jpeg({ quality: 88 })
  .toFile(out);

await browser.close();
console.log('wrote', out);
