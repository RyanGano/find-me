/**
 * A quiet corner note that the page is running an older build than the one deployed.
 *
 * Refreshing is safe mid-run: leaving the page banks the run, so the reload comes back
 * to the same clock and the same view.
 */
export function UpdateNotice() {
  return (
    <div className="update-notice" role="status">
      <span>There&rsquo;s an update</span>
      <button type="button" className="update-refresh" onClick={() => location.reload()}>
        Refresh
      </button>
    </div>
  );
}
