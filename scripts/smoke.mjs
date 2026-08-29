/**
 * End-to-end smoke test: drives the real page with a real browser, solves the puzzle
 * through genuine wheel and pointer events, and screenshots each stage.
 *
 * Also carries regressions for two input bugs that only show up on touch devices --
 * see the "gesture regressions" section at the bottom.
 *
 * Usage: node scripts/smoke.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? '.source-images/shots';
mkdirSync(OUT, { recursive: true });

const CHANNELS = ['chrome', 'msedge', undefined];
const failures = [];

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function launch() {
  let last;
  for (const channel of CHANNELS) {
    try {
      return await chromium.launch({ channel, args: ['--force-device-scale-factor=1'] });
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

const browser = await launch();
const errors = [];

/** Read the live canvas transform as scale and rotation. */
const readTransform = (page) =>
  page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.stage-canvas')).transform);
    return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f, scale: Math.hypot(m.a, m.b) };
  });

// ---------------------------------------------------------------- desktop playthrough

console.log('\n== desktop playthrough ==');
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.stage-image');
await page.screenshot({ path: `${OUT}/1-howto.png` });

await page.getByRole('button', { name: 'Start' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/2-board.png` });

check('painting is blurred before the first move', await page.$('.stage-viewport.is-blurred') !== null);
check('clock reads ready before the first move', (await page.textContent('.clock')).trim() === 'ready');

const plan = await page.evaluate(() => {
  const stage = document.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const targetEl = document.querySelector('.stage-target');
  const svg = targetEl.querySelector('svg');
  const size = Number(svg.getAttribute('width'));
  const cx = parseFloat(targetEl.style.left) + size / 2;
  const cy = parseFloat(targetEl.style.top) + size / 2;
  const angle = Number((svg.style.transform.match(/rotate\((-?[\d.]+)deg\)/) ?? [0, 0])[1]);
  const ref = document.querySelector('.reference-well svg');
  return {
    stage: { left: r.left, top: r.top, w: r.width, h: r.height },
    cx, cy, size, angle,
    targetPx: Number(ref.getAttribute('width')),
  };
});

const scale = plan.targetPx / plan.size;
const rot = (-plan.angle * Math.PI) / 180;
const cxs = plan.stage.left + plan.stage.w / 2;
const cys = plan.stage.top + plan.stage.h / 2;

/** Wheel-zoom towards a target scale, easing off as it closes in like a player would. */
async function zoomTo(want) {
  for (let i = 0; i < 900; i++) {
    const { scale: s } = await readTransform(page);
    const gap = Math.log(want / s);
    if (Math.abs(gap) < 0.003) return;
    await page.mouse.move(cxs, cys);
    await page.mouse.wheel(0, -Math.sign(gap) * Math.min(120, Math.max(4, Math.abs(gap) / 0.0004 / 3)));
  }
}

// Stop deliberately short of the match: inside the "nearly" band, outside the tolerance.
// That lets the run observe the amber state before it turns green.
await zoomTo(scale * 1.07);
check('blur lifts on the first move', await page.$('.stage-viewport.is-blurred') === null);
check('clock starts on the first move', (await page.textContent('.clock')).trim() !== 'ready');
await page.screenshot({ path: `${OUT}/3-zoomed.png` });

// Rotate with shift+wheel until upright, again easing off as it closes in.
await page.keyboard.down('Shift');
for (let i = 0; i < 900; i++) {
  const m = await readTransform(page);
  const r = Math.atan2(m.b, m.a);
  let d = rot - r;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) < 0.004) break;
  await page.mouse.move(cxs, cys);
  await page.mouse.wheel(0, Math.sign(d) * Math.min(120, Math.max(4, Math.abs(d) / 0.0006 / 3)));
}
await page.keyboard.up('Shift');

// Size and angle are close, but the shape is nowhere near the screen. Claiming
// "nearly" here would be a lie, and would let a player sweep for it blind.
check(
  'the badge stays dark while the shape is off screen',
  await page.$('.reference.is-near') === null,
);
await page.screenshot({ path: `${OUT}/4-rotated.png` });

// Pan the hidden shape to the centre of the stage in one drag.
{
  const m = await readTransform(page);
  const sx = m.a * plan.cx + m.c * plan.cy + m.e;
  const sy = m.b * plan.cx + m.d * plan.cy + m.f;
  const dx = plan.stage.w / 2 - sx;
  const dy = plan.stage.h / 2 - sy;
  const startX = Math.min(Math.max(cxs - dx / 2, plan.stage.left + 40), plan.stage.left + plan.stage.w - 40);
  const startY = Math.min(Math.max(cys - dy / 2, plan.stage.top + 40), plan.stage.top + plan.stage.h - 40);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(startX + (dx * i) / 40, startY + (dy * i) / 40);
  }
  await page.mouse.up();
}

// On screen now, and close on both axes, so the badge should light -- but the run is
// still 7% out on size, so it must not have solved.
check('the badge lights once the shape is on screen and close', await page.$('.reference.is-near') !== null);
check('being close is not the same as solving', await page.$('.result') === null);
check(
  'the hint never marks the hidden shape itself',
  await page.$('.stage-outline') === null && await page.$('.stage-target .is-near') === null,
);

// Close the last 7%. The shape is at the centre, which is the zoom pivot, so it stays put.
await zoomTo(scale);

await page.waitForSelector('.result', { timeout: 5000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/5-solved.png` });

