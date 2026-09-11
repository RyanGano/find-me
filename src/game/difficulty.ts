/**
 * The week's difficulty ramp.
 *
 * One painting runs Monday through Sunday. The painting is the constant; everything
 * the player actually contends with -- which shape, where it hides, how big, how far
 * round, how well it blends -- changes every day and gets harder every day. Monday is
 * the gentle one, Sunday is the wall.
 *
 * Four independent levers, all measured rather than felt:
 *
 * `size`     the shape's box in image pixels, running from 1.5% of the image width down
 *            to 0.85%. At the winning framing the shape is always exactly
 *            `targetDisplaySize` across on screen, because the winning scale is
 *            targetPx / size -- so size does not change how visible it is once you are on
 *            it. It changes how big a speck it is with the whole painting on screen, and
 *            how far you have to zoom to reach the match. Shrinking a shape makes it
 *            harder to *scan for* and harder to *land*, without making it any harder to
 *            *see*.
 *
 *            It is *not*, despite what this comment said for a long time, the lever that
 *            decides whether a puzzle is hard. Shrinking a shape makes it a smaller speck
 *            to scan for, but the tuner then solves opacity against the day's `scan`
 *            target and brightens it until the day takes exactly as long as it always
 *            did. This was tested rather than argued: raising the asset width from 2600 to
 *            3400, which shrinks every shape to 77% of its old share of the canvas at
 *            identical magnification, produced no measured difficulty gain at all. What it
 *            produced was eight days the solver could not place, because reaching the
 *            required loudness at that size tripped the beacon ceiling once framed and the
 *            dimming loop dragged them back under. Set the time on `scan`; leave this
 *            alone.
 *
 *            An earlier version of this ramp had it backwards. It opened Monday at 64px --
 *            half again the size of anything the game had used before -- reasoning that a
 *            big shape makes a gentle day. It makes an instant one: at the fitted view a
 *            64px shape is a 20px object on screen and the eye lands on it unprompted,
 *            whatever its colour is doing. Contrast cannot rescue a shape that big.
 * `scan`     **the one that decides how long a day takes, and the only lever that does.**
 *            The shape's luminance shift with the whole painting on screen, divided by
 *            the texture of the paint immediately around it. It is what opacity is solved
 *            for, and the rung now carries the number the tuner aims at directly.
 *
 *            Both parts of the measure were learned by being wrong. Raw peak brightness
 *            said Rousseau's smooth sky and Bruegel's crowd were comparable when one was
 *            a beacon; dividing by local texture fixed that.
 *
 *            It is not enough on its own, and for a long time this comment claimed it was.
 *            A third part used to sit on the *target*: the rung's scan was multiplied by
 *            the canvas's own search cost, so a painting with more ground to cover was
 *            allowed a louder shape. That was removed, on the reasoning that
 *            `expectedSearchMs` maps a raw scan reading to a time with no cost term in it,
 *            so scaling the target by a per-painting cost guaranteed equal rungs came out
 *            at unequal times. The reasoning was circular -- the cost-scaled targets were
 *            judged against a clock that had been built without a cost term -- and removing
 *            the mechanism rather than fixing it cost the set a year of wrong Mondays.
 *
 *            Real play settled it. Across seventeen days with recorded times -- eleven
 *            shipped, six from a play-test round -- `scan` correlates with how long a day
 *            actually takes at a rank correlation of 0.14, which is nothing, and with the
 *            wrong sign. One Monday was solved in a median of 22 seconds and the next
 *            Monday, on a busier canvas and the same rung and the same measured scan, took
 *            3 minutes 21. See `CLUTTER_WEIGHT` for the term that fixes it and
 *            `DIMNESS_WEIGHT` for the second one.
 *
 *            So the rung's authority is `seconds`, and `scanForTime` turns that into the
 *            number the tuner aims at *on this painting, at this spot*. `scan` below is
 *            that number at the reference canvas, kept because it is legible and because
 *            every day tuned before this change was solved against it.
 *
 *            The scale is steep and the numbers are close together: 0.56 is twenty
 *            seconds and 0.36 is nearly four minutes. Small changes here are large
 *            changes in play. `expectedSearchMs` clamps to [0.3, 0.6], so the usable band
 *            is roughly 0.324 to 0.617 -- ask for a time outside it on a canvas far from
 *            the reference and `scanForTime` will clamp rather than obey.
 *
 *            The current rungs target 45s, 70s, 100s, 140s, 180s, 230s and 290s. Nothing
 *            else in this file moves difficulty. `size`, `company` and the asset
 *            resolution were each tried as levers and each was compensated straight back
 *            out by the solver, which brightens the shape until the day takes the time the
 *            rung asked for -- see `size` and `company` below.
 * `ratio`    signal over local texture at the winning framing -- "can you see it while
 *            looking straight at it". No longer solved for, because a day cannot be
 *            pinned to a time and a contrast at once; it is measured, recorded, and held
 *            above a floor, since a shape you cannot see even when framed is broken
 *            rather than hard.
 * `texture`  the standard deviation of the hiding place itself, which sets how much
 *            cover the painting offers before the shape is even drawn. A flat sky gives
 *            a shape nowhere to sit; a Bruegel crowd swallows it whole.
 * `angle`    how far the player must twist, *after* the shape's rotational symmetry is
 *            taken into account. A snowflake stored at 41 degrees is really a snowflake
 *            at 11, because five other rotations look identical.
 *
 * Opacity is deliberately not a lever here. The same opacity shouts on a flat glaze and
 * disappears into brushwork, so it is an output of the ramp, not an input to it.
 */
