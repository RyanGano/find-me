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
  SPREAD,
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
 * Every run anyone has recorded a real age against: seven on `mona-sun`, seven on
 * `wave-mon`, six of those with the full metrics behind them.
 *
 * `read` is the number that player was actually shown and `par`/`spread` is the scale it
 * was shown on, which is not the same for every row: the card derives the age rather than
 * storing it, so the six runs that came back with metrics were pasted after par had
 * already moved to 37, while the rest were written down earlier. Where `metrics` is
 * present the run can simply be replayed through `estimateAge`, which is exact. Where it is absent, `read` and the `par`/`spread` it was read on are enough
 * to recover roughly what the run was worth -- a reading is `PAR_AGE + SPREAD * L`, so
 * `L = (read - par) / spread`. That recovery is approximate now in a way it was not
 * before: the framing signal has since been re-priced and softened, so an old reading
 * maps to a slightly different `L` than the same run would produce today. It is kept
 * because two runs have nothing better, and it is not what the fit leans on.
 *
 * `pinned` marks runs whose clock signal was flat against the floor of the scale they
 * were read on. `mona-sun` measured a `scan` of 0.471 against a rung asking for 0.31, so
 * it played five to ten times easier than it was priced, and five of its seven runs came
 * back as the same number regardless of how they went. Their `L` is a bound, not a
 * value; they are kept as the record of a mis-priced day and left out of the fit.
 *
 * `insider` already knew roughly where the shape was. A run against a remembered answer
 * measures the memory.
 */
const OBSERVED = [
  { day: 'mona-sun', par: 30, spread: 9.5, age: 48, ms: 107000, read: 32 },
  { day: 'mona-sun', par: 30, spread: 9.5, age: 49, ms: 27900, read: 25, insider: true },
  { day: 'mona-sun', par: 30, spread: 9.5, age: 23, ms: 5500, read: 14, pinned: true },
  { day: 'mona-sun', par: 30, spread: 9.5, age: 25, ms: 14000, read: 14, pinned: true },
  { day: 'mona-sun', par: 30, spread: 9.5, age: 29, ms: 12100, read: 14, pinned: true },
  { day: 'mona-sun', par: 30, spread: 9.5, age: 19, ms: 12600, read: 18, pinned: true },
  { day: 'mona-sun', par: 30, spread: 9.5, age: 25, ms: 7700, read: 14, pinned: true },
  { day: 'wave-mon', par: 40, spread: 7, age: 25, ms: 30800, read: 35 },
  {
    day: 'wave-mon', par: 37, spread: 7, age: 48, ms: 8600, read: 25,
    metrics: { searchMs: 8600, adjustMs: 0, passes: 0, overshoots: 0, reversals: 0, idleMs: 0 },
  },
  {
    day: 'wave-mon', par: 37, spread: 7, age: 19, ms: 25400, read: 32,
    metrics: { searchMs: 25400, adjustMs: 0, passes: 0, overshoots: 0, reversals: 8, idleMs: 0 },
  },
  {
    day: 'wave-mon', par: 37, spread: 7, age: 23, ms: 15000, read: 29,
    metrics: { searchMs: 14500, adjustMs: 400, passes: 0, overshoots: 0, reversals: 4, idleMs: 0 },
  },
  {
    day: 'wave-mon', par: 37, spread: 7, age: 29, ms: 12900, read: 35,
    metrics: { searchMs: 6200, adjustMs: 6700, passes: 1, overshoots: 14, reversals: 14, idleMs: 0 },
  },
  {
    day: 'wave-mon', par: 37, spread: 7, age: 25, ms: 24500, read: 33,
    metrics: { searchMs: 23700, adjustMs: 800, passes: 0, overshoots: 1, reversals: 4, idleMs: 0 },
  },
  {
    day: 'wave-mon', par: 37, spread: 7, age: 49, ms: 69900, read: 44,
    metrics: { searchMs: 66400, adjustMs: 3500, passes: 1, overshoots: 0, reversals: 8, idleMs: 9400 },
  },
] as const;

type Observed = (typeof OBSERVED)[number];

/**
 * The `scan` each of those days carried *when these runs were played*.
 *
 * These are real people, and their runs are the only real data the age scale has. Pricing
 * them against a later, harder version of the same day misreads every one of them. When
 * the ramp stopped scaling its targets by search cost, wave-mon went from a twelve-second
 * day to a fifty-second one, and the 8.6s run below went from 1.4x par to 6x par -- the
 * whole set read 6.8 years young, and the bias guard caught it.
 *
 * That is a fixture bug, not a change in what a player is told: on a harder day a real
 * player also takes longer, the ratio barely moves, and so does the age. But the fixture
 * has to hold the puzzle as it actually was, or every future change to the ramp silently
 * invalidates the calibration set. Pin it here, and add a line whenever new runs are
 * recorded.
 */
const PLAYED_AT: Record<string, number> = {
  'mona-sun': 0.465,
  'wave-mon': 0.801,
};

function asPlayed(id: string, puzzle: Puzzle): Puzzle {
  return { ...puzzle, target: { ...puzzle.target, scan: PLAYED_AT[id] } };
}

