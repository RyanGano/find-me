/**
 * Measure and solve how well each hidden shape hides -- in the real browser.
 *
 * An earlier version of this did the compositing with sharp. It was wrong, and
 * confidently so: the browser applies element opacity and `mix-blend-mode` in a
 * different order from a sharp `composite`, so a shape sharp reported as a whisper
 * rendered on the page as a bright white snowflake. Anything that judges camouflage has
 * to look at what the page actually paints.
 *
 * The metric is signal over texture: the mean luminance shift the shape imposes,
 * divided by the standard deviation of the painting around it. A flat shift that reads
 * clearly on a smooth glaze is swallowed whole by hard-edged waves, so an absolute
 * figure is the wrong target.
 *
 *   node scripts/tune-camouflage.mjs                # report every puzzle
 *   node scripts/tune-camouflage.mjs --target 0.55  # solve opacity for each
 *   node scripts/tune-camouflage.mjs --scan         # find workable hiding places
 *
 * Needs the site running: npx vite preview --port 4173
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, readdirSync } from 'node:fs';

const URL = process.env.FIND_ME_URL ?? 'http://localhost:4173/find-me/';

/** Puzzle ids and geometry, read from the source of truth rather than duplicated. */
function puzzles() {
  const src = readFileSync('src/game/puzzles.ts', 'utf8');
  const re = /id: '(\w+)',[\s\S]*?target: \{ shape: '([\w-]+)', cx: (\d+), cy: (\d+), size: (\d+),[^}]*?opacity: ([\d.]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    out.push({ id: m[1], shape: m[2], cx: +m[3], cy: +m[4], size: +m[5], opacity: +m[6] });
  }
  return out;
}

/**
 * Snap the page to the exact winning framing and read the shape's contrast against the
 * painting, by screenshotting with the shape shown and with it hidden.
 */
/**
 * Load a puzzle and snap it to the exact winning framing. Done once per puzzle; the
 * samples below then vary only the opacity, which is both far quicker and steadier than
 * reloading between measurements.
 */
