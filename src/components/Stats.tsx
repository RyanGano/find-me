import { useEffect, useMemo, useState } from 'react';
import { fetchTallies, type DayTally } from '../game/count';
import { dateOfDay, dayIndex } from '../game/daily';
import { RAMP } from '../game/difficulty';
import { formatRoughTime, formatTime } from '../game/format';
import { galleryWall, notesFor, type Frame, type WallWeek } from '../game/gallery';
import { byWeekday, extremes, recentMarks, recentStart, type Mark } from '../game/history';
import { getHistory, getStats, type HistoryDay } from '../game/storage';
import { StatTotals } from './StatTotals';
import { WeekShare } from './WeekShare';

interface Props {
  onDismiss: () => void;
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
  const range = useMemo(() => extremes(history.days), [history]);
  const byDay = useMemo(() => new Map(history.days.map((d) => [d.day, d])), [history]);
  // One painting, taken over the panel the way the age explanation takes over the card.
  const [open, setOpen] = useState<Frame | null>(null);
  // The recent mark last tapped, by day number. A tap and not a tooltip, which a phone never shows.
  const [picked, setPicked] = useState<number | null>(null);

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
        <WallNotes week={open.week} />
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

          <StatTotals stats={stats} />
          {/* Each time says the day it was set on: a Monday and a Sunday are not the same
              hunt, and a bare fastest time would pretend they were. Written out rather
              than behind a tooltip, which a phone never shows. */}
          {range && (
            <dl className="result-stats">
              <div>
                <dt>fastest <span className="stats-when">{dateLabel(range.fastest.day)}</span></dt>
                <dd>{formatTime(range.fastest.ms)}</dd>
              </div>
              <div>
                <dt>slowest <span className="stats-when">{dateLabel(range.slowest.day)}</span></dt>
                <dd>{formatTime(range.slowest.ms)}</dd>
              </div>
            </dl>
          )}
          {history.unnamed > 0 && (
            <p className="stats-note">
              Played includes {history.unnamed} earlier {history.unnamed === 1 ? 'day' : 'days'}.
            </p>
          )}

          <h3>Your typical time by weekday</h3>
          {/* Held back until there is something to draw: seven rows of "not played yet"
              was most of the panel for a new player. */}
          {solvedCount < THIN ? (
            <p className="stats-note">Find a few more and your times for each weekday show up here.</p>
          ) : (
            <>
              {anyOthers && <p className="stats-note">Compared to everyone else&rsquo;s.</p>}
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
                    <span className="stats-time">{w.medianMs === null ? '—' : formatRoughTime(w.medianMs)}</span>
                    <span className="stats-sub">
                      {w.solved + w.gaveUp === 0
                        ? 'not played yet'
                        : [
                            w.gaveUp > 0 && `${w.gaveUp} not found`,
                            w.othersMs !== null && `everyone ${formatRoughTime(w.othersMs)}`,
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
            </>
          )}

          <h3>Last four weeks</h3>
          <div className="stats-recent" role="group" aria-label={recentLabel(marks)}>
            {RAMP.map((r) => (
              <span key={r.key} className="stats-head" aria-hidden="true">
                {r.label[0]}
              </span>
            ))}
            {marks.flat().map((m, i) => {
              const played = byDay.get(recentStart(today) + i);
              if (!played) {
                return <span key={i} className={`stats-mark is-${m}`} title={MARK_LABEL[m]} aria-hidden="true" />;
              }
              const tip = markTip(played);
              const on = picked === played.day;
              return (
                <button
                  key={i}
                  type="button"
                  className={`stats-mark is-${m}${on ? ' is-picked' : ''}`}
                  title={tip}
                  aria-label={tip}
                  aria-pressed={on}
                  onClick={() => setPicked(on ? null : played.day)}
                />
              );
            })}
          </div>
          {marks.flat().some((m) => m === 'solved' || m === 'gave-up') && (
            <p className="stats-note" aria-live="polite">
              {picked === null || !byDay.has(picked) ? 'Tap a day to see your time.' : markTip(byDay.get(picked)!)}
            </p>
          )}
          <p className="stats-legend" aria-hidden="true">
            <span className="stats-mark legend-mark is-solved" /> found
            <span className="stats-mark legend-mark is-gave-up" /> not found
            <span className="stats-mark legend-mark is-missed" /> not played
            <span className="stats-mark legend-mark is-today" /> today
          </p>
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

/** The note from each day of the week the player found, under its day's name. */
function WallNotes({ week }: { week: WallWeek }) {
  const notes = notesFor(week);
  if (notes.length === 0) return null;
  return (
    <dl className="gallery-notes">
      {notes.map((n) => (
        <div key={n.weekday}>
          <dt>{RAMP[n.weekday].label}</dt>
          <dd>{n.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A day number as the date a player would say: "Thu, Sep 3". */
function dateLabel(day: number): string {
  return dateOfDay(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** One played day of the recent strip, said in full: "Thu, Sep 3 · found in 1:23.4". */
function markTip(d: HistoryDay): string {
  const when = dateLabel(d.day);
  return d.gaveUp ? `${when} · gave up after ${formatTime(d.ms)}` : `${when} · found in ${formatTime(d.ms)}`;
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
