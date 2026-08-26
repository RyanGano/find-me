/**
 * End-to-end smoke test: drives the real page with a real browser, solves the puzzle
 * by computing the winning transform, and screenshots each stage.
 *
 * Usage: node scripts/smoke.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4173/find-me/';
const OUT = process.argv[3] ?? '.source-images/shots';
mkdirSync(OUT, { recursive: true });

const CHANNELS = ['chrome', 'msedge', undefined];

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
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.stage-image');
await page.screenshot({ path: `${OUT}/1-howto.png` });

await page.getByRole('button', { name: 'Start' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/2-board.png` });

// Read the puzzle's ground truth out of the DOM and compute the winning framing.
const plan = await page.evaluate(() => {
  const stage = document.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const canvas = document.querySelector('.stage-canvas');
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
    canvasW: canvas.offsetWidth,
  };
});

const scale = plan.targetPx / plan.size;
const rot = (-plan.angle * Math.PI) / 180;

// Drive the page the way a player would: zoom at a pivot, rotate, then pan.
// Each step is a real wheel/pointer event, so this exercises the gesture layer.
const cxs = plan.stage.left + plan.stage.w / 2;
const cys = plan.stage.top + plan.stage.h / 2;

async function currentTransform() {
  return page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.stage-canvas')).transform);
    return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
  });
}

// Zoom in with the wheel until the size gauge reads matched.
for (let i = 0; i < 400; i++) {
  const m = await currentTransform();
  const s = Math.hypot(m.a, m.b);
  if (Math.abs(s / scale - 1) < 0.02) break;
  await page.mouse.move(cxs, cys);
  await page.mouse.wheel(0, s < scale ? -40 : 40);
}
await page.screenshot({ path: `${OUT}/3-zoomed.png` });

// Rotate with shift+wheel until the angle gauge reads matched.
await page.keyboard.down('Shift');
for (let i = 0; i < 600; i++) {
  const m = await currentTransform();
  const r = Math.atan2(m.b, m.a);
  let d = rot - r;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) < 0.02) break;
  await page.mouse.move(cxs, cys);
  await page.mouse.wheel(0, d > 0 ? 30 : -30);
}
await page.keyboard.up('Shift');
await page.screenshot({ path: `${OUT}/4-rotated.png` });

const gauges = await page.$$eval('.gauge', (els) =>
  els.map((e) => ({ label: e.querySelector('.gauge-label').textContent, ok: e.classList.contains('is-ok') })));
console.log('gauges after zoom+rotate:', JSON.stringify(gauges));

// Pan the hidden shape to the centre of the stage in one drag.
{
  const m = await currentTransform();
  const sx = m.a * plan.cx + m.c * plan.cy + m.e;
  const sy = m.b * plan.cx + m.d * plan.cy + m.f;
  const dx = plan.stage.w / 2 - sx;
  const dy = plan.stage.h / 2 - sy;
  const startX = Math.min(Math.max(cxs - dx / 2, plan.stage.left + 40), plan.stage.left + plan.stage.w - 40);
  const startY = Math.min(Math.max(cys - dy / 2, plan.stage.top + 40), plan.stage.top + plan.stage.h - 40);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
  }
  await page.mouse.up();
}

await page.waitForSelector('.result', { timeout: 5000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/5-solved.png` });

const time = await page.textContent('.result-time');
const clockDone = await page.$('.clock.is-done');
console.log('solved in', time, '| clock marked done:', Boolean(clockDone));

// The recorded result must survive a reload as a finished board.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.result');
console.log('after reload, result persists:', await page.textContent('.result-time'));

// Mobile pass: pinch and twist with two touch pointers.
const mobile = await browser.newContext({
  viewport: { width: 390, height: 780 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push('mobile: ' + e));
await mp.goto(URL + '?puzzle=wave', { waitUntil: 'networkidle' });
await mp.waitForSelector('.stage-image');
await mp.screenshot({ path: `${OUT}/6-mobile.png` });

const before = await mp.evaluate(() =>
  new DOMMatrix(getComputedStyle(document.querySelector('.stage-canvas')).transform).a);
await mp.evaluate(() => {
  const el = document.querySelector('.stage');
  const send = (type, pts) => {
    for (const p of pts) {
      el.dispatchEvent(new PointerEvent(type, {
        pointerId: p.id, pointerType: 'touch', clientX: p.x, clientY: p.y,
        bubbles: true, cancelable: true, isPrimary: p.id === 1,
      }));
    }
  };
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  el.hasPointerCapture = () => false;
  send('pointerdown', [{ id: 1, x: 150, y: 350 }, { id: 2, x: 250, y: 350 }]);
  for (let i = 1; i <= 20; i++) {
    const spread = 100 + i * 8;
    const a = (i * Math.PI) / 120;
    const dx = (spread / 2) * Math.cos(a);
    const dy = (spread / 2) * Math.sin(a);
    send('pointermove', [{ id: 1, x: 200 - dx, y: 350 - dy }]);
    send('pointermove', [{ id: 2, x: 200 + dx, y: 350 + dy }]);
  }
  send('pointerup', [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }]);
});
await mp.waitForTimeout(200);
const after = await mp.evaluate(() => {
  const m = new DOMMatrix(getComputedStyle(document.querySelector('.stage-canvas')).transform);
  return { scale: Math.hypot(m.a, m.b), rotDeg: (Math.atan2(m.b, m.a) * 180) / Math.PI };
});
await mp.screenshot({ path: `${OUT}/7-mobile-pinched.png` });
console.log(`pinch: scale ${before.toFixed(3)} -> ${after.scale.toFixed(3)}, rotated ${after.rotDeg.toFixed(1)} deg`);
console.log('mobile clock running:', await mp.textContent('.clock'));

await browser.close();

if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('smoke test passed');
