/**
 * Test mode: the whole game, played against a store and a tally row that are not real.
 *
 * `?test` is for walking a change through the real daily puzzle -- the timings, the
 * streak, the result card, the resume-after-leave -- without any of it landing on the
 * record. It is a different thing from practice mode (`?day=`, `?puzzle=`), which forces
 * a puzzle and then writes *nothing at all*: nothing recorded means the storage and
 * tally paths are the two parts of the game a practice run cannot exercise, which is
 * exactly where a UI or timing change is most likely to go wrong.
 *
 * So a test run does write. It writes to its own localStorage key and its own cookie
 * (`storage.ts`, `backup.ts`), so the real streak is untouched and unreadable from here,
 * and its tally beacons carry `dry: true` (`count.ts`), which every reader excludes by
 * default. Nothing has to be cleaned up afterwards -- and nothing here is a user id: a
 * run is still keyed by the random per-run id it always was.
 *
 * It sticks for the tab. A query parameter alone is lost by any reload that does not
 * carry it -- the update-available reload, a relaunch from the home screen -- and a
 * player who silently fell back to the real store halfway through a test run would be
 * writing real results while believing they were not. `?test=off` leaves it, as does
 * closing the tab.
 */

const KEY = 'find-me:test-mode';

/** True for `?test`, `?test=1`; false for `?test=off` and `?test=0`. */
function asked(search: string): boolean | undefined {
  const value = new URLSearchParams(search).get('test');
  if (value === null) return undefined;
  return value !== 'off' && value !== '0';
}

function detect(): boolean {
  let sticky = false;
  try {
    sticky = sessionStorage.getItem(KEY) === '1';
  } catch {
    // Storage disabled: test mode then lasts exactly as long as the URL does.
  }

  let wanted: boolean | undefined;
  try {
    wanted = asked(window.location.search);
  } catch {
    // No `window`, which means a test or a tool, neither of which is in test mode.
  }
  if (wanted === undefined) return sticky;

  try {
    if (wanted) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    // As above.
  }
  return wanted;
}

let active = detect();

export function isTestMode(): boolean {
  return active;
}

/**
 * Re-read the URL and the tab. Only the tests call this; the app decides once, on load,
 * because a mode that could change under a running hunt is a mode that could bank half
 * a run to one store and half to the other.
 */
export function refreshTestMode(): void {
  active = detect();
}
