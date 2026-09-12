import * as backup from './backup';
import { isTracker, type RunMetrics, type Tracker } from './metrics';
import { isTestMode } from './testMode';
import type { Transform } from './types';

/**
 * Where the results live. A test run gets a key of its own, so everything below runs for
 * real -- the streak, the versioning, the resume -- against a store that is not the
 * player's. See `testMode.ts`.
 */
function storeKey(): string {
  return isTestMode() ? 'find-me:test' : 'find-me:v1';
}

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
  /**
   * The player gave up rather than finding it. Counts as played and closes the day, but
   * never towards `best` and never as a link in a streak -- a give-up that kept the
   * streak alive would be strictly better than not playing, which is the wrong thing to
   * reward. Absent, rather than false, on every result that was actually solved.
   */
  gaveUp?: true;
}

interface Store {
  results: Record<string, Result>;
  /** The single run in progress, if the player left mid-hunt. See `Progress`. */
  progress?: Progress;
  /**
   * Totals carried by the cookie mirror for days too old to be mirrored individually.
   * They can only ever raise `played` or lower `best`, never invent a streak.
   */
  carried?: { played: number; best: number | null };
}

function readLocal(): Store {
  try {
    const raw = localStorage.getItem(storeKey());
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

/**
 * The store as the player should see it: whatever localStorage still has, with anything
 * only the cookie mirror remembers filled in behind it.
 *
 * localStorage always wins where both have a day, because it is the fuller record -- it
 * keeps the run metrics the mirror cannot afford. The mirror only ever adds days back.
 * On a browser that has not lost anything this is a no-op; on an iPhone that has just
 * had its script-writable storage swept, it is the streak.
 */
function read(): Store {
  const store = readLocal();
  const mirror = backup.load();
  if (!mirror) return store;

  let results = store.results;
  for (const entry of mirror.entries) {
    const key = String(entry.day);
    if (results[key]) continue;
    if (results === store.results) results = { ...results };
    // No `at` and no `m`: the mirror does not carry them. `at` is unused by anything
    // that reads a restored result, and a missing `m` reads its age from the clock.
    results[key] = { ms: entry.ms, at: '', v: entry.v, gaveUp: entry.g };
  }
  return { ...store, results, carried: { played: mirror.played, best: mirror.best } };
}

function write(store: Store): void {
  try {
    // `carried` belongs to the mirror and is recomputed from it on every read, so it is
    // not part of what the primary store holds.
    localStorage.setItem(
      storeKey(),
      JSON.stringify({ results: store.results, progress: store.progress }),
    );
  } catch {
    // Private browsing, quota, or storage disabled: the cookie mirror may still hold.
  }
  mirror(store);
}

/** Push the results into the cookie, and re-arm how long that cookie is kept. */
function mirror(store: Store): void {
  const days = Object.keys(store.results)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  let best: number | null = store.carried?.best ?? null;
  for (const d of days) {
    const result = store.results[String(d)];
    if (result.gaveUp) continue;
    if (best === null || result.ms < best) best = result.ms;
  }
  backup.save({
    entries: days.map((day) => {
      const result = store.results[String(day)];
      return { day, ms: result.ms, v: result.v, g: result.gaveUp };
    }),
    played: Math.max(days.length, store.carried?.played ?? 0),
    best,
  });
}

/**
 * Rewrite the mirror on a plain visit, without waiting for a solve.
 *
 * A script-set cookie's life is capped and re-armed on write, so on iOS the mirror only
 * outlives the storage sweep if opening the game is enough to refresh it. Someone who
 * looks at today's painting and does not finish it must not lose last week's streak.
 */
export function touch(): void {
  // A full write, not just the cookie: whatever only the mirror still remembers is put
  // back into localStorage at the same time, so a swept store heals on the way in
  // rather than waiting for the player to finish another puzzle.
  write(read());
}

/**
 * Whether anything written here will still be here after the browser is quit, checked
 * by writing and reading back rather than by trusting the call not to throw. False in a
 * private tab and with cookies blocked -- the two states where a player earns a streak,
 * closes Safari and finds it gone, with nothing so far to warn them.
 */
export function isPersistent(): boolean {
  try {
    const probe = `${storeKey()}:probe`;
    localStorage.setItem(probe, '1');
    const ok = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    if (ok) return true;
  } catch {
    // Fall through: the cookie mirror is the other half of the answer.
  }
  return backup.persists();
}

/** Any recorded result for a day, whatever version it was set on. Feeds the stats. */
export function getResult(day: number): Result | undefined {
  return read().results[String(day)];
}

/** Whether a day is over for this player, and whether it is still the day they played. */
export interface DayState {
  /**
   * The recorded result that closes the day, if there is one. Matched on the day alone:
   * a day somebody has finished is finished, whatever the puzzle has become since.
   */
  result?: Result;
  /**
   * The day was redefined after that result was set -- re-tuned, re-hidden, or the shape
   * swapped. Worth telling the player about and worth offering another go at, but never
   * grounds for taking the finished board away: the replay would then supersede the time
   * they really set, and no server holds a copy to put back.
   */
  retuned: boolean;
}

/**
 * How a day stands for this player, as the board needs to open it.
 *
 * The two questions here used to be one. `getCurrentResult` answers "is this a solve of
 * the puzzle as it is now", which is the right question for the *tuner* and the wrong one
 * for the *board*: asked at mount it meant that nudging a day's paint handed a fresh clock
 * to everyone who had already finished it, and the replay then overwrote the real time.
 * Keeping them apart is the whole fix -- `result` closes the day, `retuned` only tells the
 * player what happened and offers them the new one.
 */
export function getDayState(day: number, version: string): DayState {
  const result = read().results[String(day)];
  return { result, retuned: result !== undefined && result.v !== version };
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
  record(day, { ms, at: new Date().toISOString(), v: version, m: metrics });
}

/**
 * Close a day the player could not finish: how long they hunted before asking to be
 * shown, and nothing else.
 *
 * Written the same way a solve is, and for the same reason -- the day is over, and
 * coming back to it should hand back the answer rather than a fresh clock and an
 * unlimited second look at the painting. The metrics are kept for the hunt trace alone,
 * so a give-up shared after coming back still shows how the looking went; the Find Me
 * Age is never read off them, since there is nothing honest it could say about a run
 * that did not end in a find.
 */
export function saveGaveUp(day: number, ms: number, version: string, metrics?: RunMetrics): void {
  record(day, { ms, at: new Date().toISOString(), v: version, m: metrics, gaveUp: true });
}

function record(day: number, result: Result): void {
  const store = read();
  const key = String(day);
  const existing = store.results[key];
  // Keep the first result of a given puzzle, so replaying cannot improve the record --
  // but a result from an older version of the day is superseded, not protected.
  if (existing && existing.v === result.v) return;
  store.results[key] = result;
  write(store);
}

/**
 * Put a result back, over whatever the day currently holds, and hand back what it
 * displaced.
 *
 * The one write here that ignores `record`'s rules, and the only one that ever should.
 * `record` protects a day from being improved by a replay and supersedes it when the
 * puzzle is redefined, and both are right for a run somebody has just played -- but they
 * are also how a real time gets lost, and a rule cannot repair a case it caused. So the
 * repair is a separate door, reached only from `?restore` (see `restore.ts`), which is
 * opened by hand for one person at a time.
 *
 * It returns the old result rather than swallowing it, because a restore is done on
 * somebody's word about a day they played: what it overwrote is the only check that the
 * link went to the right browser and named the right day, and it has to be visible.
 */
export function restoreResult(day: number, result: Result): Result | undefined {
  const store = read();
  const key = String(day);
  const existing = store.results[key];
  store.results[key] = result;
  write(store);
  return existing;
}

export interface Stats {
  played: number;
  best: number | null;
  streak: number;
}

export function getStats(today: number): Stats {
  const store = read();
  const results = store.results;
  const days = Object.keys(results)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  let best: number | null = null;
  for (const d of days) {
    const result = results[String(d)];
    // A give-up is a played day, not a time: it has no business in a best.
    if (result.gaveUp) continue;
    if (best === null || result.ms < best) best = result.ms;
  }

  // Count back from today (or yesterday, if today is not solved yet). A day that was
  // given up on stops the count where it stands -- including today's, which is what
  // makes pressing the button an honest answer rather than a cheap way to bank a day.
  let streak = 0;
  let cursor = results[String(today)] ? today : today - 1;
  while (results[String(cursor)] && !results[String(cursor)].gaveUp) {
    streak++;
    cursor--;
  }

  // Days the mirror could only count, not name, still show up in the totals -- but
  // never in the streak, which needs to know which days they were.
  const carried = store.carried;
  if (carried) {
    if (carried.best !== null && (best === null || carried.best < best)) best = carried.best;
  }

  return { played: Math.max(days.length, carried?.played ?? 0), best, streak };
}

/** One recorded day, as the stats panel needs it. */
export interface HistoryDay {
  day: number;
  ms: number;
  gaveUp: boolean;
}

export interface History {
  /** Every day this browser can name, oldest first, whatever version it was set on. */
  days: HistoryDay[];
  /**
   * Days the cookie mirror still counts towards `played` but can no longer name, because
   * they fell out of the window it keeps. Zero almost everywhere; never guessed at.
   */
  unnamed: number;
}

/** Everything recorded, in day order -- the same results `getStats` reduces to three numbers. */
export function getHistory(): History {
  const store = read();
  const days = Object.keys(store.results)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((day) => {
      const result = store.results[String(day)];
      return { day, ms: result.ms, gaveUp: result.gaveUp === true };
    });
  const unnamed = Math.max(0, (store.carried?.played ?? 0) - days.length);
  return { days, unnamed };
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
  /**
   * The run id used for the daily tally, so a resumed run keeps reporting as the run it
   * already was rather than counting as a second player. Optional: a run banked by an
   * older build has none, and reports under a fresh one. See `count.ts`.
   */
  r?: string;
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
  const held = store.progress;
  /**
   * A run's clock only ever moves forward.
   *
   * Banking happens when a page is hidden, and a phone can have more than one page of the
   * same day alive at once -- a second tab, or one the browser froze and handed back. Such
   * a page knows only what it last saw, so when it is hidden *after* the page the player
   * has been playing on, it used to write its older clock straight over the newer run: the
   * player came back to the run as it stood at whatever moment that other page last looked
   * at it, however long they had played since, and every return handed back the same stale
   * time. The fuller run is the truer one, so it stands.
   *
   * Only within one run, which is what the day and version being equal means -- a shorter
   * run on another day, or on a re-defined puzzle, is a different run and simply replaces
   * this one.
   */
  const stale =
    held !== undefined && held.day === progress.day && held.v === progress.v && held.ms > progress.ms;
  store.progress = { ...(stale ? held : progress), at: new Date().toISOString() };
  write(store);
}

export function clearProgress(): void {
  const store = read();
  if (!store.progress) return;
  delete store.progress;
  write(store);
}
