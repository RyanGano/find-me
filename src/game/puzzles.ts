import { RAMP } from './difficulty';
import { getShape } from './shapes';
import type { Puzzle, Target } from './types';

const base = import.meta.env.BASE_URL;

/**
 * What kind of painting a week is, so that "a good spread" is a property the build can
 * check rather than something a curator has to hold in their head.
 *
 * A closed list on purpose. The point is to compare one week against its neighbours, and
 * free text does not compare -- `landscape` and `Landscape with trees` would read as two
 * different kinds of week and the run would go unnoticed. Widen the list when a painting
 * genuinely does not fit one of these, not to avoid choosing.
 */
export const GENRES = [
  'portrait',
  'landscape',
  'seascape',
  'cityscape',
  'architecture',
  'still-life',
  'interior',
  'genre-scene',
  'history',
  'abstract',
] as const;

export type Genre = (typeof GENRES)[number];

interface WeekSeed {
  /** Asset id in `public/puzzles`. */
  image: string;
  title: string;
  artist: string;
  /** Year painted, as it should read on the credit line, e.g. `c. 1503`. */
  year: string;
  /** What kind of painting it is. `curation.test.ts` holds the rotation to a spread of these. */
  genre: Genre;
  width: number;
  height: number;
  /** Exactly seven targets, Monday first. Written by `npm run plan`, solved by `npm run camouflage`. */
  days: Target[];
}

/**
 * One painting per week, Monday through Sunday, cycling week by week.
 *
 * A player gets a whole week with one painting and seven different things to find in
 * it, each harder than the last -- see `difficulty.ts` for what "harder" means and how
 * each rung is measured. Nine paintings is therefore nine weeks, not nine days.
 *
 * The order of this list is held to a spread of painters and kinds by
 * `curation.test.ts`; a painting that has shipped cannot be moved without moving every
 * painting after it, so the rules are satisfied by choosing, not by reordering.
 *
 * Coordinates are in the pixel space of the generated asset in `public/puzzles`
 * (2600px wide -- see `npm run images`), so re-generating at a different width means
 * rescaling `cx`, `cy` and `size` by the same factor.
 *
 * The day lines below are machine-written and machine-rewritten, which is why they are
 * one dense line each: `scripts/plan-weeks.mjs` picks the hiding places, shapes, angles
 * and colours, and `scripts/tune-camouflage.mjs` solves each one's paint against the
 * real browser. Editing one by hand is fine; keep it on one line.
 */
