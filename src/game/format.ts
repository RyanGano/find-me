/** Format a duration as m:ss.t, dropping the minutes when there are none. */
export function formatTime(ms: number): string {
  // Round to the displayed precision first, so 59.96s reads as 1:00.0 and not 60.0s.
  const total = Math.round(Math.max(0, ms) / 100) * 100;
  const minutes = Math.floor(total / 60000);
  const seconds = (total % 60000) / 1000;
  if (minutes === 0) return `${seconds.toFixed(1)}s`;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

/** A duration to the second, as m:ss or s: for medians, where a tenth means nothing. */
export function formatRoughTime(ms: number): string {
  const secs = Math.round(ms / 1000);
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/** Time until the next puzzle, said the way a person would: "2h 05m", "21m 09s", "45s". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
