import type { Stats } from '../game/storage';

/**
 * Played and streak in a row: the same two on the result card and the stats panel. No best
 * time -- the days differ too much in difficulty for one fastest time to mean anything.
 */
export function StatTotals({ stats }: { stats: Stats }) {
  return (
    <dl className="result-stats">
      <div><dt>played</dt><dd>{stats.played}</dd></div>
      <div><dt>streak</dt><dd>{stats.streak}</dd></div>
    </dl>
  );
}
