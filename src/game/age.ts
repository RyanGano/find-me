import { angleWork, RAMP } from './difficulty';
import type { RunMetrics } from './metrics';
import type { Puzzle } from './types';

/**
 * "Your Find Me Age" -- the Wii Fit trick, applied to a search puzzle.
 *
 * The number is not a claim about the player, and it is not meant to be one. It is the
 * run scored against what the day is worth: how long the hunt took, how cleanly the
 * final approach went, how often the shape slipped past, how much the view dithered,
 * how long the player sat frozen. Five signals, each turned into an age of its own, then
 * blended -- three quarters of it the clock, the rest how the run was played. Par on
 * every one of them is `PAR_AGE`; each halving of a signal takes `SPREAD` years off,
 * each doubling puts the same back on.
 *
 * Normalising against the day matters more than any of the weights. Sunday's shape takes
 * minutes to find where Monday's takes seconds, so a raw clock would hand every player a
 * pensioner's age at the weekend and a teenager's on Monday, which says nothing about
 * them at all. Every expectation below is derived from the day's own difficulty rung.
 */

export const MIN_AGE = 10;
export const MAX_AGE = 85;

/**
 * The age a player gets for doing exactly what the day is priced at, and the years
 * added per doubling of a signal.
 *
 * These two set where the whole scale sits, and they are the only numbers here fitted to
 * real people rather than reasoned about. They are now fitted to the only data that has
 * ever paired a real age with a real run: seven players on `mona-sat`, ages nineteen to
 * forty-nine, times from five and a half seconds to a hundred and seven. An eighth run
 * is on record and excluded -- its player already knew roughly where the shape was, and
 * a run against a remembered answer is not a run.
 *
 * `SPREAD` is the solid half of the fit and the more interesting one. Those seven real
 * ages span thirty years while their times span twenty-fold, which is a bit over four
 * doublings: if the clock explained age perfectly, a doubling could be worth no more
 * than about seven years. It was 9.5, and before that 13, both reasoned from groups
 * whose ages were assumed rather than asked. That is the whole reason the estimate ran
 * young at the bottom -- a fast run was being paid out at nearly ten years a doubling
 * against a population that is only worth seven, so five seconds on a hard day bought a
 * teenager's age no matter who was holding the phone.
 *
 * `PAR_AGE` is the softer half, because it depends on the day being priced correctly and
 * `mona-sat` was not: it is a Saturday whose measured `scan` came out at 0.497 against a
 * rung asking for 0.33, so it played several times easier than it was priced, and six of
 * the seven beat the price by four-fold or more. Least squares puts par at 40 on this
 * day; on a day that actually met its rung it would sit lower. Forty is what the only
 * real data says, and it is deliberately a little under the fit -- see `age.test.ts`,
 * which holds all seven runs, and the note there about which way the next group is
 * likely to pull it.
 */
export const PAR_AGE = 40;
export const SPREAD = 7;

/**
 * How far from par a single signal is allowed to be read as, derived from the ends of
 * the age scale so that no signal can score outside it.
 *
 * The floor is the part that matters. A signal can legitimately come in at zero -- most
 * good runs have no idle time at all, and plenty have no near misses -- and a raw ratio
 * of zero takes the logarithm to minus infinity, which pulls the whole blend to the
 * floor on the strength of one signal being merely flawless. Four times better than
 * par is as good as anything needs to be.
 */
const RATIO_FLOOR = 2 ** ((MIN_AGE - PAR_AGE) / SPREAD);
const RATIO_CEILING = 2 ** ((MAX_AGE - PAR_AGE) / SPREAD);

/**
 * Fractions of the whole, and they must stay fractions of the whole.
 *
 * Three quarters of the blend is the clock, and that split is the second thing here
 * fitted to real people rather than reasoned about. It was an even 60/40 to begin with,
 * on the reasoning that how a run was played says as much as how long it took. It does
 * not, because the three habit signals do not scale with the clock: a player who hunts
 * for three minutes and then lands the shape in one clean move still shows nought near
 * misses, nought dither and nought dead air, exactly like a player who did the same in
 * twenty seconds. Carrying two fifths of the blend between them, they dragged every run
 * back towards par and then under it -- a second, wider group of testers came back with
 * forty-somethings reading in the twenties and twenty-somethings all pinned around
 * fourteen whatever they did. Three minutes of clean play came out fifteen years under
 * its own clock; it is now within a few.
 *
 * They are a modifier on how a run was played, not a co-equal vote against the clock.
 * At a quarter of the blend they are still worth several years either way, which is
 * enough to tell the sharp eye from the shaky hand and not enough to overrule the hunt.
 */
const WEIGHTS = {
  search: 0.46,
  adjust: 0.3,
  passes: 0.1,
  dither: 0.08,
  idle: 0.06,
};

export interface AgePart {
  key: keyof typeof WEIGHTS;
  label: string;
  /** The age this signal alone would give. */
  age: number;
  weight: number;
  /**
   * Observed over expected, as the blend saw it: 1 is par, and it is held inside
   * `RATIO_FLOOR`..`RATIO_CEILING` so what is shown is what was scored.
   */
  ratio: number;
}

export interface AgeEstimate {
  age: number;
  /** Empty when the run predates metrics and the age came from the clock alone. */
  parts: AgePart[];
}

