import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { puzzleForDay } from './daily';
import { FIRST_KEPT_DAY, frameFor, galleryWall, notesFor, thumbFor, weekOf } from './gallery';
import { IMAGES, PUZZLES } from './puzzles';
import type { HistoryDay } from './storage';

// Day 0 is a Wednesday, so the opening week runs from day -2 to day 4, and day 5 is the
// first full week's Monday.
const MON = 5;
const WEEKS = PUZZLES.length / 7;

const found = (day: number): HistoryDay => ({ day, ms: 30000, gaveUp: false });
const lost = (day: number): HistoryDay => ({ day, ms: 300000, gaveUp: true });
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

describe('galleryWall', () => {
  it('is empty with nothing played', () => {
    expect(galleryWall([], 40)).toEqual([]);
  });

  it('hangs a painting for a single find, and marks the rest of the week', () => {
    const wall = galleryWall([found(MON + 1), lost(MON + 2)], MON + 13);
    expect(wall).toHaveLength(1);
    expect(wall[0].image).toBe(puzzleForDay(MON).image);
    expect(wall[0].week.marks).toEqual(['missed', 'solved', 'gave-up', 'missed', 'missed', 'missed', 'missed']);
    expect(wall[0].week.full).toBe(false);
  });

  it('does not hang a week of give-ups', () => {
    expect(galleryWall(range(MON, 7).map(lost), MON + 7)).toEqual([]);
  });

  it('puts a gold frame on seven finds', () => {
    const [frame] = galleryWall(range(MON, 7).map(found), MON + 7);
    expect(frame.week.full).toBe(true);
  });

  it('judges the opening week from the first day anyone kept', () => {
    expect(FIRST_KEPT_DAY).toBe(1);
    const [frame] = galleryWall(range(1, 4).map(found), 20);
    expect(frame.week.marks).toEqual(['none', 'none', 'none', 'solved', 'solved', 'solved', 'solved']);
    expect(frame.week.full).toBe(true);
    // Wednesday, had anyone kept it, still hangs as a find.
    expect(galleryWall([found(0)], 20)[0].week.marks[2]).toBe('solved');
  });

  it('marks today and the days still to come on the week in progress, and is not full yet', () => {
    const [frame] = galleryWall([found(MON), found(MON + 1)], MON + 2);
    expect(frame.week.marks).toEqual(['solved', 'solved', 'today', 'ahead', 'ahead', 'ahead', 'ahead']);
    expect(frame.week.full).toBe(false);
  });

  it('hangs the newest painting first', () => {
    const wall = galleryWall([found(MON), found(MON + 7), found(2)], MON + 8);
    expect(wall.map((f) => f.image)).toEqual([MON + 7, MON, 2].map((d) => puzzleForDay(d).image));
  });

  it('hangs a painting that comes round again once, with its best week', () => {
    const again = MON + 7 * WEEKS;
    const days = [...range(MON, 3).map(found), found(again), lost(MON + 3)];
    const wall = galleryWall(days, again + 3);
    expect(wall).toHaveLength(1);
    expect(wall[0].week.monday).toBe(MON);
    expect(wall[0].week.found).toBe(3);
  });

  it('prefers fewer give-ups, then the more recent week, on a tie', () => {
    const again = MON + 7 * WEEKS;
    expect(galleryWall([found(MON), lost(MON + 1), found(again)], again + 7)[0].week.monday).toBe(again);
    expect(galleryWall([found(MON), found(again)], again + 7)[0].week.monday).toBe(again);
  });

  it('names only the days the store can name', () => {
    // Days the cookie mirror only counts never reach `getHistory().days`, so there is
    // nothing to hang for them and nothing here guesses at them.
    expect(galleryWall([found(MON + 4)], MON + 20)[0].week.found).toBe(1);
  });
});

describe('notesFor', () => {
  it('gives a note only for the days found, Monday first', () => {
    const week = weekOf([found(MON + 3), lost(MON + 1), found(MON)], MON, MON + 13);
    expect(notesFor(week)).toEqual([
      { weekday: 0, note: puzzleForDay(MON).note },
      { weekday: 3, note: puzzleForDay(MON + 3).note },
    ]);
  });

  it('gives nothing for a week with no finds', () => {
    expect(notesFor(weekOf([lost(MON)], MON, MON + 7))).toEqual([]);
  });

  it('gives all seven for a full week, none of them the same', () => {
    const notes = notesFor(weekOf(range(MON, 7).map(found), MON, MON + 7));
    expect(notes.map((n) => n.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(notes.map((n) => n.note)).size).toBe(7);
  });
});

describe('weekOf', () => {
  it('gives the same week whichever day of it is asked for', () => {
    const days = [found(MON), found(MON + 6)];
    expect(weekOf(days, MON + 6, MON + 6)).toEqual(weekOf(days, MON, MON + 6));
  });
});

describe('nothing on the wall or the card knows where a shape was', () => {
  it('builds a frame out of the painting alone', () => {
    const frame = frameFor(weekOf([found(MON)], MON, MON));
    expect(Object.keys(frame).sort()).toEqual(
      ['artist', 'height', 'image', 'src', 'thumb', 'title', 'week', 'width', 'year'],
    );
  });

  it('keeps the card renderer away from puzzles and targets entirely', () => {
    const source = readFileSync('src/game/weekCard.ts', 'utf8');
    expect(source).not.toMatch(/\bTarget\b|\bPuzzle\b|\.target\b|from '\.\/puzzles'|from '\.\/daily'/);
  });
});

describe('thumbnails', () => {
  for (const image of IMAGES) {
    it(`${image.id} has one — run npm run thumbs -- ${image.id}`, () => {
      const src = PUZZLES.find((p) => p.image === image.id)!.src;
      expect(existsSync(`public${thumbFor(src)}`)).toBe(true);
    });
  }
});
