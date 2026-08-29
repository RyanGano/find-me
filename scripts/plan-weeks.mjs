/**
 * Lay out a week of hiding places for every painting, and write them into puzzles.ts.
 *
 *   npm run plan            # rewrite every week
 *   npm run plan -- mona    # rewrite one
 *
 * A week is one painting and seven days that get harder (see src/game/difficulty.ts).
 * This picks everything the ramp does not already fix -- which shape, where it hides,
 * which way round, and what colour it is painted -- and leaves opacity to
 * tune-camouflage.mjs, which is the only thing that can measure it honestly.
 *
 * Everything here is deterministic. Two runs on the same images must produce the same
 * week, or the game stops being the same game for everyone playing it.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { RAMP } from '../src/game/difficulty.ts';
import { SHAPES } from '../src/game/shapes.ts';
import { paintFor } from './lib/paint.mjs';
import AVOID from './avoid.json' with { type: 'json' };


const FILE = 'src/game/puzzles.ts';
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));

/**
 * Shapes with rotational symmetry are the kind ones: a six-armed snowflake matches at
 * every 60 degrees, so it can never ask for more than 30 degrees of work. That caps
 * which days they can hold, and it is why the back half of the week is always drawn
 * from the one-way shapes.
 */
const SYMMETRIC = ['snowflake', 'star', 'clover', 'triangle'];
const ONE_WAY = ['key', 'crescent', 'heart', 'anchor', 'fish', 'bolt', 'arrow'];

/** The shape for each day of week `w`, all seven different, symmetry falling as the week goes on. */
function shapesForWeek(w) {
  const chosen = [];
  for (const [d, rung] of RAMP.entries()) {
    const oneWay = ONE_WAY.map((_, i) => ONE_WAY[(i + w * 3) % ONE_WAY.length]);
    // The early days prefer a symmetric shape, but a symmetric shape that cannot turn
    // far enough is no use at all -- some weeks the rotation simply runs out of them.
    const pool = d < 3 ? [...SYMMETRIC.map((_, i) => SYMMETRIC[(i + w) % SYMMETRIC.length]), ...oneWay] : oneWay;
    const pick = pool.find((s) => !chosen.includes(s) && 180 / SHAPES[s].symmetry >= rung.angle + 2);
    if (!pick) throw new Error(`week ${w} day ${d}: no shape can turn ${rung.angle} degrees`);
    chosen.push(pick);
  }
  return chosen;
}

/**
 * A stored angle that costs the player exactly the day's rung of work.
 *
 * The work is what the ramp fixes; the stored number is free to be anything congruent
 * to it, so it is spread around the circle to keep the badge from looking like it is
 * always near upright.
 */
function angleFor(w, d, shape) {
  const period = 360 / SHAPES[shape].symmetry;
  const base = (w + d) % 2 === 0 ? RAMP[d].angle : -RAMP[d].angle;
  const options = [];
  for (let j = -4; j <= 4; j++) {
    const a = base + j * period;
    if (a > -180 && a <= 180) options.push(a);
  }
  return Math.round(options[(w * 5 + d * 3) % options.length]);
}

/**
 * Viewports to keep a hiding place fair on. Desktop, a large desktop, and a phone.
 */
const VIEWPORTS = [
  [900, 700],
  [1440, 900],
  [390, 780],
];

/** The rendered size the shape must reach, mirroring `targetDisplaySize` in match.ts. */
function targetPxFor(vw, vh) {
  return Math.round(Math.min(88, Math.max(60, Math.min(vw, vh) * 0.16)));
}

/**
 * Is this spot underneath the corner badge when the whole painting is on screen?
 *
 * The badge sits at the top right of the stage and is opaque, so a shape behind it is
 * not camouflaged, it is covered -- invisible during the scan for reasons that have
 * nothing to do with the painting, and impossible to check without panning it out from
 * under the furniture. Bruegel's Tuesday landed there and measured a fitted-view peak of
 * 1, which read as a superb hiding place and was really just the badge sitting on top
 * of it.
 */