const WEEKS: WeekSeed[] = [
  {
    image: 'mona',
    title: 'Mona Lisa',
    artist: 'Leonardo da Vinci',
    year: 'c. 1503',
    genre: 'portrait',
    width: 2600,
    height: 3933,
    days: [
      { shape: 'snowflake', cx: 1817, cy: 3353, size: 40, angle: -168, fill: '#461f17', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.23, scan: 0.778 },
      { shape: 'star', cx: 1937, cy: 1217, size: 37, angle: 47, fill: '#bfae7c', opacity: 0.515, blend: 'screen', blur: 0.5, ratio: 4.98, scan: 0.582 },
      { shape: 'clover', cx: 545, cy: 2681, size: 34, angle: 34, fill: '#c68d72', opacity: 0.59, blend: 'screen', blur: 0.5, ratio: 4.29, scan: 0.578 },
      { shape: 'key', cx: 161, cy: 1625, size: 31, angle: -46, fill: '#b9b792', opacity: 0.433, blend: 'screen', blur: 0.5, ratio: 2.13, scan: 0.54 },
      { shape: 'crescent', cx: 569, cy: 3497, size: 28, angle: 70, fill: '#c07c76', opacity: 0.606, blend: 'screen', blur: 0.5, ratio: 2.2, scan: 0.522 },
      { shape: 'heart', cx: 2249, cy: 1793, size: 25, angle: -104, fill: '#e6c274', opacity: 0.472, blend: 'screen', blur: 0.5, ratio: 2.13, scan: 0.497 },
      { shape: 'anchor', cx: 1073, cy: 3473, size: 22, angle: 148, fill: '#ca776f', opacity: 0.558, blend: 'screen', blur: 0.5, ratio: 1.78, scan: 0.465 },
    ],
  },
  {
    image: 'wave',
    title: 'The Great Wave off Kanagawa',
    artist: 'Katsushika Hokusai',
    year: 'c. 1831',
    genre: 'seascape',
    width: 2600,
    height: 1748,
    days: [
      { shape: 'star', cx: 449, cy: 209, size: 40, angle: -156, fill: '#f3e6cb', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.09, scan: 0.801 },
      { shape: 'clover', cx: 1313, cy: 977, size: 37, angle: -155, fill: '#8f7336', opacity: 0.446, blend: 'multiply', blur: 0.5, ratio: 2.72, scan: 0.666 },
      { shape: 'triangle', cx: 545, cy: 1361, size: 34, angle: 86, fill: '#487052', opacity: 0.446, blend: 'multiply', blur: 0.5, ratio: 1.22, scan: 0.596 },
      { shape: 'anchor', cx: 1985, cy: 1097, size: 31, angle: 46, fill: '#4a4930', opacity: 0.821, blend: 'multiply', blur: 0.5, ratio: 2.44, scan: 0.554 },
      { shape: 'fish', cx: 905, cy: 545, size: 28, angle: -70, fill: '#88aad0', opacity: 0.672, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.532 },
      { shape: 'bolt', cx: 2273, cy: 1457, size: 25, angle: 104, fill: '#6a7c3c', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.81, scan: 0.509 },
      { shape: 'arrow', cx: 1697, cy: 1409, size: 22, angle: -148, fill: '#aca62b', opacity: 0.888, blend: 'multiply', blur: 0.5, ratio: 1.91, scan: 0.478 },
    ],
  },
  {
    image: 'starry',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: '1889',
    genre: 'landscape',
    width: 2600,
    height: 2059,
    days: [
      { shape: 'clover', cx: 521, cy: 1241, size: 40, angle: 12, fill: '#3c3626', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.44, scan: 0.625 },
      { shape: 'triangle', cx: 281, cy: 329, size: 37, angle: -25, fill: '#96a4da', opacity: 0.257, blend: 'screen', blur: 0.5, ratio: 1.52, scan: 0.515 },
      { shape: 'star', cx: 2321, cy: 497, size: 34, angle: -38, fill: '#4e491e', opacity: 0.297, blend: 'multiply', blur: 0.5, ratio: 1.21, scan: 0.464 },
      { shape: 'arrow', cx: 929, cy: 1049, size: 31, angle: -46, fill: '#505738', opacity: 0.293, blend: 'multiply', blur: 0.5, ratio: 1.44, scan: 0.431 },
      { shape: 'key', cx: 2369, cy: 953, size: 28, angle: 70, fill: '#485f3c', opacity: 0.476, blend: 'multiply', blur: 0.5, ratio: 1.91, scan: 0.408 },
      { shape: 'crescent', cx: 1553, cy: 161, size: 25, angle: -104, fill: '#3f4227', opacity: 0.571, blend: 'multiply', blur: 0.5, ratio: 1.71, scan: 0.399 },
      { shape: 'heart', cx: 1313, cy: 1841, size: 22, angle: 148, fill: '#8da9bd', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 0.96, scan: 0.372 },
    ],
  },
  {
    image: 'boating',
    title: 'Luncheon of the Boating Party',
    artist: 'Pierre-Auguste Renoir',
    year: '1881',
    genre: 'genre-scene',
    width: 2600,
    height: 1926,
    days: [
      { shape: 'triangle', cx: 233, cy: 617, size: 40, angle: -132, fill: '#d8aea9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.63, scan: 0.659 },
      { shape: 'snowflake', cx: 2249, cy: 1313, size: 37, angle: -155, fill: '#623f5d', opacity: 0.332, blend: 'multiply', blur: 0.5, ratio: 2.04, scan: 0.547 },
      { shape: 'star', cx: 185, cy: 1625, size: 34, angle: -106, fill: '#8fa2ba', opacity: 0.257, blend: 'screen', blur: 0.5, ratio: 1.74, scan: 0.492 },
      { shape: 'heart', cx: 593, cy: 1745, size: 31, angle: 46, fill: '#674972', opacity: 0.276, blend: 'multiply', blur: 0.5, ratio: 2.64, scan: 0.446 },
      { shape: 'anchor', cx: 1913, cy: 473, size: 28, angle: -70, fill: '#c0a99c', opacity: 0.379, blend: 'screen', blur: 0.5, ratio: 1.61, scan: 0.437 },
      { shape: 'fish', cx: 2177, cy: 137, size: 25, angle: 104, fill: '#90bcaf', opacity: 0.191, blend: 'screen', blur: 0.5, ratio: 1.75, scan: 0.417 },
      { shape: 'bolt', cx: 1505, cy: 1145, size: 22, angle: -148, fill: '#be99a7', opacity: 0.65, blend: 'screen', blur: 0.5, ratio: 1.97, scan: 0.392 },
    ],
  },
  {
    image: 'jatte',
    title: 'A Sunday on La Grande Jatte',
    artist: 'Georges Seurat',
    year: '1884',
    genre: 'genre-scene',
    width: 2600,
    height: 1731,
    days: [
      { shape: 'snowflake', cx: 2321, cy: 1409, size: 40, angle: -48, fill: '#211c2c', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.25, scan: 0.587 },
      { shape: 'star', cx: 2225, cy: 929, size: 37, angle: 47, fill: '#a8b0c7', opacity: 0.288, blend: 'screen', blur: 0.5, ratio: 1.66, scan: 0.48 },
      { shape: 'clover', cx: 257, cy: 1145, size: 34, angle: 34, fill: '#504d26', opacity: 0.28, blend: 'multiply', blur: 0.5, ratio: 1.63, scan: 0.433 },
      { shape: 'bolt', cx: 1145, cy: 1289, size: 31, angle: -46, fill: '#8c86b2', opacity: 0.265, blend: 'screen', blur: 0.5, ratio: 1.4, scan: 0.405 },
      { shape: 'arrow', cx: 1721, cy: 1577, size: 28, angle: 70, fill: '#95bba2', opacity: 0.205, blend: 'screen', blur: 0.5, ratio: 1.25, scan: 0.38 },
      { shape: 'key', cx: 161, cy: 137, size: 25, angle: -104, fill: '#4c7651', opacity: 0.563, blend: 'multiply', blur: 0.5, ratio: 1.74, scan: 0.374 },
      { shape: 'crescent', cx: 1337, cy: 857, size: 22, angle: 148, fill: '#5a3a3b', opacity: 0.354, blend: 'multiply', blur: 0.5, ratio: 1.06, scan: 0.345 },
    ],
  },
  {
    image: 'hunters',
    title: 'The Hunters in the Snow',
    artist: 'Pieter Bruegel the Elder',
    year: '1565',
    genre: 'landscape',
    width: 2600,
    height: 1850,
    days: [
      { shape: 'star', cx: 1649, cy: 305, size: 40, angle: -156, fill: '#232f1e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.24, scan: 0.756 },
      { shape: 'clover', cx: 2201, cy: 209, size: 37, angle: -155, fill: '#b4c6a6', opacity: 0.237, blend: 'screen', blur: 0.5, ratio: 3.31, scan: 0.624 },
      { shape: 'triangle', cx: 425, cy: 593, size: 34, angle: -34, fill: '#b3b389', opacity: 0.485, blend: 'screen', blur: 0.5, ratio: 1.9, scan: 0.571 },
      { shape: 'crescent', cx: 1457, cy: 1649, size: 31, angle: 46, fill: '#715b30', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.71, scan: 0.534 },
      { shape: 'heart', cx: 2081, cy: 1097, size: 28, angle: -70, fill: '#b8c19d', opacity: 0.379, blend: 'screen', blur: 0.5, ratio: 1.36, scan: 0.51 },
      { shape: 'anchor', cx: 449, cy: 1457, size: 25, angle: 104, fill: '#ac897e', opacity: 0.806, blend: 'screen', blur: 0.5, ratio: 1.51, scan: 0.488 },
      { shape: 'fish', cx: 137, cy: 1001, size: 22, angle: -148, fill: '#cda174', opacity: 0.543, blend: 'screen', blur: 0.5, ratio: 1.7, scan: 0.455 },
    ],
  },
  {
    image: 'issus',
    title: 'The Battle of Alexander at Issus',
    artist: 'Albrecht Altdorfer',
    year: '1529',
    genre: 'history',
    width: 2600,
    height: 3397,
    days: [
      { shape: 'clover', cx: 209, cy: 1481, size: 40, angle: 12, fill: '#344351', opacity: 1, blend: 'screen', blur: 0.5, ratio: 4.11, scan: 0.738 },
      { shape: 'triangle', cx: 449, cy: 1865, size: 37, angle: -145, fill: '#b39d88', opacity: 0.234, blend: 'screen', blur: 0.5, ratio: 3.06, scan: 0.612 },
      { shape: 'star', cx: 1073, cy: 1073, size: 34, angle: -38, fill: '#b4c9cf', opacity: 0.414, blend: 'screen', blur: 0.5, ratio: 3.07, scan: 0.548 },
      { shape: 'fish', cx: 2393, cy: 3065, size: 31, angle: -46, fill: '#cb9871', opacity: 0.3, blend: 'screen', blur: 0.5, ratio: 2.42, scan: 0.516 },
      { shape: 'bolt', cx: 281, cy: 3137, size: 28, angle: 70, fill: '#c7826c', opacity: 0.437, blend: 'screen', blur: 0.5, ratio: 2.38, scan: 0.484 },
      { shape: 'arrow', cx: 1673, cy: 497, size: 25, angle: -104, fill: '#8aaece', opacity: 0.465, blend: 'screen', blur: 0.5, ratio: 2.12, scan: 0.47 },
      { shape: 'key', cx: 2201, cy: 1577, size: 22, angle: 148, fill: '#a2bac3', opacity: 0.739, blend: 'screen', blur: 0.5, ratio: 1.58, scan: 0.44 },
    ],
  },
  {
    image: 'babel',
    title: 'The Tower of Babel',
    artist: 'Pieter Bruegel the Elder',
    year: '1563',
    genre: 'architecture',
    width: 2600,
    height: 2082,
    days: [
      { shape: 'triangle', cx: 545, cy: 209, size: 40, angle: 108, fill: '#c8dcdd', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 4.07, scan: 0.736 },
      { shape: 'snowflake', cx: 2081, cy: 1457, size: 37, angle: -35, fill: '#beaf7f', opacity: 0.315, blend: 'screen', blur: 0.5, ratio: 1.33, scan: 0.603 },
      { shape: 'star', cx: 2321, cy: 665, size: 34, angle: -106, fill: '#afcec0', opacity: 0.685, blend: 'screen', blur: 0.5, ratio: 2.16, scan: 0.542 },
      { shape: 'key', cx: 1793, cy: 809, size: 31, angle: 46, fill: '#d6a977', opacity: 0.554, blend: 'screen', blur: 0.5, ratio: 2.44, scan: 0.506 },
      { shape: 'crescent', cx: 2441, cy: 1841, size: 28, angle: -70, fill: '#2b7d79', opacity: 0.802, blend: 'multiply', blur: 0.5, ratio: 4.34, scan: 0.488 },
      { shape: 'heart', cx: 1961, cy: 329, size: 25, angle: 104, fill: '#436854', opacity: 0.3, blend: 'multiply', blur: 0.5, ratio: 1.27, scan: 0.468 },
      { shape: 'anchor', cx: 161, cy: 1073, size: 22, angle: -148, fill: '#8c9a45', opacity: 0.72, blend: 'multiply', blur: 0.5, ratio: 1.21, scan: 0.439 },
    ],
  },
  {
    image: 'deheem',
    title: 'Still Life with Fruit and a Self-Portrait',
    artist: 'Jan Davidsz. de Heem',
    year: '1628',
    genre: 'still-life',
    width: 2600,
    height: 2107,
    days: [
      { shape: 'snowflake', cx: 1961, cy: 1265, size: 40, angle: 72, fill: '#442822', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.3, scan: 0.622 },
      { shape: 'star', cx: 1289, cy: 593, size: 37, angle: 47, fill: '#dd6684', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 1.51, scan: 0.514 },
      { shape: 'clover', cx: 1529, cy: 1001, size: 34, angle: 34, fill: '#d16f85', opacity: 0.241, blend: 'screen', blur: 0.5, ratio: 1.91, scan: 0.455 },
      { shape: 'anchor', cx: 809, cy: 1793, size: 31, angle: -46, fill: '#d46584', opacity: 0.446, blend: 'screen', blur: 0.5, ratio: 1.54, scan: 0.431 },
      { shape: 'fish', cx: 233, cy: 761, size: 28, angle: 70, fill: '#cb896f', opacity: 0.135, blend: 'screen', blur: 0.5, ratio: 1.09, scan: 0.406 },
      { shape: 'bolt', cx: 2417, cy: 641, size: 25, angle: -104, fill: '#ccc1af', opacity: 0.532, blend: 'screen', blur: 0.5, ratio: 1.88, scan: 0.393 },
      { shape: 'arrow', cx: 449, cy: 1409, size: 22, angle: 148, fill: '#c49588', opacity: 0.315, blend: 'screen', blur: 0.5, ratio: 1.31, scan: 0.365 },
    ],
  },
];

/**
 * Short stable hash of the fields a player actually has to contend with. Cosmetic
 * edits to a title or an artist line deliberately do not change it; moving, resizing,
 * recolouring or replacing the hidden shape does.
 */
function fingerprint(image: string, key: string, t: Target): string {
  const canonical = [image, key, t.shape, t.cx, t.cy, t.size, t.angle, t.fill, t.opacity, t.blend].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Every day of every week, in order: index `w * 7 + d` is day `d` of week `w`, and day
 * 0 of a week is its Monday. `daily.ts` leans on that layout to line the list up with
 * the player's own calendar.
 */
export const PUZZLES: Puzzle[] = WEEKS.flatMap((week) =>
  week.days.map((target, day) => {
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
  }),
);

/** The distinct paintings, for tooling that works per asset rather than per day. */
export const IMAGES = WEEKS.map((w) => ({ id: w.image, width: w.width, height: w.height }));

/**
 * Every painting in the rotation, for the credits panel. All of them are in the public
 * domain; the scans come from Wikimedia Commons.
 */
export const CREDITS = WEEKS.map((w) => ({
  id: w.image,
  title: w.title,
  artist: w.artist,
  year: w.year,
  genre: w.genre,
}));

