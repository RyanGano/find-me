import { isTracker, type RunMetrics, type Tracker } from './metrics';
import type { Transform } from './types';

const KEY = 'find-me:v1';

export interface Result {
  /** Solve time in milliseconds. */
  ms: number;
  /** ISO date string of when it was solved. */
  at: string;
  /**
   * The puzzle version this time was set on. Absent on results written before
   * versioning existed, which are treated as belonging to a puzzle that no longer
   * exists -- so those days open playable again rather than stuck on a finished board.
   */
  v?: string;
  /**
   * How the run was played, for the Find Me Age. Absent on results recorded before it
   * existed; those still show an age, taken from the clock alone. The age itself is not
   * stored, so retuning the estimate re-reads old runs rather than freezing them.
   */
  m?: RunMetrics;
}

interface Store {
  results: Record<string, Result>;
  /** The single run in progress, if the player left mid-hunt. See `Progress`. */
  progress?: Progress;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { results: {} };
    const parsed = JSON.parse(raw) as Partial<Store>;
    let progress = isProgress(parsed.progress) ? parsed.progress : undefined;
    // A damaged collector costs the age, not the run: drop it and keep the clock.
    if (progress && progress.k !== undefined && !isTracker(progress.k)) {
      progress = { ...progress, k: undefined };
    }
    return { results: parsed.results ?? {}, progress };
  } catch {
    return { results: {} };
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Private browsing, quota, or storage disabled: the game still plays fine.
  }
}

/** Any recorded result for a day, whatever version it was set on. Feeds the stats. */
export function getResult(day: number): Result | undefined {
  return read().results[String(day)];
}

/**
 * The result that counts as "you have already played today": a recorded time for this
 * day *and* for the puzzle as it is defined now. A redefined puzzle is a new puzzle.
 */
export function getCurrentResult(day: number, version: string): Result | undefined {
  const result = read().results[String(day)];
  return result && result.v === version ? result : undefined;
}

export function saveResult(
  day: number,
  ms: number,
  version: string,
  metrics?: RunMetrics,
): void {
  const store = read();
  const key = String(day);
  const existing = store.results[key];
  // Keep the first solve of a given puzzle, so replaying cannot improve the record --
  // but a result from an older version of the day is superseded, not protected.
  if (existing && existing.v === version) return;
  store.results[key] = { ms, at: new Date().toISOString(), v: version, m: metrics };
  write(store);
}

export interface Stats {
  played: number;
  best: number | null;
  streak: number;
}

export function getStats(today: number): Stats {
  const results = read().results;
  const days = Object.keys(results)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  let best: number | null = null;
  for (const d of days) {
    const ms = results[String(d)].ms;
    if (best === null || ms < best) best = ms;
  }

  // Count back from today (or yesterday, if today is not solved yet).
  let streak = 0;
  let cursor = results[String(today)] ? today : today - 1;
  while (results[String(cursor)]) {
    streak++;
    cursor--;
  }

  return { played: days.length, best, streak };
}

/**
 * A run in progress: where the player had got to when they left the page.
 *
 * Without this, a swipe-to-go-back — the easiest gesture to hit by accident on a phone —
 * hands the player a fresh timer and an unlimited second look at the painting. Only one
 * run is ever kept, and it is only handed back for the same day and the same version of
 * that day's puzzle; anything else is stale and gets cleared.
 */
export interface Progress {
  day: number;
  /** Puzzle version, as on `Result`. A redefined puzzle is a new puzzle. */
  v: string;
  /** Elapsed time in milliseconds at the moment the page was left. */
  ms: number;
  /** The viewport transform, in the stage box it was measured in. */
  t: Transform;
  /** Stage size the transform belongs to; a different box gets the fitted view back. */
  w: number;
  h: number;
  /**
   * The Find Me Age collector, mid-run. Without this a back-swipe would hand the clock
   * back but forget every near miss and wobble that led up to it, and the age on the
   * result would describe only the half of the run that happened after the interruption.
   * Optional: a run banked by an older build has no collector, and gets a fresh one.
   */
  k?: Tracker;
  /** When it was stored, so a run left open overnight is not resumed days later. */
  at: string;
}

/** How long a stored run stays resumable. Long enough for a phone to be put down. */
const PROGRESS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function isProgress(value: unknown): value is Progress {
  const p = value as Progress | undefined;
  return (
    !!p &&
    typeof p.day === 'number' &&
    typeof p.v === 'string' &&
    typeof p.ms === 'number' &&
    Number.isFinite(p.ms) &&
    !!p.t &&
    typeof p.t.x === 'number' &&
    typeof p.t.y === 'number' &&
    typeof p.t.scale === 'number' &&
    typeof p.t.rot === 'number' &&
    typeof p.w === 'number' &&
    typeof p.h === 'number'
  );
}

/**
 * The run to resume for this puzzle, if there is one. A stored run for another day, an
 * older version of this day, or one left sitting for half a day is dropped on the spot.
 */
export function getProgress(day: number, version: string): Progress | undefined {
  const progress = read().progress;
  if (!progress) return undefined;
  const fresh = Date.now() - Date.parse(progress.at) < PROGRESS_MAX_AGE_MS;
  if (progress.day === day && progress.v === version && fresh) return progress;
  clearProgress();
  return undefined;
}

export function saveProgress(progress: Omit<Progress, 'at'>): void {
  const store = read();
  store.progress = { ...progress, at: new Date().toISOString() };
  write(store);
}

export function clearProgress(): void {
  const store = read();
  if (!store.progress) return;
  delete store.progress;
  write(store);
}
