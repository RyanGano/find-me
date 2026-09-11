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
  /**
   * What happened to the shape, in order, one character per encounter, for the hunt trace
   * in the share text: `v` for having it in view and moving off it, `p` for lighting the
   * badge and losing it again, and a closing `f` for the find or `g` for a give-up. An
   * encounter that lit the badge is a `p` and not a `v` as well: the closer of the two.
   *
   * Events, not time: the clock sits beside the trace in the share text, and what a player
   * can learn from a trace -- theirs or a friend's -- is how often the shape was had and
   * let go, not how long the gaps between were. Never a place either: it records *that*
   * the shape was had, not where. Capped at `TRACE_MAX`.
   *
   * `s` is also accepted, from the first version of the trace (a slice of search time),
   * and is left out when drawn. Absent on runs recorded, or banked, before the trace
   * existed; those share as they always did.
   */
  trace?: string;
}

/** The longest a trace may get, ending included: one line on a phone's share sheet. */
export const TRACE_MAX = 12;
/**
 * How long the shape must stay lost before losing it counts. Squaring up at the edge of
 * the near band flickers the badge, and zooming at the edge of the hot zone's size range
 * flickers that; both are aiming, not losing the shape.
 */
export const TRACE_LOST_MS = 500;

/**
 * Bring a trace down to `max` characters: shorten the longest run of one mark, which
 * keeps every kind of event in the line, and only then drop the earliest events. The last
 * character -- the ending -- is never touched.
 */
export function compressTrace(trace: string, max = TRACE_MAX): string {
  let t = trace;
  while (t.length > max) {
    const runs = [...t.slice(0, -1).matchAll(/v{2,}|p{2,}|s{2,}/g)];
    if (runs.length > 0) {
      const longest = runs.reduce((a, b) => (b[0].length > a[0].length ? b : a));
      t = t.slice(0, longest.index) + t.slice(longest.index + 1);
    } else {
      t = t.slice(1);
    }
  }
  return t;
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
  /** Whether the badge was amber at the last sample. */
  near?: boolean;
  /** When the badge last went off, while it has not yet stayed off long enough to count. */
  lostAt?: number | null;
  /** Whether the shape was in view, by the trace's rule (`inView`), at the last sample. */
  seen?: boolean;
  /** When the shape last went out of view, while it has not yet stayed out long enough. */
  leftAt?: number | null;
  /** Whether the badge has lit during the current time the shape has been in view. */
  lit?: boolean;
}

/**
 * The hot zone: the shape is close enough, and plainly being worked on rather than
 * scanned past, that the player has found it. Leaving it again is what counts as
 * panning past. See `isHot` for what "plainly" means.
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
    m: {
      searchMs: null,
      adjustMs: null,
      passes: 0,
      overshoots: 0,
      reversals: 0,
      idleMs: 0,
      trace: '',
    },
    hot: false,
    hotAt: null,
    sizeSign: 0,
    angleSign: 0,
    zoomDir: 0,
    zoomRef: null,
    lastAt: 0,
    near: false,
    lostAt: null,
    seen: false,
    leftAt: null,
    lit: false,
  };
}

/**
 * The share of its final size the shape must be drawn at, whole on screen, to count as
 * in view for the trace -- about 15-22px across, and 3-6x zoom on a phone. Well below the
 * hot zone's floor, and with no need to be in the middle: the hot zone asks whether the
 * player has *found* the shape, and the trace's 🔍 asks whether it was there to be seen
 * and they went past it. Above anything the fitted view draws (4-19% across the shipped
 * puzzles), so a glance at the whole painting never counts.
 */
const IN_VIEW_SIZE = 0.25;

/** Whether the shape is in view for the trace's "moved past it". */
export function inView(match: MatchState, targetSize: number): boolean {
  return match.onScreen && match.displaySize / targetSize >= IN_VIEW_SIZE;
}

/**
 * Write down any loss that has now lasted long enough to be real: the badge going off
 * (`p`), then the shape going out of view without the badge having lit (`v`). `force`
 * writes them however recent, for a give-up. Mutates `next` and `m`, the caller's copies.
 */
