import { describe, expect, it } from 'vitest';
import {
  apply,
  compose,
  fitTransform,
  constrainPan,
  gestureFromPointerPair,
  invert,
  wrapAngle,
} from './transform';
import type { Transform, Vec } from './types';

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;

function expectVec(actual: Vec, expected: Vec, tol = 1e-6) {
  expect(close(actual.x, expected.x, tol), `x: ${actual.x} vs ${expected.x}`).toBe(true);
  expect(close(actual.y, expected.y, tol), `y: ${actual.y} vs ${expected.y}`).toBe(true);
}

const T: Transform = { x: 40, y: -25, scale: 1.7, rot: 0.6 };

describe('apply / invert', () => {
  it('round-trips a point', () => {
    const p = { x: 123, y: -456 };
    expectVec(invert(T, apply(T, p)), p);
  });

  it('places the image origin at the translation', () => {
    expectVec(apply(T, { x: 0, y: 0 }), { x: T.x, y: T.y });
  });
});

describe('compose', () => {
  it('holds the pivot point fixed while zooming', () => {
    const pivot = { x: 200, y: 150 };
    const imageAtPivot = invert(T, pivot);
    const next = compose(T, { scaleBy: 2.5, pivot });
    expectVec(apply(next, imageAtPivot), pivot);
    expect(next.scale).toBeCloseTo(T.scale * 2.5);
  });

  it('holds the pivot point fixed while rotating', () => {
    const pivot = { x: -30, y: 90 };
    const imageAtPivot = invert(T, pivot);
    const next = compose(T, { rotBy: 1.1, pivot });
    expectVec(apply(next, imageAtPivot), pivot);
    expect(next.rot).toBeCloseTo(T.rot + 1.1);
  });

  it('translates by the pan vector', () => {
    const next = compose(T, { pan: { x: 12, y: -7 } });
    expect(next.x).toBeCloseTo(T.x + 12);
    expect(next.y).toBeCloseTo(T.y - 7);
    expect(next.scale).toBe(T.scale);
  });

  it('clamps scale and damps the pivot motion to match', () => {
    const pivot = { x: 100, y: 100 };
    const limits = { min: 0.5, max: 2 };
    const next = compose(T, { scaleBy: 10, pivot }, limits);
    expect(next.scale).toBeCloseTo(2);
    // The pivot must still be honoured at the clamped scale, or the image drifts.
    const imageAtPivot = invert(T, pivot);
    expectVec(apply(next, imageAtPivot), pivot);
  });

  it('respects the minimum scale', () => {
    const next = compose(T, { scaleBy: 0.001, pivot: { x: 0, y: 0 } }, { min: 0.5, max: 2 });
    expect(next.scale).toBeCloseTo(0.5);
  });
});

describe('fitTransform', () => {
  it('centres a wide image in a square viewport', () => {
    const t = fitTransform(2000, 1000, 800, 800, 1);
    expect(t.scale).toBeCloseTo(0.4);
    expect(t.x).toBeCloseTo(0);
    expect(t.y).toBeCloseTo(200);
    expect(t.rot).toBe(0);
  });

  it('keeps the whole image inside the viewport', () => {
    const t = fitTransform(1000, 3000, 600, 400);
    const corners = [
      apply(t, { x: 0, y: 0 }),
      apply(t, { x: 1000, y: 3000 }),
    ];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(-1e-6);
      expect(c.y).toBeGreaterThanOrEqual(-1e-6);
      expect(c.x).toBeLessThanOrEqual(600 + 1e-6);
      expect(c.y).toBeLessThanOrEqual(400 + 1e-6);
    }
  });
});

describe('wrapAngle', () => {
  it('wraps into (-pi, pi]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-0.2)).toBeCloseTo(-0.2);
  });

  it('honours a shorter period for symmetric shapes', () => {
    const fifth = (2 * Math.PI) / 5;
    // A five-pointed star rotated by one fifth looks identical.
    expect(wrapAngle(fifth, fifth)).toBeCloseTo(0);
    expect(Math.abs(wrapAngle(fifth * 0.4, fifth))).toBeCloseTo(fifth * 0.4);
  });
});

