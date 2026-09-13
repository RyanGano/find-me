import { useEffect, useRef, useState } from 'react';

/**
 * A note that the page is running an older build than the one deployed.
 *
 * Nearly the whole screen, not a pill: a small note over a dark painting went unseen, and
 * a player on an old build is playing something that no longer matches what is deployed.
 * It can be closed, but only for as long as the page stays in front: the next time the tab
 * comes back into view it reloads without asking.
 *
 * Refreshing is safe mid-run: leaving the page banks the run, so the reload comes back
 * to the same clock and the same view.
 */
export function UpdateNotice() {
  const [closed, setClosed] = useState(false);
  const refresh = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    refresh.current?.focus();
  }, []);

  useEffect(() => {
    if (!closed) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') location.reload();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [closed]);

  if (closed) return null;

  return (
    <div className="update-scrim">
      <div
        className="update-notice"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="update-title"
        aria-describedby="update-body"
      >
        <button
          type="button"
          className="update-close"
          onClick={() => setClosed(true)}
          aria-label="Close without refreshing"
        >
          &times;
        </button>
        <h2 id="update-title" className="update-title">
          Find Me has been updated
        </h2>
        <p id="update-body" className="update-body">
          Refresh to get the latest version. A game in progress picks up right where you left
          off.
        </p>
        <button
          ref={refresh}
          type="button"
          className="update-refresh"
          onClick={() => location.reload()}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