const time = await page.textContent('.result-time');
check('puzzle solves', Boolean(time), `time ${time}`);
check('clock marked done', await page.$('.clock.is-done') !== null);
check('the badge turns green on the solve', await page.$('.reference.is-solved') !== null);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.result');
check('result survives a reload', (await page.textContent('.result-time')) === time);

// ------------------------------------------------------------------ gesture regressions

console.log('\n== gesture regressions (touch) ==');
const mobile = await browser.newContext({
  viewport: { width: 390, height: 780 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push('mobile: ' + e));

await mp.goto(URL + '?puzzle=wave-thu', { waitUntil: 'networkidle' });
await mp.waitForSelector('.stage-image');

// Install helpers that fire real PointerEvents at the stage.
await mp.evaluate(() => {
  const el = document.querySelector('.stage');
  // Capture is a no-op in this harness; the real thing is exercised by users.
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  el.hasPointerCapture = () => false;
  window.__send = (type, pts, isPrimary = null) => {
    for (const p of pts) {
      el.dispatchEvent(new PointerEvent(type, {
        pointerId: p.id, pointerType: 'touch', clientX: p.x, clientY: p.y,
        bubbles: true, cancelable: true,
        isPrimary: isPrimary === null ? p.id === 1 : isPrimary,
      }));
    }
  };
});

// --- 1. a pinch scales by exactly the finger spread ---------------------------------
{
  const before = (await readTransform(mp)).scale;
  await mp.evaluate(() => {
    window.__send('pointerdown', [{ id: 1, x: 150, y: 350 }]);
    window.__send('pointerdown', [{ id: 2, x: 250, y: 350 }]);
    for (let i = 1; i <= 20; i++) {
      const spread = 100 + i * 8;
      window.__send('pointermove', [{ id: 1, x: 200 - spread / 2, y: 350 }]);
      window.__send('pointermove', [{ id: 2, x: 200 + spread / 2, y: 350 }]);
    }
    window.__send('pointerup', [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }]);
  });
  const after = (await readTransform(mp)).scale;
  const gain = after / before;
  // Fingers went from 100px apart to 260px apart, so the image must grow 2.6x.
  check('pinch gain matches the fingers', Math.abs(gain / 2.6 - 1) < 0.02, `gain ${gain.toFixed(3)}, want 2.600`);
}

// --- 2. Safari gesture events must not double-apply on top of touch pointers ---------
// On iOS these fire alongside the pointer events for the same two fingers. Acting on
// both zooms roughly the square of what the fingers asked for, which is what players
// reported as "the zoom doesn't match my pinch, it's way too big".
{
  const before = (await readTransform(mp)).scale;
  const fired = await mp.evaluate(() => {
    const el = document.querySelector('.stage');
    window.__send('pointerdown', [{ id: 1, x: 150, y: 350 }]);
    window.__send('pointerdown', [{ id: 2, x: 250, y: 350 }]);
    const start = new Event('gesturestart', { bubbles: true, cancelable: true });
    Object.assign(start, { scale: 1, rotation: 0, clientX: 200, clientY: 350 });
    el.dispatchEvent(start);
    const change = new Event('gesturechange', { bubbles: true, cancelable: true });
    Object.assign(change, { scale: 2, rotation: 0, clientX: 200, clientY: 350 });
    el.dispatchEvent(change);
    window.__send('pointerup', [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }]);
    return true;
  });
  const after = (await readTransform(mp)).scale;
  check(
    'Safari gesture events are ignored while fingers are down',
    fired && Math.abs(after / before - 1) < 0.001,
    `scale moved by ${(after / before).toFixed(4)}x, want 1.0000`,
  );
}

