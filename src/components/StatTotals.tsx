import { formatTime } from '../game/format';
import type { Stats } from '../game/storage';

/** Played, streak and best in a row: the same three on the result card and the stats panel. */
export function StatTotals({ stats }: { stats: Stats }) {
  return (
    <dl className="result-stats">
      <div><dt>played</dt><dd>{stats.played}</dd></div>
      <div><dt>streak</dt><dd>{stats.streak}</dd></div>
      <div><dt>best</dt><dd>{stats.best === null ? '—' : formatTime(stats.best)}</dd></div>
    </dl>
  );
}
