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
 * It lasts exactly as long as the URL says so, and not one load longer. A flag that
 * outlived the address would have to be *left* rather than simply navigated away from,
 * and the ways of leaving are not all under the player's nose: `sessionStorage` survives
 * every navigation within a tab and is handed back by session restore, so quitting the
 * browser and reopening it would return someone to test mode without their having asked
 * for it twice. Going to the plain address means the real game, always. The one reload
 * the app performs itself -- the update notice -- keeps the query string, so a test run
 * cannot lose the mode underneath itself either.
 */

/** True for `?test` and `?test=1`; false for `?test=off` and `?test=0`. */
function asked(search: string): boolean {
  const value = new URLSearchParams(search).get('test');
  if (value === null) return false;
  return value !== 'off' && value !== '0';
}

function detect(): boolean {
  try {
    return asked(window.location.search);
  } catch {
    // No `window`, which means a test or a tool, neither of which is in test mode.
    return false;
  }
}

let active = detect();

export function isTestMode(): boolean {
  return active;
}

/**
 * Re-read the URL. Only the tests call this; the app decides once, on load, because a
 * mode that could change under a running hunt is a mode that could bank half a run to
 * one store and half to the other.
 */
export function refreshTestMode(): void {
  active = detect();
}