// --- 3. a lost pointerup must not leave a ghost finger -------------------------------
// If a second finger's release is never delivered -- app backgrounded, call comes in,
// Safari claims the gesture -- the next one-finger drag used to be read as a pinch
// against a stationary ghost, which both zooms wildly and feels like zoom is broken.
{
  await mp.evaluate(() => {
    window.__send('pointerdown', [{ id: 1, x: 150, y: 350 }]);
    window.__send('pointerdown', [{ id: 2, x: 250, y: 350 }]);
    window.__send('pointermove', [{ id: 1, x: 140, y: 350 }]);
    // Finger 1 lifts; finger 2's release is simply never delivered.
    window.__send('pointerup', [{ id: 1, x: 140, y: 350 }]);
  });

  const before = await readTransform(mp);
  await mp.evaluate(() => {
    // A brand new one-finger drag. isPrimary marks it as the start of a gesture.
    window.__send('pointerdown', [{ id: 1, x: 200, y: 300 }], true);
    for (let i = 1; i <= 10; i++) window.__send('pointermove', [{ id: 1, x: 200 + i * 6, y: 300 }]);
    window.__send('pointerup', [{ id: 1, x: 260, y: 300 }]);
  });
  const after = await readTransform(mp);

  check(
    'a lost pointerup does not turn the next drag into a pinch',
    Math.abs(after.scale / before.scale - 1) < 0.001,
    `scale moved by ${(after.scale / before.scale).toFixed(4)}x, want 1.0000`,
  );
  check(
    'the drag still pans',
    Math.abs(after.e - before.e - 60) < 2,
    `panned ${(after.e - before.e).toFixed(1)}px, want 60.0`,
  );
}

// --- 4. a twist rotates without a stray scale ---------------------------------------
{
  const before = await readTransform(mp);
  await mp.evaluate(() => {
    window.__send('pointerdown', [{ id: 1, x: 150, y: 350 }], true);
    window.__send('pointerdown', [{ id: 2, x: 250, y: 350 }]);
    for (let i = 1; i <= 30; i++) {
      const a = (i * Math.PI) / 180;
      const dx = 50 * Math.cos(a);
      const dy = 50 * Math.sin(a);
      window.__send('pointermove', [{ id: 1, x: 200 - dx, y: 350 - dy }]);
      window.__send('pointermove', [{ id: 2, x: 200 + dx, y: 350 + dy }]);
    }
    window.__send('pointerup', [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }]);
  });
  const after = await readTransform(mp);
  const turned = ((Math.atan2(after.b, after.a) - Math.atan2(before.b, before.a)) * 180) / Math.PI;
  check('twist rotates by the finger angle', Math.abs(turned - 30) < 1, `turned ${turned.toFixed(1)} deg, want 30.0`);
  check('twist does not change zoom', Math.abs(after.scale / before.scale - 1) < 0.01,
    `scale moved by ${(after.scale / before.scale).toFixed(4)}x`);
}

await mp.screenshot({ path: `${OUT}/6-mobile.png` });
await browser.close();

if (errors.length) {
  console.error('\nPAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
