import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProgress,
  getCurrentResult,
  getProgress,
  getResult,
  getStats,
  saveProgress,
  saveResult,
} from './storage';
import { PUZZLES } from './puzzles';

const KEY = 'find-me:v1';

/** Minimal localStorage, since the tests run in node. */
function installStorage(): void {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
  });
}

const V1 = 'aaaa';
const V2 = 'bbbb';

beforeEach(() => {
  installStorage();
});

describe('saveResult / getCurrentResult', () => {
  it('records and reads back a solve', () => {
    saveResult(3, 12345, V1);
    expect(getCurrentResult(3, V1)?.ms).toBe(12345);
  });

  it('keeps the first solve of a puzzle, so replaying cannot improve it', () => {
    saveResult(3, 12345, V1);
    saveResult(3, 999, V1);
    expect(getCurrentResult(3, V1)?.ms).toBe(12345);
  });

  it('hides a result recorded against a different version of the day', () => {
    saveResult(3, 12345, V1);
    expect(getCurrentResult(3, V2)).toBeUndefined();
  });

  it('lets a redefined puzzle be played and recorded again', () => {
    saveResult(3, 12345, V1);
    saveResult(3, 4321, V2);
    expect(getCurrentResult(3, V2)?.ms).toBe(4321);
    // ...and the new time is now the one that is protected.
    saveResult(3, 10, V2);
    expect(getCurrentResult(3, V2)?.ms).toBe(4321);
  });

  it('treats a pre-versioning result as belonging to a puzzle that is gone', () => {
    // Exactly what is sitting in players' browsers from before versioning existed.
    localStorage.setItem(KEY, JSON.stringify({ results: { 3: { ms: 12345, at: '2026-08-26T00:00:00.000Z' } } }));
    expect(getResult(3)?.ms).toBe(12345);
    expect(getCurrentResult(3, V1)).toBeUndefined();
  });

  it('still counts an old result towards the stats it earned', () => {
    localStorage.setItem(KEY, JSON.stringify({ results: { 3: { ms: 12345, at: '2026-08-26T00:00:00.000Z' } } }));
    const stats = getStats(3);
    expect(stats.played).toBe(1);
    expect(stats.best).toBe(12345);
    expect(stats.streak).toBe(1);
  });

  it('survives corrupt stored data', () => {
    localStorage.setItem(KEY, 'not json');
    expect(getCurrentResult(1, V1)).toBeUndefined();
    saveResult(1, 500, V1);
    expect(getCurrentResult(1, V1)?.ms).toBe(500);
  });
});

describe('puzzle versions', () => {
  it('gives every puzzle a version', () => {
    for (const p of PUZZLES) expect(p.version, p.id).toMatch(/^[0-9a-z]+$/);
  });

  it('gives different puzzles different versions', () => {
    expect(new Set(PUZZLES.map((p) => p.version)).size).toBe(PUZZLES.length);
  });

  it('is stable across reads, so a version cannot drift under a stored result', () => {
    expect(PUZZLES.map((p) => p.version)).toEqual(PUZZLES.map((p) => p.version));
  });
});

describe('progress', () => {
  const RUN = { day: 3, v: V1, ms: 8000, t: { x: 10, y: -20, scale: 2.5, rot: 0.4 }, w: 800, h: 600 };

  it('hands back the run it stored', () => {
    saveProgress(RUN);
    const back = getProgress(3, V1);
    expect(back?.ms).toBe(8000);
    expect(back?.t).toEqual(RUN.t);
    expect(back?.w).toBe(800);
    expect(back?.h).toBe(600);
  });

  it('has nothing to hand back before a run is stored', () => {
    expect(getProgress(3, V1)).toBeUndefined();
  });

  it('refuses a run stored against another day, and drops it', () => {
    saveProgress(RUN);
    expect(getProgress(4, V1)).toBeUndefined();
    expect(getProgress(3, V1)).toBeUndefined();
  });

  it('refuses a run stored against an older version of the day', () => {
    saveProgress(RUN);
    expect(getProgress(3, V2)).toBeUndefined();
  });

  it('refuses a run left sitting longer than the resume window', () => {
    saveProgress(RUN);
    const store = JSON.parse(localStorage.getItem(KEY)!);
    store.progress.at = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(KEY, JSON.stringify(store));
    expect(getProgress(3, V1)).toBeUndefined();
  });

  it('keeps only the latest run', () => {
    saveProgress(RUN);
    saveProgress({ ...RUN, ms: 20000 });
    expect(getProgress(3, V1)?.ms).toBe(20000);
  });

  it('clears on request, leaving recorded results alone', () => {
    saveResult(3, 12345, V1);
    saveProgress(RUN);
    clearProgress();
    expect(getProgress(3, V1)).toBeUndefined();
    expect(getCurrentResult(3, V1)?.ms).toBe(12345);
  });

  it('ignores a malformed stored run', () => {
    localStorage.setItem(KEY, JSON.stringify({ results: {}, progress: { day: 3, v: V1 } }));
    expect(getProgress(3, V1)).toBeUndefined();
  });

  it('leaves results readable alongside a stored run', () => {
    saveProgress(RUN);
    saveResult(3, 12345, V1);
    expect(getProgress(3, V1)?.ms).toBe(8000);
    expect(getStats(3).played).toBe(1);
  });
});