function underBadge(x, y, w, h) {
  // The badge box, generously: 12px inset, a well of up to 88px, padding and its caption.
  const BADGE_W = 152;
  const BADGE_H = 176;
  return VIEWPORTS.some(([vw, vh]) => {
    const scale = Math.min(vw / w, vh / h) * 0.92;
    const originX = (vw - w * scale) / 2;
    const originY = (vh - h * scale) / 2;
    const sx = originX + x * scale;
    const sy = originY + y * scale;
    return sx >= vw - BADGE_W && sy <= BADGE_H;
  });
}

/**
 * How far a shape must stay from the edge of the painting.
 *
 * Not for the shape's own sake -- for what is behind it. At the winning framing the
 * shape is centred and the canvas is magnified by `targetPx / size`, so a spot near an
 * edge puts the edge of the painting, and the black beyond it, across the frame. That is
 * both ugly and a landmark: it tells a player which part of the canvas they are in,
 * which is exactly the information they are supposed to be working for.
 *
 * Measured against half the viewport's *shorter* side rather than half its diagonal.
 * The diagonal is the true worst case -- it keeps the canvas edge out of even the far
 * corners -- but it costs 618px on every side for a Monday, and on Hokusai that left
 * nowhere but the crest of the wave: the whole week collapsed into the busiest paint on
 * the canvas and Wednesday came out three times the texture it wanted. Keeping the edge
 * out of the middle of the frame is worth having; keeping it out of the corners is not
 * worth a week that no longer ramps.
 */
function edgeMargin(size) {
  const worst = Math.max(
    ...VIEWPORTS.map(([vw, vh]) => Math.min(vw, vh) / 2 / (targetPxFor(vw, vh) / size)),
  );
  return Math.ceil(worst);
}

/**
 * Every spot on the painting a shape could hide in, with the texture it would have to
 * compete with.
 *
 * One sweep serves the whole week, at one window size and one edge margin, so that the
 * seven readings are directly comparable. Measuring each day at its own size would make
 * Monday's texture and Sunday's different numbers of different things, and the ramp
 * would be comparing them anyway.
 */
function survey(grey, info) {
  // The loosest margin any day could accept, so the sweep covers everything that might
  // be usable. Each day then applies its own, which is much stricter for Monday.
  const margin = Math.min(...RAMP.map((r) => edgeMargin(r.size)));
  const side = 200;
  const step = 24;
  const spots = [];
  if (info.width - 2 * margin < side || info.height - 2 * margin < side) {
    throw new Error(`image is too small to hide anything fairly: needs ${2 * margin + side}px each way`);
  }
  for (let y = margin; y < info.height - margin; y += step) {
    for (let x = margin; x < info.width - margin; x += step) {
      if (underBadge(x, y, info.width, info.height)) continue;
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let dy = -side / 2; dy < side / 2; dy += 2) {
        for (let dx = -side / 2; dx < side / 2; dx += 2) {
          const v = grey[(y + dy) * info.width + (x + dx)];
          sum += v;
          sumSq += v * v;
          n++;
        }
      }
      const mean = sum / n;
      // Dead-black and blown-white regions are refused outright: there is no colour
      // there to derive a shape from, and nothing for it to hide in.
      if (mean < 28 || mean > 228) continue;
      spots.push({ cx: x, cy: y, mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) });
    }
  }
  return spots;
}

/**
 * A small mean-removed thumbnail of the paint around a point, for comparing one patch of
 * painting against another.
 */
function patchAt(grey, info, cx, cy, side) {
  const n = 12;
  const v = [];
  let mean = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = Math.min(info.width - 1, Math.max(0, Math.round(cx - side / 2 + ((i + 0.5) * side) / n)));
      const y = Math.min(info.height - 1, Math.max(0, Math.round(cy - side / 2 + ((j + 0.5) * side) / n)));
      const p = grey[y * info.width + x];
      v.push(p);
      mean += p;
    }
  }
  mean /= v.length;
  let ss = 0;
  for (let k = 0; k < v.length; k++) {
    v[k] -= mean;
    ss += v[k] * v[k];
  }
  return { v, norm: Math.sqrt(ss) || 1 };
}

function correlate(a, b) {
  let s = 0;
  for (let k = 0; k < a.v.length; k++) s += a.v[k] * b.v[k];
  return s / (a.norm * b.norm);
}

