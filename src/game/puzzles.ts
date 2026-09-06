import { buildWeek } from './build';
import type { Puzzle, Target } from './types';

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
  /**
   * The Wikimedia Commons file page for the scan `public/puzzles/<image>.jpg` was built
   * from. Every painting here is in the public domain; this says which scan of it.
   *
   * It is here because the scan itself is not kept. `.source-images/` is gitignored and
   * held the only copy, and the originals run to hundreds of megabytes -- Seurat's is
   * 310MB, Van Gogh's 664MB -- for a file used exactly once, by `resize-images.mjs`, to
   * make the 2600px asset that is committed and that everything downstream measures.
   * Deleting them costs nothing as long as the address survives, and *which* scan is the
   * whole question: a different scan of the same painting is a different crop, so
   * regenerating from the wrong one silently moves every hiding place in the week.
   * `SOURCE_SCANS` in `assets.test.ts` pins each entry to the dimensions it must have.
   */
  source: string;
  /**
   * Set when the shipped asset came from Commons' rendered thumbnail at this width
   * rather than the full-size original, so a re-download reproduces the same pixels:
   * `Special:FilePath/<file>?width=<sourceWidth>`. Both were already well above the
   * 2600px the asset is generated at.
   */
  sourceWidth?: number;
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
 * each rung is measured. Ten paintings is therefore ten weeks, not ten days.
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
    source: 'https://commons.wikimedia.org/wiki/File:Mona_Lisa.jpg',
    width: 2600,
    height: 3933,
    days: [
      { shape: 'snowflake', cx: 1817, cy: 3353, size: 40, angle: -168, fill: '#2b130e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.491 },
      { shape: 'star', cx: 1937, cy: 1217, size: 37, angle: 47, fill: '#bfae7c', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 3.84, scan: 0.456 },
      { shape: 'clover', cx: 545, cy: 2681, size: 34, angle: 34, fill: '#c68d72', opacity: 0.437, blend: 'screen', blur: 0.5, ratio: 3.17, scan: 0.424 },
      { shape: 'key', cx: 161, cy: 1625, size: 31, angle: -46, fill: '#b9b792', opacity: 0.319, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.389 },
      { shape: 'crescent', cx: 569, cy: 3497, size: 28, angle: 70, fill: '#c07c76', opacity: 0.457, blend: 'screen', blur: 0.5, ratio: 2.99, scan: 0.381 },
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
    source:
      'https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg',
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
    source:
      'https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    width: 2600,
    height: 2059,
    days: [
      { shape: 'clover', cx: 521, cy: 1241, size: 40, angle: 12, fill: '#302a1e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.42, scan: 0.492 },
      { shape: 'triangle', cx: 281, cy: 329, size: 37, angle: -25, fill: '#96a4da', opacity: 0.23, blend: 'screen', blur: 0.5, ratio: 1.61, scan: 0.462 },
      { shape: 'blossom', cx: 2321, cy: 497, size: 34, angle: -38, fill: '#4e491e', opacity: 0.191, blend: 'multiply', blur: 0.5, ratio: 1.1, scan: 0.436 },
      { shape: 'leaf', cx: 929, cy: 1049, size: 31, angle: -46, fill: '#505738', opacity: 0.218, blend: 'multiply', blur: 0.5, ratio: 1.43, scan: 0.407 },
      { shape: 'house', cx: 1769, cy: 1193, size: 28, angle: 70, fill: '#38573f', opacity: 0.265, blend: 'multiply', blur: 0.5, ratio: 1.17, scan: 0.384 },
      { shape: 'crown', cx: 1025, cy: 353, size: 25, angle: -104, fill: '#abbdd5', opacity: 0.252, blend: 'screen', blur: 0.5, ratio: 1.23, scan: 0.355 },
      { shape: 'spade', cx: 2369, cy: 953, size: 22, angle: 148, fill: '#475f3d', opacity: 0.3, blend: 'multiply', blur: 0.5, ratio: 1.97, scan: 0.343 },
    ],
  },
  {
    image: 'boating',
    title: 'Luncheon of the Boating Party',
    artist: 'Pierre-Auguste Renoir',
    year: '1881',
    genre: 'genre-scene',
    source:
      'https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg',
    sourceWidth: 3840,
    width: 2600,
    height: 1926,
    sizeScale: 0.73,
    days: [
      { shape: 'triangle', cx: 2249, cy: 1289, size: 29, angle: -132, fill: '#decbd9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.75, scan: 0.489 },
      { shape: 'blossom', cx: 185, cy: 1697, size: 27, angle: 97, fill: '#85a4bf', opacity: 0.183, blend: 'screen', blur: 0.5, ratio: 3.64, scan: 0.464 },
      { shape: 'cross', cx: 2177, cy: 137, size: 25, angle: -34, fill: '#90bcaf', opacity: 0.261, blend: 'screen', blur: 0.5, ratio: 3.27, scan: 0.429 },
      { shape: 'tree', cx: 1217, cy: 1697, size: 23, angle: 46, fill: '#8a5d44', opacity: 0.567, blend: 'multiply', blur: 0.5, ratio: 4.52, scan: 0.403 },
      { shape: 'note', cx: 1913, cy: 473, size: 20, angle: -70, fill: '#c0a89d', opacity: 0.288, blend: 'screen', blur: 0.5, ratio: 2.76, scan: 0.379 },
      { shape: 'key', cx: 1961, cy: 1601, size: 18, angle: 104, fill: '#6f3d32', opacity: 0.379, blend: 'multiply', blur: 0.5, ratio: 2.24, scan: 0.362 },
      { shape: 'crescent', cx: 353, cy: 665, size: 16, angle: -148, fill: '#6c4561', opacity: 0.218, blend: 'multiply', blur: 0.5, ratio: 2.37, scan: 0.342 },
    ],
  },
  {
    image: 'jatte',
    title: 'A Sunday on La Grande Jatte',
    artist: 'Georges Seurat',
    year: '1884',
    genre: 'genre-scene',
    source:
      'https://commons.wikimedia.org/wiki/File:A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg',
    width: 2600,
    height: 1731,
    sizeScale: 0.73,
    days: [
      { shape: 'blossom', cx: 2273, cy: 1073, size: 29, angle: -132, fill: '#202131', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.85, scan: 0.493 },
      { shape: 'cross', cx: 1745, cy: 1577, size: 27, angle: 155, fill: '#98bdaa', opacity: 0.241, blend: 'screen', blur: 0.5, ratio: 1.98, scan: 0.457 },
      { shape: 'star', cx: 281, cy: 1145, size: 25, angle: -38, fill: '#4f4c25', opacity: 0.315, blend: 'multiply', blur: 0.5, ratio: 2.71, scan: 0.428 },
      { shape: 'crescent', cx: 161, cy: 137, size: 23, angle: -46, fill: '#4c7651', opacity: 0.524, blend: 'multiply', blur: 0.5, ratio: 2.82, scan: 0.401 },
      { shape: 'heart', cx: 737, cy: 137, size: 20, angle: 70, fill: '#394320', opacity: 0.23, blend: 'multiply', blur: 0.5, ratio: 1.75, scan: 0.381 },
      { shape: 'anchor', cx: 1121, cy: 1313, size: 18, angle: -104, fill: '#8986b1', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 2.01, scan: 0.363 },
      { shape: 'fish', cx: 1841, cy: 449, size: 16, angle: 148, fill: '#494c30', opacity: 0.336, blend: 'multiply', blur: 0.5, ratio: 1.61, scan: 0.342 },
    ],
  },
  {
    image: 'hunters',
    title: 'The Hunters in the Snow',
    artist: 'Pieter Bruegel the Elder',
    year: '1565',
    genre: 'landscape',
    source:
      'https://commons.wikimedia.org/wiki/File:Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_(Winter)_-_Google_Art_Project.jpg',
    width: 2600,
    height: 1850,
    sizeScale: 0.73,
    days: [
      { shape: 'cross', cx: 1625, cy: 401, size: 29, angle: -12, fill: '#1c2819', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.18, scan: 0.504 },
      { shape: 'snowflake', cx: 2201, cy: 185, size: 27, angle: 85, fill: '#b3c5a4', opacity: 0.151, blend: 'screen', blur: 0.5, ratio: 2.55, scan: 0.469 },
      { shape: 'star', cx: 1457, cy: 1649, size: 25, angle: -106, fill: '#846b39', opacity: 0.802, blend: 'multiply', blur: 0.5, ratio: 3.57, scan: 0.43 },
      { shape: 'bolt', cx: 2393, cy: 1073, size: 23, angle: -134, fill: '#bdc4a2', opacity: 0.755, blend: 'screen', blur: 0.5, ratio: 2.71, scan: 0.402 },
      { shape: 'arrow', cx: 2057, cy: 1577, size: 20, angle: -70, fill: '#a5b388', opacity: 0.319, blend: 'screen', blur: 0.5, ratio: 1.67, scan: 0.379 },
      { shape: 'droplet', cx: 641, cy: 593, size: 18, angle: 104, fill: '#bcb697', opacity: 0.344, blend: 'screen', blur: 0.5, ratio: 1.64, scan: 0.362 },
      { shape: 'leaf', cx: 137, cy: 1001, size: 16, angle: -148, fill: '#cda376', opacity: 0.293, blend: 'screen', blur: 0.5, ratio: 1.57, scan: 0.347 },
    ],
  },
  {
    image: 'issus',
    title: 'The Battle of Alexander at Issus',
    artist: 'Albrecht Altdorfer',
    year: '1529',
    genre: 'history',
    source:
      'https://commons.wikimedia.org/wiki/File:Albrecht_Altdorfer_-_Schlacht_bei_Issus_(Alte_Pinakothek,_München)_-_Google_Art_Project.jpg',
    sourceWidth: 3840,
    width: 2600,
    height: 3397,
    days: [
      { shape: 'snowflake', cx: 209, cy: 1481, size: 40, angle: -168, fill: '#181f26', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.29, scan: 0.493 },
      { shape: 'star', cx: 449, cy: 1865, size: 37, angle: 47, fill: '#b39d88', opacity: 0.17, blend: 'screen', blur: 0.5, ratio: 2.6, scan: 0.455 },
      { shape: 'clover', cx: 1073, cy: 1073, size: 34, angle: -146, fill: '#b4c9cf', opacity: 0.3, blend: 'screen', blur: 0.5, ratio: 2.93, scan: 0.439 },
      { shape: 'house', cx: 2393, cy: 3065, size: 31, angle: -46, fill: '#cb9871', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 2.14, scan: 0.403 },
      { shape: 'crown', cx: 281, cy: 3137, size: 28, angle: 70, fill: '#c7826c', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 1.72, scan: 0.383 },
      { shape: 'spade', cx: 1673, cy: 497, size: 25, angle: -104, fill: '#8aaece', opacity: 0.276, blend: 'screen', blur: 0.5, ratio: 1.7, scan: 0.358 },
      { shape: 'tree', cx: 2201, cy: 1577, size: 22, angle: 148, fill: '#a2bac3', opacity: 0.41, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.345 },
    ],
  },
  {
    image: 'babel',
    title: 'The Tower of Babel',
    artist: 'Pieter Bruegel the Elder',
    year: '1563',
    genre: 'architecture',
    source:
      'https://commons.wikimedia.org/wiki/File:Pieter_Bruegel_the_Elder_-_The_Tower_of_Babel_(Rotterdam)_-_Google_Art_Project_-_edited.jpg',
    width: 2600,
    height: 2082,
    days: [
      { shape: 'star', cx: 545, cy: 209, size: 40, angle: -156, fill: '#d3e2e3', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 4.03, scan: 0.5 },
      { shape: 'clover', cx: 2081, cy: 1457, size: 37, angle: 25, fill: '#beaf7f', opacity: 0.245, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.456 },
      { shape: 'triangle', cx: 2201, cy: 545, size: 34, angle: 86, fill: '#b3c4a3', opacity: 0.375, blend: 'screen', blur: 0.5, ratio: 1.8, scan: 0.43 },
      { shape: 'note', cx: 1793, cy: 809, size: 31, angle: 46, fill: '#d6a977', opacity: 0.366, blend: 'screen', blur: 0.5, ratio: 2.57, scan: 0.398 },
      { shape: 'diamond', cx: 2441, cy: 1841, size: 28, angle: 110, fill: '#2b7d79', opacity: 0.383, blend: 'multiply', blur: 0.5, ratio: 3.88, scan: 0.381 },
      { shape: 'key', cx: 425, cy: 1097, size: 25, angle: 104, fill: '#939b43', opacity: 0.72, blend: 'multiply', blur: 0.5, ratio: 2.6, scan: 0.361 },
      { shape: 'crescent', cx: 2441, cy: 1169, size: 22, angle: -148, fill: '#667443', opacity: 0.586, blend: 'multiply', blur: 0.5, ratio: 4.09, scan: 0.341 },
    ],
  },
  {
    image: 'deheem',
    title: 'Still Life with Fruit and a Self-Portrait',
    artist: 'Jan Davidsz. de Heem',
    year: '1628',
    genre: 'still-life',
    source:
      'https://commons.wikimedia.org/wiki/File:Jan_Davidsz._de_Heem_-_Still_life_with_fruit_and_a_self-portrait.jpg',
    width: 2600,
    height: 2107,
    sizeScale: 0.73,
    days: [
      { shape: 'clover', cx: 2441, cy: 1721, size: 29, angle: -168, fill: '#342221', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.44, scan: 0.493 },
      { shape: 'triangle', cx: 1793, cy: 1217, size: 27, angle: -25, fill: '#c07a78', opacity: 0.155, blend: 'screen', blur: 0.5, ratio: 2.23, scan: 0.466 },
      { shape: 'blossom', cx: 641, cy: 1793, size: 25, angle: -38, fill: '#cc6982', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 2.11, scan: 0.433 },
      { shape: 'heart', cx: 233, cy: 761, size: 23, angle: -46, fill: '#cb8c70', opacity: 0.14, blend: 'screen', blur: 0.5, ratio: 1.6, scan: 0.408 },
      { shape: 'anchor', cx: 2201, cy: 689, size: 20, angle: 70, fill: '#c9bcaa', opacity: 0.315, blend: 'screen', blur: 0.5, ratio: 1.94, scan: 0.378 },
      { shape: 'fish', cx: 1049, cy: 689, size: 18, angle: -104, fill: '#cd8283', opacity: 0.422, blend: 'screen', blur: 0.5, ratio: 2.27, scan: 0.361 },
      { shape: 'arrow', cx: 1457, cy: 905, size: 16, angle: 148, fill: '#da6b87', opacity: 0.323, blend: 'screen', blur: 0.5, ratio: 2.89, scan: 0.335 },
    ],
  },
  {
    image: 'venice',
    title: 'The Entrance to the Grand Canal, Venice',
    artist: 'Canaletto',
    year: 'c. 1730',
    genre: 'cityscape',
    source:
      'https://commons.wikimedia.org/wiki/File:Canaletto_-_The_Entrance_to_the_Grand_Canal,_Venice_-_Google_Art_Project.jpg',
    width: 2600,
    height: 1773,
    days: [
      { shape: 'triangle', cx: 2249, cy: 449, size: 40, angle: -132, fill: '#c8d2dc', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 3.35, scan: 0.496 },
      { shape: 'blossom', cx: 1073, cy: 1073, size: 37, angle: 97, fill: '#c3a990', opacity: 0.284, blend: 'screen', blur: 0.5, ratio: 1.79, scan: 0.456 },
      { shape: 'cross', cx: 185, cy: 425, size: 34, angle: 146, fill: '#448178', opacity: 0.112, blend: 'multiply', blur: 0.5, ratio: 2.09, scan: 0.43 },
      { shape: 'arrow', cx: 1961, cy: 1601, size: 31, angle: 46, fill: '#bed1b7', opacity: 0.249, blend: 'screen', blur: 0.5, ratio: 2.4, scan: 0.396 },
      { shape: 'droplet', cx: 257, cy: 1265, size: 28, angle: -70, fill: '#b29f87', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 0.97, scan: 0.381 },
      { shape: 'leaf', cx: 1601, cy: 569, size: 25, angle: 104, fill: '#5f9e39', opacity: 0.158, blend: 'multiply', blur: 0.5, ratio: 1.01, scan: 0.355 },
      { shape: 'house', cx: 1961, cy: 977, size: 22, angle: -148, fill: '#e2c28a', opacity: 0.311, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.337 },
    ],
  },
];

/**
 * Every day of every week, in order: index `w * 7 + d` is day `d` of week `w`, and day
 * 0 of a week is its Monday. `daily.ts` leans on that layout to line the list up with
 * the player's own calendar.
 */
export const PUZZLES: Puzzle[] = WEEKS.flatMap(buildWeek);

/** The distinct paintings, for tooling that works per asset rather than per day. */
export const IMAGES = WEEKS.map((w) => ({
  id: w.image,
  width: w.width,
  height: w.height,
  source: w.source,
  sourceWidth: w.sourceWidth,
}));

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

