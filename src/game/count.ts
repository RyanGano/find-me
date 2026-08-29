/**
 * The daily tally.
 *
 * Four numbers are worth knowing about a daily puzzle: how many runs were started, how
 * many were solved, how long the solves took, and how long the give-ups lasted before
 * the player walked away. Nothing here is capable of answering anything else -- there is
 * no account, no cookie, no fingerprint, and no identifier that outlives a single run.
 *
 * A run reports up to three times: once when the clock starts, once whenever the page is
 * left with the run unfinished, and once on the solve. All three carry the same run id,
 * a random number minted at the start of the run and thrown away with it, so the server
 * can collapse them into one row rather than counting a back-swipe as a second player.
 *
 * Everything here fails silently. A blocked request, a missing endpoint, a browser with
 * no `sendBeacon` -- none of it is allowed to cost the player their run.
 */

const OPT_OUT = 'find-me:no-count';

/** What a run has come to. Ranked on the server: a solve can never be undone by a leave. */
export type RunState = 'start' | 'left' | 'solved';

export interface CountPayload {
  run: string;
  day: number;
  state: RunState;
  /** Run-clock milliseconds, excluding pauses. Absent on `start`, where it is always 0. */
  ms?: number;
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
