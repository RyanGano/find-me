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
  /**
   * How much of the paint under the shape is covered by a flat layer of `base`, drawn
   * beneath the blended fill. `screen` and `multiply` only ever lighten or darken the
   * paint, so every brushstroke runs straight through a shape painted with them alone and
   * it has no edge of its own; that is how a see-through day on a busy canvas becomes
   * a wall. See "Solid shapes" in README.md. Absent on days tuned before it existed.
   */
  cover?: number;
  /** The paint's own colour under the shape, which the `cover` layer is filled with. */
  base?: string;
  /**
   * Softens the shape's edges, in image pixels. At the fitted view this is far below a
   * pixel and costs nothing; at the matched zoom the painting is shown above its native
   * resolution, and a razor-sharp vector edge against soft brushwork is a giveaway all
   * by itself. This matches the shape to the paint.
   */
  blur?: number;
  /**
   * The signal-to-texture ratio `opacity` was solved for, measured in the browser by
   * `npm run camouflage`. Nothing reads it at runtime: it is the difficulty knob in
   * legible form, and what the week's ramp is asserted against. Opacity on its own
   * cannot say whether a shape is subtle, because the same opacity shouts on a flat
   * glaze and vanishes in Bruegel's crowd.
   */
  ratio?: number;
  /**
   * The scan reading `opacity` was solved for: how the shape reads with the whole
   * painting on screen, relative to the paint around it and to how much work this canvas
   * is to search. This is the difficulty knob that corresponds to time-to-find, and the
   * one the week's ramp is asserted against. See `difficulty.ts`.
   */
  scan?: number;
  /**
   * How dark the paint is where the shape sits, 0 (white) to 1 (black), measured on the
   * painting alone by `npm run busyness`. A given contrast shift is harder to pick out of
   * dark paint than out of light, and this is the term that prices it -- see
   * `DIMNESS_WEIGHT` in difficulty.ts. Deliberately not part of a day's `version`: it is
   * a reading of the painting, not a change to the challenge.
   */
  dim?: number;
}

export interface Puzzle {
  /** Unique per day, e.g. `mona-wed`. */
  id: string;
  /** Asset id of the painting, shared by all seven days of the week. */
  image: string;
  /** 0 = Monday ... 6 = Sunday. Also the difficulty rung: Monday easiest. */
  dayOfWeek: number;
  /** Painting title, artist and year. Credited in the attribution panel all week,
   *  and shown again on the result card once the day is solved. */
  title: string;
  artist: string;
  year: string;
  src: string;
  width: number;
  height: number;
  target: Target;
  /**
   * The share of this painting's canvas carrying detail at the scale of the shape --
   * how much there is to stop and check on the way. Shared by all seven days of the
   * week, measured by `npm run busyness`. See `CLUTTER_WEIGHT` in difficulty.ts.
   */
  clutter?: number;
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
  /**
   * Fingerprint of the hunt alone -- which shape, where, how big, at what angle -- with
   * none of the paint in it. What separates re-tuning a day from re-hiding it: the first
   * leaves a player who has already found it with a day they have finished, the second
   * is a new hunt on the same date and is handed back. See `spotprint` in `build.ts`.
   */
  spot: string;
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
