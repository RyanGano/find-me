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
      { shape: 'snowflake', cx: 521, cy: 2633, size: 40, angle: -168, fill: '#533320', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.65, scan: 0.777 },
      { shape: 'star', cx: 2081, cy: 593, size: 37, angle: 47, fill: '#57471d', opacity: 0.515, blend: 'multiply', blur: 0.5, ratio: 4.08, scan: 0.645 },
      { shape: 'clover', cx: 1817, cy: 3353, size: 34, angle: 34, fill: '#d07d68', opacity: 0.348, blend: 'screen', blur: 0.5, ratio: 2.82, scan: 0.599 },
      { shape: 'key', cx: 737, cy: 1217, size: 31, angle: -46, fill: '#c1aa73', opacity: 0.457, blend: 'screen', blur: 0.5, ratio: 3.14, scan: 0.544 },
      { shape: 'crescent', cx: 1793, cy: 1673, size: 28, angle: 70, fill: '#d66f5c', opacity: 0.54, blend: 'screen', blur: 0.5, ratio: 2.71, scan: 0.52 },
      { shape: 'heart', cx: 1025, cy: 3449, size: 25, angle: -104, fill: '#cc7067', opacity: 0.747, blend: 'screen', blur: 0.5, ratio: 3.22, scan: 0.497 },
      { shape: 'anchor', cx: 2009, cy: 1025, size: 22, angle: 148, fill: '#c9c283', opacity: 0.606, blend: 'screen', blur: 0.5, ratio: 1.77, scan: 0.471 },
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
      { shape: 'star', cx: 449, cy: 209, size: 40, angle: -156, fill: '#f2e3c7', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.32, scan: 0.81 },
      { shape: 'clover', cx: 1745, cy: 953, size: 37, angle: -155, fill: '#97742f', opacity: 0.398, blend: 'multiply', blur: 0.5, ratio: 3.5, scan: 0.661 },
      { shape: 'triangle', cx: 1313, cy: 953, size: 34, angle: 86, fill: '#987530', opacity: 0.288, blend: 'multiply', blur: 0.5, ratio: 2.97, scan: 0.591 },
      { shape: 'anchor', cx: 1361, cy: 329, size: 31, angle: 46, fill: '#ad7a16', opacity: 0.426, blend: 'multiply', blur: 0.5, ratio: 2.4, scan: 0.557 },
      { shape: 'fish', cx: 2225, cy: 905, size: 28, angle: -70, fill: '#9f762c', opacity: 0.39, blend: 'multiply', blur: 0.5, ratio: 3.65, scan: 0.53 },
      { shape: 'bolt', cx: 617, cy: 1361, size: 25, angle: 104, fill: '#958a38', opacity: 0.696, blend: 'multiply', blur: 0.5, ratio: 1.41, scan: 0.506 },
      { shape: 'arrow', cx: 113, cy: 1409, size: 22, angle: -148, fill: '#4a6b45', opacity: 0.711, blend: 'multiply', blur: 0.5, ratio: 2.01, scan: 0.477 },
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
      { shape: 'clover', cx: 521, cy: 1241, size: 40, angle: 12, fill: '#3b3426', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.38, scan: 0.614 },
      { shape: 'triangle', cx: 281, cy: 329, size: 37, angle: -25, fill: '#96a4da', opacity: 0.23, blend: 'screen', blur: 0.5, ratio: 1.38, scan: 0.515 },
      { shape: 'star', cx: 833, cy: 1577, size: 34, angle: -38, fill: '#85b196', opacity: 0.158, blend: 'screen', blur: 0.5, ratio: 1.15, scan: 0.458 },
      { shape: 'arrow', cx: 2297, cy: 737, size: 31, angle: -46, fill: '#afbfd7', opacity: 0.257, blend: 'screen', blur: 0.5, ratio: 1.06, scan: 0.431 },
      { shape: 'key', cx: 857, cy: 281, size: 28, angle: 70, fill: '#8fa0d5', opacity: 0.383, blend: 'screen', blur: 0.5, ratio: 1.48, scan: 0.414 },
      { shape: 'crescent', cx: 137, cy: 1601, size: 25, angle: -104, fill: '#8da2be', opacity: 0.39, blend: 'screen', blur: 0.5, ratio: 1.56, scan: 0.385 },
      { shape: 'heart', cx: 1697, cy: 1409, size: 22, angle: 148, fill: '#919fce', opacity: 0.249, blend: 'screen', blur: 0.5, ratio: 1.21, scan: 0.362 },
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
      { shape: 'triangle', cx: 257, cy: 1073, size: 40, angle: -132, fill: '#2c251c', opacity: 1, blend: 'screen', blur: 0.5, ratio: 2.91, scan: 0.674 },
      { shape: 'snowflake', cx: 785, cy: 353, size: 37, angle: -155, fill: '#d19876', opacity: 0.249, blend: 'screen', blur: 0.5, ratio: 2.36, scan: 0.561 },
      { shape: 'star', cx: 1697, cy: 761, size: 34, angle: -106, fill: '#c4a77f', opacity: 0.261, blend: 'screen', blur: 0.5, ratio: 1.95, scan: 0.507 },
      { shape: 'heart', cx: 689, cy: 1385, size: 31, angle: 46, fill: '#cba17b', opacity: 0.237, blend: 'screen', blur: 0.5, ratio: 1.47, scan: 0.464 },
      { shape: 'anchor', cx: 2177, cy: 305, size: 28, angle: -70, fill: '#caa887', opacity: 0.59, blend: 'screen', blur: 0.5, ratio: 1.86, scan: 0.452 },
      { shape: 'fish', cx: 1481, cy: 329, size: 25, angle: 104, fill: '#cda77d', opacity: 0.252, blend: 'screen', blur: 0.5, ratio: 1.12, scan: 0.432 },
      { shape: 'bolt', cx: 2225, cy: 1193, size: 22, angle: -148, fill: '#c5a485', opacity: 0.598, blend: 'screen', blur: 0.5, ratio: 1.45, scan: 0.405 },
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
      { shape: 'snowflake', cx: 2321, cy: 1409, size: 40, angle: -48, fill: '#211d2d', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.28, scan: 0.586 },
      { shape: 'star', cx: 1097, cy: 1529, size: 37, angle: 47, fill: '#91b9a3', opacity: 0.187, blend: 'screen', blur: 0.5, ratio: 1.47, scan: 0.492 },
      { shape: 'clover', cx: 257, cy: 1145, size: 34, angle: 34, fill: '#504d26', opacity: 0.276, blend: 'multiply', blur: 0.5, ratio: 1.61, scan: 0.431 },
      { shape: 'bolt', cx: 521, cy: 161, size: 31, angle: -46, fill: '#3c401c', opacity: 0.383, blend: 'multiply', blur: 0.5, ratio: 1.61, scan: 0.411 },
      { shape: 'arrow', cx: 1745, cy: 1577, size: 28, angle: 70, fill: '#98bdaa', opacity: 0.158, blend: 'screen', blur: 0.5, ratio: 0.98, scan: 0.383 },
      { shape: 'key', cx: 1337, cy: 833, size: 25, angle: -104, fill: '#58393d', opacity: 0.354, blend: 'multiply', blur: 0.5, ratio: 1.09, scan: 0.371 },
      { shape: 'crescent', cx: 2009, cy: 929, size: 22, angle: 148, fill: '#beb8d2', opacity: 0.418, blend: 'screen', blur: 0.5, ratio: 1.13, scan: 0.352 },
    ],
  },
  {
    image: 'athens',
    title: 'The School of Athens',
    artist: 'Raphael',
    year: 'c. 1510',
    width: 2600,
    height: 2017,
    days: [
      { shape: 'star', cx: 809, cy: 593, size: 40, angle: -156, fill: '#dfd6b6', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.12, scan: 0.685 },
      { shape: 'clover', cx: 1961, cy: 761, size: 37, angle: -155, fill: '#8c8235', opacity: 0.319, blend: 'multiply', blur: 0.5, ratio: 1.52, scan: 0.556 },
      { shape: 'triangle', cx: 1649, cy: 281, size: 34, angle: -34, fill: '#c6baa1', opacity: 0.269, blend: 'screen', blur: 0.5, ratio: 1.34, scan: 0.502 },
      { shape: 'crescent', cx: 2225, cy: 1409, size: 31, angle: 46, fill: '#d4ac92', opacity: 0.468, blend: 'screen', blur: 0.5, ratio: 1.68, scan: 0.468 },
      { shape: 'heart', cx: 2153, cy: 1865, size: 28, angle: -70, fill: '#d8a370', opacity: 0.28, blend: 'screen', blur: 0.5, ratio: 1.72, scan: 0.448 },
      { shape: 'anchor', cx: 1001, cy: 1865, size: 25, angle: 104, fill: '#e9ac65', opacity: 0.503, blend: 'screen', blur: 0.5, ratio: 1.63, scan: 0.428 },
      { shape: 'fish', cx: 1337, cy: 689, size: 22, angle: -148, fill: '#817034', opacity: 0.362, blend: 'multiply', blur: 0.5, ratio: 1.34, scan: 0.403 },
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
      { shape: 'clover', cx: 1649, cy: 305, size: 40, angle: 12, fill: '#1e281a', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1.98, scan: 0.755 },
      { shape: 'triangle', cx: 2129, cy: 209, size: 37, angle: -145, fill: '#b2c8a8', opacity: 0.297, blend: 'screen', blur: 0.5, ratio: 2.1, scan: 0.635 },
      { shape: 'star', cx: 1073, cy: 521, size: 34, angle: -38, fill: '#bfd0b6', opacity: 0.66, blend: 'screen', blur: 0.5, ratio: 2.35, scan: 0.567 },
      { shape: 'fish', cx: 1985, cy: 1313, size: 31, angle: -46, fill: '#bfc8a9', opacity: 0.571, blend: 'screen', blur: 0.5, ratio: 2.92, scan: 0.533 },
      { shape: 'bolt', cx: 233, cy: 305, size: 28, angle: 70, fill: '#b9cdb0', opacity: 0.519, blend: 'screen', blur: 0.5, ratio: 1.43, scan: 0.504 },
      { shape: 'arrow', cx: 137, cy: 1001, size: 25, angle: -104, fill: '#cda174', opacity: 0.457, blend: 'screen', blur: 0.5, ratio: 1.52, scan: 0.492 },
      { shape: 'key', cx: 2153, cy: 1721, size: 22, angle: 148, fill: '#b5c9aa', opacity: 0.685, blend: 'screen', blur: 0.5, ratio: 1.66, scan: 0.463 },
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
      { shape: 'triangle', cx: 545, cy: 209, size: 40, angle: 108, fill: '#d8e6e7', opacity: 1, blend: 'multiply', blur: 0.5, ratio: 2.92, scan: 0.733 },
      { shape: 'snowflake', cx: 1985, cy: 209, size: 37, angle: -35, fill: '#4b7779', opacity: 0.269, blend: 'multiply', blur: 0.5, ratio: 2.92, scan: 0.612 },
      { shape: 'star', cx: 2105, cy: 1553, size: 34, angle: -106, fill: '#c6ae7d', opacity: 0.241, blend: 'screen', blur: 0.5, ratio: 1.69, scan: 0.537 },
      { shape: 'key', cx: 1793, cy: 809, size: 31, angle: 46, fill: '#d6a977', opacity: 0.519, blend: 'screen', blur: 0.5, ratio: 2.31, scan: 0.506 },
      { shape: 'crescent', cx: 257, cy: 617, size: 28, angle: -70, fill: '#648253', opacity: 0.344, blend: 'multiply', blur: 0.5, ratio: 2.18, scan: 0.498 },
      { shape: 'heart', cx: 2465, cy: 1121, size: 25, angle: 104, fill: '#408b7b', opacity: 0.606, blend: 'multiply', blur: 0.5, ratio: 4.01, scan: 0.466 },
      { shape: 'anchor', cx: 2393, cy: 521, size: 22, angle: -148, fill: '#274a48', opacity: 0.55, blend: 'multiply', blur: 0.5, ratio: 1.2, scan: 0.436 },
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
