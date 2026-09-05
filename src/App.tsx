import { useCallback, useEffect, useMemo, useState } from 'react';
import { Credits } from './components/Credits';
import { HowTo } from './components/HowTo';
import { ReferenceCard } from './components/ReferenceCard';
import { ResultCard } from './components/ResultCard';
import { Stage } from './components/Stage';
import { UpdateNotice } from './components/UpdateNotice';
import { isInAppBrowser } from './game/browser';
import { count, newRunId } from './game/count';
import { puzzleNumber, selectPuzzle } from './game/daily';
import { RAMP } from './game/difficulty';
import { formatTime } from './game/format';
import type { RunMetrics } from './game/metrics';
import {
  clearProgress,
  getCurrentResult,
  getProgress,
  getStats,
  isPersistent,
  saveProgress,
  saveResult,
  touch,
  type Stats,
} from './game/storage';
import { useHunt, type LeftRun } from './hooks/useHunt';
import { useUpdateAvailable } from './hooks/useUpdateAvailable';

const HOWTO_SEEN = 'find-me:howto-seen';
const BETA_SEEN = 'find-me:beta-seen';
const WARNING_SEEN = 'find-me:storage-warning-seen';

/**
 * `localStorage` on its own, wrapped so a browser that refuses to hand it over cannot
 * take the whole page down with it. Reading `localStorage` throws outright -- not
 * returns null -- when a browser is set to block all website data, which is exactly the
 * setting a player who loses their streak is most likely to be running.
 */
function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function setFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Nothing is being kept on this browser; `storagePersists` already says so.
  }
}

