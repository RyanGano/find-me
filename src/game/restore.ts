/**
 * `?restore=` -- putting a time back on the browser that lost it.
 *
 * Every result lives in that player's own `localStorage` and nowhere else: the daily
 * tally is keyed by a run id minted at the start of a run and forgotten with it, so
 * there is no server-side record of anyone's day to correct. When a time is lost --
 * `record` supersedes a result whose puzzle has been redefined, so a replay on a
 * re-tuned day writes over the time that was really set -- the repair has to happen in
 * the player's browser, and the player is on a phone with no console in it.
 *
 * So this is a link you can send them. It carries the day, the time and the version it
 * was set on, writes exactly that, and says on screen what it replaced.
 *
 * It is not a hole in anything. A result only ever affects the browser it is written on:
 * it moves that player's own board, streak and best, and the tally cannot see it. A
 * player who wanted to lie to themselves about their own stats could already do it with
 * devtools on a desktop; what this adds is a way for somebody to be *helped* on a phone,
 * where they cannot. Nothing here can reach another player, the calendar or the counts.
 *
 * Deliberately unable to do two things. It cannot forge a puzzle: the version is written
 * as given, so a wrong one leaves the day playable rather than passing an invented time
 * off as a solve of the current puzzle. And it cannot silently overwrite: the page always
 * reports what was there before, so a link sent to the wrong person, or carrying the
 * wrong day, is visible as soon as it is opened rather than a month later.
 */

import { dayIndex, dayOfNumber, puzzleNumber } from './daily';
import { restoreResult, type Result } from './storage';

/** What a restore link asks for, once it has been read and found to be plausible. */
export interface RestoreRequest {
  /** The number the player sees and shares: `Find Me #18`. */
  number: number;
  /** The key results are stored under, which is one less. */
  day: number;
  ms: number;
  /** The puzzle version the time was set on. Written as given; never guessed at. */
  v: string;
  gaveUp: boolean;
}

/**
 * A run clock longer than this is not a time anybody set. The same bound the tally
 * server holds its rows to -- a restore is not the place to widen it.
 */
const MAX_MS = 24 * 60 * 60 * 1000;

/** Base-36 of a 32-bit hash, as `fingerprint` in `build.ts` makes it. */
const VERSION = /^[0-9a-z]{1,12}$/;

/**
 * Read `?restore=<puzzle>:<ms>:<version>`, with a trailing `:g` for a day that was given
 * up on rather than solved.
 *
 * The puzzle *number* rather than the stored day index, because the number is what the
 * player has in front of them -- it is what the share text says and what they will quote
 * when they write in. Converting it here is one place to get the offset right; asking
 * whoever writes the link to subtract one is a place to get it wrong.
 *
 * `null` when there is no such parameter at all. A malformed one comes back as
 * `{ raw }` with no request, so the page can say the link is wrong rather than quietly
 * doing nothing and looking like it worked.
 */
export function parseRestore(
  search: string,
  now: Date = new Date(),
): { raw: string; request?: RestoreRequest } | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get('restore');
  } catch {
    return null;
  }
  if (raw === null) return null;

  const parts = raw.split(':');
  if (parts.length < 3 || parts.length > 4) return { raw };
  const [rawNumber, rawMs, v, flag] = parts;
  if (parts.length === 4 && flag !== 'g') return { raw };
  if (!VERSION.test(v)) return { raw };

  const number = Number(rawNumber);
  const ms = Number(rawMs);
  if (!Number.isInteger(number) || !Number.isInteger(ms)) return { raw };
  // A day nobody has reached yet has no time to put back, and a time of zero is not one.
  if (number < 1 || number > puzzleNumber(dayIndex(now))) return { raw };
  if (ms <= 0 || ms > MAX_MS) return { raw };

  return { raw, request: { number, day: dayOfNumber(number), ms, v, gaveUp: flag === 'g' } };
}

/** What the day held before the restore, if anything, and what it holds now. */
export interface RestoreOutcome {
  replaced?: Result;
  written: Result;
}

function apply(request: RestoreRequest): RestoreOutcome {
  const written: Result = {
    ms: request.ms,
    at: new Date().toISOString(),
    v: request.v,
    // No metrics, which is the one thing a restore cannot bring back. A result without
    // them reads its Find Me Age off the clock alone, exactly as a result restored from
    // the cookie mirror does -- see `backup.ts`.
    ...(request.gaveUp ? { gaveUp: true as const } : {}),
  };
  return { replaced: restoreResult(request.day, written), written };
}

/**
 * The write, done once per page load however many times it is asked for.
 *
 * React's strict mode runs an effect twice in development, and a second write would
 * report the day as having replaced the value this very page had just put there --
 * turning the one piece of evidence that the link went to the right person into a
 * tautology. The write itself is idempotent; the answer is what has to be held.
 */
let outcome: RestoreOutcome | undefined;

export function applyRestoreOnce(request: RestoreRequest): RestoreOutcome {
  if (!outcome) outcome = apply(request);
  return outcome;
}

/** Only the tests call this; the page loads once and restores once. */
export function forgetRestore(): void {
  outcome = undefined;
}
