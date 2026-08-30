import { describe, expect, it } from 'vitest';
import {
  estimateAge,
  expectedAdjustMs,
  expectedDither,
  expectedIdleMs,
  expectedPasses,
  expectedSearchMs,
  MAX_AGE,
  MIN_AGE,
  PAR_AGE,
} from './age';
import { dayIndex, puzzleForDay } from './daily';
import { angleWork, RAMP } from './difficulty';
import type { RunMetrics } from './metrics';
import { PUZZLES } from './puzzles';
import type { Puzzle } from './types';

/** A stand-in puzzle sitting exactly on the given rung of the week. */
function onRung(dayOfWeek: number): Puzzle {
  const rung = RAMP[dayOfWeek];
  return {
    ...PUZZLES[0],
    dayOfWeek,
    target: {
      ...PUZZLES[0].target,
      size: rung.size,
      angle: rung.angle,
      symmetry: 1,
      scan: rung.scan,
    },
  };
}

/** The run this day is priced at: every signal exactly on expectation. */
function parRun(puzzle: Puzzle): { ms: number; metrics: RunMetrics } {
  const rung = RAMP[puzzle.dayOfWeek];
  const work = angleWork(puzzle.target.angle, puzzle.target.symmetry);
  const searchMs = expectedSearchMs(puzzle.target.scan ?? rung.scan);
  const adjustMs = expectedAdjustMs(work);
  const ms = searchMs + adjustMs;
  return {
    ms,
    metrics: {
      searchMs,
      adjustMs,
      passes: expectedPasses(puzzle.dayOfWeek),
      overshoots: expectedDither(work),
      reversals: 0,
      idleMs: expectedIdleMs(ms),
    },
  };
}

/**
 * The seven people who played `mona-sat`, their real ages, and what they actually took.
 *
 * This is the only data the estimate has ever had that pairs a real age with a real run,
 * and it is worth more than every piece of reasoning above it. It replaced three groups
 * whose times were real but whose ages were assumed -- "a group of twenty-somethings" --
 * and which were, it turns out, what the estimate was quietly wrong about: fitted to
 * them, it read this set of testers as ten to fifteen years younger than they are, with
 * four separate players pinned at exactly fourteen.
 *
 * `insider` is on record and out of the fit. They already knew roughly where the shape
 * was, and a run against a remembered answer measures the memory.
 *
 * Nobody recorded how any of these were played, so the runs are bracketed: each one is
 * scored twice, once as clean play and once as ordinary, and the real age has to sit
 * near both. The bracket is about four years wide, which is narrower than the spread
 * between the two age groups, so it does not swamp what is being asserted.
 */
const OBSERVED = [
  { who: 'the forty-eight', age: 48, ms: 107000, insider: false },
  { who: 'the twenty-three', age: 23, ms: 5500, insider: false },
  { who: 'the twenty-five who took fourteen seconds', age: 25, ms: 14000, insider: false },
  { who: 'the twenty-nine', age: 29, ms: 12100, insider: false },
  { who: 'the nineteen', age: 19, ms: 12600, insider: false },
  { who: 'the twenty-five who took eight', age: 25, ms: 7700, insider: false },
  { who: 'the player who knew where it was', age: 49, ms: 27900, insider: true },
];

/** The day they all played: the Saturday of the first week. */
function observedPuzzle(): Puzzle {
  return puzzleForDay(dayIndex(new Date(2026, 7, 29)));
}

/**
 * The same run, actually played, rather than reduced to its clock.
 *
 * `style` is how the player handled the shape once the clock was running: `clean` is
 * nought or one of everything, which is what a good run really looks like, and `ordinary`
 * is a near miss and a few overshoots. The time is split the way the day is priced.
 */