const DAYS: Record<string, Puzzle> = {
  'mona-sun': asPlayed('mona-sun', puzzleForDay(dayIndex(new Date(2026, 7, 30)))),
  'wave-mon': asPlayed('wave-mon', puzzleForDay(dayIndex(new Date(2026, 7, 31)))),
};

/** What the scale as it stands now tells that player: replayed where it can be. */
function readsAs(o: Observed): number {
  if ('metrics' in o) return estimateAge(DAYS[o.day], o.ms, o.metrics as RunMetrics).age;
  return Math.round(PAR_AGE + SPREAD * ((o.read - o.par) / o.spread));
}

const FITTED = OBSERVED.filter((o) => !('insider' in o) && !('pinned' in o));
const REPLAYABLE = OBSERVED.filter((o) => 'metrics' in o);

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
  it('does not read a whole group of players years out in one direction', () => {
    // The only thing this data can hold the estimate to, and the only thing it has ever
    // got badly wrong. Both earlier tunings failed here: the first read this set eight
    // years young, the second three years old.
    const bias = FITTED.reduce((sum, o) => sum + (readsAs(o) - o.age), 0) / FITTED.length;
    expect(Math.abs(bias), `bias ${bias.toFixed(1)} years`).toBeLessThan(2);
  });

  it('keeps every real player inside a believable band', () => {
    // Deliberately loose, and it has to be. A forty-eight year old set the fastest and
    // cleanest run of the whole set and a nineteen year old was among the slowest; no
    // tuning of par and spread gets the mean error on this data under about nine and a
    // half years. This guards against a reading nobody would recognise as themselves,
    // not against being wrong about any one person.
    for (const o of FITTED) {
      const read = readsAs(o);
      const label = `${o.day}: real ${o.age}, read ${read}`;
      expect(read, label).toBeGreaterThanOrEqual(15);
      expect(read, label).toBeLessThanOrEqual(60);
    }
  });

  it('still moves enough to be worth playing for', () => {
    // Least squares on this set asks for a spread near five, which would put the whole
    // population inside about fifteen years and make the number nearly a constant. The
    // fastest and slowest runs on record are seven-fold apart in time; what they are
    // told should stay at least fifteen years apart. Least squares would collapse that
    // to about twelve, which is a number that has stopped saying anything.
    const reads = FITTED.map(readsAs);
    expect(Math.max(...reads) - Math.min(...reads)).toBeGreaterThanOrEqual(15);
  });

  it('records a mis-priced day rather than fitting to it', () => {
    // mona-sun was priced at seventy-two seconds and solved in five and a half. Five of
    // its seven runs pinned the clock at the floor of the scale, which is why four
    // players of three different ages were all handed the same number.
    const pinned = OBSERVED.filter((o) => 'pinned' in o);
    expect(pinned).toHaveLength(5);
    const sameNumber = pinned.filter((o) => o.read === 14);
    expect(sameNumber).toHaveLength(4);
    expect(new Set(sameNumber.map((o) => o.age)).size).toBe(3);
    expect(FITTED.filter((o) => o.day === 'mona-sun')).toHaveLength(1);
  });

  it('reads a run against a remembered answer as younger than the player is', () => {
    // Not a defect. Knowing where the shape is skips the hunt, and the hunt is the
    // signal -- recorded so a future retune does not try to fit this run either.
    const insider = OBSERVED.find((o) => 'insider' in o)!;
    expect(readsAs(insider)).toBeLessThan(insider.age);
  });

  it('leaves no real run with a signal flat against the floor', () => {
    // What the framing signal used to do. Three of these six framed the shape in under
    // half a second -- they tripped the hot zone and the solve in the same frame -- and
    // that pinned thirty per cent of the blend to the bottom of the scale for them, on a
    // Monday that asks for twelve degrees of rotation. A signal that reads the same for
    // "instant" as it would for "impossibly good" is not measuring anything.
    for (const o of REPLAYABLE) {
      const { parts } = estimateAge(DAYS[o.day], o.ms, o.metrics as RunMetrics);
      for (const part of parts) {
        expect(part.age, `real ${o.age}: ${part.key} at ${part.age}`).toBeGreaterThan(
          MIN_AGE,
        );
      }
    }
  });

  it('replays every recorded run to within a couple of years of what it was told', () => {
    // The six runs came back reading 25, 32, 29, 35, 33 and 44. Re-pricing the framing
    // signal and dropping par to match was meant to fix what the estimate is made of
    // without yanking anybody's number around; nobody should move by more than two years.
    for (const o of REPLAYABLE) {
      expect(Math.abs(readsAs(o) - o.read), `real ${o.age}`).toBeLessThanOrEqual(2);
    }
  });
});

describe('a run that was played, not just timed', () => {
  const puzzle = DAYS['wave-mon'];

  it('does not read a clean run years younger than its own clock', () => {
    // Three minutes of clean hunting used to come out fifteen years under its own clock,
    // because the habit signals do not scale with the clock and were carrying two fifths
    // of the blend. A few years is a discount for tidy play; fifteen is a different
    // scale.
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
