/**
 * Diagnostic: at a known-good match, measure what the hidden shape and the reference
 * badge actually render at, in real screen pixels, and compare.
 *
 * Measures the painted path geometry (getBBox through the live CTM), not the element
 * box, so a rotated shape is compared fairly.
 */
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:4173/';

const browser = await chromium.launch({ channel: 'chrome' });

for (const device of [
  { name: 'desktop', viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 },
  { name: 'iphone', viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
]) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  await page.goto(URL + '?puzzle=mona-thu', { waitUntil: 'networkidle' });
  await page.waitForSelector('.stage-image');
  const start = await page.$('button:has-text("Start")');
  if (start) await start.click();

  // Snap straight to the exact winning transform, bypassing the gesture layer, so we
  // are measuring rendering only.
  const report = await page.evaluate(() => {
    const targetEl = document.querySelector('.stage-target');
    const svg = targetEl.querySelector('svg');
    const size = Number(svg.getAttribute('width'));
    const ref = document.querySelector('.reference-well svg');
    const targetPx = Number(ref.getAttribute('width'));

    /** Painted extent of a path in screen px, via its own bbox and current CTM. */
    const painted = (pathEl) => {
      const b = pathEl.getBBox();
      const m = pathEl.getScreenCTM();
      const pts = [
        [b.x, b.y], [b.x + b.width, b.y],
        [b.x + b.width, b.y + b.height], [b.x, b.y + b.height],
      ].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
      // Edge lengths of the (possibly rotated) rendered quad.
      const w = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const h = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
      return { w, h };
    };

    const hidden = painted(svg.querySelector('path'));
    const badge = painted(ref.querySelector('path'));
    const canvas = document.querySelector('.stage-canvas');
    const m = new DOMMatrix(getComputedStyle(canvas).transform);
    return {
      declaredSize: size,
      targetPx,
      renderScale: Math.hypot(m.a, m.b),
      hidden,
      badge,
      dpr: window.devicePixelRatio,
      visualScale: window.visualViewport ? window.visualViewport.scale : null,
    };
  });

  // Drive the page to the exact solve scale and read the match state the game sees.
  const solved = await page.evaluate(() => {
    const targetEl = document.querySelector('.stage-target');
    const svg = targetEl.querySelector('svg');
    const size = Number(svg.getAttribute('width'));
    const ref = document.querySelector('.reference-well svg');
    const targetPx = Number(ref.getAttribute('width'));
    return { needScale: targetPx / size };
  });

  console.log(`\n=== ${device.name} (dpr ${report.dpr}, visualViewport scale ${report.visualScale}) ===`);
  console.log(`  badge painted:  ${report.badge.w.toFixed(1)} x ${report.badge.h.toFixed(1)} px  (declared ${report.targetPx})`);
  console.log(`  hidden painted: ${report.hidden.w.toFixed(1)} x ${report.hidden.h.toFixed(1)} px  at render scale ${report.renderScale.toFixed(4)}`);
  const atMatch = {
    w: (report.hidden.w / report.renderScale) * solved.needScale,
    h: (report.hidden.h / report.renderScale) * solved.needScale,
  };
  console.log(`  hidden at the winning scale: ${atMatch.w.toFixed(1)} x ${atMatch.h.toFixed(1)} px`);
  const ratio = atMatch.w / report.badge.w;
  console.log(`  RATIO hidden/badge at match: ${ratio.toFixed(4)}  ${Math.abs(ratio - 1) < 0.02 ? 'OK' : '<-- MISMATCH'}`);

  await ctx.close();
}

await browser.close();