function playedRun(puzzle: Puzzle, ms: number, style: 'clean' | 'ordinary'): RunMetrics {
  const rung = RAMP[puzzle.dayOfWeek];
  const search = expectedSearchMs(puzzle.target.scan ?? rung.scan);
  const searchShare =
    search /
    (search + expectedAdjustMs(angleWork(puzzle.target.angle, puzzle.target.symmetry)));
  const habits =
    style === 'clean'
      ? { passes: 0, overshoots: 1, reversals: 0, idleFrac: 0 }
      : { passes: 1, overshoots: 3, reversals: 1, idleFrac: 0.1 };
  return {
    searchMs: ms * searchShare,
    adjustMs: ms * (1 - searchShare),
    passes: habits.passes,
    overshoots: habits.overshoots,
    reversals: habits.reversals,
    idleMs: ms * habits.idleFrac,
  };
}

describe('against the people who have actually played it', () => {
  const puzzle = observedPuzzle();
  const fitted = OBSERVED.filter((o) => !o.insider);

  for (const { who, age, ms } of fitted) {
    for (const style of ['clean', 'ordinary'] as const) {
      it(`reads ${who} playing ${style} within eight years of their real age`, () => {
        // Ten, not two, and the width is the finding rather than a slack tolerance.
        // Six of these seven beat the day's price four-fold or more and then landed
        // within nine seconds of each other while being nineteen to twenty-nine years
        // old -- the nineteen took 12.6s and the twenty-nine took 12.1s. No function of
        // the clock can put ten years between those two, so the best any tuning can do
        // is split the difference and be about five years out on each. Pretending
        // otherwise is how this got its first, wrong tuning. What it must not do is be
        // wrong in the same direction for everybody, which is the next test.
        const { age: read } = estimateAge(puzzle, ms, playedRun(puzzle, ms, style));
        expect(Math.abs(read - age), `${read} vs ${age}`).toBeLessThanOrEqual(10);
      });
    }
  }

  it('is not systematically young or old across the whole group', () => {
    // The failure being guarded against is a whole set of testers reading a decade out
    // in one direction, which is what happened. Individual noise is allowed; a biased
    // mean is not.
    const errors = fitted.map(
      ({ age, ms }) => estimateAge(puzzle, ms, playedRun(puzzle, ms, 'ordinary')).age - age,
    );
    const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(Math.abs(mean), `mean error ${mean.toFixed(1)}`).toBeLessThan(3);
  });

  it('separates the slow player from the fast ones', () => {
    const slow = estimateAge(puzzle, 107000, playedRun(puzzle, 107000, 'ordinary')).age;
    for (const { ms } of fitted.filter((o) => o.ms < 20000)) {
      expect(slow).toBeGreaterThan(
        estimateAge(puzzle, ms, playedRun(puzzle, ms, 'ordinary')).age + 10,
      );
    }
  });

  it('reads a run against a remembered answer as younger than the player is', () => {
    // Not a defect. Knowing where the shape is skips the hunt, and the hunt is the
    // signal -- worth recording so a future retune does not try to fit this run.
    const insider = OBSERVED.find((o) => o.insider)!;
    const { age } = estimateAge(puzzle, insider.ms, playedRun(puzzle, insider.ms, 'ordinary'));
    expect(age).toBeLessThan(insider.age);
  });

  it('does not read a clean run years younger than its own clock', () => {
    // Three minutes of clean hunting used to come out fifteen years under its own
    // clock, because the habit signals do not scale with the clock and were carrying
    // two fifths of the blend. A few years is a discount for tidy play; fifteen is a
    // different scale.
    for (const ms of [15000, 30000, 60000, 130000, 240000]) {
      const clock = estimateAge(puzzle, ms).age;
      const played = estimateAge(puzzle, ms, playedRun(puzzle, ms, 'clean')).age;
      expect(clock - played, `${ms}ms`).toBeLessThanOrEqual(10);
      expect(played).toBeLessThan(clock + 4);
    }
  });

  it('still tells two runs of the same length apart', () => {
    // The habit signals are quieter than they were, not gone.
    const clean = estimateAge(puzzle, 60000, playedRun(puzzle, 60000, 'clean')).age;
    const ordinary = estimateAge(puzzle, 60000, playedRun(puzzle, 60000, 'ordinary')).age;
    expect(ordinary).toBeGreaterThan(clean + 1);
  });
});

