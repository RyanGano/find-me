import { useEffect, useState } from 'react';
import { msUntilTomorrow } from '../game/daily';
import { formatCountdown, formatTime } from '../game/format';
import { buildShareText, shareResult, speedBar } from '../game/share';
import type { Stats } from '../game/storage';
import type { Puzzle } from '../game/types';

interface Props {
  day: number;
  puzzle: Puzzle;
  ms: number;
  stats: Stats;
  isPractice: boolean;
  onReplay: () => void;
}

export function ResultCard({ day, puzzle, ms, stats, isPractice, onReplay }: Props) {
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const countdown = useCountdown(!isPractice);

  const share = async () => {
    const text = buildShareText(day, puzzle, ms, stats.streak);
    setStatus(await shareResult(text));
  };

  return (
    <div className="result" role="dialog" aria-label="Puzzle solved">
      <p className="result-eyebrow">{puzzle.emoji} found</p>
      <p className="result-time">{formatTime(ms)}</p>
      <p className="result-bar">{speedBar(ms)}</p>

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

function useCountdown(enabled: boolean): string | null {
  const [ms, setMs] = useState(() => msUntilTomorrow());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return enabled ? formatCountdown(ms) : null;
}
