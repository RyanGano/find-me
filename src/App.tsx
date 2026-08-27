import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HowTo } from './components/HowTo';
import { ReferenceCard } from './components/ReferenceCard';
import { ResultCard } from './components/ResultCard';
import { Stage } from './components/Stage';
import { puzzleNumber, selectPuzzle } from './game/daily';
import { RAMP } from './game/difficulty';
import { formatTime } from './game/format';
import { evaluate, targetDisplaySize } from './game/match';
import { getCurrentResult, getStats, saveResult, type Stats } from './game/storage';
import { compose, constrainPan, fitTransform } from './game/transform';
import type { Transform } from './game/types';
import type { GestureDelta } from './game/transform';
import { useGestures } from './hooks/useGestures';

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

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [solvedMs, setSolvedMs] = useState<number | null>(prior?.ms ?? null);
  const [showResult, setShowResult] = useState(Boolean(prior));
  // The reveal ring is a spoiler once the hunt is over, so let the player hide it
  // while they look at the painting itself.
  const [showRing, setShowRing] = useState(true);
  const [stats, setStats] = useState<Stats>(() => getStats(day));

  const [showHowTo, setShowHowTo] = useState(
    () => !prior && !isPractice && !localStorage.getItem(HOWTO_SEEN),
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

  useEffect(() => {
    if (!size) return;
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

  const running = startedAt !== null && solvedMs === null;

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
    enabled: ready && !showHowTo,
  });

  // Tick the visible clock while the run is live.
  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 90);
    return () => clearInterval(id);
  }, [running, startedAt]);

  // Land the solve the moment size, angle and framing all line up.
  useEffect(() => {
    if (!running || startedAt === null || !match?.solved) return;
    const ms = performance.now() - startedAt;
    setSolvedMs(ms);
    setElapsed(ms);
    setShowResult(true);
    if (!isPractice) saveResult(day, ms, puzzle.version);
    setStats(getStats(day));
  }, [match?.solved, running, startedAt, day, isPractice, puzzle.version]);

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
              className={`btn btn-icon${showRing ? ' is-on' : ''}`}
              onClick={() => setShowRing((prev) => !prev)}
              title={showRing ? 'Hide the reveal ring' : 'Show the reveal ring'}
              aria-pressed={showRing}
            >
              ◎
            </button>
          )}
          <button type="button" className="btn btn-icon" onClick={reset} title="Reset view">
            ⟲
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
          blurred={startedAt === null && solvedMs === null}
          onReady={() => setReady(true)}
        />

        {!ready && <p className="loading">Loading today&rsquo;s painting…</p>}

        <ReferenceCard
          puzzle={puzzle}
          targetSize={targetSize}
          match={match}
          solved={solvedMs !== null}
        />

        {showHowTo && <HowTo thing={puzzle.thing} rung={RAMP[puzzle.dayOfWeek].label} onDismiss={dismissHowTo} />}

        {showResult && solvedMs !== null && (
          <ResultCard
            day={puzzleNumber(day)}
            puzzle={puzzle}
            ms={solvedMs}
            stats={stats}
            isPractice={isPractice}
            onReplay={replay}
          />
        )}
      </main>
    </div>
  );
}
