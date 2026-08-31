import { useEffect, useMemo, useState } from 'react';
import { estimateAge, type AgePart } from '../game/age';
import { msUntilTomorrow } from '../game/daily';
import { formatCountdown, formatTime } from '../game/format';
import type { RunMetrics } from '../game/metrics';
import { buildAgeDataText, buildShareText, shareResult, speedBar } from '../game/share';
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
  const [dataStatus, setDataStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>(
    'idle',
  );
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

  // Beta only, and deliberately a second button rather than more lines in the share
  // text: what a player posts in public should stay short and spoiler-free, and this is
  // an instrument for tuning the estimate, not a result.
  const shareAgeData = async () => {
    const text = buildAgeDataText(day, puzzle, ms, age, metrics, isPractice);
    setDataStatus(await shareResult(text));
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

      <button type="button" className="result-age-data" onClick={shareAgeData}>
        {dataStatus === 'copied'
          ? 'Copied — paste it back with your real age'
          : dataStatus === 'shared'
            ? 'Sent — add your real age'
            : dataStatus === 'failed'
              ? 'Copy failed'
              : 'Share age data'}
      </button>

      {!isPractice && countdown && <p className="result-next">Next puzzle in {countdown}</p>}
    </div>
  );
}

/**
 * How each signal reads when it comes in ahead of par, near it, and behind it.
 *
 * Every signal gets its own words rather than a shared "strong on X / slow on X",
 * because the shared form does not survive contact with the signals it has to describe:
 * hesitation is the one most often at the very best it can be -- a good run frequently
 * has no idle time at all -- and "strong on hesitation" says the opposite of what it
 * means. Nothing here claims more than the number behind it: a single near miss on a
 * day that expects two is "hardly lost it", not "never".
 */
const PHRASES: Record<AgePart['key'], [ahead: string, level: string, behind: string]> = {
  search: ['spotted it fast', 'spotted it on time', 'slow to spot it'],
  adjust: ['framed it fast', 'framed it on time', 'slow to frame it'],
  passes: ['hardly lost it', 'lost it a few times', 'kept losing it'],
  dither: ['steady hands', 'steady enough', 'shaky hands'],
  idle: ['barely paused', 'a pause or two', 'long pauses'],
};

/** The two signals furthest from par, best first, each said in its own words. */
function whyLine(parts: AgePart[]): string {
  const distance = (p: AgePart) => Math.abs(Math.log2(p.ratio));
  return [...parts]
    .sort((a, b) => distance(b) - distance(a))
    .slice(0, 2)
    .sort((a, b) => a.ratio - b.ratio)
    .map((p) => PHRASES[p.key][p.ratio < 0.75 ? 0 : p.ratio > 1.4 ? 2 : 1])
    .join(' · ');
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
