/** A shape hidden inside a puzzle image, expressed in the image's own pixel space. */
export interface Target {
  /** Key into the shape registry (see shapes.tsx). */
  shape: string;
  /** Centre of the shape, in image pixels. */
  cx: number;
  cy: number;
  /** Width/height of the shape's box, in image pixels. Smaller = more zoom needed. */
  size: number;
  /** Rotation baked into the image, in degrees clockwise. */
  angle: number;
  /** Rotational symmetry of the shape: 5 for a star, 1 for a key, 2 for a bolt. */
  symmetry?: number;
  /** How the shape is painted into the scene. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  blend?: string;
}

export interface Puzzle {
  id: string;
  /** Painting title + artist, revealed after the solve. */
  title: string;
  artist: string;
  src: string;
  width: number;
  height: number;
  target: Target;
  /** Human-readable name of the thing to find, e.g. "star". */
  thing: string;
  /** Emoji used in the shared result. */
  emoji: string;
  /**
   * Fingerprint of everything that defines the challenge. Recorded results carry the
   * version they were set on, so re-hiding a shape or swapping it for another one
   * hands the day back to the player instead of showing them a stale finished board.
   */
  version: string;
}

/**
 * Viewport transform mapping image-space points to screen-space points:
 *   screen = R(rot) * (scale * imagePoint) + (x, y)
 */
export interface Transform {
  x: number;
  y: number;
  scale: number;
  /** Radians, clockwise in screen space. */
  rot: number;
}

export interface Vec {
  x: number;
  y: number;
}
