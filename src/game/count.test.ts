import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  count,
  fetchTallies,
  fetchTally,
  isCounted,
  MAX_TALLY_DAYS,
  countHide,
  newRunId,
  setCounted,
  TALLY_FLOOR,
  type CountPayload,
  type HidePayload,
} from './count';

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

  it('posts a give-up with how long the hunt ran before it', () => {
    count('run-1', 42, 'gave-up', 240000);
    expect(posts[0].body).toEqual({ run: 'run-1', day: 42, state: 'gave-up', ms: 240000 });
    // Not a beacon: the player is still on the page, looking at what they missed.
    expect(beacons).toHaveLength(0);
  });

  it('posts a reach for the way out before it was open', () => {
    count('run-1', 42, 'stuck', 30000);
    expect(posts[0].body).toEqual({ run: 'run-1', day: 42, state: 'stuck', ms: 30000 });
  });

  it('posts a hint, with how far into the hunt it was taken', () => {
    count('run-1', 42, 'hint', 125000);
    expect(posts[0].body).toEqual({ run: 'run-1', day: 42, state: 'hint', ms: 125000 });
  });

  it('posts a share, with no time on it', () => {
    count('run-1', 42, 'shared');
    expect(posts[0].body).toEqual({ run: 'run-1', day: 42, state: 'shared' });
  });

  it('posts a stats-panel open, with no time on it', () => {
    count('run-1', 42, 'stats');
    expect(posts[0].body).toEqual({ run: 'run-1', day: 42, state: 'stats' });
  });

  it('says nothing at all once the player has opted out', () => {
    setCounted(false);
    count('run-1', 42, 'start');
    count('run-1', 42, 'stuck', 3000);
    count('run-1', 42, 'left', 8000);
    count('run-1', 42, 'gave-up', 9000);
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

describe('fetchTally', () => {
  function serve(body: unknown, ok = true) {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url);
      return Promise.resolve({ ok, json: () => Promise.resolve(body) });
    });
    return asked;
  }

  it('reads a day from the same endpoint, by day', async () => {
    const asked = serve({ day: 42, played: 20, solved: 8, medianMs: 160000 });
    expect(await fetchTally(42)).toEqual({ played: 20, solved: 8, medianMs: 160000 });
    expect(asked).toEqual([`${URL}?day=42`]);
  });

  it('says nothing about a day with too few solves', async () => {
    serve({ played: 9, solved: TALLY_FLOOR - 1, medianMs: 60000 });
    expect(await fetchTally(42)).toBeNull();
  });

  it('says nothing when the server has nothing, or something malformed', async () => {
    serve({});
    expect(await fetchTally(42)).toBeNull();
    serve({ played: 3, solved: 8, medianMs: 1000 });
    expect(await fetchTally(42)).toBeNull();
    serve({ played: 20, solved: 8, medianMs: 1000 }, false);
    expect(await fetchTally(42)).toBeNull();
  });

  it('fails silently when the request does', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('blocked')));
    expect(await fetchTally(42)).toBeNull();
  });

  it('asks nothing without an endpoint, or once opted out', async () => {
    const asked = serve({ played: 20, solved: 8, medianMs: 1000 });
    vi.stubEnv('VITE_COUNT_URL', '');
    expect(await fetchTally(42)).toBeNull();
    vi.stubEnv('VITE_COUNT_URL', URL);
    setCounted(false);
    expect(await fetchTally(42)).toBeNull();
    expect(asked).toHaveLength(0);
  });
});

describe('fetchTallies', () => {
  function serve(body: unknown, ok = true) {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url);
      return Promise.resolve({ ok, json: () => Promise.resolve(body) });
    });
    return asked;
  }

  it('asks for every day in one read and keeps the ones that come back', async () => {
    const asked = serve({ 3: { played: 20, solved: 8, medianMs: 60000 } });
    const found = await fetchTallies([3, 4]);
    expect(asked).toEqual([`${URL}?days=3,4`]);
    expect([...found]).toEqual([[3, { played: 20, solved: 8, medianMs: 60000 }]]);
  });

  it('drops a thin or malformed day and keeps the rest', async () => {
    serve({
      3: { played: 20, solved: TALLY_FLOOR - 1, medianMs: 60000 },
      4: { played: 1, solved: 8, medianMs: 60000 },
      5: { played: 20, solved: 8, medianMs: 70000 },
    });
    expect([...(await fetchTallies([3, 4, 5])).keys()]).toEqual([5]);
  });

  it('asks for no more than the server will answer, keeping the most recent days', async () => {
    const asked = serve({});
    const days = Array.from({ length: MAX_TALLY_DAYS + 10 }, (_, i) => i);
    await fetchTallies(days);
    expect(asked[0].split('=')[1].split(',')).toHaveLength(MAX_TALLY_DAYS);
    expect(asked[0].startsWith(`${URL}?days=10,`)).toBe(true);
  });

  it('comes back empty, never failing, when anything goes wrong', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('blocked')));
    expect((await fetchTallies([3])).size).toBe(0);
    serve([1, 2]);
    expect((await fetchTallies([3])).size).toBe(0);
    serve({ 3: { played: 20, solved: 8, medianMs: 1 } }, false);
    expect((await fetchTallies([3])).size).toBe(0);
  });

  it('asks nothing with no days, no endpoint, or once opted out', async () => {
    const asked = serve({});
    await fetchTallies([]);
    vi.stubEnv('VITE_COUNT_URL', '');
    await fetchTallies([3]);
    vi.stubEnv('VITE_COUNT_URL', URL);
    setCounted(false);
    await fetchTallies([3]);
    expect(asked).toHaveLength(0);
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

describe('countHide', () => {
  const hides = () => posts.map((p) => p.body as unknown as HidePayload);

  it('reports the feature, and nothing about the hide', () => {
    countHide('opened');
    const [body] = hides();
    expect(body.kind).toBe('hide');
    expect(body.event).toBe('opened');
    // No day, no puzzle, no painting, no shape, no position -- there is nothing here that
    // could say which hide it was, and that is the whole design.
    expect(Object.keys(body).sort()).toEqual(['event', 'kind', 'page']);
    expect(posts[0].url).toBe(URL);
  });

  it('carries one page id across the events of a page load', () => {
    countHide('opened');
    countHide('made');
    const [first, second] = hides();
    expect(second.page).toBe(first.page);
    expect(first.page).toMatch(/\S/);
  });

  it('never sends a beacon: none of it happens as the page goes away', () => {
    for (const event of ['opened', 'made', 'hunted', 'found', 'told'] as const) countHide(event);
    expect(hides().map((h) => h.event)).toEqual(['opened', 'made', 'hunted', 'found', 'told']);
    expect(beacons).toHaveLength(0);
  });

  it('says nothing once the player has opted out, or with no endpoint', () => {
    setCounted(false);
    countHide('opened');
    setCounted(true);
    vi.stubEnv('VITE_COUNT_URL', '');
    countHide('opened');
    expect(posts).toHaveLength(0);
  });
});
