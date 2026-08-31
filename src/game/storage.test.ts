import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProgress,
  isPersistent,
  touch,
  getCurrentResult,
  getProgress,
  getResult,
  getStats,
  saveProgress,
  saveResult,
} from './storage';
import { newTracker, type RunMetrics } from './metrics';
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

/** Storage that accepts everything and keeps nothing: a private tab, in miniature. */
function installDeadStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
  });
}

/**
 * Minimal `document.cookie`, with the get/set asymmetry the real one has. No expiry
 * handling: what the browser does with `max-age` is the browser's business, and what
 * this needs to prove is that the mirror round-trips.
 */
function installCookies(): void {
  const jar = new Map<string, string>();
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    get: () => ({
      get cookie() {
        return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      },
      set cookie(value: string) {
        const [pair, ...attrs] = value.split('; ');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq);
        if (attrs.some((a) => a.toLowerCase() === 'max-age=0')) jar.delete(name);
        else jar.set(name, pair.slice(eq + 1));
      },
    }),
  });
}

function removeCookies(): void {
  Reflect.deleteProperty(globalThis, 'document');
}

const V1 = 'aaaa';
const V2 = 'bbbb';

beforeEach(() => {
  installStorage();
  removeCookies();
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

  it('records how the run was played alongside how long it took', () => {
    const m: RunMetrics = {
      searchMs: 20000,
      adjustMs: 5000,
      passes: 2,
      overshoots: 4,
      reversals: 3,
      idleMs: 1200,
    };
    saveResult(3, 25000, V1, m);
    expect(getCurrentResult(3, V1)?.m).toEqual(m);
  });

  it('still records a solve when there is nothing to say about how it went', () => {
    saveResult(3, 25000, V1);
    expect(getCurrentResult(3, V1)?.ms).toBe(25000);
    expect(getCurrentResult(3, V1)?.m).toBeUndefined();
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

  it('carries the age collector across the interruption', () => {
    const k = { ...newTracker(), hot: true, hotAt: 4000, lastAt: 8000 };
    k.m.passes = 3;
    saveProgress({ ...RUN, k });
    expect(getProgress(3, V1)?.k).toEqual(k);
  });

  it('drops a damaged collector but keeps the clock, since the run is the point', () => {
    saveProgress(RUN);
    const store = JSON.parse(localStorage.getItem(KEY)!);
    store.progress.k = { m: 'nonsense' };
    localStorage.setItem(KEY, JSON.stringify(store));
    const back = getProgress(3, V1);
    expect(back?.ms).toBe(8000);
    expect(back?.k).toBeUndefined();
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


/**
 * The backup copy, which is the whole reason iPhone players stop losing streaks: WebKit
 * sweeps localStorage on its own schedule, and a cookie is the one thing a page can
 * write that the sweep does not take.
 */
describe('the cookie mirror', () => {
  beforeEach(() => {
    installCookies();
  });

  it('hands the results back after localStorage is wiped under the player', () => {
    saveResult(10, 30000, V1);
    saveResult(11, 20000, V1);
    saveResult(12, 25000, V1);

    // Exactly what iOS does: script-writable storage gone, cookies untouched.
    installStorage();

    expect(getStats(12)).toEqual({ played: 3, best: 20000, streak: 3 });
    // ...and the day itself is still finished, so nobody is asked to solve it twice.
    expect(getCurrentResult(12, V1)?.ms).toBe(25000);
  });

  it('keeps the version, so a re-hidden day still comes back playable', () => {
    saveResult(12, 25000, V1);
    installStorage();
    expect(getCurrentResult(12, V2)).toBeUndefined();
    expect(getResult(12)?.ms).toBe(25000);
  });

  it('heals localStorage from the mirror on the way in', () => {
    saveResult(10, 30000, V1);
    installStorage();
    touch();

    // Back in the primary store, not just in the cookie, before anything else happens.
    removeCookies();
    expect(getStats(10)).toEqual({ played: 1, best: 30000, streak: 1 });
  });

  it('prefers the fuller localStorage record where both remember a day', () => {
    const m: RunMetrics = {
      searchMs: 20000,
      adjustMs: 5000,
      passes: 2,
      overshoots: 4,
      reversals: 3,
      idleMs: 1200,
    };
    saveResult(10, 25000, V1, m);
    // The mirror cannot afford the metrics; the primary store must still win.
    expect(getCurrentResult(10, V1)?.m).toEqual(m);
  });

  it('re-arms the cookie on a visit, not only on a solve', () => {
    saveResult(10, 30000, V1);
    installCookies(); // the cookie expired; the localStorage copy is still there
    touch();
    installStorage();
    expect(getStats(10).streak).toBe(1);
  });

  it('survives a mangled cookie without losing the days it can still read', () => {
    saveResult(10, 30000, V1);
    saveResult(11, 20000, V1);
    document.cookie = 'fm-results=1~2~ffk~a:n5c:aaaa,@@@:zz';
    installStorage();
    expect(getResult(11)).toBeUndefined();
    expect(getResult(10)?.ms).toBe(30000);
  });

  it('ignores a mirror written by a format it does not know', () => {
    document.cookie = 'fm-results=9~zz~zz~nonsense';
    expect(getStats(11)).toEqual({ played: 0, best: null, streak: 0 });
  });
});

describe('isPersistent', () => {
  it('is true when localStorage keeps what it is given', () => {
    expect(isPersistent()).toBe(true);
  });

  it('is true on the strength of cookies alone', () => {
    installDeadStorage();
    installCookies();
    expect(isPersistent()).toBe(true);
  });

  it('is false when nothing keeps anything, however quietly it accepts it', () => {
    installDeadStorage();
    expect(isPersistent()).toBe(false);
  });
});
