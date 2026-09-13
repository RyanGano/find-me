import { puzzleForDay, weekdayOf } from './daily';
import { DAYS_PER_WEEK } from './difficulty';
import type { Mark } from './history';
import type { HistoryDay } from './storage';

/**
 * The gallery wall: every painting the player has found at least one day of, with that
 * week's days marked underneath.
 *
 * Derived, never stored. Everything it needs is already recorded -- the days this browser
 * can name, and the calendar that maps a day to its painting -- so it needs no storage of
 * its own and comes back from the cookie mirror with everything else.
 *
 * Nothing here knows where anything was hidden. A `Frame` is a painting and some marks;
 * it is what the share card is drawn from, and the card can only draw what it is given.
 */

/**
 * The first day anyone still has a result for. Every result from day 0 was lost when the
 * site changed address that day, so the opening week is judged from Thursday: four finds
 * are a full week, and Wednesday is drawn as a day before the game began.
 */
export const FIRST_KEPT_DAY = 1;

export interface WallWeek {
  /** Day number of the week's Monday. Negative for the opening week. */
  monday: number;
  /** Monday first. Uses the stats strip's marks, so the two read the same. */
  marks: Mark[];
  found: number;
  gaveUp: number;
  /** Every day of the week anyone could have played was found. */
  full: boolean;
}

export interface Frame {
  /** Asset id: the wall is keyed by painting, not by week. */
  image: string;
  title: string;
  artist: string;
  year: string;
  width: number;
  height: number;
  /** The full asset, for the share card. */
  src: string;
  /** The small copy `npm run thumbs` makes, for the wall. */
  thumb: string;
  /** The best week the player has had on this painting. */
  week: WallWeek;
}

/** The week containing `day`, as the player has it so far. */
export function weekOf(days: HistoryDay[], day: number, today: number): WallWeek {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const monday = day - weekdayOf(day);
  const marks = Array.from({ length: DAYS_PER_WEEK }, (_, i): Mark => {
    const d = monday + i;
    const result = byDay.get(d);
    if (result) return result.gaveUp ? 'gave-up' : 'solved';
    if (d < FIRST_KEPT_DAY) return 'none';
    if (d > today) return 'ahead';
    return d === today ? 'today' : 'missed';
  });
  const found = marks.filter((m) => m === 'solved').length;
  const gaveUp = marks.filter((m) => m === 'gave-up').length;
  // A day before the game began is not one the week is short of; a day still to come is.
  const full = found > 0 && marks.every((m) => m === 'solved' || m === 'none');
  return { monday, marks, found, gaveUp, full };
}

/** A better week has more finds, then fewer give-ups, then is the more recent. */
function better(a: WallWeek, b: WallWeek): boolean {
  if (a.found !== b.found) return a.found > b.found;
  if (a.gaveUp !== b.gaveUp) return a.gaveUp < b.gaveUp;
  return a.monday > b.monday;
}

/** Where `npm run thumbs` puts a painting's small copy, beside the asset itself. */
export function thumbFor(src: string): string {
  return src.replace(/puzzles\/([^/]+)$/, 'puzzles/thumbs/$1');
}

/**
 * The wall, newest painting first. A painting hangs once one of its days was found -- a
 * give-up alone does not hang one -- and there is nothing at all for a week the player
 * missed, because an old day cannot be played again and an empty frame would only be a
 * list of things they can never have.
 *
 * The calendar comes round again, so one painting can have several weeks behind it. It
 * hangs once, with the best of them.
 */
export function galleryWall(days: HistoryDay[], today: number): Frame[] {
  const best = new Map<string, { week: WallWeek; latest: number }>();
  const mondays = new Set(days.filter((d) => !d.gaveUp).map((d) => d.day - weekdayOf(d.day)));
  for (const monday of mondays) {
    const week = weekOf(days, monday, today);
    const image = puzzleForDay(monday).image;
    const held = best.get(image);
    if (!held) best.set(image, { week, latest: monday });
    else {
      if (better(week, held.week)) held.week = week;
      held.latest = Math.max(held.latest, monday);
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[1].latest - a[1].latest)
    .map(([, { week }]) => frameFor(week));
}

/** A week as a frame on the wall. Picks the painting's fields by name, never the day's. */
export function frameFor(week: WallWeek): Frame {
  const p = puzzleForDay(week.monday);
  return {
    image: p.image,
    title: p.title,
    artist: p.artist,
    year: p.year,
    width: p.width,
    height: p.height,
    src: p.src,
    thumb: thumbFor(p.src),
    week,
  };
}
