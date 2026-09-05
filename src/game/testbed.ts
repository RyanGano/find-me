import { buildWeek } from './build';
import type { Puzzle, Target } from './types';

/**
 * The play-test bench: paintings that exist to be experimented on, and will never be
 * served as anybody's daily puzzle.
 *
 * Tuning the game is guesswork until somebody plays it, and the only puzzles worth
 * asking somebody to play are ones they have not already solved. That rules out the
 * rotation twice over: a shipped week cannot be re-tuned to try an idea without taking
 * a day back off the people whose result was recorded against it, and a tester who has
 * played the real game already knows where those shapes are.
 *
 * So these three are held aside. They are generated, planned and tuned by exactly the
 * same tools as a shipped week -- `npm run images`, `npm run plan -- --testbed`,
 * `npm run camouflage -- --testbed --solve` -- because a bench that behaved even
 * slightly differently would answer questions about itself rather than about the game.
 * What they never do is enter `PUZZLES`. `daily.ts` indexes the calendar into that list
 * and nothing else, so no change here can move anybody's day.
 *
 * They are also recorded in the `add-painting` skill's `rejected.json`, so a future week
 * cannot pull one into the rotation by accident. A painting people have been asked to
 * play half a dozen times, at difficulties that were deliberately wrong, is spent.
 *
 * The three are chosen to fail in different directions, because a change that helps one
 * kind of painting routinely hurts another:
 *
 *   proverbs     dense crowd, median texture 42.9 -- maximum cover, where a shape can be
 *                lost entirely and the search is the whole of the difficulty.
 *   cafe         high-frequency brushwork with a quietest reading of 9.0, right on the
 *                floor Monday needs. Van Gogh's is the week players find roughest, and
 *                this is that failure mode without being that week.
 *   ambassadors  glazed northern portrait with a large flat curtain: smooth paint that
 *                still has somewhere to hide, which is the narrow band the Mona Lisa
 *                sits in and the Temeraire fell out of.
 */
interface TestbedWeek {
  /** Asset id in `public/puzzles`. Never an id used by a shipped week. */
  image: string;
  title: string;
  artist: string;
  year: string;
  /** What this painting is here to stress. */
  stresses: string;
  /** The Commons file page the asset was generated from; see `puzzles.ts`. */
  source: string;
  /** Set when the asset came from Commons' rendering at this width, not the original. */
  sourceWidth?: number;
  width: number;
  height: number;
  /** Shrinks the whole size ladder; see `sizeScale` in `puzzles.ts`. */
  sizeScale?: number;
  /**
   * Machine-written, one dense line per day, exactly as in `puzzles.ts` -- the planner
   * and the tuner read this file with the same parsers and rewrite it the same way.
   */
  days: Target[];
}