export interface Rung {
  /** Suffix used in puzzle ids, e.g. `mona-wed`. */
  key: string;
  label: string;
  size: number;
  /**
   * What this day is for: how long the hunt is meant to take, in seconds.
   *
   * This is now the rung's authority, and `scan` is derived from it. It used to be the
   * other way round -- `scan` was the number and the time was whatever it happened to
   * buy -- which worked only as long as one scan reading meant the same hunt on every
   * canvas. It does not; see `CLUTTER_WEIGHT`.
   */
  seconds: number;
  /**
   * Target for `scan` on a canvas of reference busyness. Not the number the tuner aims
   * at: `scanForTime` shifts it by how much work the painting is to search and how dark
   * the paint is where the shape sits. Kept because it is the legible form of `seconds`
   * and what every already-tuned day in the set was solved against.
   */
  scan: number;
  /** Expected contrast at the match. Diagnostic now, not a target -- see above. */
  ratio: number;
  texture: number;
  angle: number;
  /**
   * Ceiling on how loud the shape may be with the *whole painting* on screen: the peak
   * luminance shift it imposes at the fitted view, as `npm run camouflage` reports it.
   *
   * `ratio` governs seeing the shape once you are on it; this governs picking it out
   * while scanning, and the two do not move together. A shape on smooth empty sky can
   * measure as low-contrast against its immediate surroundings and still be the one thing
   * on the canvas that catches the eye -- which is how a Tuesday on Rousseau's sky came
   * out twice as conspicuous as its own Monday.
   *
   * Advisory. `npm run camouflage` reports it and flags any day louder than the one
   * before, and the week sheets are what settle whether that matters. It is deliberately
   * not solved for: two attempts at enforcing it both produced materially worse games
   * than leaving it alone. Hand-picked ceilings dimmed nearly every day in the set,
   * Bruegel's Monday to a contrast of 1.96 with four days below 1.0. A relative rule --
   * never louder than yesterday -- chained instead, one loud Tuesday dragging the rest of
   * its week down to 0.68. The ramp a player actually feels is carried by contrast, size,
   * rotation and the texture of the hiding place, and those four solve cleanly.
   */
  scannable: number;
  /**
   * Monday is drawn at full opacity: no transparency at all, just a small shape in a
   * quiet corner of a big painting. Its `ratio` is therefore whatever full opacity
   * happens to buy, recorded rather than solved for.
   */
  opaque?: boolean;
  /**
   * How much this day wants to hide in the painting's own repetition -- foliage, waves,
   * roof tiles, a crowd, a scatter of small stars.
   *
   * Contrast asks "can you see it". This asks "which one is it": with company, half a
   * dozen specks look equally plausible and the only way to tell is to try them.
   *
   * Every day gets some, which was not the original design and should have been. Monday
   * gets the most of anyone. It is the one day with no transparency to hide behind, and a
   * lone opaque shape on empty sky is picked out instantly however carefully its colour
   * is matched to the paint -- no amount of contrast tuning touches that, because being
   * the only object of its kind in a clear sky is the thing that gives it away. Sunday
   * gets as much, for the opposite reason: by then it is the whole puzzle.
   *
   * Measured as similarity to the *surroundings* at two to five shape-widths out, never
   * as an overlap. A shape sitting on top of the thing it imitates is not hard, it is
   * unfindable; a shape sitting next to six of them is hard and still fair, because the
   * badge outlines itself the moment you frame the right one.
   *
   * It is grey-level similarity, and only within those few shape-widths, which leaves it
   * blind to a second kind of company: how much of the *whole canvas* is the colour the
   * shape is hiding in. That one is `MIN_PROMINENCE` in `palette.ts`, and it is a ladder
   * rather than a rung field because it constrains which day may take which hiding place
   * rather than what a day is worth. The day that prompted it scored respectably here and
   * terribly there -- well camouflaged against everything within a few shape-widths, and
   * the only thing of its colour on the canvas.
   */
  company: number;
  /**
   * The same day's target under the corrected fitted-view reading (`npm run camouflage
   * -- --fov`), which unlike `scan` can see how big the shape is on screen.
   *
   * Not the ramp's authority, and deliberately not what a normal tune solves for. The
   * rungs above and `expectedSearchMs` are both fitted against the default reading, and
   * the two scales are not interchangeable -- this one runs about 0.10 to 1.38 where that
   * one runs 0.34 to 0.50. Switching the set over wholesale means re-deriving every target
   * and refitting the age scale against real play data that does not exist yet.
   *
   * What it is for is rescuing individual days. The corrected reading measured the shipped
   * set at a rank correlation of only 0.588 with the old one, and named six days as far
   * more conspicuous than their rung's median while they measured perfectly on target --
   * jatte-mon at 3.4x. `--fov --solve` aims a day at this ladder instead: the measured
   * medians of the shipped set, smoothed to descend.
   *
   * **Treat it with suspicion.** It has been tested against real play exactly once, on the
   * pair of days the two instruments disagree about most, and it lost. starry-thu and
   * boating-thu carry the same `scan` target and the same predicted 140 seconds; this
   * reading calls boating-thu 4.1x harder to spot (0.094 against 0.383). Played back to
   * back they were indistinguishable. jatte-sun points the same way: this reading calls it
   * more conspicuous than a typical Sunday, and it took over a minute to find.
   *
   * The likeliest reading of that is the dull one -- for shapes this small, contrast
   * against nearby paint is what decides findability and area is second-order, so the
   * default measurement was already looking at the thing that matters. Do not re-derive
   * the set against this ladder on the strength of the arithmetic alone.
   */
  fovScan: number;
}

