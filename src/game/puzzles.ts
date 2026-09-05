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
  /**
   * Shrinks this painting's whole size ladder, Monday to Sunday, by this factor.
   *
   * Some paintings are simply more spottable than others, and no amount of tuning the
   * paint fixes it: on Seurat's large calm areas anything faint enough to be inconspicuous
   * at a glance is too faint to see once framed, so the tuner floors out and the day stays
   * easy. Measured with the corrected fitted-view reading (`npm run camouflage -- --fov`),
   * jatte's Monday came out 3.4x as conspicuous as a typical Monday while sitting exactly
   * on its scan target.
   *
   * Size is the way out, because it is the one input that changes how big a speck the
   * shape is while scanning without changing how it looks once framed -- at the match the
   * shape is always drawn at `targetDisplaySize` whatever this says. So a spottable
   * painting gets smaller shapes across the board.
   *
   * The floor is magnification, not taste: 0.73 puts Sunday at 16px, which is 5.5x native
   * at the match against the usual 4.0x. Much below that and the painting behind the shape
   * turns to mush.
   */
  sizeScale?: number;
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
      { shape: 'snowflake', cx: 1817, cy: 3353, size: 40, angle: -168, fill: '#2b130e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.491 },
      { shape: 'star', cx: 1937, cy: 1217, size: 37, angle: 47, fill: '#bfae7c', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 3.84, scan: 0.456 },
      { shape: 'clover', cx: 545, cy: 2681, size: 34, angle: 34, fill: '#c68d72', opacity: 0.437, blend: 'screen', blur: 0.5, ratio: 3.17, scan: 0.424 },
      { shape: 'key', cx: 161, cy: 1625, size: 31, angle: -46, fill: '#b9b792', opacity: 0.319, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.389 },
      { shape: 'crescent', cx: 569, cy: 3497, size: 28, angle: 70, fill: '#c07c76', opacity: 0.446, blend: 'screen', blur: 0.5, ratio: 1.61, scan: 0.381 },
      { shape: 'heart', cx: 2249, cy: 1793, size: 25, angle: -104, fill: '#e6c274', opacity: 0.34, blend: 'screen', blur: 0.5, ratio: 1.54, scan: 0.364 },
      { shape: 'anchor', cx: 1073, cy: 3473, size: 22, angle: 148, fill: '#ca776f', opacity: 0.41, blend: 'screen', blur: 0.5, ratio: 1.31, scan: 0.346 },
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
    sizeScale: 0.73,
    days: [
      { shape: 'star', cx: 449, cy: 209, size: 29, angle: -156, fill: '#f6edd9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.4, scan: 0.481 },
      { shape: 'clover', cx: 1313, cy: 977, size: 27, angle: -155, fill: '#8f7336', opacity: 0.327, blend: 'multiply', blur: 0.5, ratio: 2.58, scan: 0.457 },
      { shape: 'triangle', cx: 1865, cy: 1121, size: 25, angle: 86, fill: '#4b4730', opacity: 0.433, blend: 'multiply', blur: 0.5, ratio: 2.21, scan: 0.426 },
      { shape: 'anchor', cx: 905, cy: 521, size: 23, angle: 46, fill: '#83afd7', opacity: 0.543, blend: 'screen', blur: 0.5, ratio: 1.02, scan: 0.399 },
      { shape: 'fish', cx: 161, cy: 1409, size: 20, angle: -70, fill: '#436955', opacity: 0.54, blend: 'multiply', blur: 0.5, ratio: 1.05, scan: 0.385 },
      { shape: 'bolt', cx: 2273, cy: 1457, size: 18, angle: 104, fill: '#828f3d', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.07, scan: 0.363 },
      { shape: 'arrow', cx: 1745, cy: 1625, size: 16, angle: -148, fill: '#844f25', opacity: 0.668, blend: 'multiply', blur: 0.5, ratio: 1.42, scan: 0.34 },
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
      { shape: 'clover', cx: 521, cy: 1241, size: 40, angle: 12, fill: '#302a1e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.93, scan: 0.492 },
      { shape: 'triangle', cx: 281, cy: 329, size: 37, angle: -25, fill: '#96a4da', opacity: 0.23, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.462 },
      { shape: 'star', cx: 2321, cy: 497, size: 34, angle: -38, fill: '#4e491e', opacity: 0.273, blend: 'multiply', blur: 0.5, ratio: 1.12, scan: 0.43 },
      { shape: 'arrow', cx: 929, cy: 1049, size: 31, angle: -46, fill: '#505738', opacity: 0.28, blend: 'multiply', blur: 0.5, ratio: 1.36, scan: 0.4 },
      { shape: 'key', cx: 1769, cy: 1193, size: 28, angle: 70, fill: '#38573f', opacity: 0.441, blend: 'multiply', blur: 0.5, ratio: 1.06, scan: 0.378 },
      { shape: 'crescent', cx: 1025, cy: 353, size: 25, angle: -104, fill: '#abbdd5', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 1.07, scan: 0.36 },
      { shape: 'heart', cx: 2369, cy: 953, size: 22, angle: 148, fill: '#475f3d', opacity: 0.261, blend: 'multiply', blur: 0.5, ratio: 1.34, scan: 0.343 },
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
    sizeScale: 0.73,
    days: [
      { shape: 'triangle', cx: 233, cy: 617, size: 29, angle: -132, fill: '#e3c2bd', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.73, scan: 0.492 },
      { shape: 'snowflake', cx: 2249, cy: 1313, size: 27, angle: -155, fill: '#623f5d', opacity: 0.265, blend: 'multiply', blur: 0.5, ratio: 1.62, scan: 0.462 },
      { shape: 'star', cx: 185, cy: 1625, size: 25, angle: -106, fill: '#8fa2ba', opacity: 0.183, blend: 'screen', blur: 0.5, ratio: 1.31, scan: 0.438 },
      { shape: 'heart', cx: 593, cy: 1745, size: 23, angle: 46, fill: '#674972', opacity: 0.131, blend: 'multiply', blur: 0.5, ratio: 1.4, scan: 0.388 },
      { shape: 'anchor', cx: 1913, cy: 473, size: 20, angle: -70, fill: '#c0a99c', opacity: 0.327, blend: 'screen', blur: 0.5, ratio: 1.45, scan: 0.375 },
      { shape: 'fish', cx: 2177, cy: 137, size: 18, angle: 104, fill: '#90bcaf', opacity: 0.213, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.353 },
      { shape: 'bolt', cx: 1505, cy: 1145, size: 16, angle: -148, fill: '#be99a7', opacity: 0.711, blend: 'screen', blur: 0.5, ratio: 2.31, scan: 0.34 },
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
    sizeScale: 0.73,
    days: [
      { shape: 'snowflake', cx: 2273, cy: 1073, size: 29, angle: -48, fill: '#2a2c42', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.47, scan: 0.494 },
      { shape: 'star', cx: 1745, cy: 1577, size: 27, angle: 47, fill: '#98bdaa', opacity: 0.288, blend: 'screen', blur: 0.5, ratio: 1.71, scan: 0.452 },
      { shape: 'clover', cx: 281, cy: 1145, size: 25, angle: 34, fill: '#4f4c25', opacity: 0.304, blend: 'multiply', blur: 0.5, ratio: 1.84, scan: 0.434 },
      { shape: 'bolt', cx: 161, cy: 137, size: 23, angle: -46, fill: '#4c7651', opacity: 0.65, blend: 'multiply', blur: 0.5, ratio: 2.07, scan: 0.403 },
      { shape: 'arrow', cx: 737, cy: 137, size: 20, angle: 70, fill: '#394320', opacity: 0.269, blend: 'multiply', blur: 0.5, ratio: 1.33, scan: 0.383 },
      { shape: 'key', cx: 1121, cy: 1313, size: 18, angle: -104, fill: '#8986b1', opacity: 0.222, blend: 'screen', blur: 0.5, ratio: 1.02, scan: 0.362 },
      { shape: 'crescent', cx: 1841, cy: 449, size: 16, angle: 148, fill: '#494c30', opacity: 0.456, blend: 'multiply', blur: 0.5, ratio: 1.04, scan: 0.473 },
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
    sizeScale: 0.73,
    days: [
      { shape: 'star', cx: 1649, cy: 305, size: 29, angle: -156, fill: '#151c12', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.63, scan: 0.493 },
      { shape: 'clover', cx: 2201, cy: 209, size: 27, angle: -155, fill: '#b4c6a6', opacity: 0.198, blend: 'screen', blur: 0.5, ratio: 2.73, scan: 0.458 },
      { shape: 'triangle', cx: 425, cy: 593, size: 25, angle: -34, fill: '#b3b389', opacity: 0.437, blend: 'screen', blur: 0.5, ratio: 1.95, scan: 0.427 },
      { shape: 'crescent', cx: 1457, cy: 1649, size: 23, angle: 46, fill: '#69562d', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.65, scan: 0.401 },
      { shape: 'heart', cx: 2081, cy: 1097, size: 20, angle: -70, fill: '#b8c19d', opacity: 0.348, blend: 'screen', blur: 0.5, ratio: 2.02, scan: 0.383 },
      { shape: 'anchor', cx: 449, cy: 1457, size: 18, angle: 104, fill: '#ac897e', opacity: 0.664, blend: 'screen', blur: 0.5, ratio: 0.98, scan: 0.423 },
      { shape: 'fish', cx: 137, cy: 1001, size: 16, angle: -148, fill: '#cda174', opacity: 0.457, blend: 'screen', blur: 0.5, ratio: 1.41, scan: 0.344 },
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
      { shape: 'clover', cx: 209, cy: 1481, size: 40, angle: 12, fill: '#222d35', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.74, scan: 0.496 },
      { shape: 'triangle', cx: 449, cy: 1865, size: 37, angle: -145, fill: '#b39d88', opacity: 0.174, blend: 'screen', blur: 0.5, ratio: 2.25, scan: 0.442 },
      { shape: 'star', cx: 1073, cy: 1073, size: 34, angle: -38, fill: '#b4c9cf', opacity: 0.323, blend: 'screen', blur: 0.5, ratio: 2.38, scan: 0.426 },
      { shape: 'fish', cx: 2393, cy: 3065, size: 31, angle: -46, fill: '#cb9871', opacity: 0.249, blend: 'screen', blur: 0.5, ratio: 1.98, scan: 0.397 },
      { shape: 'bolt', cx: 281, cy: 3137, size: 28, angle: 70, fill: '#c7826c', opacity: 0.366, blend: 'screen', blur: 0.5, ratio: 1.99, scan: 0.379 },
      { shape: 'arrow', cx: 1673, cy: 497, size: 25, angle: -104, fill: '#8aaece', opacity: 0.35, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.355 },
      { shape: 'key', cx: 2201, cy: 1577, size: 22, angle: 148, fill: '#a2bac3', opacity: 0.575, blend: 'screen', blur: 0.5, ratio: 1.23, scan: 0.344 },
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
      { shape: 'triangle', cx: 545, cy: 209, size: 40, angle: 108, fill: '#dbe8e8', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.68, scan: 0.486 },
      { shape: 'snowflake', cx: 2081, cy: 1457, size: 37, angle: -35, fill: '#beaf7f', opacity: 0.237, blend: 'screen', blur: 0.5, ratio: 1, scan: 0.455 },
      { shape: 'star', cx: 2201, cy: 545, size: 34, angle: -106, fill: '#b3c4a3', opacity: 0.414, blend: 'screen', blur: 0.5, ratio: 1.44, scan: 0.432 },
      { shape: 'key', cx: 1793, cy: 809, size: 31, angle: 46, fill: '#d6a977', opacity: 0.433, blend: 'screen', blur: 0.5, ratio: 1.9, scan: 0.399 },
      { shape: 'crescent', cx: 2441, cy: 1841, size: 28, angle: -70, fill: '#2b7d79', opacity: 0.621, blend: 'multiply', blur: 0.5, ratio: 3.36, scan: 0.378 },
      { shape: 'heart', cx: 425, cy: 1097, size: 25, angle: 104, fill: '#939b43', opacity: 0.358, blend: 'multiply', blur: 0.5, ratio: 1.21, scan: 0.357 },
      { shape: 'anchor', cx: 2441, cy: 1169, size: 22, angle: -148, fill: '#667443', opacity: 0.446, blend: 'multiply', blur: 0.5, ratio: 1.46, scan: 0.342 },
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
    sizeScale: 0.73,
    days: [
      { shape: 'snowflake', cx: 1961, cy: 1265, size: 29, angle: 72, fill: '#331e19', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.66, scan: 0.495 },
      { shape: 'star', cx: 1289, cy: 593, size: 27, angle: 47, fill: '#dd6684', opacity: 0.237, blend: 'screen', blur: 0.5, ratio: 1.47, scan: 0.457 },
      { shape: 'clover', cx: 1529, cy: 1001, size: 25, angle: 34, fill: '#d16f85', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 1.79, scan: 0.429 },
      { shape: 'anchor', cx: 809, cy: 1793, size: 23, angle: -46, fill: '#d46584', opacity: 0.422, blend: 'screen', blur: 0.5, ratio: 1.61, scan: 0.401 },
      { shape: 'fish', cx: 233, cy: 761, size: 20, angle: 70, fill: '#cb896f', opacity: 0.148, blend: 'screen', blur: 0.5, ratio: 1.09, scan: 0.383 },
      { shape: 'bolt', cx: 2417, cy: 641, size: 18, angle: -104, fill: '#ccc1af', opacity: 0.507, blend: 'screen', blur: 0.5, ratio: 1.66, scan: 0.358 },
      { shape: 'arrow', cx: 449, cy: 1409, size: 16, angle: 148, fill: '#c49588', opacity: 0.35, blend: 'screen', blur: 0.5, ratio: 1.32, scan: 0.339 },
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

