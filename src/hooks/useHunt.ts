import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, targetDisplaySize } from '../game/match';
import { finish, newTracker, sample, type RunMetrics, type Tracker } from '../game/metrics';
import { compose, constrainPan, fitTransform } from '../game/transform';
import type { Puzzle, Transform } from '../game/types';
import type { GestureDelta } from '../game/transform';
import type { Progress } from '../game/storage';
import { useGestures } from './useGestures';

export interface Size {
  w: number;
  h: number;
}

/** Everything the caller needs to bank a run that is being walked away from. */
export interface LeftRun {
  ms: number;
  t: Transform;
  w: number;
  h: number;
  k: Tracker;
}

/**
 * One hunt, and who is keeping score.
 *
 * The hunt itself -- the clock, the gestures, the match, the solve -- is the same in
 * every context the game runs in, and has to be: a play-test that measures a slightly
 * different game measures nothing. What differs between the daily puzzle and the test
 * bench is only what happens at the three moments worth telling someone about, so those
 * are callbacks and nothing else here is.
 */
export interface HuntSession {
  puzzle: Puzzle;
  /** A run banked mid-hunt, handed back with its clock where it was. */
  resume?: Progress;
  /** A time already recorded for this puzzle: opens as a finished board, not a clock. */
  prior?: { ms: number; metrics?: RunMetrics };
  /** True while a panel is up and the board should not be taking gestures. */
  blocked?: boolean;
  /** The clock has started. Fired once per run; a resumed run has already fired it. */
  onStart?(runId: string): void;
  onSolved?(ms: number, metrics: RunMetrics, runId: string): void;
  /** The page is going away with the run unfinished. */
  onLeave?(run: LeftRun, runId: string): void;
  /**
   * Identifies this run to whatever is counting it. Supplied by the caller rather than
   * minted here, so that a resumed run carries the id it was banked with -- and so this
   * module stays free of randomness, which `determinism.test.ts` requires of everything
   * under `src/` bar one file.
   */
  runId: string;
}

/**
 * The run state machine: everything between the painting appearing and the shape being
 * framed. Lifted out of `App.tsx` unchanged, so that the daily game and the play-test
 * bench are the same game rather than two implementations that have to be kept in step.
 *
 * It owns no storage and no reporting. `App.tsx` turns the callbacks into a recorded
 * result, a banked run and a tally beacon; `Testbed.tsx` turns them into a review.
 */
export function useHunt(session: HuntSession) {
  const { puzzle, resume, prior, blocked, runId } = session;

  // The callbacks are read back from a ref rather than closed over, because the leave
  // handlers below are registered once and a `pagehide` fires far too late to wait on
  // a re-render.
  const on = useRef(session);
  useEffect(() => {
    on.current = session;
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const [ready, setReady] = useState(false);

  // A resumed run opens held, so the clock does not run while the player re-orients.
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    resume ? performance.now() - resume.ms : null,
  );
  const [elapsed, setElapsed] = useState(resume?.ms ?? 0);
  // A pause blurs the painting and freezes the clock, so a player can look away
  // mid-hunt without the run reading their kettle break as thinking time.
  const [paused, setPaused] = useState(Boolean(resume));
  // True until the player picks the resumed run back up: the board is theirs from a
  // moment ago, and it should say so rather than looking like a fresh puzzle.
  const [resuming, setResuming] = useState(Boolean(resume));
  const [solvedMs, setSolvedMs] = useState<number | null>(prior?.ms ?? null);
  // How the run is being played, for the Find Me Age. The collector rides along with the
  // banked run, so a back-swipe costs nothing; the finished metrics go with the result.
  const tracker = useRef<Tracker>(resume?.k ?? newTracker());
  const [metrics, setMetrics] = useState<RunMetrics | null>(prior?.metrics ?? null);

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
  const pending = useRef(resume ? { t: resume.t, w: resume.w, h: resume.h } : null);

  useEffect(() => {
    if (!size) return;
    const saved = pending.current;
    if (saved) {
      pending.current = null;
      if (Math.abs(saved.w - size.w) < 1 && Math.abs(saved.h - size.h) < 1) {
        setTransform(saved.t);
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

  // The clock starting is what counts as a play. Reported once; a resumed run was
  // already reported when it first began, under the same id.
  const reportedStart = useRef(Boolean(resume));
  useEffect(() => {
    if (startedAt === null || reportedStart.current) return;
    reportedStart.current = true;
    on.current.onStart?.(runId);
  }, [startedAt, runId]);

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
    enabled: ready && !blocked && !paused,
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
    // The winning move is a gesture, but `match` is derived during render, so the solve
    // can only be seen from here. This is the run state machine's one-way transition into
    // "solved" -- it cannot cascade, because `match.solved` stays true and `running` is
    // false on the next pass.
    // oxlint-disable-next-line react/set-state-in-effect
    setSolvedMs(ms);
    setElapsed(ms);
    setMetrics(run);
    on.current.onSolved?.(ms, run, runId);
  }, [match?.solved, running, startedAt, runId]);

  // Latest state, read by the leave handlers below -- they are registered once, and a
  // `pagehide` fires too late to wait on a re-render.
  const live = useRef<{ startedAt: number; elapsed: number; paused: boolean; t: Transform } | null>(
    null,
  );
  const stage = useRef<Size | null>(null);
  useEffect(() => {
    live.current =
      startedAt !== null && solvedMs === null && transform && size
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
      // Read the clock now, not at the last render: a run banked while it is still live
      // is worth exactly what it reads at the moment the page goes away.
      const ms = run.paused ? run.elapsed : performance.now() - run.startedAt;
      on.current.onLeave?.({ ms, t: run.t, w: box.w, h: box.h, k: tracker.current }, runId);
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
  }, [runId]);

  const reset = useCallback(() => {
    if (size) setTransform(fit(size));
  }, [size, fit]);

  const clock = solvedMs ?? (startedAt === null ? 0 : elapsed);

  const onReady = useCallback(() => setReady(true), []);

  return {
    stageRef,
    size,
    transform,
    ready,
    onReady,
    fitScale: size ? fit(size).scale : 1,
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
  };
}