/** Index 0 is Monday, index 6 is Sunday. */
export const RAMP: Rung[] = [
  { key: 'mon', seconds: 45, label: 'Monday', size: 40, scan: 0.494, ratio: 3.2, texture: 9, angle: 12, scannable: 100, company: 1.6, fovScan: 0.42, opaque: true },
  { key: 'tue', seconds: 70, label: 'Tuesday', size: 37, scan: 0.458, ratio: 2.6, texture: 9, angle: 25, scannable: 85, company: 0.8, fovScan: 0.4 },
  { key: 'wed', seconds: 100, label: 'Wednesday', size: 34, scan: 0.429, ratio: 2.2, texture: 11, angle: 34, scannable: 72, company: 0.8, fovScan: 0.34 },
  { key: 'thu', seconds: 140, label: 'Thursday', size: 31, scan: 0.401, ratio: 1.9, texture: 13, angle: 46, scannable: 60, company: 0.9, fovScan: 0.3 },
  { key: 'fri', seconds: 180, label: 'Friday', size: 28, scan: 0.38, ratio: 1.6, texture: 16, angle: 70, scannable: 50, company: 1.0, fovScan: 0.26 },
  { key: 'sat', seconds: 230, label: 'Saturday', size: 25, scan: 0.36, ratio: 1.3, texture: 19, angle: 104, scannable: 42, company: 1.2, fovScan: 0.21 },
  { key: 'sun', seconds: 290, label: 'Sunday', size: 22, scan: 0.341, ratio: 1.05, texture: 22, angle: 148, scannable: 36, company: 1.6, fovScan: 0.18 },
];

