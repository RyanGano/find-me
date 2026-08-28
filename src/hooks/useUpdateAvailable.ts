import { useEffect, useState } from 'react';

/** How often a page left open checks whether a newer build has been deployed. */
const POLL_MS = 15 * 60 * 1000;
/** Coming back to the tab re-checks, but not more than this often. */
const MIN_GAP_MS = 60 * 1000;

/**
 * The build stamp the server is serving now, or null if it cannot be read.
 *
 * `version.json` is written by the build alongside the hashed bundles, so it is the one
 * file whose URL never changes between deploys -- which also means a cache would happily
 * hand back the old one, hence the buster and `no-store`.
 */
async function fetchBuildId(signal: AbortSignal): Promise<string | null> {
  try {
    const url = new URL('version.json', document.baseURI);
    url.searchParams.set('t', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store', signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const build = (body as { build?: unknown })?.build;
    return typeof build === 'string' ? build : null;
  } catch {
    // Offline, blocked, or a dev server with no version.json: nothing to say.
    return null;
  }
}

/**
 * True once the deployed build differs from the one this page is running.
 *
 * It only ever flips on: a player mid-hunt should not have the notice appear and vanish
 * because one poll happened to fail, and once a new build is out it stays out.
 */
export function useUpdateAvailable(): boolean {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (stale) return;
    const controller = new AbortController();
    let checkedAt = 0;

    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - checkedAt < MIN_GAP_MS) return;
      checkedAt = Date.now();
      const build = await fetchBuildId(controller.signal);
      if (build && build !== __BUILD_ID__) setStale(true);
    };

    const id = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [stale]);

  return stale;
}
