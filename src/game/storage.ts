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
}

interface Store {
  results: Record<string, Result>;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { results: {} };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { results: parsed.results ?? {} };
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

export function saveResult(day: number, ms: number, version: string): void {
  const store = read();
  const key = String(day);
  const existing = store.results[key];
  // Keep the first solve of a given puzzle, so replaying cannot improve the record --
  // but a result from an older version of the day is superseded, not protected.
  if (existing && existing.v === version) return;
  store.results[key] = { ms, at: new Date().toISOString(), v: version };
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
