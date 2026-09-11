import { describe, expect, it } from 'vitest';
import { NEAR_ANGLE_TOLERANCE_DEG, NEAR_SIZE_TOLERANCE, type MatchState } from './match';
import {
  compressTrace,
  crossing,
  finish,
  isTracker,
  newTracker,
  sample,
  TRACE_MAX,
  type Tracker,
} from './metrics';

const VIEW = { w: 400, h: 400 };
const TARGET = 80;

/** A match reading at the middle of the stage, with whatever errors the test wants. */
function look(over: Partial<MatchState> = {}): MatchState {
  const displaySize = over.displaySize ?? TARGET;
  return {
    displaySize,
    sizeError: displaySize / TARGET - 1,
    sizeOk: false,
    angleError: 0,
    angleOk: false,
    onScreen: true,
    near: false,
    screen: { x: 200, y: 200 },
    solved: false,
    ...over,
  };
}

/** Feed a sequence of (time, reading, scale) triples through the tracker. */
function run(steps: [number, MatchState, number?][], from: Tracker = newTracker()): Tracker {
  return steps.reduce((t, [at, m, scale]) => sample(t, at, m, scale ?? 1, VIEW, TARGET), from);
}

describe('the hot zone', () => {
  it('ignores the shape while the whole painting is on screen', () => {
    // At the fitted view the shape is a speck; being on screen is not being found.
    const t = run([[0, look({ displaySize: 8 })]]);
    expect(t.hot).toBe(false);
  });

  it('ignores a shape that is close up but off in a corner', () => {
    const t = run([[0, look({ screen: { x: 20, y: 20 } })]]);
    expect(t.hot).toBe(false);
  });

  it('takes hold once the shape is close up and central', () => {
    const t = run([[0, look()]]);
    expect(t.hot).toBe(true);
    expect(t.hotAt).toBe(0);
  });
});

describe('passes', () => {
  it('counts nothing for a run that finds the shape and stays on it', () => {
    const t = run([
      [0, look({ displaySize: 8 })],
      [1000, look()],
      [2000, look()],
    ]);
    expect(t.m.passes).toBe(0);
  });

  it('counts each time the shape is had and then lost again', () => {
    const t = run([
      [0, look()],
      [500, look({ displaySize: 8 })],
      [1000, look()],
      [1500, look({ onScreen: false })],
      [2000, look()],
    ]);
    expect(t.m.passes).toBe(2);
  });

  it('does not count moving a found shape away from the middle', () => {
    // Up beside the badge, to compare the two, is still working on it.
    const t = run([
      [0, look({ displaySize: 8 })],
      [1000, look()],
      [2000, look({ screen: { x: 200, y: 40 } })],
      [3000, look({ screen: { x: 200, y: 40 } })],
    ]);
    expect(t.hot).toBe(true);
    expect(t.m.passes).toBe(0);
  });
});

describe('framing away from the middle', () => {
  const top = { x: 200, y: 40 };
  /** The same run twice: sized and squared up in the middle, or up by the badge. */
  function framedAt(screen: { x: number; y: number }) {
    return finish(
      run([
        [0, look({ displaySize: 8 })],
        [20000, look({ screen, displaySize: TARGET * 0.7 })],
        [22000, look({ screen, displaySize: TARGET * 0.97, near: true })],
        [23000, look({ screen, displaySize: TARGET * 1.06, near: true })],
        [24000, look({ screen, displaySize: TARGET * 0.94, near: true })],
      ]),
      25000,
    );
  }

  it('enters the hot zone on the badge, wherever the shape is', () => {
    const t = run([[0, look({ screen: top, near: true })]]);
    expect(t.hot).toBe(true);
  });

  it('reads exactly like the same run framed in the middle', () => {
    const middle = framedAt({ x: 200, y: 200 });
    const byBadge = framedAt(top);
    expect(byBadge.adjustMs).toBeGreaterThan(0);
    expect(byBadge.overshoots).toBe(middle.overshoots);
    expect(byBadge.passes).toBe(middle.passes);
    // The middle is entered at the first close look, the badge a moment later; the
    // off-centre run is never read as having framed in no time at all.
    expect(byBadge.searchMs! - middle.searchMs!).toBeLessThanOrEqual(2000);
  });
});