function settle(tracker: Tracker, next: Tracker, m: RunMetrics, at: number, force = false): void {
  if (typeof m.trace !== 'string') return;
  const due = (since: number | null | undefined): since is number =>
    typeof since === 'number' && (force || at - since >= TRACE_LOST_MS);
  if (due(tracker.lostAt)) {
    m.trace = compressTrace(m.trace + 'p');
    next.lostAt = null;
  }
  if (due(tracker.leftAt)) {
    if (!tracker.lit) m.trace = compressTrace(m.trace + 'v');
    next.leftAt = null;
    next.lit = false;
  }
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
    typeof m.idleMs === 'number' &&
    (m.trace === undefined || (typeof m.trace === 'string' && /^[svpfg]*$/.test(m.trace)))
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
    typeof t.lastAt === 'number' &&
    (t.near === undefined || typeof t.near === 'boolean') &&
    (t.lostAt === undefined || t.lostAt === null || typeof t.lostAt === 'number') &&
    (t.seen === undefined || typeof t.seen === 'boolean') &&
    (t.leftAt === undefined || t.leftAt === null || typeof t.leftAt === 'number') &&
    (t.lit === undefined || typeof t.lit === 'boolean')
  );
}

/**
 * Whether the shape is in the hot zone. It always has to be on screen at roughly the
 * right size; on top of that, it is *entered* by bringing the shape near the middle of
 * the stage or by lighting the badge, and once in, it is *kept* anywhere on screen.
 *
 * The middle alone used to be the whole rule, and it mis-read every player who frames
 * the shape somewhere else -- up by the badge, say, to compare the two. Such a run never
 * entered the zone, so its framing time read as zero and its near misses and overshoots
 * went uncounted, and it scored years younger than the same hands framing in the middle;
 * dragging a found shape up to the badge, meanwhile, counted as losing it. The middle is
 * still one way in, because at the fitted zoom a shape sitting unnoticed at the edge of
 * the screen has not been found. The badge is the other, because it lights only on the
 * right size and angle, and nobody gets there by accident.
 */
export function isHot(
  match: MatchState,
  viewport: { w: number; h: number },
  targetSize: number,
  wasHot = false,
): boolean {
  if (!match.onScreen) return false;
  const zoom = match.displaySize / targetSize;
  if (zoom < HOT_MIN_SIZE || zoom > HOT_MAX_SIZE) return false;
  if (wasHot || match.near) return true;
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

  settle(tracker, next, m, at);

  const hot = isHot(match, viewport, targetSize, tracker.hot);
  if (hot && !tracker.hot) next.hotAt = at;
  if (!hot && tracker.hot) m.passes += 1;
  next.hot = hot;

  // The trace's view of the same moves, each loss held back until it has lasted: coming
  // straight back is one encounter, not two.
  if (match.near && !tracker.near) next.lostAt = null;
  if (!match.near && tracker.near) next.lostAt = at;
  const seen = inView(match, targetSize);
  if (match.near) next.lit = true;
  if (seen && !tracker.seen) next.leftAt = null;
  if (!seen && tracker.seen) next.leftAt = at;
  next.seen = seen;
  next.near = match.near;

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
 *
 * `end` closes the trace: a find, or a give-up, which is otherwise the same close-out.
 */
export function finish(
  tracker: Tracker,
  solvedAt: number,
  end: 'found' | 'gaveUp' = 'found',
): RunMetrics {
  const searchMs = Math.min(tracker.hotAt ?? solvedAt, solvedAt);
  const m = { ...tracker.m };
  // A find is the shape had and kept, so nothing still pending was really lost; a
  // give-up lost whatever it last let go of, however recently.
  if (end === 'gaveUp') settle(tracker, { ...tracker }, m, solvedAt, true);
  if (typeof m.trace === 'string') m.trace = compressTrace(m.trace + (end === 'found' ? 'f' : 'g'));
  return {
    ...m,
    // A gap running right up to the solve is only seen now.
    idleMs: tracker.m.idleMs + (solvedAt - tracker.lastAt > IDLE_MS ? solvedAt - tracker.lastAt : 0),
    searchMs: Math.max(0, searchMs),
    adjustMs: Math.max(0, solvedAt - searchMs),
  };
}
