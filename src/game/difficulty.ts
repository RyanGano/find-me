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
 *            This is the lever that decides whether a puzzle is actually hard, and an
 *            earlier version of this ramp had it backwards. It opened Monday at 64px --
 *            half again the size of anything the game had used before -- reasoning that a
 *            big shape makes a gentle day. It makes an instant one: at the fitted view a
 *            64px shape is a 20px object on screen and the eye lands on it unprompted,
 *            whatever its colour is doing. Contrast cannot rescue a shape that big.
 * `scan`     **the one that decides how long a day takes**, and what opacity is now
 *            solved for. The shape's luminance shift with the whole painting on screen,
 *            divided by the texture of the paint immediately around it, and then by the
 *            canvas's own `search` cost -- how much ground there is to cover and how much
 *            of it looks like something (see rate-painting.mjs).
 *
 *            All three parts are needed, and each was learned by being wrong. Raw peak
 *            brightness said Rousseau's smooth sky and Bruegel's crowd were comparable
 *            when one was a beacon. Dividing by local texture fixed that within a
 *            painting but not across them: Rousseau at 0.45 cost 16 seconds while the
 *            Mona Lisa at 0.53 cost nearly four minutes, because a small plain canvas has
 *            far fewer places to look. Dividing by search cost lines them up -- Bruegel's
 *            Monday at 0.56 and Rousseau's Sunday at 0.52 both took about twenty seconds.
 *
 *            The scale is steep and the numbers are close together: 0.56 is twenty
 *            seconds and 0.36 is nearly four minutes. Small changes here are large
 *            changes in play.
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
  /** Target for `scan`, normalised by the painting's search cost. Solved for. */
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
   */
  company: number;
}

/** Index 0 is Monday, index 6 is Sunday. */
export const RAMP: Rung[] = [
  { key: 'mon', label: 'Monday', size: 40, scan: 0.52, ratio: 3.2, texture: 9, angle: 12, scannable: 100, company: 1.6, opaque: true },
  { key: 'tue', label: 'Tuesday', size: 37, scan: 0.43, ratio: 2.6, texture: 9, angle: 25, scannable: 85, company: 0.8 },
  { key: 'wed', label: 'Wednesday', size: 34, scan: 0.385, ratio: 2.2, texture: 11, angle: 34, scannable: 72, company: 0.8 },
  { key: 'thu', label: 'Thursday', size: 31, scan: 0.36, ratio: 1.9, texture: 13, angle: 46, scannable: 60, company: 0.9 },
  { key: 'fri', label: 'Friday', size: 28, scan: 0.345, ratio: 1.6, texture: 16, angle: 70, scannable: 50, company: 1.0 },
  { key: 'sat', label: 'Saturday', size: 25, scan: 0.33, ratio: 1.3, texture: 19, angle: 104, scannable: 42, company: 1.2 },
  { key: 'sun', label: 'Sunday', size: 22, scan: 0.31, ratio: 1.05, texture: 22, angle: 148, scannable: 36, company: 1.6 },
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
