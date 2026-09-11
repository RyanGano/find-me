import { describe, expect, it } from 'vitest';
import { giveUpAfterMs, hintAfterMs } from './age';
import { HINT_OFFSET, hintCircle } from './hint';
import { compressTrace, finish, hint, isRunMetrics, newTracker, tookHint, TRACE_MAX } from './metrics';
import { PUZZLES } from './puzzles';
import { buildShareText, huntTrace, traceKey } from './share';

describe('the hint circle', () => {
  for (const puzzle of PUZZLES) {
    it(`${puzzle.id} holds the whole shape, off centre`, () => {
      const c = hintCircle(puzzle);
      const d = Math.hypot(puzzle.target.cx - c.cx, puzzle.target.cy - c.cy);
      // The shape's box, corner to corner, is the most of it that could stick out.
      expect(d + (puzzle.target.size * Math.SQRT2) / 2).toBeLessThan(c.r);
      expect(d).toBeCloseTo(HINT_OFFSET * c.r, 6);
    });
  }

  it('is the same every time for a day, and differs between days', () => {
    const [a, b] = PUZZLES;
    expect(hintCircle(a)).toEqual(hintCircle(a));
    const angles = new Set(
      PUZZLES.map((p) => {
        const c = hintCircle(p);
        return Math.round(Math.atan2(c.cy - p.target.cy, c.cx - p.target.cx) * 10);
      }),
    );
    expect(angles.size).toBeGreaterThan(PUZZLES.length / 2);
    expect(hintCircle(a)).not.toEqual(hintCircle(b));
  });
});

describe('when the hint opens', () => {
  for (const puzzle of PUZZLES) {
    it(`${puzzle.id} offers the hint before the give-up`, () => {
      expect(hintAfterMs(puzzle)).toBeLessThan(giveUpAfterMs(puzzle));
      expect(hintAfterMs(puzzle)).toBeGreaterThanOrEqual(30_000);
      expect(hintAfterMs(puzzle)).toBeLessThanOrEqual(120_000);
    });
  }
});

describe('a hint in the trace', () => {
  it('lands where it was taken and survives to the share', () => {
    const run = finish(hint(newTracker(), 60_000), 90_000);
    expect(run.trace).toBe('hf');
    expect(tookHint(run)).toBe(true);
    expect(isRunMetrics(run)).toBe(true);
    expect(huntTrace(run)).toBe('💡🟩');
    expect(traceKey(run)).toContain('💡 took a hint');
    expect(buildShareText(1, PUZZLES[0], 90_000, 1, 30, run)).toContain('💡');
  });

  it('is never compressed away', () => {
    const long = 'h' + 'vp'.repeat(20) + 'f';
    const out = compressTrace(long);
    expect(out.length).toBeLessThanOrEqual(TRACE_MAX);
    expect(out).toContain('h');
    expect(out.endsWith('f')).toBe(true);
  });

  it('is only explained on a run that took one', () => {
    const plain = finish(newTracker(), 10_000);
    expect(tookHint(plain)).toBe(false);
    expect(traceKey(plain)).not.toContain('💡');
  });
});