describe('gestureFromPointerPair', () => {
  it('reads a pure pinch as scale only', () => {
    const g = gestureFromPointerPair(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: -50, y: 0 }, { x: 150, y: 0 }],
    );
    expect(g.scaleBy).toBeCloseTo(2);
    expect(g.rotBy).toBeCloseTo(0);
    expectVec(g.pan!, { x: 0, y: 0 });
  });

  it('reads a pure twist as rotation only', () => {
    const g = gestureFromPointerPair(
      [{ x: -50, y: 0 }, { x: 50, y: 0 }],
      [{ x: 0, y: -50 }, { x: 0, y: 50 }],
    );
    expect(g.scaleBy).toBeCloseTo(1);
    expect(g.rotBy).toBeCloseTo(Math.PI / 2);
  });

  it('reads a pure drag as pan only', () => {
    const g = gestureFromPointerPair(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: 30, y: 20 }, { x: 130, y: 20 }],
    );
    expect(g.scaleBy).toBeCloseTo(1);
    expect(g.rotBy).toBeCloseTo(0);
    expectVec(g.pan!, { x: 30, y: 20 });
  });

  it('composes into a transform that carries both fingers onto their new points', () => {
    const from: [Vec, Vec] = [{ x: 10, y: 20 }, { x: 90, y: 60 }];
    const to: [Vec, Vec] = [{ x: 40, y: 10 }, { x: 60, y: 190 }];
    const imagePoints = from.map((p) => invert(T, p));
    const next = compose(T, gestureFromPointerPair(from, to));
    expectVec(apply(next, imagePoints[0]), to[0], 1e-5);
    expectVec(apply(next, imagePoints[1]), to[1], 1e-5);
  });
});

describe('constrainPan', () => {
  const IMG = { w: 1000, h: 800 };
  const VIEW = { w: 600, h: 400 };
  const held = (t: Transform) => constrainPan(t, IMG.w, IMG.h, VIEW.w, VIEW.h);

  it('leaves a centred image alone', () => {
    const t = fitTransform(IMG.w, IMG.h, VIEW.w, VIEW.h);
    expect(held(t)).toEqual(t);
  });

  it('pulls back an image dragged off to the right', () => {
    const t: Transform = { x: 5000, y: 0, scale: 0.4, rot: 0 };
    const next = held(t);
    expect(next.x).toBeLessThan(t.x);
    // Some of the image must still be inside the viewport.
    expect(apply(next, { x: 0, y: 0 }).x).toBeLessThan(VIEW.w);
  });

  it('pulls back an image dragged off in every direction', () => {
    for (const t of [
      { x: -9000, y: 0, scale: 0.4, rot: 0 },
      { x: 0, y: -9000, scale: 0.4, rot: 0 },
      { x: 0, y: 9000, scale: 0.4, rot: 0 },
    ] satisfies Transform[]) {
      const next = held(t);
      const corners = [
        apply(next, { x: 0, y: 0 }),
        apply(next, { x: IMG.w, y: IMG.h }),
      ];
      const minX = Math.min(corners[0].x, corners[1].x);
      const maxX = Math.max(corners[0].x, corners[1].x);
      const minY = Math.min(corners[0].y, corners[1].y);
      const maxY = Math.max(corners[0].y, corners[1].y);
      expect(maxX).toBeGreaterThan(0);
      expect(minX).toBeLessThan(VIEW.w);
      expect(maxY).toBeGreaterThan(0);
      expect(minY).toBeLessThan(VIEW.h);
    }
  });

  it('does not change zoom or rotation', () => {
    const t: Transform = { x: 9000, y: -9000, scale: 3.3, rot: 1.2 };
    const next = held(t);
    expect(next.scale).toBe(t.scale);
    expect(next.rot).toBe(t.rot);
  });

  it('still allows free movement when zoomed deep into the image', () => {
    // A player exploring a 4x zoom should never feel the leash mid-image.
    const t: Transform = { x: -1200, y: -900, scale: 4, rot: 0.3 };
    expect(held(t)).toEqual(t);
  });
});
