import { useEffect, useState } from 'react';

/**
 * What this browser actually kept, at `?diag`.
 *
 * The warning on the board can only catch a browser that refuses a write outright. It
 * cannot catch the case that matters most here -- a browser that accepts every write,
 * reads it straight back, and then throws the lot away when it is quit. In-session,
 * that is indistinguishable from a browser doing its job.
 *
 * Across sessions it is not. This page stamps a marker the first time it is opened and
 * reports how old that stamp is. Open it, quit the browser, open it again: if the stamp
 * reads "just now" the second time, nothing this site writes survives being quit, and no
 * amount of work inside the page will change that. If the stamp survived, storage is
 * fine and the fault is somewhere else -- and the rest of the panel says where.
 */

const MARK = 'find-me:diag-mark';
const COOKIE_MARK = 'fm-diag-mark';
const RESULTS = 'find-me:v1';
const RESULTS_COOKIE = 'fm-results';

function cookie(name: string): string | undefined {
  try {
    for (const part of document.cookie.split('; ')) {
      const eq = part.indexOf('=');
      if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function setCookie(name: string, value: string): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${400 * 24 * 60 * 60}; SameSite=Lax; Secure`;
  } catch {
    // Reported as "not kept" by the read-back below, which is the useful answer.
  }
}

function local(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Same: the read-back is what gets reported.
  }
}

function age(stamp: string | null | undefined): string {
  if (!stamp) return 'not kept';
  const then = Date.parse(stamp);
  if (!Number.isFinite(then)) return 'unreadable';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'written just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

interface Report {
  localMark: string | null;
  cookieMark: string | undefined;
  results: string | null;
  resultsCookie: string | undefined;
  resultDays: number | null;
  standalone: boolean;
  cookiesEnabled: boolean;
  quota: string;
}

export function Diagnostics() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    // Read before writing, so a marker from an earlier session is seen as one.
    const localMark = local(MARK);
    const cookieMark = cookie(COOKIE_MARK);
    const now = new Date().toISOString();
    if (!localMark) setLocal(MARK, now);
    if (!cookieMark) setCookie(COOKIE_MARK, now);

    const results = local(RESULTS);
    let resultDays: number | null = null;
    try {
      resultDays = results ? Object.keys(JSON.parse(results).results ?? {}).length : 0;
    } catch {
      resultDays = null;
    }

    const build = async () => {
      let quota = 'not reported';
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate?.quota) quota = `${Math.round(estimate.quota / 1024 / 1024)} MB`;
      } catch {
        quota = 'not reported';
      }
      setReport({
        localMark: localMark ?? local(MARK),
        cookieMark: cookieMark ?? cookie(COOKIE_MARK),
        results,
        resultsCookie: cookie(RESULTS_COOKIE),
        resultDays,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        cookiesEnabled: navigator.cookieEnabled,
        quota,
      });
    };
    void build();
  }, []);

  if (!report) return <p className="diag">reading…</p>;

  const kept = report.localMark && age(report.localMark) !== 'written just now';
  const cookieKept = report.cookieMark && age(report.cookieMark) !== 'written just now';

  return (
    <div className="diag">
      <h1>Find Me — storage check</h1>
      <p className="diag-lead">
        Open this page, <strong>fully quit the browser</strong>, then open it again. If both
        markers below still say “written just now” the second time, this browser is keeping
        nothing between sessions, and that is the whole answer.
      </p>

      <dl>
        <dt>localStorage marker</dt>
        <dd className={kept ? 'ok' : 'bad'}>{age(report.localMark)}</dd>

        <dt>cookie marker</dt>
        <dd className={cookieKept ? 'ok' : 'bad'}>{age(report.cookieMark)}</dd>

        <dt>saved results (localStorage)</dt>
        <dd>{report.resultDays === null ? 'unreadable' : `${report.resultDays} day(s)`}</dd>

        <dt>backup results (cookie)</dt>
        <dd>{report.resultsCookie ?? 'none'}</dd>

        <dt>cookies enabled</dt>
        <dd>{report.cookiesEnabled ? 'yes' : 'no'}</dd>

        <dt>storage quota</dt>
        <dd>{report.quota}</dd>

        <dt>opened as</dt>
        <dd>{report.standalone ? 'home-screen app' : 'browser tab'}</dd>
      </dl>

      <p className="diag-lead">
        Home-screen apps and browser tabs are given separate storage on iOS, so a streak
        earned in one is not visible in the other.
      </p>

      <p>
        <a href="/">back to the game</a>
      </p>
    </div>
  );
}
