import { describe, expect, it } from 'vitest';
import { expectedSearchMs } from './age';
import {
  CANVAS_RANGE,
  CANVAS_REFERENCE,
  CLUTTER_WEIGHT,
  DIMNESS_WEIGHT,
  RAMP,
  canvasShift,
  scanForTime,
  scanTarget,
} from './difficulty';
import { PUZZLES } from './puzzles';
import { TESTBED_PUZZLES } from './testbed';

/**
 * The ramp's correction for how much work a painting is to search.
 *
 * The property that matters most here is that `scanForTime` and `expectedSearchMs` are
 * exact inverses. The tuner solves a day using the first and the age scores it using the
 * second, and if the two ever drift the game starts pricing a day differently from the
 * way it built it -- silently, and only visibly in a play-test months later.
 */
describe('the canvas correction', () => {
  it('does nothing at all on a canvas of reference busyness', () => {
    expect(canvasShift(CANVAS_REFERENCE.clutter, CANVAS_REFERENCE.dim)).toBeCloseTo(0, 10);
    for (const rung of RAMP) {
      expect(scanTarget(rung, CANVAS_REFERENCE.clutter, CANVAS_REFERENCE.dim), rung.key).toBeCloseTo(
        rung.scan,
        3,
      );
    }
  });

  it('treats an unmeasured week exactly as it did before the term existed', () => {
    expect(canvasShift(undefined, undefined)).toBe(0);
    for (const rung of RAMP) {
      expect(scanTarget(rung), rung.key).toBeCloseTo(rung.scan, 3);
    }
  });

  it('reads the same time back out of the scan it asked for', () => {
    // Everywhere the scan clamp is not biting. A very calm, very bright canvas can want a
    // Monday louder than the curve was ever fitted over; `scanForTime` clamps rather than
    // extrapolating, and a clamped day is honestly easier than its rung asked for. The
    // pairs below are the corners of the range plus the middle.
    let checked = 0;
    for (const rung of RAMP) {
      for (const clutter of [0.4, 0.55, CANVAS_REFERENCE.clutter, 0.7, 0.76]) {
        for (const dim of [0.15, 0.5, CANVAS_REFERENCE.dim, 0.9]) {
          const scan = scanForTime(rung.seconds, clutter, dim);
          if (scan <= 0.3 || scan >= 0.6) continue;
          expect(expectedSearchMs(scan, clutter, dim) / 1000, `${rung.key} ${clutter}/${dim}`)
            .toBeCloseTo(rung.seconds, 5);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('clamps a day it cannot reach rather than lying about it', () => {
    // The calmest, brightest canvas in the range, on the gentlest rung: the curve would
    // want a scan of about 0.27, which is off the end of what has ever been measured.
    const scan = scanForTime(RAMP[0].seconds, CANVAS_RANGE.clutter[0], CANVAS_RANGE.dim[0]);
    expect(scan).toBe(0.3);
    // And the day then comes out easier than the rung asked for, never harder.
    expect(expectedSearchMs(scan, CANVAS_RANGE.clutter[0], CANVAS_RANGE.dim[0]) / 1000)
      .toBeLessThan(RAMP[0].seconds);
  });

  it('asks a busy or dark canvas for a louder shape, not a quieter one', () => {
    const calm = scanTarget(RAMP[0], 0.42, 0.2);
    const busy = scanTarget(RAMP[0], 0.76, 0.2);
    const dark = scanTarget(RAMP[0], 0.42, 0.9);
    // A higher scan target is a shape that reads more strongly at the fitted view: the
    // canvas is already supplying difficulty, so the shape does not have to.
    expect(busy).toBeGreaterThan(calm);
    expect(dark).toBeGreaterThan(calm);
    // And busyness is the far larger of the two.
    expect(busy - calm).toBeGreaterThan((dark - calm) * 3);
  });

  it('clamps rather than extrapolates past the readings it was fitted on', () => {
    expect(canvasShift(0, 0.5)).toBe(canvasShift(CANVAS_RANGE.clutter[0], 0.5));
    expect(canvasShift(5, 0.5)).toBe(canvasShift(CANVAS_RANGE.clutter[1], 0.5));
    expect(canvasShift(0.6, -9)).toBe(canvasShift(0.6, CANVAS_RANGE.dim[0]));
    expect(canvasShift(0.6, 9)).toBe(canvasShift(0.6, CANVAS_RANGE.dim[1]));
  });

  it('keeps busyness the dominant term and dimness the small one', () => {
    // Fitted together on seventeen days of real play; the sizes are as much a finding as
    // the signs are, and a later refit that inverts them is a different claim about the
    // game rather than a tidier number.
    expect(CLUTTER_WEIGHT).toBeGreaterThan(DIMNESS_WEIGHT * 4);
    expect(DIMNESS_WEIGHT).toBeGreaterThan(0);
  });

  it('has a reading for every day and every week that ships', () => {
    for (const puzzle of [...PUZZLES, ...TESTBED_PUZZLES]) {
      expect(puzzle.clutter, `${puzzle.id} clutter`).toBeGreaterThan(CANVAS_RANGE.clutter[0]);
      expect(puzzle.clutter, `${puzzle.id} clutter`).toBeLessThan(CANVAS_RANGE.clutter[1]);
      expect(puzzle.target.dim, `${puzzle.id} dim`).toBeGreaterThan(0);
      expect(puzzle.target.dim, `${puzzle.id} dim`).toBeLessThan(1);
    }
  });

  it('keeps the readings out of the fingerprint, so measuring hands nobody a day back', () => {
    // `dim` and `clutter` describe the painting, not the challenge. If either ever
    // reached `fingerprint` in build.ts, re-measuring a week would take every recorded
    // result on it back off the player who set it.
    const day = PUZZLES[0];
    const moved = { ...day, clutter: 0.99, target: { ...day.target, dim: 0.01 } };
    expect(moved.version).toBe(day.version);
  });
});
