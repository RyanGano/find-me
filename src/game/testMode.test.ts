import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { count, type CountPayload } from './count';
import { getStats, saveResult } from './storage';
import { isTestMode, refreshTestMode } from './testMode';

/** Land on the page with this query string, keeping whatever the tab already holds. */
function open(search: string): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { search } },
  });
  refreshTestMode();
}

let session = new Map<string, string>();

function installSession(data: Map<string, string>): void {
  session = data;
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  });
}

beforeEach(() => {
  installSession(new Map());
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'sessionStorage');
  refreshTestMode();
});

describe('test mode', () => {
  it('is off for a player', () => {
    open('');
    expect(isTestMode()).toBe(false);
    open('?day=3');
    expect(isTestMode()).toBe(false);
  });

  it('is off where there is no window at all', () => {
    Reflect.deleteProperty(globalThis, 'window');
    refreshTestMode();
    expect(isTestMode()).toBe(false);
  });

  it('turns on for ?test', () => {
    open('?test');
    expect(isTestMode()).toBe(true);
    open('?test=1');
    expect(isTestMode()).toBe(true);
  });

  /**
   * The whole reason the mode is sticky: a reload that drops the query string -- the
   * update-available reload, a relaunch from the home screen -- must not quietly put a
   * half-finished test run back onto the real store.
   */
  it('survives a reload that loses the parameter', () => {
    open('?test');
    open('');
    expect(isTestMode()).toBe(true);
  });

  it('is left by ?test=off, and stays left', () => {
    open('?test');
    open('?test=off');
    expect(isTestMode()).toBe(false);
    open('');
    expect(isTestMode()).toBe(false);
  });

  it('lasts only as long as the URL when the tab cannot remember it', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('no');
        },
        removeItem: () => {},
      },
    });
    open('?test');
    expect(isTestMode()).toBe(true);
    open('');
    expect(isTestMode()).toBe(false);
  });

  it('does not leave the flag behind once it is off', () => {
    open('?test');
    open('?test=off');
    expect(session.size).toBe(0);
  });
});

describe('what test mode keeps apart', () => {
  const local = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => local.get(k) ?? null,
        setItem: (k: string, v: string) => void local.set(k, v),
        removeItem: (k: string) => void local.delete(k),
        clear: () => local.clear(),
      },
    });
    // No cookie jar: the mirror fails silently and localStorage is the whole story.
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('writes a result where the player will never read it', () => {
    open('?test');
    saveResult(500, 1234, 'v');
    expect(isTestMode()).toBe(true);
    expect([...local.keys()]).not.toContain('find-me:v1');

    open('?test=off');
    expect(getStats(500).played).toBe(0);
  });

  it('keeps a real result out of the test store, and the other way round', () => {
    open('');
    saveResult(500, 1000, 'v');
    open('?test');
    expect(getStats(500).played).toBe(0);
    saveResult(500, 9999, 'v');
    open('?test=off');
    expect(getStats(500).best).toBe(1000);
  });

  it('flags a test run on the tally, and only a test run', () => {
    const posts: CountPayload[] = [];
    vi.stubEnv('VITE_COUNT_URL', 'https://example.invalid/api/count');
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
      posts.push(JSON.parse(init.body) as CountPayload);
      return Promise.resolve({ ok: true });
    });

    open('?test');
    count('run-abcdefgh', 500, 'solved', 1234);
    expect(posts.at(-1)?.dry).toBe(true);

    open('?test=off');
    count('run-abcdefgh', 500, 'solved', 1234);
    expect(posts.at(-1)?.dry).toBeUndefined();
  });
});