async function prepare(page, id) {
  await page.goto(URL + '?puzzle=' + id, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stage-image');
  // networkidle can fire before the painting is decoded and painted. Measuring then
  // compares two blank frames and reports a shape with no footprint at all, which the
  // solver reads as "infinitely subtle" and happily believes.
  await page.waitForFunction(() => {
    const img = document.querySelector('.stage-image');
    return img && img.complete && img.naturalWidth > 0;
  });
  const start = await page.$('button:has-text("Start")');
  if (start) await start.click();
  await page.waitForTimeout(150);

  return page.evaluate(() => {
    // Freeze every transition and animation. The blur lifting over 0.35s, or the badge
    // easing its outline in, means two frames taken 80ms apart differ across the whole
    // stage -- which swamps the shape's own footprint and makes every reading garbage.
    const freeze = document.createElement('style');
    freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.appendChild(freeze);

    document.querySelector('.stage-viewport').classList.remove('is-blurred');
    const targetEl = document.querySelector('.stage-target');
    const svg = targetEl.querySelector('svg');
    const size = Number(svg.getAttribute('width'));
    const cx = parseFloat(targetEl.style.left) + size / 2;
    const cy = parseFloat(targetEl.style.top) + size / 2;
    const targetPx = Number(document.querySelector('.reference-well svg').getAttribute('width'));
    const angle = Number((svg.style.transform.match(/rotate\((-?[\d.]+)deg\)/) || [0, 0])[1]);
    const scale = targetPx / size;
    const rot = (-angle * Math.PI) / 180;
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const x = stage.width / 2 - (c * cx * scale - s * cy * scale);
    const y = stage.height / 2 - (s * cx * scale + c * cy * scale);
    const canvas = document.querySelector('.stage-canvas');
    const fitted = getComputedStyle(canvas).transform;
    canvas.style.transform =
      'translate(' + x + 'px, ' + y + 'px) rotate(' + (rot * 180) / Math.PI + 'deg) scale(' + scale + ')';
    return {
      targetPx,
      cx,
      cy,
      size,
      angle,
      fitted,
      declared: Number(svg.style.opacity || getComputedStyle(svg).opacity),
    };
  });
}

/**
 * The two views pull against each other, so both get measured.
 *
 * At the match the shape is always exactly `targetPx` on screen, because the winning
 * scale is `targetPx / size` -- so its findability there depends on contrast alone, and
 * not at all on `size`. At the fitted view the shape is `size * fitScale` across, which
 * does shrink with `size`. That asymmetry is the whole lever: shrinking a shape makes it
 * harder to scan for without making it any harder to see once you are on it.
 */
async function frame(page, mode, geo) {
  await page.evaluate(([m, g]) => {
    const canvas = document.querySelector('.stage-canvas');
    if (m === 'fitted') {
      canvas.style.transform = g.fitted;
      return;
    }
    const scale = g.targetPx / g.size;
    const rot = (-g.angle * Math.PI) / 180;
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const x = stage.width / 2 - (c * g.cx * scale - s * g.cy * scale);
    const y = stage.height / 2 - (s * g.cx * scale + c * g.cy * scale);
    canvas.style.transform =
      'translate(' + x + 'px, ' + y + 'px) rotate(' + (rot * 180) / Math.PI + 'deg) scale(' + scale + ')';
  }, [mode, geo]);
  await page.waitForTimeout(80);
}

/** Contrast of the shape against the painting at a given opacity, on real pixels. */
async function sample(page, opacity, targetPx, maskArea) {
  await page.evaluate((op) => {
    const el = document.querySelector('.stage-target');
    el.style.display = '';
    if (op !== null) el.querySelector('svg').style.opacity = String(op);
  }, opacity === undefined ? null : opacity);
  await page.waitForTimeout(80);
  const withShape = await page.locator('.stage').screenshot();

  await page.evaluate(() => {
    document.querySelector('.stage-target').style.display = 'none';
  });
  await page.waitForTimeout(80);
  const without = await page.locator('.stage').screenshot();

  const a = await sharp(withShape).greyscale().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(without).greyscale().raw().toBuffer();
  const width = a.info.width;
  const height = a.info.height;

  // Signal: the shift the shape imposes, averaged over the area it covers.
  //
  // Averaging over only the pixels that changed looks equivalent and is not: as opacity
  // falls, fewer pixels clear the detection threshold, but the ones that do still differ
  // by at least that threshold, so the mean bottoms out instead of decaying to zero and
  // the search happily returns an invisible shape as a good match. Divide by the area
  // the shape actually covers, measured once at full opacity.
  let sum = 0;
  let changed = 0;
  let peak = 0;
  for (let i = 0; i < b.length; i++) {
    const d = Math.abs(a.data[i] - b[i]);
    sum += d;
    if (d > 1) changed++;
    if (d > peak) peak = d;
  }
  const signal = sum / (maskArea || changed || 1);

  // Texture it competes with: the painting in a window several shape-widths across.
  const half = Math.min(Math.round(targetPx * 2), Math.floor(Math.min(width, height) / 2));
  const cxp = Math.floor(width / 2);
  const cyp = Math.floor(height / 2);
  let t = 0;
  let t2 = 0;
  let m = 0;
  for (let y = cyp - half; y < cyp + half; y++) {
    for (let x = cxp - half; x < cxp + half; x++) {
      const v = b[y * width + x];
      t += v;
      t2 += v * v;
      m++;
    }
  }
  const mean = t / m;
  const noise = Math.sqrt(Math.max(0, t2 / m - mean * mean));
  // At the fitted view the shape is only a few pixels across, so an average over its
  // footprint says little. What gives it away there is a single bright speck, which is
  // what the peak captures.
  return { ratio: noise < 1 ? signal : signal / noise, changed, peak };
}

/**
 * Where can a shape hide at all? Very busy regions swallow it whole; dead-flat ones
 * leave nothing for it to sit in.
 */
async function scan(p) {
  const file = readdirSync('public/puzzles').find((f) => f.startsWith(p.id + '.'));
  const raw = await sharp('public/puzzles/' + file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const data = raw.data;
  const info = raw.info;
  const side = p.size * 4;
  const spots = [];
  for (let y = side; y < info.height - side; y += side / 2) {
    for (let x = side; x < info.width - side; x += side / 2) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let dy = -side / 2; dy < side / 2; dy += 3) {
        for (let dx = -side / 2; dx < side / 2; dx += 3) {
          const v = data[((y + dy) | 0) * info.width + ((x + dx) | 0)];
          sum += v;
          sumSq += v * v;
          n++;
        }
      }
      const mean = sum / n;
      spots.push({ x: x | 0, y: y | 0, mean, std: Math.sqrt(sumSq / n - mean * mean) });
    }
  }
  const usable = spots.filter((s) => s.std >= 8 && s.std <= 20 && s.mean > 25 && s.mean < 225);
  usable.sort((a, b) => Math.abs(a.std - 13) - Math.abs(b.std - 13));
  console.log('  ' + p.id + ': ' + usable.length + ' workable spots of ' + spots.length);
  for (const s of usable.slice(0, 3)) {
    console.log('      cx ' + s.x + ' cy ' + s.y + '   texture ' + s.std.toFixed(1) + '  brightness ' + s.mean.toFixed(0));
  }
}

const list = puzzles();

if (process.argv.includes('--scan')) {
  console.log('Candidate hiding places (texture in the workable band)');
  for (const p of list) await scan(p);
  process.exit(0);
}

const ti = process.argv.indexOf('--target');
const target = ti >= 0 ? Number(process.argv[ti + 1]) : null;

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

console.log(
  target === null
    ? 'Luminance shift under the shape, relative to local texture (higher = easier to spot)'
    : 'Solving each puzzle for a signal-to-texture ratio of ' + target,
);

for (const p of list) {
  const info = await prepare(page, p.id);
  // The shape's footprint, measured once with it turned fully up.
  const full = await sample(page, 1, info.targetPx, 0);
  const area = full.changed;

  if (target === null) {
    const got = await sample(page, p.opacity, info.targetPx, area);
    await frame(page, 'fitted', info);
    const scanned = await sample(page, p.opacity, info.targetPx, area);
    await frame(page, 'matched', info);
    console.log(
      '  ' + p.id.padEnd(10) + ' size ' + String(p.size).padEnd(4) + ' opacity ' + String(p.opacity).padEnd(6) +
      ' found ' + got.ratio.toFixed(2).padEnd(6) + ' scannable ' + scanned.peak.toFixed(0),
    );
  } else {
    let lo = 0.005;
    let hi = 1;
    let best = { opacity: p.opacity, got: 0 };
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const got = await sample(page, mid, info.targetPx, area);
      best = { opacity: Math.round(mid * 1000) / 1000, got: got.ratio };
      if (got.ratio < target) lo = mid;
      else hi = mid;
    }
    console.log('  ' + p.id.padEnd(10) + ' opacity ' + String(best.opacity).padEnd(5) + ' -> ' + best.got.toFixed(3));
  }
}

await browser.close();
