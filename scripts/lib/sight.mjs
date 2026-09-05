import sharp from 'sharp';

/**
 * Reference footprint for the field-of-view signal, in screen pixels squared.
 * Roughly a 6px shape -- the scale a day's shape actually occupies at the fitted view.
 */
export const FOV_REFERENCE_AREA = 40;

/**
 * One shared sampler, imported by both the tuner and the placement tool.
 *
 * It lives here rather than in either caller because it *is* the definition of how hard a
 * day is. Two copies of a metric drift, and a placement tool that scored candidates by a
 * slightly different formula than the tuner solves against would pick spots that measure
 * well and play wrong.
 */
/**
 * Contrast of the shape against the painting for a given paint, on real pixels.
 *
 * `onShape` picks which paint the signal is divided by. At the matched framing the shape
 * sits dead centre, so the window is taken there and sized from `targetPx` -- that is the
 * definition every tuned day in the file was solved against and it must not drift. At the
 * fitted view the shape is somewhere off in the canvas, and a window at the stage centre
 * measures a completely unrelated patch, so there the window follows the shape.
 */
export async function sample(page, paint, targetPx, maskArea, onShape = false, fov = false) {
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
  // Signal, two ways.
  //
  // The default is the mean shift per pixel, which is a contrast reading: a 20px shape and
  // a 44px shape at the same opacity score identically, because size divides straight back
  // out. That is why nothing upstream of the paint has ever moved a day -- the instrument
  // cannot see it.
  //
  // Under --fov the signal is the *total* shift instead, over a fixed reference area. That
  // is Ricco's law, which is the right shape for these targets: below a critical size the
  // eye integrates contrast over area, so detectability goes as contrast times area rather
  // than contrast alone. At the fitted view a day's shape is a handful of pixels across --
  // a size-31 shape on mona is about 5.5 -- which is well inside that regime.
  // Only the fitted reading changes. The matched view answers a different question --
  // can you see it once you are on it -- and is a contrast reading on purpose.
  const signal = fov && onShape ? sum / FOV_REFERENCE_AREA : sum / (maskArea || changed || 1);

  // Texture it competes with.
  //
  // The default window is several shape-widths across, which sounds right and is not: at
  // the fitted view 2.5x a five-pixel shape is under the 20px floor, so it sits pinned at
  // that floor for nearly every day, and for the few larger ones it grows -- which makes a
  // bigger shape read as *less* conspicuous. Measured at fixed opacity, size 44 scored
  // 0.377 against size 20's 0.526: backwards.
  //
  // Under --fov it is a fixed slice of the view instead, the same for every day, so what
  // the shape competes against is the painting rather than its own dimensions.
  const cxp = onShape ? Math.min(width - 1, Math.max(0, Math.round(box.x + box.w / 2))) : Math.floor(width / 2);
  const cyp = onShape ? Math.min(height - 1, Math.max(0, Math.round(box.y + box.h / 2))) : Math.floor(height / 2);
  const half = onShape
    ? (fov
        ? Math.round(Math.min(width, height) * 0.15)
        : Math.max(20, Math.min(Math.round(Math.max(box.w, box.h) * 2.5), Math.floor(Math.min(width, height) / 2))))
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