export const DAYS_PER_WEEK = RAMP.length;

/**
 * The rotation the player actually has to undo, in degrees: the stored angle folded
 * into the shape's symmetry, then taken to the nearer side. A four-fold shape stored at
 * 100 degrees asks for 10 degrees of work, not 100.
 */
export function angleWork(angle: number, symmetry = 1): number {
  const period = 360 / symmetry;
  let a = ((angle % period) + period) % period;
  if (a > period / 2) a -= period;
  return Math.abs(a);
}

/**
 * What a canvas of average busyness looks like, and where the paint sits on the dark-to-
 * light scale at an average hiding place.
 *
 * The medians of the shipped rotation, so the correction below is zero-mean across the
 * set and adding it re-levels nothing: a day on a typical painting is asked for exactly
 * the scan it was asked for before. What moves is the two ends.
 *
 * Both are measured by `npm run busyness` and written into the puzzle files -- `clutter`
 * once per week, `dim` once per day. Neither is part of a day's `version`, so measuring
 * them hands nobody's finished board back.
 */
export const CANVAS_REFERENCE = { clutter: 0.606, dim: 0.624 } as const;

/**
 * The range the correction has ever been measured over. Readings are clamped to it
 * rather than extrapolated, because the fit below rests on seventeen days and the curve
 * it sits on is an exponential -- a canvas half a point past the end of the evidence
 * would be asked for a shape twice as loud as anything that has been looked at.
 */
export const CANVAS_RANGE = {
  clutter: [0.38, 0.78],
  dim: [0.1, 0.95],
} as const;

/**
 * How much longer a busy canvas takes, per unit of `clutter`, in log-seconds.
 *
 * **This is the term the ramp was missing.** `scan` is a local reading: the shift the
 * shape imposes over the paint immediately around it. It answers "how well is this shape
 * hidden where it sits" and it has nothing to say about "how many other places on this
 * canvas will the eye stop on before it gets there" -- and the second question is most of
 * the hunt. A shape among a thousand small brushstrokes is harder than the same shape,
 * measured identically, on a smooth glaze, and the old ramp made no allowance for it at
 * all. Worse, the tuner drove every canvas to the same reading, so the busy weeks came out
 * exactly as much harder as the painting happened to make them.
 *
 * Fitted on seventeen days with real recorded times, as the residual of
 * `expectedSearchMs` against `clutter` and `dim`: eleven shipped days from the daily
 * tally, six from play-test round `r1-weekend`. It moves the model's rank correlation
 * with observed time from -0.14 -- slightly worse than knowing nothing -- to 0.49.
 *
 * The number is large because the range is small and the effect is not: the rotation runs
 * 0.39 to 0.73, which this prices at a factor of about thirty in time-to-find. That is not
 * an overreach of the fit; it is roughly the spread the tally shows between the calmest
 * and busiest weeks in the set.
 *
 * **Provisional.** Seventeen days is enough to establish the sign, the rough size and the
 * fact that the old model had neither, and it is not enough to trust the third digit. It
 * is meant to be refitted as the tally grows. What it is *not* is optional -- reverting to
 * no term at all is reverting to a measure that does not predict the thing it is for.
 */
export const CLUTTER_WEIGHT = 10.34;

