import { useEffect, useMemo, useState } from 'react';
import { fetchTallies, type DayTally } from '../game/count';
import { dayIndex } from '../game/daily';
import { RAMP } from '../game/difficulty';
import { formatTime } from '../game/format';
import { galleryWall, type Frame, type WallWeek } from '../game/gallery';
import { byWeekday, recentMarks, type Mark } from '../game/history';
import { getHistory, getStats } from '../game/storage';
import { WeekShare } from './WeekShare';

interface Props {
  onDismiss: () => void;
}

/** A median to the second, like the tally line: nothing here is worth a tenth. */
function rough(ms: number): string {
  const secs = Math.round(ms / 1000);
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

const MARK_LABEL: Record<Mark, string> = {
  solved: 'found',
  'gave-up': 'not found',
  missed: 'not played',
  today: 'today',
  ahead: 'still to come',
  none: '',
};

/** Fewer solves than this and the panel says the picture is still filling in. */
const THIN = 3;

/**
 * The player's own history, drawn: the totals, their week against everyone else's, and
 * the last few weeks as marks.
 *
 * Everything on it is a day the player has already finished. Always today's real calendar,
 * even on a practice run, because that is the only calendar a history belongs to.
 */
export function Stats({ onDismiss }: Props) {
  const today = useMemo(() => dayIndex(), []);
  const history = useMemo(() => getHistory(), []);
  const stats = useMemo(() => getStats(today), [today]);

  const [tallies, setTallies] = useState<Map<number, DayTally>>(() => new Map());
  useEffect(() => {
    const solved = history.days.filter((d) => !d.gaveUp).map((d) => d.day);
    let live = true;
    void fetchTallies(solved).then((t) => {
      if (live) setTallies(t);
    });
    return () => {
      live = false;
    };
  }, [history]);

  const week = useMemo(() => byWeekday(history.days, tallies), [history, tallies]);
  const marks = useMemo(() => recentMarks(history.days, today), [history, today]);
  const wall = useMemo(() => galleryWall(history.days, today), [history, today]);
  // One painting, taken over the panel the way the age explanation takes over the card.
  const [open, setOpen] = useState<Frame | null>(null);

  if (open) {
    return (
      <div className="howto stats" role="dialog" aria-label={open.title}>
        <h2>{open.title}</h2>
        <p className="stats-note">
          {open.artist} &middot; {open.year}
        </p>
        <div className={`gallery-picture${open.week.full ? ' is-full' : ''}`}>
          <img src={open.thumb} alt={open.title} width={open.width} height={open.height} />
        </div>
        <WallMarks week={open.week} labeled />
        {open.week.full && <p className="stats-note">Every day of the week found.</p>}
        <div className="howto-foot">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(null)}>
            Back
          </button>
          <WeekShare frame={open} label="Share this week" />
        </div>
      </div>
    );
  }

  const empty = history.days.length === 0 && history.unnamed === 0;
  const solvedCount = week.reduce((n, w) => n + w.solved, 0);
  const anyOthers = week.some((w) => w.othersMs !== null);
  const longest = Math.max(1, ...week.flatMap((w) => [w.medianMs ?? 0, w.othersMs ?? 0]));
  const pct = (ms: number) => `${Math.max(2, (100 * ms) / longest)}%`;

  return (
    <div className="howto stats" role="dialog" aria-label="Your stats">
      <h2>Your stats</h2>

      {empty ? (
        <p className="howto-note">
          Nothing here yet. Once you have found your first one, your times will show up
          here &mdash; a line for each day of the week, and your last few weeks.
        </p>
      ) : (
        <>
          {wall.length > 0 && (
            <>
              <h3>Your gallery</h3>
              <ul className="gallery">
                {wall.map((f) => (
                  <li key={f.image}>
                    <button
                      type="button"
                      className={`gallery-frame${f.week.full ? ' is-full' : ''}`}
                      onClick={() => setOpen(f)}
                      aria-label={`${f.title}, ${wallLabel(f.week)}`}
                    >
                      <img src={f.thumb} alt="" loading="lazy" decoding="async" />
                    </button>
                    <WallMarks week={f.week} />
                  </li>
                ))}
              </ul>
            </>
          )}

          <dl className="result-stats">
            <div><dt>played</dt><dd>{stats.played}</dd></div>
            <div><dt>streak</dt><dd>{stats.streak}</dd></div>
            <div><dt>best</dt><dd>{stats.best === null ? '—' : formatTime(stats.best)}</dd></div>
          </dl>
          {history.unnamed > 0 && (
            <p className="stats-note">
              Played includes {history.unnamed} older{' '}
              {history.unnamed === 1 ? 'day' : 'days'} this browser still counts but can no
              longer show.
            </p>
          )}

          <h3>Every week so far, by day</h3>
          <p className="stats-note">
            Your typical time for a day of the week
            {anyOthers ? ' compared to everyone else’s' : ''}.
          </p>
          <ul className="stats-week">
            {week.map((w) => (
              <li key={w.weekday}>
                <span className="stats-day">{RAMP[w.weekday].label.slice(0, 3)}</span>
                <span className="stats-track" aria-hidden="true">
                  {w.medianMs !== null && (
                    <span className="stats-bar" style={{ width: pct(w.medianMs) }} />
                  )}
                  {w.othersMs !== null && (
                    <span className="stats-tick" style={{ left: pct(w.othersMs) }} />
                  )}
                </span>
                <span className="stats-time">{w.medianMs === null ? '—' : rough(w.medianMs)}</span>
                <span className="stats-sub">
                  {w.solved + w.gaveUp === 0
                    ? 'not played yet'
                    : [
                        w.gaveUp > 0 && `${w.gaveUp} not found`,
                        w.othersMs !== null && `everyone ${rough(w.othersMs)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          {anyOthers && (
            <p className="stats-legend" aria-hidden="true">
              <span className="stats-key-bar" /> you <span className="stats-key-tick" /> everyone
            </p>
          )}
          {solvedCount < THIN && (
            <p className="stats-note">A few more days and this starts to show your week.</p>
          )}

          <h3>Last four weeks</h3>
          <div className="stats-recent" role="img" aria-label={recentLabel(marks)}>
            {RAMP.map((r) => (
              <span key={r.key} className="stats-head">
                {r.label[0]}
              </span>
            ))}
            {marks.flat().map((m, i) => (
              <span key={i} className={`stats-mark is-${m}`} title={MARK_LABEL[m]} />
            ))}
          </div>
        </>
      )}

      <div className="howto-foot">
        <button type="button" className="btn btn-primary" onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  );
}

/** A week's seven marks under a painting, Monday first. */
function WallMarks({ week, labeled }: { week: WallWeek; labeled?: boolean }) {
  return (
    <div
      className={`gallery-marks${labeled ? ' is-labeled' : ''}`}
      role="img"
      aria-label={wallLabel(week)}
    >
      {labeled &&
        RAMP.map((r) => (
          <span key={r.key} className="stats-head">
            {r.label[0]}
          </span>
        ))}
      {week.marks.map((m, i) => (
        <span key={i} className={`stats-mark is-${m}`} title={MARK_LABEL[m]} />
      ))}
    </div>
  );
}

function wallLabel(week: WallWeek): string {
  if (week.full) return 'every day found';
  return week.gaveUp > 0 ? `${week.found} found, ${week.gaveUp} not found` : `${week.found} found`;
}

/** The strip, said in words for a screen reader. */
function recentLabel(marks: Mark[][]): string {
  const flat = marks.flat();
  const found = flat.filter((m) => m === 'solved').length;
  const missed = flat.filter((m) => m === 'missed').length;
  const lost = flat.filter((m) => m === 'gave-up').length;
  return `Last four weeks: ${found} found, ${lost} not found, ${missed} not played`;
}
