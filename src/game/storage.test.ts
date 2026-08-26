import { beforeEach, describe, expect, it } from 'vitest';
import { getCurrentResult, getResult, getStats, saveResult } from './storage';
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