/**
 * How much longer a dark hiding place takes, per unit of `dim`, in log-seconds.
 *
 * The contrast readings the tuner solves against are absolute grey-level shifts, and a
 * shift of a given size is harder to pick out of dark paint than out of light. So a day
 * solved to the same reading on a night scene plays harder than the same day on a bright
 * one, and nothing in the ramp said so.
 *
 * Much the smaller of the two terms -- across the shipped set it is worth about 1.4x end
 * to end, against clutter's thirty -- and the weaker finding of the pair: it is the second
 * term in a three-parameter fit on seventeen points, so read it as "the sign is right and
 * the size is small" rather than as a measurement. Adding it took the fit's R-squared from
 * 0.25 to 0.48, which is why it is here rather than in the notes.
 */
export const DIMNESS_WEIGHT = 1.38;

/**
 * The least of the paint under a see-through day's shape that is covered by a flat layer
 * of the paint's own colour (`cover` on a `Target`).
 *
 * `screen` and `multiply` can only lighten or darken the paint, and with either one
 * opacity and fill trade for each other exactly -- a screened fill `f` at opacity `o`
 * lands at `a + o*f*(1-a)`, a function of `o*f` alone. So however a day was dialled, every
 * brushstroke ran straight through its shape, and on a canvas whose strokes are the size
 * of the shape it had no edge left to find. One such day played at a median of nine
 * minutes, and it was the first day in the rotation anyone gave up on. None of the local
 * readings -- scan, size-aware scan, a colour-only reading, a reading at scanning zoom --
 * separated it from the days either side, which found in under a minute; what separated
 * it was looking at it. A floor on raising opacity would not have helped: for the reason
 * above it only swaps opacity for fill.
 *
 * A cover flattens the strokes inside the shape a little, which is an edge. It is a
 * floor and not a knob: the blend above it is still solved to the day's rung, and where
 * the cover alone reads louder than the rung asked for, the day comes out easier than
 * asked, which is the right direction for a floor to err. Monday carries none -- it is
 * already opaque and hides on colour alone. See "Solid shapes" in README.md.
 */
export const COVER_FLOOR = 0.5;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

/**
 * How much longer this canvas and this spot make a hunt, in log-seconds, relative to a
 * day on the reference painting.
 *
 * Zero when both readings are at the reference, positive on a busier or darker one. It is
 * the single place the two corrections are combined, so the tuner (which solves a scan
 * target from a time) and `expectedSearchMs` (which reads a time back out of a scan) can
 * be exact inverses of each other rather than two drifting opinions.
 *
 * Missing readings mean the reference, so an un-measured week behaves exactly as it did
 * before this existed.
 */
export function canvasShift(clutter?: number, dim?: number): number {
  const c = clamp(clutter ?? CANVAS_REFERENCE.clutter, CANVAS_RANGE.clutter);
  const d = clamp(dim ?? CANVAS_REFERENCE.dim, CANVAS_RANGE.dim);
  return (
    CLUTTER_WEIGHT * (c - CANVAS_REFERENCE.clutter) + DIMNESS_WEIGHT * (d - CANVAS_REFERENCE.dim)
  );
}

/** Slope and intercept of the scan-to-time curve; see `expectedSearchMs` in age.ts. */
export const SCAN_CURVE = { intercept: 12.35, slope: 12.2, pivot: 0.36 } as const;

/**
 * The scan reading a day must be solved to, to take `seconds` on *this* painting at
 * *this* spot. The exact inverse of `expectedSearchMs`.
 *
 * This is what the tuner aims at. On a busy or dark canvas it asks for a louder shape
 * than the rung's headline number, because the canvas is already supplying the
 * difficulty the rung wanted -- which is the whole correction, stated the other way
 * round: a week of heavy paint does not need to be *made* harder.
 */
export function scanForTime(seconds: number, clutter?: number, dim?: number): number {
  const shift = canvasShift(clutter, dim);
  const raw =
    SCAN_CURVE.pivot +
    (SCAN_CURVE.intercept + shift - Math.log(seconds * 1000)) / SCAN_CURVE.slope;
  return Math.min(0.6, Math.max(0.3, raw));
}

/** The target for a rung on a given canvas: `scanForTime` with the rung's own clock. */
export function scanTarget(rung: Rung, clutter?: number, dim?: number): number {
  return scanForTime(rung.seconds, clutter, dim);
}
