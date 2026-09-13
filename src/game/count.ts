/**
 * The daily tally.
 *
 * Four numbers are worth knowing about a daily puzzle: how many runs were started, how
 * many were solved, how long the solves took, and how long the ones that ended some
 * other way lasted first. Nothing here is capable of answering anything else -- there is
 * no account, no cookie, no fingerprint, and no identifier that outlives a single run.
 *
 * A run reports up to four times: once when the clock starts, once if the player reaches
 * for the way out before it is open, once whenever the page is left with the run
 * unfinished or given up on, and once on the solve. All of them carry the same run id, a
 * random number minted at the start of the run and thrown away with it, so the server
 * can collapse them into one row rather than counting a back-swipe as a second player.
 *
 * `countHide` at the foot is the one thing here that is not about a day: five counters
 * saying whether anyone uses `hide one for a friend` at all. It carries no day, no
 * puzzle and no hide -- see the note above it.
 *
 * Everything here fails silently. A blocked request, a missing endpoint, a browser with
 * no `sendBeacon` -- none of it is allowed to cost the player their run.
 */

import { hideLink, readShortCode, shortLink, type Hide } from './hide';
import { isTestMode } from './testMode';

const OPT_OUT = 'find-me:no-count';

/**
 * What a run has come to. The four endings are ranked on the server, so a run only ever
 * moves up: a solve can never be undone by the page-leave beacon that follows it, and an
 * explicit `gave-up` is never overwritten by the `left` that comes when the tab closes.
 *
 * `stuck` is the odd one out and is not an ending at all. It is reported once, the first
 * time a player presses the way out before the day has let them have it, and the server
 * records it alongside whatever the run goes on to become. It is the cheapest honest
 * reading of "this day is harder than it was priced at" that the tally can take: unlike
 * a leave it cannot be a phone call, and unlike a give-up it is also sent by the people
 * who went on to find it.
 *
 * `shared` is the other one that is not an ending: the player pressed share on the result
 * card. The server records it as a flag on a run it already has, and never lets it create
 * a run, so it can never count as a play.
 *
 * `stats` is sent once per page load when the player opens their stats panel. On a run the
 * server already has it is a flag like a share; with no run behind it -- the panel opened
 * before the clock starts, or on a board reopened after a reload -- the server counts the
 * open on its own. Either way it never counts as a play.
 *
 * `hint` is sent once, when the player takes the hint, with the run clock at that moment.
 * Like `stuck` it is kept beside whatever the run goes on to become, so a day's page can
 * say how many people took a hint and how many of them then found the shape.
 */
export type RunState = 'start' | 'stuck' | 'left' | 'gave-up' | 'solved' | 'shared' | 'stats' | 'hint';

export interface CountPayload {
  run: string;
  day: number;
  state: RunState;
  /** Run-clock milliseconds, excluding pauses. Absent on `start`, where it is always 0. */
  ms?: number;
  /**
   * A checking run rather than a player -- somebody walking the game in `?test` to see a
   * change working. Sent so the row exists and the whole write path is exercised, and
   * flagged so every reader can leave it out: a row that says it is a dry run can be
   * excluded, and a row that was never written cannot be reasoned about at all. The same
   * flag the play-test bench puts on a review it does not want counted.
   *
   * Absent, rather than false, on a real run.
   */
  dry?: true;
}

/**
 * Where the counts go, baked in at build time. Empty in dev and in any build that was
 * not given one, which turns the whole module into a no-op -- a developer's runs are not
 * players, and a fork of this repo should not be posting to my endpoint.
 */
function endpoint(): string {
  return import.meta.env.VITE_COUNT_URL ?? '';
}

/** False once the player has asked not to be counted. Storage failures count as opted in. */
export function isCounted(): boolean {
  try {
    return localStorage.getItem(OPT_OUT) === null;
  } catch {
    return true;
  }
}

export function setCounted(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OPT_OUT);
    else localStorage.setItem(OPT_OUT, '1');
  } catch {
    // Storage disabled: the choice cannot be remembered, but nothing breaks.
  }
}

/**
 * A fresh run id. Random, per-run, and stored only alongside the run it belongs to, so
 * it is gone the moment that run ends.
 */
