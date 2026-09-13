import { RAMP } from './difficulty';
import { getShape } from './shapes';
import type { Puzzle, Target } from './types';

const base = import.meta.env.BASE_URL;

/** The fields a week seed must carry for a week of puzzles to be built from it. */
export interface BuildableWeek {
  /** Id of the week. Also the asset id in `public/puzzles`, unless `asset` says otherwise. */
  image: string;
  /**
   * The file in `public/puzzles` to render, when it is not named after the week.
   *
   * Only the play-test bench uses this, and only to stand a candidate re-plan of a
   * painting the rotation has already served in front of testers. Two weeks may share an
   * asset; they may never share an id, because the id is what `daily.ts` and every
   * recorded result key on.
   */
  asset?: string;
  title: string;
  artist: string;
  year: string;
  width: number;
  height: number;
  /** Shape-scale busyness of the canvas, written by `npm run busyness`. */
  clutter?: number;
  /** The Commons file page of the scan, linked from the note on the result card. */
  source?: string;
  /** One short note about the painting per day, Monday first. See `Puzzle.note`. */
  notes?: string[];
  days: Target[];
}

/**
 * Short stable hash of the fields a player actually has to contend with. Cosmetic
 * edits to a title or an artist line deliberately do not change it; moving, resizing,
 * recolouring or replacing the hidden shape does.
 */
export function fingerprint(image: string, key: string, t: Target): string {
  // `cover` joins only where a day has one, so every day tuned before it keeps its version.
  const fields = [image, key, t.shape, t.cx, t.cy, t.size, t.angle, t.fill, t.opacity, t.blend];
  if (t.cover !== undefined) fields.push(t.cover, t.base);
  return hash(fields);
}

/**
 * Short stable hash of the *hunt*: which shape, where, how big, at what angle. What the
 * player has to go and find, with nothing in it that the tuner is free to move.
 *
 * `version` covers this and the paint together, which is what a recorded result is scored
 * against -- but it cannot tell the two apart, and the difference decides what happens to
 * somebody who has already played. Re-solving each day's opacity leaves the shape exactly
 * where it was: the same hunt, repainted, and a player who found it has found it. Moving
 * the shape is a genuinely different hunt on the same day, and handing that back as
 * playable is the whole reason versions exist.
 *
 * Deliberately not part of `version` and deliberately not written into a puzzle file: it
 * is derived from the same fields, so there is nothing to keep in step.
 */
export function spotprint(image: string, key: string, t: Target): string {
  return hash([image, key, t.shape, t.cx, t.cy, t.size, t.angle]);
}

/** FNV-1a over the joined fields, in base 36. Short, stable, and not a security claim. */
function hash(fields: (string | number | undefined)[]): string {
  const canonical = fields.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * A week seed to seven puzzles: index `d` is day `d`, and day 0 is its Monday.
 *
 * Shared with the play-test bench in `testbed.ts` rather than written out twice. A bench
 * whose puzzles were assembled by a second copy of this would be measuring a second
 * game, and the difference would be invisible in exactly the way that matters -- it
 * would show up as a difficulty reading nobody could reproduce in the real thing.
 */
export function buildWeek(week: BuildableWeek): Puzzle[] {
  return week.days.map((target, day) => {
    const shape = getShape(target.shape);
    const rung = RAMP[day];
    return {
      id: `${week.image}-${rung.key}`,
      image: week.image,
      dayOfWeek: day,
      title: week.title,
      artist: week.artist,
      year: week.year,
      width: week.width,
      height: week.height,
      src: `${base}puzzles/${week.asset ?? week.image}.jpg`,
      thing: shape.label,
      emoji: shape.emoji,
      version: fingerprint(week.image, rung.key, target),
      spot: spotprint(week.image, rung.key, target),
      clutter: week.clutter,
      note: week.notes?.[day],
      source: week.source,
      target: { symmetry: shape.symmetry, ...target },
    };
  });
}
