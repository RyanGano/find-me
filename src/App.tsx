import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Credits } from './components/Credits';
import { HowTo } from './components/HowTo';
import { ReferenceCard } from './components/ReferenceCard';
import { ResultCard } from './components/ResultCard';
import { Stage } from './components/Stage';
import { Stats as StatsPanel } from './components/Stats';
import { UpdateNotice } from './components/UpdateNotice';
import HideMaker from './HideMaker';
import { giveUpAfterMs, hintAfterMs } from './game/age';
import { hintCircle } from './game/hint';
import { isInAppBrowser } from './game/browser';
import { count, fetchTally, newRunId, type DayTally } from './game/count';
import { isTestMode } from './game/testMode';
import { puzzleNumber, selectPuzzle, weekdayOf } from './game/daily';
import { frameFor, weekOf, type Frame } from './game/gallery';
import { RAMP } from './game/difficulty';
import { formatTime } from './game/format';
import type { RunMetrics } from './game/metrics';
import { openRound } from './game/rounds';
import {
  clearProgress,
  getDayState,
  getHistory,
  getProgress,
  getStats,
  isPersistent,
  saveGaveUp,
  saveProgress,
  saveResult,
  touch,
  type Stats,
} from './game/storage';
import { isDone } from './game/testbedStore';
import { useDayRollover } from './hooks/useDayRollover';
import { useHunt, type LeftRun } from './hooks/useHunt';
import { useUpdateAvailable } from './hooks/useUpdateAvailable';

/**
 * What to say to somebody who reached for the way out before it opened.
 *
 * Deliberately vague about how much longer. A countdown turns the wait into the thing
 * being watched, and "42 seconds" is an invitation to sit and stare at a number rather
 * than at the painting -- which is the one thing that can still rescue the run. So this
 * says only roughly how far off they are, and says it as encouragement.
 */
function plead(left: number): string {
  if (left > 0.6) return 'Not yet — you have hardly begun. Have a proper hunt first.';
  if (left > 0.25) return 'Not yet. Give it another minute of real looking — it is in there.';
  return 'Nearly. A few more seconds and it is yours — you are closer than you think.';
}

const HOWTO_SEEN = 'find-me:howto-seen';
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

/** The week a Sunday finishes, as a frame to share -- or null on any other day. */
function sundayFrame(day: number, isPractice: boolean): Frame | null {
  if (isPractice || weekdayOf(day) !== 6) return null;
  const week = weekOf(getHistory().days, day, day);
  return week.found > 0 ? frameFor(week) : null;
}