describe('overshoots', () => {
  it('does not charge for sailing through the target from far out', () => {
    // Zooming from well under to well over crosses zero, but was never aiming.
    const t = run([
      [0, look({ displaySize: TARGET * 0.5 })],
      [500, look({ displaySize: TARGET * 1.5 })],
    ]);
    expect(t.m.overshoots).toBe(0);
  });

  it('charges for crossing the target from inside the warm band', () => {
    const t = run([
      [0, look({ displaySize: TARGET * 1.06 })],
      [500, look({ displaySize: TARGET * 0.94 })],
    ]);
    expect(t.m.overshoots).toBe(1);
  });

  it('charges for size and angle separately', () => {
    const t = run([
      [0, look({ displaySize: TARGET * 1.06, angleError: 8 })],
      [500, look({ displaySize: TARGET * 0.94, angleError: -8 })],
    ]);
    expect(t.m.overshoots).toBe(2);
  });

  it('ignores wobble while the shape is not even in front of the player', () => {
    const off = { screen: { x: 10, y: 10 } };
    const t = run([
      [0, look({ ...off, displaySize: TARGET * 1.06 })],
      [500, look({ ...off, displaySize: TARGET * 0.94 })],
    ]);
    expect(t.m.overshoots).toBe(0);
  });
});

describe('crossing', () => {
  it('forgets which side it was on once the error is far away', () => {
    expect(crossing(1, 5 * NEAR_SIZE_TOLERANCE, NEAR_SIZE_TOLERANCE)).toEqual([0, false]);
  });

  it('holds the side through the margin without calling it a miss', () => {
    const margin = NEAR_ANGLE_TOLERANCE_DEG * 1.5;
    expect(crossing(1, margin, NEAR_ANGLE_TOLERANCE_DEG)).toEqual([1, false]);
    expect(crossing(1, -margin, NEAR_ANGLE_TOLERANCE_DEG)).toEqual([1, false]);
  });

  it('calls it a miss only when the side changes inside the band', () => {
    expect(crossing(1, -1, NEAR_ANGLE_TOLERANCE_DEG)).toEqual([-1, true]);
    expect(crossing(-1, -1, NEAR_ANGLE_TOLERANCE_DEG)).toEqual([-1, false]);
    expect(crossing(0, -1, NEAR_ANGLE_TOLERANCE_DEG)).toEqual([-1, false]);
  });
});

describe('reversals', () => {
  it('counts zoom direction changes, not zoom steps', () => {
    const t = run([
      [0, look(), 1],
      [100, look(), 1.5],
      [200, look(), 2],
      [300, look(), 1.2],
      [400, look(), 1.8],
    ]);
    expect(t.m.reversals).toBe(2);
  });

  it('ignores jitter below the deadband', () => {
    const t = run([
      [0, look(), 1],
      [100, look(), 1.005],
      [200, look(), 0.995],
      [300, look(), 1.004],
    ]);
    expect(t.m.reversals).toBe(0);
  });
});

describe('idle time', () => {
  it('ignores ordinary gaps between moves', () => {
    const t = run([
      [0, look()],
      [400, look()],
      [900, look()],
    ]);
    expect(t.m.idleMs).toBe(0);
  });

  it('banks a gap where nothing happened at all', () => {
    const t = run([
      [0, look()],
      [9000, look()],
    ]);
    expect(t.m.idleMs).toBe(9000);
  });
});

describe('finish', () => {
  it('splits the run at the final approach', () => {
    const t = run([
      [0, look({ displaySize: 8 })],
      [30000, look()],
    ]);
    const m = finish(t, 42000);
    expect(m.searchMs).toBe(30000);
    expect(m.adjustMs).toBe(12000);
  });

  it('treats time after a lost-and-refound shape as more hunting', () => {
    const t = run([
      [0, look({ displaySize: 8 })],
      [5000, look()],
      [6000, look({ displaySize: 8 })],
      [50000, look()],
    ]);
    const m = finish(t, 52000);
    expect(m.searchMs).toBe(50000);
    expect(m.adjustMs).toBe(2000);
    expect(m.passes).toBe(1);
  });

  it('catches a long freeze that ran right up to the winning move', () => {
    const t = run([[0, look()]]);
    expect(finish(t, 20000).idleMs).toBe(20000);
  });

  it('never reports a negative half', () => {
    const m = finish(newTracker(), 5000);
    expect(m.searchMs).toBe(5000);
    expect(m.adjustMs).toBe(0);
  });
});

