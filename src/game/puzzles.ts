import { RAMP } from './difficulty';
import { getShape } from './shapes';
import type { Puzzle, Target } from './types';

const base = import.meta.env.BASE_URL;

interface WeekSeed {
  /** Asset id in `public/puzzles`. */
  image: string;
  title: string;
  artist: string;
  /** Year painted, as it should read on the credit line, e.g. `c. 1503`. */
  year: string;
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
 * each rung is measured. Eight paintings is therefore eight weeks, not eight days.
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
    width: 2600,
    height: 3933,
    days: [
      { shape: 'snowflake', cx: 1025, cy: 3521, size: 40, angle: -168, fill: '#645d63', opacity: 1, blend: 'screen', blur: 0.5, ratio: 4.91, scan: 0.844 },
      { shape: 'star', cx: 2009, cy: 1217, size: 37, angle: 47, fill: '#a3a2a5', opacity: 0.689, blend: 'screen', blur: 0.5, ratio: 6.5, scan: 0.726 },
      { shape: 'clover', cx: 1073, cy: 185, size: 34, angle: 34, fill: '#ebe8df', opacity: 1, blend: 'screen', blur: 0.5, ratio: 10.48, scan: 0.618 },
      { shape: 'key', cx: 857, cy: 1217, size: 31, angle: -46, fill: '#a7979f', opacity: 0.838, blend: 'screen', blur: 0.5, ratio: 6.01, scan: 0.573 },
      { shape: 'crescent', cx: 1793, cy: 3353, size: 28, angle: 70, fill: '#a1959f', opacity: 0.336, blend: 'screen', blur: 0.5, ratio: 1.97, scan: 0.544 },
      { shape: 'heart', cx: 713, cy: 2129, size: 25, angle: -104, fill: '#9d969f', opacity: 0.66, blend: 'screen', blur: 0.5, ratio: 4.78, scan: 0.518 },
      { shape: 'anchor', cx: 1337, cy: 1409, size: 22, angle: 148, fill: '#a0949f', opacity: 0.842, blend: 'screen', blur: 0.5, ratio: 4.06, scan: 0.508 },
    ],
  },
  {
    image: 'wave',
    title: 'The Great Wave off Kanagawa',
    artist: 'Katsushika Hokusai',
    year: 'c. 1831',
    width: 2600,
    height: 1748,
    days: [
      { shape: 'star', cx: 1817, cy: 953, size: 40, angle: -156, fill: '#c3c0b8', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 3.91, scan: 0.869 },
      { shape: 'clover', cx: 377, cy: 281, size: 37, angle: -155, fill: '#6c654f', opacity: 0.265, blend: 'multiply', blur: 0.5, ratio: 4.42, scan: 0.749 },
      { shape: 'triangle', cx: 1217, cy: 929, size: 34, angle: 86, fill: '#6c6651', opacity: 0.354, blend: 'multiply', blur: 0.5, ratio: 4.54, scan: 0.627 },
      { shape: 'anchor', cx: 1361, cy: 329, size: 31, angle: 46, fill: '#6f664c', opacity: 0.371, blend: 'multiply', blur: 0.5, ratio: 2.57, scan: 0.592 },
      { shape: 'fish', cx: 2249, cy: 905, size: 28, angle: -70, fill: '#6e6955', opacity: 0.358, blend: 'multiply', blur: 0.5, ratio: 1.56, scan: 0.556 },
      { shape: 'bolt', cx: 617, cy: 1361, size: 25, angle: 104, fill: '#6a6a56', opacity: 0.579, blend: 'multiply', blur: 0.5, ratio: 1.49, scan: 0.538 },
      { shape: 'arrow', cx: 113, cy: 1409, size: 22, angle: -148, fill: '#545a4a', opacity: 0.724, blend: 'multiply', blur: 0.5, ratio: 2.19, scan: 0.518 },
    ],
  },
  {
    image: 'starry',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: '1889',
    width: 2600,
    height: 2059,
    days: [
      { shape: 'clover', cx: 521, cy: 1241, size: 40, angle: 12, fill: '#39393c', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.59, scan: 0.671 },
      { shape: 'triangle', cx: 281, cy: 329, size: 37, angle: -25, fill: '#a3add3', opacity: 0.245, blend: 'screen', blur: 0.5, ratio: 1.52, scan: 0.566 },
      { shape: 'star', cx: 833, cy: 1577, size: 34, angle: -38, fill: '#9a9ca6', opacity: 0.179, blend: 'screen', blur: 0.5, ratio: 1.23, scan: 0.495 },
      { shape: 'arrow', cx: 497, cy: 1889, size: 31, angle: -46, fill: '#999ba4', opacity: 0.15, blend: 'screen', blur: 0.5, ratio: 1.12, scan: 0.526 },
      { shape: 'key', cx: 2273, cy: 737, size: 28, angle: 70, fill: '#afbdde', opacity: 0.433, blend: 'screen', blur: 0.5, ratio: 1.27, scan: 0.428 },
      { shape: 'crescent', cx: 1625, cy: 1433, size: 25, angle: -104, fill: '#a1a9c0', opacity: 0.348, blend: 'screen', blur: 0.5, ratio: 1.18, scan: 0.413 },
      { shape: 'heart', cx: 137, cy: 1601, size: 22, angle: 148, fill: '#9ea4b6', opacity: 0.245, blend: 'screen', blur: 0.5, ratio: 1.43, scan: 0.395 },
    ],
  },
  {
    image: 'proverbs',
    title: 'Netherlandish Proverbs',
    artist: 'Pieter Bruegel the Elder',
    year: '1559',
    width: 2600,
    height: 1841,
    days: [
      { shape: 'triangle', cx: 257, cy: 1073, size: 40, angle: -132, fill: '#2a2a2c', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.2, scan: 0.745 },
      { shape: 'snowflake', cx: 785, cy: 353, size: 37, angle: -155, fill: '#afa0a3', opacity: 0.276, blend: 'screen', blur: 0.5, ratio: 2.6, scan: 0.623 },
      { shape: 'star', cx: 689, cy: 1457, size: 34, angle: -106, fill: '#aaa1a5', opacity: 0.366, blend: 'screen', blur: 0.5, ratio: 5.41, scan: 0.539 },
      { shape: 'heart', cx: 2201, cy: 305, size: 31, angle: 46, fill: '#b1a7a6', opacity: 0.41, blend: 'screen', blur: 0.5, ratio: 1.95, scan: 0.505 },
      { shape: 'anchor', cx: 1697, cy: 761, size: 28, angle: -70, fill: '#a8a2a5', opacity: 0.336, blend: 'screen', blur: 0.5, ratio: 1.7, scan: 0.476 },
      { shape: 'fish', cx: 857, cy: 881, size: 25, angle: 104, fill: '#a7a0a5', opacity: 0.41, blend: 'screen', blur: 0.5, ratio: 6.04, scan: 0.454 },
      { shape: 'bolt', cx: 2225, cy: 1193, size: 22, angle: -148, fill: '#afa7a8', opacity: 0.653, blend: 'screen', blur: 0.5, ratio: 1.59, scan: 0.441 },
    ],
  },
  {
    image: 'jatte',
    title: 'A Sunday on La Grande Jatte',
    artist: 'Georges Seurat',
    year: '1884',
    width: 2600,
    height: 1731,
    days: [
      { shape: 'snowflake', cx: 2321, cy: 1409, size: 40, angle: -48, fill: '#222124', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.37, scan: 0.633 },
      { shape: 'star', cx: 1097, cy: 1529, size: 37, angle: 47, fill: '#a0a9ae', opacity: 0.218, blend: 'screen', blur: 0.5, ratio: 1.63, scan: 0.546 },
      { shape: 'clover', cx: 281, cy: 1145, size: 34, angle: 34, fill: '#4e4c23', opacity: 0.327, blend: 'multiply', blur: 0.5, ratio: 2.01, scan: 0.461 },
      { shape: 'bolt', cx: 593, cy: 161, size: 31, angle: -46, fill: '#40441a', opacity: 0.362, blend: 'multiply', blur: 0.5, ratio: 1.56, scan: 0.427 },
      { shape: 'arrow', cx: 1745, cy: 1577, size: 28, angle: 70, fill: '#a6afb3', opacity: 0.174, blend: 'screen', blur: 0.5, ratio: 1.03, scan: 0.403 },
      { shape: 'key', cx: 1337, cy: 833, size: 25, angle: -104, fill: '#51403c', opacity: 0.375, blend: 'multiply', blur: 0.5, ratio: 1.15, scan: 0.394 },
      { shape: 'crescent', cx: 161, cy: 113, size: 22, angle: 148, fill: '#5b5e55', opacity: 0.739, blend: 'multiply', blur: 0.5, ratio: 3.98, scan: 0.376 },
    ],
  },
  {
    image: 'gypsy',
    title: 'The Sleeping Gypsy',
    artist: 'Henri Rousseau',
    year: '1897',
    width: 2600,
    height: 1661,
    days: [
      { shape: 'star', cx: 1961, cy: 305, size: 40, angle: -156, fill: '#252c30', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.19, scan: 0.519 },
      { shape: 'clover', cx: 785, cy: 497, size: 37, angle: -155, fill: '#a1c2d7', opacity: 0.198, blend: 'screen', blur: 0.5, ratio: 1.99, scan: 0.437 },
      { shape: 'triangle', cx: 2177, cy: 1481, size: 34, angle: -34, fill: '#a49fa3', opacity: 0.162, blend: 'screen', blur: 0.5, ratio: 1.89, scan: 0.373 },
      { shape: 'crescent', cx: 2417, cy: 809, size: 31, angle: 46, fill: '#344b48', opacity: 0.191, blend: 'multiply', blur: 0.5, ratio: 1.8, scan: 0.352 },
      { shape: 'heart', cx: 521, cy: 1121, size: 28, angle: -70, fill: '#aea8ab', opacity: 0.104, blend: 'screen', blur: 0.5, ratio: 1.2, scan: 0.337 },
      { shape: 'anchor', cx: 1505, cy: 1529, size: 25, angle: 104, fill: '#a09ba3', opacity: 0.209, blend: 'screen', blur: 0.5, ratio: 1.74, scan: 0.314 },
      { shape: 'fish', cx: 881, cy: 1409, size: 22, angle: -148, fill: '#9d9ca5', opacity: 0.252, blend: 'screen', blur: 0.5, ratio: 1.83, scan: 0.307 },
    ],
  },
  {
    image: 'hunters',
    title: 'The Hunters in the Snow',
    artist: 'Pieter Bruegel the Elder',
    year: '1565',
    width: 2600,
    height: 1850,
    days: [
      { shape: 'clover', cx: 1745, cy: 377, size: 40, angle: 12, fill: '#414443', opacity: 1, blend: 'screen', blur: 0.5, ratio: 3.81, scan: 0.822 },
      { shape: 'triangle', cx: 1265, cy: 1577, size: 37, angle: -145, fill: '#6b6752', opacity: 0.707, blend: 'multiply', blur: 0.5, ratio: 7.64, scan: 0.708 },
      { shape: 'star', cx: 2225, cy: 209, size: 34, angle: -38, fill: '#b6bdba', opacity: 0.375, blend: 'screen', blur: 0.5, ratio: 5.24, scan: 0.606 },
      { shape: 'fish', cx: 1985, cy: 1313, size: 31, angle: -46, fill: '#bcbfbb', opacity: 0.621, blend: 'screen', blur: 0.5, ratio: 3.06, scan: 0.561 },
      { shape: 'bolt', cx: 1049, cy: 545, size: 28, angle: 70, fill: '#c0c7c1', opacity: 0.813, blend: 'screen', blur: 0.5, ratio: 2.44, scan: 0.529 },
      { shape: 'arrow', cx: 137, cy: 737, size: 25, angle: -104, fill: '#c1a99c', opacity: 0.558, blend: 'screen', blur: 0.5, ratio: 3.44, scan: 0.506 },
      { shape: 'key', cx: 761, cy: 1721, size: 22, angle: 148, fill: '#69634d', opacity: 0.86, blend: 'multiply', blur: 0.5, ratio: 16.29, scan: 0.494 },
    ],
  },
  {
    image: 'babel',
    title: 'The Tower of Babel',
    artist: 'Pieter Bruegel the Elder',
    year: '1563',
    width: 2600,
    height: 2082,
    days: [
      { shape: 'triangle', cx: 617, cy: 257, size: 40, angle: 108, fill: '#dfe0de', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 4.45, scan: 0.801 },
      { shape: 'snowflake', cx: 2201, cy: 257, size: 37, angle: -35, fill: '#60675b', opacity: 0.724, blend: 'multiply', blur: 0.5, ratio: 11.64, scan: 0.678 },
      { shape: 'star', cx: 2105, cy: 1553, size: 34, angle: -106, fill: '#aba5a5', opacity: 0.273, blend: 'screen', blur: 0.5, ratio: 1.82, scan: 0.58 },
      { shape: 'key', cx: 1841, cy: 929, size: 31, angle: 46, fill: '#afa8a8', opacity: 0.813, blend: 'screen', blur: 0.5, ratio: 3.95, scan: 0.534 },
      { shape: 'crescent', cx: 257, cy: 617, size: 28, angle: -70, fill: '#6a6c5d', opacity: 0.315, blend: 'multiply', blur: 0.5, ratio: 2.2, scan: 0.501 },
      { shape: 'heart', cx: 1169, cy: 137, size: 25, angle: 104, fill: '#596258', opacity: 0.5, blend: 'multiply', blur: 0.5, ratio: 7.61, scan: 0.489 },
      { shape: 'anchor', cx: 2465, cy: 1121, size: 22, angle: -148, fill: '#636b5d', opacity: 0.806, blend: 'multiply', blur: 0.5, ratio: 3.83, scan: 0.472 },
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
 * Every painting in the rotation, for the credits panel. All eight are in the public
 * domain; the scans come from Wikimedia Commons.
 */
export const CREDITS = WEEKS.map((w) => ({
  id: w.image,
  title: w.title,
  artist: w.artist,
  year: w.year,
}));
