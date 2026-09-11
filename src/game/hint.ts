import type { Puzzle } from './types';

/**
 * The circle a hint draws on the painting: somewhere in here, and no more.
 *
 * A hint exists for the player who is walled -- the one about to close the tab or give
 * up. It narrows the hunt to a patch of the canvas without handing over the answer, so
 * the find is still theirs. See "Hints" in README.md.
 *
 * Its radius is a fixed share of the painting's shorter side, which leaves about a
 * fifteenth of a landscape canvas to search. The shape always lies wholly inside, but
 * never at the centre: a circle centred on the answer is a pointer, and players learn to
 * look in the middle of it within a day. How far off-centre, and in which direction, is
 * derived from the puzzle id -- the same for every player, as everything in a day must be
 * (see `determinism.test.ts`).
 */
export interface HintCircle {
  /** Centre, in image pixels. */
  cx: number;
  cy: number;
  /** Radius, in image pixels. */
  r: number;
}

/** Radius, as a share of the painting's shorter side. */
export const HINT_RADIUS = 0.16;
/** How far the centre sits from the shape, as a share of the radius. */
export const HINT_OFFSET = 0.55;

/** A stable angle in [0, 2π) from a string: FNV-1a, as `fingerprint` in build.ts uses. */
function angleFrom(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) / 0x100000000) * 2 * Math.PI;
}

export function hintCircle(puzzle: Puzzle): HintCircle {
  const r = HINT_RADIUS * Math.min(puzzle.width, puzzle.height);
  const a = angleFrom(`${puzzle.id}|hint`);
  const d = HINT_OFFSET * r;
  return {
    cx: puzzle.target.cx + d * Math.cos(a),
    cy: puzzle.target.cy + d * Math.sin(a),
    r,
  };
}