const WEEKS: TestbedWeek[] = [
  {
    image: 'proverbs',
    title: 'Netherlandish Proverbs',
    artist: 'Pieter Bruegel the Elder',
    year: '1559',
    stresses: 'dense crowd -- maximum cover, the search is the difficulty',
    source:
      'https://commons.wikimedia.org/wiki/File:Pieter_Bruegel_the_Elder_-_The_Dutch_Proverbs_-_Google_Art_Project.jpg',
    width: 2600,
    height: 1841,
    days: [
      { shape: 'snowflake', cx: 257, cy: 1073, size: 40, angle: -168, fill: '#312a1f', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.72, scan: 0.494 },
      { shape: 'star', cx: 785, cy: 353, size: 37, angle: 47, fill: '#d19876', opacity: 0.198, blend: 'screen', blur: 0.5, ratio: 2.91, scan: 0.453 },
      { shape: 'clover', cx: 2201, cy: 401, size: 34, angle: 34, fill: '#aab68c', opacity: 0.213, blend: 'screen', blur: 0.5, ratio: 1.42, scan: 0.428 },
      { shape: 'key', cx: 2177, cy: 905, size: 31, angle: -46, fill: '#c5cbae', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 2.09, scan: 0.4 },
      { shape: 'crescent', cx: 1169, cy: 1049, size: 28, angle: 70, fill: '#db977e', opacity: 0.602, blend: 'screen', blur: 0.5, ratio: 1.98, scan: 0.382 },
      { shape: 'heart', cx: 2153, cy: 1553, size: 25, angle: -104, fill: '#cfc1a9', opacity: 0.35, blend: 'screen', blur: 0.5, ratio: 1.38, scan: 0.359 },
      { shape: 'anchor', cx: 1193, cy: 1481, size: 22, angle: 148, fill: '#96c3b8', opacity: 0.327, blend: 'screen', blur: 0.5, ratio: 1.58, scan: 0.34 },
    ],
  },
  {
    image: 'cafe',
    title: 'Terrace of a Café at Night',
    artist: 'Vincent van Gogh',
    year: '1888',
    stresses: 'high-frequency brushwork with almost no quiet paint',
    source:
      'https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Terrace_of_a_Caf%C3%A9_at_Night_(Place_du_Forum)_1888.jpg',
    width: 2600,
    height: 3242,
    days: [
      { shape: 'star', cx: 1769, cy: 1385, size: 40, angle: -156, fill: '#131725', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.35, scan: 0.492 },
      { shape: 'clover', cx: 1457, cy: 257, size: 37, angle: -155, fill: '#6da5ed', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 2.46, scan: 0.461 },
      { shape: 'triangle', cx: 2225, cy: 1097, size: 34, angle: 86, fill: '#7fc4af', opacity: 0.17, blend: 'screen', blur: 0.5, ratio: 2.36, scan: 0.425 },
      { shape: 'anchor', cx: 1529, cy: 2321, size: 31, angle: 46, fill: '#d7c693', opacity: 0.234, blend: 'screen', blur: 0.5, ratio: 2.21, scan: 0.404 },
      { shape: 'fish', cx: 2441, cy: 2057, size: 28, angle: -70, fill: '#bfc3a1', opacity: 0.507, blend: 'screen', blur: 0.5, ratio: 4.15, scan: 0.377 },
      { shape: 'arrow', cx: 257, cy: 2801, size: 25, angle: 104, fill: '#8fa1b8', opacity: 0.273, blend: 'screen', blur: 0.5, ratio: 1.87, scan: 0.369 },
      { shape: 'key', cx: 353, cy: 1817, size: 22, angle: -148, fill: '#b4c4a2', opacity: 0.348, blend: 'screen', blur: 0.5, ratio: 1.77, scan: 0.344 },
    ],
  },
  {
    image: 'ambassadors',
    title: 'The Ambassadors',
    artist: 'Hans Holbein the Younger',
    year: '1533',
    stresses: 'glazed, smooth paint that only just offers cover',
    source:
      'https://commons.wikimedia.org/wiki/File:Hans_Holbein_the_Younger_-_The_Ambassadors_-_Google_Art_Project.jpg',
    sourceWidth: 3840,
    width: 2600,
    height: 2562,
    days: [
      { shape: 'clover', cx: 2297, cy: 2129, size: 40, angle: 12, fill: '#3d2e27', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.12, scan: 0.496 },
      { shape: 'triangle', cx: 1865, cy: 281, size: 37, angle: -25, fill: '#bad85f', opacity: 0.131, blend: 'screen', blur: 0.5, ratio: 1.64, scan: 0.453 },
      { shape: 'star', cx: 1121, cy: 1289, size: 34, angle: -38, fill: '#e37d6c', opacity: 0.571, blend: 'screen', blur: 0.5, ratio: 2.92, scan: 0.431 },
      { shape: 'arrow', cx: 2441, cy: 1385, size: 31, angle: -46, fill: '#b29487', opacity: 0.162, blend: 'screen', blur: 0.5, ratio: 2.02, scan: 0.394 },
      { shape: 'key', cx: 185, cy: 2177, size: 28, angle: 70, fill: '#b5a28b', opacity: 0.323, blend: 'screen', blur: 0.5, ratio: 2.67, scan: 0.374 },
      { shape: 'crescent', cx: 233, cy: 1073, size: 25, angle: -104, fill: '#d67168', opacity: 0.524, blend: 'screen', blur: 0.5, ratio: 1.7, scan: 0.36 },
      { shape: 'heart', cx: 1769, cy: 1505, size: 22, angle: 148, fill: '#62502f', opacity: 0.493, blend: 'multiply', blur: 0.5, ratio: 2.06, scan: 0.343 },
    ],
  },
];

/** Every testbed day, laid out Monday-first in blocks of seven, as `PUZZLES` is. */
export const TESTBED_PUZZLES: Puzzle[] = WEEKS.flatMap(buildWeek);

/** The distinct testbed paintings, for tooling that works per asset rather than per day. */
export const TESTBED_IMAGES = WEEKS.map((w) => ({
  id: w.image,
  title: w.title,
  artist: w.artist,
  year: w.year,
  stresses: w.stresses,
  width: w.width,
  height: w.height,
  source: w.source,
  sourceWidth: w.sourceWidth,
}));

/** A testbed puzzle by id, or undefined. Ids are distinct from every shipped one. */
export function testbedPuzzle(id: string): Puzzle | undefined {
  return TESTBED_PUZZLES.find((p) => p.id === id);
}
