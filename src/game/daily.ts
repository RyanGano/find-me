import { PUZZLES } from './puzzles';
import type { Puzzle } from './types';

/** Local date of puzzle #1. */
export const EPOCH = new Date(2026, 7, 26);

const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Days elapsed since the epoch, in the player's own timezone. */
export function dayIndex(now: Date = new Date()): number {
  return Math.round((localMidnight(now) - localMidnight(EPOCH)) / DAY_MS);
}

/** The number shown to players and in shared results: day 0 is puzzle #1. */
export function puzzleNumber(index: number): number {
  return index + 1;
}

export function puzzleForDay(index: number): Puzzle {
  const i = ((index % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
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
  }
  const day = params.get('day');
  if (day !== null && day.trim() !== '' && Number.isFinite(Number(day))) {
    const n = Math.trunc(Number(day));
    return { index: n, puzzle: puzzleForDay(n), isPractice: true };
  }
  const index = dayIndex(now);
  return { index, puzzle: puzzleForDay(index), isPractice: false };
}