describe('isTracker', () => {
  it('accepts a fresh tracker and one that has been through storage', () => {
    const t = run([[0, look()]]);
    expect(isTracker(newTracker())).toBe(true);
    expect(isTracker(JSON.parse(JSON.stringify(t)))).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTracker(undefined)).toBe(false);
    expect(isTracker({})).toBe(false);
    expect(isTracker({ ...newTracker(), m: { passes: 1 } })).toBe(false);
  });
});

describe('the hunt trace', () => {
  const far = look({ displaySize: 8 });
  // In view and close, in the middle, without the badge lit.
  const inView = look({ displaySize: TARGET * 0.7 });
  // The badge amber, off to one side.
  const amber = look({ near: true, screen: { x: 60, y: 60 }, displaySize: TARGET * 0.97 });

  it('records each encounter in order, the closer of the two, then the find', () => {
    const t = run([
      [0, far],
      [5000, inView],
      [6000, far], // moved past it
      [12000, inView],
      [13000, far], // and again
      [20000, amber],
      [21500, far], // nearly
      [30000, inView],
      [31000, far], // moved past it
      [40000, amber],
      [41500, far], // nearly
      [50000, amber],
      [51500, inView], // nearly, still close
      [53000, amber],
    ]);
    expect(finish(t, 54000).trace).toBe('vvpvppf');
  });

  it('carries no time: a slow clean find and a fast one read the same', () => {
    const slow = finish(run([[0, far], [290000, amber]]), 300000);
    const fast = finish(run([[0, far], [4000, amber]]), 5000);
    expect(slow.trace).toBe('f');
    expect(fast.trace).toBe('f');
  });

  it('writes one mark for an encounter that lit the badge, not two', () => {
    const t = run([
      [0, far],
      [5000, inView],
      [6000, amber],
      [8000, far],
      [20000, amber],
    ]);
    expect(finish(t, 21000).trace).toBe('pf');
  });

  it('does not count the badge flickering while squaring up', () => {
    const t = run([
      [0, far],
      [3000, amber],
      [3300, inView],
      [3600, amber],
      [3900, inView],
      [4200, amber],
    ]);
    expect(finish(t, 5000).trace).toBe('f');
  });

  it('does not count slipping out of view and straight back', () => {
    const t = run([
      [0, far],
      [3000, inView],
      [3400, far],
      [3800, inView],
      [9000, amber],
    ]);
    expect(finish(t, 10000).trace).toBe('f');
  });

  it('ends a give-up with its own mark, counting what it last let go of', () => {
    expect(finish(run([[0, far]]), 5000, 'gaveUp').trace).toBe('g');
    const t = run([[0, far], [3000, amber], [3500, far]]);
    expect(finish(t, 3800, 'gaveUp').trace).toBe('pg');
  });

  it('keeps a long hunt to one line, every kind of event and the ending included', () => {
    const steps: [number, MatchState][] = [[0, far]];
    for (let i = 1; i <= 20; i++) steps.push([i * 10000, inView], [i * 10000 + 2000, far]);
    steps.push([300000, amber], [302000, far], [400000, amber]);
    const trace = finish(run(steps), 401000).trace ?? '';
    expect(trace.length).toBeLessThanOrEqual(TRACE_MAX);
    expect(trace).toContain('v');
    expect(trace).toContain('p');
    expect(trace.endsWith('f')).toBe(true);
  });

  it('holds only the event alphabet, never a place', () => {
    const t = run([
      [0, look({ screen: { x: 123, y: 321 }, displaySize: 8 })],
      [9000, amber],
      [9500, far],
    ]);
    expect(finish(t, 70000).trace).toMatch(/^[vpfg]+$/);
  });

  it('leaves a run banked before the trace existed without one', () => {
    const old = newTracker();
    delete old.m.trace;
    delete old.near;
    delete old.lostAt;
    delete old.leftAt;
    delete old.lit;
    expect(isTracker(old)).toBe(true);
    const t = run([[0, far], [30000, amber], [31500, far]], old);
    expect(finish(t, 40000).trace).toBeUndefined();
  });
});

describe('compressTrace', () => {
  it('shortens the longest run of one mark first', () => {
    expect(compressTrace('vvvvpvvf', 7)).toBe('vvvpvvf');
  });

  it('keeps every kind of event while it can', () => {
    expect(compressTrace('vpppppf', 5)).toBe('vpppf');
  });

  it('keeps the ending when it has to drop events outright', () => {
    expect(compressTrace('vpvpvf', 3)).toBe('pvf');
  });
});