export default function App() {
  const selection = useMemo(() => selectPuzzle(window.location.search), []);
  const { puzzle, index: day, isPractice } = selection;
  // Read once, like the mode itself: everything below has to agree about which store it
  // is writing to for the whole life of the component. See `testMode.ts`.
  const isTest = useMemo(() => isTestMode(), []);

  // A solve already recorded for today opens as a finished board, not a fresh timer --
  // whatever the puzzle has become since it was set.
  //
  // This used to be matched on the day's `version` as well, which meant that re-tuning a
  // day handed a fresh clock to everyone who had already finished it. That is right for
  // the tuner -- a redefined puzzle really is a new challenge -- but it was being asked a
  // second question it cannot answer: whether this player has played today. They have,
  // and a day somebody has finished is over. What a moved version earns is the *offer* of
  // another go, which the card makes; what it must never do is take the finished board
  // away without asking, because the replay then supersedes the time they actually set
  // and there is no copy of it anywhere else. See `restoreResult` in `storage.ts` for the
  // door that exists because this did not.
  const { result: prior, retuned } = useMemo(
    () => (isPractice ? { retuned: false } : getDayState(day, puzzle.version, puzzle.spot)),
    [day, isPractice, puzzle.version, puzzle.spot],
  );

  // A run left half-finished -- most often by an accidental edge swipe, which the browser
  // reads as "back" -- comes back with its clock where it was, rather than handing the
  // player a fresh timer and a free second look at the painting.
  const saved = useMemo(
    () => (isPractice || prior ? undefined : getProgress(day, puzzle.version, puzzle.spot)),
    [day, isPractice, prior, puzzle.version, puzzle.spot],
  );

  // Identifies this run to the daily tally, and nothing beyond it. A resumed run carries
  // the id it was banked with, so a back-swipe is not counted as a second player.
  const [runId] = useState<string>(() => saved?.r ?? newRunId());

  const [showResult, setShowResult] = useState(Boolean(prior));
  // The reveal ring is a spoiler once the hunt is over, so let the player hide it
  // while they look at the painting itself.
  const [showRing, setShowRing] = useState(true);
  const [stats, setStats] = useState<Stats>(() => getStats(day));
  // Sunday's card also offers the week as a picture, once it holds a find. Read again
  // wherever the stats are, which is whenever a result has just been written.
  const [sundayWeek, setSundayWeek] = useState(() => sundayFrame(day, isPractice));

  const [showCredits, setShowCredits] = useState(false);
  const [showStats, setShowStats] = useState(false);
  // Up between pressing the way out and meaning it. Giving up is not a thing to do by
  // accident on a phone, and it is the one button here that cannot be taken back.
  const [confirming, setConfirming] = useState(false);
  // What was said to someone who reached for the way out too early, and a nonce so that
  // pressing again re-arms the same words rather than silently changing nothing.
  const [plea, setPlea] = useState<{ n: number; text: string } | null>(null);

  // Hide one for a friend: a layer over this board rather than a page of its own, so the
  // only way in is a day that is over. Mounted on first open and then kept, only hidden, so
  // putting it away loses nothing the setter did.
  const [making, setMaking] = useState(false);
  const [madeOnce, setMadeOnce] = useState(false);

  // A new build deployed under a page left open. Refreshing keeps the run: leaving the
  // page banks it, and it is handed straight back on the way in.
  const updateAvailable = useUpdateAvailable();

  const [showHowTo, setShowHowTo] = useState(
    () => !prior && !saved && !isPractice && !flag(HOWTO_SEEN),
  );

  const [showTestNote, setShowTestNote] = useState(false);

  /**
   * The play-testing invitation behind the TEST button, which is only in the bar while
   * there is a round to invite anyone to.
   *
   * Read once, at mount, and read only -- the bench is offered from here, never touched
   * from here, so the daily game still cannot write a tester's row and a tester id is
   * still minted only by someone who actually opens `/?beta`.
   */
  const invite = useMemo(() => {
    const round = openRound();
    if (!round) return undefined;
    return { hunts: round.days.length, done: isDone(round.id) };
  }, []);

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
        saveResult(day, ms, puzzle.version, puzzle.spot, run);
        clearProgress();
        count(id, day, 'solved', ms);
      }
      setStats(getStats(day));
      setSundayWeek(sundayFrame(day, isPractice));
    },
    [isPractice, day, puzzle.version, puzzle.spot],
  );

  const onLeave = useCallback(
    (left: LeftRun, id: string) => {
      if (isPractice) return;
      saveProgress({ day, v: puzzle.version, s: puzzle.spot, ms: left.ms, t: left.t, w: left.w, h: left.h, k: left.k, r: id });
      // A run the player walked away from. If they come back and solve it, the solve
      // supersedes this; if they never do, this is how long they lasted.
      count(id, day, 'left', left.ms);
    },
    [isPractice, day, puzzle.version, puzzle.spot],
  );

  /**
   * The run as it stands right now, for a page coming back to it.
   *
   * The same read as `saved`, but taken again rather than remembered: the point of it is
   * that another page of this day may have carried the run on while this one sat hidden,
   * and a value read at mount is exactly the stale answer that would be no use.
   */
  const onReturn = useCallback(
    () => (isPractice ? undefined : getProgress(day, puzzle.version, puzzle.spot)),
    [isPractice, day, puzzle.version, puzzle.spot],
  );

  const gate = useMemo(() => giveUpAfterMs(puzzle), [puzzle]);
  const hintGate = useMemo(() => hintAfterMs(puzzle), [puzzle]);
  const circle = useMemo(() => hintCircle(puzzle), [puzzle]);
  // Said once, when the hint is taken, and then left to the circle.
  const [hintNote, setHintNote] = useState(false);

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
    gaveUpMs,
    metrics,
    togglePause,
    reset,
    giveUp,
    hinted,
    takeHint,
  } = useHunt({
    puzzle,
    resume: saved,
    prior: prior ? { ms: prior.ms, metrics: prior.m, gaveUp: prior.gaveUp } : undefined,
    blocked: showHowTo || showCredits || showStats || making,
    runId,
    onStart,
    onSolved,
    onLeave,
    onReturn,
  });

  // The run is over however it ended: both close the day, and both open the card.
  const done = solvedMs ?? gaveUpMs;

  const canGiveUp = startedAt !== null && done === null && clock >= gate;
  const canHint = startedAt !== null && done === null && !hinted && clock >= hintGate;

  /**
   * Midnight has passed under a page that was left open, so the painting on screen is
   * yesterday's.
   *
   * Picked up as soon as the board is idle, and not one moment before: a hunt in progress
   * is a hunt for the puzzle it started on and is left to finish on its own terms, and so
   * is the card it ends on -- which has been counting down to this and now has nothing
   * left to promise. Both of those are things the player is looking at, and neither is
   * worth taking off them to be a day more correct.
   *
   * A reload rather than re-selecting in place, because the day is the thing this whole
   * component is arranged around: the run id, the stats, the resume, the streak and the
   * how-to are all read once, for one day, at mount. Coming back through the front door
   * is the only way to get all of them right at once, and the page is idle anyway.
   */
  const newDay = useDayRollover(!isPractice);
  useEffect(() => {
    if (!newDay || showResult || making) return;
    if (startedAt !== null && done === null) return;
    location.reload();
  }, [newDay, showResult, making, startedAt, done]);

  /**
   * Back does nothing while the maker is open. A hide can take a long time to set, the
   * maker is swiped at far more than the board is, and an edge swipe is read as back -- so
   * the maker closes on its own button and nothing else. Opening it pushes an entry at the
   * same address for back to spend, and every back that spends it pushes another.
   */
  const leavingMaker = useRef(false);

  const openMaker = useCallback(() => {
    setMaking(true);
    setMadeOnce(true);
    history.pushState({ findMeHide: true }, '');
  }, []);

  const closeMaker = useCallback(() => {
    // Through history when our entry is on top, so it does not linger for a later back
    // press to land on; the popstate below is what actually closes the layer.
    if ((history.state as { findMeHide?: boolean } | null)?.findMeHide) {
      leavingMaker.current = true;
      history.back();
    } else {
      setMaking(false);
    }
  }, []);

  useEffect(() => {
    if (!making) return;
    const onPop = () => {
      if (leavingMaker.current) {
        leavingMaker.current = false;
        setMaking(false);
      } else {
        history.pushState({ findMeHide: true }, '');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [making]);

  // How everyone else did, asked for only once the run is over -- never before or during a
  // hunt, where a solve rate would be a difficulty hint. A practice run is not counted and
  // is given no comparison either. Absent until it arrives, and absent for good if it
  // never does; the card never waits on it.
  const finished = done !== null;
  const [tally, setTally] = useState<DayTally | null>(null);
  useEffect(() => {
    if (isPractice || !finished) return;
    let live = true;
    void fetchTally(day).then((t) => {
      if (live) setTally(t);
    });
    return () => {
      live = false;
    };
  }, [isPractice, finished, day]);

  const onShared = useCallback(() => {
    if (!isPractice) count(runId, day, 'shared');
  }, [isPractice, runId, day]);

  // The plea, or nothing: it has no business on screen once the door it was about has
  // opened, and the button that raises it stands down for as long as it is up.
  const pleading = plea !== null && !confirming && !canGiveUp ? plea : null;

  /**
   * Reported once per run, the first time somebody reaches for a way out that is not
   * open yet.
   *
   * It is the reading this game has never had. A leave is ambiguous -- a phone call, a
   * back-swipe, a flat battery -- and a give-up only ever comes from the players who
   * stopped; this comes from the ones who carried on and found it too, and it says
   * plainly that the day was harder than it was priced at.
   */
  const reportedStuck = useRef(false);

  const askToGiveUp = useCallback(() => {
    if (canGiveUp) {
      setConfirming(true);
      return;
    }
    if (!reportedStuck.current) {
      reportedStuck.current = true;
      if (!isPractice) count(runId, day, 'stuck', clock);
    }
    setPlea((prev) => ({
      n: (prev?.n ?? 0) + 1,
      text: plead(1 - clock / gate),
    }));
  }, [canGiveUp, isPractice, runId, day, clock, gate]);

  /**
   * Stop the clock, show them where it was, and close the day out as played.
   *
   * A recorded result rather than nothing at all, because the alternative -- the tab
   * closed on an unsolved painting -- is the version of this day the player remembers,
   * and it teaches them nothing about how to look. The streak ends here: a give-up that
   * kept it would be strictly better than not playing.
   */
  /**
   * The hint, or a word of encouragement if it is not open yet -- the same answer the
   * give-up gives an early press. Unlike the give-up, an early press here is not
   * reported: `stuck` means the first reach for the give-up, and a second source would
   * change what that column has always counted.
   */
  const askForHint = useCallback(() => {
    if (canHint) {
      takeHint();
      setHintNote(true);
      if (!isPractice) count(runId, day, 'hint', clock);
      return;
    }
    setPlea((prev) => ({ n: (prev?.n ?? 0) + 1, text: plead(1 - clock / hintGate) }));
  }, [canHint, takeHint, clock, hintGate, isPractice, runId, day]);

  /**
   * The give-up question closes on any tap outside it, or Escape, like every other panel
   * in the game: a popup opened by mistake should not make the player hunt for its
   * button. No scrim, because the board stays live behind the question -- a tap outside
   * closes it and still reaches the painting, so the player carries on in one motion.
   */
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirming) return;
    const onDown = (e: PointerEvent) => {
      if (!confirmRef.current?.contains(e.target as Node)) setConfirming(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [confirming]);

  useEffect(() => {
    if (!hintNote) return;
    const id = setTimeout(() => setHintNote(false), 5000);
    return () => clearTimeout(id);
  }, [hintNote]);

  const onGiveUp = useCallback(() => {
    setConfirming(false);
    setPlea(null);
    const { ms, metrics: m } = giveUp();
    setShowResult(true);
    setShowRing(true);
    if (!isPractice) {
      saveGaveUp(day, ms, puzzle.version, puzzle.spot, m ?? undefined);
      clearProgress();
      count(runId, day, 'gave-up', ms);
    }
    setStats(getStats(day));
    setSundayWeek(sundayFrame(day, isPractice));
  }, [giveUp, isPractice, day, puzzle.version, puzzle.spot, runId]);

  // The plea has said its piece; it should not sit on the painting for the rest of the
  // hunt. It goes the moment the door it was about opens too, but that is decided at
  // render time rather than here -- it is a thing that is true, not a thing that happens.
  useEffect(() => {
    if (!plea) return;
    const id = setTimeout(() => setPlea(null), 6000);
    return () => clearTimeout(id);
  }, [plea]);

  const toggleTestNote = useCallback(() => setShowTestNote((prev) => !prev), []);

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
  const anyPanel = showResult || showCredits || showHowTo || showStats;
  const dismissPanels = useCallback(() => {
    if (showResult) closeResult();
    if (showCredits) setShowCredits(false);
    if (showHowTo) dismissHowTo();
    if (showStats) setShowStats(false);
  }, [showResult, closeResult, showCredits, showHowTo, dismissHowTo, showStats]);

  /**
   * Reported once per page load, the first time the stats panel is opened -- which is what
   * says whether the panel earns its place. Most opens come before the day's clock starts
   * or on a finished board reopened later, so this must not wait for a run: gating it on
   * one once meant the tally heard almost none of them. With a run on record the server
   * keeps it as a flag on that run, to read against the run's time; without one it is
   * counted on its own and never as a play.
   */
  const reportedStats = useRef(false);
  const noteStatsOpened = useCallback(() => {
    if (isPractice || reportedStats.current) return;
    reportedStats.current = true;
    count(runId, day, 'stats');
  }, [isPractice, runId, day]);

  // Every button that opens a panel is a switch, not a door. Solving used to be one-way
  // -- the result card came down on any tap and a refresh was the only way back to your
  // own time -- so the clock and the badge lead back to it for as long as the day lasts.
  // Whatever is up comes down first, so only one panel is ever on the board; pressing
  // the button belonging to the panel already up just puts it away, rather than closing
  // it and opening it again in the same tap.
  const togglePanel = useCallback(
    (panel: 'result' | 'credits' | 'howto' | 'stats') => {
      const wasOpen = {
        result: showResult,
        credits: showCredits,
        howto: showHowTo,
        stats: showStats,
      }[panel];
      dismissPanels();
      if (wasOpen) return;
      if (panel === 'result') setShowResult(true);
      else if (panel === 'credits') setShowCredits(true);
      else if (panel === 'stats') {
        setShowStats(true);
        noteStatsOpened();
      } else setShowHowTo(true);
    },
    [showResult, showCredits, showHowTo, showStats, dismissPanels, noteStatsOpened],
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
            and pressing it says what the play-testing round involves. */}
        {invite && (
          <button
            type="button"
            className={`test-pill${showTestNote ? ' is-open' : ''}`}
            onClick={toggleTestNote}
            title="Join a play-testing round"
            aria-expanded={showTestNote}
            aria-controls="test-note"
          >
            TEST
          </button>
        )}
        {/* The clock only while there is a hunt to time. Either side of one -- before the
            first move, and once the day is over -- the same slot is the way into the
            player's stats. The badge is still the way back to the result. */}
        {startedAt !== null && done === null ? (
          <p className={`clock${running ? ' is-running' : ''}`}>{formatTime(clock)}</p>
        ) : (
          <button
            type="button"
            className={`btn btn-icon btn-stats${showStats ? ' is-on' : ''}`}
            onClick={() => togglePanel('stats')}
            title="Your stats"
            aria-label="Your stats"
            aria-pressed={showStats}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 18v-6M12 18V6M18 18v-9" />
            </svg>
          </button>
        )}
        <div className="topbar-actions">
          {done !== null && (
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
          {startedAt !== null && done === null && (
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
          {/* Hide one for a friend, offered only once today's hunt is over: before that
              it is a door out of a run in progress, and it would give away that every
              painting on its list is one the calendar has already served. */}
          {done !== null && (
            <button
              type="button"
              className="btn btn-icon btn-hide"
              onClick={openMaker}
              title="Hide one for a friend"
              aria-label="Hide one for a friend"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 7h4a2.5 2.5 0 1 1 5 0h4v4a2.5 2.5 0 1 1 0 5v4h-4a2.5 2.5 0 1 0-5 0H5v-4a2.5 2.5 0 1 0 0-5z" />
              </svg>
            </button>
          )}
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

      {invite && showTestNote && (
        <p className="test-note" id="test-note">
          {/* The link opens a new tab on purpose: the player is very likely mid-hunt
              with a clock running, and taking the page away from them to ask a favour
              is a good way to lose both the run and the favour. */}
          <span>
            {invite.done ? (
              'Thank you for the play-testing round — your answers are in.'
            ) : (
              <>
                A play-testing round is open: {invite.hunts} short hunts on paintings that
                are not in the game.{' '}
                <a href="/?beta" target="_blank" rel="noopener noreferrer">
                  Try them in a new tab
                </a>
                .
              </>
            )}
          </span>
          <button
            type="button"
            className="note-close"
            onClick={toggleTestNote}
            aria-label="Hide the play-testing note"
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
            className="note-close"
            onClick={dismissWarning}
            aria-label="Hide this warning"
          >
            &times;
          </button>
        </p>
      )}

      {isPractice && <p className="practice-note">practice mode — this run is not recorded</p>}

      {/* Test mode looks exactly like the real game, which is the point of it and also
          the danger: without this there is nothing on the screen to tell you that the
          streak you are looking at is not your streak. It carries its own way out,
          because the way out is a plain address the banner can simply link to -- the
          mode lives in the URL and nowhere else. */}
      {isTest && (
        <p className="test-banner">
          <span className="test-banner-what">
            test mode <span>— separate store, tally not counted</span>
          </span>
          <a className="test-banner-exit" href="./">
            exit
          </a>
        </p>
      )}

      <main className="board">
        <Stage
          stageRef={stageRef}
          puzzle={puzzle}
          transform={transform ?? { x: 0, y: 0, scale: 1, rot: 0 }}
          fitScale={fitScale}
          showRing={done !== null && showRing}
          hint={hinted && done === null ? circle : null}
          blurred={paused || (startedAt === null && done === null)}
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

        {pleading && (
          <p className="giveup-note is-plea" role="status" key={pleading.n}>
            {pleading.text}
          </p>
        )}

        {/* Visible from the moment the clock starts, and shut rather than hidden until
            the day has had a proper hunt out of the player. A button that appears from
            nowhere half way through a run is a button nobody knows is coming, and the
            player it exists for -- the one about to close the tab -- has to be able to
            see that a way out exists before they need it. Pressing it early is not a
            mis-tap either: it is somebody saying they are stuck, which is worth
            hearing, so it answers rather than doing nothing.

            Which is why it carries no disabled state at all, `aria-disabled` included:
            it is dimmed, but it is a button that works, and a screen reader announcing
            it as unavailable would be describing a different button. What changes
            before the gate is what pressing it does, and the label says so.

            It lives on the board rather than in the bar because the bar was full, and
            because this corner is where the answer arrives: press it and the reply --
            the question, or a word of encouragement -- comes up in the same band along
            the bottom. It stands down while that reply is on screen, which is also what
            keeps the two off each other on a narrow phone, where the note is nearly the
            full width of the board. */}
        {startedAt !== null && done === null && !confirming && !pleading && !hintNote && (
          <button
            type="button"
            className={`giveup-btn${canGiveUp ? '' : ' is-shut'}`}
            onClick={askToGiveUp}
            title={
              canGiveUp
                ? 'Stop the clock and show me where it is'
                : 'Not yet — keep looking a little longer'
            }
          >
            give up
          </button>
        )}

        {/* The hint sits in the opposite corner from the give-up, and follows the same
            rules: there from the moment the clock starts, shut until the day has had a
            real hunt, and out of the way while a note is up along the bottom. It opens
            before the give-up does, because it is the gentler of the two. */}
        {startedAt !== null && done === null && !hinted && !confirming && !pleading && (
          <button
            type="button"
            className={`giveup-btn hint-btn${canHint ? '' : ' is-shut'}${canHint && canGiveUp ? ' is-nudge' : ''}`}
            onClick={askForHint}
            title={canHint ? 'Show me roughly where to look' : 'Not yet — keep looking a little longer'}
          >
            hint
          </button>
        )}

        {hintNote && done === null && !confirming && !pleading && (
          <p className="giveup-note is-plea" role="status">
            The {puzzle.thing} is somewhere inside the circle.
          </p>
        )}

        {/* Gone the instant the run ends, including by the player finding the thing
            while the question is still on the screen -- which happens, because the board
            stays live behind it. */}
        {confirming && done === null && (
          <div ref={confirmRef} className="giveup-note" role="dialog" aria-label="Give up?">
            {/* Offered first to anyone who has not taken it: a hint keeps the streak and
                leaves the find to them, which is almost always what a stuck player wants.
                So it is the one bright button, and giving up is the quiet one at the end. */}
            {canHint ? (
              <>
                <span>Try a hint instead? It keeps your streak. Giving up ends it.</span>
                <button
                  type="button"
                  className="btn btn-primary giveup-hint"
                  onClick={() => {
                    setConfirming(false);
                    askForHint();
                  }}
                >
                  give me a hint
                </button>
                <button type="button" className="btn giveup-no" onClick={() => setConfirming(false)}>
                  keep looking
                </button>
                <button type="button" className="btn giveup-yes" onClick={onGiveUp}>
                  give up
                </button>
              </>
            ) : (
              <>
                <span>
                  Show you where it is? The day counts as played, but it ends your streak.
                </span>
                <button type="button" className="btn giveup-yes" onClick={onGiveUp}>
                  show me
                </button>
                <button type="button" className="btn giveup-no" onClick={() => setConfirming(false)}>
                  keep looking
                </button>
              </>
            )}
          </div>
        )}

        {/* After a give-up the run is over, but the board is not: the shape is framed
            for them and they are free to look around the painting at what they walked
            past. Nothing they do from here is recorded. */}
        {gaveUpMs !== null && !showResult && (
          <p className="reveal-note">
            <span>
              There it is. Nothing more is recorded today — have a look around, and come
              back tomorrow.
            </span>
          </p>
        )}

        {!ready && <p className="loading">Loading today&rsquo;s painting…</p>}

        {/* After a give-up the run is over but the board is not, so the badge still has
            to go green when they frame the shape they were shown -- left on amber it
            reads as a board that will not let them finish. Nothing is recorded either
            way; the time that counts is when they gave up. */}
        <ReferenceCard
          puzzle={puzzle}
          targetSize={targetSize}
          match={match}
          solvedMs={solvedMs ?? (gaveUpMs !== null && match?.solved ? gaveUpMs : null)}
          onReopen={() => togglePanel('result')}
        />

        {showCredits && <Credits puzzle={puzzle} onDismiss={() => setShowCredits(false)} />}

        {showStats && <StatsPanel onDismiss={() => setShowStats(false)} />}

        {showHowTo && <HowTo thing={puzzle.thing} rung={RAMP[puzzle.dayOfWeek].label} onDismiss={dismissHowTo} />}

        {/* Dismissed on the click, not the pointerdown. The badge under the corner of
            the scrim is the way back to the result card, and closing on the way down
            took the scrim out from under the finger before the tap had finished -- the
            click the browser sends afterwards then landed on the badge and put the card
            straight back up, so the result flashed instead of closing. Waiting for the
            click keeps the scrim there to absorb it. */}
        {anyPanel && <div className="scrim" onClick={dismissPanels} />}

        {showResult && done !== null && (
          <ResultCard
            day={puzzleNumber(day)}
            puzzle={puzzle}
            ms={done}
            stats={stats}
            isPractice={isPractice}
            gaveUp={gaveUpMs !== null}
            metrics={metrics}
            tally={isPractice ? null : tally}
            retuned={retuned}
            week={sundayWeek}
            onShared={onShared}
            onReplay={replay}
          />
        )}
      </main>

      {updateAvailable && <UpdateNotice />}

      {done !== null && madeOnce && (
        <div className="hide-layer" hidden={!making}>
          <HideMaker onClose={closeMaker} />
        </div>
      )}
    </div>
  );
}
