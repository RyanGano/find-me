import sharp from 'sharp';

/**
 * How much work a painting is to scan, and how much cover the paint at one spot gives.
 *
 * This exists because the ramp had no term for it and the shipped set proved it needed
 * one. `scan` -- the reading every day is solved against -- is a *local* measurement: the
 * shift the shape imposes over the texture immediately around it. Two paintings can hand
 * back the same reading and take ten times as long to search, because the reading cannot
 * see how many other places on the canvas look like something worth checking.
 *
 * There was already a per-painting term, `searchCost` in tune-camouflage.mjs, and it was
 * measuring the wrong thing: the median standard deviation of 200px windows. That is
 * coarse structure -- a wave's edge, a figure's outline, the join between a curtain and a
 * wall -- and coarse structure is not what a hunt competes with. It ranked the flattest
 * painting on the bench as the busiest canvas in the set, and that painting was solved
 * thirty times faster than the one it was ranked beside.
 *
 * What competes with the hunt is detail *the size of the shape*, because that is what the
 * eye has to stop and check. So the reading is a band-pass: subtract a blurred copy, and
 * what survives is everything at roughly one shape-width. `clutter` is the share of the
 * canvas carrying any of it.
 */

/**
 * Radius of the blur the canvas is measured against, in image pixels.
 *
 * Every asset is generated at 2600px wide (`npm run images`), and a day's shape runs 22
 * to 40 image pixels across, so this is about one shape-width: features smaller survive,
 * the composition does not. It is a constant rather than a per-day number on purpose --
 * clutter is a property of the painting, shared by all seven of its days, and a reading
 * that moved with the rung would fold the ramp back into its own correction.
 */
export const BAND_RADIUS = 12;

/** Grey levels of band-pass signal that count as detail worth stopping on. */
export const DETAIL_LEVEL = 6;

const cache = new Map();

async function greyscale(id) {
  if (cache.has(id)) return cache.get(id);
  const base = sharp(`public/puzzles/${id}.jpg`).greyscale();
  const [flat, low] = await Promise.all([
    base.clone().raw().toBuffer({ resolveWithObject: true }),
    base.clone().blur(BAND_RADIUS).raw().toBuffer({ resolveWithObject: true }),
  ]);
  const band = new Uint8Array(flat.data.length);
  for (let i = 0; i < flat.data.length; i++) {
    band[i] = Math.min(255, Math.abs(flat.data[i] - low.data[i]));
  }
  const value = { grey: flat.data, band, info: flat.info };
  cache.set(id, value);
  return value;
}

/**
 * The share of the canvas carrying shape-scale detail, 0 to 1.
 *
 * The shipped rotation runs 0.45 (smooth glazed portrait) to 0.77 (dense short
 * brushwork), and that range is a factor of thirty in how long a day takes -- see
 * `CLUTTER_WEIGHT` in `src/game/difficulty.ts`.
 */
export async function clutterOf(id) {
  const { band, info } = await greyscale(id);
  let over = 0;
  const n = info.width * info.height;
  for (let i = 0; i < n; i++) if (band[i] > DETAIL_LEVEL) over++;
  return over / n;
}

/**
 * How dark the paint is where the shape sits, 0 (white) to 1 (black).
 *
 * Measured over a couple of shape-widths, on the painting alone -- the shape is not
 * drawn into the asset, so this is the ground it has to hide against. Contrast readings
 * are absolute grey-level shifts, and the same shift is harder to pick out of dark paint
 * than out of light; this is the term that says so.
 */
export async function dimnessOf(id, cx, cy, size) {
  const { grey, info } = await greyscale(id);
  const r = Math.round(size * 2.5);
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, cy - r); y < Math.min(info.height, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x < Math.min(info.width, cx + r); x++) {
      sum += grey[y * info.width + x];
      n++;
    }
  }
  return Math.min(1, Math.max(0, (255 - sum / (n || 1)) / 255));
}
