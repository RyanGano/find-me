/**
 * A second, independent copy of the results, kept in a cookie.
 *
 * `localStorage` is the primary store and always will be -- it is bigger, simpler, and
 * holds everything. But on iOS it is the *least* durable thing a page can write. WebKit
 * deletes all script-writable storage (localStorage, IndexedDB, the Cache API) for a
 * site the player has not opened as first-party for seven days, and in a private tab it
 * never survives the tab at all. Both look identical to a player: the streak was there,
 * they quit Safari, the streak was gone.
 *
 * Cookies live under different rules. They are not caught by the seven-day storage
 * sweep; instead a script-set cookie's lifetime is *capped* at seven days and re-armed
 * every time it is written. So a mirror in a cookie, rewritten on every visit, carries a
 * daily player's streak across exactly the wipes that take the localStorage copy -- and
 * on a browser where nothing at all persists, it fails the same way localStorage does,
 * which is what `health()` is for.
 *
 * The price is 4KB. That is not enough for the whole store, so this keeps a compact,
 * lossy mirror: the most recent `KEEP` days as day/time/version, plus the total played
 * and lifetime best for everything older. The per-run metrics are not mirrored; a
 * restored result shows an age taken from its clock alone, exactly like a result
 * recorded before the metrics existed.
 */

const NAME = 'fm-results';

/**
 * How many days of history fit. An entry costs about 20 bytes and a cookie holds 4KB,
 * so this leaves room to spare. Anything older survives only as `played` and `best`.
 */
const KEEP = 150;

/** 400 days, the longest any browser will honour. iOS quietly clamps this to seven. */
const MAX_AGE = 400 * 24 * 60 * 60;

export interface BackupEntry {
  day: number;
  ms: number;
  /** Puzzle version, or undefined for a result recorded before versioning. */
  v?: string;
}

export interface Backup {
  entries: BackupEntry[];
  /** Days played and lifetime best across *all* history, including days not carried. */
  played: number;
  best: number | null;
}

/** base36 for compactness, and because it never needs URL-escaping in a cookie. */
function enc(n: number): string {
  return Math.max(0, Math.round(n)).toString(36);
}

function dec(s: string): number {
  return parseInt(s, 36);
}

function serialise(backup: Backup): string {
  const head = `1~${enc(backup.played)}~${backup.best === null ? '-' : enc(backup.best)}`;
  const rows = backup.entries
    .filter((e) => e.day >= 0 && Number.isFinite(e.day) && Number.isFinite(e.ms))
    .sort((a, b) => b.day - a.day)
    .slice(0, KEEP)
    .map((e) => `${enc(e.day)}:${enc(e.ms)}:${e.v ?? '-'}`);
  return `${head}~${rows.join(',')}`;
}

function parse(raw: string): Backup | undefined {
  const [version, played, best, rows] = raw.split('~');
  if (version !== '1') return undefined;
  const entries: BackupEntry[] = [];
  for (const row of (rows ?? '').split(',')) {
    if (!row) continue;
    const [day, ms, v] = row.split(':');
    const d = dec(day);
    const m = dec(ms);
    // A truncated or mangled cookie costs the entries it damaged, not the whole mirror.
    if (!Number.isFinite(d) || !Number.isFinite(m)) continue;
    entries.push({ day: d, ms: m, v: v && v !== '-' ? v : undefined });
  }
  const p = dec(played);
  const b = dec(best);
  return {
    entries,
    played: Number.isFinite(p) ? p : entries.length,
    best: Number.isFinite(b) ? b : null,
  };
}

function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split('; ')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}

function writeCookie(name: string, value: string): void {
  // `Secure` is safe to set unconditionally: the site is HTTPS, and on `localhost`
  // browsers treat secure cookies as settable anyway.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; SameSite=Lax; Secure`;
}

/** The mirrored results, or undefined if there is no usable cookie (or no cookies). */
export function load(): Backup | undefined {
  try {
    const raw = readCookie(NAME);
    return raw ? parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write the mirror. Also the thing that re-arms its lifetime, so this is worth calling
 * on a plain visit and not only after a solve -- see `touch()`.
 */
export function save(backup: Backup): void {
  try {
    writeCookie(NAME, serialise(backup));
  } catch {
    // Cookies disabled. The localStorage copy is still doing its job, or nothing is.
  }
}

/**
 * Does anything this page writes actually survive? Answered by writing a cookie and
 * reading it back, which is the one check that catches a browser that accepts every
 * call and keeps none of it -- private browsing, or "Block All Cookies".
 */
export function persists(): boolean {
  try {
    const probe = `${NAME}-probe`;
    writeCookie(probe, '1');
    const ok = readCookie(probe) === '1';
    document.cookie = `${probe}=; path=/; max-age=0; SameSite=Lax; Secure`;
    return ok;
  } catch {
    return false;
  }
}
