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
 * blended. Par on every one of them is `PAR_AGE`; each halving of a signal takes
 * `SPREAD` years off, each doubling puts the same back on.
 *
 * Normalising against the day matters more than any of the weights. Sunday's shape takes
 * minutes to find where Monday's takes seconds, so a raw clock would hand every player a
 * pensioner's age at the weekend and a teenager's on Monday, which says nothing about
 * them at all. Every expectation below is derived from the day's own difficulty rung.
 */

export const MIN_AGE = 10;
export const MAX_AGE = 85;

/** The age a player gets for doing exactly what the day is priced at. */
const PAR_AGE = 32;
/** Years added per doubling of a signal, and taken off per halving. */
const SPREAD = 13;

/**
 * How far from par a single signal is allowed to be read as, derived from the ends of
 * the age scale so that no signal can score outside it.
 *
 * The floor is the part that matters. A signal can legitimately come in at zero -- most
 * good runs have no idle time at all, and plenty have no near misses -- and a raw ratio
 * of zero takes the logarithm to minus infinity, which pulls the whole blend to the
 * floor on the strength of one signal being merely flawless. Three times better than
 * par is as good as anything needs to be.
 */
const RATIO_FLOOR = 2 ** ((MIN_AGE - PAR_AGE) / SPREAD);
const RATIO_CEILING = 2 ** ((MAX_AGE - PAR_AGE) / SPREAD);

/** Fractions of the whole, and they must stay fractions of the whole. */
const WEIGHTS = {
  search: 0.34,
  adjust: 0.26,
  passes: 0.16,
  dither: 0.14,
  idle: 0.1,
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

/** Everybody sails past it at least once; the harder days earn more forgiveness. */
function expectedPasses(dayOfWeek: number): number {
  return 0.8 + 0.35 * dayOfWeek;
}

/** Overshoots plus zoom reversals. More rotation to undo means more chances to miss. */
function expectedDither(work: number): number {
  return 3 + work / 30;
}

/** A run is allowed to be about a sixth pauses before it reads as hesitation. */
function expectedIdleMs(totalMs: number): number {
  return Math.max(4000, 0.15 * totalMs);
}

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
    ['idle', 'hesitation', metrics.idleMs, expectedIdleMs(ms)],
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
