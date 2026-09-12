import { useEffect, useState } from 'react';
import { dayIndex, msUntilTomorrow } from '../game/daily';

/**
 * Never re-check more often than this, however the arithmetic lands.
 *
 * `msUntilTomorrow` adds a flat 24 hours to local midnight, which is the wrong length of
 * day twice a year. On the short one the timer fires before the date has actually turned;
 * without a floor here that would re-arm for a few milliseconds at a time until it caught
 * up, which is a spin rather than a wait.
 */
const MIN_GAP_MS = 30 * 1000;

/**
 * True once the player's own local day has moved past the one the page opened with.
 *
 * The day a page is serving is chosen once, at mount, from `dayIndex()` -- so a tab left
 * open overnight went on showing yesterday's painting, timing it, and recording the solve
 * against yesterday's slot. Nobody leaves a game open on purpose for sixteen hours; they
 * open it in the morning, get distracted, and find it again the next day, which is exactly
 * when the calendar has moved and the page has not.
 *
 * It only ever flips on, like the update notice: the day cannot un-turn, and a caller
 * acting on it should not have to cope with it changing its mind.
 *
 * Re-checked on the way back to the tab as well as on a timer, because a timer is the one
 * thing that cannot be relied on here -- a phone asleep or a tab thrown into the
 * background does not fire one on time, and coming back to the page is the moment the
 * answer matters.
 */
export function useDayRollover(active: boolean): boolean {
  const [rolled, setRolled] = useState(false);

  useEffect(() => {
    if (!active || rolled) return;
    const opened = dayIndex();
    let timer = 0;

    const check = () => {
      if (dayIndex() !== opened) {
        setRolled(true);
        return;
      }
      // Re-armed from the clock each time rather than trusting the delay just slept: a
      // machine that was suspended wakes up with a timer that fired late, or not at all.
      timer = window.setTimeout(check, Math.max(msUntilTomorrow(), MIN_GAP_MS));
    };

    timer = window.setTimeout(check, Math.max(msUntilTomorrow(), MIN_GAP_MS));
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [active, rolled]);

  return rolled;
}
