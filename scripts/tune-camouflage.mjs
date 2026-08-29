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
 * figure is the wrong target. Each day of the week wants a different one -- see
 * src/game/difficulty.ts -- and this is what makes those numbers real.
 *
 *   npm run camouflage                  # report every day against its rung
 *   npm run camouflage -- --solve       # solve each day and write puzzles.ts
 *   npm run camouflage -- --solve mona  # just one week
 *
 * Needs the site running: npx vite preview --port 4173
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { RAMP } from '../src/game/difficulty.ts';
import { paintFor } from './lib/paint.mjs';

const URL = process.env.FIND_ME_URL ?? 'http://localhost:4173/';
const FILE = 'src/game/puzzles.ts';
const args = process.argv.slice(2);
const solve = args.includes('--solve');
const only = args.filter((a) => !a.startsWith('-'));

/** One line per day in puzzles.ts, read from the source of truth rather than duplicated. */
const DAY_LINE =
  /\{ shape: '([\w-]+)', cx: (\d+), cy: (\d+), size: (\d+), angle: (-?\d+), fill: '(#[0-9a-f]+)', opacity: ([\d.]+), blend: '(\w+)', blur: ([\d.]+), ratio: ([\d.]+), scan: ([\d.]+) \},/g;

function puzzles(source) {
  const out = [];
  const weeks = /image: '(\w+)',[\s\S]*?days: \[([\s\S]*?)\n    \],/g;
  let w;
  while ((w = weeks.exec(source))) {
    const image = w[1];
    const body = w[2];
    let d = 0;
    for (const m of body.matchAll(DAY_LINE)) {
      out.push({
        image,
        day: d,
        id: `${image}-${RAMP[d].key}`,
        line: m[0],
        shape: m[1],
        cx: +m[2],
        cy: +m[3],
        size: +m[4],
        angle: +m[5],
        fill: m[6],
        opacity: +m[7],
        blend: m[8],
        blur: +m[9],
        ratio: +m[10],
        scan: +m[11],
      });
      d++;
    }
  }
  return out;
}

/**
 * Load a puzzle and snap it to the exact winning framing. Done once per puzzle; the
 * samples below then vary only the paint, which is both far quicker and steadier than
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
    return { targetPx, cx, cy, size, angle, fitted };
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

/**
 * Contrast of the shape against the painting for a given paint, on real pixels.
 *
 * `onShape` picks which paint the signal is divided by. At the matched framing the shape
 * sits dead centre, so the window is taken there and sized from `targetPx` -- that is the
 * definition every tuned day in the file was solved against and it must not drift. At the
 * fitted view the shape is somewhere off in the canvas, and a window at the stage centre
 * measures a completely unrelated patch, so there the window follows the shape.
 */
async function sample(page, paint, targetPx, maskArea, onShape = false) {
  // Where the shape actually is on the stage, so the comparison can be confined to it.
  //
  // Comparing whole frames was giving nonsense at the fitted view: any pixel anywhere
  // that re-rasterised between the two screenshots counted, so the peak reported the
  // noisiest thing on the page rather than the shape, and a shape hidden behind the
  // corner badge reported a peak of 1 and read as a superb hiding place.
  const box = await page.evaluate((p) => {
    const el = document.querySelector('.stage-target');
    el.style.display = '';
    const svg = el.querySelector('svg');
    if (p) {
      if (p.opacity !== undefined) svg.style.opacity = String(p.opacity);
      if (p.fill) svg.querySelector('path').setAttribute('fill', p.fill);
    }
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = 6;
    return {
      x: Math.round(r.left - stage.left - pad),
      y: Math.round(r.top - stage.top - pad),
      w: Math.round(r.width + pad * 2),
      h: Math.round(r.height + pad * 2),
    };
  }, paint ?? null);
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
  // the shape actually covers, measured once at full strength.
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(width, box.x + box.w);
  const y1 = Math.min(height, box.y + box.h);
  let sum = 0;
  let changed = 0;
  let peak = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      const d = Math.abs(a.data[i] - b[i]);
      sum += d;
      if (d > 1) changed++;
      if (d > peak) peak = d;
    }
  }
  const signal = sum / (maskArea || changed || 1);

  // Texture it competes with: the painting in a window several shape-widths across.
  const cxp = onShape ? Math.min(width - 1, Math.max(0, Math.round(box.x + box.w / 2))) : Math.floor(width / 2);
  const cyp = onShape ? Math.min(height - 1, Math.max(0, Math.round(box.y + box.h / 2))) : Math.floor(height / 2);
  const half = onShape
    ? Math.max(20, Math.min(Math.round(Math.max(box.w, box.h) * 2.5), Math.floor(Math.min(width, height) / 2)))
    : Math.min(Math.round(targetPx * 2), Math.floor(Math.min(width, height) / 2));
  let t = 0;
  let t2 = 0;
  let m = 0;
  for (let y = Math.max(0, cyp - half); y < Math.min(height, cyp + half); y++) {
    for (let x = Math.max(0, cxp - half); x < Math.min(width, cxp + half); x++) {
      const v = b[y * width + x];
      t += v;
      t2 += v * v;
      m++;
    }
  }
  const mean = t / m;
  // Never divide by less than a few grey levels.
  //
  // On a stretch of Turner's sky the local texture at the matched zoom is very nearly
  // zero, and the ratio then reports a shape one grey level off the paint as blazing --
  // it solved a Monday to 5.7 with a fill nobody could see, because the arithmetic said
  // signal 1 over noise 0.2. Below this floor there is no texture to hide in and the
  // measurement becomes an absolute contrast, which on flat paint is the right question.
  const noise = Math.max(3, Math.sqrt(Math.max(0, t2 / m - mean * mean)));
  return { ratio: signal / noise, changed, peak };
}

