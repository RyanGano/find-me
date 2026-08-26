/** Format a duration as m:ss.t, dropping the minutes when there are none. */
export function formatTime(ms: number): string {
  // Round to the displayed precision first, so 59.96s reads as 1:00.0 and not 60.0s.
  const total = Math.round(Math.max(0, ms) / 100) * 100;
  const minutes = Math.floor(total / 60000);
  const seconds = (total % 60000) / 1000;
  if (minutes === 0) return `${seconds.toFixed(1)}s`;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
