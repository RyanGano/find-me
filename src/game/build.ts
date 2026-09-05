import { RAMP } from './difficulty';
import { getShape } from './shapes';
import type { Puzzle, Target } from './types';

const base = import.meta.env.BASE_URL;

/** The fields a week seed must carry for a week of puzzles to be built from it. */
export interface BuildableWeek {
  /** Asset id in `public/puzzles`. */
  image: string;
  title: string;
  artist: string;
  year: string;
  width: number;
  height: number;
  days: Target[];
}

/**
 * Short stable hash of the fields a player actually has to contend with. Cosmetic
 * edits to a title or an artist line deliberately do not change it; moving, resizing,
 * recolouring or replacing the hidden shape does.
 */
export function fingerprint(image: string, key: string, t: Target): string {
  const canonical = [image, key, t.shape, t.cx, t.cy, t.size, t.angle, t.fill, t.opacity, t.blend].join('|');
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
      src: `${base}puzzles/${week.image}.jpg`,
      thing: shape.label,
      emoji: shape.emoji,
      version: fingerprint(week.image, rung.key, target),
      target: { symmetry: shape.symmetry, ...target },
    };
  });
}