/**
 * How long the day's shape should take to find, in ms.
 *
 * Fitted to the two anchors the difficulty ramp records from real play: a `scan` of 0.56
 * costs about twenty seconds, and 0.36 costs nearly four minutes. The scale is steep --
 * see `difficulty.ts` -- which is exactly why it has to be applied rather than ignored.
 */
export function expectedSearchMs(scan: number): number {
  // Clamped well inside the ramp's own range: the curve is steep enough that
  // extrapolating past the days that were actually played gives silly numbers.
  const s = Math.min(0.6, Math.max(0.3, scan));
  return Math.exp(12.35 - 12.2 * (s - 0.36));
}

/**
 * How long sizing and squaring up should take, in ms: a fixed cost for getting the zoom
 * onto a 4% window, plus the rotation the day actually asks for.
 */
export function expectedAdjustMs(work: number): number {
  return 6000 + 45 * work;
}

/**
 * Everybody sails past it at least once; the harder days earn more forgiveness. Priced
 * for what a real run shows rather than what a generous one would: this and the two
 * expectations below all sat high enough that ordinary play scored under par on every
 * one of them at once, which is a systematic discount rather than a compliment.
 */
export function expectedPasses(dayOfWeek: number): number {
  return 0.5 + 0.3 * dayOfWeek;
}

/** Overshoots plus zoom reversals. More rotation to undo means more chances to miss. */
export function expectedDither(work: number): number {
  return 2 + work / 40;
}

/** A run is allowed to be about a twelfth pauses before it reads as hesitation. */
export function expectedIdleMs(totalMs: number): number {
  return Math.max(3000, 0.08 * totalMs);
}

/**
 * The softening on hesitation, as a fraction of what the day expects rather than a fixed
 * number of ms: a run with no dead air in it at all is a good run, not an infinitely good
 * one, and a bare zero otherwise takes the logarithm to the floor on the strength of one
 * signal. Half the expectation puts a flawless reading at a third of par however long the
 * run was -- an absolute softening would have quietly punished the slow players it was
 * meant to protect, since their expected idle grows with the clock and a fixed few
 * seconds of grace shrinks against it.
 */
const IDLE_SOFTENING = 0.5;

/** Observed over expected, held inside the range the scale can express. */
function ratioOf(observed: number, expected: number): number {
  const ratio = observed / expected;
  if (!Number.isFinite(ratio)) return 1;
  return Math.min(RATIO_CEILING, Math.max(RATIO_FLOOR, ratio));
}

/** Par at 1, and `SPREAD` years for every doubling either way. */
function score(ratio: number): number {
  return PAR_AGE + SPREAD * Math.log2(ratio);
}

function clampAge(age: number): number {
  if (!Number.isFinite(age)) return PAR_AGE;
  return Math.round(Math.min(MAX_AGE, Math.max(MIN_AGE, age)));
}

/**
 * The full estimate, including what drove it. `metrics` is absent for results recorded
 * before any of this existed and for a run whose collector was lost; those fall back to
 * the clock against the day's total expected cost, which is the honest thing the old
 * data can still support.
 */
export function estimateAge(
  puzzle: Puzzle,
  ms: number,
  metrics?: RunMetrics | null,
): AgeEstimate {
  const rung = RAMP[puzzle.dayOfWeek] ?? RAMP[0];
  const scan = puzzle.target.scan ?? rung.scan;
  const work = angleWork(puzzle.target.angle, puzzle.target.symmetry);
  const search = expectedSearchMs(scan);
  const adjust = expectedAdjustMs(work);

  // Anything short of a finished, well-formed collection falls back to the clock: the
  // stored blob has been through a JSON round trip and a browser we do not control.
  if (
    !metrics ||
    typeof metrics.searchMs !== 'number' ||
    typeof metrics.adjustMs !== 'number' ||
    !Number.isFinite(metrics.searchMs) ||
    !Number.isFinite(metrics.adjustMs)
  ) {
    return { age: clampAge(score(ratioOf(ms, search + adjust))), parts: [] };
  }

  // Counts carry a +1 on both sides: one stray near miss on a day priced at none should
  // not read as infinitely worse than none, and the softening belongs in the ratio the
  // breakdown shows as much as in the ratio the blend uses.
  const raw: [AgePart['key'], string, number, number][] = [
    ['search', 'finding it', metrics.searchMs, search],
    ['adjust', 'framing it', metrics.adjustMs, adjust],
    ['passes', 'near misses', metrics.passes + 1, expectedPasses(puzzle.dayOfWeek) + 1],
    [
      'dither',
      'steadiness',
      metrics.overshoots + metrics.reversals + 1,
      expectedDither(work) + 1,
    ],
    [
      'idle',
      'hesitation',
      metrics.idleMs + IDLE_SOFTENING * expectedIdleMs(ms),
      (1 + IDLE_SOFTENING) * expectedIdleMs(ms),
    ],
  ];

  const parts: AgePart[] = raw.map(([key, label, observed, expected]) => {
    const ratio = ratioOf(Math.max(0, observed), expected);
    return { key, label, weight: WEIGHTS[key], ratio, age: clampAge(score(ratio)) };
  });

  // Blend the raw scores rather than the per-signal ages, which have been rounded to
  // whole years for display.
  const blended = parts.reduce((sum, p) => sum + score(p.ratio) * p.weight, 0);

  return { age: clampAge(blended), parts };
}
