import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Credits } from './components/Credits';
import { HowTo } from './components/HowTo';
import { ReferenceCard } from './components/ReferenceCard';
import { ResultCard } from './components/ResultCard';
import { Stage } from './components/Stage';
import { UpdateNotice } from './components/UpdateNotice';
import { puzzleNumber, selectPuzzle } from './game/daily';
import { RAMP } from './game/difficulty';
import { formatTime } from './game/format';
import { evaluate, targetDisplaySize } from './game/match';
import { finish, newTracker, sample, type RunMetrics, type Tracker } from './game/metrics';
import {
  clearProgress,
  getCurrentResult,
  getProgress,
  getStats,
  saveProgress,
  saveResult,
  type Stats,
} from './game/storage';
import { compose, constrainPan, fitTransform } from './game/transform';
import type { Transform } from './game/types';
import type { GestureDelta } from './game/transform';
import { useGestures } from './hooks/useGestures';
import { useUpdateAvailable } from './hooks/useUpdateAvailable';

const HOWTO_SEEN = 'find-me:howto-seen';

interface Size {
  w: number;
  h: number;
}

export default function App() {
  const selection = useMemo(() => selectPuzzle(window.location.search), []);
  const { puzzle, index: day, isPractice } = selection;

  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const [ready, setReady] = useState(false);

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

  // A resumed run opens held, so the clock does not run while the player re-orients.
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    saved ? performance.now() - saved.ms : null,
  );
  const [elapsed, setElapsed] = useState(saved?.ms ?? 0);
  // A pause blurs the painting and freezes the clock, so a player can look away
  // mid-hunt without the run reading their kettle break as thinking time.
  const [paused, setPaused] = useState(Boolean(saved));
  // True until the player picks the resumed run back up: the board is theirs from a
  // moment ago, and it should say so rather than looking like a fresh puzzle.
  const [resuming, setResuming] = useState(Boolean(saved));
  const [solvedMs, setSolvedMs] = useState<number | null>(prior?.ms ?? null);
  // How the run is being played, for the Find Me Age. The collector rides along with the
  // banked run, so a back-swipe costs nothing; the finished metrics go with the result.
  const tracker = useRef<Tracker>(saved?.k ?? newTracker());
  const [metrics, setMetrics] = useState<RunMetrics | null>(prior?.m ?? null);
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
    () => !prior && !saved && !isPractice && !localStorage.getItem(HOWTO_SEEN),
  );

  // Track the stage box; it drives both the fitted view and the target size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(
    (s: Size) => fitTransform(puzzle.width, puzzle.height, s.w, s.h),
    [puzzle.width, puzzle.height],
  );

  // The saved view is only meaningful in the stage box it was framed in, so it is claimed
  // by the first measure and only used if the board came back the same size.
  const pending = useRef(saved ? { t: saved.t, w: saved.w, h: saved.h } : null);

  useEffect(() => {
    if (!size) return;
    const resume = pending.current;
    if (resume) {
      pending.current = null;
      if (Math.abs(resume.w - size.w) < 1 && Math.abs(resume.h - size.h) < 1) {
        setTransform(resume.t);
        return;
      }
    }
    // Fit on first measure, and keep fitting while the board is still untouched.
    setTransform((prev) => (prev && startedAt !== null ? prev : fit(size)));
  }, [size, fit, startedAt]);

  const targetSize = size ? targetDisplaySize(size.w, size.h) : 96;

  const limits = useMemo(() => {
    if (!size) return undefined;
    const fitScale = fit(size).scale;
    const needed = targetSize / puzzle.target.size;
    return { min: fitScale * 0.6, max: Math.max(fitScale * 3, needed * 4) };
  }, [size, fit, targetSize, puzzle.target.size]);

  const match = useMemo(() => {
    if (!size || !transform) return null;
    return evaluate(puzzle.target, transform, size.w, size.h, targetSize);
  }, [puzzle.target, transform, size, targetSize]);

  const running = startedAt !== null && solvedMs === null && !paused;

  // Resuming rebases the start so the frozen elapsed time carries over untouched.
  const togglePause = useCallback(() => {
    if (startedAt === null || solvedMs !== null) return;
    setResuming(false);
    setPaused((prev) => {
      if (prev) setStartedAt(performance.now() - elapsed);
      else setElapsed(performance.now() - startedAt);
      return !prev;
    });
  }, [startedAt, solvedMs, elapsed]);

  const handleInteract = useCallback(() => {
    if (solvedMs !== null) return;
    setStartedAt((prev) => prev ?? performance.now());
  }, [solvedMs]);

  const handleGesture = useCallback(
    (delta: GestureDelta) => {
      setTransform((prev) => {
        if (!prev) return prev;
        const next = compose(prev, delta, limits);
        return size ? constrainPan(next, puzzle.width, puzzle.height, size.w, size.h) : next;
      });
    },
    [limits, size, puzzle.width, puzzle.height],
  );

  useGestures(stageRef, {
    onGesture: handleGesture,
    onInteract: handleInteract,
    enabled: ready && !showHowTo && !showCredits && !paused,
  });

  // Tick the visible clock while the run is live.
  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 90);
    return () => clearInterval(id);
  }, [running, startedAt]);

  // Watch how the run is being played. Declared above the solve effect on purpose: both
  // fire in the same commit as the winning move, and the solve must be closed out
  // against a tracker that has already seen that move.
  useEffect(() => {
    if (!running || startedAt === null || !match || !transform || !size) return;
    tracker.current = sample(
      tracker.current,
      performance.now() - startedAt,
      match,
      transform.scale,
      size,
      targetSize,
    );
  }, [match, transform, size, targetSize, running, startedAt]);

  // Land the solve the moment size, angle and framing all line up.
  useEffect(() => {
    if (!running || startedAt === null || !match?.solved) return;
    const ms = performance.now() - startedAt;
    const run = finish(tracker.current, ms);
    setSolvedMs(ms);
    setElapsed(ms);
    setMetrics(run);
    setShowResult(true);
    if (!isPractice) {
      saveResult(day, ms, puzzle.version, run);
      clearProgress();
    }
    setStats(getStats(day));
  }, [match?.solved, running, startedAt, day, isPractice, puzzle.version]);

  // Latest state, read by the leave handlers below -- they are registered once, and a
  // `pagehide` fires too late to wait on a re-render.
  const live = useRef<{ startedAt: number; elapsed: number; paused: boolean; t: Transform } | null>(
    null,
  );
  const stage = useRef<Size | null>(null);
  useEffect(() => {
    live.current =
      !isPractice && startedAt !== null && solvedMs === null && transform && size
        ? { startedAt, elapsed, paused, t: transform }
        : null;
    stage.current = size;
  });

  // Leaving the page banks the run. `visibilitychange` is the one event a phone reliably
  // fires when the tab is backgrounded or the browser is swiped away; `pagehide` covers a
  // real navigation, including the accidental back-swipe this exists for.
  useEffect(() => {
    const bank = () => {
      const run = live.current;
      const box = stage.current;
      if (!run || !box) return;
      saveProgress({
        day,
        v: puzzle.version,
        // Read the clock now, not at the last render: a run banked while it is still live
        // is worth exactly what it reads at the moment the page goes away.
        ms: run.paused ? run.elapsed : performance.now() - run.startedAt,
        t: run.t,
        w: box.w,
        h: box.h,
        k: tracker.current,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') bank();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', bank);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', bank);
    };
  }, [day, puzzle.version]);

  const reset = useCallback(() => {
    if (size) setTransform(fit(size));
  }, [size, fit]);

  const dismissHowTo = useCallback(() => {
    localStorage.setItem(HOWTO_SEEN, '1');
    setShowHowTo(false);
    stageRef.current?.focus();
  }, []);

  const replay = useCallback(() => {
    setShowResult(false);
    reset();
  }, [reset]);

  const clock = solvedMs ?? (startedAt === null ? 0 : elapsed);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="title">
          Find Me <span className="title-day">#{puzzleNumber(day)}</span>
          {/* Which rung of the week this is. Sunday being brutal is the design; without
              saying so, a player meeting it first just thinks the game is broken. */}
          <span className="title-rung">{RAMP[puzzle.dayOfWeek].label}</span>
        </h1>
        <p className={`clock${running ? ' is-running' : ''}${solvedMs !== null ? ' is-done' : ''}`}>
          {startedAt === null && solvedMs === null ? 'ready' : formatTime(clock)}
        </p>
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
            onClick={() => setShowCredits(true)}
            title="About the painting"
          >
            i
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setShowHowTo(true)}
            title="How to play"
          >
            ?
          </button>
        </div>
      </header>

      {isPractice && <p className="practice-note">practice mode — this run is not recorded</p>}

      <main className="board">
        <Stage
          stageRef={stageRef}
          puzzle={puzzle}
          transform={transform ?? { x: 0, y: 0, scale: 1, rot: 0 }}
          showRing={solvedMs !== null && showRing}
          blurred={paused || (startedAt === null && solvedMs === null)}
          paused={paused}
          resumed={resuming}
          onReady={() => setReady(true)}
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
          solved={solvedMs !== null}
        />

        {showCredits && <Credits puzzle={puzzle} onDismiss={() => setShowCredits(false)} />}

        {showHowTo && <HowTo thing={puzzle.thing} rung={RAMP[puzzle.dayOfWeek].label} onDismiss={dismissHowTo} />}

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