/**
 * How much a single straight edge dominates this patch, from 0 to 1.
 *
 * Built from the structure tensor: when the local gradients nearly all point the same
 * way, the patch is a band or a horizon rather than a scatter of features. That matters
 * because such a patch correlates superbly with the patch next to it along the same edge,
 * which reads as repetition and offers a hidden shape nothing at all -- a long edge gives
 * the player no lookalikes to check. Rousseau's Sunday scored 0.97 sitting on the line
 * where the water meets the sand, and played easy.
 */
function edgeDominance(grey, info, cx, cy, side) {
  const half = side / 2;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let y = Math.round(cy - half) + 1; y < cy + half - 1; y += 2) {
    for (let x = Math.round(cx - half) + 1; x < cx + half - 1; x += 2) {
      if (x < 1 || y < 1 || x >= info.width - 1 || y >= info.height - 1) continue;
      const gx = grey[y * info.width + x + 1] - grey[y * info.width + x - 1];
      const gy = grey[(y + 1) * info.width + x] - grey[(y - 1) * info.width + x];
      xx += gx * gx;
      yy += gy * gy;
      xy += gx * gy;
    }
  }
  const trace = xx + yy;
  if (trace < 1e-6) return 0;
  // Eigenvalues of [[xx, xy], [xy, yy]]; their normalised difference is the coherence.
  const diff = Math.sqrt((xx - yy) * (xx - yy) + 4 * xy * xy);
  return diff / trace;
}

/**
 * How much this piece of painting repeats itself nearby, from -1 to 1.
 *
 * Sampled on rings two to five shape-widths out, and scored on the four best matches
 * rather than the average, because what matters is whether a handful of convincing
 * lookalikes exist -- not whether the whole neighbourhood is uniform. The rings start
 * outside the shape's own footprint on purpose: the goal is company for the shape, not
 * cover on top of it.
 */
function repetition(grey, info, cx, cy, size) {
  const side = size * 1.6;
  const here = patchAt(grey, info, cx, cy, side);
  const scores = [];
  for (const radius of [2.2, 3.4, 5]) {
    const r = radius * size;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (x < side || y < side || x >= info.width - side || y >= info.height - side) continue;
      scores.push(correlate(here, patchAt(grey, info, x, y, side)));
    }
  }
  if (!scores.length) return 0;
  scores.sort((a, b) => b - a);
  const top = scores.slice(0, 4);
  const similarity = top.reduce((s, v) => s + v, 0) / top.length;
  // Discount whatever the similarity owes to a single straight edge running through the
  // neighbourhood. What is wanted is company -- several things that look like each other
  // -- not one long boundary that resembles itself everywhere along its length.
  return similarity * (1 - edgeDominance(grey, info, cx, cy, side));
}

