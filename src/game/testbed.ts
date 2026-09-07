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
 * The first three are chosen to fail in different directions, because a change that helps
 * one kind of painting routinely hurts another:
 *
 *   proverbs     dense crowd, median texture 42.9 -- maximum cover, where a shape can be
 *                lost entirely and the search is the whole of the difficulty.
 *   cafe         high-frequency brushwork with a quietest reading of 9.0, right on the
 *                floor Monday needs. Van Gogh's is the week players find roughest, and
 *                this is that failure mode without being that week.
 *   ambassadors  glazed northern portrait with a large flat curtain: smooth paint that
 *                still has somewhere to hide, which is the narrow band the Mona Lisa
 *                sits in and the Temeraire fell out of.
 *
 * The last two are a different kind of bench week, and the rule they bend is written down
 * rather than assumed. They render paintings the *rotation has already served*, under ids
 * of their own (see `asset`), because the calendar only ever grows -- new weeks are
 * appended and it never wraps back round -- so a week that has been played is finished
 * with, and is the one thing on the bench that can answer a question about a week people
 * actually complained about:
 *
 *   starryreplan  the busiest canvas in the set, re-planned under the measured busyness
 *                 term. Its Monday was solved in a median of 3m21 against a rung asking
 *                 for 45s, on the same reading its predecessor took 22s to find.
 *   wavereplan    the calm control beside it, a third of the shape-scale clutter, so the
 *                 question "does a Monday feel like a Monday whatever the painting" has
 *                 both of its halves.
 *
 * These two are re-*planned*, not re-tuned, and that is deliberate: every tester has
 * already played the shipped Monday, so asking them to find the same shape in the same
 * place measures their memory rather than the ramp.
 */
