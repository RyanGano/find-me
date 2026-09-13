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
   * How much of this canvas carries detail at the scale of the shape -- how much there is
   * to stop and check on the way to the right thing. Measured by `npm run busyness` and
   * written here; it moves every day's scan target, because a busy painting is already
   * supplying difficulty the rung did not ask for. See `CLUTTER_WEIGHT` in difficulty.ts.
   */
  clutter?: number;
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
 * each rung is measured. Nineteen paintings is therefore nineteen weeks, not nineteen days.
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
    clutter: 0.393,
    days: [
      { shape: 'snowflake', cx: 1817, cy: 3353, size: 40, angle: -168, fill: '#2b130e', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.491, dim: 0.888 },
      { shape: 'star', cx: 1937, cy: 1217, size: 37, angle: 47, fill: '#bfae7c', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 3.84, scan: 0.456, dim: 0.828 },
      { shape: 'clover', cx: 545, cy: 2681, size: 34, angle: 34, fill: '#c68d72', opacity: 0.437, blend: 'screen', blur: 0.5, ratio: 3.17, scan: 0.424, dim: 0.886 },
      { shape: 'key', cx: 161, cy: 1625, size: 31, angle: -46, fill: '#b9b792', opacity: 0.319, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.389, dim: 0.774 },
      { shape: 'crescent', cx: 569, cy: 3497, size: 28, angle: 70, fill: '#c07c76', opacity: 0.457, blend: 'screen', blur: 0.5, ratio: 2.99, scan: 0.381, dim: 0.861 },
      { shape: 'heart', cx: 2249, cy: 1793, size: 25, angle: -104, fill: '#e6c274', opacity: 0.34, blend: 'screen', blur: 0.5, ratio: 1.54, scan: 0.364, dim: 0.609 },
      { shape: 'anchor', cx: 1073, cy: 3473, size: 22, angle: 148, fill: '#ca776f', opacity: 0.41, blend: 'screen', blur: 0.5, ratio: 1.31, scan: 0.346, dim: 0.858 },
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
    clutter: 0.581,
    days: [
      { shape: 'star', cx: 449, cy: 209, size: 29, angle: -156, fill: '#f6edd9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.4, scan: 0.481, dim: 0.12 },
      { shape: 'clover', cx: 1313, cy: 977, size: 27, angle: -155, fill: '#8f7336', opacity: 0.327, blend: 'multiply', blur: 0.5, ratio: 2.58, scan: 0.457, dim: 0.123 },
      { shape: 'triangle', cx: 1865, cy: 1121, size: 25, angle: 86, fill: '#4b4730', opacity: 0.433, blend: 'multiply', blur: 0.5, ratio: 2.21, scan: 0.426, dim: 0.427 },
      { shape: 'anchor', cx: 905, cy: 521, size: 23, angle: 46, fill: '#83afd7', opacity: 0.543, blend: 'screen', blur: 0.5, ratio: 1.02, scan: 0.399, dim: 0.692 },
      { shape: 'fish', cx: 161, cy: 1409, size: 20, angle: -70, fill: '#436955', opacity: 0.54, blend: 'multiply', blur: 0.5, ratio: 1.05, scan: 0.385, dim: 0.206 },
      { shape: 'bolt', cx: 2273, cy: 1457, size: 18, angle: 104, fill: '#828f3d', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.07, scan: 0.363, dim: 0.123 },
      { shape: 'arrow', cx: 1745, cy: 1625, size: 16, angle: -148, fill: '#844f25', opacity: 0.668, blend: 'multiply', blur: 0.5, ratio: 1.42, scan: 0.34, dim: 0.237 },
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
    clutter: 0.732,
    days: [
      { shape: 'clover', cx: 521, cy: 1289, size: 40, angle: 12, fill: '#2a2b1c', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.27, scan: 0.49, dim: 0.878 },
      { shape: 'triangle', cx: 2345, cy: 497, size: 37, angle: -25, fill: '#4e471a', opacity: 0.284, blend: 'multiply', blur: 0.5, ratio: 1.43, scan: 0.531, dim: 0.329 },
      { shape: 'blossom', cx: 929, cy: 1049, size: 34, angle: -38, fill: '#505737', opacity: 0.261, blend: 'multiply', blur: 0.5, ratio: 1.74, scan: 0.508, dim: 0.334 },
      { shape: 'leaf', cx: 2273, cy: 977, size: 31, angle: -46, fill: '#385657', opacity: 0.348, blend: 'multiply', blur: 0.5, ratio: 2.17, scan: 0.481, dim: 0.348 },
      { shape: 'house', cx: 353, cy: 305, size: 28, angle: 70, fill: '#94a0d6', opacity: 0.23, blend: 'screen', blur: 0.5, ratio: 1.79, scan: 0.502, dim: 0.705 },
      { shape: 'crown', cx: 1025, cy: 353, size: 25, angle: -104, fill: '#abbdd5', opacity: 0.35, blend: 'screen', blur: 0.5, ratio: 1.78, scan: 0.459, dim: 0.56, cover: 0.5, base: '#4d6e9a' },
      { shape: 'spade', cx: 305, cy: 833, size: 22, angle: 148, fill: '#32434e', opacity: 0.405, blend: 'multiply', blur: 0.5, ratio: 2.56, scan: 0.43, dim: 0.48, cover: 0.5, base: '#7f919d' },
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
    clutter: 0.544,
    days: [
      { shape: 'star', cx: 1217, cy: 1745, size: 29, angle: -156, fill: '#be9978', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 4.95, scan: 0.384, dim: 0.117 },
      { shape: 'hourglass', cx: 185, cy: 1697, size: 27, angle: -155, fill: '#85a4bf', opacity: 0.195, blend: 'screen', blur: 0.5, ratio: 4.76, scan: 0.429, dim: 0.806, cover: 0.5, base: '#213240' },
      { shape: 'arrow', cx: 2177, cy: 137, size: 25, angle: -34, fill: '#90bcaf', opacity: 0.218, blend: 'screen', blur: 0.5, ratio: 2.68, scan: 0.392, dim: 0.755, cover: 0.5, base: '#2b483f' },
      { shape: 'fish', cx: 2249, cy: 1289, size: 23, angle: 46, fill: '#5f3d5a', opacity: 0.195, blend: 'multiply', blur: 0.5, ratio: 2.25, scan: 0.318, dim: 0.344, cover: 0.5, base: '#b3a9b1' },
      { shape: 'spade', cx: 1913, cy: 473, size: 20, angle: -70, fill: '#c0a89d', opacity: 0.209, blend: 'screen', blur: 0.5, ratio: 1.99, scan: 0.336, dim: 0.727, cover: 0.5, base: '#5a473e' },
      { shape: 'cloud', cx: 1961, cy: 1601, size: 18, angle: 104, fill: '#6f3d32', opacity: 0.222, blend: 'multiply', blur: 0.5, ratio: 1.48, scan: 0.3, dim: 0.372, cover: 0.5, base: '#d0a095' },
      { shape: 'note', cx: 329, cy: 593, size: 16, angle: -148, fill: '#66414b', opacity: 0.241, blend: 'multiply', blur: 0.5, ratio: 2.24, scan: 0.299, dim: 0.331, cover: 0.5, base: '#c6afb5' },
    ],
  },
  {
    image: 'haywain',
    title: 'The Hay Wain',
    artist: 'John Constable',
    year: '1821',
    genre: 'landscape',
    source: 'https://commons.wikimedia.org/wiki/File:John_Constable_-_The_Hay_Wain_(1821).jpg',
    width: 2600,
    height: 1793,
    clutter: 0.496,
    days: [
      { shape: 'heart', cx: 1457, cy: 497, size: 40, angle: 12, fill: '#e8ebf0', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.28, scan: 0.367, dim: 0.459 },
      { shape: 'snowflake', cx: 2345, cy: 353, size: 37, angle: 155, fill: '#313e52', opacity: 0.371, blend: 'multiply', blur: 0.5, ratio: 3.4, scan: 0.347, dim: 0.462, cover: 0.5, base: '#768bae' },
      { shape: 'anchor', cx: 2081, cy: 1457, size: 34, angle: 34, fill: '#b89b7f', opacity: 0.104, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.365, dim: 0.87, cover: 0.5, base: '#2b2118' },
      { shape: 'umbrella', cx: 449, cy: 1289, size: 31, angle: -46, fill: '#c69278', opacity: 0.166, blend: 'screen', blur: 0.5, ratio: 1.29, scan: 0.326, dim: 0.865, cover: 0.5, base: '#3b2419' },
      { shape: 'bolt', cx: 353, cy: 785, size: 28, angle: -110, fill: '#b99087', opacity: 0.234, blend: 'screen', blur: 0.5, ratio: 2.12, scan: 0.314, dim: 0.84, cover: 0.5, base: '#372420' },
      { shape: 'house', cx: 2417, cy: 785, size: 25, angle: -104, fill: '#3a4a5b', opacity: 0.15, blend: 'multiply', blur: 0.5, ratio: 1.07, scan: 0.342, dim: 0.299, cover: 0.5, base: '#97a6b6' },
      { shape: 'puzzle', cx: 425, cy: 185, size: 22, angle: 148, fill: '#b1cdba', opacity: 0.205, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.295, dim: 0.555, cover: 0.5, base: '#6e7570' },
    ],
  },
  {
    image: 'rainy',
    title: 'Paris Street; Rainy Day',
    artist: 'Gustave Caillebotte',
    year: '1877',
    genre: 'cityscape',
    source:
      'https://commons.wikimedia.org/wiki/File:Gustave_Caillebotte_-_Paris_Street;_Rainy_Day_-_Google_Art_Project.jpg',
    width: 2600,
    height: 1969,
    clutter: 0.338,
    days: [
      { shape: 'bone', cx: 2177, cy: 1697, size: 40, angle: 168, fill: '#17140d', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.67, scan: 0.324, dim: 0.781 },
      { shape: 'clover', cx: 1697, cy: 353, size: 37, angle: -155, fill: '#7d703d', opacity: 0.174, blend: 'multiply', blur: 0.5, ratio: 3.18, scan: 0.295, dim: 0.161, cover: 0.5, base: '#dfd8bd' },
      { shape: 'crown', cx: 1121, cy: 1769, size: 34, angle: -34, fill: '#5f6a43', opacity: 0.344, blend: 'multiply', blur: 0.5, ratio: 3.18, scan: 0.301, dim: 0.233, cover: 0.5, base: '#c4cab7' },
      { shape: 'sailboat', cx: 1577, cy: 1361, size: 31, angle: 46, fill: '#a4c0c5', opacity: 0.162, blend: 'screen', blur: 0.5, ratio: 1.64, scan: 0.294, dim: 0.68, cover: 0.5, base: '#545d5f' },
      { shape: 'crescent', cx: 2345, cy: 905, size: 28, angle: -70, fill: '#4a342f', opacity: 0.222, blend: 'multiply', blur: 0.5, ratio: 1.59, scan: 0.302, dim: 0.503, cover: 0.5, base: '#997a73' },
      { shape: 'apple', cx: 137, cy: 305, size: 25, angle: 104, fill: '#5f553b', opacity: 0.327, blend: 'multiply', blur: 0.5, ratio: 2.58, scan: 0.295, dim: 0.355, cover: 0.5, base: '#beb398' },
      { shape: 'butterfly', cx: 1121, cy: 809, size: 22, angle: -148, fill: '#3c4e5d', opacity: 0.276, blend: 'multiply', blur: 0.5, ratio: 1.74, scan: 0.298, dim: 0.383, cover: 0.5, base: '#a2abb2' },
    ],
  },
  {
    image: 'breezing',
    title: 'Breezing Up (A Fair Wind)',
    artist: 'Winslow Homer',
    year: '1876',
    genre: 'seascape',
    source:
      'https://commons.wikimedia.org/wiki/File:Winslow_Homer_-_Breezing_Up_(A_Fair_Wind)_-_Google_Art_Project.jpg',
    width: 2600,
    height: 1634,
    clutter: 0.365,
    days: [
      { shape: 'sun', cx: 1697, cy: 665, size: 40, angle: 102, fill: '#e7e5d9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.45, scan: 0.294, dim: 0.504 },
      { shape: 'droplet', cx: 497, cy: 329, size: 37, angle: -25, fill: '#c7c1a7', opacity: 0.062, blend: 'screen', blur: 0.5, ratio: 1.08, scan: 0.336, dim: 0.575, cover: 0.5, base: '#6d6752' },
      { shape: 'star', cx: 233, cy: 1457, size: 34, angle: -38, fill: '#9cb78f', opacity: 0.088, blend: 'screen', blur: 0.5, ratio: 1.2, scan: 0.287, dim: 0.779, cover: 0.5, base: '#2f3d29' },
      { shape: 'crown', cx: 1193, cy: 1433, size: 31, angle: -46, fill: '#b3b288', opacity: 0.088, blend: 'screen', blur: 0.5, ratio: 0.97, scan: 0.29, dim: 0.798, cover: 0.5, base: '#2d2d20' },
      { shape: 'bone', cx: 905, cy: 785, size: 28, angle: -110, fill: '#cec4b3', opacity: 0.205, blend: 'screen', blur: 0.5, ratio: 2.2, scan: 0.299, dim: 0.547, cover: 0.5, base: '#8c7b5e' },
      { shape: 'key', cx: 1793, cy: 1241, size: 25, angle: -104, fill: '#a8bb95', opacity: 0.218, blend: 'screen', blur: 0.5, ratio: 1.75, scan: 0.301, dim: 0.717, cover: 0.5, base: '#3e4536' },
      { shape: 'spade', cx: 737, cy: 1409, size: 22, angle: 148, fill: '#aebd97', opacity: 0.117, blend: 'screen', blur: 0.5, ratio: 0.95, scan: 0.348, dim: 0.721, cover: 0.5, base: '#444c37' },
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
    clutter: 0.685,
    days: [
      { shape: 'arrow', cx: 1097, cy: 1577, size: 29, angle: -12, fill: '#20322a', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.02, scan: 0.575, dim: 0.787 },
      { shape: 'cross', cx: 569, cy: 161, size: 27, angle: 25, fill: '#3f421d', opacity: 0.252, blend: 'multiply', blur: 0.5, ratio: 1.85, scan: 0.505, dim: 0.448, cover: 0.5, base: '#8c9440' },
      { shape: 'blossom', cx: 2273, cy: 1025, size: 25, angle: -106, fill: '#a4a7c5', opacity: 0.241, blend: 'screen', blur: 0.5, ratio: 2.08, scan: 0.494, dim: 0.675, cover: 0.5, base: '#4a4d69' },
      { shape: 'bell', cx: 1745, cy: 1577, size: 23, angle: 46, fill: '#98bdaa', opacity: 0.209, blend: 'screen', blur: 0.5, ratio: 1.69, scan: 0.479, dim: 0.75, cover: 0.5, base: '#3a4e43' },
      { shape: 'diamond', cx: 449, cy: 1457, size: 20, angle: 110, fill: '#c9abaf', opacity: 0.201, blend: 'screen', blur: 0.5, ratio: 1.5, scan: 0.443, dim: 0.623, cover: 0.5, base: '#795358' },
      { shape: 'crown', cx: 1745, cy: 257, size: 18, angle: 104, fill: '#a0c2b1', opacity: 0.41, blend: 'screen', blur: 0.5, ratio: 2.16, scan: 0.434, dim: 0.663, cover: 0.5, base: '#455f51' },
      { shape: 'house', cx: 1505, cy: 1073, size: 16, angle: -148, fill: '#a6b1c6', opacity: 0.308, blend: 'screen', blur: 0.5, ratio: 2.08, scan: 0.411, dim: 0.625, cover: 0.5, base: '#4e586a' },
    ],
  },
  {
    image: 'montmartre',
    title: 'The Boulevard Montmartre at Night',
    artist: 'Camille Pissarro',
    year: '1897',
    genre: 'cityscape',
    source:
      'https://commons.wikimedia.org/wiki/File:Camille_Pissarro_-_Boulevard_Montmartre_at_Night_-_c_1897_-_National_Gallery_UK.jpg',
    width: 2600,
    height: 2137,
    clutter: 0.461,
    days: [
      { shape: 'cross', cx: 2033, cy: 401, size: 40, angle: -168, fill: '#030a0f', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.26, scan: 0.377, dim: 0.887 },
      { shape: 'bone', cx: 809, cy: 233, size: 37, angle: 155, fill: '#79abc4', opacity: 0.065, blend: 'screen', blur: 0.5, ratio: 1.35, scan: 0.382, dim: 0.831, cover: 0.5, base: '#192e39' },
      { shape: 'star', cx: 1313, cy: 1865, size: 34, angle: -38, fill: '#c3bfa1', opacity: 0.179, blend: 'screen', blur: 0.5, ratio: 2.43, scan: 0.311, dim: 0.666, cover: 0.5, base: '#5a594f' },
      { shape: 'spade', cx: 2081, cy: 857, size: 31, angle: -46, fill: '#bfaa9a', opacity: 0.095, blend: 'screen', blur: 0.5, ratio: 0.95, scan: 0.343, dim: 0.727, cover: 0.5, base: '#53463c' },
      { shape: 'butterfly', cx: 1457, cy: 1049, size: 28, angle: 70, fill: '#899bba', opacity: 0.158, blend: 'screen', blur: 0.5, ratio: 1.26, scan: 0.298, dim: 0.821, cover: 0.5, base: '#232c3b' },
      { shape: 'crescent', cx: 473, cy: 929, size: 25, angle: -104, fill: '#7f97bc', opacity: 0.155, blend: 'screen', blur: 0.5, ratio: 1.26, scan: 0.305, dim: 0.842, cover: 0.5, base: '#1a2331' },
      { shape: 'umbrella', cx: 1745, cy: 1865, size: 22, angle: 148, fill: '#beb89a', opacity: 0.195, blend: 'screen', blur: 0.5, ratio: 1.33, scan: 0.303, dim: 0.699, cover: 0.5, base: '#4f4c3e' },
    ],
  },
  {
    image: 'cardplayers',
    title: 'The Card Players',
    artist: 'Paul Cézanne',
    year: 'c. 1890',
    genre: 'genre-scene',
    source: 'https://commons.wikimedia.org/wiki/File:Cezanne_The_Card_Players_Metmuseum.jpg',
    width: 2600,
    height: 2070,
    clutter: 0.439,
    days: [
      { shape: 'snowflake', cx: 2177, cy: 1625, size: 40, angle: 48, fill: '#141420', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.19, scan: 0.364, dim: 0.79 },
      { shape: 'cloud', cx: 1409, cy: 329, size: 37, angle: 25, fill: '#5b553a', opacity: 0.104, blend: 'multiply', blur: 0.5, ratio: 1.6, scan: 0.303, dim: 0.355, cover: 0.5, base: '#b3ae98' },
      { shape: 'blossom', cx: 449, cy: 1217, size: 34, angle: -106, fill: '#b4a289', opacity: 0.06, blend: 'screen', blur: 0.5, ratio: 1.04, scan: 0.308, dim: 0.812, cover: 0.5, base: '#2d2925' },
      { shape: 'key', cx: 161, cy: 401, size: 31, angle: 46, fill: '#c4ceb2', opacity: 0.375, blend: 'screen', blur: 0.5, ratio: 3.12, scan: 0.302, dim: 0.491, cover: 0.5, base: '#788561' },
      { shape: 'heart', cx: 2105, cy: 689, size: 28, angle: -70, fill: '#b49c89', opacity: 0.135, blend: 'screen', blur: 0.5, ratio: 1.35, scan: 0.298, dim: 0.789, cover: 0.5, base: '#2c2825' },
      { shape: 'sailboat', cx: 929, cy: 1913, size: 25, angle: 104, fill: '#b7a88f', opacity: 0.362, blend: 'screen', blur: 0.5, ratio: 2.33, scan: 0.297, dim: 0.758, cover: 0.5, base: '#38342d' },
      { shape: 'fish', cx: 665, cy: 833, size: 22, angle: -148, fill: '#b7a88f', opacity: 0.191, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.303, dim: 0.748, cover: 0.5, base: '#3c352a' },
    ],
  },
  {
    image: 'fishstall',
    title: 'Fish Stall',
    artist: 'Frans Snyders',
    year: 'c. 1620',
    genre: 'still-life',
    source: 'https://commons.wikimedia.org/wiki/File:Frans_Snyders_-_Fish_Stall_-_WGA21521.jpg',
    width: 2600,
    height: 1597,
    clutter: 0.492,
    days: [
      { shape: 'hourglass', cx: 833, cy: 1265, size: 40, angle: -168, fill: '#110e17', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.41, scan: 0.413, dim: 0.89 },
      { shape: 'triangle', cx: 1913, cy: 377, size: 37, angle: 95, fill: '#908ab4', opacity: 0.119, blend: 'screen', blur: 0.5, ratio: 1.68, scan: 0.387, dim: 0.861, cover: 0.5, base: '#2a2a2b' },
      { shape: 'heart', cx: 1217, cy: 305, size: 34, angle: 34, fill: '#c0aa9a', opacity: 0.096, blend: 'screen', blur: 0.5, ratio: 1.32, scan: 0.335, dim: 0.711, cover: 0.5, base: '#594638' },
      { shape: 'diamond', cx: 1817, cy: 1385, size: 31, angle: 134, fill: '#bda097', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 1.58, scan: 0.329, dim: 0.803, cover: 0.5, base: '#4d3c37' },
      { shape: 'tree', cx: 497, cy: 545, size: 28, angle: 70, fill: '#7f9aad', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 1.05, scan: 0.316, dim: 0.856, cover: 0.5, base: '#141617' },
      { shape: 'bell', cx: 1337, cy: 1049, size: 25, angle: -104, fill: '#b48aa0', opacity: 0.226, blend: 'screen', blur: 0.5, ratio: 1.07, scan: 0.411, dim: 0.778, cover: 0.5, base: '#2a2829' },
      { shape: 'leaf', cx: 2393, cy: 809, size: 22, angle: 148, fill: '#cba588', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 1.19, scan: 0.303, dim: 0.766, cover: 0.5, base: '#5b3e28' },
    ],
  },
  {
    image: 'streltsy',
    title: 'Morning of the Streltsy Execution',
    artist: 'Vasily Surikov',
    year: '1881',
    genre: 'history',
    source: 'https://commons.wikimedia.org/wiki/File:Vasily_Surikov_-_Утро_стрелецкой_казни_-_Google_Art_Project.jpg',
    width: 2600,
    height: 1496,
    clutter: 0.575,
    days: [
      { shape: 'arrow', cx: 1745, cy: 1217, size: 40, angle: -12, fill: '#21120d', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.29, scan: 0.496, dim: 0.879 },
      { shape: 'star', cx: 1121, cy: 209, size: 37, angle: 97, fill: '#9ec1b8', opacity: 0.166, blend: 'screen', blur: 0.5, ratio: 2, scan: 0.435, dim: 0.668, cover: 0.5, base: '#485451' },
      { shape: 'anchor', cx: 2129, cy: 185, size: 34, angle: -34, fill: '#4b577f', opacity: 0.135, blend: 'multiply', blur: 0.5, ratio: 3.05, scan: 0.342, dim: 0.127, cover: 0.5, base: '#d9dde9' },
      { shape: 'key', cx: 977, cy: 1289, size: 31, angle: 46, fill: '#c0906e', opacity: 0.191, blend: 'screen', blur: 0.5, ratio: 2.56, scan: 0.407, dim: 0.891, cover: 0.5, base: '#22170f' },
      { shape: 'bone', cx: 497, cy: 425, size: 28, angle: 110, fill: '#afba90', opacity: 0.332, blend: 'screen', blur: 0.5, ratio: 2.16, scan: 0.369, dim: 0.734, cover: 0.5, base: '#3d442a' },
      { shape: 'note', cx: 329, cy: 1193, size: 25, angle: 104, fill: '#ebb145', opacity: 0.14, blend: 'screen', blur: 0.5, ratio: 1.71, scan: 0.364, dim: 0.88, cover: 0.5, base: '#302105' },
      { shape: 'house', cx: 1985, cy: 713, size: 22, angle: -148, fill: '#95bba0', opacity: 0.17, blend: 'screen', blur: 0.5, ratio: 1.05, scan: 0.328, dim: 0.749, cover: 0.5, base: '#3a423c' },
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
    clutter: 0.657,
    days: [
      { shape: 'tree', cx: 2201, cy: 185, size: 29, angle: 12, fill: '#1b2115', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.08, scan: 0.54, dim: 0.603 },
      { shape: 'anchor', cx: 1745, cy: 209, size: 27, angle: -25, fill: '#b2c9ab', opacity: 0.123, blend: 'screen', blur: 0.5, ratio: 2.03, scan: 0.492, dim: 0.573, cover: 0.5, base: '#60735a' },
      { shape: 'clover', cx: 1457, cy: 1649, size: 25, angle: -146, fill: '#846b39', opacity: 0.974, blend: 'multiply', blur: 0.5, ratio: 4.27, scan: 0.423, dim: 0.213, cover: 0.5, base: '#e4d8bf' },
      { shape: 'note', cx: 1601, cy: 617, size: 23, angle: -46, fill: '#585338', opacity: 0.358, blend: 'multiply', blur: 0.5, ratio: 1.76, scan: 0.413, dim: 0.366, cover: 0.5, base: '#b0ab91' },
      { shape: 'apple', cx: 2057, cy: 1577, size: 20, angle: 70, fill: '#a5b388', opacity: 0.327, blend: 'screen', blur: 0.5, ratio: 1.77, scan: 0.429, dim: 0.685, cover: 0.5, base: '#272b21' },
      { shape: 'puzzle', cx: 641, cy: 593, size: 18, angle: -104, fill: '#bcb697', opacity: 0.398, blend: 'screen', blur: 0.5, ratio: 1.84, scan: 0.416, dim: 0.751, cover: 0.5, base: '#4c4935' },
      { shape: 'leaf', cx: 1601, cy: 1241, size: 16, angle: 148, fill: '#b8c9ab', opacity: 0.554, blend: 'screen', blur: 0.5, ratio: 2.31, scan: 0.371, dim: 0.515, cover: 0.5, base: '#637357' },
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
    clutter: 0.535,
    days: [
      { shape: 'sun', cx: 209, cy: 1481, size: 40, angle: 168, fill: '#28353f', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.87, scan: 0.46, dim: 0.82 },
      { shape: 'bolt', cx: 449, cy: 1865, size: 37, angle: -155, fill: '#b39d88', opacity: 0.237, blend: 'screen', blur: 0.5, ratio: 3.28, scan: 0.422, dim: 0.888, cover: 0.5, base: '#2d2620' },
      { shape: 'triangle', cx: 1073, cy: 1073, size: 34, angle: -34, fill: '#b4c9cf', opacity: 0.179, blend: 'screen', blur: 0.5, ratio: 1.86, scan: 0.366, dim: 0.525, cover: 0.5, base: '#6a7d83' },
      { shape: 'diamond', cx: 2393, cy: 3065, size: 31, angle: -134, fill: '#cb9871', opacity: 0.198, blend: 'screen', blur: 0.5, ratio: 2.11, scan: 0.365, dim: 0.868, cover: 0.5, base: '#392515' },
      { shape: 'hourglass', cx: 281, cy: 3137, size: 28, angle: 110, fill: '#c7826c', opacity: 0.166, blend: 'screen', blur: 0.5, ratio: 1.45, scan: 0.339, dim: 0.866, cover: 0.5, base: '#2a1710' },
      { shape: 'leaf', cx: 2201, cy: 1577, size: 25, angle: 104, fill: '#a1b9c3', opacity: 0.265, blend: 'screen', blur: 0.5, ratio: 1.08, scan: 0.308, dim: 0.658, cover: 0.5, base: '#46595f' },
      { shape: 'droplet', cx: 905, cy: 233, size: 22, angle: -148, fill: '#c88693', opacity: 0.405, blend: 'screen', blur: 0.5, ratio: 2.8, scan: 0.3, dim: 0.777, cover: 0.5, base: '#52252e' },
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
    clutter: 0.631,
    days: [
      { shape: 'sailboat', cx: 2105, cy: 1553, size: 40, angle: 12, fill: '#322916', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.31, scan: 0.529, dim: 0.763 },
      { shape: 'cloud', cx: 2393, cy: 593, size: 37, angle: -25, fill: '#284641', opacity: 0.344, blend: 'multiply', blur: 0.5, ratio: 1.34, scan: 0.463, dim: 0.46, cover: 0.5, base: '#5a9c91' },
      { shape: 'fish', cx: 1913, cy: 641, size: 34, angle: 34, fill: '#aac9ab', opacity: 0.685, blend: 'screen', blur: 0.5, ratio: 2.77, scan: 0.454, dim: 0.632, cover: 0.5, base: '#587258' },
      { shape: 'triangle', cx: 425, cy: 569, size: 31, angle: -166, fill: '#517e68', opacity: 0.166, blend: 'multiply', blur: 0.5, ratio: 1.56, scan: 0.358, dim: 0.108, cover: 0.5, base: '#e2ebe6' },
      { shape: 'key', cx: 1169, cy: 185, size: 28, angle: 70, fill: '#4b7576', opacity: 0.453, blend: 'multiply', blur: 0.5, ratio: 2.4, scan: 0.353, dim: 0.189, cover: 0.5, base: '#cfdedf' },
      { shape: 'puzzle', cx: 2369, cy: 1193, size: 25, angle: -104, fill: '#406c5f', opacity: 0.336, blend: 'multiply', blur: 0.5, ratio: 1.81, scan: 0.333, dim: 0.197, cover: 0.5, base: '#afd0c6' },
      { shape: 'house', cx: 1505, cy: 929, size: 22, angle: 148, fill: '#cfc7b1', opacity: 0.354, blend: 'screen', blur: 0.5, ratio: 1.55, scan: 0.345, dim: 0.473, cover: 0.5, base: '#8f8057' },
    ],
  },
  {
    image: 'moulin',
    title: 'Dance at Le Moulin de la Galette',
    artist: 'Pierre-Auguste Renoir',
    year: '1876',
    genre: 'genre-scene',
    source:
      'https://commons.wikimedia.org/wiki/File:Auguste_Renoir_-_Dance_at_Le_Moulin_de_la_Galette_-_Google_Art_Project.jpg',
    sourceWidth: 3840,
    width: 2600,
    height: 1932,
    clutter: 0.531,
    days: [
      { shape: 'sun', cx: 473, cy: 1721, size: 40, angle: 102, fill: '#353522', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.71, scan: 0.435, dim: 0.721 },
      { shape: 'snowflake', cx: 1553, cy: 1625, size: 37, angle: -85, fill: '#92adb9', opacity: 0.201, blend: 'screen', blur: 0.5, ratio: 1.58, scan: 0.41, dim: 0.798, cover: 0.5, base: '#2c3d45' },
      { shape: 'hourglass', cx: 1193, cy: 1337, size: 34, angle: -146, fill: '#c9c7aa', opacity: 0.209, blend: 'screen', blur: 0.5, ratio: 1.07, scan: 0.352, dim: 0.58, cover: 0.5, base: '#686861' },
      { shape: 'crown', cx: 2057, cy: 1073, size: 31, angle: -46, fill: '#8bb599', opacity: 0.222, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.363, dim: 0.8, cover: 0.5, base: '#24352a' },
      { shape: 'puzzle', cx: 785, cy: 425, size: 28, angle: 70, fill: '#829baf', opacity: 0.17, blend: 'screen', blur: 0.5, ratio: 1.13, scan: 0.344, dim: 0.903, cover: 0.5, base: '#191c1e' },
      { shape: 'sailboat', cx: 161, cy: 665, size: 25, angle: -104, fill: '#b3ae89', opacity: 0.234, blend: 'screen', blur: 0.5, ratio: 2.01, scan: 0.321, dim: 0.799, cover: 0.5, base: '#2b2a24' },
      { shape: 'crescent', cx: 1961, cy: 401, size: 22, angle: 148, fill: '#90b8b8', opacity: 0.237, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.3, dim: 0.834, cover: 0.5, base: '#2e3e3e' },
    ],
  },
  {
    image: 'cossacks',
    title: 'Reply of the Zaporozhian Cossacks',
    artist: 'Ilya Repin',
    year: '1891',
    genre: 'history',
    source: 'https://commons.wikimedia.org/wiki/File:Ilja_Jefimowitsch_Repin_-_Reply_of_the_Zaporozhian_Cossacks_-_Yorck.jpg',
    width: 2600,
    height: 1537,
    clutter: 0.556,
    days: [
      { shape: 'blossom', cx: 1001, cy: 233, size: 40, angle: -132, fill: '#d7d9e6', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 1.67, scan: 0.425, dim: 0.392 },
      { shape: 'droplet', cx: 2081, cy: 209, size: 37, angle: -25, fill: '#82743e', opacity: 0.151, blend: 'multiply', blur: 0.5, ratio: 1.35, scan: 0.366, dim: 0.144, cover: 0.5, base: '#e4dec7' },
      { shape: 'leaf', cx: 473, cy: 545, size: 34, angle: 34, fill: '#91a4b9', opacity: 0.119, blend: 'screen', blur: 0.5, ratio: 1.48, scan: 0.391, dim: 0.796, cover: 0.5, base: '#2e3740' },
      { shape: 'apple', cx: 161, cy: 1313, size: 31, angle: -46, fill: '#87afb2', opacity: 0.131, blend: 'screen', blur: 0.5, ratio: 1.23, scan: 0.373, dim: 0.838, cover: 0.5, base: '#212728' },
      { shape: 'bell', cx: 2417, cy: 1313, size: 28, angle: 70, fill: '#cfc6b4', opacity: 0.166, blend: 'screen', blur: 0.5, ratio: 1.11, scan: 0.318, dim: 0.485, cover: 0.5, base: '#887d64' },
      { shape: 'spade', cx: 1097, cy: 1313, size: 25, angle: -104, fill: '#b3a088', opacity: 0.213, blend: 'screen', blur: 0.5, ratio: 1.23, scan: 0.335, dim: 0.809, cover: 0.5, base: '#2b2620' },
      { shape: 'tree', cx: 1625, cy: 809, size: 22, angle: 148, fill: '#d0bbac', opacity: 0.379, blend: 'screen', blur: 0.5, ratio: 1.42, scan: 0.304, dim: 0.667, cover: 0.5, base: '#8e6950' },
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
    clutter: 0.656,
    days: [
      { shape: 'butterfly', cx: 1793, cy: 1217, size: 29, angle: -12, fill: '#2d1615', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.63, scan: 0.56, dim: 0.871 },
      { shape: 'cross', cx: 2441, cy: 1745, size: 27, angle: -155, fill: '#b78f8f', opacity: 0.319, blend: 'screen', blur: 0.5, ratio: 4.68, scan: 0.522, dim: 0.836, cover: 0.5, base: '#3e2828' },
      { shape: 'crescent', cx: 641, cy: 1793, size: 25, angle: -34, fill: '#cc6982', opacity: 0.485, blend: 'screen', blur: 0.5, ratio: 4.38, scan: 0.501, dim: 0.869, cover: 0.5, base: '#2e1018' },
      { shape: 'note', cx: 233, cy: 761, size: 23, angle: 46, fill: '#cb8c70', opacity: 0.213, blend: 'screen', blur: 0.5, ratio: 2.17, scan: 0.47, dim: 0.895, cover: 0.5, base: '#381f14' },
      { shape: 'bolt', cx: 2201, cy: 689, size: 20, angle: 110, fill: '#c9bcaa', opacity: 0.493, blend: 'screen', blur: 0.5, ratio: 3.16, scan: 0.423, dim: 0.6, cover: 0.5, base: '#756753' },
      { shape: 'arrow', cx: 1049, cy: 689, size: 18, angle: 104, fill: '#cd8283', opacity: 0.45, blend: 'screen', blur: 0.5, ratio: 2.2, scan: 0.425, dim: 0.804, cover: 0.5, base: '#582324' },
      { shape: 'anchor', cx: 2321, cy: 1241, size: 16, angle: -148, fill: '#b8818a', opacity: 0.633, blend: 'screen', blur: 0.5, ratio: 2.38, scan: 0.404, dim: 0.806, cover: 0.5, base: '#2f1b1e' },
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
    clutter: 0.538,
    days: [
      { shape: 'blossom', cx: 2249, cy: 449, size: 40, angle: -132, fill: '#dce3e9', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.16, scan: 0.406, dim: 0.429 },
      { shape: 'clover', cx: 1865, cy: 689, size: 37, angle: -25, fill: '#4d7862', opacity: 0.148, blend: 'multiply', blur: 0.5, ratio: 2.23, scan: 0.346, dim: 0.129, cover: 0.5, base: '#d3e2da' },
      { shape: 'umbrella', cx: 977, cy: 1025, size: 34, angle: 34, fill: '#bba695', opacity: 0.371, blend: 'screen', blur: 0.5, ratio: 1.86, scan: 0.384, dim: 0.723, cover: 0.5, base: '#4a3d32' },
      { shape: 'bell', cx: 1961, cy: 1601, size: 31, angle: -46, fill: '#bed1b7', opacity: 0.174, blend: 'screen', blur: 0.5, ratio: 1.64, scan: 0.327, dim: 0.496, cover: 0.5, base: '#788773' },
      { shape: 'tree', cx: 1337, cy: 1313, size: 28, angle: 70, fill: '#c5caad', opacity: 0.273, blend: 'screen', blur: 0.5, ratio: 1.27, scan: 0.312, dim: 0.528, cover: 0.5, base: '#757a58' },
      { shape: 'apple', cx: 185, cy: 1049, size: 25, angle: -104, fill: '#b49e89', opacity: 0.135, blend: 'screen', blur: 0.5, ratio: 1.04, scan: 0.316, dim: 0.753, cover: 0.5, base: '#2f2822' },
      { shape: 'droplet', cx: 2273, cy: 881, size: 22, angle: 148, fill: '#c2baa0', opacity: 0.276, blend: 'screen', blur: 0.5, ratio: 1.13, scan: 0.297, dim: 0.609, cover: 0.5, base: '#635b40' },
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