/**
 * How hard the search may push.
 *
 * A normal day spends opacity first and then colour, up to 2. Monday has no opacity to
 * spend and stops at 1, deliberately short of the extremes: a pure white shape on a
 * Bosch is not an easy puzzle, it is a sticker on a painting. Where Monday cannot reach
 * its rung within that, the week is compressed to fit rather than the shape being shoved
 * until it does.
 */
const MAX_STRENGTH = 2;
const MAX_OPAQUE_STRENGTH = 1;

/** Below this a shape cannot be seen even when correctly framed, which is not a puzzle. */
const FRAMED_FLOOR = 0.95;

/**
 * Above this it is a beacon rather than a hidden shape, whatever the scan reading says.
 *
 * The scan reading divides by the paint in a window a few shape-widths across, and at the
 * fitted view on a large canvas that window is a few hundred image pixels -- wide enough,
 * on the Mona Lisa, to take in her shoulder and her hair. A bright cream shape on the
 * smooth wall behind her therefore measured as perfectly average and read as a beacon: it
 * solved to full opacity with the fill pushed towards white, at a contrast of 9.8 when a
 * normal day sits between 1 and 5.
 *
 * Dimming such a day also makes it harder, so the trade runs the right way: it comes out
 * quieter than the clock asked for, which is the direction a too-easy day wants to move.
 */
const FRAMED_CEILING = 5;

/**
 * The paint for a given strength, from nothing to as far as colour goes.
 *
 * Below 1 the knob is opacity, which is the obvious one. Above it opacity is already
 * spent and the fill moves further from the paint instead, which is what rescues a day
 * on a painting so busy that a fully opaque shape still cannot reach its rung.
 *
 * Monday skips the first half entirely: its whole point is a shape with no transparency
 * at all, hiding on size and colour alone, so it dials the fill from the very start.
 */
function paintAt(p, strength, image) {
  const opaque = RAMP[p.day].opaque;
  const push = opaque ? strength : Math.max(1, strength);
  const opacity = opaque ? 1 : Math.min(1, Math.round(strength * 1000) / 1000);
  if (!opaque && strength <= 1) return { opacity, fill: p.fill };
  return { opacity, fill: paintFor(image.data, image.info, p.cx, p.cy, p.size, push).fill };
}

const source = readFileSync(FILE, 'utf8');
const list = puzzles(source).filter((p) => !only.length || only.includes(p.image));
if (!list.length) throw new Error('no puzzles matched');

/**
 * How long a scanner has to work on this canvas before the odd one out turns up: how much
 * ground there is to cover, and how much of it looks like something. Same formula as
 * `npm run rate`, and the reason a scan reading on one painting can be compared with a
 * scan reading on another.
 */
async function searchCost(id) {
  const { data, info } = await sharp(`public/puzzles/${id}.jpg`).greyscale().raw().toBuffer({ resolveWithObject: true });
  const margin = 200;
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
  const median = stds[Math.round((stds.length - 1) * 0.5)] || 1;
  return Math.sqrt((info.width * info.height) / (2600 * 1841)) * Math.sqrt(median / 24.6);
}

/** Raw pixels per painting, loaded once each and reused across its seven days. */
const images = new Map();
async function imageFor(id) {
  if (!images.has(id)) images.set(id, await sharp(`public/puzzles/${id}.jpg`).raw().toBuffer({ resolveWithObject: true }));
  return images.get(id);
}

const costs = new Map();
for (const id of new Set(list.map((p) => p.image))) costs.set(id, await searchCost(id));

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

console.log(
  solve
    ? 'Solving every day for the time-to-find its rung asks for'
    : 'How the shape reads: scan is time-to-find, found is contrast once framed',
);