interface TestbedWeek {
  /** Id of the bench week. Never an id used by a shipped week. */
  image: string;
  /**
   * The painting to render, when it is not the one this week is named after.
   *
   * The bench normally holds paintings the rotation will never serve. The exception is a
   * painting the rotation has already *finished* with -- one whose week has been played
   * and, because the calendar only ever grows rather than wrapping, will not come round
   * again. Standing a candidate re-plan of such a week in front of testers is the only
   * way to ask whether a change to the ramp fixes the thing people actually complained
   * about, so the bench borrows the asset under an id of its own. The id is what
   * everything keys on, so nothing about the shipped week can move.
   */
  asset?: string;
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
  /**
   * How much of this canvas carries detail at the scale of the shape -- how much there is
   * to stop and check on the way to the right thing. Measured by `npm run busyness` and
   * written here; it moves every day's scan target, because a busy painting is already
   * supplying difficulty the rung did not ask for. See `CLUTTER_WEIGHT` in difficulty.ts.
   */
  clutter?: number;
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
    clutter: 0.649,
    days: [
      { shape: 'snowflake', cx: 257, cy: 1073, size: 40, angle: -168, fill: '#393124', opacity: 1, blend: 'screen', blur: 0.5, ratio: 4.35, scan: 0.563, dim: 0.878 },
      { shape: 'star', cx: 785, cy: 353, size: 37, angle: 47, fill: '#d19876', opacity: 0.213, blend: 'screen', blur: 0.5, ratio: 3.13, scan: 0.503, dim: 0.791 },
      { shape: 'clover', cx: 2201, cy: 401, size: 34, angle: 34, fill: '#aab68c', opacity: 0.293, blend: 'screen', blur: 0.5, ratio: 1.99, scan: 0.484, dim: 0.786 },
      { shape: 'key', cx: 2177, cy: 905, size: 31, angle: -46, fill: '#c5cbae', opacity: 0.433, blend: 'screen', blur: 0.5, ratio: 2.3, scan: 0.418, dim: 0.472 },
      { shape: 'crescent', cx: 1169, cy: 1049, size: 28, angle: 70, fill: '#db977e', opacity: 0.489, blend: 'screen', blur: 0.5, ratio: 1.66, scan: 0.433, dim: 0.753 },
      { shape: 'heart', cx: 2153, cy: 1553, size: 25, angle: -104, fill: '#cfc1a9', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.39, dim: 0.606 },
      { shape: 'anchor', cx: 1193, cy: 1481, size: 22, angle: 148, fill: '#96c3b8', opacity: 0.379, blend: 'screen', blur: 0.5, ratio: 1.85, scan: 0.387, dim: 0.666 },
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
    clutter: 0.508,
    days: [
      { shape: 'star', cx: 1769, cy: 1385, size: 40, angle: -156, fill: '#10131e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.94, scan: 0.438, dim: 0.865 },
      { shape: 'clover', cx: 1457, cy: 257, size: 37, angle: -155, fill: '#6da5ed', opacity: 0.249, blend: 'screen', blur: 0.5, ratio: 2.65, scan: 0.378, dim: 0.728 },
      { shape: 'triangle', cx: 2225, cy: 1097, size: 34, angle: 86, fill: '#7fc4af', opacity: 0.119, blend: 'screen', blur: 0.5, ratio: 1.63, scan: 0.351, dim: 0.765 },
      { shape: 'anchor', cx: 1529, cy: 2321, size: 31, angle: 46, fill: '#d7c693', opacity: 0.198, blend: 'screen', blur: 0.5, ratio: 1.83, scan: 0.308, dim: 0.581 },
      { shape: 'fish', cx: 2441, cy: 2057, size: 28, angle: -70, fill: '#bfc3a1', opacity: 0.366, blend: 'screen', blur: 0.5, ratio: 2.97, scan: 0.296, dim: 0.616 },
      { shape: 'arrow', cx: 257, cy: 2801, size: 25, angle: 104, fill: '#8fa1b8', opacity: 0.249, blend: 'screen', blur: 0.5, ratio: 1.69, scan: 0.298, dim: 0.766 },
      { shape: 'key', cx: 353, cy: 1817, size: 22, angle: -148, fill: '#b4c4a2', opacity: 0.273, blend: 'screen', blur: 0.5, ratio: 1.4, scan: 0.302, dim: 0.575 },
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
    clutter: 0.483,
    days: [
      { shape: 'clover', cx: 2297, cy: 2129, size: 40, angle: 12, fill: '#2e231d', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.38, scan: 0.421, dim: 0.875 },
      { shape: 'triangle', cx: 1865, cy: 281, size: 37, angle: -25, fill: '#bad85f', opacity: 0.119, blend: 'screen', blur: 0.5, ratio: 1.47, scan: 0.362, dim: 0.79 },
      { shape: 'star', cx: 1121, cy: 1289, size: 34, angle: -38, fill: '#e37d6c', opacity: 0.489, blend: 'screen', blur: 0.5, ratio: 2.46, scan: 0.352, dim: 0.865 },
      { shape: 'arrow', cx: 2441, cy: 1385, size: 31, angle: -46, fill: '#b29487', opacity: 0.127, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.325, dim: 0.882 },
      { shape: 'key', cx: 185, cy: 2177, size: 28, angle: 70, fill: '#b5a28b', opacity: 0.304, blend: 'screen', blur: 0.5, ratio: 2.56, scan: 0.3, dim: 0.825 },
      { shape: 'crescent', cx: 233, cy: 1073, size: 25, angle: -104, fill: '#d67168', opacity: 0.336, blend: 'screen', blur: 0.5, ratio: 1.18, scan: 0.304, dim: 0.827 },
      { shape: 'heart', cx: 1769, cy: 1505, size: 22, angle: 148, fill: '#62502f', opacity: 0.383, blend: 'multiply', blur: 0.5, ratio: 1.6, scan: 0.3, dim: 0.415 },
    ],
  },
  {
    image: 'starryreplan',
    asset: 'starry',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: '1889',
    stresses:
      'the busiest canvas the rotation has served, re-planned under the measured ' +
      'busyness term -- the week players said was too hard, asked again',
    source:
      'https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    width: 2600,
    height: 2059,
    clutter: 0.732,
    days: [
      { shape: 'triangle', cx: 857, cy: 1601, size: 40, angle: -132, fill: '#17241b', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.95, scan: 0.605, dim: 0.87 },
      { shape: 'blossom', cx: 329, cy: 1649, size: 37, angle: 97, fill: '#8ba0b5', opacity: 0.201, blend: 'screen', blur: 0.5, ratio: 1.52, scan: 0.576, dim: 0.82 },
      { shape: 'cross', cx: 2225, cy: 185, size: 34, angle: -34, fill: '#3f4e32', opacity: 0.524, blend: 'multiply', blur: 0.5, ratio: 2.11, scan: 0.507, dim: 0.363 },
      { shape: 'tree', cx: 689, cy: 593, size: 31, angle: 46, fill: '#b6c6d1', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 1.96, scan: 0.49, dim: 0.503 },
      { shape: 'note', cx: 2009, cy: 1337, size: 28, angle: -70, fill: '#8892b3', opacity: 0.485, blend: 'screen', blur: 0.5, ratio: 2.18, scan: 0.504, dim: 0.748 },
      { shape: 'key', cx: 185, cy: 1241, size: 25, angle: 104, fill: '#2e4845', opacity: 0.453, blend: 'multiply', blur: 0.5, ratio: 1.75, scan: 0.451, dim: 0.455 },
      { shape: 'crescent', cx: 1433, cy: 113, size: 22, angle: -148, fill: '#96a1d2', opacity: 0.586, blend: 'screen', blur: 0.5, ratio: 3.54, scan: 0.458, dim: 0.725 },
    ],
  },
  {
    image: 'wavereplan',
    asset: 'wave',
    title: 'The Great Wave off Kanagawa',
    artist: 'Katsushika Hokusai',
    year: 'c. 1831',
    stresses:
      'the calm control for starryreplan -- a third of the shape-scale clutter, so one ' +
      'rung can be compared across two canvases that played nine times apart',
    source: 'https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg',
    width: 2600,
    height: 1748,
    sizeScale: 0.73,
    clutter: 0.581,
    days: [
      { shape: 'blossom', cx: 1361, cy: 329, size: 29, angle: -132, fill: '#f8e8c9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.94, scan: 0.415, dim: 0.104 },
      { shape: 'cross', cx: 473, cy: 641, size: 27, angle: 155, fill: '#79764a', opacity: 0.265, blend: 'multiply', blur: 0.5, ratio: 1.08, scan: 0.381, dim: 0.11 },
      { shape: 'star', cx: 521, cy: 1337, size: 25, angle: -38, fill: '#436958', opacity: 0.375, blend: 'multiply', blur: 0.5, ratio: 1.39, scan: 0.355, dim: 0.146 },
      { shape: 'crescent', cx: 137, cy: 1049, size: 23, angle: -46, fill: '#4d6b44', opacity: 0.571, blend: 'multiply', blur: 0.5, ratio: 1.67, scan: 0.336, dim: 0.229 },
      { shape: 'heart', cx: 1409, cy: 1625, size: 20, angle: 70, fill: '#896d33', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.69, scan: 0.324, dim: 0.311 },
      { shape: 'anchor', cx: 977, cy: 1385, size: 18, angle: -104, fill: '#55824b', opacity: 0.571, blend: 'multiply', blur: 0.5, ratio: 1.38, scan: 0.302, dim: 0.175 },
      { shape: 'fish', cx: 2465, cy: 1001, size: 16, angle: 148, fill: '#446a58', opacity: 0.59, blend: 'multiply', blur: 0.5, ratio: 1.65, scan: 0.299, dim: 0.149 },
    ],
  },
];

/** Every testbed day, laid out Monday-first in blocks of seven, as `PUZZLES` is. */
export const TESTBED_PUZZLES: Puzzle[] = WEEKS.flatMap(buildWeek);

/** The distinct testbed paintings, for tooling that works per asset rather than per day. */
export const TESTBED_IMAGES = WEEKS.map((w) => ({
  id: w.image,
  asset: w.asset ?? w.image,
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
