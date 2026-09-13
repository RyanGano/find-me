import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  count,
  fetchTallies,
  fetchTally,
  isCounted,
  MAX_TALLY_DAYS,
  countHide,
  fetchHide,
  newRunId,
  setCounted,
  shortHideLink,
  TALLY_FLOOR,
  type CountPayload,
  type HidePayload,
  type StorePayload,
} from './count';
import { hideLink, type Hide } from './hide';
import { PUZZLES } from './puzzles';

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

  it('says when a share fell back to the long link, and why a link did not open', () => {
    countHide('made', { long: true });
    countHide('broken', { reason: 'unknown' });
    countHide('hunted', { long: true, reason: 'unknown' });
    const [made, broken, hunted] = hides();
    expect(made.long).toBe(true);
    expect(broken.reason).toBe('unknown');
    expect(Object.keys(hunted).sort()).toEqual(['event', 'kind', 'page']);
  });
});

describe('shortHideLink', () => {
  const HIDE: Hide = { image: PUZZLES[0].image, shape: 'star', cx: 400, cy: 600, size: 50, angle: -30, fill: '#a1b2c3', opacity: 0.7 };
  const SITE = 'https://example.test/';
  const long = hideLink(HIDE, SITE);

  function answer(respond: () => Promise<unknown>) {
    const asked: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      asked.push({ url, init });
      return respond();
    });
    return asked;
  }

  it('stores the hide and hands back a short link', async () => {
    const asked = answer(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'ERF46H2K' }) }));
    expect(await shortHideLink({ ...HIDE, name: 'Mine' }, SITE)).toEqual({ link: `${SITE}?p=ERF4-6H2K`, short: true });
    expect(asked).toHaveLength(1);
    expect(asked[0].url).toBe(URL);
    const body = JSON.parse(asked[0].init.body as string) as StorePayload;
    // The hide's own fields, and nothing that could say who set it.
    expect(body).toEqual({ kind: 'store', ...HIDE, name: 'Mine' });
  });

  it('makes no request at all with counting off or no endpoint', async () => {
    const asked = answer(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'ERF46H2K' }) }));
    setCounted(false);
    expect(await shortHideLink(HIDE, SITE)).toEqual({ link: long, short: false });
    setCounted(true);
    vi.stubEnv('VITE_COUNT_URL', '');
    expect(await shortHideLink(HIDE, SITE)).toEqual({ link: long, short: false });
    expect(asked).toHaveLength(0);
  });

  it('falls back to the long link when the post fails, is refused, or answers nonsense', async () => {
    for (const respond of [
      () => Promise.reject(new Error('blocked')),
      () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
      () => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'nope' }) }),
      () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('not json')) }),
    ]) {
      const asked = answer(respond);
      expect(await shortHideLink(HIDE, SITE)).toEqual({ link: long, short: false });
      expect(asked).toHaveLength(1);
    }
  });

  it('falls back to the long link when the server is slow', async () => {
    const asked = answer(() => new Promise(() => {}));
    expect(await shortHideLink(HIDE, SITE, 20)).toEqual({ link: long, short: false });
    expect(asked).toHaveLength(1);
  });
});

describe('fetchHide', () => {
  function serve(status: number, body: unknown = {}) {
    const asked: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      asked.push({ url, init });
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
    });
    return asked;
  }

  it('asks for the code and nothing else, counted or not', async () => {
    setCounted(false);
    const asked = serve(200, { schema: 1 });
    expect(await fetchHide('erf4-6h2k')).toEqual({ ok: true, body: { schema: 1 } });
    expect(asked).toHaveLength(1);
    expect(asked[0].url).toBe(`${URL}?hide=ERF46H2K`);
    const { signal, ...init } = asked[0].init;
    expect(signal).toBeDefined();
    expect(init).toEqual({ mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('never sends a counter while a hide is fetched and hunted with counting off', async () => {
    setCounted(false);
    const asked = serve(200, { schema: 1 });
    await fetchHide('ERF46H2K');
    for (const event of ['hunted', 'found', 'told', 'broken'] as const) countHide(event, { reason: 'unknown' });
    expect(asked).toHaveLength(1);
    expect(beacons).toHaveLength(0);
  });

  it('never reaches the network with a code that cannot be one', async () => {
    const asked = serve(200);
    expect(await fetchHide('ERF4-6H2')).toEqual({ ok: false, reason: 'unknown' });
    expect(await fetchHide('#h=3ABC')).toEqual({ ok: false, reason: 'unknown' });
    expect(asked).toHaveLength(0);
  });

  it('tells an unknown code from a server that could not be reached', async () => {
    serve(404);
    expect(await fetchHide('ERF46H2K')).toEqual({ ok: false, reason: 'unknown' });
    serve(503);
    expect(await fetchHide('ERF46H2K')).toEqual({ ok: false, reason: 'unreachable' });
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    expect(await fetchHide('ERF46H2K')).toEqual({ ok: false, reason: 'unreachable' });
    const asked = serve(200);
    vi.stubEnv('VITE_COUNT_URL', '');
    expect(await fetchHide('ERF46H2K')).toEqual({ ok: false, reason: 'unreachable' });
    expect(asked).toHaveLength(0);
  });
});