let out = source;
let week = '';
for (const p of list) {
  const rung = RAMP[p.day];
  const image = await imageFor(p.image);
  const ceilingFor = rung.opaque ? MAX_OPAQUE_STRENGTH : MAX_STRENGTH;
  const geo = await prepare(page, p.id);
  // The shape's footprint, measured once with it turned fully up.
  const full = await sample(page, paintAt(p, ceilingFor, image), geo.targetPx, 0);
  const area = full.changed;

  if (p.image !== week) {
    week = p.image;
    console.log('  ' + week);
  }
  // What this day is being solved for: a time-to-find, expressed as a scan reading and
  // scaled by how much work this particular canvas is to search.
  const want = rung.scan * costs.get(p.image);

  let paint = { opacity: p.opacity, fill: p.fill };

  // Solve at the fitted view, because that is where the thing being solved for lives.
  await frame(page, 'fitted', geo);
  // The shape's footprint has to be measured here too. It is a fraction of what it covers
  // at the match -- the whole point of the fitted view -- so reusing the matched area
  // divides by a number tens of times too large and reports every day as invisible.
  const fittedArea = (await sample(page, paintAt(p, ceilingFor, image), geo.targetPx, 0, true)).changed;
  let scanned;
  let strength = 0;
  if (solve) {
    let lo = 0.004;
    let hi = ceilingFor;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      paint = paintAt(p, mid, image);
      scanned = await sample(page, paint, geo.targetPx, fittedArea, true);
      if (scanned.ratio < want) lo = mid;
      else hi = mid;
    }
    strength = (lo + hi) / 2;
  } else {
    scanned = await sample(page, paint, geo.targetPx, fittedArea, true);
  }

  // And read the other view, which is now a diagnostic -- with one hard floor.
  //
  // Solving purely for time-to-find will happily produce a shape that cannot be seen even
  // when it is centred and framed at the right size. That is not a hard puzzle, it is a
  // broken one: the player has done everything right and there is nothing there. Where
  // that happens the day is brought back up until it is visible when looked at, and comes
  // out easier to find than its rung asked for. Findability wins over the clock.
  await frame(page, 'matched', geo);
  let got = await sample(page, paint, geo.targetPx, area);
  let raised = 0;
  while (solve && got.ratio < FRAMED_FLOOR && strength < ceilingFor && raised < 8) {
    strength = Math.min(ceilingFor, strength * 1.18);
    paint = paintAt(p, strength, image);
    got = await sample(page, paint, geo.targetPx, area);
    raised++;
  }
  // And the other end: a day that had to shout to hit its target is not hidden at all.
  let dimmed = 0;
  while (solve && got.ratio > FRAMED_CEILING && strength > 0.01 && dimmed < 10) {
    strength *= Math.max(0.7, Math.sqrt(FRAMED_CEILING / got.ratio));
    paint = paintAt(p, strength, image);
    got = await sample(page, paint, geo.targetPx, area);
    dimmed++;
  }

  await frame(page, 'fitted', geo);
  if (raised || dimmed) scanned = await sample(page, paint, geo.targetPx, fittedArea, true);

  // Second reading: how loud the shape is with the whole painting on screen.
  //
  // Reported, deliberately not enforced. Contrast at the match and conspicuousness at
  // the fitted view do not move together, and it is tempting to solve for both -- two
  // attempts at that made materially worse games. Capping the peak at hand-picked
  // numbers dimmed nearly every day in the set, Bruegel's Monday down to a contrast of
  // 1.96 and four days below 1.0. Replacing those numbers with a relative rule -- never
  // louder than yesterday -- chained instead: one naturally loud Tuesday got dimmed, the
  // ratio ceiling carried that down the rest of the week, and Bruegel came out at 0.68
  // to 0.92 across six days, none of them findable.
  //
  // The ramp the player actually feels is carried by contrast, size, rotation and the
  // texture of the hiding place, all four of which solve cleanly. This number is here to
  // be looked at, and the week sheets from `npm run preview:week` are what settle it.

  console.log(
    '    ' + rung.key + '  size ' + String(p.size).padEnd(3) +
      ' opacity ' + String(paint.opacity).padEnd(6) + paint.fill +
      '  scan ' + scanned.ratio.toFixed(3).padStart(6) + ' (want ' + want.toFixed(3).padEnd(6) + ')' +
      '  found ' + got.ratio.toFixed(2).padStart(5) +
      (raised ? '   raised to stay visible once framed' : '') +
      (dimmed ? '   dimmed: it was a beacon once framed' : '') +
      (got.ratio < FRAMED_FLOOR ? '   TOO FAINT once framed even at full strength' : ''),
  );

  if (solve) {
    const fixed = p.line
      .replace(/fill: '#[0-9a-f]+'/, `fill: '${paint.fill}'`)
      .replace(/opacity: [\d.]+/, `opacity: ${paint.opacity}`)
      .replace(/ratio: [\d.]+/, `ratio: ${Math.round(got.ratio * 100) / 100}`)
      .replace(/scan: [\d.]+/, `scan: ${Math.round(scanned.ratio * 1000) / 1000}`);
    out = out.replace(p.line, fixed);
  }
}

if (solve) {
  writeFileSync(FILE, out);
  console.log('\nwrote ' + FILE);
}

await browser.close();
