import { describe, expect, it } from 'vitest';
import { dayIndex, EPOCH, msUntilTomorrow, puzzleForDay, selectPuzzle, weekday } from './daily';
import { DAYS_PER_WEEK, RAMP } from './difficulty';
import { PUZZLES } from './puzzles';
import { targetDisplaySize } from './match';
import { getShape } from './shapes';

describe('dayIndex', () => {
  it('numbers the epoch day zero', () => {
    expect(dayIndex(EPOCH)).toBe(0);
  });

  it('ignores the time of day', () => {
    const late = new Date(EPOCH);
    late.setHours(23, 59, 59, 999);
    expect(dayIndex(late)).toBe(0);
  });

  it('counts whole local days, across a daylight-saving boundary', () => {
    const d = new Date(EPOCH);
    d.setDate(d.getDate() + 200);
    expect(dayIndex(d)).toBe(200);
  });
});

describe('puzzleForDay', () => {
  it('cycles through the list', () => {
    expect(puzzleForDay(PUZZLES.length).id).toBe(puzzleForDay(0).id);
    expect(puzzleForDay(PUZZLES.length + 2).id).toBe(puzzleForDay(2).id);
  });

  it('handles negative days without crashing', () => {
    expect(puzzleForDay(-1).id).toBe(puzzleForDay(PUZZLES.length - 1).id);
  });

  /**
   * The calendar promise, and the reason the whole list is stored Monday-first: a real
   * Monday gets a Monday puzzle. Walked over a long stretch of real dates rather than
   * asserted at one point, because the failure mode this guards against -- the ramp
   * drifting a day out of step -- looks perfect on any single day you happen to check.
   */
  it('lines the ramp up with the calendar week', () => {
    const d = new Date(EPOCH);
    for (let i = 0; i < 400; i++) {
      const puzzle = puzzleForDay(dayIndex(d));
      expect(puzzle.dayOfWeek, d.toDateString()).toBe(weekday(d));
      expect(puzzle.id, d.toDateString()).toBe(`${puzzle.image}-${RAMP[weekday(d)].key}`);
      d.setDate(d.getDate() + 1);
    }
  });

  it('holds one painting for a whole Monday-to-Sunday week', () => {
    // Start on the first Monday on or after the epoch, then take seven days at a time.
    const monday = new Date(EPOCH);
    monday.setDate(monday.getDate() + ((7 - weekday(EPOCH)) % 7));
    for (let week = 0; week < 12; week++) {
      const days = [];
      for (let i = 0; i < DAYS_PER_WEEK; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + week * DAYS_PER_WEEK + i);
        days.push(puzzleForDay(dayIndex(d)));
      }
      expect(new Set(days.map((p) => p.image)).size, `week ${week}`).toBe(1);
      expect(days.map((p) => p.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });
});

describe('selectPuzzle', () => {
  it('returns the daily puzzle with no query string', () => {
    const s = selectPuzzle('', EPOCH);
    expect(s.index).toBe(0);
    expect(s.isPractice).toBe(false);
  });

  it('honours ?day=', () => {
    const s = selectPuzzle('?day=3', EPOCH);
    expect(s.index).toBe(3);
    expect(s.puzzle.id).toBe(puzzleForDay(3).id);
    expect(s.isPractice).toBe(true);
  });

  it('honours ?puzzle=', () => {
    const s = selectPuzzle('?puzzle=starry-wed', EPOCH);
    expect(s.puzzle.id).toBe('starry-wed');
    expect(s.isPractice).toBe(true);
  });

  it('falls back to the daily puzzle for an unknown id', () => {
    expect(selectPuzzle('?puzzle=nope', EPOCH).isPractice).toBe(false);
  });

  it('ignores a non-numeric day', () => {
    expect(selectPuzzle('?day=abc', EPOCH).isPractice).toBe(false);
  });
});

describe('msUntilTomorrow', () => {
  it('is a positive value under a day', () => {
    const ms = msUntilTomorrow(new Date());
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});

describe('puzzle data', () => {
  it('has unique ids', () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
  });

  it('hides every target well inside its image', () => {
    for (const p of PUZZLES) {
      const half = p.target.size / 2;
      expect(p.target.cx, p.id).toBeGreaterThan(half);
      expect(p.target.cy, p.id).toBeGreaterThan(half);
      expect(p.target.cx, p.id).toBeLessThan(p.width - half);
      expect(p.target.cy, p.id).toBeLessThan(p.height - half);
    }
  });

  it('takes its symmetry, label and emoji from the shape registry', () => {
    for (const p of PUZZLES) {
      const shape = getShape(p.target.shape);
      expect(p.target.symmetry, p.id).toBe(shape.symmetry);
      expect(p.thing, p.id).toBe(shape.label);
      expect(p.emoji, p.id).toBe(shape.emoji);
    }
  });

  it('needs a real zoom-in to solve, on a typical viewport', () => {
    for (const p of PUZZLES) {
      const fitScale = Math.min(900 / p.width, 700 / p.height) * 0.92;
      const needed = targetDisplaySize(900, 700) / p.target.size;
      expect(needed / fitScale, p.id).toBeGreaterThan(3);
    }
  });
});
