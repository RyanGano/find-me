import { describe, expect, it } from 'vitest';
import type { DayTally } from './count';
import { weekdayOf } from './daily';
import { byWeekday, recentMarks, RECENT_WEEKS } from './history';
import type { HistoryDay } from './storage';

// Day 0 is a Wednesday, so day 5 is the first Monday and day 11 the first Sunday.
const MON = 5;

const solved = (day: number, ms: number): HistoryDay => ({ day, ms, gaveUp: false });
const lost = (day: number, ms: number): HistoryDay => ({ day, ms, gaveUp: true });
const tally = (medianMs: number): DayTally => ({ played: 20, solved: 10, medianMs });

describe('weekdayOf', () => {
  it('puts the epoch on a Wednesday and runs Monday first', () => {
    expect(weekdayOf(0)).toBe(2);
    expect(weekdayOf(MON)).toBe(0);
    expect(weekdayOf(MON + 6)).toBe(6);
    expect(weekdayOf(MON + 7)).toBe(0);
  });
});

describe('byWeekday', () => {
  it('gives every weekday a line, Monday first, even the ones never played', () => {
    const week = byWeekday([], new Map());
    expect(week.map((w) => w.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week.every((w) => w.medianMs === null && w.othersMs === null)).toBe(true);
  });

  it('takes the median of the solves on each weekday', () => {
    const days = [solved(MON, 30000), solved(MON + 7, 50000), solved(MON + 14, 90000)];
    expect(byWeekday(days, new Map())[0]).toMatchObject({ solved: 3, gaveUp: 0, medianMs: 50000 });
  });

  it('counts a give-up but keeps it out of the median, as `best` does', () => {
    const days = [solved(MON + 6, 100000), lost(MON + 13, 400000)];
    expect(byWeekday(days, new Map())[6]).toMatchObject({ solved: 1, gaveUp: 1, medianMs: 100000 });
  });

  it('sets everyone beside the player on the same days only', () => {
    const days = [solved(MON, 30000), solved(MON + 7, 40000), lost(MON + 14, 200000)];
    const tallies = new Map([
      [MON, tally(60000)],
      [MON + 7, tally(80000)],
      // A day the player gave up on is not a day they have a time to compare.
      [MON + 14, tally(999000)],
      // Nor is a day they never played.
      [MON + 21, tally(1000)],
    ]);
    expect(byWeekday(days, tallies)[0].othersMs).toBe(70000);
  });

  it('says nothing about everyone when the tally could speak for none of the days', () => {
    expect(byWeekday([solved(MON, 30000)], new Map())[0].othersMs).toBeNull();
  });
});

describe('recentMarks', () => {
  const today = MON + 7 * 5 + 2; // a Wednesday, five weeks in

  it('draws four weeks, a row each, Monday first, ending with this one', () => {
    const marks = recentMarks([], today);
    expect(marks).toHaveLength(RECENT_WEEKS);
    expect(marks.every((row) => row.length === 7)).toBe(true);
    // This week: two gone, today, four still to come.
    expect(marks[3]).toEqual(['missed', 'missed', 'today', 'ahead', 'ahead', 'ahead', 'ahead']);
  });

  it('shows a skipped day as a gap between solves', () => {
    const marks = recentMarks([solved(today - 2, 1000), solved(today, 1000)], today);
    expect(marks[3].slice(0, 3)).toEqual(['solved', 'missed', 'solved']);
  });

  it('marks a give-up as its own thing, not a gap and not a solve', () => {
    expect(recentMarks([lost(today - 1, 1000)], today)[3][1]).toBe('gave-up');
  });

  it('does not call the days before the game existed a gap', () => {
    const marks = recentMarks([], 1).flat();
    expect(marks).toContain('none');
    expect(marks.filter((m) => m === 'missed')).toHaveLength(1); // day 0 only
  });
});
