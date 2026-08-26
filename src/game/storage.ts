const KEY = 'find-me:v1';

export interface Result {
  /** Solve time in milliseconds. */
  ms: number;
  /** ISO date string of when it was solved. */
  at: string;
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

export function getResult(day: number): Result | undefined {
  return read().results[String(day)];
}

export function saveResult(day: number, ms: number): void {
  const store = read();
  const key = String(day);
  const existing = store.results[key];
  // Keep the first solve, so replaying a day cannot inflate or improve the record.
  if (existing) return;
  store.results[key] = { ms, at: new Date().toISOString() };
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
