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
  // Folded away rather than printed under every result: most players want the number and
  // the next puzzle, and the ones asking how it works have gone looking for the answer.
  const [showAgeInfo, setShowAgeInfo] = useState(false);
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

  // Beta only, and never folded into the share text: what a player posts in public
  // should stay short and spoiler-free, and this is an instrument for tuning the
  // estimate, not a result. It lives behind the explanation because that is where a
  // tester asked to send their data has just been reading what the data is.
  const shareAgeData = async () => {
    const text = buildAgeDataText(day, puzzle, ms, age, metrics, isPractice);
    setDataStatus(await shareResult(text));
  };

  // The explanation takes the card over rather than stacking a second panel on top of
  // it, the same way the tally note takes over the how-to: one dialog at a time, and
  // nothing for a phone to trap the player under.
  if (showAgeInfo) {
    return (
      <div className="howto" role="dialog" aria-label="About your Find Me Age">
        <h2>About your Find Me Age</h2>
        <p>
          It comes from five things about how you played this run: how long you took to
          spot the {puzzle.thing}, how long to frame it, how often it slipped back out of
          frame, how steady you held the view, and how long you spent stopped.
        </p>
        <p>
          Those are weighed against what that day is <em>worth</em> rather than against
          the clock alone &mdash; Sunday hides its shape far better than Monday does, so a
          plain stopwatch would only ever tell you what day it was.
        </p>
        <p className="howto-note">
          It is a bit of fun, not a measurement. Even across players who told us their
          real ages, how fast somebody finds a shape says very little about how old they
          are. Nothing personal goes into it: the whole thing is worked out on your own
          device, from this run.
        </p>
        <div className="howto-foot">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAgeInfo(false)}
          >
            Back
          </button>
          <button type="button" className="btn btn-quiet" onClick={shareAgeData}>
            {dataStatus === 'copied'
              ? 'Copied — paste it back with your real age'
              : dataStatus === 'shared'
                ? 'Sent — add your real age'
                : dataStatus === 'failed'
                  ? 'Copy failed'
                  : 'Share age data'}
          </button>
        </div>
      </div>
    );
  }

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
        <button
          type="button"
          className="result-age-info"
          onClick={() => setShowAgeInfo(true)}
        >
          How is this worked out?
        </button>
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
