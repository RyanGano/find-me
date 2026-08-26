import type { Transform, Vec } from './types';

export const IDENTITY: Transform = { x: 0, y: 0, scale: 1, rot: 0 };

export const DEG = 180 / Math.PI;
export const RAD = Math.PI / 180;

/** Map a point from image space to screen space. */
export function apply(t: Transform, p: Vec): Vec {
  const c = Math.cos(t.rot);
  const s = Math.sin(t.rot);
  const sx = p.x * t.scale;
  const sy = p.y * t.scale;
  return { x: c * sx - s * sy + t.x, y: s * sx + c * sy + t.y };
}

/** Map a point from screen space back to image space. */
export function invert(t: Transform, p: Vec): Vec {
  const c = Math.cos(-t.rot);
  const s = Math.sin(-t.rot);
  const dx = p.x - t.x;
  const dy = p.y - t.y;
  return { x: (c * dx - s * dy) / t.scale, y: (s * dx + c * dy) / t.scale };
}

export interface GestureDelta {
  /** Multiplicative zoom about `pivot`. */
  scaleBy?: number;
  /** Additional rotation about `pivot`, in radians. */
  rotBy?: number;
  /** Screen-space point held fixed by the scale/rotation. */
  pivot?: Vec;
  /** Screen-space translation applied after the scale/rotation. */
  pan?: Vec;
}

export interface ScaleLimits {
  min: number;
  max: number;
}

/**
 * Compose a similarity transform (zoom + twist about a pivot, then a pan) onto an
 * existing viewport transform. Clamping the scale also damps the pivot motion so the
 * image does not drift once a zoom limit is reached.
 */
export function compose(t: Transform, d: GestureDelta, limits?: ScaleLimits): Transform {
  const pivot = d.pivot ?? { x: 0, y: 0 };
  const pan = d.pan ?? { x: 0, y: 0 };
  const rotBy = d.rotBy ?? 0;

  let k = d.scaleBy ?? 1;
  if (limits) {
    const wanted = t.scale * k;
    const clamped = Math.min(limits.max, Math.max(limits.min, wanted));
    k = clamped / t.scale;
  }

  const c = Math.cos(rotBy) * k;
  const s = Math.sin(rotBy) * k;
  const dx = t.x - pivot.x;
  const dy = t.y - pivot.y;

  return {
    x: c * dx - s * dy + pivot.x + pan.x,
    y: s * dx + c * dy + pivot.y + pan.y,
    scale: t.scale * k,
    rot: t.rot + rotBy,
  };
}

/** The transform that centres an image of the given size inside the viewport. */
export function fitTransform(
  imageW: number,
  imageH: number,
  viewportW: number,
  viewportH: number,
  padding = 0.92,
): Transform {
  const scale = Math.min(viewportW / imageW, viewportH / imageH) * padding;
  return {
    x: (viewportW - imageW * scale) / 2,
    y: (viewportH - imageH * scale) / 2,
    scale,
    rot: 0,
  };
}

/** Wrap an angle (radians) into (-period/2, period/2]. */
export function wrapAngle(a: number, period = Math.PI * 2): number {
  const half = period / 2;
  let x = (a + half) % period;
  if (x < 0) x += period;
  return x - half;
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function angleBetween(a: Vec, b: Vec): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Derive the gesture that carries the pointer pair `from` onto the pair `to`.
 * Used for two-finger pinch/twist/pan, where all three happen at once.
 */
export function gestureFromPointerPair(
  from: [Vec, Vec],
  to: [Vec, Vec],
): GestureDelta {
  const d0 = dist(from[0], from[1]);
  const d1 = dist(to[0], to[1]);
  const pivot = midpoint(from[0], from[1]);
  return {
    scaleBy: d0 > 0.5 ? d1 / d0 : 1,
    rotBy: wrapAngle(angleBetween(to[0], to[1]) - angleBetween(from[0], from[1])),
    pivot,
    pan: {
      x: midpoint(to[0], to[1]).x - pivot.x,
      y: midpoint(to[0], to[1]).y - pivot.y,
    },
  };
}

/**
 * Keep the painting from being flung off into the void: after every gesture, nudge the
 * translation back until a decent slice of the image still overlaps the viewport.
 */
export function constrainPan(
  t: Transform,
  imageW: number,
  imageH: number,
  viewportW: number,
  viewportH: number,
  minVisible = 0.35,
): Transform {
  const corners = [
    apply(t, { x: 0, y: 0 }),
    apply(t, { x: imageW, y: 0 }),
    apply(t, { x: imageW, y: imageH }),
    apply(t, { x: 0, y: imageH }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const needX = Math.min(maxX - minX, viewportW) * minVisible;
  const needY = Math.min(maxY - minY, viewportH) * minVisible;

  let dx = 0;
  if (maxX < needX) dx = needX - maxX;
  else if (minX > viewportW - needX) dx = viewportW - needX - minX;

  let dy = 0;
  if (maxY < needY) dy = needY - maxY;
  else if (minY > viewportH - needY) dy = viewportH - needY - minY;

  return dx === 0 && dy === 0 ? t : { ...t, x: t.x + dx, y: t.y + dy };
}
