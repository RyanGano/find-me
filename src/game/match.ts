import { apply, DEG, RAD, wrapAngle } from './transform';
import type { Target, Transform } from './types';

/** Scale must land within +/- 2% of the reference size. */
export const SIZE_TOLERANCE = 0.02;
/** Rotation must land within +/- 2% of a half turn (3.6 degrees). */
export const ANGLE_TOLERANCE_DEG = 3.6;

/**
 * The looser "warm" band. Inside it the hidden shape picks up an outline, which is the
 * only running feedback the player gets. It is deliberately wide enough to confirm
 * "you have found the right thing and you are nearly there" and far too narrow to be
 * swept for blind: it only helps once the shape is already in front of you.
 */
export const NEAR_SIZE_TOLERANCE = 0.08;
export const NEAR_ANGLE_TOLERANCE_DEG = 10;

export interface MatchState {
  /** Rendered size of the hidden shape, in CSS pixels. */
  displaySize: number;
  /** displaySize / targetSize - 1. Negative means too small. */
  sizeError: number;
  sizeOk: boolean;
  /** Signed degrees away from upright, wrapped by the shape's symmetry. */
  angleError: number;
  angleOk: boolean;
  /** Whether the whole shape is inside the viewport. */
  onScreen: boolean;
  /** Close on both size and angle, but not yet a match: the shape outlines itself. */
  near: boolean;
  /** Screen position of the shape's centre, for the reveal ring. */
  screen: { x: number; y: number };
  solved: boolean;
}

/**
 * The rendered size the hidden shape must reach, in CSS pixels. Scaling it to the
 * viewport keeps the amount of zooming required roughly even across phone and desktop.
 */
export function targetDisplaySize(viewportW: number, viewportH: number): number {
  const base = Math.min(viewportW, viewportH) * 0.16;
  return Math.round(Math.min(88, Math.max(60, base)));
}

export function evaluate(
  target: Target,
  t: Transform,
  viewportW: number,
  viewportH: number,
  targetSize: number,
): MatchState {
  const screen = apply(t, { x: target.cx, y: target.cy });
  const displaySize = target.size * t.scale;
  const sizeError = displaySize / targetSize - 1;
  const sizeOk = Math.abs(sizeError) <= SIZE_TOLERANCE;

  const period = (2 * Math.PI) / (target.symmetry ?? 1);
  const angleError = wrapAngle(target.angle * RAD + t.rot, period) * DEG;
  const angleOk = Math.abs(angleError) <= ANGLE_TOLERANCE_DEG;

  // The shape must sit fully inside the viewport. Its rotated bounding box is at worst
  // the diagonal of its box, so use that as the clearance radius.
  const r = (displaySize * Math.SQRT2) / 2;
  const onScreen =
    screen.x - r >= 0 &&
    screen.y - r >= 0 &&
    screen.x + r <= viewportW &&
    screen.y + r <= viewportH;

  const near =
    Math.abs(sizeError) <= NEAR_SIZE_TOLERANCE &&
    Math.abs(angleError) <= NEAR_ANGLE_TOLERANCE_DEG;

  return {
    displaySize,
    sizeError,
    sizeOk,
    angleError,
    angleOk,
    onScreen,
    near,
    screen,
    solved: sizeOk && angleOk && onScreen,
  };
}
