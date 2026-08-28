import { useEffect, useMemo, useState } from 'react';
import { estimateAge, type AgePart } from '../game/age';
import { msUntilTomorrow } from '../game/daily';
import { formatCountdown, formatTime } from '../game/format';
import type { RunMetrics } from '../game/metrics';
import { buildShareText, shareResult, speedBar } from '../game/share';
import type { Stats } from '../game/storage';
import type { Puzzle } from '../game/types';

interface Props {
  day: number;
  puzzle: Puzzle;
  ms: number;
  stats: Stats;
  isPractice: boolean;
  /** How the run was played. Absent for a solve recorded before the age existed. */
  metrics: RunMetrics | null;
  onReplay: () => void;
}

export function ResultCard({ day, puzzle, ms, stats, isPractice, metrics, onReplay }: Props) {
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const countdown = useCountdown(!isPractice);

  // Derived, never stored: retuning the estimate re-reads old runs rather than leaving
  // them pinned to whatever the formula said on the day.
  const { age, parts } = useMemo(
    () => estimateAge(puzzle, ms, metrics),
    [puzzle, ms, metrics],
  );

  const share = async () => {
    const text = buildShareText(day, puzzle, ms, stats.streak, age);
    setStatus(await shareResult(text));
  };

  return (
    <div className="result" role="dialog" aria-label="Puzzle solved">
      <p className="result-eyebrow">{puzzle.emoji} found</p>
      <p className="result-time">{formatTime(ms)}</p>
      <p className="result-bar">{speedBar(ms)}</p>

      <div className="result-age-block">
        <p className="result-age">
          Your Find Me Age: <strong>{age}</strong>
        </p>
        {/* What the number was made of. Only the two signals furthest from par are named:
            the whole list is a wall of jargon, and the interesting thing about a run is
            always the one or two ways it was unusual. */}
        {parts.length > 0 && <p className="result-age-why">{whyLine(parts)}</p>}
      </div>

      <p className="result-art">
        <strong>{puzzle.title}</strong>
        <span>
          {puzzle.artist} &middot; {puzzle.year}
        </span>
      </p>

      {!isPractice && (
        <dl className="result-stats">
          <div><dt>played</dt><dd>{stats.played}</dd></div>
          <div><dt>streak</dt><dd>{stats.streak}</dd></div>
          <div><dt>best</dt><dd>{stats.best === null ? '—' : formatTime(stats.best)}</dd></div>
        </dl>
      )}

      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={share}>
          {status === 'copied' ? 'Copied!' : status === 'failed' ? 'Copy failed' : 'Share result'}
        </button>
        <button type="button" className="btn" onClick={onReplay}>
          {isPractice ? 'Play again' : 'Free roam'}
        </button>
      </div>

      {!isPractice && countdown && <p className="result-next">Next puzzle in {countdown}</p>}
    </div>
  );
}

/** The two signals furthest from par, best first, each said in plain words. */
function whyLine(parts: AgePart[]): string {
  const ranked = [...parts].sort(
    (a, b) => Math.abs(Math.log2(orOne(b.ratio))) - Math.abs(Math.log2(orOne(a.ratio))),
  );
  return ranked
    .slice(0, 2)
    .sort((a, b) => a.ratio - b.ratio)
    .map((p) => `${p.ratio < 0.75 ? 'strong' : p.ratio > 1.4 ? 'slow' : 'steady'} on ${p.label}`)
    .join(' · ');
}

function orOne(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function useCountdown(enabled: boolean): string | null {
  const [ms, setMs] = useState(() => msUntilTomorrow());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return enabled ? formatCountdown(ms) : null;
}
