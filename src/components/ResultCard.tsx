import { useEffect, useMemo, useState } from 'react';
import { estimateAge, type AgePart } from '../game/age';
import { msUntilTomorrow } from '../game/daily';
import { formatCountdown, formatTime } from '../game/format';
import type { DayTally } from '../game/count';
import type { RunMetrics } from '../game/metrics';
import {
  buildAgeDataText,
  buildGaveUpText,
  buildShareText,
  huntTrace,
  shareResult,
  speedBar,
  tallyLine,
  traceKey,
} from '../game/share';
import type { Stats } from '../game/storage';
import type { Puzzle } from '../game/types';

interface Props {
  day: number;
  puzzle: Puzzle;
  ms: number;
  stats: Stats;
  isPractice: boolean;
  /**
   * The day was given up on rather than solved, and `ms` is how long the hunt ran before
   * that. The card says so plainly and drops everything that would read as a score.
   */
  gaveUp?: boolean;
  /** How the run was played. Absent for a solve recorded before the age existed. */
  metrics: RunMetrics | null;
  /** How everyone else did today, once it has arrived. Null means say nothing. */
  tally: DayTally | null;
  /**
   * The day was redefined after this time was set, so the painting now holds a puzzle
   * this result is not a solve of. Said plainly, with the new one offered as a practice
   * run -- the recorded time is the one that was really earned, and nothing here may
   * quietly replace it.
   */
  retuned?: boolean;
  /** The share button was pressed, for the tally. */
  onShared: () => void;
  onReplay: () => void;
}

export function ResultCard({
  day,
  puzzle,
  ms,
  stats,
  isPractice,
  gaveUp,
  metrics,
  tally,
  retuned,
  onShared,
  onReplay,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const [dataStatus, setDataStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>(
    'idle',
  );
  // Folded away rather than printed under every result: most players want the number and
  // the next puzzle, and the ones asking how it works have gone looking for the answer.
  const [showAgeInfo, setShowAgeInfo] = useState(false);
  const countdown = useCountdown(!isPractice);

  // Derived, never stored: retuning the estimate re-reads old runs rather than leaving
  // them pinned to whatever the formula said on the day. Never asked for at all on a run
  // that did not finish -- an age is a reading of how a hunt was played, and a hunt that
  // ended in being shown the answer has no such reading. Asking anyway would still
  // produce a number, and a number on this card reads as a score.
  const { age, parts } = useMemo(
    () => (gaveUp ? { age: null, parts: [] } : estimateAge(puzzle, ms, metrics)),
    [gaveUp, puzzle, ms, metrics],
  );

  const trace = huntTrace(metrics);

  const share = async () => {
    const text = gaveUp
      ? buildGaveUpText(day, puzzle, ms, metrics)
      : buildShareText(day, puzzle, ms, stats.streak, age, metrics);
    const result = await shareResult(text);
    setStatus(result);
    if (result !== 'failed') onShared();
  };

  // Beta only, and never folded into the share text: what a player posts in public
  // should stay short and spoiler-free, and this is an instrument for tuning the
  // estimate, not a result. It lives behind the explanation because that is where a
  // tester asked to send their data has just been reading what the data is.
  const shareAgeData = async () => {
    const text = buildAgeDataText(day, puzzle, ms, age ?? 0, metrics, isPractice);
    setDataStatus(await shareResult(text));
  };

  // The explanation takes the card over rather than stacking a second panel on top of
  // it, the same way the tally note takes over the how-to: one dialog at a time, and
  // nothing for a phone to trap the player under.
  if (showAgeInfo) {
    return (
      <div className="howto" role="dialog" aria-label="About your Find Me Age">
        <h2>About your Find Me Age</h2>
        <p>Five things are measured while you play:</p>
        <ul>
          <li>How long you took to find the {puzzle.thing}</li>
          <li>How long you took to line it up after finding it</li>
          <li>How many times you found it and then lost it again</li>
          <li>How much you moved the view while lining it up</li>
          <li>How long you spent not moving at all</li>
        </ul>
        <p>
          Each one is compared against what today&rsquo;s puzzle should take, not against a
          fixed number. Later days in the week are harder, so they are given more time.
        </p>
        <p className="howto-note">
          This is for fun. It is not a real measure of your age, and it is not very
          accurate &mdash; some fast players are older than some slow ones. Nothing about
          you is stored or sent. The number is worked out on your device, from this run
          only.
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
    <div
      className="result"
      role="dialog"
      aria-label={gaveUp ? 'Puzzle given up' : 'Puzzle solved'}
    >
      <p className="result-eyebrow">{puzzle.emoji} {gaveUp ? 'not found' : 'found'}</p>
      <p className={`result-time${gaveUp ? ' is-quiet' : ''}`}>{formatTime(ms)}</p>
      {/* No speed bar and no age on a give-up: both of them say how well a hunt went,
          and this one did not go well. What replaces them is the one thing the player
          came back for -- where it was -- which is already framed on the board behind
          this card. */}
      {/* The hunt trace, exactly as the share text will carry it, so the player sees
          what they are about to post. A run from before the trace keeps its speed bar. */}
      {trace ? (
        <>
          <p className="result-bar" aria-label="How the hunt went">{trace}</p>
          <p className="result-trace-key">{traceKey(metrics)}</p>
        </>
      ) : (
        !gaveUp && <p className="result-bar">{speedBar(ms)}</p>
      )}
      {gaveUp && (
        <p className="result-gaveup">
          hunted, then shown. It is framed on the board behind this card &mdash; have a
          look at what you walked past.
        </p>
      )}

      {!gaveUp && age !== null && (
        <div className="result-age-block">
          <p className="result-age">
            Your Find Me Age: <strong>{age}</strong>
            <button
              type="button"
              className="result-age-info"
              aria-label="How is this worked out?"
              title="How is this worked out?"
              onClick={() => setShowAgeInfo(true)}
            >
              i
            </button>
          </p>
          {/* What the number was made of. Only the two signals furthest from par are
              named: the whole list is a wall of jargon, and the interesting thing about a
              run is always the one or two ways it was unusual. */}
          {parts.length > 0 && <p className="result-age-why">{whyLine(parts)}</p>}
        </div>
      )}

      {tally && <p className="result-others">{tallyLine(tally)}</p>}

      {retuned && (
        <p className="result-retuned">
          This puzzle changed after you played it. Your time stands.{' '}
          <a href={`./?puzzle=${puzzle.id}`}>Try the new one</a> — it isn&rsquo;t recorded.
        </p>
      )}

      <p className="result-art">
        <strong>{puzzle.title}</strong>
        <span>
          {puzzle.artist} &middot; {puzzle.year}
        </span>
      </p>

      {/* The same after a give-up as after a find: the reward for looking at a painting is
          not only for the players who found the shape in it. Never in the share text, and
          never on screen during a hunt: this card only exists once the hunt has ended. */}
      {puzzle.note && (
        <p className="result-note">
          {puzzle.note}
          {puzzle.source && (
            <>
              {' '}
              <a href={puzzle.source} target="_blank" rel="noopener noreferrer">
                More on Commons
              </a>
            </>
          )}
        </p>
      )}

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
