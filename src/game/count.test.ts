import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { count, isCounted, newRunId, setCounted, type CountPayload } from './count';

const URL = 'https://example.invalid/api/count';

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

const beacons: { url: string; body: CountPayload }[] = [];
const posts: { url: string; body: CountPayload }[] = [];

beforeEach(async () => {
  installStorage();
  beacons.length = 0;
  posts.length = 0;
  vi.stubEnv('VITE_COUNT_URL', URL);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon: (url: string, blob: Blob) => {
        // Read synchronously enough for the assertions: the payload is what matters.
        beacons.push({ url, body: JSON.parse((blob as unknown as { _t: string })._t) });
        return true;
      },
    },
  });
  vi.stubGlobal('Blob', class {
    _t: string;
    constructor(parts: string[]) {
      this._t = parts.join('');
    }
  });
  vi.stubGlobal('fetch', (url: string, init: { body: string }) => {
    posts.push({ url, body: JSON.parse(init.body) });
    return Promise.resolve({ ok: true });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('count', () => {
  it('posts a start with no time on it', () => {
    count('run-1', 42, 'start');
    expect(posts).toEqual([{ url: URL, body: { run: 'run-1', day: 42, state: 'start' } }]);
    expect(beacons).toHaveLength(0);
  });

  it('posts a solve with the run clock, rounded', () => {
    count('run-1', 42, 'solved', 12345.67);
    expect(posts[0].body).toEqual({ run: 'run-1', day: 42, state: 'solved', ms: 12346 });
  });

  it('sends a leave by beacon, so it survives the page going away', () => {
    count('run-1', 42, 'left', 8000);
    expect(posts).toHaveLength(0);
    expect(beacons[0].body).toEqual({ run: 'run-1', day: 42, state: 'left', ms: 8000 });
  });

  it('says nothing at all once the player has opted out', () => {
    setCounted(false);
    count('run-1', 42, 'start');
    count('run-1', 42, 'left', 8000);
    count('run-1', 42, 'solved', 9000);
    expect(posts).toHaveLength(0);
    expect(beacons).toHaveLength(0);
  });

  it('says nothing when no endpoint was baked in, as in dev and in forks', () => {
    vi.stubEnv('VITE_COUNT_URL', '');
    count('run-1', 42, 'start');
    expect(posts).toHaveLength(0);
  });

  it('never reports a negative clock', () => {
    count('run-1', 42, 'solved', -5);
    expect(posts[0].body.ms).toBe(0);
  });
});

describe('opting out', () => {
  it('starts counted, and remembers being turned off and on again', () => {
    expect(isCounted()).toBe(true);
    setCounted(false);
    expect(isCounted()).toBe(false);
    setCounted(true);
    expect(isCounted()).toBe(true);
  });
});

describe('newRunId', () => {
  it('mints a different id every time', () => {
    const ids = new Set(Array.from({ length: 50 }, newRunId));
    expect(ids.size).toBe(50);
  });
});