export function newRunId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Older browsers, or a page served without a secure context.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * Report where a run has got to.
 *
 * The body goes as `text/plain` on purpose: a JSON content type would make this a
 * preflighted cross-origin request, and a preflight cannot be relied on during page
 * unload -- exactly the moment the `left` report has to survive.
 */
export function count(run: string, day: number, state: RunState, ms?: number): void {
  const url = endpoint();
  if (!url || !isCounted()) return;

  const payload: CountPayload = { run, day, state };
  if (ms !== undefined) payload.ms = Math.max(0, Math.round(ms));
  if (isTestMode()) payload.dry = true;
  const body = JSON.stringify(payload);

  try {
    // `sendBeacon` is the only send that outlives the page, which is what a leave needs.
    if (state === 'left' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      return;
    }
    void fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  } catch {
    // Blocked, offline, or refused. The run is unaffected.
  }
}

/** How everyone else did on a day, as the server hands it back. Aggregates only. */
export interface DayTally {
  played: number;
  solved: number;
  medianMs: number;
}

/**
 * Fewer solves than this and the card says nothing. A median of a handful is noise, and a
 * median of one is somebody's time. The server holds the same floor, so a thin day never
 * leaves it at all; this is the client refusing to trust that.
 *
 * Low while the game is in beta, so the line can be seen at all. The issue that asked for
 * it started at 30, which is where this should go once there are players to fill it.
 */
export const TALLY_FLOOR = 5;

/**
 * Read how everyone else did on a day, or null.
 *
 * Only ever called once a run is over -- a solve rate on screen before or during a hunt
 * is a difficulty hint, and would leak into the very times the ramp is tuned against.
 * Silent on every failure, like everything else here: no endpoint, opted out, blocked,
 * slow, malformed or thin all come back as null, and the card simply goes without.
 */
export async function fetchTally(day: number, timeoutMs = 5000): Promise<DayTally | null> {
  const url = endpoint();
  if (!url || !isCounted()) return null;
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // A plain GET with no custom headers: a simple request, so no preflight.
      const res = await fetch(`${url}?day=${day}`, { mode: 'cors', signal: ctrl?.signal });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      return readTally(body);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/** Most days one read asks for; the server refuses to answer more than this anyway. */
export const MAX_TALLY_DAYS = 60;

/**
 * How everyone did on several days at once, for the stats panel. Only days that clear
 * the floor come back; the rest, and every failure, are simply absent.
 *
 * The caller asks only for days the player has already finished, so this can never be
 * the difficulty hint `fetchTally` is careful not to be.
 */
export async function fetchTallies(
  days: number[],
  timeoutMs = 5000,
): Promise<Map<number, DayTally>> {
  const found = new Map<number, DayTally>();
  const url = endpoint();
  const asked = days.slice(-MAX_TALLY_DAYS);
  if (!url || !isCounted() || asked.length === 0) return found;
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}?days=${asked.join(',')}`, {
        mode: 'cors',
        signal: ctrl?.signal,
      });
      if (!res.ok) return found;
      const body: unknown = await res.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return found;
      for (const day of asked) {
        const t = readTally((body as Record<string, unknown>)[String(day)]);
        if (t) found.set(day, t);
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    // Blocked, slow or refused: the panel draws the player's own times on their own.
  }
  return found;
}

function readTally(body: unknown): DayTally | null {
  if (!body || typeof body !== 'object') return null;
  const { played, solved, medianMs } = body as Record<string, unknown>;
  const whole = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
  if (!whole(played) || !whole(solved) || !whole(medianMs)) return null;
  if (solved < TALLY_FLOOR || solved > played) return null;
  return { played, solved, medianMs };
}

/**
 * What somebody did with `hide one for a friend`, as a feature rather than as a puzzle.
 *
 * The five readings are a funnel: the maker was opened, a hide was shared, a hide was
 * opened, it was found, and the finder told the setter. What is wanted from them is
 * whether anyone uses the thing at all -- so nothing here says *which* painting, *which*
 * shape or *which* hide, and there is nothing to say it with: a hide has no day and no
 * calendar slot, and none of this travels near the run tally. A hide is still never a
 * play.
 */
export type HideEvent = 'opened' | 'made' | 'hunted' | 'found' | 'told' | 'broken';

/** Why a hide link did not open: the reasons `decodeHide`, `storedHide` and `fetchHide` give. */
export type BrokenReason = 'malformed' | 'future' | 'painting' | 'unknown' | 'unreachable';

export interface HidePayload {
  kind: 'hide';
  event: HideEvent;
  /** On `made`: the share went out as the long `#h=` link, because no short code was had. */
  long?: true;
  /** On `broken`: why the link did not open. */
  reason?: BrokenReason;
  /**
   * A random id minted on this page load and never kept, so the server can write each
   * event once rather than counting a double-tap on share as two. It groups the events of
   * one page load and nothing else: the maker and the hunt are different page loads and
   * carry different ids, and nothing survives a reload.
   */
  page: string;
  /** A `?test` walk-through rather than a person, exactly as on a run. */
  dry?: true;
}