/** Standard deviation of a square window of the painting, in image pixels. */
function stdOver(grey, info, cx, cy, side) {
  const half = side / 2;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(cy - half)); y < Math.min(info.height, cy + half); y += 2) {
    for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(info.width, cx + half); x += 2) {
      const v = grey[y * info.width + x];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

/**
 * Can this spot be subtle from a distance and still visible close up?
 *
 * The two things a day is asked for pull in opposite directions, and on some paint they
 * are flatly incompatible. The shape's contrast is one number; what changes between the
 * two views is the paint it is measured against. Reading the whole painting, the shape
 * competes with a window hundreds of image pixels wide; framed for the match, with one a
 * few shape-widths across. So being hard to scan *and* plain once framed needs paint that
 * is smooth at a distance and rough close up.
 *
 * Where it is not, the tuner has to raise the day back up to stay visible and it lands
 * easier to find than the day before it -- Seurat's Sunday came out easier than its own
 * Monday that way. Refusing the spot here is better than spoiling the week there.
 *
 * The floor is empirical, and the first attempt at deriving it was wrong. Dividing the two
 * requirements by each other gives a threshold of about 2.7 for a Saturday, which reads
 * plausibly and is above the 98th percentile of anything Van Gogh has to offer -- the
 * derivation assumes the shape shifts the paint by the same amount at both zooms, and it
 * does not, because shrinking it averages its edges away. Measured across the eight
 * paintings, the third quartile runs from 1.46 to 3.29, so 1.5 keeps roughly the best
 * quarter of each canvas and is reachable on all of them.
 */
/**
 * Hiding places already known to be no good, and struck off by hand.
 *
 * Some paint defeats every test here and only gives itself away once the browser has
 * actually solved it: the tuner either has to shout to reach the day's target -- a shape
 * at contrast 9.8 on the wall behind the Mona Lisa, which reads as a bright spot rather
 * than as anything hidden -- or cannot reach it at all and leaves the day easier to find
 * than the day before it. Rather than keep moving the thresholds below and shifting the
 * problem onto another painting, the specific spot is recorded and the day takes its next
 * best. `scripts/avoid.json` is part of the definition of the game and is committed with
 * it; without it a fresh checkout would plan different weeks.
 */
function avoided(image, x, y) {
  return (AVOID[image] ?? []).some((a) => Math.hypot(a.cx - x, a.cy - y) < (a.r ?? 260));
}

const VIEWS_AGREE_FLOOR = 1.5;

/**
 * And a ceiling, whose absence produced the opposite failure.
 *
 * Paint that is very smooth close up and very busy further out lets a shape be *bright* at
 * the match and still average out when the whole painting is scanned, because the window
 * it is compared against takes in structure nowhere near it. The Mona Lisa's wall does
 * exactly this: a Wednesday there solved to full opacity with its fill pushed towards
 * white, a contrast of 9.8 where a normal day sits between 1 and 5, and it read as a
 * bright spot on the wall behind her rather than as anything hidden.
 *
 * So the preference peaks in the middle of the band rather than at its top, which is where
 * an earlier version pointed it.
 */
const VIEWS_AGREE_CEILING = 3.6;
const VIEWS_AGREE_BEST = 2.2;

function viewAgreement(grey, info, cx, cy, rung, fitScale) {
  const fine = Math.max(3, stdOver(grey, info, cx, cy, 4 * rung.size));
  const fittedHalf = Math.max(20, (rung.size * fitScale + 12) * 2.5) / fitScale;
  const coarse = Math.max(3, stdOver(grey, info, cx, cy, 2 * fittedHalf));
  return coarse / fine;
}

/**
 * Seven hiding places for one painting, one per day, spread across the canvas.
 *
 * Each day asks for the texture its rung wants, but a painting is under no obligation to
 * have it: Bosch had no quiet corner anywhere and Hokusai has little else. So texture is a
 * preference here, not a rule. The ramp a player feels is set by the scan target each day
 * is solved for, and an earlier hard rule that texture must never fall through the week
 * only over-constrained the search until whole paintings had no legal Saturday left.
 *
 * The days are picked in order rather than picked and then ranked, because each has its
 * own edge margin and Monday's is nearly twice Sunday's, and its own test of whether the
 * two views can be satisfied at once. Ranking afterwards shuffled spots between days that
 * could not legally hold them.
 */
function spotsForWeek(grey, info, spots, image) {
  const fitScale = Math.min(900 / info.width, 700 / info.height) * 0.92;
  const taken = [];
  for (const rung of RAMP) {
    const margin = edgeMargin(rung.size);
    let best = null;
    let refused = 0;
    for (const s of spots) {
      if (avoided(image, s.cx, s.cy)) continue;
      if (s.cx < margin || s.cy < margin || s.cx > info.width - margin || s.cy > info.height - margin) continue;
      const nearest = taken.reduce((m, t) => Math.min(m, Math.hypot(t.cx - s.cx, t.cy - s.cy)), Infinity);
      if (nearest < 420) continue;
      const agreement = viewAgreement(grey, info, s.cx, s.cy, rung, fitScale);
      if (agreement < VIEWS_AGREE_FLOOR || agreement > VIEWS_AGREE_CEILING) {
        refused++;
        continue;
      }
      // Texture is the real criterion; separation only breaks ties, so its penalty is
      // capped well below the point where it could drag a day off its rung.
      let cost = Math.abs(s.std - rung.texture) / rung.texture + Math.min(0.35, Math.max(0, (900 - nearest) / 2600));
      // Every day trades some of its texture rung for company. The guard matters: a patch
      // of flat sky that happens to look like the flat sky next to it is repetitive in the
      // arithmetic and offers the shape nothing to hide in, so a spot has to be roughly on
      // its rung before its lookalikes count for anything.
      // Prefer the middle of the band: comfortably above the floor, well clear of the
      // ceiling where shapes turn into beacons.
      cost += 0.3 * Math.min(1, Math.abs(agreement - VIEWS_AGREE_BEST) / 1.2);
      if (rung.company && cost < 1.2) cost -= rung.company * Math.max(0, repetition(grey, info, s.cx, s.cy, rung.size));
      if (!best || cost < best.cost) best = { ...s, cost };
    }
    if (!best) {
      throw new Error(
        `${rung.label}: nothing left that clears the edge by ${margin}px, sits 420px from the other days, ` +
          `and sits in the band where a shape can be subtle at a distance and visible but ` +
          `not blazing close up (${refused} spots refused on that last count) -- ` +
          `this painting cannot hold a week`,
      );
    }
    best.repeat = repetition(grey, info, best.cx, best.cy, rung.size);
    taken.push(best);
  }
  return taken;
}

/** Every week seed in puzzles.ts, with the extent of its days block. */
function weeks(source) {
  const out = [];
  const re = /\{\s*image: '(\w+)',[\s\S]*?width: (\d+),\s*height: (\d+),\s*days: \[[\s\S]*?\],\s*\},/g;
  let m;
  while ((m = re.exec(source))) {
    out.push({ image: m[1], width: +m[2], height: +m[3], start: m.index, end: re.lastIndex });
  }
  return out;
}

let source = readFileSync(FILE, 'utf8');
const found = weeks(source);
if (!found.length) throw new Error(`no week seeds found in ${FILE}`);

// Back to front, so rewriting one week cannot shift the offsets of the next.
for (const [w, week] of [...found.entries()].reverse()) {
  if (only.length && !only.includes(week.image)) continue;
  const file = `public/puzzles/${week.image}.jpg`;
  const grey = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgb = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  if (grey.info.width !== week.width || grey.info.height !== week.height) {
    throw new Error(
      `${week.image}: asset is ${grey.info.width}x${grey.info.height}, puzzles.ts says ${week.width}x${week.height}`,
    );
  }

  const shapes = shapesForWeek(w);
  const surveyed = survey(grey.data, grey.info);
  const spots = spotsForWeek(grey.data, grey.info, surveyed, week.image);
  const lines = [];
  const report = [];
  for (const [d, rung] of RAMP.entries()) {
    const shape = shapes[d];
    const spot = spots[d];
    const { blend, fill } = paintFor(rgb.data, rgb.info, spot.cx, spot.cy, rung.size);
    const angle = angleFor(w, d, shape);
    const opacity = rung.opaque ? 1 : 0.4;
    lines.push(
      `      { shape: '${shape}', cx: ${spot.cx}, cy: ${spot.cy}, size: ${rung.size}, angle: ${angle}, ` +
        `fill: '${fill}', opacity: ${opacity}, blend: '${blend}', blur: 0.5, ratio: ${rung.ratio}, scan: ${rung.scan} },`,
    );
    report.push(
      `  ${rung.key}  ${shape.padEnd(10)} at ${String(spot.cx).padStart(4)},${String(spot.cy).padStart(4)}` +
        `  texture ${spot.std.toFixed(1).padStart(5)} (want ${rung.texture})  ${blend} ${fill}  angle ${String(angle).padStart(4)}` +
        `  company ${spot.repeat.toFixed(2)}`,
    );
  }
  console.log(week.image + '\n' + report.join('\n'));

  const rebuilt = source
    .slice(week.start, week.end)
    .replace(/days: \[[\s\S]*?\],(\s*\},)$/, `days: [\n${lines.join('\n')}\n    ],$1`);
  source = source.slice(0, week.start) + rebuilt + source.slice(week.end);
}

writeFileSync(FILE, source);
console.log('\nwrote ' + FILE + ' -- opacity is still a guess; run npm run camouflage');