export default function App() {
  const selection = useMemo(() => selectPuzzle(window.location.search), []);
  const { puzzle, index: day, isPractice } = selection;

  // A solve already recorded for today opens as a finished board, not a fresh timer.
  const prior = useMemo(
    () => (isPractice ? undefined : getCurrentResult(day, puzzle.version)),
    [day, isPractice, puzzle.version],
  );

  // A run left half-finished -- most often by an accidental edge swipe, which the browser
  // reads as "back" -- comes back with its clock where it was, rather than handing the
  // player a fresh timer and a free second look at the painting.
  const saved = useMemo(
    () => (isPractice || prior ? undefined : getProgress(day, puzzle.version)),
    [day, isPractice, prior, puzzle.version],
  );

  // Identifies this run to the daily tally, and nothing beyond it. A resumed run carries
  // the id it was banked with, so a back-swipe is not counted as a second player.
  const [runId] = useState<string>(() => saved?.r ?? newRunId());

  const [showResult, setShowResult] = useState(Boolean(prior));
  // The reveal ring is a spoiler once the hunt is over, so let the player hide it
  // while they look at the painting itself.
  const [showRing, setShowRing] = useState(true);
  const [stats, setStats] = useState<Stats>(() => getStats(day));

  const [showCredits, setShowCredits] = useState(false);

  // A new build deployed under a page left open. Refreshing keeps the run: leaving the
  // page banks it, and it is handed straight back on the way in.
  const updateAvailable = useUpdateAvailable();

  const [showHowTo, setShowHowTo] = useState(
    () => !prior && !saved && !isPractice && !flag(HOWTO_SEEN),
  );

  // The game is still being tuned, so a time, an age or a streak can move under someone
  // who earned it. The sentence saying so opens itself once, on a first visit, and then
  // folds back into the pill -- which stays for good, because the warning outlasts the
  // one moment it was read.
  const [showBetaNote, setShowBetaNote] = useState(() => !flag(BETA_SEEN));

  /**
   * Whether this browser will still have the player's streak tomorrow, and why not.
   *
   * `in-app` is a link opened inside another app -- from a message, a feed, a chat.
   * The web view it lands in has its own storage, dropped when the view closes, so the
   * player solves the puzzle, comes back the next day through the same link and finds a
   * game that has never met them. It reads as a bug in the game, and it is the single
   * most common way a streak is actually lost.
   *
   * `blocked` is a browser that refuses to keep anything at all: a private tab, or
   * website data switched off. Checked by writing and reading back, since both states
   * look exactly like a working browser right up until the moment the streak is gone.
   *
   * Neither is fixable from in here. Both are worth saying out loud before the player
   * spends a fortnight building something the browser is going to throw away.
   */
  const [storageWarning] = useState<'in-app' | 'blocked' | null>(() => {
    if (isPractice) return null;
    if (isInAppBrowser()) return 'in-app';
    return isPersistent() ? null : 'blocked';
  });
  const [warningSeen, setWarningSeen] = useState(() => flag(WARNING_SEEN));

  // Re-arm the backup copy of the results on the way in. On iOS its lifetime is capped
  // and refreshed on write, so opening the game has to be enough to keep it alive --
  // waiting for a solve would lose the streak of anyone who visits and does not finish.
  useEffect(() => {
    if (!isPractice) touch();
  }, [isPractice]);

  // What the three moments of a run mean to the daily game: a play, a recorded time, and
  // a run banked where the player left it. A practice run means none of them, which is
  // the whole of what "not recorded" amounts to.
  const onStart = useCallback(
    (run: string) => {
      if (!isPractice) count(run, day, 'start');
    },
    [isPractice, day],
  );

  const onSolved = useCallback(
    (ms: number, run: RunMetrics, id: string) => {
      setShowResult(true);
      if (!isPractice) {
        saveResult(day, ms, puzzle.version, run);
        clearProgress();
        count(id, day, 'solved', ms);
      }
      setStats(getStats(day));
    },
    [isPractice, day, puzzle.version],
  );

  const onLeave = useCallback(
    (left: LeftRun, id: string) => {
      if (isPractice) return;
      saveProgress({ day, v: puzzle.version, ms: left.ms, t: left.t, w: left.w, h: left.h, k: left.k, r: id });
      // A run the player walked away from. If they come back and solve it, the solve
      // supersedes this; if they never do, this is how long they lasted.
      count(id, day, 'left', left.ms);
    },
    [isPractice, day, puzzle.version],
  );

  const {
    stageRef,
    transform,
    ready,
    onReady,
    fitScale,
    targetSize,
    match,
    startedAt,
    elapsed,
    clock,
    running,
    paused,
    resuming,
    solvedMs,
    metrics,
    togglePause,
    reset,
  } = useHunt({
    puzzle,
    resume: saved,
    prior: prior ? { ms: prior.ms, metrics: prior.m } : undefined,
    blocked: showHowTo || showCredits,
    runId,
    onStart,
    onSolved,
    onLeave,
  });

  const toggleBetaNote = useCallback(() => {
    setFlag(BETA_SEEN);
    setShowBetaNote((prev) => !prev);
  }, []);

  // Dismissible, but the flag that remembers it is written to the very storage the
  // warning is about -- so in the case it exists for, it comes back on the next visit.
  // That is the right way round: the warning outlasts the tab it was dismissed in.
  const dismissWarning = useCallback(() => {
    setFlag(WARNING_SEEN);
    setWarningSeen(true);
  }, []);

  const dismissHowTo = useCallback(() => {
    setFlag(HOWTO_SEEN);
    setShowHowTo(false);
    stageRef.current?.focus();
  }, [stageRef]);

  // Putting the card away and going back to the painting are two different wishes, and
  // only the card's own button means both. Dismissing it any other way leaves the view
  // exactly where the player left it -- now that the card can be summoned back, losing
  // your framing to a stray tap is the more expensive mistake of the two.
  const closeResult = useCallback(() => setShowResult(false), []);

  const replay = useCallback(() => {
    closeResult();
    reset();
  }, [closeResult, reset]);

  // Every panel goes away the same way: a tap on the board behind it. Whichever one is
  // up is put away by its own means -- the how-to still counts as read, so it does not
  // come back at the player tomorrow.
  const anyPanel = showResult || showCredits || showHowTo;
  const dismissPanels = useCallback(() => {
    if (showResult) closeResult();
    if (showCredits) setShowCredits(false);
    if (showHowTo) dismissHowTo();
  }, [showResult, closeResult, showCredits, showHowTo, dismissHowTo]);

  // Every button that opens a panel is a switch, not a door. Solving used to be one-way
  // -- the result card came down on any tap and a refresh was the only way back to your
  // own time -- so the clock and the badge lead back to it for as long as the day lasts.
  // Whatever is up comes down first, so only one panel is ever on the board; pressing
  // the button belonging to the panel already up just puts it away, rather than closing
  // it and opening it again in the same tap.
  const togglePanel = useCallback(
    (panel: 'result' | 'credits' | 'howto') => {
      const wasOpen = panel === 'result' ? showResult : panel === 'credits' ? showCredits : showHowTo;
      dismissPanels();
      if (wasOpen) return;
      if (panel === 'result') setShowResult(true);
      else if (panel === 'credits') setShowCredits(true);
      else setShowHowTo(true);
    },
    [showResult, showCredits, showHowTo, dismissPanels],
  );

  return (
    <div className="app">
      <header className="topbar">
        {/* The only way to ask what the painting is. It looks like the title and mostly
            behaves like one; most players will never think to press it, which is the
            point -- the header has no room for a button that answers a question hardly
            anyone asks mid-hunt, and every solve names the painting on the result card
            anyway. The weekday used to sit here too, and took a third of the bar to
            tell people something they either already knew or did not care about; the
            how-to panel still names the rung, which is where it was doing real work. */}
        <h1 className="title">
          <button
            type="button"
            className="title-btn"
            onClick={() => togglePanel('credits')}
            title="About the painting"
          >
            Find Me
          </button>{' '}
          <span className="title-day">#{puzzleNumber(day)}</span>
        </h1>
        {/* Small enough to read as a label on the title rather than a banner, but it is
            the one thing in the bar that is a colour of its own, so it gets noticed --
            and pressing it says what being in beta costs the player. */}
        <button
          type="button"
          className={`beta-pill${showBetaNote ? ' is-open' : ''}`}
          onClick={toggleBetaNote}
          title="Find Me is still in beta"
          aria-expanded={showBetaNote}
          aria-controls="beta-note"
        >
          beta
        </button>
        {/* Second door back to the result, for anyone whose eye goes up to their time
            rather than down to the badge. Costs no space: it is the clock either way. */}
        {solvedMs !== null ? (
          <button type="button" className="clock is-done" onClick={() => togglePanel('result')} title="Show your result">
            {formatTime(clock)}
          </button>
        ) : (
          <p className={`clock${running ? ' is-running' : ''}`}>
            {startedAt === null ? 'ready' : formatTime(clock)}
          </p>
        )}
        <div className="topbar-actions">
          {solvedMs !== null && (
            <button
              type="button"
              className={`btn btn-icon btn-ring${showRing ? ' is-on' : ''}`}
              onClick={() => setShowRing((prev) => !prev)}
              title={showRing ? 'Hide the reveal ring' : 'Show the reveal ring'}
              aria-pressed={showRing}
            >
              {/* Just the tick - the button's own round border is the circle. Green
                  while the ring is on the painting, grey once it is off. */}
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 12.6l4 4 8-9" />
              </svg>
            </button>
          )}
          {startedAt !== null && solvedMs === null && (
            <button
              type="button"
              className="btn btn-icon btn-pause"
              onClick={togglePause}
              title={paused ? 'Resume' : 'Pause'}
              aria-label={paused ? 'Resume' : 'Pause'}
              aria-pressed={paused}
            >
              {/* Two bars while running, a play triangle while held. */}
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {paused ? (
                  <path d="M9 6.5l9 5.5-9 5.5z" />
                ) : (
                  <>
                    <path d="M9.5 6v12" />
                    <path d="M14.5 6v12" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button type="button" className="btn btn-icon" onClick={reset} title="Reset view">
            ⟲
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => togglePanel('howto')}
            title="How to play"
          >
            ?
          </button>
        </div>
      </header>

      {showBetaNote && (
        <p className="beta-note" id="beta-note">
          <span>
            <strong>Find Me is in beta.</strong> The puzzles are still being tuned, so
            times, ages and streaks may change or reset at any point.
          </span>
          <button
            type="button"
            className="beta-note-close"
            onClick={toggleBetaNote}
            aria-label="Hide the beta note"
          >
            &times;
          </button>
        </p>
      )}

      {storageWarning && !warningSeen && (
        <p className="storage-note">
          <span>
            {storageWarning === 'in-app' ? (
              <>
                <strong>Your streak will not be saved here.</strong> You have opened Find
                Me inside another app, which gives it its own throwaway storage. Open
                findme.ryangano.com in Safari — or use Share → Add to Home Screen, which
                keeps it for good.
              </>
            ) : (
              <>
                <strong>This browser is not saving anything.</strong> Your time and streak
                will be gone when you close it. Private browsing, or website data turned
                off in Settings, will both do this.
              </>
            )}
          </span>
          <button
            type="button"
            className="beta-note-close"
            onClick={dismissWarning}
            aria-label="Hide this warning"
          >
            &times;
          </button>
        </p>
      )}

      {isPractice && <p className="practice-note">practice mode — this run is not recorded</p>}

      <main className="board">
        <Stage
          stageRef={stageRef}
          puzzle={puzzle}
          transform={transform ?? { x: 0, y: 0, scale: 1, rot: 0 }}
          fitScale={fitScale}
          showRing={solvedMs !== null && showRing}
          blurred={paused || (startedAt === null && solvedMs === null)}
          paused={paused}
          resumed={resuming}
          onReady={onReady}
        />

        {/* Sits inside the board rather than above it: a banner in the column would
            resize the stage, and the saved view only fits the box it was framed in. */}
        {resuming && (
          <p className="resume-note">
            continuing your run — clock held at {formatTime(elapsed)}
          </p>
        )}

        {!ready && <p className="loading">Loading today&rsquo;s painting…</p>}

        <ReferenceCard
          puzzle={puzzle}
          targetSize={targetSize}
          match={match}
          solvedMs={solvedMs}
          onReopen={() => togglePanel('result')}
        />

        {showCredits && <Credits puzzle={puzzle} onDismiss={() => setShowCredits(false)} />}

        {showHowTo && <HowTo thing={puzzle.thing} rung={RAMP[puzzle.dayOfWeek].label} onDismiss={dismissHowTo} />}

        {/* Dismissed on the click, not the pointerdown. The badge under the corner of
            the scrim is the way back to the result card, and closing on the way down
            took the scrim out from under the finger before the tap had finished -- the
            click the browser sends afterwards then landed on the badge and put the card
            straight back up, so the result flashed instead of closing. Waiting for the
            click keeps the scrim there to absorb it. */}
        {anyPanel && <div className="scrim" onClick={dismissPanels} />}

        {showResult && solvedMs !== null && (
          <ResultCard
            day={puzzleNumber(day)}
            puzzle={puzzle}
            ms={solvedMs}
            stats={stats}
            isPractice={isPractice}
            metrics={metrics}
            onReplay={replay}
          />
        )}
      </main>

      {updateAvailable && <UpdateNotice />}
    </div>
  );
}