let pageId: string | null = null;

/** Report one thing somebody did with the hide feature. Silent on every failure. */
export function countHide(event: HideEvent, extra: { long?: true; reason?: BrokenReason } = {}): void {
  const url = endpoint();
  if (!url || !isCounted()) return;

  pageId ??= newRunId();
  const payload: HidePayload = { kind: 'hide', event, page: pageId };
  if (event === 'made' && extra.long) payload.long = true;
  if (event === 'broken' && extra.reason) payload.reason = extra.reason;
  if (isTestMode()) payload.dry = true;

  try {
    void fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  } catch {
    // Blocked, offline, or refused. Nothing the setter or finder is doing is affected.
  }
}

/** What a stored hide is posted as. The hide's own fields, and nothing about who set it. */
export interface StorePayload {
  kind: 'store';
  image: string;
  shape: string;
  cx: number;
  cy: number;
  size: number;
  angle: number;
  fill: string;
  opacity: number;
  name?: string;
  /** A hide made under `?test`, which every reader leaves out. */
  dry?: true;
}

/**
 * The link a setter sends: a short `?p=` code when the hide could be stored, else the long
 * `#h=` link, which always works.
 *
 * Storing a hide is sending the player's data, so it follows the same switch as every
 * beacon, checked on every share: with counting off, or no endpoint, nothing is sent at
 * all -- not even an attempt -- and the long link comes straight back. Otherwise the
 * server has `timeoutMs` to answer with a code, and anything short of that is the long link.
 */
export async function shortHideLink(
  hide: Hide,
  site: string,
  timeoutMs = 1500,
): Promise<{ link: string; short: boolean }> {
  const long = { link: hideLink(hide, site), short: false };
  const url = endpoint();
  if (!url || !isCounted()) return long;

  const payload: StorePayload = {
    kind: 'store',
    image: hide.image,
    shape: hide.shape,
    cx: hide.cx,
    cy: hide.cy,
    size: hide.size,
    angle: hide.angle,
    fill: hide.fill,
    opacity: hide.opacity,
  };
  if (hide.name) payload.name = hide.name;
  if (isTestMode()) payload.dry = true;

  const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      ctrl?.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const asked = (async () => {
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        mode: 'cors',
        signal: ctrl?.signal,
      });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
      return typeof code === 'string' ? readShortCode(code) : null;
    })().catch(() => null);
    const code = await Promise.race([asked, timeout]);
    return code ? { link: shortLink(code, site), short: true } : long;
  } catch {
    return long;
  } finally {
    clearTimeout(timer);
  }
}

export type Fetched = { ok: true; body: unknown } | { ok: false; reason: 'unknown' | 'unreachable' };

/**
 * A stored hide by its code, for whoever was sent it.
 *
 * Not behind the counting switch: this is how the puzzle is delivered, not a report about
 * the player. So it carries the code and nothing else -- no page id, no run id, no `dry`,
 * no custom header, no cookie and no referrer -- and the server keeps nothing about it.
 * A code that cannot be one never reaches the network.
 */
export async function fetchHide(raw: string, timeoutMs = 5000): Promise<Fetched> {
  const code = readShortCode(raw);
  if (!code) return { ok: false, reason: 'unknown' };
  const url = endpoint();
  if (!url) return { ok: false, reason: 'unreachable' };
  const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}?hide=${code}`, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctrl?.signal,
    });
    if (res.status === 404) return { ok: false, reason: 'unknown' };
    if (!res.ok) return { ok: false, reason: 'unreachable' };
    return { ok: true, body: await res.json() };
  } catch {
    return { ok: false, reason: 'unreachable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
