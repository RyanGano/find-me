import { NEAR_ANGLE_TOLERANCE_DEG, NEAR_SIZE_TOLERANCE, type MatchState } from './match';

/**
 * What the run looked like, rather than just how long it took.
 *
 * The clock alone cannot tell a player who took two minutes to spot the shape and then
 * landed it in one clean move apart from one who spotted it in five seconds and then
 * spent two minutes wobbling around the tolerance. Those are different kinds of player,
 * and the age estimate in `age.ts` is the whole reason to tell them apart.
 *
 * Everything here is plain numbers so a run in progress can be banked into storage and
 * handed straight back -- an accidental back-swipe must not reset what the run has
 * already shown about how it is being played.
 */
export interface RunMetrics {
  /**
   * Time from the start of the run to the final approach, in ms. This is the hunt:
   * everything before the player had the shape in front of them for the last time.
   * Null until the run is finished.
   */
  searchMs: number | null;
  /**
   * Time from the final approach to the solve, in ms: sizing and squaring up once the
   * shape was found. Null until the run is finished.
   */
  adjustMs: number | null;
  /**
   * How many times the shape was in front of the player -- close up, near the middle of
   * the screen -- and then left again. Panning straight past the thing you are looking
   * for is the single most age-legible thing a player does.
   */
  passes: number;
  /**
   * Sign changes on size or angle error made from inside the warm band: crossing the
   * target and having to come back. Fine motor control, and how well the player reads
   * the closeness hint.
   */
  overshoots: number;
  /** Zoom direction changes across the run: in-out-in dithering while searching. */
  reversals: number;
  /**
   * Time spent in gaps with no input at all. Deliberation, or losing the thread.
   * Overlaps with `searchMs` on purpose, but it is scored against the run's own length,
   * so an evenly slow player is not charged for it twice -- only one whose slowness is
   * concentrated in frozen pauses.
   */
  idleMs: number;
}

/**
 * The collector. `m` is what survives into the result; the rest is the running state
 * needed to spot the transitions, and is thrown away once the run ends.
 */
export interface Tracker {
  m: RunMetrics;
  /** Whether the shape was in the hot zone at the last sample. */
  hot: boolean;
  /** Run-clock time of the most recent entry into the hot zone. */
  hotAt: number | null;
  /** Which side of the target size/angle we were last seen on, or 0 for "far away". */
  sizeSign: number;
  angleSign: number;
  /** Last registered zoom direction, and the scale it was registered at. */
  zoomDir: number;
  zoomRef: number | null;
  /** Run-clock time of the last sample, for measuring idle gaps. */
  lastAt: number;
}

/**
 * The hot zone: the shape is close enough and central enough that the player is
 * plainly working on it rather than still scanning the canvas. Leaving it again is
 * what counts as panning past.
 */
/** Fractions of the reference size the shape must be drawn between. */
const HOT_MIN_SIZE = 0.45;
const HOT_MAX_SIZE = 2.5;
/** How near the middle of the stage the shape must sit, as a fraction of the short side. */
const HOT_CENTRE = 0.32;
/** A gap longer than this is the player thinking, not the player working. */
const IDLE_MS = 2500;
/** Log-scale zoom change before a direction is believed, so pinch jitter is not a reversal. */
const ZOOM_DEADBAND = 0.02;

export function newTracker(): Tracker {
  return {
    m: { searchMs: null, adjustMs: null, passes: 0, overshoots: 0, reversals: 0, idleMs: 0 },
    hot: false,
    hotAt: null,
    sizeSign: 0,
    angleSign: 0,
    zoomDir: 0,
    zoomRef: null,
    lastAt: 0,
  };
}

export function isRunMetrics(value: unknown): value is RunMetrics {
  const m = value as RunMetrics | undefined;
  return (
    !!m &&
    (m.searchMs === null || typeof m.searchMs === 'number') &&
    (m.adjustMs === null || typeof m.adjustMs === 'number') &&
    typeof m.passes === 'number' &&
    typeof m.overshoots === 'number' &&
    typeof m.reversals === 'number' &&
    typeof m.idleMs === 'number'
  );
}

