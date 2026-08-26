import { describe, expect, it } from 'vitest';
import { ANGLE_TOLERANCE_DEG, evaluate, SIZE_TOLERANCE, targetDisplaySize } from './match';
import { RAD } from './transform';
import type { Target, Transform } from './types';

const TARGET_PX = 88;
const VIEW = { w: 800, h: 600 };

const target: Target = {
  shape: 'star',
  cx: 500,
  cy: 400,
  size: 50,
  angle: 30,
  symmetry: 5,
};

/** A transform that puts the target dead centre at the requested scale and rotation. */
function framed(scale: number, rotDeg: number): Transform {
  const rot = rotDeg * RAD;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const sx = target.cx * scale;
  const sy = target.cy * scale;
  return {
    scale,
    rot,
    x: VIEW.w / 2 - (c * sx - s * sy),
    y: VIEW.h / 2 - (s * sx + c * sy),
  };
}

const check = (t: Transform) => evaluate(target, t, VIEW.w, VIEW.h, TARGET_PX);

// This scale renders the 50px shape at the target size; rotation -30 cancels the
// baked-in 30.
const EXACT = TARGET_PX / target.size;
const PERFECT = framed(EXACT, -30);

describe('evaluate', () => {
  it('solves an exact match', () => {
    const m = check(PERFECT);
    expect(m.displaySize).toBeCloseTo(TARGET_PX);
    expect(m.sizeError).toBeCloseTo(0);
    expect(m.angleError).toBeCloseTo(0);
    expect(m.onScreen).toBe(true);
    expect(m.solved).toBe(true);
  });

  it('accepts size just inside the tolerance and rejects just outside', () => {
    expect(check(framed(EXACT * (1 + SIZE_TOLERANCE * 0.99), -30)).solved).toBe(true);
    expect(check(framed(EXACT * (1 - SIZE_TOLERANCE * 0.99), -30)).solved).toBe(true);
    expect(check(framed(EXACT * (1 + SIZE_TOLERANCE * 1.5), -30)).sizeOk).toBe(false);
    expect(check(framed(EXACT * (1 - SIZE_TOLERANCE * 1.5), -30)).sizeOk).toBe(false);
  });

  it('accepts angle just inside the tolerance and rejects just outside', () => {
    expect(check(framed(EXACT, -30 + ANGLE_TOLERANCE_DEG * 0.99)).angleOk).toBe(true);
    expect(check(framed(EXACT, -30 - ANGLE_TOLERANCE_DEG * 0.99)).angleOk).toBe(true);
    expect(check(framed(EXACT, -30 + ANGLE_TOLERANCE_DEG * 1.5)).angleOk).toBe(false);
  });

  it('treats a symmetric shape rotated by one period as matching', () => {
    // A five-pointed star repeats every 72 degrees.
    expect(check(framed(EXACT, -30 + 72)).solved).toBe(true);
    expect(check(framed(EXACT, -30 + 144)).solved).toBe(true);
    expect(check(framed(EXACT, -30 + 36)).angleOk).toBe(false);
  });

  it('does not treat an asymmetric shape as matching when flipped round', () => {
    const key: Target = { ...target, shape: 'key', symmetry: 1 };
    const m = evaluate(key, framed(EXACT, -30 + 72), VIEW.w, VIEW.h, TARGET_PX);
    expect(m.angleOk).toBe(false);
  });

  it('reports size direction so the gauge can say zoom in or out', () => {
    expect(check(framed(EXACT * 0.5, -30)).sizeError).toBeLessThan(0);
    expect(check(framed(EXACT * 2, -30)).sizeError).toBeGreaterThan(0);
  });

  it('requires the whole shape to be inside the viewport', () => {
    // Slide the perfect framing until the shape hangs off the left edge.
    const offLeft = { ...PERFECT, x: PERFECT.x - VIEW.w / 2 - TARGET_PX };
    const m = check(offLeft);
    expect(m.sizeOk).toBe(true);
    expect(m.angleOk).toBe(true);
    expect(m.onScreen).toBe(false);
    expect(m.solved).toBe(false);
  });

  it('lights the near band before the match, and not once it is far off', () => {
    expect(check(PERFECT).near).toBe(true);
    expect(check(framed(EXACT * 1.06, -30)).near).toBe(true);
    expect(check(framed(EXACT * 1.06, -30)).solved).toBe(false);
    expect(check(framed(EXACT * 1.5, -30)).near).toBe(false);
    expect(check(framed(EXACT, -30 + 20)).near).toBe(false);
  });

  it('leaves clearance for the rotated bounding box at the edges', () => {
    // Centre the shape exactly half its width from the edge: a rotated shape can
    // still poke out, so this must not count as on screen.
    const r = TARGET_PX / 2;
    const atEdge = { ...PERFECT, x: PERFECT.x - (VIEW.w / 2 - r) };
    expect(check(atEdge).onScreen).toBe(false);
  });
});

describe('targetDisplaySize', () => {
  it('scales with the viewport but stays within sane bounds', () => {
    expect(targetDisplaySize(360, 640)).toBe(60);
    expect(targetDisplaySize(1440, 900)).toBe(88);
    expect(targetDisplaySize(200, 200)).toBe(60);
    expect(targetDisplaySize(4000, 4000)).toBe(88);
  });
});
