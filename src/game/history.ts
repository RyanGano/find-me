import type { DayTally } from './count';
import { weekdayOf } from './daily';
import { DAYS_PER_WEEK } from './difficulty';
import type { HistoryDay } from './storage';

/**
 * What the stats panel draws, worked out from the player's own results.
 *
 * Pure: the panel hands in what storage and the tally gave it, and nothing here reads
 * either. Nothing here knows anything about a day the player has not played, either --
 * every number starts from a recorded result.
 */

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** One weekday of the player's week. */
export interface WeekdayLine {
  /** Monday is 0. */
  weekday: number;
  solved: number;
  gaveUp: number;
  /** Median solve time. Give-ups are left out, as they are from `best`. */
  medianMs: number | null;
  /**
   * Everyone's typical time on those same days: the median of each day's own median,
   * over the days the player solved that the tally could speak for. Null when it
   * could speak for none of them.
   */
  othersMs: number | null;
}

/**
 * The player's own ramp: Monday to Sunday, their median beside everyone's on the same
 * days, so a slow Sunday reads against other people's Sundays and not against a number
 * the game made up.
 */
export function byWeekday(days: HistoryDay[], tallies: Map<number, DayTally>): WeekdayLine[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => {
    const mine = days.filter((d) => weekdayOf(d.day) === weekday);
    const solved = mine.filter((d) => !d.gaveUp);
    const others = solved
      .map((d) => tallies.get(d.day)?.medianMs)
      .filter((ms): ms is number => ms !== undefined);
    return {
      weekday,
      solved: solved.length,
      gaveUp: mine.length - solved.length,
      medianMs: median(solved.map((d) => d.ms)),
      othersMs: median(others),
    };
  });
}

/** How many weeks the recent strip shows, this one included. */
export const RECENT_WEEKS = 4;

export type Mark = 'solved' | 'gave-up' | 'missed' | 'today' | 'ahead' | 'none';

/**
 * The last few weeks as marks, a row per week, Monday first, so a broken streak shows as
 * a gap. `today` is today not played yet -- not a gap, since the day is not over; `ahead`
 * is the rest of this week; `none` is before the game existed.
 *
 * Deliberately short. A long grid invites comparing paintings that were never meant to be
 * compared, and the cookie mirror keeps far more days than this, so a day that has only
 * been carried as a count can never be drawn here as a gap it is not.
 */
export function recentMarks(days: HistoryDay[], today: number): Mark[][] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const monday = today - weekdayOf(today) - (RECENT_WEEKS - 1) * DAYS_PER_WEEK;
  return Array.from({ length: RECENT_WEEKS }, (_, w) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, i): Mark => {
      const day = monday + w * DAYS_PER_WEEK + i;
      const found = byDay.get(day);
      if (found) return found.gaveUp ? 'gave-up' : 'solved';
      if (day > today) return 'ahead';
      if (day === today) return 'today';
      return day < 0 ? 'none' : 'missed';
    }),
  );
}
