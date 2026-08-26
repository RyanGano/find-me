import { describe, expect, it } from 'vitest';
import { dayIndex, EPOCH, msUntilTomorrow, puzzleForDay, selectPuzzle } from './daily';
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
    expect(puzzleForDay(0).id).toBe(PUZZLES[0].id);
    expect(puzzleForDay(PUZZLES.length).id).toBe(PUZZLES[0].id);
    expect(puzzleForDay(PUZZLES.length + 2).id).toBe(PUZZLES[2].id);
  });

  it('handles negative days without crashing', () => {
    expect(puzzleForDay(-1).id).toBe(PUZZLES[PUZZLES.length - 1].id);
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
    expect(s.puzzle.id).toBe(PUZZLES[3].id);
    expect(s.isPractice).toBe(true);
  });

  it('honours ?puzzle=', () => {
    const s = selectPuzzle('?puzzle=starry', EPOCH);
    expect(s.puzzle.id).toBe('starry');
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
