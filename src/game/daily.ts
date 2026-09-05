import { PUZZLES } from './puzzles';
import { TESTBED_PUZZLES } from './testbed';
import type { Puzzle } from './types';

/** Local date of puzzle #1. A Wednesday, which matters -- see `puzzleForDay`. */
export const EPOCH = new Date(2026, 7, 26);

const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Weekday with Monday as 0 and Sunday as 6, in the player's own timezone. */
export function weekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Days from the Monday of the epoch's week to the epoch itself: 2 for a Wednesday.
 *
 * The whole calendar hangs off this. Day numbers are counted from the epoch, because
 * that is what players see and share, but the puzzle list is laid out Monday-first, so
 * the two are offset by however far into its week the epoch fell.
 */
const EPOCH_WEEKDAY = weekday(EPOCH);

/** Days elapsed since the epoch, in the player's own timezone. */
export function dayIndex(now: Date = new Date()): number {
  return Math.round((localMidnight(now) - localMidnight(EPOCH)) / DAY_MS);
}

/** The number shown to players and in shared results: day 0 is puzzle #1. */
export function puzzleNumber(index: number): number {
  return index + 1;
}

/**
 * The puzzle for a day number.
 *
 * Puzzles are stored Monday-first in blocks of seven, so shifting the day number by the
 * epoch's own weekday lines the list up with the calendar: any real Monday lands on a
 * Monday puzzle, and a painting holds for the whole Monday-to-Sunday week. Everything
 * is in the player's local timezone, the same as `dayIndex`, so the day rolls over at
 * their midnight rather than anyone else's.
 *
 * The epoch is a Wednesday, so the very first week is a short one: it opens on rung
 * three of its ramp and finishes on Sunday like any other.
 */
export function puzzleForDay(index: number): Puzzle {
  const n = index + EPOCH_WEEKDAY;
  const i = ((n % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
  return PUZZLES[i];
}

/** Milliseconds until the next puzzle unlocks. */
export function msUntilTomorrow(now: Date = new Date()): number {
  return localMidnight(now) + DAY_MS - now.getTime();
}

export interface DailySelection {
  index: number;
  puzzle: Puzzle;
  /** True when the player forced a specific puzzle via ?day= or ?puzzle=. */
  isPractice: boolean;
}

/** Resolve which puzzle to show, honouring ?day=N and ?puzzle=<id> for testing. */
export function selectPuzzle(search: string, now: Date = new Date()): DailySelection {
  const params = new URLSearchParams(search);
  const byId = params.get('puzzle');
  if (byId) {
    const found = PUZZLES.findIndex((p) => p.id === byId);
    if (found >= 0) return { index: found, puzzle: PUZZLES[found], isPractice: true };
    // A play-test bench puzzle, named the same way, so that `npm run camouflage` and
    // `npm run preview:week` drive the bench through the real page rather than through a
    // second one. Reachable only by asking for it by name: the calendar below indexes
    // `PUZZLES` and cannot reach these at all.
    //
    // The index comes back negative because there is no day these belong to, and a
    // number that cannot be mistaken for one is worth more here than a tidy one -- it is
    // what makes "a bench puzzle is never recorded against a date" true by construction
    // rather than by everyone remembering. `isPractice` already means nothing is written.
    const bench = TESTBED_PUZZLES.findIndex((p) => p.id === byId);
    if (bench >= 0) {
      return { index: -1 - bench, puzzle: TESTBED_PUZZLES[bench], isPractice: true };
    }
  }
  const day = params.get('day');
  if (day !== null && day.trim() !== '' && Number.isFinite(Number(day))) {
    const n = Math.trunc(Number(day));
    return { index: n, puzzle: puzzleForDay(n), isPractice: true };
  }
  const index = dayIndex(now);
  return { index, puzzle: puzzleForDay(index), isPractice: false };
}