describe('estimateAge', () => {
  it('gives par on every rung of the week to the run that rung is priced at', () => {
    for (let d = 0; d < RAMP.length; d++) {
      const puzzle = onRung(d);
      const { ms, metrics } = parRun(puzzle);
      expect(estimateAge(puzzle, ms, metrics).age, RAMP[d].label).toBe(PAR_AGE);
    }
  });

  it('is younger for a run that beats the day and older for one that does not', () => {
    const puzzle = onRung(3);
    const { ms, metrics } = parRun(puzzle);
    const halve = (n: number) => n / 2;
    const fast = estimateAge(puzzle, ms / 2, {
      ...metrics,
      searchMs: halve(metrics.searchMs!),
      adjustMs: halve(metrics.adjustMs!),
      passes: 0,
      overshoots: 0,
      idleMs: 0,
    }).age;
    const slow = estimateAge(puzzle, ms * 3, {
      ...metrics,
      searchMs: metrics.searchMs! * 3,
      adjustMs: metrics.adjustMs! * 3,
      passes: metrics.passes * 3,
      overshoots: metrics.overshoots * 3,
      idleMs: metrics.idleMs * 3,
    }).age;
    expect(fast).toBeLessThan(PAR_AGE);
    expect(slow).toBeGreaterThan(PAR_AGE);
  });

  it('reads the same clock differently on Monday and on Sunday', () => {
    // The whole point of normalising: two minutes is a bad Monday and a good Sunday.
    const monday = estimateAge(onRung(0), 120000).age;
    const sunday = estimateAge(onRung(6), 120000).age;
    expect(monday).toBeGreaterThan(sunday);
  });

  it('separates two runs of identical length that were played differently', () => {
    const puzzle = onRung(3);
    const { ms, metrics } = parRun(puzzle);
    // Spotted it late, then landed it in one clean move.
    const sharpEye = estimateAge(puzzle, ms, {
      ...metrics,
      searchMs: ms - 3000,
      adjustMs: 3000,
      passes: 0,
      overshoots: 0,
      reversals: 0,
    }).age;
    // Spotted it at once, then wobbled around the tolerance for the rest of the run.
    const shakyHand = estimateAge(puzzle, ms, {
      ...metrics,
      searchMs: 3000,
      adjustMs: ms - 3000,
      passes: 5,
      overshoots: 14,
      reversals: 8,
    }).age;
    expect(sharpEye).toBeLessThan(shakyHand);
  });

  it('stays inside the range whatever it is handed', () => {
    const puzzle = onRung(6);
    const perfect = estimateAge(puzzle, 1, {
      searchMs: 0,
      adjustMs: 0,
      passes: 0,
      overshoots: 0,
      reversals: 0,
      idleMs: 0,
    }).age;
    // Deliberately beyond anything a person could do. It does not quite reach the top of
    // the scale, and cannot: hesitation is measured against the run's own length, so a
    // run that is nothing but hesitation still only scores a few times par on it.
    const absurd = estimateAge(puzzle, 1e9, {
      searchMs: 9e8,
      adjustMs: 1e8,
      passes: 5000,
      overshoots: 20000,
      reversals: 20000,
      idleMs: 9e8,
    }).age;
    // A few years off the floor rather than on it: near misses and hesitation are both
    // softened, so neither can be taken all the way down by a flawless reading, and the
    // floor moved further from par when par did. The three signals that can reach it
    // are pinned. Reaching MIN_AGE exactly is not a thing a run needs to be able to do.
    expect(perfect).toBeGreaterThan(MIN_AGE);
    expect(perfect).toBeLessThan(MIN_AGE + 6);
    expect(absurd).toBeGreaterThan(80);
    expect(absurd).toBeLessThanOrEqual(MAX_AGE);
  });

  it('does not let one flawless signal drag a whole run to the floor', () => {
    // A zero is a real reading -- most good runs have no idle time at all -- and taking
    // its logarithm raw used to hand a strong Friday run an age of ten.
    const puzzle = onRung(4);
    const { ms, metrics } = parRun(puzzle);
    const age = estimateAge(puzzle, ms, { ...metrics, idleMs: 0 }).age;
    expect(age).toBeGreaterThan(PAR_AGE - 6);
    expect(age).toBeLessThan(PAR_AGE);
  });

  it('leaves the far end of the scale out of reach of an ordinarily bad run', () => {
    // An hour of flailing at a Sunday, which is about as bad as a real run gets. It
    // reads in the sixties rather than the eighties, because the spread fitted to real
    // players is tighter than the first guess at it: the observed population runs from
    // about thirteen to about forty-six, and the tail should not be ten times wider.
    const puzzle = onRung(6);
    const dreadful = estimateAge(puzzle, 4e6, {
      searchMs: 3.9e6,
      adjustMs: 1e5,
      passes: 90,
      overshoots: 400,
      reversals: 300,
      idleMs: 3e6,
    }).age;
    expect(dreadful).toBeGreaterThan(55);
    expect(dreadful).toBeLessThan(MAX_AGE);
  });

  it('prices every real day somewhere a person could actually land', () => {
    // The measured `scan` values in the set run from about 0.35 to 0.81, and the curve
    // is steep enough that the easy end wants clamping -- a par of one second is not a
    // par. Guards both ends against a future day walking off the fitted range.
    for (const puzzle of PUZZLES) {
      const expected = expectedSearchMs(puzzle.target.scan ?? RAMP[puzzle.dayOfWeek].scan);
      expect(expected, puzzle.id).toBeGreaterThan(10000);
      expect(expected, puzzle.id).toBeLessThan(6 * 60000);
    }
  });

  it('is a whole number for every puzzle in the set', () => {
    for (const puzzle of PUZZLES) {
      const { age } = estimateAge(puzzle, 45000);
      expect(Number.isInteger(age), puzzle.id).toBe(true);
      expect(age).toBeGreaterThanOrEqual(MIN_AGE);
      expect(age).toBeLessThanOrEqual(MAX_AGE);
    }
  });
});

