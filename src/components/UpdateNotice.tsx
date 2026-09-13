/**
 * A note that the page is running an older build than the one deployed.
 *
 * In the middle of the board, over the painting: in a bottom corner it was easy to miss,
 * and it sat on top of the hint button on a phone. It is small, and it only appears once a
 * new build is out, so the painting is worth covering for it.
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