export function isTracker(value: unknown): value is Tracker {
  const t = value as Tracker | undefined;
  return (
    !!t &&
    isRunMetrics(t.m) &&
    typeof t.hot === 'boolean' &&
    (t.hotAt === null || typeof t.hotAt === 'number') &&
    typeof t.sizeSign === 'number' &&
    typeof t.angleSign === 'number' &&
    typeof t.zoomDir === 'number' &&
    (t.zoomRef === null || typeof t.zoomRef === 'number') &&
    typeof t.lastAt === 'number'
  );
}

export function isHot(
  match: MatchState,
  viewport: { w: number; h: number },
  targetSize: number,
): boolean {
  if (!match.onScreen) return false;
  const zoom = match.displaySize / targetSize;
  if (zoom < HOT_MIN_SIZE || zoom > HOT_MAX_SIZE) return false;
  const dx = match.screen.x - viewport.w / 2;
  const dy = match.screen.y - viewport.h / 2;
  return Math.hypot(dx, dy) <= HOT_CENTRE * Math.min(viewport.w, viewport.h);
}

/**
 * Which side of the target an error is on, and whether arriving here crossed it.
 *
 * The side is only remembered while the player is somewhere near it. Sailing through
 * zero from right across the canvas is travelling, not overshooting; coming back across
 * it from inside the warm band is a miss, and that is the distinction being drawn.
 */
export function crossing(prev: number, err: number, tol: number): [sign: number, over: boolean] {
  if (Math.abs(err) > 2 * tol) return [0, false];
  if (Math.abs(err) > tol) return [prev, false];
  const sign = err === 0 ? prev : err > 0 ? 1 : -1;
  return [sign, prev !== 0 && sign !== 0 && sign !== prev];
}

/**
 * Fold one look at the board into the tracker. Called on every change to the view while
 * the run is live; `at` is the run clock, which freezes while the game is paused and
 * carries across a resume, so nothing here can be gamed by walking away.
 */
export function sample(
  tracker: Tracker,
  at: number,
  match: MatchState,
  scale: number,
  viewport: { w: number; h: number },
  targetSize: number,
): Tracker {
  const m = { ...tracker.m };
  const next: Tracker = { ...tracker, m, lastAt: at };

  const gap = at - tracker.lastAt;
  if (gap > IDLE_MS) m.idleMs += gap;

  if (tracker.zoomRef === null) {
    next.zoomRef = scale;
  } else {
    const step = Math.log(scale / tracker.zoomRef);
    if (Math.abs(step) > ZOOM_DEADBAND) {
      const dir = step > 0 ? 1 : -1;
      if (tracker.zoomDir !== 0 && dir !== tracker.zoomDir) m.reversals += 1;
      next.zoomDir = dir;
      next.zoomRef = scale;
    }
  }

  const hot = isHot(match, viewport, targetSize);
  if (hot && !tracker.hot) next.hotAt = at;
  if (!hot && tracker.hot) m.passes += 1;
  next.hot = hot;

  // Only judge the fine adjustments once the shape is actually in front of the player.
  // Size and angle drift constantly while scanning, and none of that is aiming.
  if (hot) {
    const [sizeSign, sizeOver] = crossing(tracker.sizeSign, match.sizeError, NEAR_SIZE_TOLERANCE);
    const [angleSign, angleOver] = crossing(
      tracker.angleSign,
      match.angleError,
      NEAR_ANGLE_TOLERANCE_DEG,
    );
    next.sizeSign = sizeSign;
    next.angleSign = angleSign;
    if (sizeOver) m.overshoots += 1;
    if (angleOver) m.overshoots += 1;
  }

  return next;
}

/**
 * Close the run out. The split is taken at the *last* entry into the hot zone: if the
 * player found the shape, lost it, and found it again, the time in between was more
 * hunting, and only the final approach counts as adjusting.
 */
export function finish(tracker: Tracker, solvedAt: number): RunMetrics {
  const searchMs = Math.min(tracker.hotAt ?? solvedAt, solvedAt);
  return {
    ...tracker.m,
    // A gap running right up to the solve is only seen now.
    idleMs: tracker.m.idleMs + (solvedAt - tracker.lastAt > IDLE_MS ? solvedAt - tracker.lastAt : 0),
    searchMs: Math.max(0, searchMs),
    adjustMs: Math.max(0, solvedAt - searchMs),
  };
}