describe('estimateAge without metrics', () => {
  it('falls back to the clock, and says so by offering no breakdown', () => {
    const puzzle = onRung(2);
    const { parts, age } = estimateAge(puzzle, 60000);
    expect(parts).toEqual([]);
    expect(age).toBeGreaterThanOrEqual(MIN_AGE);
  });

  it('does the same for a result stored before the age existed', () => {
    // Exactly the shape of a half-written or round-tripped blob.
    const puzzle = onRung(2);
    const partial = { passes: 2, overshoots: 1, reversals: 0, idleMs: 0 } as unknown as RunMetrics;
    expect(estimateAge(puzzle, 60000, partial).parts).toEqual([]);
    expect(estimateAge(puzzle, 60000, null).parts).toEqual([]);
  });
});

describe('the breakdown', () => {
  it('names every signal, and the weights account for the whole number', () => {
    const puzzle = onRung(4);
    const { parts } = estimateAge(puzzle, 60000, parRun(puzzle).metrics);
    expect(parts.map((p) => p.key)).toEqual([
      'search',
      'adjust',
      'passes',
      'dither',
      'idle',
    ]);
    expect(parts.reduce((sum, p) => sum + p.weight, 0)).toBeCloseTo(1);
  });

  it('marks the signal a run was actually good at', () => {
    const puzzle = onRung(4);
    const { metrics, ms } = parRun(puzzle);
    const { parts } = estimateAge(puzzle, ms, { ...metrics, passes: 0, overshoots: 0 });
    expect(parts.find((p) => p.key === 'passes')!.ratio).toBeLessThan(1);
    expect(parts.find((p) => p.key === 'search')!.ratio).toBeCloseTo(1);
  });
});
